<script lang="ts">
  import { FileText, Layers } from 'lucide-svelte'
  import OptionCardSelector, {
    type OptionCardSelectorItem
  } from '@renderer/common/cthulhu-ui/selectors/OptionCardSelector.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { createPromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptCollection, PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
  import PromptCollectionNameDialog from './PromptCollectionNameDialog.svelte'

  let {
    isWorkspaceReady,
    projectId,
    promptCollections = [],
    isPromptCollectionListLoading,
    onCreated
  } = $props<{
    /** Selected project owns the new collection. */
    projectId: string | null
    isWorkspaceReady: boolean
    /** Every project collection; only same-kind collections participate in name conflicts. */
    promptCollections: PromptCollection[]
    isPromptCollectionListLoading: boolean
    onCreated?: (promptCollectionId: string) => void
  }>()

  /** Collection types offered by the side-by-side picker, with the icons their New Tab tiles use and the bullet points
      listed under each card's header. */
  const collectionTypeOptions: OptionCardSelectorItem<PromptCollectionKind>[] = [
    {
      id: 'prompt',
      label: 'Task Collection',
      bullets: [
        'Describes one piece of work',
        'Refine it with the AI, then run it',
        "Mark it complete when it's done",
        'Apply a template to guide the work'
      ],
      icon: FileText,
      testId: 'create-prompt-collection-type-prompt'
    },
    {
      id: 'template',
      label: 'Template Collection',
      bullets: [
        'Wraps a task when applied to it',
        'Guides how the AI does the work',
        'Lists steps for the AI to follow',
        'Sets response rules, like "be concise"'
      ],
      icon: Layers,
      testId: 'create-prompt-collection-type-template'
    }
  ]

  const workspaceSelection = getWorkspaceSelectionContext()
  let promptCollectionNameDialog = $state<{ openDialog: () => void } | null>(null)
  /** Collection kind chosen in the dialog's type picker. */
  let kind = $state<PromptCollectionKind>('prompt')
  /** Opens the collection dialog with the Task type selected. */
  export const openDialog = () => {
    kind = 'prompt'
    promptCollectionNameDialog?.openDialog()
  }

  /** Creates one collection of the chosen kind. */
  const handleCreateCollection = async (normalizedDisplayName: string): Promise<boolean> => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId || !projectId) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptCollectionId = await createPromptCollection(
          selectedWorkspaceId,
          projectId,
          normalizedDisplayName,
          null,
          kind
        )

        onCreated?.(createdPromptCollectionId)

        return true
      },
      () => false
    )
  }
</script>

<PromptCollectionNameDialog
  bind:this={promptCollectionNameDialog}
  {isWorkspaceReady}
  promptCollections={promptCollections.filter((collection) => collection.kind === kind)}
  {isPromptCollectionListLoading}
  title="Create Collection"
  subtitle="Choose a name and type for the new collection."
  submitText="Create Collection"
  submittingText="Creating..."
  submitTestId="create-prompt-collection-button"
  inputTestId="create-prompt-collection-name-input"
  errorTestId="create-prompt-collection-name-error"
  rowDetail="Required. Names must be unique among collections of the same type."
  failureMessage="Failed to create collection. Please try again."
  class="max-w-[660px]"
  onsubmit={handleCreateCollection}
>
  {#snippet trailingFields()}
    <div data-testid="create-prompt-collection-type-field">
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Collection Type" variant="small" />
        <Subtitle
          id="create-prompt-collection-type-help"
          text="Choose what the collection holds. The type can't be changed later."
        />
      </TitleSubtitleStack>
      <OptionCardSelector
        label="Collection Type"
        items={collectionTypeOptions}
        selectedId={kind}
        ariaDescribedby="create-prompt-collection-type-help"
        testId="create-prompt-collection-type-selector"
        onselect={(nextKind) => (kind = nextKind)}
      />
    </div>
  {/snippet}
</PromptCollectionNameDialog>

