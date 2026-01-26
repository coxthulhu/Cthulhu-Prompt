<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import { Button } from '@renderer/common/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
  } from '@renderer/common/ui/dialog'
  import { createPromptFolder } from '@renderer/data/workspace/WorkspaceStore.svelte.ts'
  import type { PromptFolder } from '@shared/ipc'
  import { preparePromptFolderName } from '@shared/promptFolderName'
  import SidebarButton from '../sidebar/SidebarButton.svelte'

  let {
    isWorkspaceReady,
    promptFolders = [],
    isPromptFolderListLoading = false,
    onCreated
  } = $props<{
    isWorkspaceReady: boolean
    promptFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    onCreated?: (folder: PromptFolder) => void
  }>()

  let isDialogOpen = $state(false)
  let displayName = $state('')
  let submissionError = $state<string | null>(null)
  let hasInteractedWithInput = $state(false)
  let isCreatingPromptFolder = $state(false)

  const preparedName = $derived(preparePromptFolderName(displayName))
  const validation = $derived(preparedName.validation)
  const normalizedDisplayName = $derived(preparedName.displayName)
  // Derive a sanitized name to detect duplicate prompt folders by on-disk folder name.
  const sanitizedFolderName = $derived(preparedName.folderName.toLowerCase())
  const hasDuplicateFolderName = $derived.by(
    () =>
      validation.isValid &&
      !isPromptFolderListLoading &&
      Boolean(sanitizedFolderName) &&
      promptFolders.some(
        (folder) => folder.folderName.toLowerCase() === sanitizedFolderName
      )
  )
  const validationMessage = $derived(
    !validation.isValid
      ? (validation.errorMessage ?? null)
      : hasDuplicateFolderName
        ? 'A folder with this name already exists'
        : null
  )
  const errorMessage = $derived(
    submissionError ?? (hasInteractedWithInput ? validationMessage : null)
  )
  const isValid = $derived(
    Boolean(
      !validationMessage &&
        validation.isValid &&
        isWorkspaceReady &&
        !isPromptFolderListLoading
    )
  )

  const closeDialog = () => {
    isDialogOpen = false
    displayName = ''
    submissionError = null
    hasInteractedWithInput = false
  }

  const handleCreateFolder = async () => {
    if (!isValid) return

    try {
      submissionError = null
      isCreatingPromptFolder = true
      const created = await createPromptFolder(normalizedDisplayName)

      if (created) {
        onCreated?.(created)
      }

      closeDialog()
    } catch (error) {
      console.error('Error creating prompt folder:', error)
      submissionError =
        error instanceof Error ? error.message : 'Failed to create folder. Please try again.'
    } finally {
      isCreatingPromptFolder = false
    }
  }

  const handleCancel = () => closeDialog()
</script>

{#snippet sidebarTrigger({ props })}
  <SidebarButton
    builderProps={props}
    icon={Plus}
    label="New Prompt Folder"
    disabled={!isWorkspaceReady}
    ariaDisabled={!isWorkspaceReady}
    testId="new-prompt-folder-button"
  />
{/snippet}

<Dialog bind:open={isDialogOpen}>
  <DialogTrigger child={sidebarTrigger} />

  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Create New Prompt Folder</DialogTitle>
      <DialogDescription>
        Enter a name for your new prompt folder. This will help you organize your prompts.
      </DialogDescription>
    </DialogHeader>

    <div class="py-4">
      <input
        data-testid="folder-name-input"
        placeholder="Enter folder name..."
        bind:value={displayName}
        oninput={() => {
          hasInteractedWithInput = true
          submissionError = null
        }}
        onkeydown={(event) => {
          if (event.key === 'Enter' && isValid) {
            handleCreateFolder()
          } else if (event.key === 'Escape') {
            handleCancel()
          }
        }}
        class={`file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive ${errorMessage ? 'border-red-500' : ''}`}
      />
      {#if errorMessage}
        <p data-testid="folder-name-error" class="text-sm text-red-500 mt-2">{errorMessage}</p>
      {/if}
    </div>

    <DialogFooter>
      <Button variant="outline" onclick={handleCancel} disabled={isCreatingPromptFolder}>
        Cancel
      </Button>
      <Button
        data-testid="create-folder-button"
        onclick={handleCreateFolder}
        disabled={!isValid || isCreatingPromptFolder}
      >
        {isCreatingPromptFolder ? 'Creating...' : 'Create Folder'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
