<script lang="ts">
  import {
    FolderOpen,
    FolderPlus,
    Folders,
    FileText,
    HardDrive,
    X,
    CheckCircle2,
    Sparkles
  } from 'lucide-svelte'
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
    promptCount = 0,
    promptFolderCount = 0,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  } = $props<{
    workspacePath: string | null
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    promptCount?: number
    promptFolderCount?: number
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

  const panelStyle =
    'position: relative; overflow: hidden; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); background: linear-gradient(180deg, rgba(19,24,37,0.98) 0%, rgba(10,14,24,0.98) 100%); box-shadow: 0 24px 70px rgba(0,0,0,0.38);'

  const tileStyle =
    'position: relative; overflow: hidden; border-radius: 24px; border: 1px solid rgba(255,255,255,0.09); background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);'

  const secondaryTileStyle =
    'position: relative; overflow: hidden; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(7,11,19,0.86) 0%, rgba(7,11,19,0.68) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);'

  const getActionButtonStyle = (tone: 'primary' | 'secondary' | 'danger', disabled: boolean) => {
    if (tone === 'primary') {
      return `display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 58px; width: 100%; padding: 0 22px; border-radius: 20px; border: 1px solid rgba(160,238,198,${disabled ? '0.18' : '0.34'}); background: linear-gradient(180deg, rgba(167,243,208,${
        disabled ? '0.12' : '0.22'
      }) 0%, rgba(88,196,145,${disabled ? '0.12' : '0.18'}) 100%); color: rgba(235,255,243,${
        disabled ? '0.5' : '0.96'
      }); font: 600 15px/1.2 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: 0.01em; cursor: ${
        disabled ? 'not-allowed' : 'pointer'
      }; opacity: ${disabled ? '0.72' : '1'}; box-shadow: ${disabled ? 'none' : '0 16px 34px rgba(43,108,76,0.22)'};`
    }

    if (tone === 'danger') {
      return `display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 58px; width: 100%; padding: 0 22px; border-radius: 20px; border: 1px solid rgba(248,113,113,${disabled ? '0.15' : '0.28'}); background: linear-gradient(180deg, rgba(127,29,29,${
        disabled ? '0.12' : '0.18'
      }) 0%, rgba(69,10,10,${disabled ? '0.16' : '0.24'}) 100%); color: rgba(254,226,226,${
        disabled ? '0.5' : '0.94'
      }); font: 600 15px/1.2 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: 0.01em; cursor: ${
        disabled ? 'not-allowed' : 'pointer'
      }; opacity: ${disabled ? '0.72' : '1'};`
    }

    return `display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 58px; width: 100%; padding: 0 22px; border-radius: 20px; border: 1px solid rgba(255,255,255,${disabled ? '0.08' : '0.14'}); background: linear-gradient(180deg, rgba(255,255,255,${
      disabled ? '0.04' : '0.08'
    }) 0%, rgba(255,255,255,${disabled ? '0.03' : '0.04'}) 100%); color: rgba(241,245,249,${
      disabled ? '0.5' : '0.95'
    }); font: 600 15px/1.2 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: 0.01em; cursor: ${
      disabled ? 'not-allowed' : 'pointer'
    }; opacity: ${disabled ? '0.72' : '1'};`
  }

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
        if (isWorkspaceRootPath(selectedPath)) {
          showRootPathDialog = true
          return
        }

        const selectionResult = await onWorkspaceSelect(selectedPath)

        if (!selectionResult.success && selectionResult.reason === 'workspace-missing') {
          selectedFolderPath = selectedPath
          includeExamplePrompts = true
          showSetupDialog = true
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

  const closeRootPathDialog = () => {
    showRootPathDialog = false
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

  const statusText = $derived(isWorkspaceReady ? 'Workspace Ready' : 'No Workspace Selected')
  const statusAccent = $derived(
    isWorkspaceReady ? 'rgba(167,243,208,0.95)' : 'rgba(251,191,36,0.95)'
  )
  const displayedPromptCount = $derived(isWorkspaceReady ? promptCount : 0)
  const displayedPromptFolderCount = $derived(isWorkspaceReady ? promptFolderCount : 0)
  const actionsDisabled = $derived(isWorkspaceLoading || isOpeningWorkspaceFolderDialog)

  const overlayStyle =
    'position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(3,6,12,0.72); backdrop-filter: blur(10px);'

  const modalStyle =
    'width: min(100%, 520px); border-radius: 28px; border: 1px solid rgba(255,255,255,0.1); background: linear-gradient(180deg, rgba(18,24,37,0.98) 0%, rgba(9,13,21,0.99) 100%); box-shadow: 0 28px 80px rgba(0,0,0,0.45);'

  const dialogButtonStyle = (variant: 'primary' | 'secondary') =>
    variant === 'primary'
      ? 'display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 18px; border: 1px solid rgba(160,238,198,0.3); border-radius: 16px; background: linear-gradient(180deg, rgba(167,243,208,0.22) 0%, rgba(88,196,145,0.18) 100%); color: rgba(240,255,246,0.96); font: 600 14px/1.2 "Segoe UI Variable Display", "Segoe UI", sans-serif; cursor: pointer;'
      : 'display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 18px; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; background: rgba(255,255,255,0.04); color: rgba(226,232,240,0.96); font: 600 14px/1.2 "Segoe UI Variable Display", "Segoe UI", sans-serif; cursor: pointer;'

  const checkboxStyle =
    'margin: 0; width: 18px; height: 18px; accent-color: #8dd6ae;'

  const statValueStyle =
    'font: 700 clamp(2rem, 3.2vw, 3rem)/1 "Cascadia Code", "Consolas", monospace; letter-spacing: -0.04em; color: rgba(248,250,252,0.98);'

  const isCloseDisabled = $derived(!isWorkspaceReady)

  const formatCount = (value: number) => Intl.NumberFormat('en-US').format(value)
</script>

{#snippet actionButton(label, tone, icon, testId, disabled, onclick)}
  <button
    type="button"
    data-testid={testId}
    {disabled}
    {onclick}
    style={getActionButtonStyle(tone, disabled)}
  >
    <svelte:component this={icon} size={18} strokeWidth={2.1} />
    <span>{label}</span>
  </button>
{/snippet}

{#snippet statCard(label, value, icon, accent)}
  <div style={`${tileStyle} padding: 22px; min-height: 160px;`}>
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
      <div>
        <div
          style={`display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 15px; background: ${accent}; color: rgba(255,255,255,0.96); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);`}
        >
          <svelte:component this={icon} size={19} strokeWidth={2.15} />
        </div>
      </div>
      <div
        style={`padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.05); color: ${accent}; font: 600 11px/1 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: 0.08em; text-transform: uppercase;`}
      >
        {label}
      </div>
    </div>
    <div style="margin-top: 28px;">
      <div style={statValueStyle}>{value}</div>
    </div>
  </div>
{/snippet}

<main
  data-testid="home-screen"
  style="position: relative; flex: 1; min-height: 0; overflow: auto; background:
    radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 28%),
    radial-gradient(circle at 85% 12%, rgba(56,189,248,0.13), transparent 24%),
    linear-gradient(180deg, #08101b 0%, #09111a 40%, #060b12 100%);
    color: rgba(248,250,252,0.96);"
>
  <div
    style="position: absolute; inset: 0; pointer-events: none; background-image:
      linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
      background-size: 120px 120px; mask-image: linear-gradient(180deg, rgba(0,0,0,0.7), transparent 95%);"
  ></div>

  <div style="position: relative; z-index: 1; width: 100%; padding: 32px 24px 40px;">
    <section style={`${panelStyle} padding: clamp(24px, 4vw, 40px);`}>
      <div
        style="position: absolute; inset: auto auto -110px -110px; width: 260px; height: 260px; border-radius: 999px; background: radial-gradient(circle, rgba(34,197,94,0.14), transparent 68%); pointer-events: none;"
      ></div>
      <div
        style="position: absolute; inset: -80px -80px auto auto; width: 220px; height: 220px; border-radius: 999px; background: radial-gradient(circle, rgba(56,189,248,0.12), transparent 68%); pointer-events: none;"
      ></div>

      <div
        style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 28px;"
      >
        <div style="display: flex; align-items: center; gap: 12px;">
          <div
            style="display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 18px; background: linear-gradient(180deg, rgba(167,243,208,0.22) 0%, rgba(56,189,248,0.18) 100%); border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);"
          >
            <Sparkles size={22} strokeWidth={2.1} />
          </div>
          <div>
            <h1
              data-testid="home-title"
              style='margin: 0; font: 700 clamp(2rem, 4vw, 3.4rem)/0.95 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: -0.05em;'
            >
              Home
            </h1>
            <div
              style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; color: rgba(203,213,225,0.9); font: 500 13px/1.2 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
            >
              <span
                style={`width: 10px; height: 10px; border-radius: 999px; background: ${statusAccent}; box-shadow: 0 0 0 6px rgba(255,255,255,0.03);`}
              ></span>
              <span>{statusText}</span>
            </div>
          </div>
        </div>

        <div
          style="display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: rgba(203,213,225,0.9); font: 600 12px/1 'Segoe UI Variable Display', 'Segoe UI', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;"
        >
          <HardDrive size={15} strokeWidth={2.2} />
          <span>Workspace</span>
        </div>
      </div>

      <div
        style="display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr); gap: 20px;"
      >
        <div style={`${tileStyle} padding: clamp(22px, 3vw, 30px);`}>
          <div
            style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px;"
          >
            <div style="max-width: 720px;">
              <div
                style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.05); color: rgba(226,232,240,0.88); font: 600 11px/1 'Segoe UI Variable Display', 'Segoe UI', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;"
              >
                {#if isWorkspaceReady}
                  <CheckCircle2 size={14} strokeWidth={2.2} />
                {:else}
                  <FolderOpen size={14} strokeWidth={2.2} />
                {/if}
                <span>{isWorkspaceReady ? 'Active Workspace' : 'Get Started'}</span>
              </div>

              <div style="margin-top: 22px;">
                <h2
                  data-testid="workspace-ready-title"
                  style='margin: 0; font: 700 clamp(1.9rem, 3.2vw, 2.8rem)/1 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: -0.045em; color: rgba(248,250,252,0.98);'
                >
                  {isWorkspaceReady ? 'Workspace Ready' : 'Select or create a workspace'}
                </h2>
                <p
                  style="margin: 14px 0 0; max-width: 720px; color: rgba(191,200,214,0.88); font: 500 15px/1.7 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
                >
                  {#if isWorkspaceReady}
                    Open a different folder, create a new workspace, or continue with the current one.
                  {:else}
                    Choose a folder to begin organizing prompt folders and prompts.
                  {/if}
                </p>
              </div>
            </div>
          </div>

          <div
            style={`${secondaryTileStyle} margin-top: 28px; padding: 18px 18px 20px;`}
          >
            <div
              style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px;"
            >
              <span
                style="color: rgba(148,163,184,0.92); font: 600 11px/1 'Segoe UI Variable Display', 'Segoe UI', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;"
              >
                Current Folder
              </span>
              <span
                style="display: inline-flex; align-items: center; justify-content: center; min-width: 92px; min-height: 28px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,0.04); color: rgba(226,232,240,0.88); font: 600 12px/1 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
              >
                {isWorkspaceReady ? 'Selected' : 'Not Set'}
              </span>
            </div>

            <div
              data-testid="workspace-ready-path"
              title={workspacePath ?? undefined}
              style='overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(248,250,252,0.95); font: 600 14px/1.5 "Cascadia Code", "Consolas", monospace;'
            >
              {workspacePath ?? 'No workspace selected'}
            </div>
          </div>

          <div
            style="margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px;"
          >
            {@render actionButton(
              getSelectButtonLabel(),
              'secondary',
              FolderOpen,
              'select-workspace-folder-button',
              actionsDisabled,
              handleSelectFolder
            )}
            {@render actionButton(
              getCreateButtonLabel(),
              'primary',
              FolderPlus,
              'create-workspace-folder-button',
              actionsDisabled,
              handleCreateFolder
            )}
          </div>

          {#if isWorkspaceReady}
            <div style="margin-top: 14px;">
              {@render actionButton(
                'Close Workspace',
                'danger',
                X,
                'close-workspace-button',
                isCloseDisabled,
                onWorkspaceClear
              )}
            </div>
          {/if}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          {@render statCard(
            'Prompt Folders',
            formatCount(displayedPromptFolderCount),
            Folders,
            'rgba(125,211,252,0.92)'
          )}
          {@render statCard(
            'Prompts',
            formatCount(displayedPromptCount),
            FileText,
            'rgba(167,243,208,0.92)'
          )}
        </div>
      </div>
    </section>
  </div>

  {#if showSetupDialog}
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style="padding: 24px 24px 20px;">
          <h2
            style='margin: 0; color: rgba(248,250,252,0.98); font: 700 1.5rem/1 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: -0.04em;'
          >
            Setup Workspace
          </h2>
          <p
            style="margin: 14px 0 0; color: rgba(191,200,214,0.9); font: 500 14px/1.65 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
          >
            This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up? This
            will create the necessary files and subfolders.
          </p>

          <label
            style={`${secondaryTileStyle} margin-top: 20px; padding: 16px; display: flex; align-items: flex-start; gap: 12px; cursor: pointer;`}
          >
            <input
              id="include-example-prompts"
              data-testid="include-example-prompts-checkbox"
              bind:checked={includeExamplePrompts}
              type="checkbox"
              style={checkboxStyle}
            />
            <span
              style="display: block; color: rgba(226,232,240,0.94); font: 500 14px/1.5 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
            >
              Include example prompts in a "My Prompts" folder.
            </span>
          </label>
        </div>

        <div
          style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; padding: 0 24px 24px;"
        >
          <button type="button" onclick={handleCancelSetup} style={dialogButtonStyle('secondary')}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="setup-workspace-button"
            onclick={handleSetupWorkspace}
            style={dialogButtonStyle('primary')}
          >
            Setup Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div style={overlayStyle}>
      <div data-testid="existing-workspace-dialog" style={modalStyle}>
        <div style="padding: 24px 24px 20px;">
          <h2
            style='margin: 0; color: rgba(248,250,252,0.98); font: 700 1.5rem/1 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: -0.04em;'
          >
            Workspace already exists
          </h2>
          <p
            style="margin: 14px 0 0; color: rgba(191,200,214,0.9); font: 500 14px/1.65 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
          >
            This folder already has a Cthulhu Prompt workspace. Would you like to select it?
          </p>
        </div>

        <div
          style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; padding: 0 24px 24px;"
        >
          <button
            type="button"
            data-testid="cancel-existing-workspace-button"
            onclick={handleCancelExistingWorkspace}
            style={dialogButtonStyle('secondary')}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="select-existing-workspace-button"
            onclick={handleSelectExistingWorkspace}
            style={dialogButtonStyle('primary')}
          >
            Select Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showRootPathDialog}
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style="padding: 24px 24px 20px;">
          <h2
            style='margin: 0; color: rgba(248,250,252,0.98); font: 700 1.5rem/1 "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: -0.04em;'
          >
            Invalid workspace folder
          </h2>
          <p
            style="margin: 14px 0 0; color: rgba(191,200,214,0.9); font: 500 14px/1.65 'Segoe UI Variable Display', 'Segoe UI', sans-serif;"
          >
            {workspaceRootPathErrorMessage}
          </p>
        </div>

        <div style="display: flex; justify-content: flex-end; padding: 0 24px 24px;">
          <button type="button" onclick={closeRootPathDialog} style={dialogButtonStyle('primary')}>
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
