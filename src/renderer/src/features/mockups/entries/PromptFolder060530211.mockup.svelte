<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    Plus,
    Trash2
  } from 'lucide-svelte'

  const promptCards = [
    {
      title: 'Refactor checklist',
      lines: [
        'Review the surrounding module before changing behavior.',
        'Keep the edit scoped to the selected prompt folder.',
        'Verify the changed flow with the fastest relevant test.'
      ],
      linesLabel: '14 lines',
      tokensLabel: '326 tokens',
      updatedLabel: '2 min ago'
    },
    {
      title: 'Bug report template',
      lines: [
        'Summarize the visible failure and expected behavior.',
        'Include the smallest reproduction path.',
        'List logs, screenshots, and version details only when they matter.'
      ],
      linesLabel: '11 lines',
      tokensLabel: '248 tokens',
      updatedLabel: '8 min ago'
    }
  ]

  const pageShellStyle =
    'box-sizing:border-box;width:100%;min-width:0;color:var(--ui-normal-text);font-family:Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;'
  const headerBarStyle =
    'display:flex;height:36px;align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);background:oklch(0.145 0.011 266.847 / 72%);padding:0 24px;'
  const contentStyle =
    'box-sizing:border-box;display:grid;gap:18px;max-width:1080px;min-width:0;padding:24px 28px 72px;width:100%;'
  const sectionHeaderStyle =
    'align-items:end;border-bottom:1px solid var(--ui-neutral-muted-border);display:grid;gap:16px;grid-template-columns:minmax(0, 1fr) auto;min-width:0;padding:4px 0 12px;'
  const sectionTitleStyle =
    'color:var(--ui-normal-text);font-size:24px;font-weight:700;letter-spacing:0;line-height:32px;margin:0;'
  const sectionMetaStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;font-size:12px;font-weight:750;gap:8px;line-height:16px;white-space:nowrap;'
  const cardStyle =
    'align-items:stretch;background-image:linear-gradient(to bottom, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end));background-repeat:no-repeat;border:1px solid var(--ui-card-normal-border);border-radius:var(--cthulhu-ui-radius-card);box-shadow:none;box-sizing:border-box;display:grid;gap:10px;min-width:0;padding:10px;'
  const promptCardStyle = `${cardStyle}grid-template-columns:34px minmax(0, 1fr);`
  const cardBodyStyle =
    'align-content:start;display:grid;gap:8px;grid-template-rows:auto auto;min-width:0;'
  const titleBarStyle =
    'align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:grid;gap:12px;grid-template-columns:minmax(0, 1fr) auto;min-width:0;padding:8px 8px 8px 10px;'
  const titleMainStyle =
    'align-items:center;display:grid;gap:10px;grid-template-columns:40px minmax(0, 1fr);min-width:0;'
  const iconTileStyle =
    'align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:7px;box-shadow:0 0 0 1px var(--ui-accent-icon-ring) inset;color:var(--ui-accent-icon-glyph);display:flex;height:40px;justify-content:center;width:40px;'
  const titleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const titleTextStyle =
    'background:transparent;border:0;color:var(--ui-normal-text);font:inherit;font-size:15px;font-weight:700;height:22px;line-height:20px;margin:0;min-width:0;overflow:hidden;padding:0;text-overflow:ellipsis;white-space:nowrap;width:100%;'
  const metadataRowStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:11px;font-weight:750;gap:7px;line-height:16px;min-width:0;overflow:hidden;white-space:nowrap;'
  const metadataFolderStyle =
    'align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:5px;max-width:220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const metadataDotStyle =
    'background:var(--ui-neutral-emphasis-border);border-radius:999px;flex:0 0 auto;height:3px;width:3px;'
  const buttonRailStyle =
    'align-items:center;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-muted-border);border-radius:var(--cthulhu-ui-radius-icon-button);box-shadow:var(--cthulhu-ui-shadow-surface-highlight);color:var(--ui-secondary-text);display:inline-flex;height:32px;justify-content:center;width:32px;'
  const copyButtonStyle =
    'align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:var(--cthulhu-ui-radius-icon-button);box-shadow:var(--cthulhu-ui-shadow-surface-highlight);color:var(--ui-accent-normal-text);display:inline-flex;height:36px;justify-content:center;width:36px;'
  const deleteButtonStyle =
    'align-items:center;background:var(--ui-danger-normal-surface);border:1px solid var(--ui-danger-normal-border);border-radius:var(--cthulhu-ui-radius-icon-button);box-shadow:var(--cthulhu-ui-shadow-surface-highlight);color:var(--ui-danger-icon-glyph);display:inline-flex;height:36px;justify-content:center;width:36px;'
  const editorStyle =
    'background:#1e1e1e;box-sizing:border-box;color:oklch(1 0 0 / 78%);font-family:"Cascadia Code", Consolas, monospace;font-size:13px;line-height:21px;min-height:148px;overflow:hidden;padding:14px 16px;position:relative;white-space:pre-wrap;'
  const sidebarStyle =
    'display:grid;flex:0 0 34px;gap:6px;grid-template-rows:32px minmax(0, 1fr) 32px;height:100%;min-height:136px;width:34px;'
  const addRowStyle =
    'align-items:center;display:grid;gap:12px;grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr);min-height:42px;'
  const addLineStyle = 'background:var(--ui-neutral-muted-border);height:1px;min-width:0;'
  const addControlsStyle =
    'align-items:center;background:oklch(0.178 0.017 232 / 92%);border:1px solid oklch(0.698 0.124 198 / 32%);border-radius:999px;box-shadow:0 12px 30px oklch(0 0 0 / 20%), inset 0 1px 0 oklch(1 0 0 / 10%);display:flex;gap:4px;padding:4px;'
  const addButtonStyle =
    'align-items:center;background:transparent;border:0;border-radius:999px;color:var(--ui-secondary-text);display:inline-flex;font:inherit;font-size:12px;font-weight:800;gap:7px;height:30px;line-height:16px;padding:0 11px;white-space:nowrap;'
  const addButtonPrimaryStyle =
    'align-items:center;background:oklch(0.65 0.132 190 / 26%);border:1px solid oklch(0.76 0.132 190 / 38%);border-radius:999px;color:oklch(0.955 0.036 190);display:inline-flex;font:inherit;font-size:12px;font-weight:800;gap:7px;height:30px;line-height:16px;padding:0 12px;white-space:nowrap;'
</script>

<div style={pageShellStyle}>
  <div style={headerBarStyle}>
    <div
      style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:14px;font-weight:600;min-width:0;"
    >
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        Engineering prompts
      </span>
      <span style="color:oklch(1 0 0 / 24%);padding:0 12px;">/</span>
      <span style="color:var(--ui-hoverable-text);white-space:nowrap;">Folder Settings</span>
    </div>
  </div>

  <div style={contentStyle}>
    <section style="display:grid;gap:18px;min-width:0;">
      <div style={sectionHeaderStyle}>
        <div style="display:grid;gap:8px;min-width:0;">
          <h1 style={sectionTitleStyle}>Folder Settings</h1>
          <p style="color:var(--ui-muted-text);font-size:14px;line-height:20px;margin:0;">
            Settings that only affect prompts in this folder, and are saved to the workspace.
          </p>
        </div>
        <div style={sectionMetaStyle}>
          <Folder size={14} strokeWidth={2.4} />
          <span>Engineering prompts</span>
        </div>
      </div>

      <div style={`${cardStyle}grid-template-columns:minmax(0, 1fr);`}>
        <div style={cardBodyStyle}>
          <div style={titleBarStyle}>
            <div style={titleMainStyle}>
              <div style={iconTileStyle}>
                <Folder size={18} strokeWidth={2.4} />
              </div>
              <div style={titleCopyStyle}>
                <p style={titleTextStyle}>Folder Description</p>
                <div style={metadataRowStyle}>
                  <span style={metadataFolderStyle}>
                    <Folder size={12} strokeWidth={2.4} />
                    Folder Settings
                  </span>
                  <span style={metadataDotStyle}></span>
                  <span>6 lines</span>
                  <span style={metadataDotStyle}></span>
                  <span>144 tokens</span>
                  <span style={metadataDotStyle}></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>

            <div style="align-items:center;display:flex;gap:6px;">
              <button aria-label="Copy folder description" style={copyButtonStyle} title="Copy folder description" type="button">
                <Copy size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div style={`${editorStyle}min-height:120px;`}>
            Prompts for implementation planning, refactoring, and bug investigation.
            Keep entries short enough to scan and specific enough to copy directly.
          </div>
        </div>
      </div>
    </section>

    <section style="display:grid;gap:0;min-width:0;padding-top:8px;">
      <div style={`${sectionHeaderStyle}margin-bottom:12px;`}>
        <h2 style={sectionTitleStyle}>Prompts</h2>
        <div style={sectionMetaStyle}>
          <span>2 prompts</span>
          <span style={metadataDotStyle}></span>
          <span>1 subfolder</span>
        </div>
      </div>

      <div style={addRowStyle}>
        <span style={addLineStyle}></span>
        <div style={addControlsStyle}>
          <button style={addButtonPrimaryStyle} type="button">
            <Plus size={14} strokeWidth={2.6} />
            Prompt
          </button>
          <button style={addButtonStyle} type="button">
            <FolderPlus size={14} strokeWidth={2.6} />
            Subfolder
          </button>
        </div>
        <span style={addLineStyle}></span>
      </div>

      {#each promptCards as prompt, index (prompt.title)}
        <article style={promptCardStyle}>
          <div style={sidebarStyle}>
            <button
              aria-label="Move prompt up"
              disabled={index === 0}
              style={`${buttonRailStyle}${index === 0 ? 'opacity:0.5;' : ''}`}
              type="button"
            >
              <ChevronUp size={16} strokeWidth={2.4} />
            </button>
            <button aria-label="Drag prompt" style={`${buttonRailStyle}height:100%;`} type="button">
              <GripVertical size={16} strokeWidth={2.5} />
            </button>
            <button
              aria-label="Move prompt down"
              disabled={index === promptCards.length - 1}
              style={`${buttonRailStyle}${index === promptCards.length - 1 ? 'opacity:0.5;' : ''}`}
              type="button"
            >
              <ChevronDown size={16} strokeWidth={2.4} />
            </button>
          </div>

          <div style={cardBodyStyle}>
            <div style={titleBarStyle}>
              <div style={titleMainStyle}>
                <div style={iconTileStyle}>
                  <FileText size={18} strokeWidth={2.4} />
                </div>
                <div style={titleCopyStyle}>
                  <p style={titleTextStyle}>{prompt.title}</p>
                  <div style={metadataRowStyle}>
                    <span style={metadataFolderStyle}>
                      <Folder size={12} strokeWidth={2.4} />
                      Engineering prompts
                    </span>
                    <span style={metadataDotStyle}></span>
                    <span>{prompt.linesLabel}</span>
                    <span style={metadataDotStyle}></span>
                    <span>{prompt.tokensLabel}</span>
                    <span style={metadataDotStyle}></span>
                    <span>{prompt.updatedLabel}</span>
                  </div>
                </div>
              </div>

              <div style="align-items:center;display:flex;gap:6px;">
                <button aria-label="Copy prompt" style={copyButtonStyle} title="Copy prompt" type="button">
                  <Copy size={16} strokeWidth={2.4} />
                </button>
                <button aria-label="Delete prompt" style={deleteButtonStyle} title="Delete prompt" type="button">
                  <Trash2 size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div style={editorStyle}>{prompt.lines.join('\n')}</div>
          </div>
        </article>

        <div style={addRowStyle}>
          <span style={addLineStyle}></span>
          <div style={addControlsStyle}>
            <button style={addButtonPrimaryStyle} type="button">
              <Plus size={14} strokeWidth={2.6} />
              Prompt
            </button>
            <button style={addButtonStyle} type="button">
              <FolderPlus size={14} strokeWidth={2.6} />
              Subfolder
            </button>
          </div>
          <span style={addLineStyle}></span>
        </div>
      {/each}
    </section>
  </div>
</div>
