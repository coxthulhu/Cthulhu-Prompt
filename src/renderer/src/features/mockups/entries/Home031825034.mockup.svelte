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
  const workspacePath = 'C:\\Users\\dmin\\Documents\\Prompts\\Cthulhu Prompt Workspace'

  const workspaceFields = [
    { label: 'Workspace Name', value: workspaceName, icon: FolderClosed },
    { label: 'Workspace Path', value: workspacePath, icon: FolderOpen }
  ]

  const stats = [
    { label: 'Prompts', value: '128', icon: FileText },
    { label: 'Prompt Folders', value: '18', icon: Folders }
  ]

  const actions = [
    {
      label: 'Open Workspace Folder',
      description: 'Select an existing workspace folder.',
      icon: FolderOpen,
      testId: 'select-workspace-folder-button',
      tone: 'neutral'
    },
    {
      label: 'Create Workspace Folder',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      testId: 'create-workspace-folder-button',
      tone: 'accent'
    },
    {
      label: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      testId: 'close-workspace-button',
      tone: 'danger'
    }
  ]

  const shellStyle =
    'box-sizing:border-box;min-width:0;width:100%;min-height:42rem;padding:1.5rem;color:var(--ui-normal-text);font-family:Aptos,"Segoe UI Variable","Segoe UI",sans-serif;'
  const layoutStyle =
    'box-sizing:border-box;width:min(100%,78rem);min-height:100%;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr));gap:1rem;align-items:stretch;'
  const headerStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:end;padding:0 0 1rem;border-bottom:1px solid var(--ui-neutral-muted-border);'
  const titleStyle =
    'margin:0;color:var(--ui-normal-text);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:clamp(2.6rem,6vw,5.8rem);font-weight:800;letter-spacing:0;line-height:0.88;text-transform:uppercase;'
  const statusStyle =
    'display:inline-flex;align-items:center;gap:0.5rem;white-space:nowrap;border:1px solid var(--ui-success-normal-border);border-radius:0.45rem;background:var(--ui-success-normal-surface);color:var(--ui-success-normal-text);padding:0.55rem 0.7rem;font-size:0.82rem;font-weight:750;'
  const workspaceShellStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-rows:auto 1fr;gap:1rem;'
  const workspaceCardStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-rows:auto 1fr auto;gap:1rem;border:1px solid var(--ui-card-normal-border);border-radius:0.5rem;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 1.15rem 2.7rem var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:1rem;'
  const panelTitleStyle =
    'margin:0;color:var(--ui-normal-text);font-size:1.18rem;font-weight:760;line-height:1.2;letter-spacing:0;'
  const panelDescriptionStyle =
    'margin:0.25rem 0 0;color:var(--ui-muted-text);font-size:0.9rem;line-height:1.35;'
  const fieldRailStyle =
    'display:grid;gap:0.75rem;align-content:start;'
  const fieldStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;border:1px solid var(--ui-neutral-muted-border);border-radius:0.45rem;background:var(--ui-neutral-muted-surface);padding:0.95rem;'
  const fieldIconStyle =
    'display:grid;width:2.25rem;height:2.25rem;place-items:center;border:1px solid var(--ui-accent-icon-ring);border-radius:0.38rem;background:var(--ui-accent-icon-surface);color:var(--ui-accent-icon-glyph);'
  const labelStyle =
    'display:block;margin:0;color:var(--ui-muted-text);font-size:0.74rem;font-weight:750;letter-spacing:0;text-transform:uppercase;'
  const valueStyle =
    'display:block;margin:0.2rem 0 0;min-width:0;color:var(--ui-normal-text);font-size:0.98rem;font-weight:650;line-height:1.32;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const statsStyle =
    'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.75rem;'
  const statStyle =
    'box-sizing:border-box;min-width:0;min-height:7rem;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;border:1px solid var(--ui-card-nested-border);border-radius:0.45rem;background:linear-gradient(145deg,var(--ui-card-nested-surface),var(--ui-neutral-normal-surface));box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:0.9rem;'
  const statTopStyle =
    'display:flex;align-items:center;justify-content:space-between;gap:0.7rem;color:var(--ui-secondary-text);'
  const statValueStyle =
    'margin:0;color:var(--ui-normal-text);font-size:2.5rem;font-weight:780;line-height:1;letter-spacing:0;'
  const summaryStripStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;border:1px solid var(--ui-info-normal-border);border-radius:0.5rem;background:var(--ui-info-normal-surface);padding:0.95rem;'
  const sideStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-rows:auto 1fr;gap:1rem;'
  const actionPanelStyle =
    'box-sizing:border-box;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:0.5rem;background:linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));box-shadow:0 1.15rem 2.7rem var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:1rem;'
  const actionListStyle = 'display:grid;gap:0.7rem;margin-top:1rem;'
  const actionIconStyle =
    'display:grid;width:2.15rem;height:2.15rem;place-items:center;border-radius:0.38rem;background:var(--ui-neutral-muted-surface);'
  const actionLabelStyle =
    'display:block;min-width:0;color:var(--ui-normal-text);font-size:0.96rem;font-weight:750;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const actionDescriptionStyle =
    'display:block;margin-top:0.16rem;color:var(--ui-muted-text);font-size:0.8rem;line-height:1.35;'
  const pathPanelStyle =
    'box-sizing:border-box;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;border:1px solid var(--ui-neutral-muted-border);border-radius:0.5rem;background:var(--ui-card-solid-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:1rem;'
  const pathValueStyle =
    'margin:0.35rem 0 0;color:var(--ui-secondary-text);font-family:"Cascadia Code",Consolas,monospace;font-size:0.8rem;line-height:1.45;overflow-wrap:anywhere;'

  const actionButtonStyle = (tone: string) => {
    const border =
      tone === 'accent'
        ? 'var(--ui-accent-normal-border)'
        : tone === 'danger'
          ? 'var(--ui-danger-normal-border)'
          : 'var(--ui-neutral-normal-border)'
    const background =
      tone === 'accent'
        ? 'var(--ui-accent-normal-surface)'
        : tone === 'danger'
          ? 'var(--ui-danger-normal-surface)'
          : 'var(--ui-neutral-normal-surface)'

    return `appearance:none;box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:0.85rem;align-items:center;border:1px solid ${border};border-radius:0.45rem;background:${background};color:var(--ui-normal-text);font:inherit;text-align:left;padding:0.9rem;cursor:default;`
  }
</script>

<main data-testid="home-screen" style={shellStyle}>
  <section style={layoutStyle}>
    <div style={workspaceShellStyle}>
      <header style={headerStyle}>
        <h1 data-testid="home-title" style={titleStyle}>CTHULHU PROMPT</h1>
        <div style={statusStyle}>
          <Check size={16} strokeWidth={2.4} />
          <span>Workspace Ready</span>
        </div>
      </header>

      <section style={workspaceCardStyle}>
        <div>
          <h2 style={panelTitleStyle}>Current Workspace</h2>
          <p style={panelDescriptionStyle}>Information about your current workspace.</p>
        </div>

        <div style={fieldRailStyle}>
          {#each workspaceFields as field (field.label)}
            {@const Icon = field.icon}
            <div style={fieldStyle}>
              <span style={fieldIconStyle}>
                <Icon size={18} strokeWidth={2.1} />
              </span>
              <span style="min-width:0;">
                <span style={labelStyle}>{field.label}</span>
                <span
                  data-testid={field.label === 'Workspace Path' ? 'workspace-ready-path' : undefined}
                  title={field.value}
                  style={valueStyle}
                >
                  {field.value}
                </span>
              </span>
            </div>
          {/each}
        </div>

        <div style={statsStyle}>
          {#each stats as stat (stat.label)}
            {@const Icon = stat.icon}
            <div style={statStyle}>
              <div style={statTopStyle}>
                <span style={labelStyle}>{stat.label}</span>
                <Icon size={17} color="var(--ui-accent-icon-glyph)" strokeWidth={2.2} />
              </div>
              <p style={statValueStyle}>{stat.value}</p>
            </div>
          {/each}
        </div>
      </section>

      <section style={summaryStripStyle}>
        <span style={fieldIconStyle}>
          <FolderClosed size={18} strokeWidth={2.1} />
        </span>
        <span style="min-width:0;">
          <span style={labelStyle}>Workspace Name</span>
          <span style={valueStyle}>{workspaceName}</span>
        </span>
      </section>
    </div>

    <aside style={sideStyle}>
      <section style={actionPanelStyle}>
        <div>
          <h2 style={panelTitleStyle}>Workspace Actions</h2>
          <p style={panelDescriptionStyle}>Change your current workspace.</p>
        </div>

        <div style={actionListStyle}>
          {#each actions as action (action.label)}
            {@const Icon = action.icon}
            <button data-testid={action.testId} type="button" style={actionButtonStyle(action.tone)}>
              <span style={actionIconStyle}>
                <Icon size={17} strokeWidth={2.15} />
              </span>
              <span style="min-width:0;">
                <span style={actionLabelStyle}>{action.label}</span>
                <span style={actionDescriptionStyle}>{action.description}</span>
              </span>
              <ChevronRight size={17} color="var(--ui-muted-text)" strokeWidth={2.25} />
            </button>
          {/each}
        </div>
      </section>

      <section style={pathPanelStyle}>
        <div>
          <p style={labelStyle}>Workspace Path</p>
          <p style={pathValueStyle}>{workspacePath}</p>
        </div>
        <div style={statusStyle}>
          <Check size={16} strokeWidth={2.4} />
          <span>Workspace Ready</span>
        </div>
      </section>
    </aside>
  </section>
</main>
