<script lang="ts">
  import { FileText, FolderOpen, FolderPlus, FolderTree, Sparkles, X } from 'lucide-svelte'
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

  const cardStyle =
    'position: relative; overflow: hidden; border: 1px solid var(--ui-card-border-soft); border-radius: 28px; background: linear-gradient(180deg, var(--ui-card-surface-top), var(--ui-card-surface-bottom)); box-shadow: 0 18px 50px var(--ui-card-shadow);'
  const panelStyle =
    'border: 1px solid var(--ui-border-default); border-radius: 24px; background: var(--ui-surface-muted); box-shadow: inset 0 1px 0 var(--ui-surface-default);'
  const mutedLabelStyle =
    'font-size: 0.76rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ui-text-muted);'

  const getActionButtonStyle = (tone: 'default' | 'accent' | 'danger', disabled: boolean) => {
    const toneStyles =
      tone === 'accent'
        ? 'border: 1px solid var(--ui-accent-border); background: var(--ui-accent-surface); color: var(--ui-accent-text); box-shadow: inset 0 1px 0 var(--ui-accent-fill);'
        : tone === 'danger'
          ? 'border: 1px solid var(--ui-danger-ring); background: var(--ui-surface-default); color: var(--ui-text-strong); box-shadow: inset 0 1px 0 var(--ui-danger-ring);'
          : 'border: 1px solid var(--ui-border-default); background: var(--ui-surface-default); color: var(--ui-text); box-shadow: inset 0 1px 0 var(--ui-surface-muted);'

    return `${toneStyles} display: inline-flex; width: 100%; align-items: center; justify-content: center; gap: 0.7rem; border-radius: 20px; padding: 0.95rem 1.1rem; font-size: 0.95rem; font-weight: 700; line-height: 1.2; transition: opacity 160ms ease; cursor: ${
      disabled ? 'default' : 'pointer'
    }; opacity: ${disabled ? '0.55' : '1'};`
  }

  const getDialogButtonStyle = (tone: 'outline' | 'solid') =>
    tone === 'solid'
      ? 'display: inline-flex; min-width: 9.5rem; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-border); border-radius: 16px; background: var(--ui-accent-surface); box-shadow: inset 0 1px 0 var(--ui-accent-fill); color: var(--ui-accent-text); padding: 0.8rem 1rem; font-size: 0.92rem; font-weight: 700; cursor: pointer;'
      : 'display: inline-flex; min-width: 8rem; align-items: center; justify-content: center; border: 1px solid var(--ui-border-default); border-radius: 16px; background: var(--ui-surface-default); box-shadow: inset 0 1px 0 var(--ui-surface-muted); color: var(--ui-text); padding: 0.8rem 1rem; font-size: 0.92rem; font-weight: 700; cursor: pointer;'

  const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(Math.max(0, value))

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

  const displayedPromptCount = $derived(isWorkspaceReady ? formatCount(promptCount) : '0')
  const displayedPromptFolderCount = $derived(isWorkspaceReady ? formatCount(promptFolderCount) : '0')
  const workspaceCopyColor = $derived(isWorkspaceReady ? 'var(--ui-text)' : 'var(--ui-text-muted)')
  const modalBackdropStyle =
    'position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: linear-gradient(180deg, var(--ui-shadow-raised), var(--ui-card-shadow));'
</script>

<main
  data-testid="home-screen"
  style="min-height: 100%; padding: 1.5rem; color: var(--ui-text); background:
    radial-gradient(circle at top left, var(--ui-accent-surface), transparent 36%),
    radial-gradient(circle at bottom right, var(--ui-surface-emphasis), transparent 28%),
    linear-gradient(180deg, var(--ui-surface-input), var(--ui-surface-input));"
>
  <div
    style="margin: 0 auto; display: flex; max-width: 84rem; flex-wrap: wrap; gap: 1.5rem; align-items: stretch;"
  >
    <section
      style={`${cardStyle} flex: 1 1 42rem; min-width: min(100%, 24rem); padding: 1.75rem;`}
    >
      <div
        style="position: absolute; inset: 0 auto auto 0; width: 18rem; height: 18rem; border-radius: 999px; background: var(--ui-accent-surface); filter: blur(80px); opacity: 0.65; pointer-events: none;"
      ></div>

      <div style="position: relative; display: flex; flex-direction: column; gap: 1.5rem;">
        <div
          style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1rem;"
        >
          <div style="display: flex; min-width: 0; flex-direction: column; gap: 0.85rem;">
            <div
              style="display: inline-flex; width: fit-content; align-items: center; gap: 0.55rem; border: 1px solid var(--ui-accent-border); border-radius: 999px; background: var(--ui-accent-surface); box-shadow: inset 0 1px 0 var(--ui-accent-fill); padding: 0.5rem 0.8rem;"
            >
              <Sparkles style="width: 0.95rem; height: 0.95rem; color: var(--ui-accent-text);" />
              <span style={mutedLabelStyle}>Home</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              <h1
                data-testid="home-title"
                style="margin: 0; font-family: monospace; font-size: clamp(2.7rem, 8vw, 5.4rem); font-weight: 800; letter-spacing: 0.16em; line-height: 0.94; color: var(--ui-text-bright);"
              >
                CTHULHU PROMPT
              </h1>
              <p style="margin: 0; max-width: 32rem; font-size: 0.98rem; line-height: 1.65; color: var(--ui-text-muted);">
                {#if isWorkspaceReady}
                  Current workspace loaded. Open a different folder, create a new workspace, or close the current one.
                {:else}
                  Select a folder to set up your workspace and start managing prompts.
                {/if}
              </p>
            </div>
          </div>

          <div
            style="display: flex; min-width: min(100%, 16rem); flex: 0 0 16rem; flex-direction: column; gap: 0.7rem; border: 1px solid var(--ui-border-default); border-radius: 22px; background: var(--ui-surface-default); box-shadow: inset 0 1px 0 var(--ui-surface-muted); padding: 1rem;"
          >
            <span style={mutedLabelStyle}>Workspace</span>
            <strong
              data-testid="workspace-ready-title"
              style="font-size: 1.1rem; font-weight: 700; color: var(--ui-text-strong);"
            >
              {isWorkspaceReady ? 'Workspace Ready' : 'No Workspace Selected'}
            </strong>
            <div
              data-testid="workspace-ready-path"
              title={workspacePath ?? undefined}
              style={`min-height: 3.4rem; overflow: hidden; text-overflow: ellipsis; font-size: 0.92rem; line-height: 1.5; color: ${workspaceCopyColor};`}
            >
              {workspacePath ?? 'Select a workspace folder to continue.'}
            </div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
          <div
            data-testid="home-prompt-count"
            style={`${panelStyle} flex: 1 1 13rem; min-width: 12rem; padding: 1.15rem 1.15rem 1.25rem;`}
          >
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
              <span style={mutedLabelStyle}>Prompts</span>
              <FileText style="width: 1.15rem; height: 1.15rem; color: var(--ui-text-muted);" />
            </div>
            <div style="margin-top: 0.8rem; font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1; color: var(--ui-text-bright);">
              {displayedPromptCount}
            </div>
          </div>

          <div
            data-testid="home-folder-count"
            style={`${panelStyle} flex: 1 1 13rem; min-width: 12rem; padding: 1.15rem 1.15rem 1.25rem;`}
          >
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
              <span style={mutedLabelStyle}>Folders</span>
              <FolderTree style="width: 1.15rem; height: 1.15rem; color: var(--ui-text-muted);" />
            </div>
            <div style="margin-top: 0.8rem; font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1; color: var(--ui-text-bright);">
              {displayedPromptFolderCount}
            </div>
          </div>

          <div
            style={`${panelStyle} flex: 1 1 18rem; min-width: 15rem; padding: 1.15rem 1.15rem 1.25rem;`}
          >
            <span style={mutedLabelStyle}>Status</span>
            <div style="margin-top: 0.8rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
              <span
                style={`display: inline-flex; align-items: center; border-radius: 999px; padding: 0.45rem 0.8rem; font-size: 0.88rem; font-weight: 700; ${
                  isWorkspaceReady
                    ? 'background: var(--ui-accent-surface); color: var(--ui-accent-text); border: 1px solid var(--ui-accent-border);'
                    : 'background: var(--ui-surface-default); color: var(--ui-text-muted); border: 1px solid var(--ui-border-default);'
                }`}
              >
                {isWorkspaceReady ? 'Ready' : 'Idle'}
              </span>
              <span style="font-size: 0.95rem; color: var(--ui-text-muted);">
                {isWorkspaceLoading ? 'Loading workspace...' : 'Workspace actions available'}
              </span>
            </div>
          </div>
        </div>

        <div style={`${panelStyle} padding: 1.2rem;`}>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: stretch;">
            <div style="flex: 1 1 16rem; min-width: 14rem; display: flex; flex-direction: column; gap: 0.8rem;">
              <span style={mutedLabelStyle}>Open Existing</span>
              <button
                type="button"
                data-testid="select-workspace-folder-button"
                onclick={handleSelectFolder}
                disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
                style={getActionButtonStyle(
                  'default',
                  isWorkspaceLoading || isOpeningWorkspaceFolderDialog
                )}
              >
                <FolderOpen style="width: 1rem; height: 1rem;" />
                <span>{getSelectButtonLabel()}</span>
              </button>
            </div>

            <div style="flex: 1 1 16rem; min-width: 14rem; display: flex; flex-direction: column; gap: 0.8rem;">
              <span style={mutedLabelStyle}>Create New</span>
              <button
                type="button"
                data-testid="create-workspace-folder-button"
                onclick={handleCreateFolder}
                disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
                style={getActionButtonStyle(
                  'accent',
                  isWorkspaceLoading || isOpeningWorkspaceFolderDialog
                )}
              >
                <FolderPlus style="width: 1rem; height: 1rem;" />
                <span>{getCreateButtonLabel()}</span>
              </button>
            </div>

            {#if isWorkspaceReady}
              <div
                style="flex: 1 1 14rem; min-width: 14rem; display: flex; flex-direction: column; gap: 0.8rem;"
              >
                <span style={mutedLabelStyle}>Current Workspace</span>
                <button
                  type="button"
                  data-testid="close-workspace-button"
                  onclick={onWorkspaceClear}
                  style={getActionButtonStyle('danger', false)}
                >
                  <X style="width: 1rem; height: 1rem;" />
                  <span>Close Workspace</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <aside
      style={`${cardStyle} flex: 0 1 24rem; min-width: min(100%, 20rem); padding: 1.5rem;`}
    >
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style={`${panelStyle} padding: 1.1rem;`}>
          <span style={mutedLabelStyle}>Overview</span>
          <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.9rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
              <span style="font-size: 0.95rem; color: var(--ui-text-muted);">Workspace</span>
              <strong style="font-size: 0.95rem; color: var(--ui-text-strong);">
                {isWorkspaceReady ? 'Loaded' : 'Not Loaded'}
              </strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
              <span style="font-size: 0.95rem; color: var(--ui-text-muted);">Prompts</span>
              <strong style="font-size: 0.95rem; color: var(--ui-text-strong);">
                {displayedPromptCount}
              </strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
              <span style="font-size: 0.95rem; color: var(--ui-text-muted);">Folders</span>
              <strong style="font-size: 0.95rem; color: var(--ui-text-strong);">
                {displayedPromptFolderCount}
              </strong>
            </div>
          </div>
        </div>

        <div style={`${panelStyle} padding: 1.1rem;`}>
          <span style={mutedLabelStyle}>Workspace Path</span>
          <div
            style={`margin-top: 0.75rem; border: 1px solid var(--ui-border-muted); border-radius: 18px; background: var(--ui-surface-default); padding: 0.95rem 1rem; font-size: 0.9rem; line-height: 1.6; color: ${workspaceCopyColor}; word-break: break-word;`}
          >
            {workspacePath ?? 'No workspace selected.'}
          </div>
        </div>

        <div style={`${panelStyle} padding: 1.1rem;`}>
          <span style={mutedLabelStyle}>Example Prompts</span>
          <div
            style="margin-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--ui-border-muted); border-radius: 18px; background: var(--ui-surface-default); padding: 0.95rem 1rem;"
          >
            <span style="font-size: 0.92rem; color: var(--ui-text);">Include on setup</span>
            <span
              style={`display: inline-flex; align-items: center; border-radius: 999px; padding: 0.42rem 0.75rem; font-size: 0.85rem; font-weight: 700; ${
                includeExamplePrompts
                  ? 'background: var(--ui-accent-surface); color: var(--ui-accent-text); border: 1px solid var(--ui-accent-border);'
                  : 'background: var(--ui-surface-default); color: var(--ui-text-muted); border: 1px solid var(--ui-border-default);'
              }`}
            >
              {includeExamplePrompts ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  </div>

  {#if showSetupDialog}
    <div style={modalBackdropStyle}>
      <div
        role="dialog"
        aria-modal="true"
        style={`${cardStyle} width: min(100%, 34rem); padding: 1.4rem;`}
      >
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--ui-text-bright);">
              Setup Workspace
            </h2>
            <p style="margin: 0; font-size: 0.94rem; line-height: 1.65; color: var(--ui-text-muted);">
              This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
              This will create the necessary files and subfolders.
            </p>
          </div>

          {#if selectedFolderPath}
            <div
              style="border: 1px solid var(--ui-border-muted); border-radius: 18px; background: var(--ui-surface-default); padding: 0.9rem 1rem; font-size: 0.9rem; line-height: 1.55; color: var(--ui-text); word-break: break-word;"
            >
              {selectedFolderPath}
            </div>
          {/if}

          <label
            for="include-example-prompts"
            style="display: flex; gap: 0.85rem; align-items: flex-start; border: 1px solid var(--ui-border-default); border-radius: 18px; background: var(--ui-surface-muted); padding: 0.95rem 1rem; cursor: pointer;"
          >
            <input
              id="include-example-prompts"
              data-testid="include-example-prompts-checkbox"
              type="checkbox"
              checked={includeExamplePrompts}
              onchange={(event) =>
                (includeExamplePrompts = (event.currentTarget as HTMLInputElement).checked)}
              style="margin-top: 0.1rem; width: 1rem; height: 1rem;"
            />
            <span style="font-size: 0.92rem; line-height: 1.6; color: var(--ui-text);">
              Include example prompts in a "My Prompts" folder.
            </span>
          </label>

          <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" onclick={handleCancelSetup} style={getDialogButtonStyle('outline')}>
              Cancel
            </button>
            <button
              type="button"
              data-testid="setup-workspace-button"
              onclick={handleSetupWorkspace}
              style={getDialogButtonStyle('solid')}
            >
              Setup Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div style={modalBackdropStyle}>
      <div
        role="dialog"
        aria-modal="true"
        data-testid="existing-workspace-dialog"
        style={`${cardStyle} width: min(100%, 33rem); padding: 1.4rem;`}
      >
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--ui-text-bright);">
              Workspace already exists
            </h2>
            <p style="margin: 0; font-size: 0.94rem; line-height: 1.65; color: var(--ui-text-muted);">
              This folder already has a Cthulhu Prompt workspace. Would you like to select it?
            </p>
          </div>

          {#if selectedFolderPath}
            <div
              style="border: 1px solid var(--ui-border-muted); border-radius: 18px; background: var(--ui-surface-default); padding: 0.9rem 1rem; font-size: 0.9rem; line-height: 1.55; color: var(--ui-text); word-break: break-word;"
            >
              {selectedFolderPath}
            </div>
          {/if}

          <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem;">
            <button
              type="button"
              data-testid="cancel-existing-workspace-button"
              onclick={handleCancelExistingWorkspace}
              style={getDialogButtonStyle('outline')}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="select-existing-workspace-button"
              onclick={handleSelectExistingWorkspace}
              style={getDialogButtonStyle('solid')}
            >
              Select Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showRootPathDialog}
    <div style={modalBackdropStyle}>
      <div role="dialog" aria-modal="true" style={`${cardStyle} width: min(100%, 31rem); padding: 1.4rem;`}>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--ui-text-bright);">
              Invalid workspace folder
            </h2>
            <p style="margin: 0; font-size: 0.94rem; line-height: 1.65; color: var(--ui-text-muted);">
              {workspaceRootPathErrorMessage}
            </p>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button
              type="button"
              onclick={() => {
                showRootPathDialog = false
              }}
              style={getDialogButtonStyle('solid')}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
