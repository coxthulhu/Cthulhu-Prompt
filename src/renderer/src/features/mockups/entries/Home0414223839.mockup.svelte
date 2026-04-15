<script lang="ts">
  import {
    AlertTriangle,
    Check,
    Files,
    FolderKanban,
    FolderOpen,
    FolderPlus,
    Sparkles,
    X
  } from 'lucide-svelte'
  import { untrack } from 'svelte'

  type WorkspaceAction = 'select' | 'create' | null
  type MockFolderScenario = 'setup' | 'existing' | 'invalid-root' | 'cancel'
  type WorkspaceSelectionResult = {
    success: boolean
    reason?: 'workspace-missing' | string
  }
  type WorkspaceCreationResult = {
    success: boolean
  }

  let {
    workspacePath = 'C:\\Users\\Dana\\Documents\\Cthulhu Prompt',
    isWorkspaceReady = true,
    isWorkspaceLoading = false,
    promptCount = 184,
    promptFolderCount = 17,
    mockSelectedFolderPath = 'C:\\Users\\Dana\\Documents\\Cthulhu Prompt',
    mockSelectScenario = 'existing',
    mockCreateScenario = 'setup',
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  }: {
    workspacePath?: string | null
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    promptCount?: number
    promptFolderCount?: number
    mockSelectedFolderPath?: string
    mockSelectScenario?: MockFolderScenario
    mockCreateScenario?: MockFolderScenario
    onWorkspaceSelect?: (path: string) => Promise<WorkspaceSelectionResult>
    onWorkspaceCreate?: (
      path: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
    onWorkspaceClear?: () => void
  } = $props()

  // Snapshot the initial props so preview interactions can diverge from incoming values.
  let previewWorkspaceReady = $state(untrack(() => isWorkspaceReady))
  let previewWorkspacePath = $state(untrack(() => workspacePath))
  let showSetupDialog = $state(false)
  let showExistingWorkspaceDialog = $state(false)
  let showRootPathDialog = $state(false)
  let selectedFolderPath = $state<string | null>(null)
  let includeExamplePrompts = $state(true)
  let activeWorkspaceAction = $state<WorkspaceAction>(null)

  const frameStyle = `
    min-height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    box-sizing: border-box;
    background:
      radial-gradient(circle at top, rgba(123, 97, 255, 0.18), transparent 32%),
      radial-gradient(circle at bottom right, rgba(123, 97, 255, 0.08), transparent 28%),
      linear-gradient(180deg, #0d1017 0%, #090b10 100%);
    color: #f4f5f7;
    font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif;
  `

  const columnStyle = `
    width: min(100%, 980px);
    display: flex;
    flex-direction: column;
    gap: 20px;
  `

  const heroCardStyle = `
    position: relative;
    overflow: hidden;
    border-radius: 36px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(30, 32, 41, 0.96) 0%, rgba(16, 18, 24, 0.98) 100%);
    box-shadow:
      0 28px 70px rgba(0, 0, 0, 0.46),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    padding: 30px;
  `

  const panelStyle = `
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(12, 14, 19, 0.78);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 18px 36px rgba(0, 0, 0, 0.22);
    padding: 22px;
  `

  const metricCardStyle = `
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(19, 21, 28, 0.94) 0%, rgba(13, 15, 20, 0.98) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 16px 34px rgba(0, 0, 0, 0.22);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 120px;
  `

  const iconShellStyle = `
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: rgba(123, 97, 255, 0.13);
    border: 1px solid rgba(165, 140, 255, 0.18);
    color: #c6b8ff;
    flex: 0 0 auto;
  `

  const subtlePillStyle = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 9px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: rgba(232, 234, 240, 0.92);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  `

  const infoRowStyle = `
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  `

  const getActionButtonStyle = (kind: 'primary' | 'secondary' | 'danger', disabled = false) => `
    min-height: 54px;
    padding: 0 20px;
    border-radius: 999px;
    border: 1px solid ${
      kind === 'primary'
        ? 'rgba(156, 131, 255, 0.35)'
        : kind === 'danger'
          ? 'rgba(247, 117, 117, 0.28)'
          : 'rgba(255, 255, 255, 0.09)'
    };
    background: ${
      kind === 'primary'
        ? 'linear-gradient(180deg, rgba(103, 76, 224, 0.96) 0%, rgba(86, 64, 191, 0.96) 100%)'
        : kind === 'danger'
          ? 'linear-gradient(180deg, rgba(72, 28, 33, 0.96) 0%, rgba(55, 20, 24, 0.96) 100%)'
          : 'linear-gradient(180deg, rgba(33, 35, 45, 0.96) 0%, rgba(23, 25, 32, 0.96) 100%)'
    };
    color: ${
      kind === 'danger' ? '#ffd6d6' : '#f4f5f8'
    };
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.07),
      0 14px 24px rgba(0, 0, 0, 0.2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: ${disabled ? 'default' : 'pointer'};
    opacity: ${disabled ? 0.5 : 1};
    transition: opacity 120ms ease;
    width: 100%;
  `

  const dialogOverlayStyle = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(7, 8, 11, 0.66);
    backdrop-filter: blur(10px);
    z-index: 20;
  `

  const dialogStyle = `
    width: min(100%, 520px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(30, 32, 41, 0.98) 0%, rgba(16, 18, 24, 0.99) 100%);
    box-shadow:
      0 28px 70px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    padding: 24px;
    color: #f4f5f7;
  `

  const checkboxStyle = `
    width: 18px;
    height: 18px;
    border-radius: 6px;
    accent-color: #7b61ff;
    cursor: pointer;
  `

  const formatCount = (count: number) => new Intl.NumberFormat('en-US').format(count)

  const setWorkspaceReady = (path: string) => {
    previewWorkspacePath = path
    previewWorkspaceReady = true
  }

  const clearWorkspace = () => {
    previewWorkspacePath = null
    previewWorkspaceReady = false
    includeExamplePrompts = true
    selectedFolderPath = null
    showSetupDialog = false
    showExistingWorkspaceDialog = false
    showRootPathDialog = false
  }

  const runMockScenario = (scenario: MockFolderScenario) => {
    if (scenario === 'cancel') {
      return
    }

    if (scenario === 'invalid-root') {
      showRootPathDialog = true
      return
    }

    selectedFolderPath = mockSelectedFolderPath
    includeExamplePrompts = true

    if (scenario === 'existing') {
      showExistingWorkspaceDialog = true
      return
    }

    showSetupDialog = true
  }

  const handleSelectFolder = async () => {
    activeWorkspaceAction = 'select'
    try {
      runMockScenario(mockSelectScenario)
    } finally {
      if (activeWorkspaceAction === 'select') {
        activeWorkspaceAction = null
      }
    }
  }

  const handleCreateFolder = async () => {
    activeWorkspaceAction = 'create'
    try {
      runMockScenario(mockCreateScenario)
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
      if (onWorkspaceCreate) {
        const result = await onWorkspaceCreate(selectedFolderPath, includeExamplePrompts)
        if (!result.success) {
          return
        }
      }

      setWorkspaceReady(selectedFolderPath)
      showSetupDialog = false
      selectedFolderPath = null
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
      if (onWorkspaceSelect) {
        const result = await onWorkspaceSelect(selectedFolderPath)

        if (result.success) {
          setWorkspaceReady(selectedFolderPath)
          showExistingWorkspaceDialog = false
          selectedFolderPath = null
          return
        }

        if (result.reason === 'workspace-missing') {
          showExistingWorkspaceDialog = false
          showSetupDialog = true
          return
        }

        return
      }

      setWorkspaceReady(selectedFolderPath)
      showExistingWorkspaceDialog = false
      selectedFolderPath = null
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

  const handleCloseWorkspace = () => {
    onWorkspaceClear?.()
    clearWorkspace()
  }

  const getSelectButtonLabel = () => {
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'select' ? 'Setting up...' : 'Loading...'
    }

    return 'Select Workspace Folder'
  }

  const getCreateButtonLabel = () => {
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'create' ? 'Creating...' : 'Loading...'
    }

    return 'Create Workspace Folder'
  }
</script>

<main data-testid="home-screen" style={frameStyle}>
  <div style={columnStyle}>
    <section style={heroCardStyle}>
      <div
        aria-hidden="true"
        style="position: absolute; right: -96px; top: -96px; width: 240px; height: 240px; border-radius: 999px; background: radial-gradient(circle, rgba(123, 97, 255, 0.26) 0%, rgba(123, 97, 255, 0) 72%);"
      ></div>

      <div
        style="position: relative; display: flex; flex-direction: column; gap: 22px;"
      >
        <div
          style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;"
        >
          <div style={subtlePillStyle}>
            <Sparkles size={14} />
            Home
          </div>

          {#if previewWorkspaceReady}
            <div style={`${subtlePillStyle}; background: rgba(107, 191, 128, 0.12); border-color: rgba(107, 191, 128, 0.2); color: #d9f5df;`}>
              <Check size={14} />
              Workspace Ready
            </div>
          {:else}
            <div style={`${subtlePillStyle}; color: rgba(232, 234, 240, 0.78);`}>
              <FolderOpen size={14} />
              Get Started
            </div>
          {/if}
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h1
            data-testid="home-title"
            style="margin: 0; font-size: clamp(2.8rem, 6vw, 4.7rem); line-height: 0.95; font-weight: 800; letter-spacing: 0.16em;"
          >
            CTHULHU PROMPT
          </h1>

          {#if previewWorkspaceReady}
            <p style="margin: 0; color: rgba(222, 225, 232, 0.72); font-size: 1rem; font-weight: 600; line-height: 1.6;">
              Open your workspace, manage prompts, and jump back into writing.
            </p>
          {:else}
            <p style="margin: 0; color: rgba(222, 225, 232, 0.72); font-size: 1rem; font-weight: 600; line-height: 1.6;">
              Select a folder to set up your workspace and start managing prompts.
            </p>
          {/if}
        </div>

        <div
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;"
        >
          <div style={metricCardStyle}>
            <div style={iconShellStyle}>
              <Files size={20} />
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="color: rgba(214, 217, 224, 0.66); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                Prompts
              </span>
              <span style="font-size: 2rem; line-height: 1; font-weight: 800;">
                {formatCount(previewWorkspaceReady ? promptCount : 0)}
              </span>
              <span style="color: rgba(214, 217, 224, 0.6); font-size: 0.9rem; font-weight: 600;">
                Prompt Library
              </span>
            </div>
          </div>

          <div style={metricCardStyle}>
            <div style={iconShellStyle}>
              <FolderKanban size={20} />
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="color: rgba(214, 217, 224, 0.66); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                Folders
              </span>
              <span style="font-size: 2rem; line-height: 1; font-weight: 800;">
                {formatCount(previewWorkspaceReady ? promptFolderCount : 0)}
              </span>
              <span style="color: rgba(214, 217, 224, 0.6); font-size: 0.9rem; font-weight: 600;">
                Prompt Folders
              </span>
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <div
            style="display: flex; flex-direction: column; gap: 16px;"
          >
            <div
              style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px;"
            >
              <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0;">
                <h2
                  data-testid={previewWorkspaceReady ? 'workspace-ready-title' : undefined}
                  style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #fbfbfd;"
                >
                  {previewWorkspaceReady ? 'Workspace Ready' : 'Get Started'}
                </h2>

                {#if previewWorkspaceReady}
                  <div style={infoRowStyle}>
                    <div
                      data-testid="workspace-ready-path"
                      title={previewWorkspacePath ?? undefined}
                      style="max-width: 100%; min-height: 42px; display: inline-flex; align-items: center; border-radius: 16px; padding: 0 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(231, 233, 239, 0.88); font-size: 0.92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      {previewWorkspacePath}
                    </div>
                  </div>
                {:else}
                  <p style="margin: 0; color: rgba(214, 217, 224, 0.62); font-size: 0.95rem; line-height: 1.55; font-weight: 600;">
                    Choose a workspace folder to create a new prompt library or reconnect to an
                    existing one.
                  </p>
                {/if}
              </div>

              <div
                style="display: inline-flex; align-items: center; gap: 8px; border-radius: 18px; padding: 10px 14px; background: rgba(123, 97, 255, 0.12); border: 1px solid rgba(165, 140, 255, 0.18); color: #ddd6ff; font-size: 0.84rem; font-weight: 700;"
              >
                <Sparkles size={16} />
                {previewWorkspaceReady ? 'Workspace Active' : 'Workspace Required'}
              </div>
            </div>

            <div
              style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;"
            >
              <button
                type="button"
                data-testid="select-workspace-folder-button"
                style={getActionButtonStyle('primary', isWorkspaceLoading)}
                onclick={handleSelectFolder}
                disabled={isWorkspaceLoading}
              >
                <FolderOpen size={18} />
                {getSelectButtonLabel()}
              </button>

              <button
                type="button"
                data-testid="create-workspace-folder-button"
                style={getActionButtonStyle('secondary', isWorkspaceLoading)}
                onclick={handleCreateFolder}
                disabled={isWorkspaceLoading}
              >
                <FolderPlus size={18} />
                {getCreateButtonLabel()}
              </button>
            </div>

            {#if previewWorkspaceReady}
              <div>
                <button
                  type="button"
                  data-testid="close-workspace-button"
                  style={getActionButtonStyle('danger', false)}
                  onclick={handleCloseWorkspace}
                >
                  <X size={18} />
                  Close Workspace
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </section>
  </div>

  {#if showSetupDialog}
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800;">Setup Workspace</h2>
            <p style="margin: 10px 0 0; color: rgba(214, 217, 224, 0.66); font-size: 0.95rem; line-height: 1.6; font-weight: 600;">
              This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
              This will create the necessary files and subfolders.
            </p>
          </div>

          <label
            for="include-example-prompts"
            style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); padding: 0 14px; color: rgba(233, 235, 241, 0.9); font-size: 0.94rem; font-weight: 600; cursor: pointer;"
          >
            <input
              id="include-example-prompts"
              data-testid="include-example-prompts-checkbox"
              type="checkbox"
              bind:checked={includeExamplePrompts}
              style={checkboxStyle}
            />
            Include example prompts in a "My Prompts" folder.
          </label>

          <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 4px;">
            <button
              type="button"
              style={`${getActionButtonStyle('secondary', false)}; width: auto; min-width: 124px;`}
              onclick={handleCancelSetup}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="setup-workspace-button"
              style={`${getActionButtonStyle('primary', false)}; width: auto; min-width: 170px;`}
              onclick={handleSetupWorkspace}
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
      <div data-testid="existing-workspace-dialog" style={dialogStyle}>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800;">Workspace already exists</h2>
            <p style="margin: 10px 0 0; color: rgba(214, 217, 224, 0.66); font-size: 0.95rem; line-height: 1.6; font-weight: 600;">
              This folder already has a Cthulhu Prompt workspace. Would you like to select it?
            </p>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 4px;">
            <button
              type="button"
              data-testid="cancel-existing-workspace-button"
              style={`${getActionButtonStyle('secondary', false)}; width: auto; min-width: 124px;`}
              onclick={handleCancelExistingWorkspace}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="select-existing-workspace-button"
              style={`${getActionButtonStyle('primary', false)}; width: auto; min-width: 170px;`}
              onclick={handleSelectExistingWorkspace}
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
      <div style={`${dialogStyle}; border-color: rgba(247, 117, 117, 0.22);`}>
        <div style="display: flex; flex-direction: column; gap: 18px;">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div
              style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: rgba(247, 117, 117, 0.12); color: #ffbcbc; border: 1px solid rgba(247, 117, 117, 0.18); flex: 0 0 auto;"
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffd6d6;">
                Invalid workspace folder
              </h2>
              <p style="margin: 10px 0 0; color: rgba(255, 220, 220, 0.76); font-size: 0.95rem; line-height: 1.6; font-weight: 600;">
                Choose a folder inside a drive, not the drive root.
              </p>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button
              type="button"
              style={`${getActionButtonStyle('danger', false)}; width: auto; min-width: 108px;`}
              onclick={() => (showRootPathDialog = false)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
