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
  import type { ComponentType } from 'svelte'

  type HoverTarget = string | null

  type WorkspaceField = {
    id: string
    label: string
    text: string
    icon: ComponentType
  }

  type WorkspaceStat = {
    id: string
    label: string
    text: string
    icon: ComponentType
  }

  type WorkspaceAction = {
    id: string
    text: string
    description: string
    icon: ComponentType
    variant: 'neutral' | 'accent' | 'danger'
  }

  const workspaceFields: WorkspaceField[] = [
    {
      id: 'name',
      label: 'Workspace Name',
      text: 'Arcane Coding Prompts',
      icon: FolderClosed
    },
    {
      id: 'path',
      label: 'Workspace Path',
      text: 'C:\\Users\\Dana\\Documents\\AI Prompts\\Arcane Coding Prompts',
      icon: FolderOpen
    }
  ]

  const workspaceStats: WorkspaceStat[] = [
    {
      id: 'prompts',
      label: 'Prompts',
      text: '42',
      icon: FileText
    },
    {
      id: 'folders',
      label: 'Prompt Folders',
      text: '8',
      icon: Folders
    }
  ]

  const workspaceActions: WorkspaceAction[] = [
    {
      id: 'open',
      text: 'Open Workspace',
      description: 'Select an existing workspace file.',
      icon: FolderOpen,
      variant: 'neutral'
    },
    {
      id: 'create',
      text: 'Create Workspace',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      variant: 'accent'
    },
    {
      id: 'close',
      text: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      variant: 'danger'
    }
  ]

  let hoveredAction: HoverTarget = $state(null)
  let hoveredField: HoverTarget = $state(null)
  let hoveredStat: HoverTarget = $state(null)

  const pageStyle = [
    'box-sizing:border-box',
    'display:flex',
    'flex:1 1 auto',
    'min-width:0',
    'overflow-y:auto',
    'padding:24px'
  ].join(';')

  const frameStyle = [
    'align-content:start',
    'box-sizing:border-box',
    'display:grid',
    'gap:22px',
    'margin:0 auto',
    'max-width:1120px',
    'min-height:100%',
    'min-width:0',
    'width:100%'
  ].join(';')

  const headerBarStyle = [
    'align-items:center',
    'border:1px solid var(--ui-neutral-muted-border)',
    'border-radius:7px',
    'box-shadow:0 12px 30px oklch(0 0 0 / 16%)',
    'box-sizing:border-box',
    'display:flex',
    'gap:8px',
    'justify-content:space-between',
    'min-width:0',
    'padding:9px 12px'
  ].join(';')

  const breadcrumbStyle = [
    'align-items:center',
    'color:var(--ui-muted-text)',
    'display:flex',
    'font-size:13px',
    'font-weight:650',
    'gap:9px',
    'line-height:18px',
    'min-width:0'
  ].join(';')

  const breadcrumbCurrentStyle = [
    'color:var(--ui-normal-text)',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')

  const readyBadgeStyle = [
    'align-items:center',
    'background:linear-gradient(180deg,var(--ui-success-normal-surface),oklch(0.627 0.17 149.214 / 12%))',
    'border:1px solid var(--ui-success-normal-border)',
    'border-radius:999px',
    'box-shadow:0 1px 0 oklch(1 0 0 / 7%) inset,0 12px 24px oklch(0 0 0 / 16%)',
    'color:var(--ui-success-normal-text)',
    'display:flex',
    'flex:0 0 auto',
    'font-size:12px',
    'font-weight:760',
    'gap:7px',
    'line-height:16px',
    'padding:6px 10px'
  ].join(';')

  const titleRowStyle = [
    'border-left:3px solid var(--ui-accent-normal-border)',
    'display:grid',
    'gap:8px',
    'min-width:0',
    'padding-left:16px'
  ].join(';')

  const titleLineStyle = [
    'align-items:center',
    'display:flex',
    'gap:10px',
    'min-width:0'
  ].join(';')

  const titleIconStyle = [
    'align-items:center',
    'background:linear-gradient(180deg,var(--ui-accent-normal-fill),var(--ui-accent-normal-surface))',
    'border:1px solid var(--ui-accent-normal-border)',
    'border-radius:7px',
    'box-shadow:0 1px 0 oklch(1 0 0 / 10%) inset,0 10px 26px oklch(0 0 0 / 18%)',
    'color:var(--ui-accent-icon-glyph)',
    'display:flex',
    'flex:0 0 auto',
    'height:34px',
    'justify-content:center',
    'width:34px'
  ].join(';')

  const titleStyle = [
    'color:var(--ui-normal-text)',
    'font-size:24px',
    'font-weight:760',
    'letter-spacing:0',
    'line-height:32px',
    'margin:0',
    'min-width:0'
  ].join(';')

  const descriptionStyle = [
    'color:var(--ui-muted-text)',
    'font-size:14px',
    'font-weight:500',
    'line-height:20px',
    'margin:0'
  ].join(';')

  const contentGridStyle = [
    'align-items:start',
    'display:grid',
    'gap:16px',
    'grid-template-columns:repeat(auto-fit,minmax(310px,1fr))',
    'min-width:0'
  ].join(';')

  const panelStyle = [
    'background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end))',
    'border:1px solid var(--ui-card-normal-border)',
    'border-radius:8px',
    'box-shadow:0 18px 46px var(--ui-card-normal-shadow),0 1px 0 oklch(1 0 0 / 7%) inset',
    'box-sizing:border-box',
    'display:grid',
    'gap:14px',
    'min-width:0',
    'padding:10px'
  ].join(';')

  const sectionHeaderStyle = [
    'align-items:start',
    'display:flex',
    'gap:12px',
    'min-width:0',
    'padding:4px 4px 2px'
  ].join(';')

  const sectionIconStyle = [
    'align-items:center',
    'background:var(--ui-neutral-normal-surface)',
    'border:1px solid var(--ui-neutral-normal-border)',
    'border-radius:7px',
    'box-shadow:0 1px 0 oklch(1 0 0 / 7%) inset',
    'color:var(--ui-normal-text)',
    'display:flex',
    'flex:0 0 auto',
    'height:36px',
    'justify-content:center',
    'width:36px'
  ].join(';')

  const sectionTitleStyle = [
    'color:var(--ui-normal-text)',
    'font-size:16px',
    'font-weight:760',
    'letter-spacing:0',
    'line-height:22px',
    'margin:0'
  ].join(';')

  const sectionDescriptionStyle = [
    'color:var(--ui-secondary-text)',
    'font-size:13px',
    'font-weight:500',
    'line-height:18px',
    'margin:2px 0 0'
  ].join(';')

  const groupStyle = [
    'display:grid',
    'gap:10px',
    'min-width:0'
  ].join(';')

  const statGridStyle = [
    'display:grid',
    'gap:10px',
    'grid-template-columns:repeat(2,minmax(0,1fr))',
    'min-width:0'
  ].join(';')

  const fieldStyle = (isHovered: boolean) =>
    [
      'align-items:center',
      `background:${isHovered ? 'oklch(1 0 0 / 10%)' : 'oklch(1 0 0 / 7%)'}`,
      `border:1px solid ${isHovered ? 'var(--ui-neutral-focus-border)' : 'var(--ui-neutral-normal-border)'}`,
      'border-radius:7px',
      `box-shadow:${isHovered ? '0 16px 32px oklch(0 0 0 / 26%),0 1px 0 oklch(1 0 0 / 12%) inset' : '0 10px 26px oklch(0 0 0 / 20%),0 1px 0 oklch(1 0 0 / 9%) inset'}`,
      'box-sizing:border-box',
      'display:grid',
      'gap:12px',
      'grid-template-columns:42px minmax(0,1fr)',
      'min-width:0',
      'padding:11px',
      'transform:translateY(-1px)',
      'transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease'
    ].join(';')

  const statStyle = (isHovered: boolean) =>
    [
      `background:${isHovered ? 'linear-gradient(180deg,oklch(0.666 0.181 254.617 / 18%),oklch(1 0 0 / 8%))' : 'linear-gradient(180deg,oklch(1 0 0 / 9%),oklch(1 0 0 / 6%))'}`,
      `border:1px solid ${isHovered ? 'var(--ui-info-normal-border)' : 'var(--ui-neutral-normal-border)'}`,
      'border-radius:7px',
      `box-shadow:${isHovered ? '0 18px 34px oklch(0 0 0 / 28%),0 1px 0 oklch(1 0 0 / 13%) inset' : '0 12px 28px oklch(0 0 0 / 22%),0 1px 0 oklch(1 0 0 / 10%) inset'}`,
      'box-sizing:border-box',
      'display:grid',
      'gap:12px',
      'min-height:116px',
      'min-width:0',
      'padding:13px',
      `transform:${isHovered ? 'translateY(-3px)' : 'translateY(-1px)'}`,
      'transition:background 140ms ease,border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease'
    ].join(';')

  const fieldIconStyle = (isHovered: boolean) =>
    [
      'align-items:center',
      `background:${isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
      `border:1px solid ${isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}`,
      'border-radius:7px',
      `box-shadow:${isHovered ? '0 0 0 4px var(--ui-accent-icon-ring),0 1px 0 oklch(1 0 0 / 12%) inset' : '0 1px 0 oklch(1 0 0 / 10%) inset'}`,
      'color:var(--ui-accent-icon-glyph)',
      'display:flex',
      'height:42px',
      'justify-content:center',
      'transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease',
      'width:42px'
    ].join(';')

  const labelStyle = [
    'color:var(--ui-muted-text)',
    'font-size:11px',
    'font-weight:760',
    'letter-spacing:0.08em',
    'line-height:14px',
    'text-transform:uppercase'
  ].join(';')

  const valueStyle = [
    'color:var(--ui-normal-text)',
    'font-size:14px',
    'font-weight:600',
    'line-height:20px',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')

  const statIconRowStyle = [
    'align-items:center',
    'display:flex',
    'justify-content:space-between',
    'min-width:0'
  ].join(';')

  const statIconStyle = [
    'align-items:center',
    'background:var(--ui-info-normal-surface)',
    'border:1px solid var(--ui-info-normal-border)',
    'border-radius:7px',
    'box-shadow:0 1px 0 oklch(1 0 0 / 10%) inset',
    'color:var(--ui-normal-text)',
    'display:flex',
    'height:34px',
    'justify-content:center',
    'width:34px'
  ].join(';')

  const statValueStyle = [
    'color:var(--ui-normal-text)',
    'font-size:36px',
    'font-variant-numeric:tabular-nums',
    'font-weight:780',
    'letter-spacing:0',
    'line-height:38px',
    'margin:0'
  ].join(';')

  const actionButtonStyle = (variant: WorkspaceAction['variant'], isHovered: boolean) => {
    const variantSurface = {
      neutral: {
        normal: 'var(--ui-neutral-normal-surface)',
        hover: 'var(--ui-neutral-hover-surface)',
        border: 'var(--ui-neutral-normal-border)',
        hoverBorder: 'var(--ui-neutral-hover-border)',
        icon: 'var(--ui-neutral-emphasis-surface)',
        iconBorder: 'var(--ui-neutral-emphasis-border)',
        text: 'var(--ui-normal-text)'
      },
      accent: {
        normal: 'var(--ui-accent-normal-surface)',
        hover: 'var(--ui-accent-hover-surface)',
        border: 'var(--ui-accent-normal-border)',
        hoverBorder: 'var(--ui-accent-hover-border)',
        icon: 'var(--ui-accent-normal-fill)',
        iconBorder: 'var(--ui-accent-normal-border)',
        text: 'var(--ui-accent-normal-text)'
      },
      danger: {
        normal: 'var(--ui-danger-normal-surface)',
        hover: 'var(--ui-danger-hover-surface)',
        border: 'var(--ui-danger-normal-border)',
        hoverBorder: 'var(--ui-danger-hover-border)',
        icon: 'var(--ui-danger-icon-surface)',
        iconBorder: 'var(--ui-danger-normal-border)',
        text: 'var(--ui-normal-text)'
      }
    }[variant]

    return [
      'align-items:center',
      `background:${isHovered ? variantSurface.hover : variantSurface.normal}`,
      `border:1px solid ${isHovered ? variantSurface.hoverBorder : variantSurface.border}`,
      'border-radius:7px',
      `box-shadow:${isHovered ? '0 16px 32px oklch(0 0 0 / 24%),0 1px 0 oklch(1 0 0 / 11%) inset' : '0 1px 0 oklch(1 0 0 / 8%) inset'}`,
      'box-sizing:border-box',
      'color:var(--ui-secondary-text)',
      'cursor:pointer',
      'display:grid',
      'gap:12px',
      'grid-template-columns:42px minmax(0,1fr)',
      'min-width:0',
      'padding:10px',
      'text-align:left',
      `transform:${isHovered ? 'translateY(-2px)' : 'translateY(0)'}`,
      'transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease',
      'width:100%',
      `--mockup-action-icon-bg:${variantSurface.icon}`,
      `--mockup-action-icon-border:${variantSurface.iconBorder}`,
      `--mockup-action-text:${variantSurface.text}`
    ].join(';')
  }

  const actionIconStyle = [
    'align-items:center',
    'background:var(--mockup-action-icon-bg)',
    'border:1px solid var(--mockup-action-icon-border)',
    'border-radius:7px',
    'box-shadow:0 1px 0 oklch(1 0 0 / 10%) inset',
    'color:var(--ui-normal-text)',
    'display:flex',
    'height:42px',
    'justify-content:center',
    'width:42px'
  ].join(';')

  const actionTextStyle = [
    'color:var(--mockup-action-text)',
    'display:block',
    'font-size:15px',
    'font-weight:760',
    'line-height:20px',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')

  const actionDescriptionStyle = [
    'color:var(--ui-secondary-text)',
    'display:block',
    'font-size:13px',
    'font-weight:500',
    'line-height:18px',
    'margin-top:3px',
    'min-width:0'
  ].join(';')
</script>

<main style={pageStyle} data-testid="home-screen">
  <section style={frameStyle}>
    <div style={headerBarStyle}>
      <div style={breadcrumbStyle}>
        <span>CTHULHU PROMPT</span>
        <span style="color:var(--ui-neutral-muted-border)">/</span>
        <span style={breadcrumbCurrentStyle}>Home</span>
      </div>

      <div style={readyBadgeStyle}>
        <Check size={14} strokeWidth={2.6} />
        <span>Workspace Ready</span>
      </div>
    </div>

    <header style={titleRowStyle}>
      <div style={titleLineStyle}>
        <span style={titleIconStyle}>
          <FolderClosed size={18} strokeWidth={2.4} />
        </span>
        <h1 style={titleStyle}>Current Workspace</h1>
      </div>
      <p style={descriptionStyle}>Information about your current workspace.</p>
    </header>

    <div style={contentGridStyle}>
      <section style={panelStyle} aria-labelledby="workspace-details-title">
        <div style={sectionHeaderStyle}>
          <span style={sectionIconStyle}>
            <FolderOpen size={19} strokeWidth={2.35} />
          </span>
          <div style="min-width:0">
            <h2 id="workspace-details-title" style={sectionTitleStyle}>Current Workspace</h2>
            <p style={sectionDescriptionStyle}>Information about your current workspace.</p>
          </div>
        </div>

        <div style={groupStyle}>
          {#each workspaceFields as field (field.id)}
            {@const Icon = field.icon}
            <div
              role="group"
              style={fieldStyle(hoveredField === field.id)}
              onmouseenter={() => {
                hoveredField = field.id
              }}
              onmouseleave={() => {
                hoveredField = null
              }}
            >
              <span style={fieldIconStyle(hoveredField === field.id)}>
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <div style="display:grid;gap:4px;min-width:0">
                <div style={labelStyle}>{field.label}</div>
                <div style={valueStyle} title={field.text}>{field.text}</div>
              </div>
            </div>
          {/each}

          <div style={statGridStyle}>
            {#each workspaceStats as stat (stat.id)}
              {@const Icon = stat.icon}
              <div
                role="group"
                style={statStyle(hoveredStat === stat.id)}
                onmouseenter={() => {
                  hoveredStat = stat.id
                }}
                onmouseleave={() => {
                  hoveredStat = null
                }}
              >
                <div style={statIconRowStyle}>
                  <div style={labelStyle}>{stat.label}</div>
                  <span style={statIconStyle}>
                    <Icon size={18} strokeWidth={2.4} />
                  </span>
                </div>
                <p style={statValueStyle}>{stat.text}</p>
              </div>
            {/each}
          </div>
        </div>
      </section>

      <section style={panelStyle} aria-labelledby="workspace-actions-title">
        <div style={sectionHeaderStyle}>
          <span style={sectionIconStyle}>
            <FolderPlus size={19} strokeWidth={2.35} />
          </span>
          <div style="min-width:0">
            <h2 id="workspace-actions-title" style={sectionTitleStyle}>Workspace Actions</h2>
            <p style={sectionDescriptionStyle}>Change your current workspace.</p>
          </div>
        </div>

        <div style={groupStyle}>
          {#each workspaceActions as action (action.id)}
            {@const Icon = action.icon}
            <button
              type="button"
              style={actionButtonStyle(action.variant, hoveredAction === action.id)}
              onmouseenter={() => {
                hoveredAction = action.id
              }}
              onmouseleave={() => {
                hoveredAction = null
              }}
            >
              <span style={actionIconStyle}>
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span style="display:block;min-width:0">
                <span style={actionTextStyle}>{action.text}</span>
                <span style={actionDescriptionStyle}>{action.description}</span>
              </span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </section>
</main>
