<script lang="ts">
  import type { ComponentType } from 'svelte'
  import {
    Bug,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    FileText,
    Folder,
    FolderPlus,
    Home,
    MoreHorizontal,
    PanelsTopLeft,
    Plus,
    Search,
    Settings,
    SlidersHorizontal
  } from 'lucide-svelte'

  type ActivityItem = {
    id: string
    label: string
    icon: ComponentType
  }

  type PromptFolder = {
    id: string
    name: string
    metadata: string
    updated: string
    promptCount: number
    folderCount: number
  }

  type TreeFolder = {
    id: string
    name: string
    count: number
    expanded: boolean
    prompts: string[]
  }

  const activityItems: ActivityItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft },
    { id: 'test-page', label: 'Test Page', icon: Bug }
  ]

  const promptFolders: PromptFolder[] = [
    {
      id: 'coding-workflow',
      name: 'Coding Workflow',
      metadata: '18 prompts, 4 sections',
      updated: 'Updated today',
      promptCount: 18,
      folderCount: 4
    },
    {
      id: 'review-and-debug',
      name: 'Review and Debug',
      metadata: '12 prompts, 3 sections',
      updated: 'Updated yesterday',
      promptCount: 12,
      folderCount: 3
    },
    {
      id: 'planning',
      name: 'Planning',
      metadata: '9 prompts, 2 sections',
      updated: 'Updated Monday',
      promptCount: 9,
      folderCount: 2
    },
    {
      id: 'release',
      name: 'Release Notes',
      metadata: '7 prompts, 2 sections',
      updated: 'Updated May 29',
      promptCount: 7,
      folderCount: 2
    },
    {
      id: 'agent-personas',
      name: 'Agent Personas',
      metadata: '14 prompts, 5 sections',
      updated: 'Updated May 22',
      promptCount: 14,
      folderCount: 5
    },
    {
      id: 'experiments',
      name: 'Experiments',
      metadata: '6 prompts, 1 section',
      updated: 'Updated May 18',
      promptCount: 6,
      folderCount: 1
    },
    {
      id: 'archive',
      name: 'Archive',
      metadata: '31 prompts, 8 sections',
      updated: 'Updated Apr 30',
      promptCount: 31,
      folderCount: 8
    },
    {
      id: 'docs-and-specs',
      name: 'Docs and Specs',
      metadata: '10 prompts, 3 sections',
      updated: 'Updated Apr 18',
      promptCount: 10,
      folderCount: 3
    },
    {
      id: 'shortcuts',
      name: 'Shortcuts',
      metadata: '5 prompts, 1 section',
      updated: 'Updated Apr 12',
      promptCount: 5,
      folderCount: 1
    },
    {
      id: 'local-models',
      name: 'Local Models',
      metadata: '8 prompts, 2 sections',
      updated: 'Updated Mar 28',
      promptCount: 8,
      folderCount: 2
    },
    {
      id: 'scratchpad',
      name: 'Scratchpad',
      metadata: '3 prompts, 0 sections',
      updated: 'Updated Mar 10',
      promptCount: 3,
      folderCount: 0
    }
  ]

  const topLevelPrompts = [
    'Plan implementation steps',
    'Summarize current workspace',
    'Write focused Codex handoff'
  ]

  const treeFolders: TreeFolder[] = [
    {
      id: 'editor-work',
      name: 'Editor Work',
      count: 5,
      expanded: true,
      prompts: ['Svelte component pass', 'Playwright repro case', 'TypeScript cleanup']
    },
    {
      id: 'code-review',
      name: 'Code Review',
      count: 4,
      expanded: true,
      prompts: ['Risk-first review', 'Regression check', 'Test gap summary']
    },
    {
      id: 'follow-up',
      name: 'Follow Up',
      count: 3,
      expanded: false,
      prompts: []
    }
  ]

  let activeActivityId = $state('prompts')
  let selectedFolderId = $state('coding-workflow')
  let isFolderSelectorOpen = $state(false)
  let hoveredActivityId = $state<string | null>(null)
  let hoveredFolderId = $state<string | null>(null)
  let hoveredTreeFolderId = $state<string | null>(null)
  let hoveredPromptId = $state<string | null>(null)
  let hoveredIconButtonId = $state<string | null>(null)
  let isFolderSelectorHovered = $state(false)
  let isCreateFolderHovered = $state(false)

  const selectedFolder = $derived(
    promptFolders.find((folder) => folder.id === selectedFolderId) ?? promptFolders[0]
  )

  const selectPromptFolder = (folderId: string) => {
    selectedFolderId = folderId
    isFolderSelectorOpen = false
  }

  const shellStyle =
    'display:flex;height:100vh;width:360px;min-height:520px;color:var(--ui-secondary-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'

  const activityBarStyle =
    'display:flex;width:54px;min-width:54px;flex-direction:column;align-items:center;gap:7px;padding:10px 7px;border-right:1px solid var(--ui-neutral-muted-border);background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));'

  const sidebarStyle =
    'position:relative;display:flex;min-width:0;flex:1;flex-direction:column;padding:10px 8px 10px 10px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));'

  const iconButtonBase =
    'border:0;font:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color 60ms ease-out,color 60ms ease-out,border-color 60ms ease-out;'

  const activityIconStyle = 'width:18px;height:18px;stroke-width:2.1;'

  const activityButtonStyle = (id: string) => {
    const active = activeActivityId === id
    const hovered = hoveredActivityId === id
    return `${iconButtonBase}position:relative;width:38px;height:38px;border-radius:8px;color:${
      active
        ? 'var(--ui-accent-icon-glyph)'
        : hovered
          ? 'var(--ui-normal-text)'
          : 'var(--ui-secondary-text)'
    };background:${
      active
        ? 'var(--ui-accent-normal-surface)'
        : hovered
          ? 'var(--ui-neutral-normal-surface)'
          : 'transparent'
    };border:1px solid ${
      active
        ? 'var(--ui-accent-normal-border)'
        : hovered
          ? 'var(--ui-neutral-hover-border)'
          : 'transparent'
    };`
  }

  const sectionLabelStyle =
    'margin:0;color:var(--ui-secondary-text);font-size:13px;font-weight:650;line-height:1.2;'

  const folderSelectorStyle = () =>
    `${iconButtonBase}width:100%;min-height:54px;justify-content:space-between;gap:10px;border-radius:8px;padding:8px 10px;text-align:left;color:var(--ui-normal-text);background:${
      isFolderSelectorOpen
        ? 'var(--ui-neutral-emphasis-surface)'
        : isFolderSelectorHovered
          ? 'var(--ui-neutral-hover-surface)'
          : 'var(--ui-neutral-normal-surface)'
    };border:1px solid ${
      isFolderSelectorOpen
        ? 'var(--ui-neutral-interactive-hover-border)'
        : isFolderSelectorHovered
          ? 'var(--ui-neutral-hover-border)'
        : 'var(--ui-neutral-normal-border)'
    };`

  const smallIconButtonStyle = (id: string) =>
    `${iconButtonBase}height:30px;width:30px;border-radius:7px;background:${
      hoveredIconButtonId === id ? 'var(--ui-neutral-hover-surface)' : 'transparent'
    };color:${
      hoveredIconButtonId === id ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'
    };border:1px solid transparent;`

  const dropdownRowStyle = (folderId: string) => {
    const selected = selectedFolderId === folderId
    const hovered = hoveredFolderId === folderId
    return `${iconButtonBase}width:100%;justify-content:flex-start;gap:10px;border-radius:8px;padding:9px 9px;text-align:left;color:${
      selected ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'
    };background:${
      selected
        ? 'var(--ui-accent-normal-surface)'
        : hovered
          ? 'var(--ui-neutral-normal-surface)'
          : 'transparent'
    };border:1px solid ${selected ? 'var(--ui-accent-normal-border)' : 'transparent'};`
  }

  const treeFolderRowStyle = (folderId: string) =>
    `display:flex;height:36px;width:100%;align-items:center;border-radius:8px;background:${
      hoveredTreeFolderId === folderId ? 'var(--ui-neutral-normal-surface)' : 'transparent'
    };padding:1px;color:${
      hoveredTreeFolderId === folderId ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
    };transition:background-color 50ms ease-out,color 50ms ease-out;`

  const promptRowStyle = (promptId: string, active = false) =>
    `${iconButtonBase}height:30px;width:100%;min-width:0;justify-content:flex-start;border-radius:8px;padding:1px 8px 1px 12px;text-align:left;color:${
      active || hoveredPromptId === promptId ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
    };background:${
      active
        ? 'var(--ui-neutral-emphasis-surface)'
        : hoveredPromptId === promptId
          ? 'var(--ui-neutral-normal-surface)'
          : 'transparent'
    };`

  const createFolderRowStyle = () =>
    `${iconButtonBase}width:100%;justify-content:flex-start;gap:9px;border-radius:8px;padding:9px;color:${
      isCreateFolderHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
    };background:${
      isCreateFolderHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-muted-surface)'
    };border:1px dashed ${
      isCreateFolderHovered
        ? 'var(--ui-neutral-interactive-hover-border)'
        : 'var(--ui-neutral-interactive-muted-border)'
    };`
</script>

<div style={shellStyle}>
  <nav aria-label="Primary" style={activityBarStyle}>
    {#each activityItems as item (item.id)}
      {@const Icon = item.icon}
      <button
        type="button"
        aria-label={item.label}
        aria-pressed={activeActivityId === item.id}
        title={item.label}
        style={activityButtonStyle(item.id)}
        onmouseenter={() => {
          hoveredActivityId = item.id
        }}
        onmouseleave={() => {
          hoveredActivityId = null
        }}
        onclick={() => {
          activeActivityId = item.id
        }}
      >
        <Icon style={activityIconStyle} />
      </button>
    {/each}
  </nav>

  <aside aria-label="Prompt sidebar" style={sidebarStyle}>
    <div style="padding:0 3px 10px;border-bottom:1px solid var(--ui-neutral-muted-border);">
      <div style="display:flex;min-width:0;align-items:center;gap:9px;">
        <div
          style="display:flex;height:34px;width:34px;flex-shrink:0;align-items:center;justify-content:center;border-radius:8px;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);color:var(--ui-accent-icon-glyph);"
        >
          <FileText size={17} strokeWidth={2.1} />
        </div>
        <div style="min-width:0;flex:1;">
          <p
            style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:14px;font-weight:700;line-height:1.15;"
          >
            Desktop Prompts
          </p>
          <p
            style="margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-muted-text);font-size:12px;line-height:1.2;"
          >
            C:\Source\PromptApps
          </p>
        </div>
      </div>
    </div>

    <div style="padding:12px 3px 10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <p style={sectionLabelStyle}>Prompt Folders</p>
        <div style="display:flex;align-items:center;gap:2px;">
          <button
            type="button"
            aria-label="Collapse All"
            title="Collapse All"
            style={smallIconButtonStyle('collapse-all')}
            onmouseenter={() => {
              hoveredIconButtonId = 'collapse-all'
            }}
            onmouseleave={() => {
              hoveredIconButtonId = null
            }}
          >
            <ChevronsDownUp size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Tree Options"
            title="Tree Options"
            style={smallIconButtonStyle('tree-options')}
            onmouseenter={() => {
              hoveredIconButtonId = 'tree-options'
            }}
            onmouseleave={() => {
              hoveredIconButtonId = null
            }}
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style="position:relative;margin-top:8px;">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isFolderSelectorOpen}
          style={folderSelectorStyle()}
          onmouseenter={() => {
            isFolderSelectorHovered = true
          }}
          onmouseleave={() => {
            isFolderSelectorHovered = false
          }}
          onclick={() => {
            isFolderSelectorOpen = !isFolderSelectorOpen
          }}
        >
          <span style="display:flex;min-width:0;align-items:center;gap:10px;">
            <span
              style="display:flex;height:32px;width:32px;flex-shrink:0;align-items:center;justify-content:center;border-radius:8px;background:var(--ui-accent-blue-normal-surface);border:1px solid var(--ui-accent-blue-normal-border);color:var(--ui-accent-blue-icon-glyph);"
            >
              <Folder size={17} strokeWidth={2} />
            </span>
            <span style="min-width:0;">
              <span
                style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650;line-height:1.2;"
              >
                {selectedFolder.name}
              </span>
              <span
                style="display:block;margin-top:3px;color:var(--ui-muted-text);font-size:12px;line-height:1.2;"
              >
                11 folders
              </span>
            </span>
          </span>
          <ChevronDown size={17} strokeWidth={2} />
        </button>

        {#if isFolderSelectorOpen}
          <div
            role="listbox"
            aria-label="Prompt Folders"
            style="position:absolute;z-index:5;top:calc(100% + 6px);left:0;right:0;display:flex;max-height:392px;flex-direction:column;gap:3px;overflow:auto;border-radius:8px;border:1px solid var(--ui-neutral-hover-border);background:var(--ui-card-overlay-surface);padding:6px;"
          >
            <div style="display:flex;align-items:center;gap:6px;padding:3px 3px 6px;">
              <div
                style="display:flex;min-width:0;flex:1;align-items:center;gap:7px;border-radius:7px;border:1px solid var(--ui-neutral-muted-border);background:var(--ui-neutral-muted-surface);padding:6px 8px;color:var(--ui-muted-text);"
              >
                <Search size={14} strokeWidth={2} />
                <span style="font-size:12px;">Search folders</span>
              </div>
              <button
                type="button"
                aria-label="Add Prompt Folder"
                title="Add Prompt Folder"
                style={smallIconButtonStyle('add-folder')}
                onmouseenter={() => {
                  hoveredIconButtonId = 'add-folder'
                }}
                onmouseleave={() => {
                  hoveredIconButtonId = null
                }}
              >
                <FolderPlus size={16} strokeWidth={2} />
              </button>
            </div>

            {#each promptFolders as folder (folder.id)}
              <button
                type="button"
                role="option"
                aria-selected={selectedFolderId === folder.id}
                style={dropdownRowStyle(folder.id)}
                onmouseenter={() => {
                  hoveredFolderId = folder.id
                }}
                onmouseleave={() => {
                  hoveredFolderId = null
                }}
                onclick={() => selectPromptFolder(folder.id)}
              >
                <span
                  style="display:flex;height:28px;width:28px;flex-shrink:0;align-items:center;justify-content:center;border-radius:7px;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);color:var(--ui-secondary-text);"
                >
                  <Folder size={15} strokeWidth={2} />
                </span>
                <span style="min-width:0;flex:1;">
                  <span
                    style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:620;line-height:1.2;"
                  >
                    {folder.name}
                  </span>
                  <span
                    style="display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-muted-text);font-size:11px;line-height:1.2;"
                  >
                    {folder.metadata}
                  </span>
                </span>
                <span
                  style="flex-shrink:0;color:var(--ui-muted-text);font-size:11px;line-height:1.2;"
                >
                  {folder.updated}
                </span>
              </button>
            {/each}

            <button
              type="button"
              style={createFolderRowStyle()}
              onmouseenter={() => {
                isCreateFolderHovered = true
              }}
              onmouseleave={() => {
                isCreateFolderHovered = false
              }}
            >
              <Plus size={15} strokeWidth={2} />
              <span style="font-size:13px;font-weight:620;">New Prompt Folder</span>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <div style="display:flex;min-height:0;flex:1;flex-direction:column;overflow:hidden;padding:0 3px;">
      <div style="display:flex;min-height:0;flex:1;flex-direction:column;overflow:auto;padding-right:2px;">
        {#each topLevelPrompts as prompt, index (`top-${prompt}`)}
          <div style="width:100%;padding-block:1px;">
            <button
              type="button"
              data-active={index === 1 ? 'true' : 'false'}
              aria-current={index === 1 ? 'true' : undefined}
              style={promptRowStyle(`top-${prompt}`, index === 1)}
              onmouseenter={() => {
                hoveredPromptId = `top-${prompt}`
              }}
              onmouseleave={() => {
                hoveredPromptId = null
              }}
            >
              <span
                style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;"
              >
                {prompt}
              </span>
            </button>
          </div>
        {/each}

        {#each treeFolders as folder (folder.id)}
          <div style="width:100%;padding-block:1px;">
            <div
              role="group"
              style={treeFolderRowStyle(folder.id)}
              onmouseenter={() => {
                hoveredTreeFolderId = folder.id
              }}
              onmouseleave={() => {
                hoveredTreeFolderId = null
              }}
            >
              <button
                type="button"
                aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                aria-expanded={folder.expanded}
                style={`${iconButtonBase}height:100%;min-width:0;flex:1;justify-content:flex-start;gap:8px;background:transparent;color:inherit;padding:0 6px 0 10px;text-align:left;`}
              >
                <span
                  style="display:flex;height:20px;width:20px;flex-shrink:0;align-items:center;justify-content:center;border-radius:8px;color:inherit;"
                >
                  {#if folder.expanded}
                    <ChevronDown size={16} strokeWidth={2} />
                  {:else}
                    <ChevronRight size={16} strokeWidth={2} />
                  {/if}
                </span>
                <span
                  style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;"
                >
                  {folder.name}
                </span>
              </button>

              <div
                style="display:flex;flex-shrink:0;align-items:center;justify-content:flex-end;margin-right:6px;pointer-events:none;"
              >
                {#if hoveredTreeFolderId === folder.id}
                  <div style="display:flex;gap:2px;pointer-events:auto;">
                    <button
                      type="button"
                      aria-label={`Folder options for ${folder.name}`}
                      title="Folder Options"
                      style={smallIconButtonStyle(`tree-menu-${folder.id}`)}
                      onmouseenter={() => {
                        hoveredIconButtonId = `tree-menu-${folder.id}`
                      }}
                      onmouseleave={() => {
                        hoveredIconButtonId = null
                      }}
                    >
                      <MoreHorizontal size={15} strokeWidth={2} />
                    </button>
                  </div>
                {:else}
                  <span
                    style="display:inline-flex;height:22px;min-width:26px;align-items:center;justify-content:center;border-radius:8px;padding:0 8px;color:var(--ui-secondary-text);font-size:12px;font-weight:600;line-height:1;"
                  >
                    {folder.count}
                  </span>
                {/if}
              </div>
            </div>
          </div>

          {#if folder.expanded}
            {#each folder.prompts as prompt (`${folder.id}-${prompt}`)}
              <div
                style="display:grid;grid-template-columns:30px minmax(0,1fr);width:100%;padding-block:1px;"
              >
                <div style="position:relative;min-height:30px;align-self:stretch;">
                  <span
                    style="position:absolute;top:-1px;bottom:-1px;left:20px;display:block;width:1px;background:var(--ui-neutral-emphasis-border);"
                  ></span>
                </div>
                <button
                  type="button"
                  style={promptRowStyle(`${folder.id}-${prompt}`)}
                  onmouseenter={() => {
                    hoveredPromptId = `${folder.id}-${prompt}`
                  }}
                  onmouseleave={() => {
                    hoveredPromptId = null
                  }}
                >
                  <span
                    style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;"
                  >
                    {prompt}
                  </span>
                </button>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    </div>
  </aside>
</div>
