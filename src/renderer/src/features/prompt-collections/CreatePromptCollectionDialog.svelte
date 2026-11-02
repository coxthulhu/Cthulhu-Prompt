<script lang="ts">
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { createPromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptCollection, PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
  import PromptCollectionNameDialog from './PromptCollectionNameDialog.svelte'

  let {
    isWorkspaceReady,
    promptCollections = [],
    isPromptCollectionListLoading,
    onCreated
  } = $props<{
    isWorkspaceReady: boolean
    /** Every project collection; only same-kind collections participate in name conflicts. */
    promptCollections: PromptCollection[]
    isPromptCollectionListLoading: boolean
    onCreated?: (promptCollectionId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  let promptCollectionNameDialog = $state<{ openDialog: () => void } | null>(null)
  /** Collection kind chosen by the action that opened the dialog. */
  let kind = $state<PromptCollectionKind>('prompt')
  /** Opens the collection name dialog for one collection kind. */
  export const openDialog = (nextKind: PromptCollectionKind) => {
    kind = nextKind
    promptCollectionNameDialog?.openDialog()
  }

  /** Creates one collection of the chosen kind. */
  const handleCreateCollection = async (normalizedDisplayName: string): Promise<boolean> => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptCollectionId = await createPromptCollection(
          selectedWorkspaceId,
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
  title={kind === 'template'
    ? 'Create Template Collection'
    : 'Create Task Collection'}
  subtitle={kind === 'template'
    ? 'Organize reusable prompts for repeatable workflows.'
    : 'Organize one-time prompts for individual tasks.'}
  submitText="Create Collection"
  submittingText="Creating..."
  submitTestId="create-prompt-collection-button"
  inputTestId="create-prompt-collection-name-input"
  errorTestId="create-prompt-collection-name-error"
  rowDetail={kind === 'template'
    ? 'Required. Names must be unique among prompt template collections.'
    : 'Required. Names must be unique among task prompt collections.'}
  failureMessage={kind === 'template'
    ? 'Failed to create prompt template collection. Please try again.'
    : 'Failed to create task prompt collection. Please try again.'}
  onsubmit={handleCreateCollection}
/>
