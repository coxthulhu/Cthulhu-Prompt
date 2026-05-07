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
    Settings,
    Trash2
  } from 'lucide-svelte'

  const prompts = [
    {
      title: 'API review checklist',
      body: 'Review the request flow, input validation, failure handling, and persistence boundaries. Call out any behavior that is ambiguous or under-tested.'
    },
    {
      title: 'Renderer polish pass',
      body: 'Inspect the current Svelte screen for layout shifts, weak affordances, missing loading states, and unclear control labels. Keep recommendations concrete.'
    },
    {
      title: 'Release note draft',
      body: 'Summarize the change for users in a short release note. Focus on the workflow improvement and any behavior that changed.'
    }
  ]

  const shellStyle =
    'box-sizing:border-box;display:flex;flex-direction:column;min-height:100%;min-width:0;color:var(--ui-normal-text);'
  const headerStyle =
    'align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);display:flex;height:36px;min-height:36px;padding:0 24px;'
  const contentStyle =
    'box-sizing:border-box;display:grid;gap:18px;grid-template-columns:minmax(0,1fr);margin:0 auto;max-width:1020px;min-width:0;padding:22px 28px 64px;width:100%;'
  const sectionHeaderStyle =
    'align-items:end;display:grid;gap:14px;grid-template-columns:minmax(0,1fr) auto;min-width:0;padding:4px 0 2px;'
  const sectionTitleWrapStyle =
    'align-items:center;display:grid;gap:11px;grid-template-columns:34px minmax(0,1fr);min-width:0;'
  const sectionIconStyle =
    'align-items:center;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);border-radius:8px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:flex;height:34px;justify-content:center;width:34px;'
  const sectionTitleStyle =
    'color:var(--ui-normal-text);font-size:24px;font-weight:700;letter-spacing:0;line-height:32px;margin:0;'
  const sectionMetaStyle =
    'color:var(--ui-muted-text);font-size:12px;font-weight:750;line-height:16px;margin:0;text-transform:uppercase;'
  const cardPlainStyle =
    'align-items:stretch;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));background-repeat:no-repeat;border:1px solid var(--ui-card-normal-border);border-radius:var(--cthulhu-ui-radius-card);box-shadow:none;box-sizing:border-box;display:grid;gap:10px;grid-template-columns:minmax(0,1fr);min-width:0;padding:10px;'
  const cardSidebarStyle =
    'align-items:stretch;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));background-repeat:no-repeat;border:1px solid var(--ui-card-normal-border);border-radius:var(--cthulhu-ui-radius-card);box-shadow:none;box-sizing:border-box;display:grid;gap:10px;grid-template-columns:34px minmax(0,1fr);min-height:228px;min-width:0;padding:10px;'
  const cardBodyStyle =
    'align-content:start;display:grid;gap:8px;grid-template-rows:auto auto;min-width:0;'
  const titleBarStyle =
    'align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:grid;gap:12px;grid-template-columns:minmax(0,1fr) auto;min-width:0;padding:8px 8px 8px 10px;'
  const titleMainStyle =
    'align-items:center;display:grid;gap:10px;grid-template-columns:40px minmax(0,1fr);min-width:0;'
  const accentTileStyle =
    'align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-icon-ring);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:flex;height:40px;justify-content:center;width:40px;'
  const titleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const titleTextStyle =
    'background:transparent;border:0;color:var(--ui-normal-text);font-family:inherit;font-size:15px;font-weight:700;height:22px;line-height:20px;margin:0;min-width:0;outline:none;overflow:hidden;padding:0;text-overflow:ellipsis;white-space:nowrap;width:100%;'
  const metadataStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:11px;font-weight:750;gap:7px;line-height:16px;min-width:0;overflow:hidden;white-space:nowrap;'
  const metadataFolderStyle =
    'align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:5px;max-width:220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const dotStyle =
    'background:var(--ui-neutral-emphasis-border);border-radius:999px;flex:0 0 auto;height:3px;width:3px;'
  const iconButtonStyle =
    'align-items:center;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);border-radius:7px;color:var(--ui-hoverable-text);display:flex;height:30px;justify-content:center;padding:0;width:30px;'
  const sidebarStyle =
    'display:grid;flex:0 0 34px;gap:6px;grid-template-rows:32px minmax(0,1fr) 32px;height:100%;min-height:136px;width:34px;'
  const railButtonStyle =
    'align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-neutral-muted-border);border-radius:7px;color:var(--ui-secondary-text);display:flex;justify-content:center;min-height:0;padding:0;width:34px;'
  const editorStyle =
    'background:#1e1e1e;box-sizing:border-box;color:var(--ui-secondary-text);font-family:Consolas,monospace;font-size:13px;line-height:20px;min-height:132px;overflow:hidden;padding:14px 16px;white-space:pre-wrap;'
  const addRowStyle =
    'align-items:center;display:grid;gap:10px;grid-template-columns:minmax(24px,1fr) auto auto minmax(24px,1fr);min-height:36px;'
  const addLineStyle = 'background:var(--ui-neutral-muted-border);height:1px;min-width:0;'
  const addPromptButtonStyle =
    'align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:999px;color:var(--ui-accent-normal-text);display:inline-flex;font-size:12px;font-weight:750;gap:7px;height:30px;line-height:16px;padding:0 12px;white-space:nowrap;'
  const addFolderButtonStyle =
    'align-items:center;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);border-radius:999px;color:var(--ui-hoverable-text);display:inline-flex;font-size:12px;font-weight:750;gap:7px;height:30px;line-height:16px;padding:0 12px;white-space:nowrap;'
  const folderLaneStyle =
    'border-left:1px solid var(--ui-info-normal-border);display:grid;gap:10px;margin-left:17px;padding-left:22px;'
  const subfolderRowStyle =
    'align-items:center;background:var(--ui-info-normal-surface);border:1px solid var(--ui-info-normal-border);border-radius:8px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:grid;gap:11px;grid-template-columns:34px minmax(0,1fr) auto;min-width:0;padding:9px 10px;'
</script>

<main style={shellStyle}>
  <div style={headerStyle}>
    <div
      style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:14px;font-weight:500;min-width:0;"
    >
      <button
        type="button"
        style="background:transparent;border:0;color:var(--ui-muted-text);font:inherit;min-width:0;overflow:hidden;padding:0;text-overflow:ellipsis;white-space:nowrap;"
      >
        Engineering Prompts
      </button>
      <span style="color:var(--ui-neutral-emphasis-border);padding:0 12px;">/</span>
      <button
        type="button"
        style="background:transparent;border:0;color:var(--ui-hoverable-text);font:inherit;padding:0;white-space:nowrap;"
      >
        Folder Settings
      </button>
    </div>
  </div>

  <div style={contentStyle}>
    <section style="display:grid;gap:18px;min-width:0;">
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleWrapStyle}>
          <div style={sectionIconStyle}>
            <Settings size={18} strokeWidth={2.4} />
          </div>
          <div style="display:grid;gap:2px;min-width:0;">
            <h1 style={sectionTitleStyle}>Folder Settings</h1>
            <p style={sectionMetaStyle}>Saved to workspace</p>
          </div>
        </div>
      </div>

      <div style={cardPlainStyle}>
        <div style={cardBodyStyle}>
          <div style={titleBarStyle}>
            <div style={titleMainStyle}>
              <div style={accentTileStyle}>
                <Folder size={19} strokeWidth={2.4} style="color:var(--ui-accent-icon-glyph);" />
              </div>
              <div style={titleCopyStyle}>
                <p style={titleTextStyle}>Folder Description</p>
                <div style={metadataStyle}>
                  <span style={metadataFolderStyle}>
                    <Folder size={12} strokeWidth={2.4} />
                    Folder Settings
                  </span>
                  <span style={dotStyle}></span>
                  <span>0 lines</span>
                  <span style={dotStyle}></span>
                  <span>0 tokens</span>
                  <span style={dotStyle}></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:6px;">
              <button aria-label="Copy folder description" type="button" style={iconButtonStyle}>
                <Copy size={15} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div style={`${editorStyle}min-height:156px;`}>
            This folder collects prompts for review, implementation planning, and release notes.
          </div>
        </div>
      </div>
    </section>

    <section style="display:grid;gap:10px;min-width:0;">
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleWrapStyle}>
          <div style={sectionIconStyle}>
            <FileText size={18} strokeWidth={2.4} />
          </div>
          <div style="display:grid;gap:2px;min-width:0;">
            <h2 style={sectionTitleStyle}>Prompts</h2>
            <p style={sectionMetaStyle}>3 prompts</p>
          </div>
        </div>
      </div>

      <div style={addRowStyle}>
        <div style={addLineStyle}></div>
        <button type="button" style={addPromptButtonStyle}>
          <Plus size={14} strokeWidth={3} />
          Add prompt
        </button>
        <button type="button" style={addFolderButtonStyle}>
          <FolderPlus size={14} strokeWidth={2.5} />
          Add subfolder
        </button>
        <div style={addLineStyle}></div>
      </div>

      {#each prompts as prompt, index (prompt.title)}
        {#if index === 1}
          <div style={folderLaneStyle}>
            <div style={subfolderRowStyle}>
              <div style={sectionIconStyle}>
                <Folder size={17} strokeWidth={2.4} />
              </div>
              <div style="display:grid;gap:2px;min-width:0;">
                <p style="color:var(--ui-normal-text);font-size:14px;font-weight:750;line-height:20px;margin:0;">
                  Implementation
                </p>
                <p style="color:var(--ui-muted-text);font-size:12px;line-height:16px;margin:0;">
                  2 prompts
                </p>
              </div>
              <button aria-label="Open subfolder" type="button" style={iconButtonStyle}>
                <ChevronDown size={15} strokeWidth={2.4} />
              </button>
            </div>

            <div style={addRowStyle}>
              <div style={addLineStyle}></div>
              <button type="button" style={addPromptButtonStyle}>
                <Plus size={14} strokeWidth={3} />
                Add prompt
              </button>
              <button type="button" style={addFolderButtonStyle}>
                <FolderPlus size={14} strokeWidth={2.5} />
                Add subfolder
              </button>
              <div style={addLineStyle}></div>
            </div>
          </div>
        {/if}

        <div style={cardSidebarStyle}>
          <div style={sidebarStyle}>
            <button aria-label="Move prompt up" type="button" style={`${railButtonStyle}height:32px;`}>
              <ChevronUp size={16} strokeWidth={2.4} />
            </button>
            <button aria-label="Drag prompt" type="button" style={`${railButtonStyle}height:100%;`}>
              <GripVertical size={17} strokeWidth={2.5} />
            </button>
            <button aria-label="Move prompt down" type="button" style={`${railButtonStyle}height:32px;`}>
              <ChevronDown size={16} strokeWidth={2.4} />
            </button>
          </div>

          <div style={cardBodyStyle}>
            <div style={titleBarStyle}>
              <div style={titleMainStyle}>
                <div style={accentTileStyle}>
                  <FileText
                    size={19}
                    strokeWidth={2.4}
                    style="color:var(--ui-accent-icon-glyph);"
                  />
                </div>
                <div style={titleCopyStyle}>
                  <p style={titleTextStyle}>{prompt.title}</p>
                  <div style={metadataStyle}>
                    <span style={metadataFolderStyle}>
                      <Folder size={12} strokeWidth={2.4} />
                      Prompts
                    </span>
                    <span style={dotStyle}></span>
                    <span>0 lines</span>
                    <span style={dotStyle}></span>
                    <span>0 tokens</span>
                    <span style={dotStyle}></span>
                    <span>0 min ago</span>
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:6px;">
                <button aria-label="Copy prompt" type="button" style={iconButtonStyle}>
                  <Copy size={15} strokeWidth={2.4} />
                </button>
                <button
                  aria-label="Delete prompt"
                  type="button"
                  style={`${iconButtonStyle}background:var(--ui-danger-icon-surface);border-color:var(--ui-danger-icon-ring);color:var(--ui-danger-icon-glyph);`}
                >
                  <Trash2 size={15} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div style={editorStyle}>{prompt.body}</div>
          </div>
        </div>

        <div style={addRowStyle}>
          <div style={addLineStyle}></div>
          <button type="button" style={addPromptButtonStyle}>
            <Plus size={14} strokeWidth={3} />
            Add prompt
          </button>
          <button type="button" style={addFolderButtonStyle}>
            <FolderPlus size={14} strokeWidth={2.5} />
            Add subfolder
          </button>
          <div style={addLineStyle}></div>
        </div>
      {/each}
    </section>
  </div>
</main>
