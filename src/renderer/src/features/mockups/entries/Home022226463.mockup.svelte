<script lang="ts">
  import {
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    X
  } from 'lucide-svelte'

  const workspaceName = 'Cthulhu Prompt Workspace'
  const workspacePath = 'C:\\Users\\dmin\\Documents\\Prompts\\Cthulhu Prompt Workspace'
  const promptCount = '128'
  const folderCount = '18'

  const shellStyle =
    'box-sizing:border-box;width:100%;min-height:calc(100vh - 7rem);display:flex;align-items:center;justify-content:center;padding:1.5rem;color:var(--ui-normal-text);font-family:Aptos,"Segoe UI Variable","Segoe UI",sans-serif;'
  const layoutStyle =
    'box-sizing:border-box;width:100%;max-width:72rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:1rem;align-items:stretch;'
  const mastheadStyle =
    'box-sizing:border-box;grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem;align-items:end;border:1px solid var(--ui-card-normal-border);background:linear-gradient(135deg,var(--ui-card-normal-surface-gradient-start),var(--ui-neutral-muted-surface));box-shadow:0 1.2rem 3rem var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:1.2rem 1.35rem;border-radius:8px;'
  const labelStyle =
    'margin:0 0 0.45rem 0;color:var(--ui-muted-text);font-size:0.72rem;font-weight:700;letter-spacing:0;text-transform:uppercase;'
  const titleStyle =
    'margin:0;color:var(--ui-normal-text);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:clamp(2rem,5.2vw,4.6rem);font-weight:750;line-height:0.92;letter-spacing:0;'
  const statusStyle =
    'display:inline-flex;align-items:center;gap:0.55rem;white-space:nowrap;border:1px solid var(--ui-success-normal-border);background:var(--ui-success-normal-surface);color:var(--ui-success-normal-text);border-radius:999px;padding:0.56rem 0.78rem;font-size:0.88rem;font-weight:700;'
  const heroCardStyle =
    'box-sizing:border-box;min-width:0;display:grid;grid-template-rows:auto 1fr auto;gap:1rem;border:1px solid var(--ui-neutral-normal-border);background:linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-card-solid-surface));box-shadow:0 1rem 2rem var(--ui-shadow-raised),inset 0 0 0 1px var(--ui-card-nested-border);border-radius:8px;padding:1rem;'
  const sideStackStyle = 'min-width:0;display:grid;grid-template-rows:auto 1fr;gap:1rem;'
  const sectionTitleStyle =
    'margin:0;color:var(--ui-normal-text);font-size:1.05rem;font-weight:750;letter-spacing:0;'
  const sectionDescriptionStyle =
    'margin:0.2rem 0 0;color:var(--ui-muted-text);font-size:0.9rem;line-height:1.35;'
  const fieldStyle =
    'min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;border:1px solid var(--ui-card-nested-border);background:var(--ui-card-nested-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);border-radius:6px;padding:0.9rem;'
  const fieldLabelStyle =
    'margin:0 0 0.22rem;color:var(--ui-muted-text);font-size:0.74rem;font-weight:700;letter-spacing:0;text-transform:uppercase;'
  const fieldValueStyle =
    'min-width:0;margin:0;color:var(--ui-normal-text);font-size:0.98rem;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const iconBoxStyle =
    'width:2.35rem;height:2.35rem;display:grid;place-items:center;border:1px solid var(--ui-accent-icon-ring);background:var(--ui-accent-icon-surface);color:var(--ui-accent-icon-glyph);border-radius:6px;'
  const statsGridStyle = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.8rem;'
  const statCardStyle =
    'min-width:0;border:1px solid var(--ui-neutral-muted-border);background:linear-gradient(160deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));border-radius:6px;padding:0.9rem;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);'
  const statTopStyle =
    'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;color:var(--ui-secondary-text);'
  const statNumberStyle =
    'margin:0.55rem 0 0;color:var(--ui-normal-text);font-size:2rem;font-weight:760;line-height:1;letter-spacing:0;'
  const actionPanelStyle =
    'box-sizing:border-box;min-width:0;border:1px solid var(--ui-card-normal-border);background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 1rem 2rem var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);border-radius:8px;padding:1rem;'
  const actionListStyle = 'display:grid;gap:0.75rem;margin-top:1rem;'
  const actionButtonStyle =
    'box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;text-align:left;border:1px solid var(--ui-neutral-hover-border);background:var(--ui-neutral-normal-surface);color:var(--ui-normal-text);border-radius:6px;padding:0.85rem 0.95rem;font:inherit;'
  const accentActionButtonStyle =
    'box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;text-align:left;border:1px solid var(--ui-accent-hover-border);background:linear-gradient(135deg,var(--ui-accent-hover-surface),var(--ui-accent-normal-surface));color:var(--ui-accent-normal-text);border-radius:6px;padding:0.85rem 0.95rem;font:inherit;'
  const dangerActionButtonStyle =
    'box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:0.85rem;align-items:center;text-align:left;border:1px solid var(--ui-danger-hover-border);background:var(--ui-danger-normal-surface);color:var(--ui-normal-text);border-radius:6px;padding:0.85rem 0.95rem;font:inherit;'
  const buttonTitleStyle =
    'display:block;min-width:0;color:inherit;font-size:0.96rem;font-weight:730;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const buttonDescriptionStyle =
    'display:block;margin-top:0.18rem;color:var(--ui-muted-text);font-size:0.82rem;line-height:1.3;'
  const railStyle =
    'box-sizing:border-box;min-width:0;border:1px solid var(--ui-neutral-muted-border);background:var(--ui-neutral-muted-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);border-radius:8px;padding:1rem;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;'
  const compactPathStyle =
    'margin:0;color:var(--ui-secondary-text);font-family:"Cascadia Code",Consolas,monospace;font-size:0.78rem;line-height:1.45;overflow-wrap:anywhere;'
</script>

<main data-testid="home-screen" style={shellStyle}>
  <section style={layoutStyle}>
    <header style={mastheadStyle}>
      <div style="min-width:0;">
        <p style={labelStyle}>Current Workspace</p>
        <h1 style={titleStyle}>CTHULHU PROMPT</h1>
      </div>
      <div style={statusStyle}>
        <Check size={18} strokeWidth={2.2} />
        <span>Workspace Ready</span>
      </div>
    </header>

    <article style={heroCardStyle}>
      <div>
        <h2 style={sectionTitleStyle}>Current Workspace</h2>
        <p style={sectionDescriptionStyle}>Information about your current workspace.</p>
      </div>

      <div style="display:grid;gap:0.8rem;align-content:start;">
        <div style={fieldStyle}>
          <div style={iconBoxStyle}>
            <FolderClosed size={20} strokeWidth={1.9} />
          </div>
          <div style="min-width:0;">
            <p style={fieldLabelStyle}>Workspace Name</p>
            <p style={fieldValueStyle} title={workspaceName}>{workspaceName}</p>
          </div>
        </div>

        <div style={fieldStyle}>
          <div style={iconBoxStyle}>
            <FolderOpen size={20} strokeWidth={1.9} />
          </div>
          <div style="min-width:0;">
            <p style={fieldLabelStyle}>Workspace Path</p>
            <p data-testid="workspace-ready-path" style={fieldValueStyle} title={workspacePath}>
              {workspacePath}
            </p>
          </div>
        </div>
      </div>

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statTopStyle}>
            <span style={fieldLabelStyle}>Prompts</span>
            <FileText size={18} strokeWidth={1.9} />
          </div>
          <p style={statNumberStyle}>{promptCount}</p>
        </div>

        <div style={statCardStyle}>
          <div style={statTopStyle}>
            <span style={fieldLabelStyle}>Prompt Folders</span>
            <Folders size={18} strokeWidth={1.9} />
          </div>
          <p style={statNumberStyle}>{folderCount}</p>
        </div>
      </div>
    </article>

    <div style={sideStackStyle}>
      <aside style={actionPanelStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Workspace Actions</h2>
          <p style={sectionDescriptionStyle}>Change your current workspace.</p>
        </div>

        <div style={actionListStyle}>
          <button data-testid="select-workspace-folder-button" type="button" style={actionButtonStyle}>
            <FolderOpen size={20} strokeWidth={1.9} />
            <span style="min-width:0;">
              <span style={buttonTitleStyle}>Open Workspace Folder</span>
              <span style={buttonDescriptionStyle}>Select an existing workspace folder.</span>
            </span>
          </button>

          <button data-testid="create-workspace-folder-button" type="button" style={accentActionButtonStyle}>
            <FolderPlus size={20} strokeWidth={1.9} />
            <span style="min-width:0;">
              <span style={buttonTitleStyle}>Create Workspace Folder</span>
              <span style={buttonDescriptionStyle}>
                Choose a folder and set up a new workspace folder.
              </span>
            </span>
          </button>

          <button data-testid="close-workspace-button" type="button" style={dangerActionButtonStyle}>
            <X size={20} strokeWidth={1.9} />
            <span style="min-width:0;">
              <span style={buttonTitleStyle}>Close Workspace</span>
              <span style={buttonDescriptionStyle}>Unload the current workspace folder.</span>
            </span>
          </button>
        </div>
      </aside>

      <aside style={railStyle}>
        <div>
          <p style={labelStyle}>Workspace Name</p>
          <p style="margin:0;color:var(--ui-normal-text);font-size:1.2rem;font-weight:760;line-height:1.2;">
            {workspaceName}
          </p>
        </div>
        <div>
          <p style={labelStyle}>Workspace Path</p>
          <p style={compactPathStyle}>{workspacePath}</p>
        </div>
      </aside>
    </div>
  </section>
</main>
