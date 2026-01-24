<script lang="ts">
  import { FolderOpen, FolderPlus, X } from 'lucide-svelte'
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
  import { ipcInvoke } from '@renderer/api/ipcInvoke'
  import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
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

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let isOpeningWorkspaceFolderDialog = $state(false)
  let showSetupDialog = $state(false)
  let showExistingWorkspaceDialog = $state(false)
  let selectedFolderPath: string | null = $state(null)
  let showRootPathDialog = $state(false)
  let includeExamplePrompts = $state(true)
  let activeWorkspaceAction = $state<'select' | 'create' | null>(null)

  const openWorkspaceFolderDialog = async (): Promise<OpenSelectWorkspaceFolderDialogResult> => {
    isOpeningWorkspaceFolderDialog = true
    try {
      return await ipcInvoke<OpenSelectWorkspaceFolderDialogResult>('select-workspace-folder')
    } finally {
      isOpeningWorkspaceFolderDialog = false
    }
  }

  const checkWorkspaceFolderExists = async (path: string): Promise<boolean> => {
    return await ipcInvoke<boolean, string>('check-folder-exists', path)
  }

  const checkWorkspaceExists = async (path: string) => {
    const promptsPath = `${path}/Prompts`
    const settingsPath = `${path}/WorkspaceInfo.json`
    const promptsExists = await checkWorkspaceFolderExists(promptsPath)
    const settingsExists = await checkWorkspaceFolderExists(settingsPath)
    return promptsExists && settingsExists
  }

  const handleSelectFolder = async () => {
    activeWorkspaceAction = 'select'
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
    } finally {
      if (activeWorkspaceAction === 'select') {
        activeWorkspaceAction = null
      }
    }
  }

  const handleCreateFolder = async () => {
    activeWorkspaceAction = 'create'
    try {
      const result = await openWorkspaceFolderDialog()

      if (!result.dialogCancelled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        // Block root selections before checking for workspace files.
        if (isWorkspaceRootPath(selectedPath)) {
          showRootPathDialog = true
          return
        }

        if (await checkWorkspaceExists(selectedPath)) {
          selectedFolderPath = selectedPath
          showExistingWorkspaceDialog = true
          return
        }

        selectedFolderPath = selectedPath
        includeExamplePrompts = true
        showSetupDialog = true
      }
    } catch (error) {
      console.error('Error selecting folder for creation:', error)
    } finally {
      if (activeWorkspaceAction === 'create') {
        activeWorkspaceAction = null
      }
    }
  }

  const handleSetupWorkspace = async () => {
    if (selectedFolderPath) {
      activeWorkspaceAction = 'create'
      try {
        const creationResult = await onWorkspaceCreate(selectedFolderPath, includeExamplePrompts)

        if (creationResult.success) {
          showSetupDialog = false
          selectedFolderPath = null
        } else if (creationResult.message) {
          console.error('Failed to create workspace:', creationResult.message)
        } else {
          console.error('Failed to create workspace')
        }
      } finally {
        if (activeWorkspaceAction === 'create') {
          activeWorkspaceAction = null
        }
      }
    }
  }

  const handleSelectExistingWorkspace = async () => {
    if (selectedFolderPath) {
      activeWorkspaceAction = 'select'
      try {
        const selectionResult = await onWorkspaceSelect(selectedFolderPath)

        if (selectionResult.success) {
          showExistingWorkspaceDialog = false
          selectedFolderPath = null
        } else if (selectionResult.reason === 'workspace-missing') {
          showExistingWorkspaceDialog = false
          includeExamplePrompts = true
          showSetupDialog = true
        } else if (selectionResult.message) {
          console.error('Error selecting workspace:', selectionResult.message)
        } else {
          console.error('Error selecting workspace')
        }
      } finally {
        if (activeWorkspaceAction === 'select') {
          activeWorkspaceAction = null
        }
      }
    }
  }

  const handleCancelSetup = () => {
    showSetupDialog = false
    selectedFolderPath = null
    includeExamplePrompts = true
  }

  const handleCancelExistingWorkspace = () => {
    showExistingWorkspaceDialog = false
    selectedFolderPath = null
  }

  const getSelectButtonLabel = () => {
    if (isWorkspaceLoading && activeWorkspaceAction === 'select') {
      return 'Setting up...'
    }
    if (isOpeningWorkspaceFolderDialog && activeWorkspaceAction === 'select') {
      return 'Selecting...'
    }
    return 'Select Workspace Folder'
  }

  const getCreateButtonLabel = () => {
    if (isWorkspaceLoading && activeWorkspaceAction === 'create') {
      return 'Creating...'
    }
    if (isOpeningWorkspaceFolderDialog && activeWorkspaceAction === 'create') {
      return 'Choosing...'
    }
    return 'Create Workspace Folder'
  }
</script>

<main class="flex-1 p-6" data-testid="home-screen">
  <div class="flex h-full w-full items-center justify-center">
    <div class="flex w-full flex-col items-center gap-6 text-center">
      <h1
        class="w-full max-w-none whitespace-nowrap text-5xl font-bold font-mono tracking-[0.14em] md:text-6xl"
        data-testid="home-title"
      >
        CTHULHU PROMPT
      </h1>

      <div class="flex w-full max-w-[36rem] flex-col items-center gap-4">
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
          <Button
            data-testid="select-workspace-folder-button"
            onclick={handleSelectFolder}
            disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
            variant="outline"
            class="flex h-12 flex-1 items-center gap-2 text-white hover:text-white"
            style="font-size: 1rem; line-height: 1.5rem;"
          >
            <FolderOpen class="relative top-[1px] size-5" />
            {getSelectButtonLabel()}
          </Button>

          <Button
            data-testid="create-workspace-folder-button"
            onclick={handleCreateFolder}
            disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
            variant="outline"
            class="flex h-12 flex-1 items-center gap-2 text-white hover:text-white"
            style="font-size: 1rem; line-height: 1.5rem;"
          >
            <FolderPlus class="relative top-[1px] size-5" />
            {getCreateButtonLabel()}
          </Button>
        </div>

        {#if isWorkspaceReady}
          <div class="flex w-full">
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
          </div>
        {/if}
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

  <Dialog bind:open={showExistingWorkspaceDialog}>
    <DialogContent data-testid="existing-workspace-dialog">
      <DialogHeader>
        <DialogTitle>Workspace already exists</DialogTitle>
        <DialogDescription>
          This folder already has a Cthulhu Prompt workspace. Would you like to select it?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          data-testid="cancel-existing-workspace-button"
          variant="outline"
          onclick={handleCancelExistingWorkspace}
        >
          Cancel
        </Button>
        <Button
          data-testid="select-existing-workspace-button"
          onclick={handleSelectExistingWorkspace}
        >
          Select Workspace
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
