<script lang="ts">
  import { FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
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
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
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
      const result = await runIpcBestEffort(openWorkspaceFolderDialog, () => ({
        dialogCancelled: true,
        filePaths: []
      }))

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
          }
        }
      }
    } finally {
      if (activeWorkspaceAction === 'select') {
        activeWorkspaceAction = null
      }
    }
  }

  const handleCreateFolder = async () => {
    activeWorkspaceAction = 'create'
    try {
      const result = await runIpcBestEffort(openWorkspaceFolderDialog, () => ({
        dialogCancelled: true,
        filePaths: []
      }))

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
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'select' ? 'Setting up...' : 'Loading...'
    }
    if (isOpeningWorkspaceFolderDialog && activeWorkspaceAction === 'select') {
      return 'Selecting...'
    }
    return 'Select Workspace Folder'
  }

  const getCreateButtonLabel = () => {
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'create' ? 'Creating...' : 'Loading...'
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
          <IconTextButton
            testId="select-workspace-folder-button"
            icon={FolderOpen}
            text={getSelectButtonLabel()}
            onclick={handleSelectFolder}
            disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
            class="h-12 flex-1 justify-center text-base"
          />

          <IconTextButton
            testId="create-workspace-folder-button"
            icon={FolderPlus}
            text={getCreateButtonLabel()}
            onclick={handleCreateFolder}
            disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
            class="h-12 flex-1 justify-center text-base"
          />
        </div>

        {#if isWorkspaceReady}
          <div class="flex w-full">
            <IconTextButton
              testId="close-workspace-button"
              icon={X}
              text="Close Workspace"
              onclick={onWorkspaceClear}
              class="h-12 flex-1 justify-center text-base border-red-300/40 bg-red-500/10 text-red-200 hover:border-red-300/60 hover:bg-red-500/18 hover:text-red-100"
            />
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
