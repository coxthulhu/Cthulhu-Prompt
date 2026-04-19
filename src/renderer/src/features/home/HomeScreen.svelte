<script lang="ts">
  import { AlertCircle, Check, FileText, FolderClosed, FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import LabeledDisplayField from '@renderer/common/cthulhu-ui/LabeledDisplayField.svelte'
  import NumericStatCard from '@renderer/common/cthulhu-ui/NumericStatCard.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
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
    promptCount,
    promptFolderCount,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  } = $props<{
    workspacePath: string | null
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    promptCount: number
    promptFolderCount: number
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

  const secondaryTitleText = 'CTHULHU PROMPT'
  const SECONDARY_TITLE_MEASURE_FONT_SIZE_PX = 100

  let isOpeningWorkspaceFolderDialog = $state(false)
  let showSetupDialog = $state(false)
  let showExistingWorkspaceDialog = $state(false)
  let selectedFolderPath: string | null = $state(null)
  let showRootPathDialog = $state(false)
  let includeExamplePrompts = $state(true)
  let activeWorkspaceAction = $state<'select' | 'create' | null>(null)
  let secondaryTitleContainerElement: HTMLDivElement | null = $state(null)
  let secondaryTitleMeasureElement: HTMLSpanElement | null = $state(null)
  let secondaryTitleContainerWidth = $state(0)
  let secondaryTitleMeasureWidth = $state(0)

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
    return 'Open Workspace Folder'
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

  const isWorkspaceActionDisabled = $derived(isWorkspaceLoading || isOpeningWorkspaceFolderDialog)
  const displayedWorkspacePath = $derived(workspacePath ?? 'No workspace selected')
  const displayedPromptCount = $derived(String(promptCount))
  const displayedPromptFolderCount = $derived(String(promptFolderCount))
  const secondaryTitleFontSizePx = $derived.by(() => {
    if (!secondaryTitleContainerWidth || !secondaryTitleMeasureWidth) {
      return null
    }

    return (
      (secondaryTitleContainerWidth / secondaryTitleMeasureWidth) * SECONDARY_TITLE_MEASURE_FONT_SIZE_PX
    )
  })

  // Side effect: keep the home title scaled to the shared card/title container width.
  $effect(() => {
    const titleContainerElement = secondaryTitleContainerElement
    const measureElement = secondaryTitleMeasureElement
    if (!titleContainerElement || !measureElement) {
      return
    }

    const updateSecondaryTitleSize = () => {
      secondaryTitleContainerWidth = titleContainerElement.getBoundingClientRect().width
      secondaryTitleMeasureWidth = measureElement.getBoundingClientRect().width
    }

    updateSecondaryTitleSize()

    const resizeObserver = new ResizeObserver(() => {
      updateSecondaryTitleSize()
    })

    resizeObserver.observe(titleContainerElement)
    resizeObserver.observe(measureElement)

    return () => {
      resizeObserver.disconnect()
    }
  })
</script>

<main class="flex min-w-0 flex-1 overflow-y-auto p-6" data-testid="home-screen">
  <div class="flex min-h-full w-full min-w-0 items-center justify-center">
    <section class="relative w-full max-w-5xl min-w-0 space-y-6">
      <div bind:this={secondaryTitleContainerElement} class="mx-auto w-full max-w-[39.5rem] xl:max-w-none">
        <h2
          class="cthulhuHomeSecondaryTitle"
          data-testid="home-title"
          style:font-size={secondaryTitleFontSizePx ? `${secondaryTitleFontSizePx}px` : undefined}
        >
          {secondaryTitleText}
        </h2>
      </div>
      <span
        bind:this={secondaryTitleMeasureElement}
        aria-hidden="true"
        class="cthulhuHomeSecondaryTitle cthulhuHomeSecondaryTitleMeasure"
      >
        {secondaryTitleText}
      </span>

      <div class="grid grid-cols-1 items-start justify-items-center gap-4 xl:grid-cols-2 xl:justify-items-stretch">
        <CardSurface class="w-full max-w-[39.5rem] min-w-0 p-5 xl:max-w-none">
          <div class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <TitleBlock
                  title="Current Workspace"
                  variant="large"
                  description="Information about your current workspace."
                />
              </div>
              <div
                class:cthulhuHomeWorkspaceStatusBadgeReady={isWorkspaceReady}
                class:cthulhuHomeWorkspaceStatusBadgeNotSelected={!isWorkspaceReady}
                class="cthulhuHomeWorkspaceStatusBadge"
              >
                {#if isWorkspaceReady}
                  <Check size={16} />
                  <span data-testid="workspace-ready-title">Workspace Ready</span>
                {:else}
                  <AlertCircle size={16} />
                  <span>Workspace Not Selected</span>
                {/if}
              </div>
            </div>

            <LabeledDisplayField
              label="Workspace Path"
              text={displayedWorkspacePath}
              icon={FolderOpen}
              valueTitle={displayedWorkspacePath}
              valueTestId={isWorkspaceReady ? 'workspace-ready-path' : undefined}
            />

            <div class="grid grid-cols-2 gap-3.5">
              <NumericStatCard label="Prompts" text={displayedPromptCount} icon={FileText} />
              <NumericStatCard
                label="Prompt Folders"
                text={displayedPromptFolderCount}
                icon={FolderClosed}
              />
            </div>
          </div>
        </CardSurface>

        <CardSurface class="w-full max-w-[39.5rem] min-w-0 p-5 xl:max-w-none">
          <div class="space-y-4">
            <TitleBlock
              title="Workspace Actions"
              variant="large"
              description="Change your current workspace."
            />

            <div class="flex flex-col gap-3">
              <IconTextButton
                testId="select-workspace-folder-button"
                icon={FolderOpen}
                iconClass="translate-y-px"
                text={getSelectButtonLabel()}
                onclick={handleSelectFolder}
                state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                class="h-12 w-full justify-center text-base"
              />

              <IconTextButton
                testId="create-workspace-folder-button"
                icon={FolderPlus}
                iconClass="translate-y-px"
                text={getCreateButtonLabel()}
                onclick={handleCreateFolder}
                state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                class="h-12 w-full justify-center text-base"
              />

              {#if isWorkspaceReady}
                <IconTextButton
                  testId="close-workspace-button"
                  icon={X}
                  iconClass="translate-y-px"
                  text="Close Workspace"
                  onclick={onWorkspaceClear}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                  class="h-12 w-full justify-center text-base border-red-300/40 bg-red-500/10 text-red-200 hover:border-red-300/60 hover:bg-red-500/18 hover:text-red-100"
                />
              {/if}
            </div>
          </div>
        </CardSurface>
      </div>
    </section>
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

<style>
  .cthulhuHomeWorkspaceStatusBadge {
    align-items: center;
    border: 1px solid;
    border-radius: 999px;
    display: inline-flex;
    font-size: 13px;
    font-weight: 600;
    gap: 8px;
    padding: 8px 12px;
    width: max-content;
  }

  .cthulhuHomeWorkspaceStatusBadgeReady {
    background: var(--ui-success-surface);
    border-color: var(--ui-success-border);
    color: var(--ui-success-text);
  }

  .cthulhuHomeWorkspaceStatusBadgeNotSelected {
    background: var(--ui-accent-surface);
    border-color: var(--ui-accent-border);
    color: var(--ui-accent-icon);
  }

  .cthulhuHomeSecondaryTitle {
    color: var(--ui-text-bright);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: clamp(4rem, 9vw, 5.5rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .cthulhuHomeSecondaryTitleMeasure {
    left: -9999px;
    pointer-events: none;
    position: fixed;
    top: -9999px;
    visibility: hidden;
    width: max-content;
    font-size: 100px;
  }
</style>
