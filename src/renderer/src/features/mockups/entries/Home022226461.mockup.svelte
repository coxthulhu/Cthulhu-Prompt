<script lang="ts">
  import {
    Check,
    Copy,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    Folders,
    Sparkles,
    X
  } from 'lucide-svelte'

  const workspaceName = 'Cthulhu Prompt Workspace'
  const workspacePath = 'C:\\Users\\dmin\\Documents\\Cthulhu Prompt Workspace'

  const stats = [
    { label: 'Prompts', value: '128', icon: FileText },
    { label: 'Prompt Folders', value: '24', icon: Folders }
  ]

  const actions = [
    {
      label: 'Open Workspace Folder',
      description: 'Select an existing workspace folder.',
      icon: FolderOpen,
      surface: 'var(--ui-neutral-normal-surface)',
      border: 'var(--ui-neutral-normal-border)',
      color: 'var(--ui-normal-text)'
    },
    {
      label: 'Create Workspace Folder',
      description: 'Choose a folder and set up a new workspace folder.',
      icon: FolderPlus,
      surface: 'var(--ui-accent-normal-surface)',
      border: 'var(--ui-accent-normal-border)',
      color: 'var(--ui-accent-normal-text)'
    },
    {
      label: 'Close Workspace',
      description: 'Unload the current workspace folder.',
      icon: X,
      surface: 'var(--ui-danger-normal-surface)',
      border: 'var(--ui-danger-normal-border)',
      color: 'var(--ui-normal-text)'
    }
  ]
</script>

<main
  data-testid="home-screen"
  style="box-sizing: border-box; width: 100%; min-height: 100%; display: flex; justify-content: center; overflow-y: auto; padding: 1.5rem; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <section
    style="box-sizing: border-box; width: min(100%, 78rem); min-height: calc(100vh - 7.5rem); display: flex; flex-direction: column; justify-content: center; gap: 1rem;"
  >
    <div
      style="display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--ui-neutral-muted-border); padding: 0 0 1rem;"
    >
      <h1
        data-testid="home-title"
        style="margin: 0; color: var(--ui-normal-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: clamp(3.1rem, 7vw, 6.25rem); font-weight: 800; letter-spacing: 0; line-height: 0.86; text-transform: uppercase;"
      >
        CTHULHU PROMPT
      </h1>

      <div
        style="display: inline-flex; align-items: center; gap: 0.55rem; min-height: 2.35rem; border: 1px solid var(--ui-success-normal-border); background: var(--ui-success-normal-surface); color: var(--ui-success-normal-text); padding: 0.42rem 0.75rem; border-radius: 999px; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); font-size: 0.82rem; font-weight: 700; white-space: nowrap;"
      >
        <Check size={16} strokeWidth={2.4} />
        <span data-testid="workspace-ready-title">Workspace Ready</span>
      </div>
    </div>

    <div
      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: 1rem; align-items: stretch;"
    >
      <article
        style="box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--ui-card-normal-border); border-radius: 0.5rem; background: linear-gradient(145deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 1.25rem 3rem var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 1rem;"
      >
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
          <div style="min-width: 0;">
            <p
              style="margin: 0 0 0.35rem; color: var(--ui-muted-text); font-size: 0.75rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase;"
            >
              Current Workspace
            </p>
            <h2
              style="margin: 0; color: var(--ui-normal-text); font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 760; letter-spacing: 0; line-height: 1.05;"
            >
              {workspaceName}
            </h2>
          </div>

          <div
            style="display: grid; place-items: center; width: 3rem; height: 3rem; flex: 0 0 auto; border-radius: 0.5rem; border: 1px solid var(--ui-accent-normal-border); background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            <FolderClosed size={24} strokeWidth={2.1} />
          </div>
        </div>

        <div
          style="box-sizing: border-box; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.85rem; min-width: 0; border: 1px solid var(--ui-neutral-muted-border); border-radius: 0.45rem; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), inset 0 -1rem 1.5rem var(--ui-shadow-inset); padding: 0.9rem;"
        >
          <div style="min-width: 0;">
            <p
              style="margin: 0 0 0.45rem; color: var(--ui-muted-text); font-size: 0.72rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase;"
            >
              Workspace Path
            </p>
            <p
              data-testid="workspace-ready-path"
              title={workspacePath}
              style="margin: 0; overflow: hidden; color: var(--ui-secondary-text); font-family: 'Cascadia Code', Consolas, monospace; font-size: 0.88rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap;"
            >
              {workspacePath}
            </p>
          </div>
          <button
            type="button"
            aria-label="Copy workspace path"
            style="appearance: none; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border: 1px solid var(--ui-neutral-normal-border); border-radius: 0.4rem; background: var(--ui-neutral-normal-surface); color: var(--ui-hoverable-text); cursor: default;"
          >
            <Copy size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.8rem;"
        >
          {#each stats as stat (stat.label)}
            {@const StatIcon = stat.icon}
            <div
              style="display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.75rem; border: 1px solid var(--ui-neutral-normal-border); border-radius: 0.45rem; background: var(--ui-neutral-muted-surface); padding: 0.85rem;"
            >
              <div
                style="display: grid; place-items: center; width: 2.35rem; height: 2.35rem; border: 1px solid var(--ui-info-normal-border); border-radius: 0.45rem; background: var(--ui-info-normal-surface); color: var(--ui-normal-text);"
              >
                <StatIcon size={18} strokeWidth={2.1} />
              </div>
              <div style="min-width: 0;">
                <p
                  style="margin: 0; color: var(--ui-muted-text); font-size: 0.74rem; font-weight: 750; letter-spacing: 0; text-transform: uppercase;"
                >
                  {stat.label}
                </p>
                <p
                  style="margin: 0.1rem 0 0; color: var(--ui-normal-text); font-size: 1.65rem; font-weight: 780; line-height: 1;"
                >
                  {stat.value}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </article>

      <aside
        style="box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--ui-card-normal-border); border-radius: 0.5rem; background: linear-gradient(180deg, var(--ui-neutral-normal-surface), var(--ui-neutral-muted-surface)); box-shadow: 0 1rem 2.4rem var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 1rem;"
      >
        <div
          style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--ui-neutral-muted-border); padding-bottom: 0.85rem;"
        >
          <div style="min-width: 0;">
            <p
              style="margin: 0 0 0.35rem; color: var(--ui-muted-text); font-size: 0.75rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase;"
            >
              Workspace Actions
            </p>
            <h2
              style="margin: 0; color: var(--ui-normal-text); font-size: 1.35rem; font-weight: 740; letter-spacing: 0; line-height: 1.15;"
            >
              Change your current workspace
            </h2>
          </div>
          <Sparkles size={21} strokeWidth={2.1} style="color: var(--ui-accent-icon-glyph);" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          {#each actions as action (action.label)}
            {@const ActionIcon = action.icon}
            <button
              type="button"
              style={`appearance: none; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.85rem; border: 1px solid ${action.border}; border-radius: 0.45rem; background: ${action.surface}; color: ${action.color}; padding: 0.85rem; text-align: left; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); cursor: default;`}
            >
              <span
                style="display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 0.4rem; border: 1px solid var(--ui-neutral-muted-border); background: var(--ui-neutral-muted-surface); color: currentColor;"
              >
                <ActionIcon size={18} strokeWidth={2.15} />
              </span>
              <span style="min-width: 0;">
                <span
                  style="display: block; overflow-wrap: anywhere; color: currentColor; font-size: 0.95rem; font-weight: 760; line-height: 1.25;"
                >
                  {action.label}
                </span>
                <span
                  style="display: block; margin-top: 0.2rem; color: var(--ui-secondary-text); font-size: 0.8rem; line-height: 1.35;"
                >
                  {action.description}
                </span>
              </span>
            </button>
          {/each}
        </div>
      </aside>
    </div>
  </section>
</main>
