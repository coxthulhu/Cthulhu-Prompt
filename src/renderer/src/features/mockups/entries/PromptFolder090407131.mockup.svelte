<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { Copy, FileText, Folder, Plus, Settings, Trash2 } from 'lucide-svelte'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'

  type PromptCard = {
    title: string
    folderLabel: string
    lines: string
    tokens: string
    updated: string
    body: string
  }

  const prompts: PromptCard[] = [
    {
      title: 'Implementation Plan',
      folderLabel: 'Release Workflow',
      lines: '18 lines',
      tokens: '426 tokens',
      updated: '4 min ago',
      body: `You are helping implement a focused feature in an existing Electron + Svelte application.

Read the surrounding code first, preserve the current interaction model, and keep the change tightly scoped.

Before finishing, run lint and typecheck, then summarize the files changed and any remaining risk.`
    },
    {
      title: 'Review Checklist',
      folderLabel: 'Release Workflow',
      lines: '11 lines',
      tokens: '292 tokens',
      updated: '12 min ago',
      body: `Review this change as a senior engineer.

Prioritize correctness, state handling, regressions, and missing coverage. Put findings first with file and line references, then keep the summary brief.`
    },
    {
      title: 'Playwright Repro',
      folderLabel: 'Release Workflow',
      lines: '14 lines',
      tokens: '338 tokens',
      updated: '24 min ago',
      body: `Create a Playwright test that reproduces the UI behavior before changing implementation code.

Use the existing test helpers and data-testid selectors. Keep the test focused on the user-visible workflow.`
    }
  ]

  const descriptionText = `Reusable prompts for planning, review, and test coverage during release work.

Keep entries concise and update examples when app workflows change.`

  const screenStyle =
    "box-sizing:border-box;display:flex;min-height:920px;min-width:0;width:100%;flex-direction:column;color:var(--ui-normal-text);font-family:Aptos,'Segoe UI Variable','Segoe UI',sans-serif;"
  const topBarStyle =
    'box-sizing:border-box;display:flex;height:36px;flex:0 0 auto;align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);background:#121316;padding:0 24px;'
  const breadcrumbStyle =
    'display:flex;min-width:0;align-items:center;color:var(--ui-muted-text);font-size:14px;font-weight:500;line-height:20px;'
  const contentStyle =
    'box-sizing:border-box;display:grid;gap:24px;min-width:0;padding:24px 0 32px 0;'
  const sectionHeaderStyle =
    'box-sizing:border-box;display:grid;gap:8px;min-width:0;border-left:3px solid var(--ui-accent-normal-border);padding-left:16px;'
  const sectionTitleRowStyle = 'display:flex;align-items:center;gap:10px;min-width:0;'
  const sectionTitleStyle =
    'margin:0;min-width:0;color:var(--ui-normal-text);font-size:24px;font-weight:760;line-height:32px;'
  const sectionDescriptionStyle =
    'margin:0;min-width:0;color:var(--ui-muted-text);font-size:14px;line-height:20px;'
  const cardStyle =
    'box-sizing:border-box;display:grid;gap:10px;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:8px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));padding:10px;'
  const descriptionCardStyle =
    'box-sizing:border-box;display:grid;gap:10px;min-width:0;border:1px solid var(--ui-accent-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:inset 3px 0 0 var(--ui-accent-normal-border);padding:10px 10px 10px 13px;'
  const promptTitleBarStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:8px 8px 8px 10px;'
  const descriptionTitleBarStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:10px;'
  const titleMainStyle =
    'display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:10px;min-width:0;'
  const titleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const titleTextStyle =
    'margin:0;min-width:0;height:22px;color:var(--ui-normal-text);font-size:15px;font-weight:600;line-height:20px;'
  const metadataStyle =
    'display:flex;min-width:0;align-items:center;gap:7px;overflow:hidden;color:var(--ui-muted-text);font-size:11px;font-weight:750;line-height:16px;white-space:nowrap;'
  const metadataFolderStyle =
    'display:inline-flex;max-width:220px;min-width:0;flex:0 1 auto;align-items:center;gap:5px;overflow:hidden;color:var(--ui-secondary-text);text-overflow:ellipsis;white-space:nowrap;'
  const dotStyle =
    'display:inline-block;height:3px;width:3px;flex:0 0 auto;border-radius:999px;background:var(--ui-neutral-emphasis-border);'
  const iconButtonRowStyle = 'display:flex;flex:0 0 auto;align-items:center;gap:6px;'
  const iconButtonStyle =
    'box-sizing:border-box;display:inline-flex;height:32px;width:32px;align-items:center;justify-content:center;border:1px solid var(--ui-accent-normal-border);border-radius:7px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);'
  const dangerButtonStyle =
    'box-sizing:border-box;display:inline-flex;height:32px;width:32px;align-items:center;justify-content:center;border:1px solid var(--ui-danger-normal-border);border-radius:7px;background:var(--ui-danger-normal-surface);color:var(--ui-danger-icon-glyph);'
  const editorStyle =
    "box-sizing:border-box;min-height:154px;min-width:0;white-space:pre-wrap;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-card-nested-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-secondary-text);font-family:'Cascadia Code',Consolas,monospace;font-size:13px;line-height:20px;padding:13px 14px;"
  const dividerStyle =
    'display:grid;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);align-items:center;gap:10px;min-height:36px;'
  const lineStyle = 'height:1px;min-width:0;background:var(--ui-neutral-muted-border);'
  const addButtonStyle =
    'box-sizing:border-box;display:inline-flex;height:30px;align-items:center;gap:7px;border:1px solid var(--ui-accent-normal-border);border-radius:999px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);font-size:12px;font-weight:760;line-height:16px;padding:0 12px;'
</script>

<main style={screenStyle} data-testid="prompt-folder-screen">
  <div style={topBarStyle}>
    <div style={breadcrumbStyle}>
      <button
        type="button"
        style="min-width:0;cursor:pointer;overflow:hidden;border:0;background:transparent;color:var(--ui-muted-text);font:inherit;text-overflow:ellipsis;white-space:nowrap;"
      >
        Release Workflow
      </button>
      <span style="padding:0 12px;color:var(--ui-neutral-emphasis-border);">/</span>
      <button
        type="button"
        style="cursor:pointer;border:0;background:transparent;color:var(--ui-secondary-text);font:inherit;white-space:nowrap;"
      >
        Folder Settings
      </button>
    </div>
  </div>

  <div style="min-height:0;flex:1 1 auto;overflow-y:auto;">
    <div style={contentStyle}>
      <section style="display:grid;gap:24px;min-width:0;">
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleRowStyle}>
            {@render accentIconTile(Settings, 'small')}
            <h1 style={sectionTitleStyle}>Folder Settings</h1>
          </div>
          <p style={sectionDescriptionStyle}>
            Settings that only affect prompts in this folder, and are saved to the workspace.
          </p>
        </div>

        <article style={descriptionCardStyle}>
          <div style={descriptionTitleBarStyle}>
            <div style={titleMainStyle}>
              {@render accentIconTile(Folder, 'medium')}
              <div style={titleCopyStyle}>
                <p style={titleTextStyle}>Folder Description</p>
                <div style={metadataStyle}>
                  <span style={metadataFolderStyle}>
                    <Folder size={12} strokeWidth={2.4} />
                    Folder Settings
                  </span>
                  <span style={dotStyle}></span>
                  <span>3 lines</span>
                  <span style={dotStyle}></span>
                  <span>42 tokens</span>
                  <span style={dotStyle}></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>

            <div style={iconButtonRowStyle}>
              <button
                type="button"
                aria-label="Copy folder description"
                title="Copy folder description"
                style={iconButtonStyle}
              >
                <Copy size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <InfoRow
            text="A simple description of this folder and its purpose. Not used for any prompting functionality."
          />

          <MessageRow text="Review this warning message row before saving." variant="warning" />

          <div style={editorStyle}>{descriptionText}</div>
        </article>
      </section>

      <section style="display:grid;gap:0;min-width:0;padding-top:0;">
        <div style="padding:0 0 4px 0;">
          <div style={sectionHeaderStyle}>
            <div style={sectionTitleRowStyle}>
              {@render accentIconTile(FileText, 'small')}
              <h2 style={sectionTitleStyle}>Prompts</h2>
            </div>
            <p style={sectionDescriptionStyle}>
              Create, edit, and organize prompts in this folder.
            </p>
          </div>
        </div>

        {@render divider()}

        {#each prompts as prompt (prompt.title)}
          <article style={cardStyle}>
            <div style={promptTitleBarStyle}>
              <div style={titleMainStyle}>
                {@render accentIconTile(FileText, 'medium')}
                <div style={titleCopyStyle}>
                  <p style={titleTextStyle}>{prompt.title}</p>
                  <div style={metadataStyle}>
                    <span style={metadataFolderStyle}>
                      <Folder size={12} strokeWidth={2.4} />
                      {prompt.folderLabel}
                    </span>
                    <span style={dotStyle}></span>
                    <span>{prompt.lines}</span>
                    <span style={dotStyle}></span>
                    <span>{prompt.tokens}</span>
                    <span style={dotStyle}></span>
                    <span>{prompt.updated}</span>
                  </div>
                </div>
              </div>

              <div style={iconButtonRowStyle}>
                <button
                  type="button"
                  aria-label="Copy prompt"
                  title="Copy prompt"
                  style={iconButtonStyle}
                >
                  <Copy size={16} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Delete prompt"
                  title="Delete prompt"
                  style={dangerButtonStyle}
                >
                  <Trash2 size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div style={editorStyle}>{prompt.body}</div>
          </article>

          {@render divider()}
        {/each}
      </section>
    </div>
  </div>
</main>

{#snippet accentIconTile(Icon: ComponentType, size: 'small' | 'medium')}
  <span
    style={`box-sizing:border-box;display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;border:1px solid var(--ui-accent-icon-ring);border-radius:7px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);height:${size === 'small' ? '30px' : '36px'};width:${size === 'small' ? '30px' : '36px'};`}
  >
    <Icon size={size === 'small' ? 16 : 18} strokeWidth={2.4} />
  </span>
{/snippet}

{#snippet divider()}
  <div style="display:grid;height:56px;align-items:center;">
    <div style={dividerStyle}>
      <span style={lineStyle}></span>
      <button type="button" style={addButtonStyle}>
        <Plus size={14} strokeWidth={3} />
        Add prompt
      </button>
      <span style={lineStyle}></span>
    </div>
  </div>
{/snippet}
