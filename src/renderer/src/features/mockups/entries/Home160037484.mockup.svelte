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

  type HoverTarget =
    | 'workspace-name'
    | 'workspace-path'
    | 'open-workspace'
    | 'create-workspace'
    | 'close-workspace'
    | null

  type IconComponent = typeof FolderClosed

  const workspaceFields: {
    id: Exclude<HoverTarget, 'open-workspace' | 'create-workspace' | 'close-workspace' | null>
    label: string
    value: string
    icon: IconComponent
  }[] = [
    {
      id: 'workspace-name',
      label: 'Workspace Name',
      value: 'PromptOps Coding Library',
      icon: FolderClosed
    },
    {
      id: 'workspace-path',
      label: 'Workspace Path',
      value: 'C:\\Users\\Dani\\Documents\\Cthulhu Prompt\\PromptOps Coding Library.cthulhu',
      icon: FolderOpen
    }
  ]

  const workspaceStats: { label: string; value: string; icon: IconComponent }[] = [
    { label: 'Prompts', value: '48', icon: FileText },
    { label: 'Prompt Folders', value: '7', icon: Folders }
  ]

  const workspaceActions: {
    id: Exclude<HoverTarget, 'workspace-name' | 'workspace-path' | null>
    label: string
    description: string
    icon: IconComponent
    variant: 'neutral' | 'accent' | 'danger'
  }[] = [
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

  let hoveredTarget = $state<HoverTarget>(null)

  const getActionSurface = (variant: 'neutral' | 'accent' | 'danger', isHovered: boolean) => {
    if (variant === 'accent') {
      return isHovered
        ? 'linear-gradient(135deg, var(--ui-accent-hover-surface), var(--ui-accent-normal-fill))'
        : 'linear-gradient(135deg, var(--ui-accent-normal-surface), var(--ui-card-normal-surface-gradient-end))'
    }
    if (variant === 'danger') {
      return isHovered
        ? 'linear-gradient(135deg, var(--ui-danger-hover-surface), var(--ui-neutral-normal-surface))'
        : 'linear-gradient(135deg, var(--ui-danger-normal-surface), var(--ui-card-normal-surface-gradient-end))'
    }
    return isHovered
      ? 'linear-gradient(135deg, var(--ui-neutral-hover-surface), var(--ui-neutral-normal-surface))'
      : 'linear-gradient(135deg, var(--ui-neutral-muted-surface), var(--ui-card-normal-surface-gradient-end))'
  }

  const getActionBorder = (variant: 'neutral' | 'accent' | 'danger', isHovered: boolean) => {
    if (variant === 'accent') {
      return isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'
    }
    if (variant === 'danger') {
      return isHovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)'
    }
    return isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-muted-border)'
  }

  const getActionIconSurface = (variant: 'neutral' | 'accent' | 'danger', isHovered: boolean) => {
    if (variant === 'accent') {
      return isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'
    }
    if (variant === 'danger') {
      return isHovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-icon-surface)'
    }
    return isHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'
  }

  const getActionIconColor = (variant: 'neutral' | 'accent' | 'danger') => {
    if (variant === 'accent') {
      return 'var(--ui-accent-icon-glyph)'
    }
    if (variant === 'danger') {
      return 'var(--ui-danger-icon-glyph)'
    }
    return 'var(--ui-hoverable-text)'
  }
</script>

<main
  data-testid="home-screen"
  style="box-sizing: border-box; display: flex; min-height: 100%; min-width: 0; width: 100%; justify-content: center; overflow-y: auto; padding: 24px; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <section
    style="box-sizing: border-box; display: grid; width: min(100%, 1040px); min-width: 0; align-content: center; gap: 20px;"
  >
    <header style="display: grid; gap: 12px; min-width: 0;">
      <div
        style="display: flex; height: 36px; min-width: 0; align-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-neutral-muted-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 0 14px;"
      >
        <div
          style="display: flex; min-width: 0; align-items: center; color: var(--ui-muted-text); font-size: 13px; font-weight: 650;"
        >
          <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            PromptOps Coding Library
          </span>
          <span style="padding: 0 10px; color: var(--ui-neutral-emphasis-border);">/</span>
          <span style="flex: 0 0 auto; color: var(--ui-hoverable-text);">Home</span>
        </div>
      </div>

      <div style="display: grid; gap: 6px; min-width: 0; border-left: 3px solid var(--ui-accent-normal-border); padding-left: 16px;">
        <h1
          data-testid="home-title"
          style="margin: 0; color: var(--ui-normal-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 56px; font-weight: 760; letter-spacing: 0; line-height: 1.02; overflow-wrap: anywhere;"
        >
          CTHULHU PROMPT
        </h1>
      </div>
    </header>

    <div
      style="display: grid; min-width: 0; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px;"
    >
      <section
        style="box-sizing: border-box; display: grid; min-width: 0; align-content: start; gap: 10px; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(145deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 18px 48px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 10px;"
      >
        <div
          style="display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; border-left: 3px solid var(--ui-accent-normal-border); padding-left: 16px;"
        >
          <div style="display: grid; min-width: 0; gap: 8px;">
            <h2 style="margin: 0; min-width: 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 760; line-height: 32px;">
              Current Workspace
            </h2>
            <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
              Information about your current workspace.
            </p>
          </div>

          <div
            style="display: inline-flex; flex: 0 0 auto; align-items: center; gap: 7px; border: 1px solid var(--ui-success-normal-border); border-radius: 999px; background: var(--ui-success-normal-surface); padding: 6px 10px; color: var(--ui-success-normal-text); font-size: 12px; font-weight: 750; line-height: 16px;"
          >
            <Check size={14} strokeWidth={2.6} />
            <span>Workspace Ready</span>
          </div>
        </div>

        <div style="display: grid; min-width: 0; gap: 8px;">
          {#each workspaceFields as field (field.id)}
            {@const isHovered = hoveredTarget === field.id}
            {@const Icon = field.icon}
            <button
              type="button"
              onmouseenter={() => {
                hoveredTarget = field.id
              }}
              onmouseleave={() => {
                hoveredTarget = null
              }}
              onfocus={() => {
                hoveredTarget = field.id
              }}
              onblur={() => {
                hoveredTarget = null
              }}
              style={`appearance: none; box-sizing: border-box; display: grid; width: 100%; min-width: 0; grid-template-columns: 42px minmax(0, 1fr); align-items: center; gap: 12px; border: 1px solid ${isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-card-nested-border)'}; border-radius: 7px; background: ${isHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-muted-surface)'}; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); cursor: default; padding: 11px; text-align: left; transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; transform: ${isHovered ? 'translateY(-1px)' : 'translateY(0)'};`}
            >
              <span
                style={`display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid ${isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 7px; background: ${isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color: var(--ui-accent-icon-glyph); transition: border-color 140ms ease, background 140ms ease, color 140ms ease;`}
              >
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span style="display: grid; min-width: 0; gap: 4px;">
                <span style="color: var(--ui-muted-text); font-size: 12px; font-weight: 750; line-height: 16px; text-transform: uppercase;">
                  {field.label}
                </span>
                <span
                  style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 14px; font-weight: 650; line-height: 20px;"
                  title={field.value}
                >
                  {field.value}
                </span>
              </span>
            </button>
          {/each}
        </div>

        <div style="display: grid; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
          {#each workspaceStats as stat (stat.label)}
            {@const Icon = stat.icon}
            <div
              style="box-sizing: border-box; display: grid; min-width: 0; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; align-items: center; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 11px;"
            >
              <span
                style="display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 7px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-icon-glyph);"
              >
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <div style="display: grid; min-width: 0; gap: 2px;">
                <span style="color: var(--ui-muted-text); font-size: 12px; font-weight: 750; line-height: 16px; text-transform: uppercase;">
                  {stat.label}
                </span>
                <span style="color: var(--ui-normal-text); font-size: 28px; font-weight: 780; line-height: 32px;">
                  {stat.value}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <section
        style="box-sizing: border-box; display: grid; min-width: 0; align-content: start; gap: 16px; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(145deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 18px 48px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 10px;"
      >
        <div
          style="display: grid; min-width: 0; gap: 4px; border-left: 3px solid var(--ui-accent-normal-border); padding: 4px 0 4px 14px;"
        >
          <h2 style="margin: 0 0 2px 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 760; line-height: 32px;">
            Workspace Actions
          </h2>
          <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
            Change your current workspace.
          </p>
        </div>

        <div style="display: grid; min-width: 0; gap: 8px;">
          {#each workspaceActions as action (action.id)}
            {@const isHovered = hoveredTarget === action.id}
            {@const Icon = action.icon}
            <button
              type="button"
              onmouseenter={() => {
                hoveredTarget = action.id
              }}
              onmouseleave={() => {
                hoveredTarget = null
              }}
              onfocus={() => {
                hoveredTarget = action.id
              }}
              onblur={() => {
                hoveredTarget = null
              }}
              style={`appearance: none; box-sizing: border-box; display: grid; width: 100%; min-width: 0; grid-template-columns: 42px minmax(0, 1fr); align-items: center; gap: 12px; border: 1px solid ${getActionBorder(action.variant, isHovered)}; border-radius: 7px; background: ${getActionSurface(action.variant, isHovered)}; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), ${isHovered ? '0 10px 24px var(--ui-shadow-raised)' : '0 0 0 transparent'}; color: var(--ui-normal-text); cursor: pointer; padding: 10px; text-align: left; transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease; transform: ${isHovered ? 'translateY(-1px)' : 'translateY(0)'};`}
            >
              <span
                style={`display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid ${getActionBorder(action.variant, isHovered)}; border-radius: 7px; background: ${getActionIconSurface(action.variant, isHovered)}; color: ${getActionIconColor(action.variant)}; transition: border-color 140ms ease, background 140ms ease;`}
              >
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span style="display: grid; min-width: 0; gap: 3px;">
                <span style="color: var(--ui-normal-text); font-size: 15px; font-weight: 760; line-height: 20px;">
                  {action.label}
                </span>
                <span style="color: var(--ui-muted-text); font-size: 13px; font-weight: 500; line-height: 18px;">
                  {action.description}
                </span>
              </span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </section>
</main>
