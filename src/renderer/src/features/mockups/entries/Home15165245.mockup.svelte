<script lang="ts">
  import {
    AlertCircle,
    CheckCircle2,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    X
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
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear,
    promptCount = 0,
    promptFolderCount = 0
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
    promptCount?: number
    promptFolderCount?: number
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

  const shellStyle =
    'width:100%; border:1px solid rgba(255,255,255,0.08); border-radius:30px; background:linear-gradient(180deg, rgba(34,36,42,0.98) 0%, rgba(21,23,28,0.98) 100%); box-shadow:0 28px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.03);'

  const panelStyle =
    'border:1px solid rgba(255,255,255,0.07); border-radius:24px; background:rgba(11,13,18,0.84); box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);'

  const metricStyle =
    'display:flex; align-items:center; gap:14px; padding:18px 18px; border:1px solid rgba(255,255,255,0.07); border-radius:22px; background:rgba(14,16,22,0.88);'

  const quietLabelStyle =
    'font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:rgba(161,161,170,0.82);'

  const dialogOverlayStyle =
    'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(5,6,10,0.68); backdrop-filter:blur(12px); z-index:50;'

  const dialogCardStyle =
    'width:min(100%, 520px); border:1px solid rgba(255,255,255,0.09); border-radius:28px; background:linear-gradient(180deg, rgba(31,33,39,0.99) 0%, rgba(17,19,24,0.99) 100%); box-shadow:0 34px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);'

  const formatCount = (value: number) => Intl.NumberFormat().format(Math.max(0, value))

  const getStatusStyle = (ready: boolean) =>
    ready
      ? 'display:inline-flex; align-items:center; gap:8px; width:max-content; padding:8px 12px; border-radius:999px; border:1px solid rgba(74,222,128,0.25); background:rgba(34,197,94,0.12); color:rgb(187,247,208); font-size:13px; font-weight:600;'
      : 'display:inline-flex; align-items:center; gap:8px; width:max-content; padding:8px 12px; border-radius:999px; border:1px solid rgba(167,139,250,0.24); background:rgba(139,92,246,0.10); color:rgb(221,214,254); font-size:13px; font-weight:600;'

  const getActionCardStyle = (tone: 'violet' | 'neutral' | 'danger', disabled: boolean) => {
    const toneStyles =
      tone === 'violet'
        ? 'border:1px solid rgba(167,139,250,0.28); background:linear-gradient(180deg, rgba(52,37,86,0.52) 0%, rgba(22,23,31,0.96) 100%); color:rgb(244,244,245);'
        : tone === 'danger'
          ? 'border:1px solid rgba(248,113,113,0.22); background:linear-gradient(180deg, rgba(82,31,39,0.38) 0%, rgba(24,18,21,0.95) 100%); color:rgb(254,226,226);'
          : 'border:1px solid rgba(255,255,255,0.08); background:linear-gradient(180deg, rgba(43,45,52,0.86) 0%, rgba(18,20,25,0.96) 100%); color:rgb(244,244,245);'

    const disabledStyles = disabled
      ? 'opacity:0.52; cursor:not-allowed;'
      : 'cursor:pointer;'

    return `flex:1 1 280px; min-width:280px; display:flex; align-items:center; justify-content:space-between; gap:18px; padding:20px 22px; border-radius:26px; text-align:left; box-shadow:0 20px 44px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03); transition:transform 160ms ease, border-color 160ms ease, background 160ms ease, opacity 160ms ease; ${toneStyles} ${disabledStyles}`
  }

  const getDialogButtonStyle = (
    tone: 'primary' | 'secondary' | 'danger',
    disabled: boolean
  ) => {
    const toneStyles =
      tone === 'primary'
        ? 'border:1px solid rgba(167,139,250,0.30); background:rgba(139,92,246,0.18); color:rgb(243,232,255);'
        : tone === 'danger'
          ? 'border:1px solid rgba(248,113,113,0.24); background:rgba(239,68,68,0.12); color:rgb(254,226,226);'
          : 'border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:rgb(228,228,231);'

    const disabledStyles = disabled ? 'opacity:0.5; cursor:not-allowed;' : 'cursor:pointer;'

    return `display:inline-flex; align-items:center; justify-content:center; min-width:132px; height:48px; padding:0 18px; border-radius:18px; font-size:14px; font-weight:600; box-shadow:inset 0 1px 0 rgba(255,255,255,0.03); ${toneStyles} ${disabledStyles}`
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
    if (!selectedFolderPath) {
      return
    }

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

  const handleSelectExistingWorkspace = async () => {
    if (!selectedFolderPath) {
      return
    }

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

<main
  data-testid="home-screen"
  style="flex:1; min-height:0; overflow-y:auto; padding:32px 24px 40px;"
>
  <div
    style="width:100%; max-width:980px; margin:0 auto; display:flex; flex-direction:column; gap:20px;"
  >
    <section style={`${shellStyle} padding:28px;`}>
      <div
        style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:20px;"
      >
        <div style="flex:1 1 420px; min-width:min(100%, 320px); display:flex; flex-direction:column; gap:16px;">
          <div
            style="display:inline-flex; align-items:center; width:max-content; padding:7px 11px; border:1px solid rgba(255,255,255,0.08); border-radius:999px; background:rgba(255,255,255,0.04); color:rgb(212,212,216); font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;"
          >
            Home
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <h1
              data-testid="home-title"
              style="margin:0; max-width:100%; font-size:clamp(2.4rem, 5vw, 4.6rem); line-height:0.95; letter-spacing:0.14em; font-weight:800; color:rgb(250,250,250);"
            >
              CTHULHU PROMPT
            </h1>

            <div style={getStatusStyle(isWorkspaceReady)}>
              {#if isWorkspaceReady}
                <CheckCircle2 size={16} strokeWidth={2.2} />
                <span data-testid="workspace-ready-title">Workspace Ready</span>
              {:else}
                <AlertCircle size={16} strokeWidth={2.2} />
                <span>Workspace Not Selected</span>
              {/if}
            </div>
          </div>

          <div style={`${panelStyle} padding:18px 18px 16px;`}>
            <div style={quietLabelStyle}>Workspace</div>
            <div
              title={workspacePath ?? undefined}
              data-testid={isWorkspaceReady ? 'workspace-ready-path' : undefined}
              style="margin-top:10px; color:rgb(244,244,245); font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
            >
              {workspacePath ?? 'Not selected'}
            </div>
          </div>
        </div>

        <div style="flex:0 1 320px; width:min(100%, 320px); display:grid; gap:12px;">
          <div style={metricStyle}>
            <div
              style="display:flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius:16px; background:rgba(139,92,246,0.14); color:rgb(221,214,254);"
            >
              <FileText size={20} strokeWidth={2.2} />
            </div>
            <div style="min-width:0;">
              <div style={quietLabelStyle}>Prompts</div>
              <div
                style="margin-top:4px; font-size:28px; line-height:1; font-weight:700; color:rgb(250,250,250); font-variant-numeric:tabular-nums;"
              >
                {formatCount(promptCount)}
              </div>
            </div>
          </div>

          <div style={metricStyle}>
            <div
              style="display:flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius:16px; background:rgba(255,255,255,0.07); color:rgb(228,228,231);"
            >
              <FolderClosed size={20} strokeWidth={2.2} />
            </div>
            <div style="min-width:0;">
              <div style={quietLabelStyle}>Folders</div>
              <div
                style="margin-top:4px; font-size:28px; line-height:1; font-weight:700; color:rgb(250,250,250); font-variant-numeric:tabular-nums;"
              >
                {formatCount(promptFolderCount)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; flex-wrap:wrap; gap:16px;">
        <button
          type="button"
          data-testid="select-workspace-folder-button"
          onclick={handleSelectFolder}
          disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
          style={getActionCardStyle(
            'violet',
            isWorkspaceLoading || isOpeningWorkspaceFolderDialog
          )}
        >
          <div style="display:flex; align-items:center; gap:16px; min-width:0;">
            <div
              style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:18px; background:rgba(139,92,246,0.18); color:rgb(233,213,255); box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);"
            >
              <FolderOpen size={22} strokeWidth={2.1} />
            </div>
            <div style="min-width:0; display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:18px; font-weight:700; line-height:1.1;">
                {getSelectButtonLabel()}
              </span>
              <span style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(221,214,254,0.78);">
                Existing Workspace
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          data-testid="create-workspace-folder-button"
          onclick={handleCreateFolder}
          disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
          style={getActionCardStyle(
            'neutral',
            isWorkspaceLoading || isOpeningWorkspaceFolderDialog
          )}
        >
          <div style="display:flex; align-items:center; gap:16px; min-width:0;">
            <div
              style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:18px; background:rgba(255,255,255,0.07); color:rgb(244,244,245); box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);"
            >
              <FolderPlus size={22} strokeWidth={2.1} />
            </div>
            <div style="min-width:0; display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:18px; font-weight:700; line-height:1.1;">
                {getCreateButtonLabel()}
              </span>
              <span style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(161,161,170,0.82);">
                New Workspace
              </span>
            </div>
          </div>
        </button>
      </div>

      {#if isWorkspaceReady}
        <button
          type="button"
          data-testid="close-workspace-button"
          onclick={onWorkspaceClear}
          style={getActionCardStyle('danger', false)}
        >
          <div style="display:flex; align-items:center; gap:16px;">
            <div
              style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:18px; background:rgba(239,68,68,0.14); color:rgb(254,202,202); box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);"
            >
              <X size={22} strokeWidth={2.1} />
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:18px; font-weight:700; line-height:1.1;">Close Workspace</span>
              <span style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(252,165,165,0.82);">
                Disconnect
              </span>
            </div>
          </div>
        </button>
      {/if}
    </section>
  </div>

  {#if showSetupDialog}
    <div style={dialogOverlayStyle}>
      <div role="dialog" aria-modal="true" aria-labelledby="setup-workspace-title" style={dialogCardStyle}>
        <div style="padding:24px 24px 22px; display:flex; flex-direction:column; gap:20px;">
          <div style="display:flex; flex-direction:column; gap:10px;">
            <h2
              id="setup-workspace-title"
              style="margin:0; color:rgb(250,250,250); font-size:24px; line-height:1.1; font-weight:700;"
            >
              Setup Workspace
            </h2>
            <p style="margin:0; color:rgb(161,161,170); font-size:14px; line-height:1.6;">
              This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
              This will create the necessary files and subfolders.
            </p>
          </div>

          <label
            style={`${panelStyle} padding:16px; display:flex; align-items:center; gap:12px; color:rgb(228,228,231); font-size:14px; font-weight:600; cursor:pointer;`}
          >
            <input
              id="include-example-prompts"
              type="checkbox"
              data-testid="include-example-prompts-checkbox"
              bind:checked={includeExamplePrompts}
              style="width:18px; height:18px; margin:0; accent-color:rgb(139,92,246);"
            />
            <span>Include example prompts in a "My Prompts" folder.</span>
          </label>

          <div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px;">
            <button
              type="button"
              onclick={handleCancelSetup}
              style={getDialogButtonStyle('secondary', false)}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="setup-workspace-button"
              onclick={handleSetupWorkspace}
              disabled={isWorkspaceLoading}
              style={getDialogButtonStyle('primary', isWorkspaceLoading)}
            >
              Setup Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div style={dialogOverlayStyle}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="existing-workspace-title"
        data-testid="existing-workspace-dialog"
        style={dialogCardStyle}
      >
        <div style="padding:24px 24px 22px; display:flex; flex-direction:column; gap:20px;">
          <div style="display:flex; flex-direction:column; gap:10px;">
            <h2
              id="existing-workspace-title"
              style="margin:0; color:rgb(250,250,250); font-size:24px; line-height:1.1; font-weight:700;"
            >
              Workspace already exists
            </h2>
            <p style="margin:0; color:rgb(161,161,170); font-size:14px; line-height:1.6;">
              This folder already has a Cthulhu Prompt workspace. Would you like to select it?
            </p>
          </div>

          <div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px;">
            <button
              type="button"
              data-testid="cancel-existing-workspace-button"
              onclick={handleCancelExistingWorkspace}
              style={getDialogButtonStyle('secondary', false)}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="select-existing-workspace-button"
              onclick={handleSelectExistingWorkspace}
              disabled={isWorkspaceLoading}
              style={getDialogButtonStyle('primary', isWorkspaceLoading)}
            >
              Select Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showRootPathDialog}
    <div style={dialogOverlayStyle}>
      <div role="dialog" aria-modal="true" aria-labelledby="root-path-title" style={dialogCardStyle}>
        <div style="padding:24px 24px 22px; display:flex; flex-direction:column; gap:20px;">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <div
              style="display:flex; align-items:center; justify-content:center; width:44px; height:44px; flex:0 0 auto; border-radius:16px; background:rgba(239,68,68,0.12); color:rgb(252,165,165);"
            >
              <AlertCircle size={20} strokeWidth={2.2} />
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <h2
                id="root-path-title"
                style="margin:0; color:rgb(250,250,250); font-size:24px; line-height:1.1; font-weight:700;"
              >
                Invalid workspace folder
              </h2>
              <p style="margin:0; color:rgb(161,161,170); font-size:14px; line-height:1.6;">
                {workspaceRootPathErrorMessage}
              </p>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button
              type="button"
              onclick={() => {
                showRootPathDialog = false
              }}
              style={getDialogButtonStyle('danger', false)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
