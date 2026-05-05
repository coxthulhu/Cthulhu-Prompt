<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    Plus,
    Settings
  } from 'lucide-svelte'
  import PromptEditorCardSurface from '../../prompt-editor/PromptEditorCardSurface.svelte'
  import PromptEditorTitleBar from '../../prompt-editor/PromptEditorTitleBar.svelte'

  type PromptCard = {
    title: string
    text: string
    lines: string[]
  }

  const folderDescription = [
    'Shared prompts for coding agents, release notes, and review passes.',
    'Keep entries short enough to copy quickly and specific enough to reuse.'
  ]

  const prompts: PromptCard[] = [
    {
      title: 'Implementation Pass',
      text: 'Read the changed files, preserve existing behavior, and make the smallest useful update.',
      lines: [
        'Read the changed files before editing.',
        'Preserve existing behavior unless the request says otherwise.',
        'Run the focused checks that cover the changed surface.'
      ]
    },
    {
      title: 'Review Pass',
      text: 'Prioritize behavioral regressions, missed edge cases, and missing tests.',
      lines: [
        'Prioritize bugs, regressions, and missing tests.',
        'Call out exact files and line references.',
        'Keep summaries secondary to findings.'
      ]
    }
  ]
</script>

<main
  style="box-sizing: border-box; width: 100%; min-width: 0; padding: 0 8px 48px; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <div
    style="box-sizing: border-box; display: grid; grid-template-columns: minmax(168px, 0.22fr) minmax(0, 1fr); gap: 28px; width: min(100%, 1180px); margin: 0 auto;"
  >
    <aside
      aria-label="Folder sections"
      style="position: sticky; top: 64px; align-self: start; display: grid; gap: 10px; min-width: 0; padding-top: 24px;"
    >
      <button
        type="button"
        style="appearance: none; display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 10px; width: 100%; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: linear-gradient(135deg, var(--ui-accent-normal-surface), oklch(0.33 0.09 286 / 20%)); color: var(--ui-accent-normal-text); padding: 10px; font: inherit; font-size: 13px; font-weight: 750; text-align: left; box-shadow: inset 0 1px 0 oklch(1 0 0 / 10%);"
      >
        <Settings size={16} strokeWidth={2.4} style="justify-self: center;" />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Folder Settings
        </span>
      </button>

      <button
        type="button"
        style="appearance: none; display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 10px; width: 100%; border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 10px; font: inherit; font-size: 13px; font-weight: 750; text-align: left;"
      >
        <FileText size={16} strokeWidth={2.4} style="justify-self: center;" />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Prompts</span>
      </button>
    </aside>

    <section style="display: grid; min-width: 0; gap: 18px;">
      <div style="display: grid; gap: 24px; min-width: 0; padding-top: 24px;">
        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 16px; min-width: 0; border-bottom: 1px solid var(--ui-neutral-muted-border); padding-bottom: 14px;"
        >
          <div style="display: grid; gap: 8px; min-width: 0;">
            <h1
              style="margin: 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 700; line-height: 32px;"
            >
              Folder Settings
            </h1>
            <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
              Settings that only affect prompts in this folder, and are saved to the workspace.
            </p>
          </div>
          <div
            style="display: inline-flex; align-items: center; gap: 7px; min-height: 30px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 0 11px; font-size: 12px; font-weight: 750;"
          >
            <Folder size={13} strokeWidth={2.4} />
            Coding Agents
          </div>
        </div>

        <PromptEditorCardSurface>
          <PromptEditorTitleBar
            title="Folder Description"
            draftText={folderDescription.join('\n')}
            metadataFolderLabel="Folder Settings"
            icon={Folder}
            copyLabel="Copy folder description"
            copyTitle="Copy folder description"
          />

          <div style="min-width: 0;">
            <div
              style="box-sizing: border-box; min-height: 118px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-field-surface); color: var(--ui-secondary-text); padding: 13px 14px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 20px; white-space: pre-wrap; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
            >
              {folderDescription.join('\n')}
            </div>
          </div>
        </PromptEditorCardSurface>
      </div>

      <div
        style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; min-width: 0; margin-top: 4px; border-bottom: 1px solid var(--ui-neutral-muted-border); padding: 12px 0 14px;"
      >
        <h2
          style="margin: 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 700; line-height: 32px;"
        >
          Prompts
        </h2>
        <div
          style="display: inline-flex; align-items: center; gap: 8px; color: var(--ui-muted-text); font-size: 12px; font-weight: 750;"
        >
          <span
            style="display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text);"
          >
            2
          </span>
        </div>
      </div>

      <div style="display: grid; gap: 14px; min-width: 0;">
        <div
          style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0;"
        >
          <span style="height: 1px; background: var(--ui-neutral-muted-border);"></span>
          <button
            type="button"
            style="appearance: none; display: inline-flex; align-items: center; gap: 7px; height: 28px; border: 1px solid var(--ui-accent-normal-border); border-radius: 999px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 11px; font: inherit; font-size: 12px; font-weight: 800;"
          >
            <Plus size={14} strokeWidth={3} />
            Prompt
          </button>
          <button
            type="button"
            style="appearance: none; display: inline-flex; align-items: center; gap: 7px; height: 28px; border: 1px solid var(--ui-info-normal-border); border-radius: 999px; background: var(--ui-info-normal-surface); color: var(--ui-hoverable-text); padding: 0 11px; font: inherit; font-size: 12px; font-weight: 800;"
          >
            <FolderPlus size={14} strokeWidth={2.6} />
            Prompt subfolder
          </button>
          <span style="height: 1px; background: var(--ui-neutral-muted-border);"></span>
        </div>

        {#each prompts as prompt, index (prompt.title)}
          <PromptEditorCardSurface
            style="height: 236px; min-height: 236px; max-height: 236px;"
            data-testid={`prompt-editor-mockup-${index + 1}`}
          >
            {#snippet sidebar()}
              <div
                style="display: grid; flex: 0 0 34px; gap: 6px; grid-template-rows: 32px minmax(0, 1fr) 32px; height: 100%; min-height: 136px; width: 34px;"
              >
                <button
                  type="button"
                  aria-label="Move prompt up"
                  disabled={index === 0}
                  style="appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 32px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); opacity: {index ===
                  0
                    ? 0.45
                    : 1};"
                >
                  <ChevronUp size={16} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Drag prompt"
                  style="appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; min-height: 0; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: linear-gradient(180deg, var(--ui-neutral-normal-surface), var(--ui-neutral-muted-surface)); color: var(--ui-muted-text);"
                >
                  <GripVertical size={17} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label="Move prompt down"
                  disabled={index === prompts.length - 1}
                  style="appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 32px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); opacity: {index ===
                  prompts.length - 1
                    ? 0.45
                    : 1};"
                >
                  <ChevronDown size={16} strokeWidth={2.4} />
                </button>
              </div>
            {/snippet}

            <PromptEditorTitleBar
              title={prompt.title}
              draftText={prompt.text}
              promptFolderCount={index + 1}
              onTitleChange={() => {}}
              onDelete={() => {}}
            />

            <div style="min-width: 0;">
              <div
                style="box-sizing: border-box; min-height: 128px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-field-surface); color: var(--ui-secondary-text); padding: 13px 14px 14px 14px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 20px; white-space: pre-wrap; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
              >
                {prompt.lines.join('\n')}
              </div>
            </div>
          </PromptEditorCardSurface>

          <div
            style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0;"
          >
            <span style="height: 1px; background: var(--ui-neutral-muted-border);"></span>
            <button
              type="button"
              style="appearance: none; display: inline-flex; align-items: center; gap: 7px; height: 28px; border: 1px solid var(--ui-accent-normal-border); border-radius: 999px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 11px; font: inherit; font-size: 12px; font-weight: 800;"
            >
              <Plus size={14} strokeWidth={3} />
              Prompt
            </button>
            <button
              type="button"
              style="appearance: none; display: inline-flex; align-items: center; gap: 7px; height: 28px; border: 1px solid var(--ui-info-normal-border); border-radius: 999px; background: var(--ui-info-normal-surface); color: var(--ui-hoverable-text); padding: 0 11px; font: inherit; font-size: 12px; font-weight: 800;"
            >
              <FolderPlus size={14} strokeWidth={2.6} />
              Prompt subfolder
            </button>
            <span style="height: 1px; background: var(--ui-neutral-muted-border);"></span>
          </div>
        {/each}
      </div>
    </section>
  </div>
</main>
