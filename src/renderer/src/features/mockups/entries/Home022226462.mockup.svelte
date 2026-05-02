<script lang="ts">
  import {
    Check,
    ChevronRight,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    X
  } from 'lucide-svelte'

  const workspaceName = 'Cthulhu Prompt Workspace'
  const workspacePath = 'C:\\Users\\DMin\\Documents\\CthulhuPrompt'
  const promptCount = '128'
  const promptFolderCount = '14'

  const shellStyle = [
    'box-sizing: border-box',
    'width: 100%',
    'min-height: 42rem',
    'padding: 1.25rem',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'color: var(--ui-normal-text)',
    "font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif"
  ].join('; ')

  const frameStyle = [
    'width: min(100%, 72rem)',
    'display: grid',
    'grid-template-columns: minmax(0, 1.45fr) minmax(20rem, 0.75fr)',
    'gap: 1rem',
    'align-items: stretch'
  ].join('; ')

  const workspacePanelStyle = [
    'min-width: 0',
    'border: 1px solid var(--ui-card-normal-border)',
    'border-radius: 8px',
    'background: linear-gradient(135deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
    'box-shadow: 0 24px 60px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
    'overflow: hidden'
  ].join('; ')

  const workspacePanelInnerStyle = [
    'display: grid',
    'grid-template-columns: minmax(0, 1fr) 13rem',
    'min-height: 31rem'
  ].join('; ')

  const workspaceContentStyle = [
    'min-width: 0',
    'padding: 2rem',
    'display: flex',
    'flex-direction: column',
    'gap: 1.4rem'
  ].join('; ')

  const titleStyle = [
    'margin: 0',
    'font-size: clamp(2.75rem, 6vw, 5.4rem)',
    'line-height: 0.92',
    'letter-spacing: 0',
    'font-weight: 750',
    'font-family: ui-monospace, SFMono-Regular, Consolas, monospace',
    'overflow-wrap: anywhere'
  ].join('; ')

  const sectionLabelStyle = [
    'margin: 0',
    'font-size: 0.78rem',
    'line-height: 1',
    'font-weight: 700',
    'letter-spacing: 0',
    'text-transform: uppercase',
    'color: var(--ui-secondary-text)'
  ].join('; ')

  const fieldGridStyle = [
    'display: grid',
    'grid-template-columns: minmax(0, 1fr)',
    'gap: 0.7rem'
  ].join('; ')

  const fieldStyle = [
    'min-width: 0',
    'display: grid',
    'grid-template-columns: 2.4rem minmax(0, 1fr)',
    'gap: 0.85rem',
    'align-items: center',
    'padding: 0.85rem',
    'border: 1px solid var(--ui-neutral-muted-border)',
    'border-radius: 8px',
    'background: var(--ui-neutral-muted-surface)',
    'box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight)'
  ].join('; ')

  const fieldIconStyle = [
    'width: 2.4rem',
    'height: 2.4rem',
    'border-radius: 8px',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'border: 1px solid var(--ui-neutral-normal-border)',
    'background: var(--ui-card-solid-surface)',
    'color: var(--ui-hoverable-text)'
  ].join('; ')

  const fieldLabelStyle = [
    'display: block',
    'font-size: 0.72rem',
    'line-height: 1.1',
    'font-weight: 700',
    'letter-spacing: 0',
    'text-transform: uppercase',
    'color: var(--ui-muted-text)',
    'margin-bottom: 0.3rem'
  ].join('; ')

  const fieldValueStyle = [
    'display: block',
    'min-width: 0',
    'font-size: 0.95rem',
    'line-height: 1.25',
    'font-weight: 600',
    'color: var(--ui-normal-text)',
    'white-space: nowrap',
    'overflow: hidden',
    'text-overflow: ellipsis'
  ].join('; ')

  const statRailStyle = [
    'border-left: 1px solid var(--ui-card-normal-border)',
    'background: color-mix(in oklch, var(--ui-card-nested-surface) 72%, transparent)',
    'padding: 1rem',
    'display: grid',
    'grid-template-rows: 1fr 1fr',
    'gap: 1rem'
  ].join('; ')

  const statCardStyle = [
    'min-width: 0',
    'border: 1px solid var(--ui-neutral-normal-border)',
    'border-radius: 8px',
    'background: linear-gradient(180deg, var(--ui-neutral-normal-surface), var(--ui-neutral-muted-surface))',
    'padding: 1rem',
    'display: flex',
    'flex-direction: column',
    'justify-content: space-between',
    'box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight)'
  ].join('; ')

  const statIconStyle = [
    'width: 2.25rem',
    'height: 2.25rem',
    'border-radius: 8px',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'border: 1px solid var(--ui-accent-normal-border)',
    'background: var(--ui-accent-icon-surface)',
    'color: var(--ui-accent-icon-glyph)'
  ].join('; ')

  const statValueStyle = [
    'margin: 0',
    'font-size: 3.1rem',
    'line-height: 0.9',
    'font-weight: 760',
    'letter-spacing: 0',
    'color: var(--ui-normal-text)'
  ].join('; ')

  const statLabelStyle = [
    'margin: 0.45rem 0 0',
    'font-size: 0.8rem',
    'line-height: 1.15',
    'font-weight: 650',
    'color: var(--ui-secondary-text)'
  ].join('; ')

  const actionsPanelStyle = [
    'min-width: 0',
    'border: 1px solid var(--ui-card-normal-border)',
    'border-radius: 8px',
    'background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-neutral-muted-surface))',
    'box-shadow: 0 18px 48px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
    'padding: 1rem',
    'display: flex',
    'flex-direction: column',
    'gap: 1rem'
  ].join('; ')

  const statusStyle = [
    'display: flex',
    'align-items: center',
    'gap: 0.65rem',
    'padding: 0.85rem',
    'border: 1px solid var(--ui-success-normal-border)',
    'border-radius: 8px',
    'background: var(--ui-success-normal-surface)',
    'color: var(--ui-success-normal-text)',
    'font-size: 0.9rem',
    'font-weight: 700'
  ].join('; ')

  const actionStackStyle = ['display: flex', 'flex-direction: column', 'gap: 0.7rem'].join('; ')

  const actionButtonStyle = [
    'width: 100%',
    'min-width: 0',
    'appearance: none',
    'border: 1px solid var(--ui-neutral-normal-border)',
    'border-radius: 8px',
    'background: var(--ui-neutral-normal-surface)',
    'color: var(--ui-normal-text)',
    'padding: 0.85rem',
    'display: grid',
    'grid-template-columns: 2.25rem minmax(0, 1fr) 1.25rem',
    'gap: 0.75rem',
    'align-items: center',
    'text-align: left',
    'font: inherit',
    'box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight)'
  ].join('; ')

  const accentActionButtonStyle = [
    actionButtonStyle,
    'border-color: var(--ui-accent-normal-border)',
    'background: var(--ui-accent-normal-surface)'
  ].join('; ')

  const dangerActionButtonStyle = [
    actionButtonStyle,
    'border-color: var(--ui-danger-normal-border)',
    'background: var(--ui-danger-normal-surface)'
  ].join('; ')

  const actionIconStyle = [
    'width: 2.25rem',
    'height: 2.25rem',
    'border-radius: 8px',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'background: var(--ui-card-solid-surface)',
    'border: 1px solid var(--ui-neutral-muted-border)',
    'color: var(--ui-hoverable-text)'
  ].join('; ')

  const actionTitleStyle = [
    'display: block',
    'font-size: 0.93rem',
    'line-height: 1.2',
    'font-weight: 750',
    'white-space: nowrap',
    'overflow: hidden',
    'text-overflow: ellipsis'
  ].join('; ')

  const actionDescriptionStyle = [
    'display: block',
    'margin-top: 0.24rem',
    'font-size: 0.78rem',
    'line-height: 1.25',
    'font-weight: 500',
    'color: var(--ui-secondary-text)'
  ].join('; ')

  const iconSize = 18
</script>

<main style={shellStyle} data-testid="home-screen">
  <section style={frameStyle}>
    <article style={workspacePanelStyle}>
      <div style={workspacePanelInnerStyle}>
        <div style={workspaceContentStyle}>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem">
            <p style={sectionLabelStyle}>Current Workspace</p>
            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--ui-success-normal-text); font-size: 0.82rem; font-weight: 700">
              <Check size={16} />
              <span data-testid="workspace-ready-title">Workspace Ready</span>
            </div>
          </div>

          <h1 style={titleStyle}>CTHULHU PROMPT</h1>

          <div style={fieldGridStyle}>
            <div style={fieldStyle}>
              <span style={fieldIconStyle}>
                <FolderClosed size={iconSize} />
              </span>
              <span style="min-width: 0">
                <span style={fieldLabelStyle}>Workspace Name</span>
                <span style={fieldValueStyle} title={workspaceName}>{workspaceName}</span>
              </span>
            </div>

            <div style={fieldStyle}>
              <span style={fieldIconStyle}>
                <FolderOpen size={iconSize} />
              </span>
              <span style="min-width: 0">
                <span style={fieldLabelStyle}>Workspace Path</span>
                <span style={fieldValueStyle} title={workspacePath} data-testid="workspace-ready-path">
                  {workspacePath}
                </span>
              </span>
            </div>
          </div>
        </div>

        <aside style={statRailStyle} aria-label="Workspace statistics">
          <div style={statCardStyle}>
            <span style={statIconStyle}>
              <FileText size={iconSize} />
            </span>
            <div>
              <p style={statValueStyle}>{promptCount}</p>
              <p style={statLabelStyle}>Prompts</p>
            </div>
          </div>

          <div style={statCardStyle}>
            <span style={statIconStyle}>
              <Folders size={iconSize} />
            </span>
            <div>
              <p style={statValueStyle}>{promptFolderCount}</p>
              <p style={statLabelStyle}>Prompt Folders</p>
            </div>
          </div>
        </aside>
      </div>
    </article>

    <aside style={actionsPanelStyle}>
      <div style="display: flex; flex-direction: column; gap: 0.7rem">
        <p style={sectionLabelStyle}>Workspace Actions</p>
        <div style={statusStyle}>
          <Check size={17} />
          <span>Workspace Ready</span>
        </div>
      </div>

      <div style={actionStackStyle}>
        <button type="button" style={actionButtonStyle} data-testid="select-workspace-folder-button">
          <span style={actionIconStyle}>
            <FolderOpen size={iconSize} />
          </span>
          <span style="min-width: 0">
            <span style={actionTitleStyle}>Open Workspace Folder</span>
            <span style={actionDescriptionStyle}>Select an existing workspace folder.</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <button type="button" style={accentActionButtonStyle} data-testid="create-workspace-folder-button">
          <span style={actionIconStyle}>
            <FolderPlus size={iconSize} />
          </span>
          <span style="min-width: 0">
            <span style={actionTitleStyle}>Create Workspace Folder</span>
            <span style={actionDescriptionStyle}>Choose a folder and set up a new workspace folder.</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <button type="button" style={dangerActionButtonStyle} data-testid="close-workspace-button">
          <span style={actionIconStyle}>
            <X size={iconSize} />
          </span>
          <span style="min-width: 0">
            <span style={actionTitleStyle}>Close Workspace</span>
            <span style={actionDescriptionStyle}>Unload the current workspace folder.</span>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
    </aside>
  </section>
</main>
