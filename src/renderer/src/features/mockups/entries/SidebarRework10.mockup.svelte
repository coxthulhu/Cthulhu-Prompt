<script lang="ts">
  import {
    ArrowRight,
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
    Settings
  } from 'lucide-svelte'

  type ActivityItem = {
    id: string
    label: string
    icon: typeof Home
  }

  type FolderOption = {
    id: string
    name: string
    promptCount: number
    updated: string
  }

  type TreeFolder = {
    id: string
    name: string
    count: number
    expanded: boolean
    prompts: string[]
  }

  type TreeContent = {
    rootPrompts: string[]
    folders: TreeFolder[]
  }

  const activityItems: ActivityItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft },
    { id: 'test-screen', label: 'Test Screen', icon: Bug }
  ]

  const folderOptions: FolderOption[] = [
    {
      id: 'engineering',
      name: 'Engineering Workflows',
      promptCount: 18,
      updated: 'Updated 12m ago'
    },
    {
      id: 'release',
      name: 'Release Notes',
      promptCount: 9,
      updated: 'Updated 1h ago'
    },
    {
      id: 'review',
      name: 'Code Review',
      promptCount: 14,
      updated: 'Updated yesterday'
    },
    {
      id: 'research',
      name: 'Research & Discovery',
      promptCount: 7,
      updated: 'Updated Monday'
    },
    {
      id: 'support',
      name: 'Support Replies',
      promptCount: 11,
      updated: 'Updated May 28'
    }
  ]

  const treeByFolderId: Record<string, TreeContent> = {
    engineering: {
      rootPrompts: ['Repository intake checklist', 'Feature implementation brief'],
      folders: [
        {
          id: 'eng-refactors',
          name: 'Refactors',
          count: 5,
          expanded: true,
          prompts: ['Extract shared renderer state', 'Split IPC handler module', 'Simplify row measurement cache']
        },
        {
          id: 'eng-debugging',
          name: 'Debugging',
          count: 4,
          expanded: true,
          prompts: ['Hydration error triage', 'Playwright failure summary']
        },
        {
          id: 'eng-planning',
          name: 'Planning',
          count: 7,
          expanded: false,
          prompts: []
        }
      ]
    },
    release: {
      rootPrompts: ['Changelog draft', 'Migration note'],
      folders: [
        {
          id: 'release-public',
          name: 'Public Copy',
          count: 4,
          expanded: true,
          prompts: ['Feature highlight', 'Known issues summary']
        },
        {
          id: 'release-internal',
          name: 'Internal Notes',
          count: 5,
          expanded: false,
          prompts: []
        }
      ]
    },
    review: {
      rootPrompts: ['Focused review request'],
      folders: [
        {
          id: 'review-risk',
          name: 'Risk Passes',
          count: 6,
          expanded: true,
          prompts: ['Regression scan', 'Missing test finder', 'Accessibility sweep']
        },
        {
          id: 'review-cleanup',
          name: 'Cleanup',
          count: 8,
          expanded: false,
          prompts: []
        }
      ]
    },
    research: {
      rootPrompts: ['Compare implementation options', 'Summarize source notes'],
      folders: [
        {
          id: 'research-spikes',
          name: 'Spikes',
          count: 5,
          expanded: true,
          prompts: ['Prototype plan', 'Tradeoff matrix']
        }
      ]
    },
    support: {
      rootPrompts: ['Bug report response', 'Clarifying question'],
      folders: [
        {
          id: 'support-followups',
          name: 'Follow-ups',
          count: 6,
          expanded: true,
          prompts: ['Reproduction request', 'Fix confirmation']
        },
        {
          id: 'support-status',
          name: 'Status Updates',
          count: 5,
          expanded: false,
          prompts: []
        }
      ]
    }
  }

  let activeActivityId = $state('prompts')
  let selectedFolderId = $state('engineering')
  let selectedPrompt = $state('Feature implementation brief')
  let isFolderSelectorOpen = $state(true)
  let hoveredActivityId = $state<string | null>(null)
  let hoveredFolderId = $state<string | null>(null)
  let hoveredTreeFolderId = $state<string | null>(null)
  let hoveredPromptName = $state<string | null>(null)
  let hoveredActionId = $state<string | null>(null)
  let hoveredSelector = $state(false)
  let hoveredNewFolder = $state(false)

  const selectedFolder = $derived(
    folderOptions.find((folder) => folder.id === selectedFolderId) ?? folderOptions[0]!
  )
  const selectedTree = $derived(treeByFolderId[selectedFolderId] ?? treeByFolderId.engineering)

  const activityButtonStyle = (itemId: string) => {
    const isActive = activeActivityId === itemId
    const isHovered = hoveredActivityId === itemId

    return [
      'height: 42px',
      'width: 42px',
      'border: 0',
      'border-radius: 8px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'cursor: pointer',
      'transition: background 80ms ease-out, color 80ms ease-out, box-shadow 80ms ease-out',
      `background: ${
        isActive
          ? 'var(--ui-accent-normal-surface)'
          : isHovered
            ? 'var(--ui-neutral-hover-surface)'
            : 'transparent'
      }`,
      `color: ${isActive ? 'var(--ui-accent-normal-text)' : 'var(--ui-hoverable-text)'}`,
      `box-shadow: ${
        isActive
          ? 'inset 0 0 0 1px var(--ui-accent-normal-border), 0 8px 22px var(--ui-card-normal-shadow)'
          : 'inset 0 0 0 1px transparent'
      }`
    ].join('; ')
  }

  const iconButtonStyle = (id: string, disabled = false) => {
    const isHovered = hoveredActionId === id && !disabled

    return [
      'height: 30px',
      'width: 30px',
      'border: 0',
      'border-radius: 7px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      `background: ${isHovered ? 'var(--ui-neutral-normal-surface)' : 'transparent'}`,
      `color: ${disabled ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}`,
      `cursor: ${disabled ? 'default' : 'pointer'}`,
      'transition: background 60ms ease-out, color 60ms ease-out'
    ].join('; ')
  }

  const folderOptionStyle = (folderId: string) => {
    const isSelected = selectedFolderId === folderId
    const isHovered = hoveredFolderId === folderId

    return [
      'width: 100%',
      'border: 0',
      'border-radius: 8px',
      'display: grid',
      'grid-template-columns: 34px minmax(0, 1fr)',
      'gap: 9px',
      'align-items: center',
      'padding: 8px',
      'text-align: left',
      'cursor: pointer',
      `color: ${isSelected || isHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}`,
      'transition: background-color 120ms ease, color 120ms ease',
      `background: ${isSelected || isHovered ? 'var(--ui-neutral-hover-surface)' : 'transparent'}`
    ].join('; ')
  }

  const selectorIconStyle = (active: boolean) =>
    [
      'height: 34px',
      'width: 34px',
      'border-radius: 8px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'background: transparent',
      `color: ${active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-icon-glyph)'}`,
      'transition: color 120ms ease'
    ].join('; ')

  const treeFolderRowStyle = (folder: TreeFolder) => {
    const isHovered = hoveredTreeFolderId === folder.id

    return [
      'display: flex',
      'height: 36px',
      'width: 100%',
      'align-items: center',
      'gap: 0',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `background: ${isHovered ? 'var(--ui-neutral-normal-surface)' : 'transparent'}`,
      `color: ${isHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}`,
      'padding: 1px',
      'transition: background 50ms ease-out, color 50ms ease-out'
    ].join('; ')
  }

  const promptRowStyle = (isRootPrompt: boolean) => {
    return [
      'display: grid',
      `grid-template-columns: ${isRootPrompt ? '0 minmax(0, 1fr)' : '30px minmax(0, 1fr)'}`,
      'width: 100%',
      'padding-block: 1px'
    ].join('; ')
  }

  const promptButtonStyle = (promptName: string, isRootPrompt: boolean) => {
    const isActive = selectedPrompt === promptName
    const isHovered = hoveredPromptName === promptName

    return [
      'display: flex',
      'height: 30px',
      'width: 100%',
      'min-width: 0',
      'align-items: center',
      'gap: 8px',
      'border: 0',
      'border-radius: 8px',
      `background: ${
        isActive
          ? 'var(--ui-neutral-emphasis-surface)'
          : isHovered
            ? 'var(--ui-neutral-normal-surface)'
            : 'transparent'
      }`,
      `padding: ${isRootPrompt ? '1px 8px 1px 12px' : '1px 8px 1px 12px'}`,
      `color: ${isActive || isHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}`,
      'text-align: left',
      'cursor: pointer',
      'transition: background 50ms ease-out, color 50ms ease-out'
    ].join('; ')
  }

  const selectFolder = (folderId: string) => {
    selectedFolderId = folderId
    selectedPrompt = treeByFolderId[folderId]?.rootPrompts[0] ?? ''
    isFolderSelectorOpen = false
  }
</script>

<div
  style="display: flex; width: 368px; height: 720px; min-height: 0; color: var(--ui-normal-text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
>
  <nav
    aria-label="Primary"
    style="width: 58px; min-width: 58px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); border-right: 1px solid var(--ui-neutral-muted-border);"
  >
    <div
      style="height: 34px; width: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--ui-card-inset-surface); box-shadow: inset 0 0 0 1px var(--ui-card-normal-border); color: var(--ui-accent-icon-glyph); margin-bottom: 2px;"
    >
      <FileText size={18} strokeWidth={2.3} />
    </div>

    {#each activityItems as item (item.id)}
      {@const Icon = item.icon}
      <button
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-current={activeActivityId === item.id ? 'page' : undefined}
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
        <Icon size={20} strokeWidth={2.15} />
      </button>
    {/each}
  </nav>

  <aside
    aria-label="Prompt sidebar"
    style="position: relative; width: 310px; min-width: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start) 0%, var(--ui-card-normal-surface-gradient-end) 100%); border-right: 1px solid var(--ui-neutral-hover-border);"
  >
    <div style="padding: 13px 13px 10px 13px; border-bottom: 1px solid var(--ui-neutral-muted-border);">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="min-width: 0;">
          <p style="margin: 0; color: var(--ui-secondary-text); font-size: 13px; font-weight: 650;">
            Prompt Folders
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 2px;">
          <button
            type="button"
            title="Collapse All"
            aria-label="Collapse All"
            style={iconButtonStyle('collapse-all')}
            onmouseenter={() => {
              hoveredActionId = 'collapse-all'
            }}
            onmouseleave={() => {
              hoveredActionId = null
            }}
          >
            <ChevronsDownUp size={17} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            title="New Prompt"
            aria-label="New Prompt"
            style={iconButtonStyle('new-prompt')}
            onmouseenter={() => {
              hoveredActionId = 'new-prompt'
            }}
            onmouseleave={() => {
              hoveredActionId = null
            }}
          >
            <Plus size={17} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div style="position: relative; margin: 9px -4px 0 -4px;">
        <button
          type="button"
          aria-label="Select Prompt Folder"
          aria-expanded={isFolderSelectorOpen}
          style={`width: 100%; min-width: 0; display: grid; grid-template-columns: 34px minmax(0, 1fr) 22px; align-items: center; gap: 9px; border: 0; border-radius: 8px; background: ${hoveredSelector || isFolderSelectorOpen ? 'var(--ui-neutral-hover-surface)' : 'transparent'}; color: ${hoveredSelector || isFolderSelectorOpen ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; padding: 8px 8px; cursor: pointer; text-align: left; transition: background-color 120ms ease, color 120ms ease;`}
          onmouseenter={() => {
            hoveredSelector = true
          }}
          onmouseleave={() => {
            hoveredSelector = false
          }}
          onclick={() => {
            isFolderSelectorOpen = !isFolderSelectorOpen
          }}
        >
          <span style={selectorIconStyle(hoveredSelector || isFolderSelectorOpen)}>
            <Folder size={18} strokeWidth={2.1} />
          </span>
          <span style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span
              style={`display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${hoveredSelector || isFolderSelectorOpen ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font-size: 14px; font-weight: 620;`}
            >
              {selectedFolder.name}
            </span>
            <span
              style="display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 11.5px;"
            >
              {selectedFolder.promptCount} prompts · {selectedFolder.updated}
            </span>
          </span>
          <ChevronDown
            size={18}
            strokeWidth={2.2}
            style={`color: ${hoveredSelector || isFolderSelectorOpen ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-icon-glyph)'}; transform: rotate(${isFolderSelectorOpen ? '180deg' : '0deg'}); transition: color 120ms ease, transform 100ms ease-out;`}
          />
        </button>

        {#if isFolderSelectorOpen}
          <div
            style="position: absolute; z-index: 4; top: calc(100% + 8px); left: 0; right: 0; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: var(--ui-card-overlay-surface); box-shadow: 0 18px 44px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight); padding: 6px; display: flex; flex-direction: column; gap: 2px;"
          >
            {#each folderOptions as folder (folder.id)}
              <button
                type="button"
                style={folderOptionStyle(folder.id)}
                onmouseenter={() => {
                  hoveredFolderId = folder.id
                }}
                onmouseleave={() => {
                  hoveredFolderId = null
                }}
                onclick={() => {
                  selectFolder(folder.id)
                }}
              >
                <span style={selectorIconStyle(selectedFolderId === folder.id || hoveredFolderId === folder.id)}>
                  <Folder size={18} strokeWidth={2.1} />
                </span>
                <span style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span
                    style={`display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${selectedFolderId === folder.id || hoveredFolderId === folder.id ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font-size: 14px; font-weight: 620;`}
                  >
                    {folder.name}
                  </span>
                  <span
                    style="display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 11.5px;"
                  >
                    {folder.promptCount} prompts · {folder.updated}
                  </span>
                </span>
              </button>
            {/each}

            <button
              type="button"
              style={`margin-top: 5px; height: 34px; width: 100%; border: 1px solid ${hoveredNewFolder ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; background: ${hoveredNewFolder ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color: var(--ui-accent-normal-text); cursor: pointer; font-size: 13px; font-weight: 650; transition: background 70ms ease-out, border-color 70ms ease-out;`}
              onmouseenter={() => {
                hoveredNewFolder = true
              }}
              onmouseleave={() => {
                hoveredNewFolder = false
              }}
            >
              <FolderPlus size={16} strokeWidth={2.2} />
              New Prompt Folder
            </button>
          </div>
        {/if}
      </div>
    </div>

    <div style="min-height: 0; flex: 1; overflow: hidden; padding: 8px 3px 12px 5px;">
      <div style="height: 100%; overflow: hidden; padding-right: 2px;">
        {#each selectedTree.rootPrompts as promptName (promptName)}
          <div style={promptRowStyle(true)}>
            <span></span>
            <button
              type="button"
              aria-current={selectedPrompt === promptName ? 'true' : undefined}
              style={promptButtonStyle(promptName, true)}
              onmouseenter={() => {
                hoveredPromptName = promptName
              }}
              onmouseleave={() => {
                hoveredPromptName = null
              }}
              onclick={() => {
                selectedPrompt = promptName
              }}
            >
              <span
                style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px;"
              >
                {promptName}
              </span>
            </button>
          </div>
        {/each}

        {#each selectedTree.folders as folder (folder.id)}
          <div style="width: 100%; padding-block: 1px;">
            <div
              role="presentation"
              style={treeFolderRowStyle(folder)}
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
                style="display: flex; height: 100%; min-width: 0; flex: 1; align-items: center; gap: 8px; border: 0; background: transparent; padding-inline: 10px 6px; color: inherit; text-align: left; cursor: pointer;"
              >
                <span
                  style="display: flex; height: 20px; width: 20px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: var(--cthulhu-ui-radius-control); color: inherit;"
                >
                  {#if folder.expanded}
                    <ChevronDown size={16} strokeWidth={2.25} />
                  {:else}
                    <ChevronRight size={16} strokeWidth={2.25} />
                  {/if}
                </span>
                <span
                  style="min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500;"
                >
                  {folder.name}
                </span>
              </button>

              <div
                style="display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; margin-right: 6px; pointer-events: none;"
              >
                {#if hoveredTreeFolderId === folder.id}
                  <div style="display: flex; gap: 2px; pointer-events: auto;">
                    <button
                      type="button"
                      title="Folder Options"
                      aria-label={`Folder options for ${folder.name}`}
                      style={iconButtonStyle(`folder-menu-${folder.id}`)}
                      onmouseenter={() => {
                        hoveredActionId = `folder-menu-${folder.id}`
                      }}
                      onmouseleave={() => {
                        hoveredActionId = null
                      }}
                    >
                      <MoreHorizontal size={16} strokeWidth={2.15} />
                    </button>
                    <button
                      type="button"
                      title="Open Folder"
                      aria-label={`Open ${folder.name}`}
                      style={iconButtonStyle(`folder-open-${folder.id}`)}
                      onmouseenter={() => {
                        hoveredActionId = `folder-open-${folder.id}`
                      }}
                      onmouseleave={() => {
                        hoveredActionId = null
                      }}
                    >
                      <ArrowRight size={16} strokeWidth={2.15} />
                    </button>
                  </div>
                {:else}
                  <span
                    style="display: inline-flex; height: 22px; min-width: 26px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: var(--cthulhu-ui-radius-card); background: transparent; padding: 0 8px; color: var(--ui-secondary-text); font-size: 12px; font-weight: 600; line-height: 1;"
                  >
                    {folder.count}
                  </span>
                {/if}
              </div>
            </div>
          </div>

          {#if folder.expanded}
            {#each folder.prompts as promptName (promptName)}
              <div style={promptRowStyle(false)}>
                <span style="position: relative; min-height: 30px; align-self: stretch;">
                  <span
                    style="display: block; position: absolute; top: -1px; bottom: -1px; left: 20px; width: 1px; background: var(--ui-neutral-emphasis-border);"
                  ></span>
                </span>
                <button
                  type="button"
                  aria-current={selectedPrompt === promptName ? 'true' : undefined}
                  style={promptButtonStyle(promptName, false)}
                  onmouseenter={() => {
                    hoveredPromptName = promptName
                  }}
                  onmouseleave={() => {
                    hoveredPromptName = null
                  }}
                  onclick={() => {
                    selectedPrompt = promptName
                  }}
                >
                  <span
                    style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px;"
                  >
                    {promptName}
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
