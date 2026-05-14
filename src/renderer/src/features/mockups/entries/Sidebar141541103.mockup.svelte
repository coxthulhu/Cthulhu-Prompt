<script lang="ts">
  import type { ComponentType } from 'svelte'
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
  import appIcon from '@renderer/assets/cutethulhu.png'

  type NavItem = {
    label: string
    icon: ComponentType
    active?: boolean
  }

  type PromptItem = {
    title: string
    active?: boolean
  }

  type PromptFolderItem = {
    name: string
    count: number
    open: boolean
    active?: boolean
    settingsActive?: boolean
    prompts: PromptItem[]
  }

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home },
    { label: 'Prompt Folders', icon: Folder, active: true }
  ]

  const promptFolders: PromptFolderItem[] = [
    {
      name: 'Codex Workflows',
      count: 5,
      open: true,
      active: true,
      prompts: [
        { title: 'Plan Svelte Refactor' },
        { title: 'Review Renderer IPC', active: true },
        { title: 'Playwright Regression Sweep' },
        { title: 'Release Notes Draft' }
      ]
    },
    {
      name: 'Product Copy',
      count: 3,
      open: true,
      prompts: [
        { title: 'Workspace Empty State' },
        { title: 'Dialog Error Text' },
        { title: 'Prompt Folder Summary' }
      ]
    },
    {
      name: 'Bug Reports',
      count: 4,
      open: false,
      prompts: []
    },
    {
      name: 'Local Models',
      count: 2,
      open: true,
      settingsActive: true,
      prompts: [{ title: 'Quantization Checklist' }, { title: 'Offline Coding Agent' }]
    }
  ]

  const rootStyle =
    'width: 100%; min-height: 760px; display: flex; align-items: stretch; color: var(--ui-normal-text); font-family: Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;'
  const sidebarStyle =
    'width: 348px; min-height: 720px; display: grid; grid-template-columns: 58px minmax(0, 1fr); overflow: hidden; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, oklch(0.18 0.018 264), oklch(0.125 0.018 252)); box-shadow: 0 18px 42px oklch(0 0 0 / 34%), inset 0 1px 0 var(--ui-card-nested-inset-highlight);'
  const railStyle =
    'display: grid; grid-template-rows: auto 1fr auto; gap: 12px; border-right: 1px solid var(--ui-neutral-muted-border); background: linear-gradient(180deg, oklch(1 0 0 / 7%), oklch(1 0 0 / 2%)); padding: 10px 8px;'
  const logoButtonStyle =
    'display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-normal-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight);'
  const navListStyle = 'display: flex; min-width: 0; flex-direction: column; gap: 7px; margin: 0; padding: 0; list-style: none;'
  const railButtonBaseStyle =
    'display: flex; width: 40px; height: 40px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-secondary-text); background: transparent;'
  const railButtonActiveStyle =
    'border-color: var(--ui-accent-normal-border); background: linear-gradient(180deg, var(--ui-accent-normal-surface), var(--ui-neutral-normal-surface)); color: var(--ui-accent-normal-text); box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);'
  const mainStyle =
    'display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 12px 10px 10px;'
  const workspaceStyle =
    'display: grid; gap: 9px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-neutral-muted-surface)); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); padding: 10px;'
  const workspaceNameStyle =
    'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; color: var(--ui-normal-text); font-size: 14px; font-weight: 720; line-height: 18px;'
  const workspacePathStyle =
    'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; color: var(--ui-muted-text); font-size: 11px; line-height: 16px;'
  const promptHeaderStyle =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 2px 8px;'
  const sectionTitleStyle =
    'margin: 0; color: var(--ui-secondary-text); font-size: 11px; font-weight: 760; letter-spacing: 0; line-height: 14px; text-transform: uppercase;'
  const sectionCountStyle = 'margin: 2px 0 0; color: var(--ui-muted-text); font-size: 12px; line-height: 16px;'
  const iconActionStyle =
    'display: inline-flex; width: 28px; height: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);'
  const createActionStyle =
    'border-color: var(--ui-accent-normal-border); background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); box-shadow: var(--cthulhu-ui-shadow-surface-highlight);'
  const treePanelStyle =
    'display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: oklch(0.145 0.011 266.847 / 72%); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 6px;'
  const folderRowBaseStyle =
    'display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 5px; min-height: 38px; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); padding: 0 6px; color: var(--ui-hoverable-text);'
  const folderRowActiveStyle =
    'border-color: var(--ui-info-normal-border); background: linear-gradient(90deg, var(--ui-info-normal-surface), var(--ui-neutral-normal-surface)); color: var(--ui-normal-text); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);'
  const folderLabelStyle =
    'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; line-height: 18px;'
  const countBadgeStyle =
    'display: inline-flex; min-width: 24px; height: 20px; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-normal-surface); padding: 0 6px; color: var(--ui-secondary-text); font-size: 11px; font-weight: 760; line-height: 1;'
  const childRailStyle =
    'display: grid; gap: 3px; margin: 1px 0 8px 18px; border-left: 1px solid var(--ui-neutral-muted-border); padding-left: 9px;'
  const childButtonBaseStyle =
    'display: flex; min-width: 0; height: 30px; cursor: pointer; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); background: transparent; padding: 0 8px; color: var(--ui-secondary-text); text-align: left;'
  const childButtonActiveStyle =
    'border-color: var(--ui-neutral-emphasis-border); background: var(--ui-neutral-emphasis-surface); color: var(--ui-normal-text); box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);'
</script>

<div style={rootStyle}>
  <aside style={sidebarStyle} aria-label="Cthulhu Prompt sidebar">
    <div style={railStyle}>
      <div style={logoButtonStyle}>
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          draggable="false"
          style="width: 30px; height: 30px; object-fit: contain;"
        />
      </div>

      <ul style={navListStyle}>
        {#each navItems as item (item.label)}
          {@const Icon = item.icon}
          <li>
            <button
              type="button"
              aria-label={item.label}
              title={item.label}
              style={`${railButtonBaseStyle} ${item.active ? railButtonActiveStyle : ''}`}
            >
              <Icon style="width: 17px; height: 17px;" strokeWidth={2.25} />
            </button>
          </li>
        {/each}
      </ul>

      <button type="button" aria-label="Settings" title="Settings" style={railButtonBaseStyle}>
        <Settings style="width: 17px; height: 17px;" strokeWidth={2.25} />
      </button>
    </div>

    <div style={mainStyle}>
      <div style={workspaceStyle}>
        <div style="display: flex; min-width: 0; align-items: center; gap: 9px;">
          <div
            style="display: flex; width: 30px; height: 30px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-card-nested-surface); color: var(--ui-accent-normal-text);"
          >
            <Folder style="width: 15px; height: 15px;" strokeWidth={2.3} />
          </div>
          <div style="min-width: 0;">
            <h1 style={workspaceNameStyle}>CthulhuPromptPublic</h1>
            <p style={workspacePathStyle}>C:\Source\PromptApps\CthulhuPromptPublic</p>
          </div>
        </div>
      </div>

      <div style={promptHeaderStyle}>
        <div>
          <p style={sectionTitleStyle}>Prompts</p>
          <p style={sectionCountStyle}>4 folders</p>
        </div>
        <div style="display: flex; flex-shrink: 0; align-items: center; gap: 2px;">
          <button type="button" aria-label="Expand All Prompt Folders" title="Expand All Prompt Folders" style={iconActionStyle}>
            <ChevronsUpDown style="width: 15px; height: 15px;" strokeWidth={2.3} />
          </button>
          <button type="button" aria-label="Collapse All Prompt Folders" title="Collapse All Prompt Folders" style={iconActionStyle}>
            <ChevronsDownUp style="width: 15px; height: 15px;" strokeWidth={2.3} />
          </button>
          <button type="button" aria-label="Create Prompt Folder" title="Create Prompt Folder" style={`${iconActionStyle} ${createActionStyle}`}>
            <Plus style="width: 15px; height: 15px;" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div style={treePanelStyle}>
        {#each promptFolders as folder (folder.name)}
          <section style="min-width: 0;">
            <div style={`${folderRowBaseStyle} ${folder.active ? folderRowActiveStyle : ''}`}>
              <div style="display: flex; align-items: center; justify-content: center; color: inherit;">
                {#if folder.open}
                  <ChevronDown style="width: 15px; height: 15px;" strokeWidth={2.35} />
                {:else}
                  <ChevronRight style="width: 15px; height: 15px;" strokeWidth={2.35} />
                {/if}
              </div>
              <div style="display: flex; min-width: 0; align-items: center; gap: 8px;">
                <Folder style="width: 15px; height: 15px; flex-shrink: 0;" strokeWidth={2.25} />
                <span style={folderLabelStyle}>{folder.name}</span>
              </div>
              <div style="display: flex; flex-shrink: 0; align-items: center; gap: 4px;">
                <span style={countBadgeStyle}>{folder.count}</span>
                <button
                  type="button"
                  aria-label={`Folder settings for ${folder.name}`}
                  title="Folder Settings"
                  style={`${iconActionStyle} width: 24px; height: 24px; ${folder.settingsActive ? childButtonActiveStyle : ''}`}
                >
                  <Settings style="width: 14px; height: 14px;" strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  aria-label={`Open ${folder.name}`}
                  title={`Open ${folder.name}`}
                  style={`${iconActionStyle} width: 24px; height: 24px;`}
                >
                  <ArrowRight style="width: 14px; height: 14px;" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            {#if folder.open}
              <div style={childRailStyle}>
                <button
                  type="button"
                  style={`${childButtonBaseStyle} ${folder.settingsActive ? childButtonActiveStyle : ''}`}
                >
                  <Settings style="width: 14px; height: 14px; flex-shrink: 0;" strokeWidth={2.2} />
                  <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">Folder Settings</span>
                </button>
                {#each folder.prompts as prompt (prompt.title)}
                  <button
                    type="button"
                    style={`${childButtonBaseStyle} ${prompt.active ? childButtonActiveStyle : ''}`}
                    aria-current={prompt.active ? 'true' : undefined}
                  >
                    <FileText style="width: 14px; height: 14px; flex-shrink: 0;" strokeWidth={2.2} />
                    <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">{prompt.title}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  </aside>
</div>
