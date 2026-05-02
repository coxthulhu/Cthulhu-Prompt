<script lang="ts">
  import {
    AlertCircle,
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    X
  } from 'lucide-svelte'

  const workspaceName = 'Cthulhu Prompt'
  const workspacePath = 'C:\\Source\\PromptApps\\CthulhuPromptPublic'

  const stats = [
    { label: 'Prompts', value: '42', icon: FileText },
    { label: 'Prompt Folders', value: '8', icon: Folders }
  ]

  const workspaceFields = [
    { label: 'Workspace Name', value: workspaceName, icon: FolderClosed },
    { label: 'Workspace Path', value: workspacePath, icon: FolderOpen }
  ]

  const actions = [
    {
      label: 'Open Workspace Folder',
      description: 'Select an existing workspace folder.',
      icon: FolderOpen,
      tone: 'neutral'
    },
    {
      label: 'Create Workspace Folder',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      tone: 'accent'
    },
    {
      label: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      tone: 'danger'
    }
  ]
</script>

<main
  data-testid="home-screen"
  style="box-sizing: border-box; min-width: 0; width: 100%; min-height: 42rem; padding: 1.5rem; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <section
    style="box-sizing: border-box; width: min(100%, 76rem); min-height: 100%; margin: 0 auto; display: grid; grid-template-columns: minmax(18rem, 0.84fr) minmax(24rem, 1.16fr); gap: 1rem; align-items: stretch;"
  >
    <div
      style="box-sizing: border-box; min-width: 0; display: grid; grid-template-rows: 1fr auto; gap: 1rem;"
    >
      <section
        style="position: relative; overflow: hidden; box-sizing: border-box; min-width: 0; min-height: 25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 2rem; padding: 1.4rem; border: 1px solid var(--ui-card-normal-border); border-radius: 0.5rem; background: linear-gradient(150deg, var(--ui-card-normal-surface-gradient-start), var(--ui-neutral-muted-surface) 48%, var(--ui-card-normal-surface-gradient-end)); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), 0 1.2rem 2.6rem var(--ui-card-normal-shadow);"
      >
        <div
          aria-hidden="true"
          style="position: absolute; inset: auto -18% -8% 16%; height: 46%; border-top: 1px solid var(--ui-neutral-normal-border); background: linear-gradient(90deg, transparent, var(--ui-accent-normal-surface), transparent); transform: skewY(-8deg); opacity: 0.72;"
        ></div>

        <div style="position: relative; display: flex; align-items: center; gap: 0.65rem;">
          <div
            style="display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 1px solid var(--ui-success-normal-border); border-radius: 0.45rem; background: var(--ui-success-normal-surface); color: var(--ui-success-normal-text);"
          >
            <Check size={17} strokeWidth={2.3} />
          </div>
          <div style="min-width: 0;">
            <p
              data-testid="workspace-ready-title"
              style="margin: 0; color: var(--ui-success-normal-text); font-size: 0.82rem; font-weight: 700;"
            >
              Workspace Ready
            </p>
            <p style="margin: 0.14rem 0 0; color: var(--ui-muted-text); font-size: 0.78rem;">
              Current Workspace
            </p>
          </div>
        </div>

        <div style="position: relative; min-width: 0;">
          <h1
            data-testid="home-title"
            style="margin: 0; max-width: 8ch; color: var(--ui-normal-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 4.5rem; font-weight: 800; letter-spacing: 0; line-height: 0.92; text-transform: uppercase;"
          >
            CTHULHU PROMPT
          </h1>
        </div>

        <div
          style="position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem;"
        >
          {#each stats as stat (stat.label)}
            {@const Icon = stat.icon}
            <div
              style="box-sizing: border-box; min-width: 0; min-height: 7rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; padding: 0.95rem; border: 1px solid var(--ui-card-nested-border); border-radius: 0.45rem; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
            >
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.7rem;">
                <span style="min-width: 0; color: var(--ui-secondary-text); font-size: 0.78rem; font-weight: 700;">
                  {stat.label}
                </span>
                <Icon size={16} color="var(--ui-accent-icon-glyph)" strokeWidth={2.2} />
              </div>
              <span style="color: var(--ui-normal-text); font-size: 2.4rem; font-weight: 750; line-height: 1;">
                {stat.value}
              </span>
            </div>
          {/each}
        </div>
      </section>

      <section
        style="box-sizing: border-box; min-width: 0; padding: 1rem; border: 1px solid var(--ui-info-normal-border); border-radius: 0.5rem; background: var(--ui-info-normal-surface);"
      >
        <div style="display: flex; align-items: center; gap: 0.7rem;">
          <AlertCircle size={17} color="var(--ui-normal-text)" strokeWidth={2.2} />
          <p style="margin: 0; color: var(--ui-secondary-text); font-size: 0.9rem; line-height: 1.4;">
            Information about your current workspace.
          </p>
        </div>
      </section>
    </div>

    <div
      style="box-sizing: border-box; min-width: 0; display: grid; grid-template-rows: auto 1fr; gap: 1rem;"
    >
      <section
        style="box-sizing: border-box; min-width: 0; padding: 1.1rem; border: 1px solid var(--ui-card-normal-border); border-radius: 0.5rem; background: linear-gradient(180deg, var(--ui-neutral-normal-surface), var(--ui-neutral-muted-surface)); box-shadow: 0 1.2rem 2.6rem var(--ui-card-normal-shadow);"
      >
        <div
          style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--ui-neutral-muted-border);"
        >
          <div style="min-width: 0;">
            <h2 style="margin: 0; color: var(--ui-normal-text); font-size: 1.28rem; font-weight: 700; line-height: 1.2;">
              Current Workspace
            </h2>
          </div>
          <div
            style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.48rem 0.65rem; border: 1px solid var(--ui-success-normal-border); border-radius: 999px; background: var(--ui-success-normal-surface); color: var(--ui-success-normal-text); font-size: 0.78rem; font-weight: 750; white-space: nowrap;"
          >
            <Check size={14} strokeWidth={2.4} />
            Workspace Ready
          </div>
        </div>

        <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
          {#each workspaceFields as field (field.label)}
            {@const Icon = field.icon}
            <div
              style="box-sizing: border-box; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.8rem; align-items: center; padding: 0.9rem; border: 1px solid var(--ui-neutral-muted-border); border-radius: 0.45rem; background: var(--ui-neutral-muted-surface);"
            >
              <div
                style="display: grid; width: 2.15rem; height: 2.15rem; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 0.38rem; background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph);"
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
              <div style="min-width: 0;">
                <p style="margin: 0; color: var(--ui-muted-text); font-size: 0.76rem; font-weight: 700;">
                  {field.label}
                </p>
                <p
                  data-testid={field.label === 'Workspace Path' ? 'workspace-ready-path' : undefined}
                  title={field.value}
                  style="margin: 0.16rem 0 0; overflow-wrap: anywhere; color: var(--ui-normal-text); font-size: 0.96rem; line-height: 1.35;"
                >
                  {field.value}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <section
        style="box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; gap: 1rem; padding: 1.1rem; border: 1px solid var(--ui-card-normal-border); border-radius: 0.5rem; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), 0 1.2rem 2.6rem var(--ui-card-normal-shadow);"
      >
        <div
          style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--ui-neutral-muted-border);"
        >
          <div style="min-width: 0;">
            <h2 style="margin: 0; color: var(--ui-normal-text); font-size: 1.28rem; font-weight: 700; line-height: 1.2;">
              Workspace Actions
            </h2>
            <p style="margin: 0.3rem 0 0; color: var(--ui-muted-text); font-size: 0.9rem; line-height: 1.4;">
              Change your current workspace.
            </p>
          </div>
        </div>

        <div style="display: grid; gap: 0.8rem;">
          {#each actions as action (action.label)}
            {@const Icon = action.icon}
            <button
              data-testid={action.label === 'Open Workspace Folder'
                ? 'select-workspace-folder-button'
                : action.label === 'Create Workspace Folder'
                  ? 'create-workspace-folder-button'
                  : 'close-workspace-button'}
              type="button"
              style={`appearance: none; box-sizing: border-box; width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.85rem; align-items: center; padding: 0.95rem; border: 1px solid ${
                action.tone === 'accent'
                  ? 'var(--ui-accent-normal-border)'
                  : action.tone === 'danger'
                    ? 'var(--ui-danger-normal-border)'
                    : 'var(--ui-neutral-normal-border)'
              }; border-radius: 0.45rem; background: ${
                action.tone === 'accent'
                  ? 'var(--ui-accent-normal-surface)'
                  : action.tone === 'danger'
                    ? 'var(--ui-danger-normal-surface)'
                    : 'var(--ui-neutral-normal-surface)'
              }; color: var(--ui-normal-text); font: inherit; text-align: left; cursor: default;`}
            >
              <span
                style={`display: grid; width: 2.2rem; height: 2.2rem; place-items: center; border: 1px solid ${
                  action.tone === 'accent'
                    ? 'var(--ui-accent-normal-border)'
                    : action.tone === 'danger'
                      ? 'var(--ui-danger-normal-border)'
                      : 'var(--ui-neutral-emphasis-border)'
                }; border-radius: 0.38rem; background: var(--ui-neutral-muted-surface);`}
              >
                <Icon size={16} strokeWidth={2.25} />
              </span>
              <span style="min-width: 0;">
                <span style="display: block; color: var(--ui-normal-text); font-size: 0.96rem; font-weight: 750;">
                  {action.label}
                </span>
                <span style="display: block; margin-top: 0.12rem; color: var(--ui-muted-text); font-size: 0.8rem; line-height: 1.35;">
                  {action.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                style="width: 0.45rem; height: 2.2rem; border-radius: 999px; background: var(--ui-neutral-selection-surface);"
              ></span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </section>
</main>
