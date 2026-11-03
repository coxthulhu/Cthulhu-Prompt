<script lang="ts">
  import { Copy } from 'lucide-svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import { setPromptTemplates } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
  import {
    isPromptStatus,
    PROMPT_STATUS_BEHAVIORS,
    PromptStatus,
    type PromptContentStatus,
    type PromptTemplateReference
  } from '@shared/domain/prompt/Prompt'
  import PromptTemplateSelectionDialog from './PromptTemplateSelectionDialog.svelte'
  import { applyPromptTemplates } from './promptTemplatingEngine'
  import type { MarkdownContentDraftRecord } from './markdownContentDraftRecord'

  /** Template selection, copy confirmation, and copy-driven status changes shared by prompt editor screens. */
  let {
    workspaceId,
    isTemplateCollection,
    promptDraftById,
    promptTemplateTextById,
    getStatus,
    onSetPromptStatus
  }: {
    workspaceId: string | null
    /** Templates are copied verbatim and never select templates of their own. */
    isTemplateCollection: boolean
    /** Editor view models for every prompt that can open these dialogs. */
    promptDraftById: Record<string, MarkdownContentDraftRecord>
    /** Full template text applied to copied prompts. */
    promptTemplateTextById: Record<string, string>
    /** Current workflow status of one prompt. */
    getStatus: (promptId: string) => PromptContentStatus
    /** Applies the status change that follows a successful copy. */
    onSetPromptStatus: (promptId: string, status: PromptContentStatus) => void
  } = $props()

  let isTemplateSelectionDialogOpen = $state(false)
  /** Prompt whose templates the open selection dialog edits. */
  let templateSelectionPromptId = $state<string | null>(null)
  let templateSelectionMode = $state<'select' | 'select-and-copy'>('select')
  /** Suspends either copy action until the user accepts its status change. */
  let pendingCopyConfirmation = $state<{
    status: PromptContentStatus
    resolve: (confirmed: boolean) => void
  } | null>(null)

  /** Confirms copying only when it moves a prompt out of an inactive workflow. */
  export const confirmPromptCopy = (promptId: string): Promise<boolean> => {
    /** Current status supplies both the confirmation condition and its explanation. */
    const status = getStatus(promptId)
    if (status !== PromptStatus.Backlog && status !== PromptStatus.Completed && status !== PromptStatus.Archived) {
      return Promise.resolve(true)
    }
    return new Promise((resolve) => {
      pendingCopyConfirmation = { status, resolve }
    })
  }

  /** Closes the confirmation and resumes or cancels the suspended copy action. */
  const resolveCopyConfirmation = (confirmed: boolean): void => {
    pendingCopyConfirmation!.resolve(confirmed)
    pendingCopyConfirmation = null
  }

  /** Returns the full text of each selected template that is still available. */
  export const getCopyTemplateTexts = (
    selectedTemplates: PromptTemplateReference[] | null | undefined
  ): string[] => {
    if (isTemplateCollection) return []
    return (selectedTemplates ?? []).flatMap((template) => {
      const selectedTemplateText = promptTemplateTextById[template.id]
      return selectedTemplateText === undefined ? [] : [selectedTemplateText]
    })
  }

  /** Opens template selection for one prompt, optionally copying after the selection. */
  export const openTemplateSelection = (promptId: string, mode: 'select' | 'select-and-copy'): void => {
    templateSelectionPromptId = promptId
    templateSelectionMode = mode
    isTemplateSelectionDialogOpen = true
  }

  /** Records that a copied prompt deliberately uses no template. */
  export const handlePromptCopySuccess = (promptId: string): void => {
    if (promptDraftById[promptId]!.templates === undefined) {
      setPromptTemplates(promptId, null)
    }
  }

  const handleTemplateSelect = (templates: PromptTemplateReference[] | null): void => {
    if (!templateSelectionPromptId) return
    setPromptTemplates(templateSelectionPromptId, templates)
  }

  const handleTemplateSelectAndCopy = async (
    templates: PromptTemplateReference[] | null
  ): Promise<void> => {
    if (!templateSelectionPromptId) return
    /** Retains the selected prompt while confirmation is open. */
    const promptId = templateSelectionPromptId
    if (!(await confirmPromptCopy(promptId))) return
    const promptDraft = promptDraftById[promptId]!
    await window.navigator.clipboard.writeText(
      applyPromptTemplates(promptDraft.text, getCopyTemplateTexts(templates))
    )
    setPromptTemplates(promptId, templates)
    /** Both copy actions share the same successful-copy status transition. */
    const status = getStatus(promptId)
    const nextStatus = isPromptStatus(status) ? PROMPT_STATUS_BEHAVIORS[status].copyStatus : undefined
    if (nextStatus) onSetPromptStatus(promptId, nextStatus)
  }
</script>

<PromptTemplateSelectionDialog
  bind:open={isTemplateSelectionDialogOpen}
  {workspaceId}
  mode={templateSelectionMode}
  selectedTemplates={templateSelectionPromptId
    ? promptDraftById[templateSelectionPromptId]?.templates
    : undefined}
  onselect={handleTemplateSelect}
  onselectandcopy={handleTemplateSelectAndCopy}
/>

<!-- Informational confirmation is shared by direct copy and quick template selection. -->
<ConfirmationDialog
  open={pendingCopyConfirmation !== null}
  variant="informational"
  icon={Copy}
  title="Copy Prompt"
  description={`Copying this prompt will move it from ${pendingCopyConfirmation?.status} to In Progress.`}
  confirmText="Copy and Move"
  confirmTestId="prompt-confirm-copy-button"
  closeOnOutsideClick={false}
  oncancel={() => resolveCopyConfirmation(false)}
  onconfirm={() => resolveCopyConfirmation(true)}
/>
