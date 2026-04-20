<script lang="ts">
  import { AlertCircle, Check, FileText, FolderClosed, FolderOpen, FolderPlus, X } from 'lucide-svelte'

  type DialogState = 'none' | 'setup' | 'existing'

  const workspacePath = 'C:\\Users\\Dev\\Documents\\CthulhuPrompt'

  const shellStyle =
    'display:flex; flex:1 1 auto; min-width:0; overflow-y:auto; padding:24px; color:var(--ui-default-text);'
  const columnStyle =
    'display:flex; flex-direction:column; gap:24px; width:100%; max-width:1080px; min-height:100%; margin:0 auto; justify-content:center;'
  const titleWrapStyle =
    'display:flex; align-items:center; justify-content:center; padding:12px 12px 4px;'
  const titleStyle =
    'margin:0; color:var(--ui-emphasis-text); font-size:clamp(4rem, 9vw, 5.75rem); font-weight:700; letter-spacing:0.16em; line-height:0.92; text-align:center; white-space:nowrap; text-shadow:0 18px 44px rgba(0, 0, 0, 0.34);'
  const cardsStyle =
    'display:grid; gap:18px; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); align-items:stretch;'
  const cardStyle =
    'display:flex; flex-direction:column; gap:18px; min-width:0; border:1px solid var(--ui-raised-border-default); border-radius:32px; padding:22px; background:linear-gradient(180deg, rgba(34, 37, 45, 0.92) 0%, rgba(16, 18, 24, 0.94) 100%); box-shadow:0 26px 68px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04); backdrop-filter:blur(14px);'
  const headerRowStyle =
    'display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;'
  const titleBlockStyle = 'display:flex; flex-direction:column; gap:4px; min-width:0;'
  const cardTitleStyle =
    'margin:0; color:var(--ui-emphasis-text); font-size:1.125rem; font-weight:600; letter-spacing:-0.025em;'
  const cardDescriptionStyle =
    'margin:0; color:var(--ui-muted-text); font-size:0.875rem; line-height:1.55;'
  const statusBadgeBaseStyle =
    'display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; border:1px solid; font-size:0.8125rem; font-weight:600; letter-spacing:0.01em; white-space:nowrap; box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const labelStyle =
    'color:var(--ui-muted-text); font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;'
  const statsGridStyle = 'display:grid; gap:14px; grid-template-columns:repeat(2, minmax(0, 1fr));'
  const statStyle =
    'display:flex; align-items:center; gap:14px; min-width:0; padding:18px; border:1px solid var(--ui-nested-border-default); border-radius:24px; background:rgba(8, 10, 15, 0.72); box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.03);'
  const statIconStyle =
    'display:flex; align-items:center; justify-content:center; flex:0 0 auto; width:48px; height:48px; border-radius:18px; background:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon);'
  const statMetaStyle = 'display:flex; flex-direction:column; gap:6px; min-width:0;'
  const statLabelStyle =
    'color:var(--ui-muted-text); font-size:0.75rem; font-weight:600; line-height:1.05; letter-spacing:0.05em; text-transform:uppercase;'
  const statValueStyle =
    'color:var(--ui-emphasis-text); font-size:1.75rem; font-weight:700; line-height:1; font-variant-numeric:tabular-nums;'
  const actionsStackStyle = 'display:flex; flex-direction:column; gap:12px;'
  const actionButtonBaseStyle =
    'display:flex; align-items:center; justify-content:flex-start; gap:14px; width:100%; min-height:58px; padding:0 18px; border-radius:22px; border:1px solid; font-size:0.95rem; font-weight:600; letter-spacing:-0.01em; box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const overlayStyle =
    'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(0, 0, 0, 0.54); backdrop-filter:blur(10px); z-index:20;'
  const modalStyle =
    'display:flex; flex-direction:column; gap:20px; width:min(100%, 520px); border:1px solid var(--ui-raised-border-default); border-radius:30px; padding:24px; background:linear-gradient(180deg, rgba(27, 30, 38, 0.98) 0%, rgba(14, 16, 22, 0.98) 100%); box-shadow:0 28px 72px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const footerStyle = 'display:flex; justify-content:flex-end; gap:12px; flex-wrap:wrap;'
  const secondaryModalButtonStyle =
    'display:inline-flex; align-items:center; justify-content:center; min-height:46px; padding:0 18px; border-radius:18px; border:1px solid var(--ui-border-default); background:rgba(255, 255, 255, 0.05); color:var(--ui-default-text); font-size:0.9rem; font-weight:600;'
  const primaryModalButtonStyle =
    'display:inline-flex; align-items:center; justify-content:center; min-height:46px; padding:0 18px; border-radius:18px; border:1px solid var(--ui-accent-border); background:rgba(139, 92, 246, 0.18); color:var(--ui-accent-text); font-size:0.9rem; font-weight:600; box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);'
  const checkboxRowStyle =
    'display:flex; align-items:flex-start; gap:12px; padding:16px 18px; border:1px solid var(--ui-nested-border-default); border-radius:22px; background:rgba(9, 11, 16, 0.78);'

  let isWorkspaceReady = $state(true)
  let includeExamplePrompts = $state(true)
  let dialogState = $state<DialogState>('none')

  const displayedWorkspacePath = $derived(
    isWorkspaceReady ? workspacePath : 'No workspace selected'
  )
  const promptCount = $derived(isWorkspaceReady ? '128' : '0')
  const promptFolderCount = $derived(isWorkspaceReady ? '14' : '0')

  const handleSelectWorkspace = () => {
    if (isWorkspaceReady) {
      dialogState = 'existing'
      return
    }

    isWorkspaceReady = true
    dialogState = 'none'
  }

  const handleCreateWorkspace = () => {
    dialogState = 'setup'
  }

  const handleCloseWorkspace = () => {
    isWorkspaceReady = false
    dialogState = 'none'
  }

  const handleSetupWorkspace = () => {
    isWorkspaceReady = true
    dialogState = 'none'
  }

  const handleSelectExistingWorkspace = () => {
    isWorkspaceReady = true
    dialogState = 'none'
  }

  const handleCancelDialog = () => {
    dialogState = 'none'
  }
</script>

{#snippet statCard(label, value, Icon)}
  <div style={statStyle}>
    <div style={statIconStyle}>
      <Icon size={18} />
    </div>

    <div style={statMetaStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  </div>
{/snippet}

{#snippet actionButton(text, Icon, tone, onclick, testId)}
  <button
    type="button"
    data-testid={testId}
    style={`${actionButtonBaseStyle} ${tone}`}
    {onclick}
  >
    <span
      style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:14px; background:rgba(255, 255, 255, 0.06); color:inherit; flex:0 0 auto;"
    >
      <Icon size={18} />
    </span>
    <span>{text}</span>
  </button>
{/snippet}

<main style={shellStyle} data-testid="home-screen">
  <div style={columnStyle}>
    <div style={titleWrapStyle}>
      <h1 style={titleStyle} data-testid="home-title">CTHULHU PROMPT</h1>
    </div>

    <div style={cardsStyle}>
      <section style={cardStyle}>
        <div style={headerRowStyle}>
          <div style={titleBlockStyle}>
            <h2 style={cardTitleStyle}>Current Workspace</h2>
            <p style={cardDescriptionStyle}>Information about your current workspace.</p>
          </div>

          <div
            style={`${statusBadgeBaseStyle} ${
              isWorkspaceReady
                ? 'background:var(--ui-success-surface); border-color:var(--ui-success-border); color:var(--ui-success-text);'
                : 'background:var(--ui-accent-surface-default); border-color:var(--ui-accent-border); color:var(--ui-accent-icon);'
            }`}
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

        <div
          style="display:flex; align-items:center; gap:12px; width:100%; min-width:0; padding:16px 18px; border:1px solid var(--ui-nested-border-default); border-radius:24px; background:rgba(8, 10, 15, 0.78);"
        >
          <div
            style="display:flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:16px; background:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon); flex:0 0 auto;"
          >
            {#if isWorkspaceReady}
              <Check size={18} />
            {:else}
              <AlertCircle size={18} />
            {/if}
          </div>

          <div style="display:flex; flex-direction:column; gap:4px; min-width:0;">
            <div style={labelStyle}>Workspace Path</div>
            <div
              data-testid={isWorkspaceReady ? 'workspace-ready-path' : undefined}
              style="color:var(--ui-default-text); font-size:0.875rem; font-weight:500; line-height:1.45; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
              title={displayedWorkspacePath}
            >
              {displayedWorkspacePath}
            </div>
          </div>
        </div>

        <div style={statsGridStyle}>
          {@render statCard('Prompts', promptCount, FileText)}
          {@render statCard('Prompt Folders', promptFolderCount, FolderClosed)}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={headerRowStyle}>
          <div style={titleBlockStyle}>
            <h2 style={cardTitleStyle}>Workspace Actions</h2>
            <p style={cardDescriptionStyle}>Change your current workspace.</p>
          </div>

          <div
            style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:20px; background:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon);"
          >
            {#if isWorkspaceReady}
              <FolderOpen size={20} />
            {:else}
              <FolderPlus size={20} />
            {/if}
          </div>
        </div>

        <div style={actionsStackStyle}>
          {@render actionButton(
            'Open Workspace Folder',
            FolderOpen,
            'border-color:var(--ui-accent-border); background:rgba(139, 92, 246, 0.16); color:var(--ui-accent-text);',
            handleSelectWorkspace,
            'select-workspace-folder-button'
          )}

          {@render actionButton(
            'Create Workspace Folder',
            FolderPlus,
            'border-color:var(--ui-border-default); background:rgba(255, 255, 255, 0.05); color:var(--ui-default-text);',
            handleCreateWorkspace,
            'create-workspace-folder-button'
          )}

          {#if isWorkspaceReady}
            {@render actionButton(
              'Close Workspace',
              X,
              'border-color:rgba(255, 99, 71, 0.28); background:rgba(255, 99, 71, 0.12); color:var(--ui-default-text);',
              handleCloseWorkspace,
              'close-workspace-button'
            )}
          {/if}
        </div>
      </section>
    </div>
  </div>

  {#if dialogState !== 'none'}
    <div style={overlayStyle}>
      {#if dialogState === 'setup'}
        <section style={modalStyle}>
          <div style={titleBlockStyle}>
            <h2 style="margin:0; color:var(--ui-emphasis-text); font-size:1.35rem; font-weight:700;">
              Setup Workspace
            </h2>
            <p style={cardDescriptionStyle}>
              This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
              This will create the necessary files and subfolders.
            </p>
          </div>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              data-testid="include-example-prompts-checkbox"
              bind:checked={includeExamplePrompts}
              style="margin-top:2px; width:18px; height:18px; accent-color:rgb(139, 92, 246);"
            />
            <span style="color:var(--ui-default-text); font-size:0.9rem; line-height:1.55;">
              Include example prompts in a "My Prompts" folder.
            </span>
          </label>

          <div style={footerStyle}>
            <button type="button" style={secondaryModalButtonStyle} onclick={handleCancelDialog}>
              Cancel
            </button>
            <button
              type="button"
              data-testid="setup-workspace-button"
              style={primaryModalButtonStyle}
              onclick={handleSetupWorkspace}
            >
              Setup Workspace
            </button>
          </div>
        </section>
      {:else if dialogState === 'existing'}
        <section style={modalStyle} data-testid="existing-workspace-dialog">
          <div style={titleBlockStyle}>
            <h2 style="margin:0; color:var(--ui-emphasis-text); font-size:1.35rem; font-weight:700;">
              Workspace already exists
            </h2>
            <p style={cardDescriptionStyle}>
              This folder already has a Cthulhu Prompt workspace. Would you like to select it?
            </p>
          </div>

          <div style={footerStyle}>
            <button
              type="button"
              data-testid="cancel-existing-workspace-button"
              style={secondaryModalButtonStyle}
              onclick={handleCancelDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="select-existing-workspace-button"
              style={primaryModalButtonStyle}
              onclick={handleSelectExistingWorkspace}
            >
              Select Workspace
            </button>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</main>
