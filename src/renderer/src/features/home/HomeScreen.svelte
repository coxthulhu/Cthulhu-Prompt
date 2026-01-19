<script lang="ts">
  import { FolderOpen, X } from 'lucide-svelte'
  import { Button } from '@renderer/common/ui/button'
  import Checkbox from '@renderer/common/ui/checkbox/checkbox.svelte'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    ErrorDialog
  } from '@renderer/common/ui/dialog'
  import { useOpenSelectWorkspaceFolderDialogMutation } from '@renderer/api/workspace'
  import {
    isWorkspaceRootPath,
    workspaceRootPathErrorMessage
  } from '@shared/workspacePath'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'

  let {
    workspacePath,
    isWorkspaceReady,
    isWorkspaceLoading,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  } = $props<{
    workspacePath: string | null
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    onWorkspaceSelect: (path: string) => Promise<WorkspaceSelectionResult>
    onWorkspaceCreate: (
      path: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
    onWorkspaceClear: () => void
  }>()

  const { mutateAsync: openWorkspaceFolderDialog, isPending: isOpeningWorkspaceFolderDialog } =
    useOpenSelectWorkspaceFolderDialogMutation()

  let showSetupDialog = $state(false)
  let selectedFolderPath: string | null = $state(null)
  let showRootPathDialog = $state(false)
  let includeExamplePrompts = $state(true)

  const handleSelectFolder = async () => {
    try {
      const result = await openWorkspaceFolderDialog()

      if (!result.dialogCancelled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        // Block root selections before checking for workspace files.
        if (isWorkspaceRootPath(selectedPath)) {
          showRootPathDialog = true
          return
        }
        const selectionResult = await onWorkspaceSelect(selectedPath)

        if (!selectionResult.success) {
          if (selectionResult.reason === 'workspace-missing') {
            selectedFolderPath = selectedPath
            includeExamplePrompts = true
            showSetupDialog = true
          } else if (selectionResult.message) {
            console.error('Error selecting workspace:', selectionResult.message)
          } else {
            console.error('Error selecting workspace')
          }
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  const handleSetupWorkspace = async () => {
    if (selectedFolderPath) {
      const creationResult = await onWorkspaceCreate(
        selectedFolderPath,
        includeExamplePrompts
      )

      if (creationResult.success) {
        showSetupDialog = false
        selectedFolderPath = null
      } else if (creationResult.message) {
        console.error('Failed to create workspace:', creationResult.message)
      } else {
        console.error('Failed to create workspace')
      }
    }
  }

  const handleCancelSetup = () => {
    showSetupDialog = false
    selectedFolderPath = null
    includeExamplePrompts = true
  }
</script>

<main class="flex-1 p-6" data-testid="home-screen">
  <h1 class="text-2xl font-bold" data-testid="home-title">Welcome to Cthulhu Prompt</h1>
  <p class="mt-4 text-muted-foreground">Your prompt management application.</p>

  {#if !isWorkspaceReady}
    <div class="mt-8 p-6 border rounded-lg bg-muted/50">
      <h2 class="text-lg font-semibold mb-2">Get Started</h2>
      <p class="text-muted-foreground mb-4">
        Select a folder to set up your workspace and start managing prompts.
      </p>
      <Button
        data-testid="select-workspace-folder-button"
        onclick={handleSelectFolder}
        disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
        class="flex items-center gap-2"
      >
        <FolderOpen class="w-4 h-4" />
        {isWorkspaceLoading
          ? 'Setting up...'
          : isOpeningWorkspaceFolderDialog
            ? 'Selecting...'
            : 'Select Workspace Folder'}
      </Button>
    </div>
  {/if}

  {#if isWorkspaceReady}
    <div
      class="mt-8 p-6 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h2
            class="text-lg font-semibold mb-2 text-green-800 dark:text-green-200"
            data-testid="workspace-ready-title"
          >
            Workspace Ready
          </h2>
          <p class="text-green-700 dark:text-green-300 flex min-w-0">
            <span class="shrink-0">Workspace:</span>
            <span class="ml-1 min-w-0 flex-1 truncate" title={workspacePath ?? undefined}>
              {workspacePath}
            </span>
          </p>
          <p class="text-green-600 dark:text-green-400 text-sm mt-2">
            You can now use all features of the application.
          </p>
        </div>
        <Button
          data-testid="close-workspace-button"
          variant="outline"
          size="sm"
          onclick={onWorkspaceClear}
          class="ml-4 shrink-0 flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
        >
          <X class="w-4 h-4" />
          Close Workspace
        </Button>
      </div>
    </div>
  {/if}

  <Dialog bind:open={showSetupDialog}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Setup Workspace</DialogTitle>
        <DialogDescription>
          This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up? This
          will create the necessary files and subfolders.
        </DialogDescription>
      </DialogHeader>
      <div class="mt-4 flex items-center gap-2">
        <Checkbox
          id="include-example-prompts"
          data-testid="include-example-prompts-checkbox"
          bind:checked={includeExamplePrompts}
        />
        <label for="include-example-prompts" class="text-sm text-muted-foreground">
          Include example prompts in a "My Prompts" folder.
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onclick={handleCancelSetup}>Cancel</Button>
        <Button data-testid="setup-workspace-button" onclick={handleSetupWorkspace}>
          Setup Workspace
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <ErrorDialog
    bind:open={showRootPathDialog}
    title="Invalid workspace folder"
    message={workspaceRootPathErrorMessage}
    confirmLabel="OK"
  />
</main>
