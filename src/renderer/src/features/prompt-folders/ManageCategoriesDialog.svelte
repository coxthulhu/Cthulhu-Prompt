<script module lang="ts">
  /** One complete retained category value submitted by the management dialog. */
  export type ManagedCategoryInput = {
    id: string
    displayName: string
    shortDescription: string | null
    description: string | null
  }

  /** Options supported by category-specific management entry points. */
  export type ManageCategoriesDialogOpenOptions = {
    categoryId?: string
    focusName?: boolean
  }
</script>

<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Check, Folder, FolderCog } from 'lucide-svelte'
  import type { Category } from '@shared/Category'
  import {
    hasCategoryDisplayNameConflict,
    normalizeCategoryDisplayName,
    normalizeCategoryShortDescription
  } from '@shared/Category'
  import { compactGuid } from '@shared/compactGuid'
  import type { PromptFolderContentKind } from '@shared/PromptFolder'
  import type { Prompt } from '@shared/Prompt'
  import type { PromptTemplate } from '@shared/PromptTemplate'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import ManagementSelectorPanel, {
    type ManagementSelectorPanelItem
  } from '@renderer/common/cthulhu-ui/ManagementSelectorPanel.svelte'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
  import CategoryManagementEditor from './CategoryManagementEditor.svelte'

  /** Editable local copy of one existing or newly staged category. */
  type CategoryDraft = {
    id: string
    displayName: string
    shortDescription: string
    description: string
    hasInteracted: boolean
  }

  /** Inputs and persistence callback for category management. */
  type Props = {
    categories: Category[]
    folderDisplayName: string
    contentKind: PromptFolderContentKind
    isWorkspaceReady: boolean
    onsubmit: (categories: ManagedCategoryInput[]) => Promise<boolean>
  }

  /** Reactive folder inputs supplied by the sidebar or prompt-folder screen. */
  let {
    categories,
    folderDisplayName,
    contentKind,
    isWorkspaceReady,
    onsubmit
  }: Props = $props()
  /** Loaded prompts used to count category membership across every status. */
  const promptQuery = useLiveQuery(promptCollection) as { data: Prompt[] }
  /** Loaded templates used to count category membership in template roots. */
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
    data: PromptTemplate[]
  }
  /** Component-scoped identity prevents separate dialogs from sharing Monaco models. */
  const modelOwnerId = globalThis.crypto.randomUUID()
  /** Increasing identity gives every dialog opening fresh Monaco draft models. */
  let editorSessionId = $state(0)
  /** Controls whether the category management modal is visible. */
  let isDialogOpen = $state(false)
  /** Category values captured when the dialog opened for change detection. */
  let originalCategories = $state<Category[]>([])
  /** Retained editable category drafts in Active-folder order followed by new drafts. */
  let drafts = $state<CategoryDraft[]>([])
  /** Currently selected category draft. */
  let selectedId = $state<string | null>(null)
  /** Monotonic request used to focus and select a category name. */
  let nextFocusRequestId = $state(0)
  /** Current focus request, or null when selection should not move focus. */
  let focusRequestId = $state<number | null>(null)
  /** Prevents duplicate saves while category persistence is pending. */
  let isSubmitting = $state(false)
  /** General persistence failure displayed until the user edits or closes. */
  let submissionError = $state<string | null>(null)

  /** Currently selected retained draft. */
  const selectedDraft = $derived(
    drafts.find((draft) => draft.id === selectedId) ?? null
  )
  /** Singular category membership noun used by selector details. */
  const contentName = $derived(contentKind === 'template' ? 'template' : 'prompt')
  /** Total cross-status content membership indexed by category ID. */
  const contentCountByCategoryId = $derived.by<Record<string, number>>(() => {
    /** Content records for the active root kind. */
    const content = contentKind === 'template' ? promptTemplateQuery.data : promptQuery.data
    /** Mutable count index assembled from loaded content metadata. */
    const counts: Record<string, number> = {}
    for (const entry of content) {
      if (!entry.category) continue
      counts[entry.category] = (counts[entry.category] ?? 0) + 1
    }
    return counts
  })
  /** Standard selector-panel items derived from retained drafts. */
  const selectorItems = $derived.by<ManagementSelectorPanelItem[]>(() =>
    drafts.map((draft) => {
      /** Total content count for this retained category. */
      const count = contentCountByCategoryId[draft.id] ?? 0
      return {
        id: draft.id,
        icon: Folder,
        text: normalizeCategoryDisplayName(draft.displayName) || 'New Category',
        detail: `${count} ${count === 1 ? contentName : `${contentName}s`}`
      }
    })
  )
  /** Validation message for the currently selected category name. */
  const selectedValidationMessage = $derived(
    !selectedDraft
      ? null
      : normalizeCategoryDisplayName(selectedDraft.displayName).length === 0
        ? 'Category name is required'
        : hasCategoryDisplayNameConflict(
              drafts,
              selectedDraft.displayName,
              selectedDraft.id
            )
          ? 'A category with this name already exists'
          : null
  )
  /** Whether every retained category name is present and root-unique. */
  const areDraftsValid = $derived(
    drafts.every((draft, index) => {
      /** Normalized name participating in required and duplicate validation. */
      const name = normalizeCategoryDisplayName(draft.displayName)
      return (
        name.length > 0 &&
        !drafts.some(
          (candidate, candidateIndex) =>
            candidateIndex !== index &&
            normalizeCategoryDisplayName(candidate.displayName).toLocaleLowerCase() ===
              name.toLocaleLowerCase()
        )
      )
    })
  )
  /** Normalized retained categories ready for atomic persistence. */
  const normalizedDrafts = $derived<ManagedCategoryInput[]>(
    drafts.map((draft) => ({
      id: draft.id,
      displayName: normalizeCategoryDisplayName(draft.displayName),
      shortDescription: normalizeCategoryShortDescription(draft.shortDescription),
      description: draft.description.trim().length > 0 ? draft.description : null
    }))
  )
  /** Normalized opening snapshot used to disable no-op saves. */
  const normalizedOriginalCategories = $derived<ManagedCategoryInput[]>(
    originalCategories.map((category) => ({
      id: category.id,
      displayName: normalizeCategoryDisplayName(category.displayName),
      shortDescription: normalizeCategoryShortDescription(category.shortDescription),
      description: category.description?.trim().length ? category.description : null
    }))
  )
  /** Whether retained drafts differ from the opening category snapshot. */
  const hasChanges = $derived(
    JSON.stringify(normalizedDrafts) !== JSON.stringify(normalizedOriginalCategories)
  )
  /** Submission availability after workspace, change, and draft validation. */
  const canSubmit = $derived(
    isWorkspaceReady && !isSubmitting && hasChanges && areDraftsValid
  )

  /** Replaces transient dialog state with a fresh snapshot of authoritative categories. */
  const initializeDrafts = (): void => {
    originalCategories = categories.map((category) => ({ ...category }))
    drafts = categories.map((category) => ({
      id: category.id,
      displayName: category.displayName,
      shortDescription: category.shortDescription ?? '',
      description: category.description ?? '',
      hasInteracted: false
    }))
    submissionError = null
  }

  /** Opens category management to the requested category or the first retained category. */
  export const openDialog = (
    options: ManageCategoriesDialogOpenOptions = {}
  ): void => {
    if (!isWorkspaceReady) return
    initializeDrafts()
    editorSessionId += 1
    selectedId = options.categoryId && drafts.some((draft) => draft.id === options.categoryId)
      ? options.categoryId
      : (drafts[0]?.id ?? null)
    focusRequestId = null
    if (options.focusName && selectedId) {
      nextFocusRequestId += 1
      focusRequestId = nextFocusRequestId
    }
    isDialogOpen = true
  }

  /** Clears every unsaved category draft when the dialog closes. */
  const resetDialog = (): void => {
    isDialogOpen = false
    originalCategories = []
    drafts = []
    selectedId = null
    focusRequestId = null
    submissionError = null
  }

  /** Selects one retained draft without discarding edits to the previous draft. */
  const selectDraft = (categoryId: string): void => {
    selectedId = categoryId
    focusRequestId = null
    submissionError = null
  }

  /** Appends a new empty category draft and focuses its required name field. */
  const addDraft = (): void => {
    /** Stable client-generated category ID used by optimistic and main projections. */
    const categoryId = compactGuid(globalThis.crypto.randomUUID())
    drafts.push({
      id: categoryId,
      displayName: '',
      shortDescription: '',
      description: '',
      hasInteracted: false
    })
    selectedId = categoryId
    nextFocusRequestId += 1
    focusRequestId = nextFocusRequestId
    submissionError = null
  }

  /** Stages selected-category deletion and selects the nearest retained draft. */
  const deleteSelectedDraft = (): void => {
    if (!selectedDraft) return
    /** Removed draft index used to prefer the next category, then the previous category. */
    const selectedIndex = drafts.findIndex((draft) => draft.id === selectedDraft.id)
    drafts.splice(selectedIndex, 1)
    selectedId = drafts[selectedIndex]?.id ?? drafts[selectedIndex - 1]?.id ?? null
    focusRequestId = null
    submissionError = null
  }

  /** Persists every retained draft through one atomic category mutation. */
  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    isSubmitting = true
    submissionError = null
    /** Whether the owning screen successfully persisted the complete draft set. */
    const didSave = await onsubmit(normalizedDrafts)
    if (didSave) resetDialog()
    else submissionError = 'Failed to save category changes. Please try again.'
    isSubmitting = false
  }

  /** Closes category management and discards all unsaved drafts. */
  const handleCancel = (): void => {
    if (!isSubmitting) resetDialog()
  }
</script>

<!-- Root-folder category management dialog with retained multi-item drafts. -->
<Dialog
  bind:open={isDialogOpen}
  icon={FolderCog}
  title="Manage Categories"
  subtitle={folderDisplayName}
  class="w-[1040px] max-w-[calc(100vw-32px)]"
  submitText={isSubmitting ? 'Saving...' : 'Save Changes'}
  cancelText="Close"
  submitIcon={Check}
  submitDisabled={!canSubmit}
  cancelDisabled={isSubmitting}
  submitTestId="manage-categories-save-button"
  cancelTestId="manage-categories-close-button"
  cancelFirst
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  <div class="cthulhuManageCategoriesDialogBody text-sm leading-5">
    <ManagementSelectorPanel
      label="All Categories"
      items={selectorItems}
      {selectedId}
      addText="New Category"
      itemTestIdPrefix="manage-category-selector"
      addTestId="manage-categories-new-button"
      onselect={selectDraft}
      onadd={addDraft}
    />

    <div class="cthulhuManageCategoriesDialogEditor">
      {#if submissionError}
        <p class="mb-3 text-sm leading-5 text-[var(--ui-danger-icon-glyph)]">
          {submissionError}
        </p>
      {/if}
      {#if selectedDraft}
        {#key selectedDraft.id}
          <CategoryManagementEditor
            categoryId={selectedDraft.id}
            bind:displayName={selectedDraft.displayName}
            bind:shortDescription={selectedDraft.shortDescription}
            bind:description={selectedDraft.description}
            bind:hasInteracted={selectedDraft.hasInteracted}
            validationMessage={selectedValidationMessage}
            {isSubmitting}
            modelOwnerId={`${modelOwnerId}-${editorSessionId}`}
            {focusRequestId}
            ondelete={deleteSelectedDraft}
          />
        {/key}
      {/if}
    </div>
  </div>
</Dialog>

<style>
  .cthulhuManageCategoriesDialogBody {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    height: min(570px, calc(100vh - 212px));
    min-height: 240px;
  }

  .cthulhuManageCategoriesDialogEditor {
    min-width: 0;
    overflow: auto;
    padding: 16px 8px 22px 26px;
  }
</style>
