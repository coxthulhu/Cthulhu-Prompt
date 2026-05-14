<script lang="ts">
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Settings
  } from 'lucide-svelte'

  const railItems = [
    { label: 'Home', icon: Home, active: false },
    { label: 'Settings', icon: Settings, active: false }
  ]

  const promptFolders = [
    {
      name: 'Codex Workflows',
      count: 5,
      active: true,
      expanded: true,
      prompts: [
        { title: 'Feature implementation pass', active: false },
        { title: 'Bug hunt with reproduction steps', active: true },
        { title: 'PR review checklist', active: false }
      ]
    },
    {
      name: 'Research Notes',
      count: 3,
      active: false,
      expanded: true,
      prompts: [
        { title: 'API comparison brief', active: false },
        { title: 'Model behavior summary', active: false }
      ]
    },
    {
      name: 'Release Prep',
      count: 4,
      active: false,
      expanded: false,
      prompts: []
    },
    {
      name: 'Scratchpad',
      count: 2,
      active: false,
      expanded: true,
      prompts: [
        { title: 'One-off migration notes', active: false },
        { title: 'Local test matrix', active: false }
      ]
    }
  ]
</script>

<div style="display: flex; min-height: 680px; width: 100%; min-width: 0; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;">
  <aside style="display: flex; height: 680px; width: 336px; min-width: 336px; overflow: hidden; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, oklch(0.17 0.012 255), oklch(0.105 0.016 248)); box-shadow: var(--cthulhu-ui-shadow-card);">
    <nav style="display: flex; width: 58px; flex-shrink: 0; flex-direction: column; align-items: center; gap: 10px; border-right: 1px solid var(--ui-neutral-muted-border); background: linear-gradient(180deg, oklch(1 0 0 / 7%), oklch(1 0 0 / 2%)); padding: 10px 8px;">
      <img
        src={appIcon}
        alt="Cthulhu Prompt icon"
        draggable="false"
        style="height: 32px; width: 32px; flex-shrink: 0; object-fit: contain;"
      />

      <div style="height: 1px; width: 28px; flex-shrink: 0; background: var(--ui-neutral-normal-border);"></div>

      {#each railItems as item (item.label)}
        {@const Icon = item.icon}
        <button
          type="button"
          aria-label={item.label}
          title={item.label}
          style={`display: inline-flex; height: 40px; width: 40px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid ${item.active ? 'var(--ui-neutral-emphasis-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: var(--cthulhu-ui-radius-control); background: ${item.active ? 'var(--ui-neutral-emphasis-surface)' : 'var(--ui-neutral-muted-surface)'}; box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: ${item.active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};`}
        >
          <Icon size={18} strokeWidth={2.2} />
        </button>
      {/each}

      <div style="min-height: 0; flex: 1;"></div>

      <button
        type="button"
        aria-label="Add Prompt Folder"
        title="Add Prompt Folder"
        style="display: inline-flex; height: 40px; width: 40px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-accent-normal-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: var(--ui-accent-normal-text);"
      >
        <Plus size={18} strokeWidth={2.3} />
      </button>
    </nav>

    <div style="display: flex; min-width: 0; flex: 1; flex-direction: column;">
      <header style="display: grid; gap: 10px; border-bottom: 1px solid var(--ui-neutral-muted-border); padding: 14px 14px 12px;">
        <div style="display: flex; min-width: 0; align-items: center; gap: 10px;">
          <div style="display: flex; height: 34px; width: 34px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--ui-info-normal-border); border-radius: var(--cthulhu-ui-radius-control); background: linear-gradient(180deg, var(--ui-info-normal-surface), var(--ui-neutral-muted-surface)); color: var(--ui-normal-text);">
            <Folder size={17} strokeWidth={2.2} />
          </div>
          <div style="min-width: 0; flex: 1;">
            <h1 style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 14px; font-weight: 720; line-height: 19px;">Workspace Prompts</h1>
            <p style="margin: 1px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">C:\Source\AI\Workspace Prompts</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button
            type="button"
            style="display: inline-flex; height: 34px; cursor: pointer; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-muted-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: var(--ui-hoverable-text); font-size: 13px; font-weight: 650;"
          >
            <Home size={15} strokeWidth={2.2} />
            Home
          </button>
          <button
            type="button"
            style="display: inline-flex; height: 34px; cursor: pointer; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-muted-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: var(--ui-hoverable-text); font-size: 13px; font-weight: 650;"
          >
            <Settings size={15} strokeWidth={2.2} />
            Settings
          </button>
        </div>
      </header>

      <section style="display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 12px 8px 8px 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 4px 10px 2px;">
          <div style="min-width: 0;">
            <p style="margin: 0; color: var(--ui-secondary-text); font-size: 11px; font-weight: 760; letter-spacing: 0.14em; line-height: 14px; text-transform: uppercase;">Prompts</p>
            <p style="margin: 2px 0 0; color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">4 folders</p>
          </div>
          <div style="display: flex; flex-shrink: 0; align-items: center; gap: 3px;">
            <button
              type="button"
              aria-label="Expand All Prompt Folders"
              title="Expand All Prompt Folders"
              style="display: inline-flex; height: 28px; width: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
            >
              <ChevronsUpDown size={16} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              aria-label="Collapse All Prompt Folders"
              title="Collapse All Prompt Folders"
              style="display: inline-flex; height: 28px; width: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
            >
              <ChevronsDownUp size={16} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              aria-label="Add Prompt Folder"
              title="Add Prompt Folder"
              style="display: inline-flex; height: 28px; width: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: var(--cthulhu-ui-radius-icon-button); background: var(--ui-accent-normal-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: var(--ui-accent-normal-text);"
            >
              <Plus size={16} strokeWidth={2.3} />
            </button>
          </div>
        </div>

        <div style="min-height: 0; overflow: hidden; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: var(--cthulhu-ui-shadow-surface-highlight);">
          <div style="display: grid; gap: 2px; padding: 5px;">
            {#each promptFolders as folder (folder.name)}
              <div>
                <div style={`display: flex; height: 38px; min-width: 0; align-items: center; gap: 7px; border: 1px solid ${folder.active ? 'var(--ui-info-normal-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${folder.active ? 'linear-gradient(90deg, var(--ui-info-normal-surface), var(--ui-neutral-normal-surface))' : 'transparent'}; box-shadow: ${folder.active ? 'inset 0 1px 0 oklch(1 0 0 / 10%)' : 'none'}; color: ${folder.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; padding: 0 5px 0 7px;`}>
                  <button
                    type="button"
                    aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                    aria-expanded={folder.expanded}
                    style="display: inline-flex; height: 24px; width: 22px; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: center; border: 0; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: inherit;"
                  >
                    {#if folder.expanded}
                      <ChevronDown size={16} strokeWidth={2.2} />
                    {:else}
                      <ChevronRight size={16} strokeWidth={2.2} />
                    {/if}
                  </button>
                  <Folder size={16} strokeWidth={2.15} style="flex-shrink: 0;" />
                  <span style="min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 680;">{folder.name}</span>
                  <span style="display: inline-flex; height: 20px; min-width: 24px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-normal-surface); color: var(--ui-secondary-text); font-size: 11px; font-weight: 700; line-height: 1;">{folder.count}</span>
                  <button
                    type="button"
                    aria-label={`Open ${folder.name}`}
                    style="display: inline-flex; height: 24px; width: 24px; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
                  >
                    <ArrowRight size={15} strokeWidth={2.2} />
                  </button>
                </div>

                {#if folder.expanded}
                  <div style="display: grid; gap: 1px; padding: 1px 0 4px 35px;">
                    <button
                      type="button"
                      style="display: flex; height: 30px; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); background: transparent; color: var(--ui-secondary-text); padding: 0 8px; text-align: left;"
                    >
                      <Settings size={14} strokeWidth={2.1} style="flex-shrink: 0;" />
                      <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 560;">Folder Settings</span>
                    </button>
                    {#each folder.prompts as prompt (prompt.title)}
                      <button
                        type="button"
                        aria-current={prompt.active ? 'true' : undefined}
                        style={`display: flex; height: 30px; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid ${prompt.active ? 'var(--ui-neutral-emphasis-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${prompt.active ? 'var(--ui-neutral-emphasis-surface)' : 'transparent'}; box-shadow: ${prompt.active ? 'var(--cthulhu-ui-shadow-surface-highlight-active)' : 'none'}; color: ${prompt.active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}; padding: 0 8px; text-align: left;`}
                      >
                        <FileText size={14} strokeWidth={2.1} style="flex-shrink: 0;" />
                        <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 560;">{prompt.title}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </section>
    </div>
  </aside>
</div>
