<script lang="ts">
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    FolderPlus,
    Home,
    Search,
    Settings,
    Sparkles
  } from 'lucide-svelte'

  type IconComponent = typeof Home

  type NavItem = {
    label: string
    icon: IconComponent
    active?: boolean
  }

  type PromptItem = {
    title: string
    active?: boolean
  }

  type PromptFolder = {
    name: string
    count: number
    expanded?: boolean
    active?: boolean
    prompts: PromptItem[]
  }

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home },
    { label: 'Settings', icon: Settings }
  ]

  const promptFolders: PromptFolder[] = [
    {
      name: 'Agent Handoff',
      count: 5,
      expanded: true,
      prompts: [
        { title: 'Release triage' },
        { title: 'Repo map' },
        { title: 'IPC contract review' },
        { title: 'Refactor checklist' },
        { title: 'Playwright runbook' }
      ]
    },
    {
      name: 'Electron UI Pass',
      count: 3,
      expanded: true,
      active: true,
      prompts: [
        { title: 'Sidebar polish', active: true },
        { title: 'Prompt editor QA' },
        { title: 'Empty states' }
      ]
    },
    {
      name: 'Local Models',
      count: 2,
      prompts: []
    },
    {
      name: 'Archived Experiments',
      count: 7,
      prompts: []
    }
  ]

  const rootStyle =
    'width:min(100%, 356px); height:860px; display:flex; color:var(--ui-normal-text); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
  const sidebarStyle =
    'width:100%; height:100%; display:grid; grid-template-columns:54px minmax(0, 1fr); overflow:hidden; border:1px solid var(--ui-card-normal-border); border-radius:0 18px 18px 0; background:radial-gradient(circle at 18% 0%, oklch(0.38 0.08 178 / 26%), transparent 28%), radial-gradient(circle at 104% 20%, oklch(0.42 0.1 292 / 18%), transparent 32%), linear-gradient(180deg, oklch(0.17 0.013 260) 0%, oklch(0.12 0.012 270) 100%); box-shadow:0 24px 70px oklch(0 0 0 / 36%), inset 1px 0 0 oklch(1 0 0 / 8%), inset -1px 0 0 oklch(1 0 0 / 7%);'
  const railStyle =
    'display:flex; flex-direction:column; align-items:center; gap:10px; padding:12px 8px; border-right:1px solid oklch(1 0 0 / 8%); background:linear-gradient(180deg, oklch(0 0 0 / 20%), oklch(1 0 0 / 3%));'
  const panelStyle = 'display:flex; min-width:0; min-height:0; flex-direction:column;'
  const iconButtonStyle =
    'width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-muted-border); border-radius:12px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text); box-shadow:inset 0 1px 0 oklch(1 0 0 / 7%);'
  const activeRailButtonStyle =
    'width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:1px solid oklch(0.82 0.12 176 / 46%); border-radius:12px; background:linear-gradient(180deg, oklch(0.64 0.12 176 / 24%), oklch(1 0 0 / 6%)); color:var(--ui-normal-text); box-shadow:0 8px 24px oklch(0 0 0 / 26%), inset 0 1px 0 oklch(1 0 0 / 12%);'
  const headerStyle =
    'padding:14px 14px 12px; border-bottom:1px solid oklch(1 0 0 / 8%); background:linear-gradient(180deg, oklch(1 0 0 / 4%), transparent);'
  const workspaceCardStyle =
    'display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:10px; align-items:center; padding:10px; border:1px solid var(--ui-neutral-normal-border); border-radius:14px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:inset 0 1px 0 oklch(1 0 0 / 8%);'
  const workspaceTitleStyle =
    'margin:0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-normal-text); font-size:14px; line-height:20px; font-weight:650; letter-spacing:0;'
  const workspacePathStyle =
    'margin:1px 0 0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-muted-text); font-size:11px; line-height:15px;'
  const searchStyle =
    'display:flex; align-items:center; gap:8px; height:34px; margin-top:10px; padding:0 10px; border:1px solid var(--ui-neutral-muted-border); border-radius:10px; background:oklch(0 0 0 / 16%); color:var(--ui-muted-text); box-shadow:inset 0 1px 0 oklch(1 0 0 / 4%);'
  const treeHeaderStyle =
    'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 14px 8px; border-top:1px solid oklch(1 0 0 / 8%);'
  const eyebrowStyle =
    'margin:0; color:var(--ui-secondary-text); font-size:11px; line-height:14px; font-weight:750; letter-spacing:0.18em; text-transform:uppercase;'
  const countStyle = 'margin:2px 0 0; color:var(--ui-muted-text); font-size:12px; line-height:16px;'
  const actionGroupStyle =
    'display:flex; align-items:center; gap:4px; padding:3px; border:1px solid var(--ui-neutral-muted-border); border-radius:12px; background:oklch(0 0 0 / 14%);'
  const actionButtonStyle =
    'width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid transparent; border-radius:9px; background:transparent; color:var(--ui-secondary-text);'
  const addButtonStyle =
    'width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid var(--ui-accent-normal-border); border-radius:9px; background:var(--ui-accent-normal-surface); color:var(--ui-accent-normal-text);'
  const treeStyle =
    'display:flex; min-height:0; flex:1; flex-direction:column; gap:4px; padding:0 9px 12px 10px; overflow:hidden;'
  const folderRowStyle =
    'display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:8px; min-height:36px; padding:0 8px; border:1px solid transparent; border-radius:11px; color:var(--ui-hoverable-text);'
  const activeFolderRowStyle =
    'display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:8px; min-height:38px; padding:0 8px; border:1px solid oklch(0.82 0.12 176 / 34%); border-radius:12px; background:linear-gradient(90deg, oklch(0.62 0.12 176 / 22%), var(--ui-neutral-normal-surface)); color:var(--ui-normal-text); box-shadow:inset 0 1px 0 oklch(1 0 0 / 10%);'
  const folderNameStyle =
    'min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:18px; font-weight:650;'
  const badgeStyle =
    'min-width:24px; height:20px; display:inline-flex; align-items:center; justify-content:center; padding:0 7px; border:1px solid var(--ui-neutral-muted-border); border-radius:999px; background:oklch(0 0 0 / 15%); color:var(--ui-secondary-text); font-size:11px; line-height:1; font-weight:700;'
  const promptListStyle =
    'display:flex; flex-direction:column; gap:2px; margin:2px 0 4px 26px; padding-left:11px; border-left:1px solid oklch(1 0 0 / 8%);'
  const promptRowStyle =
    'display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border:1px solid transparent; border-radius:9px; color:var(--ui-secondary-text); font-size:13px; line-height:18px;'
  const activePromptRowStyle =
    'display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border:1px solid var(--ui-neutral-emphasis-border); border-radius:9px; background:var(--ui-neutral-emphasis-surface); color:var(--ui-normal-text); font-size:13px; line-height:18px; box-shadow:inset 0 1px 0 oklch(1 0 0 / 8%);'
</script>

<div style={rootStyle}>
  <aside style={sidebarStyle} aria-label="Application sidebar">
    <nav style={railStyle} aria-label="Primary">
      <div
        style="width:38px; height:38px; display:flex; align-items:center; justify-content:center; border:1px solid oklch(1 0 0 / 13%); border-radius:14px; background:oklch(1 0 0 / 8%); box-shadow:inset 0 1px 0 oklch(1 0 0 / 12%);"
      >
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          draggable="false"
          style="width:28px; height:28px; object-fit:contain;"
        />
      </div>

      <div style="width:24px; height:1px; margin:2px 0; background:oklch(1 0 0 / 10%);"></div>

      {#each navItems as item (item.label)}
        {@const Icon = item.icon}
        <button
          type="button"
          aria-label={item.label}
          title={item.label}
          style={item.active ? activeRailButtonStyle : iconButtonStyle}
        >
          <Icon size={17} strokeWidth={2.2} />
        </button>
      {/each}

      <div style="flex:1;"></div>

      <button type="button" aria-label="Search" title="Search" style={iconButtonStyle}>
        <Search size={17} strokeWidth={2.2} />
      </button>
    </nav>

    <section style={panelStyle} aria-label="Workspace">
      <header style={headerStyle}>
        <div style={workspaceCardStyle}>
          <div style="min-width:0;">
            <h1 style={workspaceTitleStyle}>CthulhuPromptPublic</h1>
            <p style={workspacePathStyle}>C:\Source\PromptApps\CthulhuPromptPublic</p>
          </div>
          <div
            style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:1px solid oklch(0.82 0.12 176 / 30%); border-radius:11px; background:oklch(0.62 0.12 176 / 16%); color:oklch(0.93 0.08 176);"
          >
            <Sparkles size={16} strokeWidth={2.2} />
          </div>
        </div>

        <div style={searchStyle}>
          <Search size={14} strokeWidth={2.2} />
          <span
            style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px;"
            >Find prompts</span
          >
        </div>
      </header>

      <div style={treeHeaderStyle}>
        <div style="min-width:0;">
          <p style={eyebrowStyle}>Prompts</p>
          <p style={countStyle}>4 folders</p>
        </div>
        <div style={actionGroupStyle}>
          <button type="button" aria-label="Expand All Prompt Folders" title="Expand All Prompt Folders" style={actionButtonStyle}>
            <ChevronsUpDown size={15} strokeWidth={2.2} />
          </button>
          <button type="button" aria-label="Collapse All Prompt Folders" title="Collapse All Prompt Folders" style={actionButtonStyle}>
            <ChevronsDownUp size={15} strokeWidth={2.2} />
          </button>
          <button type="button" aria-label="New Prompt Folder" title="New Prompt Folder" style={addButtonStyle}>
            <FolderPlus size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div style={treeStyle}>
        {#each promptFolders as folder (folder.name)}
          <button type="button" style={folder.active ? activeFolderRowStyle : folderRowStyle}>
            {#if folder.expanded}
              <ChevronDown size={16} strokeWidth={2.3} />
            {:else}
              <ChevronRight size={16} strokeWidth={2.3} />
            {/if}
            <span style="display:flex; min-width:0; align-items:center; gap:8px;">
              <Folder size={15} strokeWidth={2.2} style="flex:0 0 auto;" />
              <span style={folderNameStyle}>{folder.name}</span>
            </span>
            <span style={badgeStyle}>{folder.count}</span>
          </button>

          {#if folder.expanded}
            <div style={promptListStyle}>
              {#each folder.prompts as prompt (prompt.title)}
                <button
                  type="button"
                  style={prompt.active ? activePromptRowStyle : promptRowStyle}
                  aria-current={prompt.active ? 'true' : undefined}
                >
                  <FileText size={14} strokeWidth={2.1} style="flex:0 0 auto;" />
                  <span
                    style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                    >{prompt.title}</span
                  >
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </section>
  </aside>
</div>
