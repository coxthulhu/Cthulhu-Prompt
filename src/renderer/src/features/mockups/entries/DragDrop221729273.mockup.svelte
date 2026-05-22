<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    GripVertical,
    MoreHorizontal,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type Prompt = {
    id: string
    title: string
    body: string
    lines: number
    tokens: number
    updated: string
  }

  type FolderRow = {
    id: string
    title: string
    count: number
    prompts: string[]
  }

  const folders: FolderRow[] = [
    {
      id: 'engineering',
      title: 'Engineering Prompts',
      count: 6,
      prompts: ['Architecture review', 'API contract review', 'Migration checklist']
    },
    {
      id: 'release',
      title: 'Release Notes',
      count: 4,
      prompts: ['Changelog cleanup', 'Risk summary']
    }
  ]

  const prompts: Prompt[] = [
    {
      id: 'architecture-review',
      title: 'Architecture review',
      body:
        'Review the proposed service boundary and identify coupling risks, ownership gaps, and migration steps that can be completed without interrupting current users.',
      lines: 7,
      tokens: 214,
      updated: 'Updated 8 min ago'
    },
    {
      id: 'api-contract-review',
      title: 'API contract review',
      body:
        'Compare the request and response schema with the current renderer contract. Flag breaking changes, ambiguous fields, and test cases that need to be added.',
      lines: 9,
      tokens: 288,
      updated: 'Updated 17 min ago'
    },
    {
      id: 'migration-checklist',
      title: 'Migration checklist',
      body:
        'Create an implementation checklist for moving the prompt folder state to the new data layer. Include rollout steps, validation checks, and rollback notes.',
      lines: 6,
      tokens: 176,
      updated: 'Updated 34 min ago'
    }
  ]

  let hoveredKey = $state<string | null>(null)

  const isHovered = (key: string) => hoveredKey === key
  const setHovered = (key: string | null) => {
    hoveredKey = key
  }

  const baseButtonStyle =
    'border:1px solid var(--ui-neutral-muted-border);border-radius:var(--cthulhu-ui-radius-icon-button);background:var(--ui-neutral-normal-surface);color:var(--ui-secondary-text);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease,box-shadow 120ms ease;'

  const iconButtonStyle = (key: string, size = 28) =>
    `${baseButtonStyle}width:${size}px;height:${size}px;${isHovered(key) ? 'background:var(--ui-neutral-hover-surface);border-color:var(--ui-neutral-hover-border);color:var(--ui-normal-text);' : ''}`

  const folderRowStyle = (key: string, active = false, over = false) =>
    `display:flex;height:36px;width:100%;align-items:center;border:1px solid ${
      over
        ? 'var(--ui-accent-normal-border)'
        : active
          ? 'var(--ui-neutral-emphasis-border)'
          : isHovered(key)
            ? 'var(--ui-neutral-hover-border)'
            : 'transparent'
    };border-radius:var(--cthulhu-ui-radius-control);background:${
      over
        ? 'linear-gradient(90deg,var(--ui-accent-normal-surface),var(--ui-neutral-normal-surface))'
        : active
          ? 'var(--ui-neutral-emphasis-surface)'
          : isHovered(key)
            ? 'var(--ui-neutral-normal-surface)'
            : 'transparent'
    };box-shadow:${over ? 'inset 0 0 0 1px var(--ui-accent-hover-border),0 8px 22px var(--ui-shadow-raised)' : active ? 'inset 0 1px 0 var(--ui-neutral-normal-surface)' : 'none'};color:var(--ui-normal-text);transition:background-color 80ms ease,border-color 80ms ease,box-shadow 80ms ease;`

  const promptTreeButtonStyle = (key: string, active = false, dragging = false) =>
    `display:flex;height:30px;width:100%;align-items:center;gap:8px;border:1px solid ${
      active
        ? 'var(--ui-neutral-emphasis-border)'
        : isHovered(key)
          ? 'var(--ui-neutral-hover-border)'
          : 'transparent'
    };border-radius:8px;background:${
      active
        ? 'var(--ui-neutral-emphasis-surface)'
        : isHovered(key)
          ? 'var(--ui-neutral-normal-surface)'
          : 'transparent'
    };padding:0 8px;color:var(--ui-hoverable-text);text-align:left;opacity:${dragging ? '0.48' : '1'};transition:background-color 80ms ease,border-color 80ms ease,color 80ms ease,opacity 80ms ease;`

  const dropRailStyle =
    'position:absolute;left:38px;right:8px;top:100%;height:18px;transform:translateY(-50%);pointer-events:none;'

  const folderDropIndicatorStyle =
    'height:18px;border-radius:999px;background:linear-gradient(90deg,var(--ui-accent-normal-border),var(--ui-accent-normal-surface) 48%,transparent);box-shadow:0 0 0 1px var(--ui-accent-hover-border),0 8px 24px oklch(0.606 0.219 292.717 / 22%);display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;overflow:hidden;'

  const cardSurfaceStyle = (key: string, dragging = false) =>
    `display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:var(--cthulhu-ui-radius-card);background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));padding:10px;box-shadow:${isHovered(key) ? '0 14px 34px var(--ui-shadow-raised)' : 'none'};opacity:${dragging ? '0.62' : '1'};transition:box-shadow 120ms ease,opacity 120ms ease,border-color 120ms ease;`

  const titleBarStyle =
    'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:8px 8px 8px 10px;'

  const addPromptButtonStyle = (key: string, highlighted = false) =>
    `height:30px;border:1px solid ${highlighted || isHovered(key) ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-normal-border)'};border-radius:999px;background:${highlighted || isHovered(key) ? 'var(--ui-accent-hover-surface)' : 'var(--ui-neutral-normal-surface)'};color:var(--ui-normal-text);display:inline-flex;align-items:center;gap:7px;padding:0 13px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:${highlighted ? '0 0 0 1px var(--ui-accent-normal-border),0 8px 22px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight)' : 'inset 0 1px 0 var(--ui-card-nested-inset-highlight)'};transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease,box-shadow 120ms ease;`

  const addPromptSeparatorStyle = (highlighted = false) =>
    highlighted
      ? 'height:10px;border:1px solid var(--ui-accent-hover-border);border-radius:999px;background:var(--ui-accent-normal-surface);box-shadow:0 0 0 1px var(--ui-accent-normal-border),inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);'
      : 'height:1px;background:var(--ui-neutral-muted-border);'

  const renderIconStyle = 'width:16px;height:16px;flex:0 0 auto;'
</script>

<div style="height:100%;min-height:720px;color:var(--ui-normal-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:grid;grid-template-columns:286px minmax(0,1fr);height:100%;min-height:720px;overflow:hidden;">
    <aside style="display:flex;min-height:0;flex-direction:column;border-right:1px solid var(--sidebar-mockup-border);background:linear-gradient(180deg,rgb(16 16 18) 0%,rgb(11 14 18) 100%);">
      <div style="display:grid;gap:10px;padding:16px 13px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="min-width:0;">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700;color:var(--ui-normal-text);">Research Lab</div>
            <div style="margin-top:2px;font-size:11px;font-weight:650;color:var(--ui-muted-text);">Workspace</div>
          </div>
          <button
            type="button"
            aria-label="Workspace settings"
            style={iconButtonStyle('workspace-settings')}
            onmouseenter={() => setHovered('workspace-settings')}
            onmouseleave={() => setHovered(null)}
          >
            <Settings style="width:15px;height:15px;" />
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 13px 8px 13px;border-top:1px solid var(--ui-neutral-muted-border);">
        <div style="font-size:11px;font-weight:800;letter-spacing:0;color:var(--ui-muted-text);">Prompt folders</div>
        <button
          type="button"
          aria-label="Add prompt folder"
          style={iconButtonStyle('add-folder', 26)}
          onmouseenter={() => setHovered('add-folder')}
          onmouseleave={() => setHovered(null)}
        >
          <Plus style="width:14px;height:14px;stroke-width:3;" />
        </button>
      </div>

      <div style="position:relative;display:grid;gap:2px;min-height:0;overflow:hidden;padding:0 5px 20px 5px;">
        {#each folders as folder, folderIndex (folder.id)}
          <div style="position:relative;width:100%;padding:1px 0;">
            <div
              role="group"
              style={folderRowStyle(`folder-${folder.id}`, folderIndex === 0, folderIndex === 0)}
              onmouseenter={() => setHovered(`folder-${folder.id}`)}
              onmouseleave={() => setHovered(null)}
            >
              <button type="button" style="display:flex;height:100%;min-width:0;flex:1;align-items:center;gap:8px;border:0;background:transparent;padding:0 8px 0 8px;color:inherit;text-align:left;cursor:pointer;">
                <span style="display:flex;width:20px;height:20px;align-items:center;justify-content:center;flex:0 0 auto;">
                  <ChevronDown style="width:16px;height:16px;" />
                </span>
                <Folder style={renderIconStyle} />
                <span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;">{folder.title}</span>
              </button>
              <span style="margin-right:6px;display:inline-flex;height:22px;min-width:26px;align-items:center;justify-content:center;border:1px solid var(--ui-neutral-normal-border);border-radius:var(--cthulhu-ui-radius-card);padding:0 8px;font-size:12px;font-weight:700;color:var(--ui-normal-text);">{folder.count}</span>
            </div>

            {#if folderIndex === 0}
              <div style={dropRailStyle} aria-hidden="true">
                <div style={folderDropIndicatorStyle}>
                  <span style="height:18px;width:18px;border-radius:999px;background:var(--ui-accent-strong-surface);box-shadow:0 0 0 3px var(--ui-accent-normal-surface);"></span>
                  <span style="height:2px;border-radius:999px;background:var(--ui-accent-strong-border);box-shadow:0 0 16px var(--ui-accent-normal-border);"></span>
                </div>
              </div>
            {/if}
          </div>

          {#each folder.prompts as promptTitle (folder.id + promptTitle)}
            <div style="position:relative;width:100%;padding:1px 0 1px 30px;">
              <button
                type="button"
                style={promptTreeButtonStyle(`tree-${promptTitle}`, promptTitle === 'Architecture review', promptTitle === 'API contract review')}
                onmouseenter={() => setHovered(`tree-${promptTitle}`)}
                onmouseleave={() => setHovered(null)}
              >
                <FileText style="width:14px;height:14px;flex:0 0 auto;" />
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">{promptTitle}</span>
              </button>
            </div>
          {/each}
        {/each}
      </div>
    </aside>

    <main style="display:flex;min-height:0;min-width:0;flex-direction:column;overflow:hidden;">
      <div style="display:flex;height:36px;flex:0 0 auto;align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);background:#121316;padding:0 24px;">
        <div style="display:flex;min-width:0;align-items:center;font-size:14px;font-weight:600;color:var(--ui-muted-text);">
          <button type="button" style="min-width:0;border:0;background:transparent;color:var(--ui-muted-text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;">Engineering Prompts</button>
          <span style="padding:0 10px;color:var(--ui-neutral-emphasis-border);">/</span>
          <button type="button" style="border:0;background:transparent;color:var(--ui-hoverable-text);cursor:pointer;white-space:nowrap;font:inherit;">Architecture review</button>
        </div>
      </div>

      <div style="min-height:0;flex:1;overflow:hidden;">
        <div style="height:100%;overflow:hidden;padding:24px 28px 40px;">
          <section style="display:grid;gap:10px;max-width:1040px;">
            <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;border:1px solid var(--ui-card-normal-border);border-radius:var(--cthulhu-ui-radius-card);background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));padding:16px;box-shadow:var(--cthulhu-ui-shadow-card);">
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="display:inline-flex;height:34px;width:34px;align-items:center;justify-content:center;border:1px solid var(--ui-accent-normal-border);border-radius:8px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);">
                    <Folder style="width:17px;height:17px;" />
                  </span>
                  <div style="min-width:0;">
                    <h1 style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px;line-height:22px;font-weight:750;color:var(--ui-normal-text);">Engineering Prompts</h1>
                    <p style="margin:2px 0 0;color:var(--ui-muted-text);font-size:12px;font-weight:650;">6 prompts</p>
                  </div>
                </div>
                <p style="margin:14px 0 0;max-width:820px;color:var(--ui-secondary-text);font-size:13px;line-height:20px;">Reusable review prompts for implementation planning, architecture changes, release checks, and migration work.</p>
              </div>
              <button
                type="button"
                aria-label="Folder settings"
                style={iconButtonStyle('folder-settings-main', 32)}
                onmouseenter={() => setHovered('folder-settings-main')}
                onmouseleave={() => setHovered(null)}
              >
                <MoreHorizontal style="width:16px;height:16px;" />
              </button>
            </div>

            <div style="padding-top:14px;padding-bottom:2px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="display:inline-flex;height:32px;width:32px;align-items:center;justify-content:center;border:1px solid var(--ui-accent-normal-border);border-radius:8px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);">
                  <FileText style="width:16px;height:16px;" />
                </span>
                <div style="min-width:0;">
                  <h2 style="margin:0;font-size:16px;line-height:20px;font-weight:750;color:var(--ui-normal-text);">Prompts</h2>
                  <p style="margin:2px 0 0;font-size:12px;line-height:16px;color:var(--ui-muted-text);">Create, edit, and organize prompts in this folder.</p>
                </div>
              </div>
            </div>

            <div style="display:grid;gap:0;">
              {#each prompts as prompt, promptIndex (prompt.id)}
                <div style="position:relative;display:grid;align-items:center;height:46px;">
                  <div style="position:relative;display:grid;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);align-items:center;gap:10px;min-height:36px;">
                    <span style={addPromptSeparatorStyle(promptIndex === 1)}></span>
                    <button
                      type="button"
                      style={addPromptButtonStyle(`add-${prompt.id}`, promptIndex === 1)}
                      onmouseenter={() => setHovered(`add-${prompt.id}`)}
                      onmouseleave={() => setHovered(null)}
                    >
                      <Plus style="width:14px;height:14px;stroke-width:3;" />
                      Add prompt
                    </button>
                    <span style={addPromptSeparatorStyle(promptIndex === 1)}></span>
                  </div>
                </div>

                <article
                  style={cardSurfaceStyle(`prompt-${prompt.id}`, prompt.id === 'api-contract-review')}
                  onmouseenter={() => setHovered(`prompt-${prompt.id}`)}
                  onmouseleave={() => setHovered(null)}
                >
                  <div style="display:grid;grid-template-rows:28px minmax(0,1fr) 28px;gap:6px;min-height:136px;width:28px;">
                    <button type="button" aria-label="Move prompt up" style={iconButtonStyle(`up-${prompt.id}`)} onmouseenter={() => setHovered(`up-${prompt.id}`)} onmouseleave={() => setHovered(null)} disabled={promptIndex === 0}>
                      <ChevronUp style="width:16px;height:16px;" />
                    </button>
                    <button type="button" aria-label="Drag prompt" style={`${iconButtonStyle(`drag-${prompt.id}`)}height:100%;cursor:grab;`} onmouseenter={() => setHovered(`drag-${prompt.id}`)} onmouseleave={() => setHovered(null)}>
                      <GripVertical style="width:16px;height:16px;stroke-width:2.5;" />
                    </button>
                    <button type="button" aria-label="Move prompt down" style={iconButtonStyle(`down-${prompt.id}`)} onmouseenter={() => setHovered(`down-${prompt.id}`)} onmouseleave={() => setHovered(null)} disabled={promptIndex === prompts.length - 1}>
                      <ChevronDown style="width:16px;height:16px;" />
                    </button>
                  </div>

                  <div style="display:grid;gap:8px;min-width:0;">
                    <div style={titleBarStyle}>
                      <div style="display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;min-width:0;">
                        <span style="display:inline-flex;height:40px;width:40px;align-items:center;justify-content:center;border:1px solid var(--ui-accent-normal-border);border-radius:9px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);">
                          <FileText style="width:18px;height:18px;" />
                        </span>
                        <div style="display:grid;gap:4px;min-width:0;">
                          <div style="height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:700;line-height:20px;color:var(--ui-normal-text);">{prompt.title}</div>
                          <div style="display:flex;min-width:0;align-items:center;gap:7px;overflow:hidden;white-space:nowrap;color:var(--ui-muted-text);font-size:11px;font-weight:750;line-height:16px;">
                            <span style="display:inline-flex;min-width:0;align-items:center;gap:5px;color:var(--ui-secondary-text);overflow:hidden;text-overflow:ellipsis;">
                              <Folder style="width:12px;height:12px;flex:0 0 auto;stroke-width:2.4;" />
                              Prompts
                            </span>
                            <span style="height:3px;width:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);flex:0 0 auto;"></span>
                            <span>{prompt.lines} lines</span>
                            <span style="height:3px;width:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);flex:0 0 auto;"></span>
                            <span>{prompt.tokens} tokens</span>
                            <span style="height:3px;width:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);flex:0 0 auto;"></span>
                            <span>{prompt.updated}</span>
                          </div>
                        </div>
                      </div>

                      <div style="display:flex;gap:6px;">
                        <button type="button" aria-label="Copy prompt" style={iconButtonStyle(`copy-${prompt.id}`, 30)} onmouseenter={() => setHovered(`copy-${prompt.id}`)} onmouseleave={() => setHovered(null)}>
                          <Copy style="width:15px;height:15px;" />
                        </button>
                        <button type="button" aria-label="Delete prompt" style={iconButtonStyle(`delete-${prompt.id}`, 30)} onmouseenter={() => setHovered(`delete-${prompt.id}`)} onmouseleave={() => setHovered(null)}>
                          <Trash2 style="width:15px;height:15px;" />
                        </button>
                      </div>
                    </div>

                    <div style="min-height:92px;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:12px;color:var(--ui-secondary-text);font-family:'Cascadia Code','SFMono-Regular',Consolas,monospace;font-size:13px;line-height:20px;">
                      {prompt.body}
                    </div>
                  </div>
                </article>
              {/each}

              <div style="display:grid;align-items:center;height:46px;">
                <div style="display:grid;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);align-items:center;gap:10px;min-height:36px;">
                  <span style={addPromptSeparatorStyle()}></span>
                  <button
                    type="button"
                    style={addPromptButtonStyle('add-final')}
                    onmouseenter={() => setHovered('add-final')}
                    onmouseleave={() => setHovered(null)}
                  >
                    <Plus style="width:14px;height:14px;stroke-width:3;" />
                    Add prompt
                  </button>
                  <span style={addPromptSeparatorStyle()}></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</div>
