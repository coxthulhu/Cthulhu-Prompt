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
  <div class="flex h-full w-full items-center justify-center">
    <div class="flex w-full flex-col items-center gap-6 text-center">
      <h1
        class="w-full max-w-lg text-4xl font-bold font-mono tracking-[0.12em] md:text-5xl"
        data-testid="home-title"
      >
        CTHULHU PROMPT
      </h1>

      <div class="flex w-full max-w-[28rem] flex-col items-center gap-4">
        {#if !isWorkspaceReady}
          <div class="w-full rounded-lg border bg-muted/50 px-4 py-3">
            <h2 class="text-base font-semibold">Get Started</h2>
            <p class="text-muted-foreground text-sm">
              Select a folder to set up your workspace and start managing prompts.
            </p>
          </div>
        {/if}

        {#if isWorkspaceReady}
          <div
            class="w-full rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950"
          >
            <h2
              class="text-lg font-semibold text-green-800 dark:text-green-200"
              data-testid="workspace-ready-title"
            >
              Workspace Ready
            </h2>
            <div class="mt-1 flex w-full justify-center text-sm text-green-700 dark:text-green-300">
              <span class="shrink-0">Workspace:</span>
              <span
                class="ml-2 min-w-0 max-w-[420px] truncate"
                title={workspacePath ?? undefined}
                data-testid="workspace-ready-path"
              >
                {workspacePath}
              </span>
            </div>
          </div>
        {/if}

        <div class="flex w-full gap-4">
          {#if !isWorkspaceReady}
            <Button
              data-testid="select-workspace-folder-button"
              onclick={handleSelectFolder}
              disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
              class="flex h-12 flex-1 items-center gap-2"
              style="font-size: 1rem; line-height: 1.5rem;"
            >
              <FolderOpen class="relative top-[1px] size-5" />
              {isWorkspaceLoading
                ? 'Setting up...'
                : isOpeningWorkspaceFolderDialog
                  ? 'Selecting...'
                  : 'Select Workspace Folder'}
            </Button>
          {/if}

          {#if isWorkspaceReady}
            <Button
              data-testid="close-workspace-button"
              variant="outline"
              onclick={onWorkspaceClear}
              class="flex h-12 flex-1 items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              style="font-size: 1rem; line-height: 1.5rem;"
            >
              <X class="relative top-[1px] size-5" />
              Close Workspace
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>

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
