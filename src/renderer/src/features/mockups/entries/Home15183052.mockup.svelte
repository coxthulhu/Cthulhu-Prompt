<script lang="ts">
  import {
    CheckCircle2,
    FileText,
    FolderOpen,
    FolderPlus,
    FolderTree,
    Sparkles,
    X
  } from 'lucide-svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let {
    workspacePath = 'C:\\Users\\Dana\\Documents\\Cthulhu Prompt',
    isWorkspaceReady = true,
    isWorkspaceLoading = false,
    promptCount = 248,
    promptFolderCount = 19,
    onWorkspaceSelect = async () => ({ success: true } as WorkspaceSelectionResult),
    onWorkspaceCreate = async () => ({ success: true } as WorkspaceCreationResult),
    onWorkspaceClear = () => {}
  } = $props<{
    workspacePath?: string | null
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    promptCount?: number
    promptFolderCount?: number
    onWorkspaceSelect?: (path: string) => Promise<WorkspaceSelectionResult>
    onWorkspaceCreate?: (
      path: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
    onWorkspaceClear?: () => void
  }>()

  let isOpeningWorkspaceFolderDialog = $state(false)
  let showSetupDialog = $state(false)
  let showExistingWorkspaceDialog = $state(false)
  let selectedFolderPath: string | null = $state(null)
  let showRootPathDialog = $state(false)
  let includeExamplePrompts = $state(true)
  let activeWorkspaceAction = $state<'select' | 'create' | null>(null)

  const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value)

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

  const cardStyle =
    'border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 32px; background: linear-gradient(180deg, rgba(31, 34, 43, 0.98) 0%, rgba(18, 20, 27, 0.98) 100%); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const panelStyle =
    'border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 24px; background: rgba(10, 12, 18, 0.78); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);'
  const metricStyle =
    'border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 22px; background: linear-gradient(180deg, rgba(16, 18, 25, 0.95) 0%, rgba(11, 13, 18, 0.95) 100%); padding: 20px; display: grid; gap: 10px; min-height: 128px;'
  const secondaryLabelStyle =
    'font-size: 12px; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: rgba(161, 161, 170, 0.88);'
  const metricValueStyle =
    'font-size: clamp(2rem, 4vw, 3.1rem); line-height: 0.95; font-weight: 700; color: #f4f4f5;'
  const iconBadgeStyle =
    'display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.22); background: rgba(139, 92, 246, 0.14); color: #c4b5fd;'
  const buttonBaseStyle =
    'display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 56px; border-radius: 20px; padding: 0 20px; font-size: 0.95rem; font-weight: 650; letter-spacing: 0.01em; transition: 160ms ease;'

  const getButtonStyle = (variant: 'violet' | 'neutral' | 'danger', disabled: boolean) => {
    if (variant === 'violet') {
      return `${buttonBaseStyle} border: 1px solid ${
        disabled ? 'rgba(139, 92, 246, 0.16)' : 'rgba(139, 92, 246, 0.38)'
      }; background: ${
        disabled
          ? 'rgba(139, 92, 246, 0.12)'
          : 'linear-gradient(180deg, rgba(139, 92, 246, 0.28) 0%, rgba(109, 40, 217, 0.2) 100%)'
      }; color: ${
        disabled ? 'rgba(233, 213, 255, 0.55)' : '#f5f3ff'
      }; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); cursor: ${disabled ? 'default' : 'pointer'};`
    }

    if (variant === 'danger') {
      return `${buttonBaseStyle} border: 1px solid rgba(248, 113, 113, 0.22); background: rgba(127, 29, 29, 0.2); color: ${
        disabled ? 'rgba(254, 202, 202, 0.55)' : '#fecaca'
      }; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); cursor: ${disabled ? 'default' : 'pointer'};`
    }

    return `${buttonBaseStyle} border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); color: ${
      disabled ? 'rgba(244, 244, 245, 0.45)' : '#f4f4f5'
    }; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); cursor: ${disabled ? 'default' : 'pointer'};`
  }
</script>

<main
  data-testid="home-screen"
  style="flex: 1; min-height: 0; overflow: auto; padding: 32px 24px 40px;"
>
  <div style="min-height: 100%; display: flex; align-items: center; justify-content: center;">
    <div style="width: min(100%, 1040px); display: grid; gap: 24px;">
      <section style={`${cardStyle} padding: clamp(24px, 4vw, 38px); display: grid; gap: 24px;`}>
        <div
          style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;"
        >
          <div style="display: grid; gap: 12px; min-width: 0;">
            <div
              style="display: inline-flex; align-items: center; gap: 10px; width: fit-content; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); color: rgba(228, 228, 231, 0.94); font-size: 0.78rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase;"
            >
              <Sparkles size={14} />
              Home
            </div>
            <h1
              data-testid="home-title"
              style="margin: 0; font-size: clamp(2.7rem, 8vw, 4.8rem); line-height: 0.95; letter-spacing: 0.08em; font-weight: 700; color: #fafafa;"
            >
              CTHULHU PROMPT
            </h1>
          </div>

          {#if isWorkspaceReady}
            <div
              style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 18px; border: 1px solid rgba(167, 243, 208, 0.12); background: rgba(6, 78, 59, 0.2); color: #d1fae5; font-size: 0.92rem; font-weight: 650;"
            >
              <CheckCircle2 size={18} />
              <span data-testid="workspace-ready-title">Workspace Ready</span>
            </div>
          {/if}
        </div>

        <div
          style="display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));"
        >
          <section style={`${panelStyle} padding: 22px; display: grid; gap: 18px; min-width: 0;`}>
            <div
              style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;"
            >
              <div style="display: grid; gap: 12px; min-width: 0; flex: 1;">
                <div style={secondaryLabelStyle}>Workspace</div>

                {#if isWorkspaceReady}
                  <div
                    style="border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 22px; background: rgba(255, 255, 255, 0.03); padding: 18px 18px 16px; display: grid; gap: 10px; min-width: 0;"
                  >
                    <div
                      style="font-size: 1rem; font-weight: 650; color: rgba(250, 250, 250, 0.96);"
                    >
                      Current Workspace
                    </div>
                    <div
                      data-testid="workspace-ready-path"
                      title={workspacePath ?? undefined}
                      style="font-size: 0.95rem; font-weight: 500; color: rgba(212, 212, 216, 0.84); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      {workspacePath}
                    </div>
                  </div>
                {:else}
                  <div
                    style="border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 22px; background: rgba(255, 255, 255, 0.03); padding: 18px; display: grid; gap: 10px;"
                  >
                    <div
                      style="font-size: 1rem; font-weight: 650; color: rgba(250, 250, 250, 0.96);"
                    >
                      No Workspace Selected
                    </div>
                    <div style="font-size: 0.95rem; color: rgba(161, 161, 170, 0.84);">
                      Select Workspace Folder
                    </div>
                  </div>
                {/if}
              </div>

              <div style={`${iconBadgeStyle} flex: none;`}>
                <FolderTree size={20} />
              </div>
            </div>

            <div
              style="display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));"
            >
              <div style={metricStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  <div style={secondaryLabelStyle}>Prompts</div>
                  <FileText size={18} color="rgba(196, 181, 253, 0.92)" />
                </div>
                <div style={metricValueStyle}>
                  {isWorkspaceReady ? formatCount(promptCount) : '0'}
                </div>
              </div>

              <div style={metricStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  <div style={secondaryLabelStyle}>Folders</div>
                  <FolderTree size={18} color="rgba(196, 181, 253, 0.92)" />
                </div>
                <div style={metricValueStyle}>
                  {isWorkspaceReady ? formatCount(promptFolderCount) : '0'}
                </div>
              </div>
            </div>
          </section>

          <section
            style={`${panelStyle} padding: 22px; display: grid; gap: 16px; align-content: start;`}
          >
            <div style="display: grid; gap: 8px;">
              <div style={secondaryLabelStyle}>Actions</div>
              <div style="font-size: 1rem; font-weight: 650; color: #f4f4f5;">Workspace</div>
            </div>

            <button
              type="button"
              data-testid="select-workspace-folder-button"
              onclick={handleSelectFolder}
              disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
              style={getButtonStyle(
                'violet',
                isWorkspaceLoading || isOpeningWorkspaceFolderDialog
              )}
            >
              <FolderOpen size={18} />
              <span>{getSelectButtonLabel()}</span>
            </button>

            <button
              type="button"
              data-testid="create-workspace-folder-button"
              onclick={handleCreateFolder}
              disabled={isWorkspaceLoading || isOpeningWorkspaceFolderDialog}
              style={getButtonStyle(
                'neutral',
                isWorkspaceLoading || isOpeningWorkspaceFolderDialog
              )}
            >
              <FolderPlus size={18} />
              <span>{getCreateButtonLabel()}</span>
            </button>

            {#if isWorkspaceReady}
              <button
                type="button"
                data-testid="close-workspace-button"
                onclick={onWorkspaceClear}
                style={getButtonStyle('danger', false)}
              >
                <X size={18} />
                <span>Close Workspace</span>
              </button>
            {/if}
          </section>
        </div>
      </section>
    </div>
  </div>

  {#if showSetupDialog}
    <div
      role="dialog"
      aria-modal="true"
      style="position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 24px; background: rgba(3, 4, 6, 0.7); backdrop-filter: blur(14px);"
    >
      <div style={`${cardStyle} width: min(100%, 520px); padding: 26px; display: grid; gap: 20px;`}>
        <div style="display: grid; gap: 10px;">
          <div style="font-size: 1.2rem; font-weight: 700; color: #fafafa;">Setup Workspace</div>
          <div style="font-size: 0.95rem; line-height: 1.6; color: rgba(212, 212, 216, 0.84);">
            This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up? This
            will create the necessary files and subfolders.
          </div>
        </div>

        <label
          for="include-example-prompts"
          style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); color: #f4f4f5; font-size: 0.94rem; font-weight: 550;"
        >
          <input
            id="include-example-prompts"
            data-testid="include-example-prompts-checkbox"
            type="checkbox"
            bind:checked={includeExamplePrompts}
            style="width: 18px; height: 18px; accent-color: #8b5cf6;"
          />
          <span>Include example prompts in a "My Prompts" folder.</span>
        </label>

        <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
          <button
            type="button"
            onclick={handleCancelSetup}
            style={`${getButtonStyle('neutral', false)} width: auto; min-width: 120px;`}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="setup-workspace-button"
            onclick={handleSetupWorkspace}
            style={`${getButtonStyle('violet', false)} width: auto; min-width: 160px;`}
          >
            Setup Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div
      role="dialog"
      aria-modal="true"
      style="position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 24px; background: rgba(3, 4, 6, 0.7); backdrop-filter: blur(14px);"
    >
      <div
        data-testid="existing-workspace-dialog"
        style={`${cardStyle} width: min(100%, 520px); padding: 26px; display: grid; gap: 20px;`}
      >
        <div style="display: grid; gap: 10px;">
          <div style="font-size: 1.2rem; font-weight: 700; color: #fafafa;">
            Workspace already exists
          </div>
          <div style="font-size: 0.95rem; line-height: 1.6; color: rgba(212, 212, 216, 0.84);">
            This folder already has a Cthulhu Prompt workspace. Would you like to select it?
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
          <button
            type="button"
            data-testid="cancel-existing-workspace-button"
            onclick={handleCancelExistingWorkspace}
            style={`${getButtonStyle('neutral', false)} width: auto; min-width: 120px;`}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="select-existing-workspace-button"
            onclick={handleSelectExistingWorkspace}
            style={`${getButtonStyle('violet', false)} width: auto; min-width: 170px;`}
          >
            Select Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showRootPathDialog}
    <div
      role="dialog"
      aria-modal="true"
      style="position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 24px; background: rgba(3, 4, 6, 0.7); backdrop-filter: blur(14px);"
    >
      <div style={`${cardStyle} width: min(100%, 520px); padding: 26px; display: grid; gap: 20px;`}>
        <div style="display: grid; gap: 10px;">
          <div style="font-size: 1.2rem; font-weight: 700; color: #fafafa;">
            Invalid workspace folder
          </div>
          <div style="font-size: 0.95rem; line-height: 1.6; color: rgba(212, 212, 216, 0.84);">
            {workspaceRootPathErrorMessage}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button
            type="button"
            onclick={() => {
              showRootPathDialog = false
            }}
            style={`${getButtonStyle('violet', false)} width: auto; min-width: 120px;`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
