<script lang="ts">
  import { untrack } from 'svelte'

  type WorkspaceSelectionResult = {
    success: boolean
    reason?: 'workspace-missing'
  }

  type WorkspaceCreationResult = {
    success: boolean
  }

  let {
    workspacePath = 'C:\\Users\\Dev\\Documents\\Cthulhu Prompt',
    isWorkspaceReady = true,
    isWorkspaceLoading = false,
    promptCount = 184,
    promptFolderCount = 12,
    onWorkspaceSelect = async (): Promise<WorkspaceSelectionResult> => ({
      success: true
    }),
    onWorkspaceCreate = async (): Promise<WorkspaceCreationResult> => ({ success: true }),
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

  // Snapshot the initial props so mock interactions can update local preview state independently.
  let localWorkspacePath = $state(untrack(() => workspacePath))
  let localWorkspaceReady = $state(untrack(() => isWorkspaceReady))
  let localPromptCount = $state(untrack(() => promptCount))
  let localPromptFolderCount = $state(untrack(() => promptFolderCount))
  let showSetupDialog = $state(false)
  let showExistingWorkspaceDialog = $state(false)
  let includeExamplePrompts = $state(true)
  let activeWorkspaceAction = $state<'select' | 'create' | null>(null)
  let selectedFolderPath = $state<string | null>(null)

  const existingWorkspacePath = 'C:\\Users\\Dev\\Documents\\Team Prompts'
  const newWorkspacePath = 'C:\\Users\\Dev\\Documents\\New Prompt Workspace'

  const shellButtonStyle = (disabled: boolean, tone: 'default' | 'danger' = 'default') =>
    [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'min-height:52px',
      'padding:0 18px',
      'border-radius:18px',
      `border:1px solid ${
        tone === 'danger' ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.10)'
      }`,
      `background:${tone === 'danger' ? 'rgba(127,29,29,0.28)' : 'rgba(15,18,26,0.96)'}`,
      `color:${tone === 'danger' ? '#fecaca' : '#f4f4f5'}`,
      'font-size:14px',
      'font-weight:600',
      'letter-spacing:0.01em',
      'box-shadow:0 18px 40px rgba(0,0,0,0.26)',
      'cursor:pointer',
      disabled ? 'opacity:0.48' : 'opacity:1',
      disabled ? 'pointer-events:none' : ''
    ].join(';')

  const handleSelectFolder = async () => {
    activeWorkspaceAction = 'select'
    selectedFolderPath = existingWorkspacePath
    showExistingWorkspaceDialog = true
    activeWorkspaceAction = null
  }

  const handleCreateFolder = async () => {
    activeWorkspaceAction = 'create'
    selectedFolderPath = newWorkspacePath
    includeExamplePrompts = true
    showSetupDialog = true
    activeWorkspaceAction = null
  }

  const handleSetupWorkspace = async () => {
    if (!selectedFolderPath) {
      return
    }

    activeWorkspaceAction = 'create'
    const result = await onWorkspaceCreate(selectedFolderPath, includeExamplePrompts)
    if (result.success) {
      localWorkspaceReady = true
      localWorkspacePath = selectedFolderPath
      localPromptFolderCount = includeExamplePrompts ? 1 : 0
      localPromptCount = includeExamplePrompts ? 8 : 0
      showSetupDialog = false
      selectedFolderPath = null
    }
    activeWorkspaceAction = null
  }

  const handleSelectExistingWorkspace = async () => {
    if (!selectedFolderPath) {
      return
    }

    activeWorkspaceAction = 'select'
    const result = await onWorkspaceSelect(selectedFolderPath)
    if (result.success) {
      localWorkspaceReady = true
      localWorkspacePath = selectedFolderPath
      localPromptFolderCount = 12
      localPromptCount = 184
      showExistingWorkspaceDialog = false
      selectedFolderPath = null
    }
    activeWorkspaceAction = null
  }

  const handleClearWorkspace = () => {
    onWorkspaceClear()
    localWorkspaceReady = false
    localWorkspacePath = null
    localPromptFolderCount = 0
    localPromptCount = 0
  }
</script>

<main
  data-testid="home-screen"
  style="min-height:100%;display:flex;align-items:center;justify-content:center;background:#090b10;padding:32px;font-family:'Segoe UI Variable Text','Segoe UI',sans-serif;color:#f4f4f5;"
>
  <div style="width:100%;max-width:1080px;display:flex;flex-direction:column;gap:24px;">
    <section
      style="position:relative;overflow:hidden;border-radius:32px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg, rgba(19,23,34,0.96) 0%, rgba(12,14,20,0.98) 100%);box-shadow:0 40px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04);"
    >
      <div
        style="position:absolute;top:-110px;right:-70px;width:260px;height:260px;border-radius:999px;background:radial-gradient(circle, rgba(139,92,246,0.24) 0%, rgba(139,92,246,0.08) 42%, rgba(139,92,246,0) 72%);pointer-events:none;"
      ></div>

      <div
        style="display:flex;flex-direction:column;gap:22px;padding:28px;position:relative;z-index:1;"
      >
        <div
          style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;"
        >
          <div style="display:flex;flex-direction:column;gap:12px;min-width:0;">
            <div
              style="display:inline-flex;align-items:center;gap:8px;align-self:flex-start;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#a1a1aa;"
            >
              Home
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;min-width:0;">
              <h1
                data-testid="home-title"
                style="margin:0;font-size:clamp(34px, 6vw, 58px);line-height:0.96;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#fafafa;"
              >
                Cthulhu Prompt
              </h1>
              <div
                style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:14px;font-weight:600;color:#d4d4d8;"
              >
                <span
                  data-testid="workspace-ready-title"
                  style={`display:inline-flex;align-items:center;border-radius:999px;padding:8px 12px;border:1px solid ${
                    localWorkspaceReady ? 'rgba(139,92,246,0.28)' : 'rgba(255,255,255,0.08)'
                  };background:${
                    localWorkspaceReady ? 'rgba(109,40,217,0.18)' : 'rgba(255,255,255,0.04)'
                  };color:${localWorkspaceReady ? '#ddd6fe' : '#d4d4d8'};`}
                >
                  {localWorkspaceReady ? 'Workspace Ready' : 'No Workspace'}
                </span>
                {#if localWorkspacePath}
                  <span
                    data-testid="workspace-ready-path"
                    title={localWorkspacePath}
                    style="min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1a1aa;"
                  >
                    {localWorkspacePath}
                  </span>
                {/if}
              </div>
            </div>
          </div>

          {#if localWorkspaceReady}
            <button
              type="button"
              data-testid="close-workspace-button"
              onclick={handleClearWorkspace}
              style={shellButtonStyle(false, 'danger')}
            >
              Close Workspace
            </button>
          {/if}
        </div>

        <div
          style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;"
        >
          <div
            style="border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:rgba(11,14,20,0.92);padding:18px 18px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);"
          >
            <div
              style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;"
            >
              Workspace
            </div>
            <div style="margin-top:14px;font-size:28px;font-weight:750;letter-spacing:-0.03em;">
              {localWorkspaceReady ? 'Open' : 'Closed'}
            </div>
          </div>

          <div
            style="border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:rgba(11,14,20,0.92);padding:18px 18px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);"
          >
            <div
              style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;"
            >
              Prompt Folders
            </div>
            <div style="margin-top:14px;font-size:28px;font-weight:750;letter-spacing:-0.03em;">
              {localPromptFolderCount}
            </div>
          </div>

          <div
            style="border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:rgba(11,14,20,0.92);padding:18px 18px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);"
          >
            <div
              style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;"
            >
              Prompts
            </div>
            <div
              style="margin-top:14px;font-size:28px;font-weight:750;letter-spacing:-0.03em;color:#f5f3ff;"
            >
              {localPromptCount}
            </div>
          </div>
        </div>

        <div
          style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:14px;"
        >
          <div
            style="border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);padding:20px;"
          >
            <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">Workspace</div>
            <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#a1a1aa;">
              {localWorkspaceReady
                ? 'Select a different workspace or close the current one.'
                : 'Select a workspace folder or create a new one.'}
            </div>
          </div>

          <div
            style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;"
          >
            <button
              type="button"
              data-testid="select-workspace-folder-button"
              onclick={handleSelectFolder}
              style={shellButtonStyle(isWorkspaceLoading || activeWorkspaceAction !== null)}
            >
              {isWorkspaceLoading && activeWorkspaceAction === 'select'
                ? 'Loading...'
                : 'Select Workspace Folder'}
            </button>

            <button
              type="button"
              data-testid="create-workspace-folder-button"
              onclick={handleCreateFolder}
              style={shellButtonStyle(isWorkspaceLoading || activeWorkspaceAction !== null)}
            >
              {isWorkspaceLoading && activeWorkspaceAction === 'create'
                ? 'Creating...'
                : 'Create Workspace Folder'}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>

  {#if showSetupDialog}
    <div
      style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(3,4,8,0.72);backdrop-filter:blur(10px);padding:24px;z-index:20;"
    >
      <section
        style="width:min(100%, 520px);border-radius:28px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg, rgba(19,23,34,0.98) 0%, rgba(11,14,20,1) 100%);padding:24px;box-shadow:0 36px 80px rgba(0,0,0,0.48);"
      >
        <h2 style="margin:0;font-size:24px;font-weight:750;letter-spacing:-0.03em;">Setup Workspace</h2>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#a1a1aa;">
          This folder does not have a Cthulhu Prompt workspace.
        </p>
        <div
          style="margin-top:18px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);padding:14px 16px;font-size:13px;color:#d4d4d8;"
        >
          {selectedFolderPath}
        </div>

        <label
          for="include-example-prompts"
          style="margin-top:18px;display:flex;align-items:center;gap:12px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);padding:16px;color:#e4e4e7;"
        >
          <input
            id="include-example-prompts"
            data-testid="include-example-prompts-checkbox"
            type="checkbox"
            bind:checked={includeExamplePrompts}
            style="width:17px;height:17px;accent-color:#8b5cf6;"
          />
          <span style="font-size:14px;font-weight:600;">Include example prompts</span>
        </label>

        <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:12px;">
          <button
            type="button"
            onclick={() => {
              showSetupDialog = false
              selectedFolderPath = null
              includeExamplePrompts = true
            }}
            style={shellButtonStyle(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="setup-workspace-button"
            onclick={handleSetupWorkspace}
            style={[
              shellButtonStyle(false),
              'border-color:rgba(139,92,246,0.24)',
              'background:linear-gradient(180deg, rgba(91,33,182,0.9) 0%, rgba(76,29,149,0.92) 100%)',
              'color:#faf5ff'
            ].join(';')}
          >
            Setup Workspace
          </button>
        </div>
      </section>
    </div>
  {/if}

  {#if showExistingWorkspaceDialog}
    <div
      style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(3,4,8,0.72);backdrop-filter:blur(10px);padding:24px;z-index:20;"
    >
      <section
        data-testid="existing-workspace-dialog"
        style="width:min(100%, 520px);border-radius:28px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg, rgba(19,23,34,0.98) 0%, rgba(11,14,20,1) 100%);padding:24px;box-shadow:0 36px 80px rgba(0,0,0,0.48);"
      >
        <h2 style="margin:0;font-size:24px;font-weight:750;letter-spacing:-0.03em;">
          Workspace already exists
        </h2>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#a1a1aa;">
          Select this workspace folder.
        </p>
        <div
          style="margin-top:18px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);padding:14px 16px;font-size:13px;color:#d4d4d8;"
        >
          {selectedFolderPath}
        </div>

        <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:12px;">
          <button
            type="button"
            data-testid="cancel-existing-workspace-button"
            onclick={() => {
              showExistingWorkspaceDialog = false
              selectedFolderPath = null
            }}
            style={shellButtonStyle(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="select-existing-workspace-button"
            onclick={handleSelectExistingWorkspace}
            style={[
              shellButtonStyle(false),
              'border-color:rgba(139,92,246,0.24)',
              'background:linear-gradient(180deg, rgba(91,33,182,0.9) 0%, rgba(76,29,149,0.92) 100%)',
              'color:#faf5ff'
            ].join(';')}
          >
            Select Workspace
          </button>
        </div>
      </section>
    </div>
  {/if}
</main>
