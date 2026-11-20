<script lang="ts">
  import { Pencil } from 'lucide-svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { renamePromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import PromptCollectionNameDialog from './PromptCollectionNameDialog.svelte'

  let {
    isWorkspaceReady,
    promptCollections
  } = $props<{
    isWorkspaceReady: boolean
    /** Collections in the project that owns the rename target. */
    promptCollections: PromptCollection[]
  }>()

  let promptCollectionNameDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  /** Collection chosen by the action that opened the dialog. */
  let targetCollectionId = $state<string | null>(null)

  /** Live target keeps the unchanged-name check current while the dialog is open. */
  const targetCollection = $derived(
    promptCollections.find((collection) => collection.id === targetCollectionId) ?? null
  )

  /** Opens the rename dialog prefilled with one collection's current name. */
  export const openDialog = (promptCollectionId: string): void => {
    const promptCollection = promptCollections.find((collection) => collection.id === promptCollectionId)
    if (!promptCollection) return

    targetCollectionId = promptCollectionId
    promptCollectionNameDialog?.openDialog(promptCollection.displayName)
  }

  /** Persists the new display name for the targeted collection. */
  const handleRenamePromptCollection = async (displayName: string): Promise<boolean> => {
    if (!targetCollection) return false

    return await runIpcBestEffort(
      async () => {
        await renamePromptCollection(targetCollection.id, displayName)
        return true
      },
      () => false
    )
  }
</script>

<PromptCollectionNameDialog
  bind:this={promptCollectionNameDialog}
  {isWorkspaceReady}
  {promptCollections}
  isPromptCollectionListLoading={false}
  icon={Pencil}
  title="Rename Collection"
  subtitle="Change the name shown in the app and on disk."
  submitText="Rename Collection"
  submittingText="Renaming..."
  submitTestId="rename-prompt-collection-button"
  inputTestId="rename-prompt-collection-name-input"
  errorTestId="rename-prompt-collection-name-error"
  rowLabel="Collection Name"
  initialDisplayName={targetCollection?.displayName ?? ''}
  unchangedDisplayName={targetCollection?.displayName ?? null}
  duplicatePromptCollectionId={targetCollection?.id ?? null}
  failureMessage="Failed to rename collection. Please try again."
  onsubmit={handleRenamePromptCollection}
/>
