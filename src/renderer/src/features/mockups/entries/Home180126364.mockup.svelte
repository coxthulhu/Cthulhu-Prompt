<script lang="ts">
  import type { ComponentType } from 'svelte'
  import {
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    Home,
    X
  } from 'lucide-svelte'

  type WorkspaceField = {
    id: string
    label: string
    value: string
    icon: ComponentType
  }

  type WorkspaceStat = {
    id: string
    label: string
    value: string
    icon: ComponentType
  }

  type WorkspaceAction = {
    id: string
    label: string
    description: string
    icon: ComponentType
    variant: 'neutral' | 'accent' | 'danger'
  }

  const workspaceFields: WorkspaceField[] = [
    {
      id: 'workspace-name',
      label: 'Workspace Name',
      value: 'Cthulhu Prompt Lab',
      icon: FolderClosed
    },
    {
      id: 'workspace-path',
      label: 'Workspace Path',
      value: 'C:\\Source\\PromptApps\\CthulhuPromptWorkspace',
      icon: FolderOpen
    }
  ]

  const workspaceStats: WorkspaceStat[] = [
    {
      id: 'prompts',
      label: 'Prompts',
      value: '42',
      icon: FileText
    },
    {
      id: 'prompt-folders',
      label: 'Prompt Folders',
      value: '6',
      icon: Folders
    }
  ]

  const workspaceActions: WorkspaceAction[] = [
    {
      id: 'open-workspace',
      label: 'Open Workspace',
      description: 'Select an existing workspace file.',
      icon: FolderOpen,
      variant: 'neutral'
    },
    {
      id: 'create-workspace',
      label: 'Create Workspace',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      variant: 'accent'
    },
    {
      id: 'close-workspace',
      label: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      variant: 'danger'
    }
  ]

  let hoveredFieldId = $state<string | null>(null)
  let hoveredStatId = $state<string | null>(null)
  let hoveredActionId = $state<string | null>(null)

  const headerBarStyle =
    'height:36px; flex-shrink:0; display:flex; align-items:center; border-bottom:1px solid var(--ui-neutral-muted-border); background:#121316; padding:0 24px;'
  const contentStyle =
    'flex:1; min-height:0; overflow:auto; padding:24px; display:flex; justify-content:center;'
  const pageShellStyle =
    'width:100%; max-width:1080px; min-width:0; display:grid; align-content:start; gap:24px;'
  const sectionHeaderStyle =
    'display:grid; gap:8px; border-left:3px solid var(--ui-accent-normal-border); padding-left:16px; min-width:0;'
  const panelStyle =
    'border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(to bottom, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:var(--cthulhu-ui-shadow-card); padding:10px; min-width:0;'
  const panelBodyStyle =
    'display:grid; gap:14px; min-width:0; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface); box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding:14px;'
  const cardTitleRowStyle =
    'display:flex; align-items:flex-start; justify-content:space-between; gap:14px; min-width:0;'
  const iconTileStyle =
    'height:36px; width:36px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; border-radius:7px; color:var(--ui-accent-icon-glyph); background:var(--ui-accent-normal-surface); border:1px solid var(--ui-accent-icon-ring);'
  const labelStyle =
    'color:var(--ui-muted-text); font-size:11px; font-weight:760; line-height:14px; letter-spacing:0.08em; text-transform:uppercase;'
  const fieldValueStyle =
    'min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-normal-text); font-size:14px; font-weight:620; line-height:20px;'
  const metadataGridStyle =
    'display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; min-width:0;'
  const statGridStyle =
    'display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; min-width:0;'
  const actionGridStyle = 'display:grid; gap:10px; min-width:0;'

  const getRaisedTileStyle = (isHovered: boolean) =>
    [
      'display:grid',
      'grid-template-columns:36px minmax(0, 1fr)',
      'align-items:center',
      'gap:12px',
      'min-width:0',
      'border-radius:7px',
      'border:1px solid',
      `border-color:${isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}`,
      `background:${isHovered ? 'var(--ui-neutral-hover-surface)' : 'oklch(1 0 0 / 7%)'}`,
      'box-shadow:0 14px 30px oklch(0 0 0 / 20%), inset 0 1px 0 oklch(1 0 0 / 10%)',
      'padding:12px',
      'transition:border-color 150ms ease, background-color 150ms ease, transform 150ms ease, box-shadow 150ms ease',
      `transform:${isHovered ? 'translateY(-1px)' : 'translateY(0)'}`,
      `color:${isHovered ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}`
    ].join(';')

  const getStatTileStyle = (isHovered: boolean) =>
    [
      getRaisedTileStyle(isHovered),
      'grid-template-columns:minmax(0, 1fr) 40px',
      `background:${isHovered ? 'var(--ui-accent-hover-surface)' : 'oklch(0.827 0.108 306.383 / 10%)'}`,
      `border-color:${isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}`,
      'padding:13px'
    ].join(';')

  const getActionStyle = (action: WorkspaceAction, isHovered: boolean) => {
    const variantStyles = {
      neutral: {
        background: isHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)',
        border: isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)',
        iconBackground: 'var(--ui-neutral-emphasis-surface)',
        iconColor: 'var(--ui-normal-text)'
      },
      accent: {
        background: isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)',
        border: isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)',
        iconBackground: 'var(--ui-accent-normal-surface)',
        iconColor: 'var(--ui-accent-icon-glyph)'
      },
      danger: {
        background: isHovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-normal-surface)',
        border: isHovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)',
        iconBackground: 'var(--ui-danger-icon-surface)',
        iconColor: 'var(--ui-danger-icon-glyph)'
      }
    }[action.variant]

    return {
      button: [
        'width:100%',
        'min-width:0',
        'display:grid',
        'grid-template-columns:42px minmax(0, 1fr)',
        'align-items:center',
        'gap:12px',
        'border-radius:7px',
        'border:1px solid',
        `border-color:${variantStyles.border}`,
        `background:${variantStyles.background}`,
        'box-shadow:var(--cthulhu-ui-shadow-surface-highlight)',
        'padding:10px',
        'text-align:left',
        'cursor:pointer',
        'transition:border-color 150ms ease, background-color 150ms ease, transform 150ms ease',
        `transform:${isHovered ? 'translateY(-1px)' : 'translateY(0)'}`
      ].join(';'),
      icon: [
        'height:42px',
        'width:42px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'border-radius:7px',
        `background:${variantStyles.iconBackground}`,
        `color:${variantStyles.iconColor}`,
        'box-shadow:inset 0 1px 0 oklch(1 0 0 / 10%)'
      ].join(';')
    }
  }
</script>

<main style="display:flex; min-width:0; min-height:0; flex:1; flex-direction:column;" data-testid="home-screen-mockup">
  <div style={headerBarStyle}>
    <div style="display:flex; min-width:0; align-items:center; color:var(--ui-muted-text); font-size:14px; font-weight:560;">
      <button
        type="button"
        style="display:inline-flex; min-width:0; cursor:pointer; align-items:center; gap:8px; color:var(--ui-muted-text); transition:color 150ms ease;"
        onmouseenter={(event) => {
          event.currentTarget.style.color = 'var(--ui-secondary-text)'
        }}
        onmouseleave={(event) => {
          event.currentTarget.style.color = 'var(--ui-muted-text)'
        }}
      >
        <Home style="height:15px; width:15px; flex:0 0 auto;" />
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Home</span>
      </button>
      <span style="margin:0 10px; color:oklch(1 0 0 / 28%);">/</span>
      <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-secondary-text);">
        Workspace
      </span>
    </div>
  </div>

  <div style={contentStyle}>
    <section style={pageShellStyle}>
      <div style={sectionHeaderStyle}>
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <span style={iconTileStyle}>
            <Home style="height:18px; width:18px;" />
          </span>
          <h1 style="margin:0; min-width:0; color:var(--ui-normal-text); font-size:24px; font-weight:760; line-height:32px;">
            CTHULHU PROMPT
          </h1>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; align-items:start; min-width:0;">
        <section style={panelStyle}>
          <div style={panelBodyStyle}>
            <div style={cardTitleRowStyle}>
              <div style="display:grid; gap:4px; min-width:0;">
                <h2 style="margin:0; color:var(--ui-normal-text); font-size:18px; font-weight:760; line-height:24px;">
                  Current Workspace
                </h2>
                <p style="margin:0; color:var(--ui-muted-text); font-size:13px; line-height:18px;">
                  Information about your current workspace.
                </p>
              </div>
            </div>

            <div style={metadataGridStyle}>
              {#each workspaceFields as field (field.id)}
                {@const FieldIcon = field.icon}
                <div
                  role="group"
                  style={getRaisedTileStyle(hoveredFieldId === field.id)}
                  title={field.value}
                  onmouseenter={() => {
                    hoveredFieldId = field.id
                  }}
                  onmouseleave={() => {
                    hoveredFieldId = null
                  }}
                >
                  <span style={iconTileStyle}>
                    <FieldIcon style="height:17px; width:17px;" />
                  </span>
                  <div style="display:grid; gap:4px; min-width:0;">
                    <div style={labelStyle}>{field.label}</div>
                    <div style={fieldValueStyle}>{field.value}</div>
                  </div>
                </div>
              {/each}
            </div>

            <div style={statGridStyle}>
              {#each workspaceStats as stat (stat.id)}
                {@const StatIcon = stat.icon}
                <div
                  role="group"
                  style={getStatTileStyle(hoveredStatId === stat.id)}
                  onmouseenter={() => {
                    hoveredStatId = stat.id
                  }}
                  onmouseleave={() => {
                    hoveredStatId = null
                  }}
                >
                  <div style="display:grid; gap:6px; min-width:0;">
                    <div style={labelStyle}>{stat.label}</div>
                    <div style="color:var(--ui-normal-text); font-size:32px; font-weight:780; font-variant-numeric:tabular-nums; line-height:34px;">
                      {stat.value}
                    </div>
                  </div>
                  <span style={iconTileStyle}>
                    <StatIcon style="height:18px; width:18px;" />
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelBodyStyle}>
            <div style={cardTitleRowStyle}>
              <div style="display:grid; gap:4px; min-width:0;">
                <h2 style="margin:0; color:var(--ui-normal-text); font-size:18px; font-weight:760; line-height:24px;">
                  Workspace Actions
                </h2>
                <p style="margin:0; color:var(--ui-muted-text); font-size:13px; line-height:18px;">
                  Change your current workspace.
                </p>
              </div>
              <span style="display:inline-flex; flex:0 0 auto; align-items:center; gap:7px; border:1px solid var(--ui-success-normal-border); border-radius:999px; background:var(--ui-success-normal-surface); color:var(--ui-success-normal-text); padding:6px 10px; font-size:12px; font-weight:720; line-height:14px;">
                <Check style="height:14px; width:14px;" />
                Workspace Ready
              </span>
            </div>

            <div style={actionGridStyle}>
              {#each workspaceActions as action (action.id)}
                {@const actionStyles = getActionStyle(action, hoveredActionId === action.id)}
                {@const ActionIcon = action.icon}
                <button
                  type="button"
                  style={actionStyles.button}
                  onmouseenter={() => {
                    hoveredActionId = action.id
                  }}
                  onmouseleave={() => {
                    hoveredActionId = null
                  }}
                >
                  <span style={actionStyles.icon}>
                    <ActionIcon style="height:20px; width:20px;" />
                  </span>
                  <span style="display:grid; gap:3px; min-width:0;">
                    <span style="min-width:0; color:var(--ui-normal-text); font-size:15px; font-weight:760; line-height:20px;">
                      {action.label}
                    </span>
                    <span style="min-width:0; color:var(--ui-secondary-text); font-size:13px; font-weight:500; line-height:18px;">
                      {action.description}
                    </span>
                  </span>
                </button>
              {/each}
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
