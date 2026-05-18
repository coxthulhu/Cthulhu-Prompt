<script lang="ts">
  import {
    Check,
    ChevronRight,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    Home,
    X
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type HoverKey =
    | 'workspace-name'
    | 'workspace-path'
    | 'prompts-stat'
    | 'folders-stat'
    | 'open-workspace'
    | 'create-workspace'
    | 'close-workspace'

  type ActionVariant = 'neutral' | 'accent' | 'danger'

  const workspaceDetails = {
    name: 'Prompt Engineering',
    path: 'C:\\Users\\dmin\\Documents\\Cthulhu Prompt\\Prompt Engineering',
    prompts: '48',
    promptFolders: '7'
  }

  const displayFields: {
    key: HoverKey
    label: string
    text: string
    icon: ComponentType
  }[] = [
    {
      key: 'workspace-name',
      label: 'Workspace Name',
      text: workspaceDetails.name,
      icon: FolderClosed
    },
    {
      key: 'workspace-path',
      label: 'Workspace Path',
      text: workspaceDetails.path,
      icon: FolderOpen
    }
  ]

  const statCards: {
    key: HoverKey
    label: string
    text: string
    icon: ComponentType
  }[] = [
    {
      key: 'prompts-stat',
      label: 'Prompts',
      text: workspaceDetails.prompts,
      icon: FileText
    },
    {
      key: 'folders-stat',
      label: 'Prompt Folders',
      text: workspaceDetails.promptFolders,
      icon: Folders
    }
  ]

  const workspaceActions: {
    key: HoverKey
    text: string
    description: string
    icon: ComponentType
    variant: ActionVariant
  }[] = [
    {
      key: 'open-workspace',
      text: 'Open Workspace',
      description: 'Select an existing workspace file.',
      icon: FolderOpen,
      variant: 'neutral'
    },
    {
      key: 'create-workspace',
      text: 'Create Workspace',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      variant: 'accent'
    },
    {
      key: 'close-workspace',
      text: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      variant: 'danger'
    }
  ]

  let hoveredKey = $state<HoverKey | null>(null)

  const setHoveredKey = (key: HoverKey | null) => {
    hoveredKey = key
  }

  const isHovered = (key: HoverKey) => hoveredKey === key

  const getPanelStyle = () =>
    [
      'background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
      'border: 1px solid var(--ui-card-normal-border)',
      'border-radius: 8px',
      'box-shadow: 0 18px 44px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
      'box-sizing: border-box',
      'min-width: 0',
      'padding: 10px'
    ].join(';')

  const getNestedHeaderStyle = () =>
    [
      'align-items: center',
      'background: var(--ui-neutral-muted-surface)',
      'border: 1px solid var(--ui-card-nested-border)',
      'border-radius: 7px',
      'box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
      'box-sizing: border-box',
      'display: grid',
      'gap: 12px',
      'grid-template-columns: minmax(0, 1fr) auto',
      'min-width: 0',
      'padding: 8px 8px 8px 10px'
    ].join(';')

  const getFieldStyle = (key: HoverKey) =>
    [
      'align-items: center',
      'background: var(--ui-neutral-normal-surface)',
      `border: 1px solid ${isHovered(key) ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}`,
      'border-radius: 7px',
      `box-shadow: ${isHovered(key) ? '0 12px 28px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)' : '0 8px 18px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)'}`,
      'box-sizing: border-box',
      'display: grid',
      'gap: 10px',
      'grid-template-columns: 38px minmax(0, 1fr)',
      'min-width: 0',
      'padding: 10px',
      `transform: ${isHovered(key) ? 'translateY(-1px)' : 'translateY(0)'}`,
      'transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
    ].join(';')

  const getStatStyle = (key: HoverKey) =>
    [
      'align-items: center',
      `background: ${isHovered(key) ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
      `border: 1px solid ${isHovered(key) ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}`,
      'border-radius: 7px',
      `box-shadow: ${isHovered(key) ? '0 16px 30px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)' : '0 10px 24px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)'}`,
      'box-sizing: border-box',
      'display: grid',
      'gap: 12px',
      'grid-template-columns: 42px minmax(0, 1fr)',
      'min-height: 82px',
      'min-width: 0',
      'padding: 12px',
      `transform: ${isHovered(key) ? 'translateY(-1px)' : 'translateY(0)'}`,
      'transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
    ].join(';')

  const getActionStyle = (variant: ActionVariant, key: HoverKey) => {
    const hovered = isHovered(key)
    const palette = {
      neutral: {
        surface: hovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)',
        border: hovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)',
        iconSurface: hovered ? 'var(--ui-neutral-emphasis-surface)' : 'var(--ui-neutral-muted-surface)',
        iconColor: 'var(--ui-hoverable-text)'
      },
      accent: {
        surface: hovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)',
        border: hovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)',
        iconSurface: 'var(--ui-accent-normal-fill)',
        iconColor: 'var(--ui-accent-normal-text)'
      },
      danger: {
        surface: hovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-normal-surface)',
        border: hovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)',
        iconSurface: 'var(--ui-danger-icon-surface)',
        iconColor: 'var(--ui-danger-icon-glyph)'
      }
    }[variant]

    return {
      button: [
        'align-items: center',
        `background: ${palette.surface}`,
        `border: 1px solid ${palette.border}`,
        'border-radius: 7px',
        `box-shadow: ${hovered ? '0 14px 28px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight)' : 'inset 0 1px 0 var(--ui-card-nested-inset-highlight)'}`,
        'box-sizing: border-box',
        'color: var(--ui-normal-text)',
        'cursor: pointer',
        'display: grid',
        'font: inherit',
        'gap: 12px',
        'grid-template-columns: 42px minmax(0, 1fr) auto',
        'min-height: 68px',
        'min-width: 0',
        'padding: 11px',
        'text-align: left',
        `transform: ${hovered ? 'translateY(-1px)' : 'translateY(0)'}`,
        'transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
        'width: 100%'
      ].join(';'),
      iconSurface: [
        'align-items: center',
        `background: ${palette.iconSurface}`,
        `border: 1px solid ${palette.border}`,
        'border-radius: 7px',
        'box-sizing: border-box',
        `color: ${palette.iconColor}`,
        'display: flex',
        'height: 42px',
        'justify-content: center',
        'width: 42px'
      ].join(';')
    }
  }
</script>

<main
  data-testid="home-screen-mockup"
  style="display: flex; flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto;"
>
  <div style="display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; min-width: 0;">
    <div
      style="align-items: center; background: var(--ui-card-nested-surface); border-bottom: 1px solid var(--ui-neutral-muted-border); box-sizing: border-box; display: flex; flex: 0 0 36px; min-width: 0; padding: 0 24px;"
    >
      <div
        style="align-items: center; color: var(--ui-muted-text); display: flex; font-size: 14px; font-weight: 500; min-width: 0;"
      >
        <span style="align-items: center; display: inline-flex; gap: 7px; min-width: 0;">
          <Home size={15} strokeWidth={2.3} />
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            CTHULHU PROMPT
          </span>
        </span>
        <ChevronRight
          size={15}
          strokeWidth={2.3}
          style="color: var(--ui-neutral-emphasis-border); flex: 0 0 auto; margin: 0 10px;"
        />
        <span style="color: var(--ui-hoverable-text); flex: 0 0 auto;">Home</span>
      </div>
    </div>

    <div
      style="box-sizing: border-box; display: flex; flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto; padding: 24px;"
    >
      <section
        style="align-content: center; display: grid; gap: 24px; margin: 0 auto; max-width: 1024px; min-height: 100%; min-width: 0; width: 100%;"
      >
        <header style="display: grid; gap: 12px; min-width: 0;">
          <h1
            style="color: var(--ui-normal-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 4.75rem; font-weight: 700; line-height: 1; margin: 0; overflow-wrap: anywhere; text-align: center;"
          >
            CTHULHU PROMPT
          </h1>
          <div
            style="background: var(--ui-neutral-muted-border); height: 1px; min-width: 0; width: 100%;"
          ></div>
        </header>

        <div
          style="align-items: start; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); min-width: 0;"
        >
          <article style={getPanelStyle()}>
            <div style="display: grid; gap: 8px; min-width: 0;">
              <div style={getNestedHeaderStyle()}>
                <div
                  style="align-items: center; display: grid; gap: 10px; grid-template-columns: 40px minmax(0, 1fr); min-width: 0;"
                >
                  <div
                    style="align-items: center; background: var(--ui-accent-normal-surface); border: 1px solid var(--ui-accent-icon-ring); border-radius: 7px; box-sizing: border-box; color: var(--ui-accent-icon-glyph); display: flex; height: 40px; justify-content: center; width: 40px;"
                  >
                    <FolderClosed size={19} strokeWidth={2.3} />
                  </div>
                  <div style="display: grid; gap: 3px; min-width: 0;">
                    <h2
                      style="color: var(--ui-normal-text); font-size: 15px; font-weight: 650; line-height: 20px; margin: 0;"
                    >
                      Current Workspace
                    </h2>
                    <p
                      style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    >
                      Information about your current workspace.
                    </p>
                  </div>
                </div>
                <span
                  style="align-items: center; background: var(--ui-success-normal-surface); border: 1px solid var(--ui-success-normal-border); border-radius: 999px; box-sizing: border-box; color: var(--ui-success-normal-text); display: inline-flex; flex: 0 0 auto; font-size: 11px; font-weight: 750; gap: 6px; line-height: 16px; padding: 5px 8px;"
                >
                  <Check size={13} strokeWidth={2.6} />
                  Workspace Ready
                </span>
              </div>

              <div style="display: grid; gap: 8px; min-width: 0;">
                {#each displayFields as field (field.key)}
                  {@const FieldIcon = field.icon}
                  <div
                    role="group"
                    style={getFieldStyle(field.key)}
                    onmouseenter={() => setHoveredKey(field.key)}
                    onmouseleave={() => setHoveredKey(null)}
                  >
                    <div
                      style="align-items: center; background: var(--ui-neutral-muted-surface); border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; box-sizing: border-box; color: var(--ui-secondary-text); display: flex; height: 38px; justify-content: center; width: 38px;"
                    >
                      <FieldIcon size={18} strokeWidth={2.3} />
                    </div>
                    <div style="display: grid; gap: 3px; min-width: 0;">
                      <div
                        style="color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px; text-transform: uppercase;"
                      >
                        {field.label}
                      </div>
                      <div
                        title={field.text}
                        style="color: var(--ui-normal-text); font-size: 14px; font-weight: 600; line-height: 20px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      >
                        {field.text}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

              <div
                style="display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0;"
              >
                {#each statCards as stat (stat.key)}
                  {@const StatIcon = stat.icon}
                  <div
                    role="group"
                    style={getStatStyle(stat.key)}
                    onmouseenter={() => setHoveredKey(stat.key)}
                    onmouseleave={() => setHoveredKey(null)}
                  >
                    <div
                      style="align-items: center; background: var(--ui-accent-normal-fill); border: 1px solid var(--ui-accent-icon-ring); border-radius: 7px; box-sizing: border-box; color: var(--ui-accent-icon-glyph); display: flex; height: 42px; justify-content: center; width: 42px;"
                    >
                      <StatIcon size={19} strokeWidth={2.4} />
                    </div>
                    <div style="display: grid; gap: 2px; min-width: 0;">
                      <div
                        style="color: var(--ui-normal-text); font-size: 28px; font-weight: 750; line-height: 30px;"
                      >
                        {stat.text}
                      </div>
                      <div
                        style="color: var(--ui-accent-normal-text); font-size: 11px; font-weight: 750; line-height: 16px; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap;"
                      >
                        {stat.label}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </article>

          <article style={getPanelStyle()}>
            <div style="display: grid; gap: 8px; min-width: 0;">
              <div style={getNestedHeaderStyle()}>
                <div
                  style="align-items: center; display: grid; gap: 10px; grid-template-columns: 40px minmax(0, 1fr); min-width: 0;"
                >
                  <div
                    style="align-items: center; background: var(--ui-neutral-normal-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; box-sizing: border-box; color: var(--ui-hoverable-text); display: flex; height: 40px; justify-content: center; width: 40px;"
                  >
                    <Folders size={19} strokeWidth={2.3} />
                  </div>
                  <div style="display: grid; gap: 3px; min-width: 0;">
                    <h2
                      style="color: var(--ui-normal-text); font-size: 15px; font-weight: 650; line-height: 20px; margin: 0;"
                    >
                      Workspace Actions
                    </h2>
                    <p
                      style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    >
                      Change your current workspace.
                    </p>
                  </div>
                </div>
              </div>

              <div style="display: grid; gap: 8px; min-width: 0;">
                {#each workspaceActions as action (action.key)}
                  {@const ActionIcon = action.icon}
                  {@const actionStyle = getActionStyle(action.variant, action.key)}
                  <button
                    type="button"
                    style={actionStyle.button}
                    onmouseenter={() => setHoveredKey(action.key)}
                    onmouseleave={() => setHoveredKey(null)}
                    onfocus={() => setHoveredKey(action.key)}
                    onblur={() => setHoveredKey(null)}
                  >
                    <span style={actionStyle.iconSurface}>
                      <ActionIcon size={19} strokeWidth={2.3} />
                    </span>
                    <span style="display: grid; gap: 3px; min-width: 0;">
                      <span
                        style="color: var(--ui-normal-text); font-size: 14px; font-weight: 650; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      >
                        {action.text}
                      </span>
                      <span
                        style="color: var(--ui-secondary-text); font-size: 12px; font-weight: 500; line-height: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      >
                        {action.description}
                      </span>
                    </span>
                    <ChevronRight
                      size={17}
                      strokeWidth={2.5}
                      style={`color: ${isHovered(action.key) ? 'var(--ui-normal-text)' : 'var(--ui-muted-text)'}; transition: color 140ms ease;`}
                    />
                  </button>
                {/each}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</main>
