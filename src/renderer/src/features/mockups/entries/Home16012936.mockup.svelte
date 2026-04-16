<script lang="ts">
  import {
    AlertCircle,
    Check,
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

  const secondaryTitleText = 'CTHULHU PROMPT'

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

  const pageStyle = [
    'display:flex',
    'flex:1 1 auto',
    'min-width:0',
    'overflow-y:auto',
    'padding:28px 24px 40px'
  ].join(';')

  const columnStyle = [
    'width:100%',
    'max-width:1120px',
    'margin:0 auto',
    'display:flex',
    'flex-direction:column',
    'gap:20px',
    "font-family:'Segoe UI Variable Text','Segoe UI',sans-serif",
    'color:var(--ui-text)'
  ].join(';')

  const heroStyle = [
    'display:flex',
    'justify-content:center',
    'padding:6px 0 2px'
  ].join(';')

  const heroTitleStyle = [
    'margin:0',
    "font-family:'Cascadia Mono','Consolas',monospace",
    'font-size:clamp(3.2rem,8vw,5.8rem)',
    'font-weight:700',
    'letter-spacing:0.16em',
    'line-height:0.95',
    'text-align:center',
    'text-transform:uppercase',
    'color:var(--ui-text-bright)',
    'text-shadow:0 10px 32px rgb(0 0 0 / 0.3)'
  ].join(';')

  const cardsStyle = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(320px,1fr))',
    'gap:20px',
    'align-items:stretch'
  ].join(';')

  const cardStyle = [
    'position:relative',
    'min-width:0',
    'display:flex',
    'flex-direction:column',
    'gap:18px',
    'padding:26px',
    'border:1px solid var(--ui-card-border-soft)',
    'border-radius:32px',
    'background:linear-gradient(180deg,rgb(255 255 255 / 0.06),rgb(255 255 255 / 0.025))',
    'box-shadow:0 26px 54px rgb(0 0 0 / 0.34), inset 0 1px 0 rgb(255 255 255 / 0.04)'
  ].join(';')

  const glowStyle = [
    'position:absolute',
    'right:-34px',
    'bottom:-44px',
    'width:164px',
    'height:164px',
    'pointer-events:none',
    'border-radius:999px',
    'background:radial-gradient(circle,rgb(139 92 246 / 0.16),transparent 68%)'
  ].join(';')

  const neutralGlowStyle = [
    'position:absolute',
    'left:-56px',
    'top:-56px',
    'width:172px',
    'height:172px',
    'pointer-events:none',
    'border-radius:999px',
    'background:radial-gradient(circle,rgb(255 255 255 / 0.06),transparent 70%)'
  ].join(';')

  const headerRowStyle = [
    'position:relative',
    'z-index:1',
    'display:flex',
    'align-items:flex-start',
    'justify-content:space-between',
    'gap:16px',
    'flex-wrap:wrap'
  ].join(';')

  const sectionTitleStyle = [
    'margin:0',
    "font-family:'Segoe UI Variable Display','Segoe UI',sans-serif",
    'font-size:1.2rem',
    'font-weight:650',
    'letter-spacing:-0.03em',
    'color:var(--ui-text-bright)'
  ].join(';')

  const statusBadgeStyle = (ready: boolean) =>
    [
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'padding:8px 12px',
      'border-radius:999px',
      'border:1px solid',
      'font-size:0.8rem',
      'font-weight:700',
      'letter-spacing:0.02em',
      ready
        ? 'background:var(--ui-success-surface);border-color:var(--ui-success-border);color:var(--ui-success-text)'
        : 'background:var(--ui-accent-surface);border-color:var(--ui-accent-border);color:var(--ui-accent-text)'
    ].join(';')

  const insetPanelStyle = [
    'position:relative',
    'z-index:1',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'padding:18px 18px 20px',
    'border:1px solid var(--ui-card-border-subcard)',
    'border-radius:24px',
    'background:rgb(11 14 20 / 0.88)',
    'box-shadow:inset 0 1px 0 rgb(255 255 255 / 0.03)'
  ].join(';')

  const fieldLabelStyle = [
    'font-size:0.77rem',
    'font-weight:700',
    'letter-spacing:0.08em',
    'text-transform:uppercase',
    'color:var(--ui-text-muted)'
  ].join(';')

  const pathValueStyle = [
    "font-family:'Cascadia Mono','Consolas',monospace",
    'font-size:0.95rem',
    'line-height:1.55',
    'color:var(--ui-text-strong)',
    'overflow-wrap:anywhere'
  ].join(';')

  const statsGridStyle = [
    'position:relative',
    'z-index:1',
    'display:grid',
    'grid-template-columns:repeat(2,minmax(0,1fr))',
    'gap:12px'
  ].join(';')

  const statTileStyle = [
    'display:flex',
    'align-items:center',
    'gap:14px',
    'padding:16px',
    'border:1px solid var(--ui-card-border-subcard)',
    'border-radius:24px',
    'background:rgb(11 14 20 / 0.9)'
  ].join(';')

  const statIconWrapStyle = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:46px',
    'height:46px',
    'border-radius:18px',
    'background:var(--ui-accent-icon-surface)',
    'box-shadow:0 0 0 1px var(--ui-accent-icon-ring)',
    'color:var(--ui-accent-icon)',
    'flex:0 0 auto'
  ].join(';')

  const statLabelStyle = [
    'font-size:0.72rem',
    'font-weight:700',
    'letter-spacing:0.06em',
    'text-transform:uppercase',
    'color:var(--ui-text-muted)'
  ].join(';')

  const statValueStyle = [
    "font-family:'Cascadia Mono','Consolas',monospace",
    'margin-top:6px',
    'font-size:1.75rem',
    'line-height:1',
    'font-weight:700',
    'color:var(--ui-text-bright)'
  ].join(';')

  const actionsColumnStyle = [
    'position:relative',
    'z-index:1',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'margin-top:auto'
  ].join(';')

  const actionButtonStyle = (variant: 'accent' | 'neutral' | 'danger', disabled: boolean) =>
    [
      'width:100%',
      'display:flex',
      'align-items:center',
      'justify-content:flex-start',
      'gap:14px',
      'padding:16px 18px',
      'border-radius:24px',
      'border:1px solid',
      'text-align:left',
      "font-family:'Segoe UI Variable Text','Segoe UI',sans-serif",
      'font-size:0.98rem',
      'font-weight:650',
      'transition:opacity 120ms ease',
      disabled ? 'cursor:not-allowed' : 'cursor:pointer',
      disabled ? 'opacity:0.55' : 'opacity:1',
      variant === 'accent'
        ? 'background:rgb(139 92 246 / 0.13);border-color:rgb(216 180 254 / 0.26);color:var(--ui-accent-text)'
        : variant === 'danger'
          ? 'background:rgb(239 68 68 / 0.09);border-color:rgb(248 113 113 / 0.22);color:rgb(254 226 226)'
          : 'background:rgb(11 14 20 / 0.88);border-color:var(--ui-card-border-subcard);color:var(--ui-text-strong)'
    ].join(';')

  const actionIconStyle = (variant: 'accent' | 'neutral' | 'danger') =>
    [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'width:42px',
      'height:42px',
      'border-radius:16px',
      'flex:0 0 auto',
      variant === 'accent'
        ? 'background:rgb(139 92 246 / 0.16);box-shadow:0 0 0 1px rgb(167 139 250 / 0.16);color:var(--ui-accent-icon)'
        : variant === 'danger'
          ? 'background:rgb(239 68 68 / 0.12);box-shadow:0 0 0 1px rgb(248 113 113 / 0.18);color:rgb(252 165 165)'
          : 'background:rgb(255 255 255 / 0.04);box-shadow:0 0 0 1px rgb(255 255 255 / 0.06);color:var(--ui-text-muted)'
    ].join(';')

  const actionTextStyle = [
    'min-width:0',
    'flex:1 1 auto',
    'white-space:normal'
  ].join(';')

  const modalOverlayStyle = [
    'position:fixed',
    'inset:0',
    'z-index:50',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'background:rgb(0 0 0 / 0.56)',
    'backdrop-filter:blur(6px)'
  ].join(';')

  const modalCardStyle = [
    'width:min(100%,520px)',
    'display:flex',
    'flex-direction:column',
    'gap:18px',
    'padding:24px',
    'border:1px solid var(--ui-card-border-soft)',
    'border-radius:28px',
    'background:linear-gradient(180deg,rgb(23 26 33 / 0.98),rgb(16 18 24 / 0.98))',
    'box-shadow:0 30px 80px rgb(0 0 0 / 0.5)',
    "font-family:'Segoe UI Variable Text','Segoe UI',sans-serif",
    'color:var(--ui-text)'
  ].join(';')

  const modalTitleStyle = [
    'margin:0',
    'font-size:1.15rem',
    'font-weight:680',
    'letter-spacing:-0.025em',
    'color:var(--ui-text-bright)'
  ].join(';')

  const modalTextStyle = [
    'margin:0',
    'font-size:0.92rem',
    'line-height:1.6',
    'color:var(--ui-text-muted)'
  ].join(';')

  const checkboxRowStyle = [
    'display:flex',
    'align-items:flex-start',
    'gap:12px',
    'padding:14px 16px',
    'border:1px solid var(--ui-card-border-subcard)',
    'border-radius:20px',
    'background:rgb(11 14 20 / 0.88)'
  ].join(';')

  const checkboxStyle = [
    'width:18px',
    'height:18px',
    'margin-top:2px',
    'accent-color:rgb(139 92 246)'
  ].join(';')

  const modalActionsStyle = [
    'display:flex',
    'justify-content:flex-end',
    'gap:10px',
    'flex-wrap:wrap'
  ].join(';')

  const modalButtonStyle = (variant: 'outline' | 'solid') =>
    [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-width:138px',
      'padding:12px 16px',
      'border-radius:18px',
      'border:1px solid',
      "font-family:'Segoe UI Variable Text','Segoe UI',sans-serif",
      'font-size:0.92rem',
      'font-weight:650',
      'cursor:pointer',
      variant === 'solid'
        ? 'background:rgb(139 92 246 / 0.18);border-color:rgb(216 180 254 / 0.28);color:var(--ui-accent-text)'
        : 'background:rgb(255 255 255 / 0.03);border-color:var(--ui-border-default);color:var(--ui-text)'
    ].join(';')
</script>

<main data-testid="home-screen" style={pageStyle}>
  <div style={columnStyle}>
    <section style={heroStyle}>
      <h1 data-testid="home-title" style={heroTitleStyle}>{secondaryTitleText}</h1>
    </section>

    <section style={cardsStyle}>
      <article style={cardStyle}>
        <div aria-hidden="true" style={neutralGlowStyle}></div>
        <div aria-hidden="true" style={glowStyle}></div>

        <div style={headerRowStyle}>
          <h2 style={sectionTitleStyle}>Current Workspace</h2>
          <div style={statusBadgeStyle(isWorkspaceReady)}>
            {#if isWorkspaceReady}
              <Check size={16} strokeWidth={2.4} />
              <span data-testid="workspace-ready-title">Workspace Ready</span>
            {:else}
              <AlertCircle size={16} strokeWidth={2.4} />
              <span>Workspace Not Selected</span>
            {/if}
          </div>
        </div>

        <div style={insetPanelStyle}>
          <div style={fieldLabelStyle}>Workspace Path</div>
          <div
            data-testid={isWorkspaceReady ? 'workspace-ready-path' : undefined}
            title={displayedWorkspacePath}
            style={pathValueStyle}
          >
            {displayedWorkspacePath}
          </div>
        </div>

        <div style={statsGridStyle}>
          <div style={statTileStyle}>
            <div style={statIconWrapStyle}>
              <FileText size={20} strokeWidth={2.2} />
            </div>
            <div style="min-width:0">
              <div style={statLabelStyle}>Prompts</div>
              <div style={statValueStyle}>9999</div>
            </div>
          </div>

          <div style={statTileStyle}>
            <div style={statIconWrapStyle}>
              <FolderClosed size={20} strokeWidth={2.2} />
            </div>
            <div style="min-width:0">
              <div style={statLabelStyle}>Prompt Folders</div>
              <div style={statValueStyle}>9999</div>
            </div>
          </div>
        </div>
      </article>

      <article style={cardStyle}>
        <div aria-hidden="true" style={neutralGlowStyle}></div>
        <div aria-hidden="true" style={glowStyle}></div>

        <div style={headerRowStyle}>
          <h2 style={sectionTitleStyle}>Workspace Actions</h2>
        </div>

        <div style={actionsColumnStyle}>
          <button
            type="button"
            data-testid="select-workspace-folder-button"
            onclick={handleSelectFolder}
            disabled={isWorkspaceActionDisabled}
            style={actionButtonStyle('accent', isWorkspaceActionDisabled)}
          >
            <span style={actionIconStyle('accent')}>
              <FolderOpen size={20} strokeWidth={2.2} />
            </span>
            <span style={actionTextStyle}>{getSelectButtonLabel()}</span>
          </button>

          <button
            type="button"
            data-testid="create-workspace-folder-button"
            onclick={handleCreateFolder}
            disabled={isWorkspaceActionDisabled}
            style={actionButtonStyle('neutral', isWorkspaceActionDisabled)}
          >
            <span style={actionIconStyle('neutral')}>
              <FolderPlus size={20} strokeWidth={2.2} />
            </span>
            <span style={actionTextStyle}>{getCreateButtonLabel()}</span>
          </button>

          {#if isWorkspaceReady}
            <button
              type="button"
              data-testid="close-workspace-button"
              onclick={onWorkspaceClear}
              disabled={isWorkspaceActionDisabled}
              style={actionButtonStyle('danger', isWorkspaceActionDisabled)}
            >
              <span style={actionIconStyle('danger')}>
                <X size={20} strokeWidth={2.2} />
              </span>
              <span style={actionTextStyle}>Close Workspace</span>
            </button>
          {/if}
        </div>
      </article>
    </section>
  </div>

  {#if showSetupDialog}
    <div style={modalOverlayStyle}>
      <div role="dialog" aria-modal="true" style={modalCardStyle}>
        <div style="display:flex;flex-direction:column;gap:8px">
          <h2 style={modalTitleStyle}>Setup Workspace</h2>
          <p style={modalTextStyle}>
            This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up? This
            will create the necessary files and subfolders.
          </p>
        </div>

        <label style={checkboxRowStyle}>
          <input
            id="include-example-prompts"
            type="checkbox"
            data-testid="include-example-prompts-checkbox"
            bind:checked={includeExamplePrompts}
            style={checkboxStyle}
          />
          <span style="font-size:0.92rem;line-height:1.5;color:var(--ui-text)">
            Include example prompts in a "My Prompts" folder.
          </span>
        </label>

        <div style={modalActionsStyle}>
          <button type="button" onclick={handleCancelSetup} style={modalButtonStyle('outline')}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="setup-workspace-button"
            onclick={handleSetupWorkspace}
            style={modalButtonStyle('solid')}
          >
            Setup Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div style={modalOverlayStyle}>
      <div data-testid="existing-workspace-dialog" role="dialog" aria-modal="true" style={modalCardStyle}>
        <div style="display:flex;flex-direction:column;gap:8px">
          <h2 style={modalTitleStyle}>Workspace already exists</h2>
          <p style={modalTextStyle}>
            This folder already has a Cthulhu Prompt workspace. Would you like to select it?
          </p>
        </div>

        <div style={modalActionsStyle}>
          <button
            type="button"
            data-testid="cancel-existing-workspace-button"
            onclick={handleCancelExistingWorkspace}
            style={modalButtonStyle('outline')}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="select-existing-workspace-button"
            onclick={handleSelectExistingWorkspace}
            style={modalButtonStyle('solid')}
          >
            Select Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showRootPathDialog}
    <div style={modalOverlayStyle}>
      <div role="dialog" aria-modal="true" style={modalCardStyle}>
        <div style="display:flex;flex-direction:column;gap:8px">
          <h2 style={modalTitleStyle}>Invalid workspace folder</h2>
          <p style={modalTextStyle}>{workspaceRootPathErrorMessage}</p>
        </div>

        <div style={modalActionsStyle}>
          <button
            type="button"
            onclick={() => {
              showRootPathDialog = false
            }}
            style={modalButtonStyle('solid')}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
