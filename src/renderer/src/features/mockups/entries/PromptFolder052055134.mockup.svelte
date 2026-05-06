<script lang="ts">
  import {
    ChevronDown,
    Copy,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    MoreHorizontal,
    Plus,
    Search,
    Settings,
    Trash2
  } from 'lucide-svelte'

  const prompts = [
    {
      title: 'Refactor request',
      text: 'Refactor the selected module so the data flow is easier to follow. Keep the public behavior unchanged and add focused tests around the changed paths.',
      lines: 3,
      tokens: 74
    },
    {
      title: 'Bug investigation',
      text: 'Investigate this failure from the logs and source. Identify the most likely root cause, explain the evidence, and propose the smallest fix.',
      lines: 2,
      tokens: 68
    }
  ]

  const addRows = [
    { label: 'Prompt', icon: Plus },
    { label: 'Prompt subfolder', icon: FolderPlus }
  ]
</script>

<main
  style="display: flex; min-height: 100%; min-width: 0; flex: 1 1 auto; flex-direction: column; color: var(--ui-normal-text);"
>
  <div
    style="display: flex; height: 36px; flex: 0 0 auto; align-items: center; border-bottom: 1px solid var(--ui-neutral-muted-border); background: oklch(0.13 0.012 266 / 88%); padding: 0 24px;"
  >
    <div
      style="display: flex; min-width: 0; align-items: center; font-size: 14px; font-weight: 600;"
    >
      <button
        type="button"
        style="min-width: 0; cursor: pointer; overflow: hidden; border: 0; background: transparent; color: var(--ui-muted-text); font: inherit; text-overflow: ellipsis; white-space: nowrap;"
      >
        Engineering Prompts
      </button>
      <span style="padding: 0 12px; color: oklch(1 0 0 / 28%);">/</span>
      <button
        type="button"
        style="cursor: pointer; border: 0; background: transparent; color: var(--ui-normal-text); font: inherit; white-space: nowrap;"
      >
        Refactoring
      </button>
    </div>
  </div>

  <div style="min-height: 0; flex: 1 1 auto; overflow: auto;">
    <div
      style="box-sizing: border-box; display: grid; gap: 18px; min-width: 0; padding: 24px 28px 80px;"
    >
      <section style="display: grid; gap: 16px; min-width: 0;">
        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 18px;"
        >
          <div style="display: grid; gap: 8px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span
                style="display: inline-flex; height: 30px; width: 30px; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: var(--ui-accent-icon-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); color: var(--ui-accent-icon-glyph);"
              >
                <Settings size={16} strokeWidth={2.4} />
              </span>
              <h1 style="margin: 0; color: var(--ui-normal-text); font-size: 24px; line-height: 32px;">
                Folder Settings
              </h1>
            </div>
            <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
              Settings that only affect prompts in this folder, and are saved to the workspace.
            </p>
          </div>

          <button
            type="button"
            style="display: inline-flex; height: 32px; align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); padding: 0 10px; color: var(--ui-secondary-text); font: inherit; font-size: 12px; font-weight: 700;"
          >
            <Search size={14} strokeWidth={2.3} />
            Find
          </button>
        </div>

        <div style="height: 1px; background: var(--ui-neutral-muted-border);"></div>

        <div
          style="box-sizing: border-box; display: grid; gap: 10px; min-width: 0; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 16px 34px var(--ui-card-normal-shadow); padding: 10px;"
        >
          <div
            style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 8px 8px 8px 10px;"
          >
            <div style="display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 10px; min-width: 0;">
              <span
                style="display: inline-flex; height: 40px; width: 40px; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph);"
              >
                <Folder size={18} strokeWidth={2.4} />
              </span>
              <div style="display: grid; gap: 4px; min-width: 0;">
                <p style="margin: 0; color: var(--ui-normal-text); font-size: 15px; font-weight: 700; line-height: 22px;">
                  Folder Description
                </p>
                <div
                  style="display: flex; min-width: 0; align-items: center; gap: 7px; overflow: hidden; color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px; white-space: nowrap;"
                >
                  <span style="display: inline-flex; min-width: 0; align-items: center; gap: 5px; color: var(--ui-secondary-text);">
                    <Folder size={12} strokeWidth={2.4} />
                    Folder Settings
                  </span>
                  <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                  <span>0 lines</span>
                  <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                  <span>0 tokens</span>
                  <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Copy folder description"
              title="Copy folder description"
              style="display: inline-flex; height: 30px; width: 30px; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text);"
            >
              <Copy size={14} strokeWidth={2.3} />
            </button>
          </div>

          <div
            style="min-height: 132px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-field-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 12px 14px; color: var(--ui-secondary-text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 21px;"
          >
            Prompts for code review, refactoring, and implementation planning.
          </div>
        </div>
      </section>

      <section style="display: grid; gap: 14px; min-width: 0;">
        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 18px;"
        >
          <div style="display: grid; gap: 8px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span
                style="display: inline-flex; height: 30px; width: 30px; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: var(--ui-accent-icon-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); color: var(--ui-accent-icon-glyph);"
              >
                <FileText size={16} strokeWidth={2.4} />
              </span>
              <h2 style="margin: 0; color: var(--ui-normal-text); font-size: 24px; line-height: 32px;">
                Prompts
              </h2>
            </div>
            <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
              2 reusable prompts in this folder, ready to copy or reorder.
            </p>
          </div>

          <button
            type="button"
            style="display: inline-flex; height: 32px; align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); padding: 0 10px; color: var(--ui-secondary-text); font: inherit; font-size: 12px; font-weight: 700;"
          >
            Sort
            <ChevronDown size={14} strokeWidth={2.3} />
          </button>
        </div>

        <div style="height: 1px; background: var(--ui-neutral-muted-border);"></div>

        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px;"
        >
          <div style="height: 1px; background: linear-gradient(90deg, transparent, var(--ui-neutral-emphasis-border), transparent);"></div>
          <div
            style="display: grid; grid-template-columns: repeat(2, auto); align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 999px; background: oklch(0.18 0.014 266 / 82%); padding: 5px;"
          >
            {#each addRows as action (action.label)}
              {@const ActionIcon = action.icon}
              <button
                type="button"
                style="display: inline-flex; height: 30px; align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-normal-surface); padding: 0 11px; color: var(--ui-hoverable-text); font: inherit; font-size: 12px; font-weight: 800;"
              >
                <ActionIcon size={14} strokeWidth={2.5} />
                {action.label}
              </button>
            {/each}
          </div>
        </div>

        {#each prompts as prompt, index (prompt.title)}
          <article
            style="box-sizing: border-box; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; min-width: 0; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 16px 34px var(--ui-card-normal-shadow); padding: 10px;"
          >
            <div
              style="display: grid; align-content: start; justify-items: center; gap: 8px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); padding: 8px 0; color: var(--ui-muted-text);"
            >
              <GripVertical size={16} strokeWidth={2.2} />
              <span style="font-size: 11px; font-weight: 800;">{index + 1}</span>
            </div>

            <div style="display: grid; gap: 8px; min-width: 0;">
              <div
                style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 8px 8px 8px 10px;"
              >
                <div style="display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 10px; min-width: 0;">
                  <span
                    style="display: inline-flex; height: 40px; width: 40px; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph);"
                  >
                    <FileText size={18} strokeWidth={2.4} />
                  </span>
                  <div style="display: grid; gap: 4px; min-width: 0;">
                    <p style="margin: 0; overflow: hidden; color: var(--ui-normal-text); font-size: 15px; font-weight: 700; line-height: 22px; text-overflow: ellipsis; white-space: nowrap;">
                      {prompt.title}
                    </p>
                    <div
                      style="display: flex; min-width: 0; align-items: center; gap: 7px; overflow: hidden; color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px; white-space: nowrap;"
                    >
                      <span style="display: inline-flex; min-width: 0; align-items: center; gap: 5px; color: var(--ui-secondary-text);">
                        <Folder size={12} strokeWidth={2.4} />
                        Refactoring
                      </span>
                      <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                      <span>{prompt.lines} lines</span>
                      <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                      <span>{prompt.tokens} tokens</span>
                      <span style="height: 3px; width: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"></span>
                      <span>0 min ago</span>
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <button
                    type="button"
                    aria-label="Copy prompt"
                    title="Copy prompt"
                    style="display: inline-flex; height: 30px; width: 30px; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text);"
                  >
                    <Copy size={14} strokeWidth={2.3} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete prompt"
                    title="Delete prompt"
                    style="display: inline-flex; height: 30px; width: 30px; align-items: center; justify-content: center; border: 1px solid var(--ui-danger-normal-border); border-radius: 7px; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph);"
                  >
                    <Trash2 size={14} strokeWidth={2.3} />
                  </button>
                </div>
              </div>

              <div
                style="min-height: 112px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-field-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 12px 14px; color: var(--ui-secondary-text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 21px;"
              >
                {prompt.text}
              </div>
            </div>
          </article>

          <div
            style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px;"
          >
            <div style="height: 1px; background: linear-gradient(90deg, transparent, var(--ui-neutral-normal-border), transparent);"></div>
            <div
              style="display: grid; grid-template-columns: repeat(2, auto); align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: oklch(0.15 0.012 266 / 72%); padding: 5px;"
            >
              {#each addRows as action (action.label)}
                {@const ActionIcon = action.icon}
                <button
                  type="button"
                  style="display: inline-flex; height: 28px; align-items: center; gap: 7px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: transparent; padding: 0 10px; color: var(--ui-secondary-text); font: inherit; font-size: 12px; font-weight: 750;"
                >
                  <ActionIcon size={13} strokeWidth={2.5} />
                  {action.label}
                </button>
              {/each}
              <button
                type="button"
                aria-label="More add options"
                title="More add options"
                style="display: inline-flex; height: 28px; width: 28px; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: transparent; color: var(--ui-muted-text);"
              >
                <MoreHorizontal size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        {/each}
      </section>
    </div>
  </div>
</main>
