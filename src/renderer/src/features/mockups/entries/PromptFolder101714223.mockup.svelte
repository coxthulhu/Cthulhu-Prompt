<script lang="ts">
  import {
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Search,
    Settings,
    Sparkles
  } from 'lucide-svelte'

  const navItems = [
    { label: 'Home', icon: Home, active: false },
    { label: 'Settings', icon: Settings, active: false }
  ]

  const promptFolders = [
    {
      name: 'Claude Code Workflows',
      count: 8,
      active: true,
      prompts: ['Repo orientation', 'Focused implementation pass', 'Review for regressions']
    },
    {
      name: 'Release Notes',
      count: 5,
      active: false,
      prompts: ['Summarize merged changes', 'Draft customer-facing notes']
    },
    {
      name: 'Architecture Notes',
      count: 4,
      active: false,
      prompts: ['Compare persistence options', 'Map renderer data flow']
    },
    {
      name: 'Bug Triage',
      count: 6,
      active: false,
      prompts: ['Reproduce from logs', 'Minimal failing case']
    }
  ]

  const shellStyle =
    'height: 100%; min-height: 720px; display: flex; color: var(--ui-normal-text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
  const sidebarStyle =
    'width: 318px; min-width: 318px; height: 100%; display: flex; flex-direction: column; border-right: 1px solid var(--ui-card-normal-border); background: linear-gradient(180deg, oklch(0.18 0.014 270 / 0.96) 0%, oklch(0.125 0.012 260 / 0.96) 100%); box-shadow: inset -1px 0 0 oklch(1 0 0 / 0.04);'
  const workspaceStyle =
    'display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; padding: 14px 14px 12px; border-bottom: 1px solid var(--ui-neutral-muted-border);'
  const appMarkStyle =
    'height: 40px; width: 40px; display: grid; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; color: var(--ui-accent-normal-text); background: radial-gradient(circle at 30% 18%, var(--ui-accent-normal-fill), transparent 38%), var(--ui-neutral-normal-surface); box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.08), 0 10px 30px oklch(0 0 0 / 0.24);'
  const workspaceNameStyle =
    'margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 14px; font-weight: 720; line-height: 20px;'
  const workspacePathStyle =
    'margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 12px; line-height: 16px;'
  const navWrapStyle =
    'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--ui-neutral-muted-border);'
  const sectionStyle =
    'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 14px 8px;'
  const sectionLabelStyle =
    'margin: 0; color: var(--ui-secondary-text); font-size: 11px; font-weight: 700; letter-spacing: 0.18em; line-height: 16px; text-transform: uppercase;'
  const sectionCountStyle =
    'margin: 1px 0 0; color: var(--ui-muted-text); font-size: 12px; line-height: 16px;'
  const toolbarStyle = 'display: flex; align-items: center; gap: 2px;'
  const iconButtonStyle =
    'height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 7px; color: var(--ui-secondary-text); background: transparent; cursor: pointer;'
  const promptListStyle =
    'min-height: 0; flex: 1; overflow: hidden auto; padding: 0 8px 14px 10px; display: flex; flex-direction: column; gap: 6px;'
  const folderCardStyle =
    'border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.05);'
  const activeFolderCardStyle =
    'border-color: var(--ui-accent-normal-border); background: linear-gradient(180deg, var(--ui-accent-normal-surface), var(--ui-neutral-normal-surface)); box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.1), 0 18px 34px oklch(0 0 0 / 0.18);'
  const folderHeaderStyle =
    'width: 100%; min-width: 0; height: 40px; display: flex; align-items: center; gap: 8px; border: 0; border-radius: 8px; background: transparent; color: var(--ui-hoverable-text); padding: 0 8px; text-align: left; cursor: pointer;'
  const activeFolderHeaderStyle = 'color: var(--ui-normal-text);'
  const folderTitleStyle =
    'min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; line-height: 18px;'
  const countStyle =
    'height: 20px; min-width: 24px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; color: var(--ui-secondary-text); background: var(--ui-neutral-muted-surface); font-size: 11px; font-weight: 650;'
  const settingsRowStyle =
    'height: 30px; display: flex; align-items: center; gap: 8px; margin: 0 8px 4px 33px; border-radius: 7px; padding: 0 8px; color: var(--ui-secondary-text); font-size: 13px;'
  const activeSettingsRowStyle =
    'border: 1px solid var(--ui-neutral-emphasis-border); background: var(--ui-neutral-emphasis-surface); color: var(--ui-normal-text);'
  const promptRowStyle =
    'height: 30px; min-width: 0; display: flex; align-items: center; gap: 8px; margin: 0 8px 3px 33px; border-radius: 7px; padding: 0 8px; color: var(--ui-muted-text); font-size: 13px;'
  const mainStyle = 'min-width: 0; flex: 1; display: flex; flex-direction: column;'
  const breadcrumbStyle =
    'height: 36px; display: flex; align-items: center; border-bottom: 1px solid var(--ui-neutral-muted-border); background: oklch(0.13 0.01 265 / 0.78); padding: 0 24px; color: var(--ui-muted-text); font-size: 13px;'
  const contentStyle =
    'min-height: 0; flex: 1; overflow: auto; padding: 28px 32px; display: grid; gap: 16px; align-content: start;'
  const cardStyle =
    'max-width: 860px; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 20px 48px oklch(0 0 0 / 0.2); padding: 18px;'
  const promptCardStyle =
    'max-width: 860px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-neutral-muted-surface); padding: 16px 18px;'
</script>

<div style={shellStyle}>
  <aside style={sidebarStyle} aria-label="Sidebar">
    <div style={workspaceStyle}>
      <div style={appMarkStyle}>
        <Sparkles size={18} />
      </div>
      <div style="min-width: 0; padding-top: 1px;">
        <h1 style={workspaceNameStyle}>Cthulhu Prompt</h1>
        <p style={workspacePathStyle}>C:\Source\PromptApps\CthulhuPromptPublic</p>
      </div>
    </div>

    <nav style={navWrapStyle} aria-label="Application">
      {#each navItems as item (item.label)}
        {@const Icon = item.icon}
        <button
          type="button"
          style={`height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid ${
            item.active ? 'var(--ui-neutral-emphasis-border)' : 'var(--ui-neutral-muted-border)'
          }; border-radius: 8px; color: ${
            item.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
          }; background: ${
            item.active ? 'var(--ui-neutral-emphasis-surface)' : 'var(--ui-neutral-muted-surface)'
          }; box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.06); font-size: 13px; font-weight: 650; cursor: pointer;`}
        >
          <Icon size={15} />
          {item.label}
        </button>
      {/each}
    </nav>

    <div style={sectionStyle}>
      <div>
        <p style={sectionLabelStyle}>Prompts</p>
        <p style={sectionCountStyle}>4 folders</p>
      </div>
      <div style={toolbarStyle}>
        <button
          type="button"
          aria-label="Expand All Prompt Folders"
          title="Expand All Prompt Folders"
          style={iconButtonStyle}
        >
          <ChevronsUpDown size={15} />
        </button>
        <button
          type="button"
          aria-label="Collapse All Prompt Folders"
          title="Collapse All Prompt Folders"
          style={iconButtonStyle}
        >
          <ChevronsDownUp size={15} />
        </button>
        <button
          type="button"
          aria-label="Create Prompt Folder"
          title="Create Prompt Folder"
          style={`${iconButtonStyle} border-color: var(--ui-accent-normal-border); color: var(--ui-accent-normal-text); background: var(--ui-accent-normal-surface);`}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>

    <div style="padding: 0 14px 10px;">
      <div
        style="height: 34px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-neutral-field-surface); padding: 0 10px; color: var(--ui-muted-text);"
      >
        <Search size={14} />
        <span style="font-size: 13px;">Find prompts</span>
      </div>
    </div>

    <div style={promptListStyle}>
      {#each promptFolders as folder (folder.name)}
        <section style={`${folderCardStyle} ${folder.active ? activeFolderCardStyle : ''}`}>
          <button
            type="button"
            style={`${folderHeaderStyle} ${folder.active ? activeFolderHeaderStyle : ''}`}
          >
            <ChevronDown size={15} />
            <Folder size={15} />
            <span style={folderTitleStyle}>{folder.name}</span>
            <span style={countStyle}>{folder.count}</span>
          </button>

          {#if folder.active}
            <div style={`${settingsRowStyle} ${activeSettingsRowStyle}`}>
              <Settings size={14} />
              <span
                style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                >Folder Settings</span
              >
            </div>
          {:else}
            <div style={settingsRowStyle}>
              <Settings size={14} />
              <span
                style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                >Folder Settings</span
              >
            </div>
          {/if}

          {#each folder.prompts as prompt (prompt)}
            <div style={promptRowStyle}>
              <FileText size={14} />
              <span
                style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                >{prompt}</span
              >
            </div>
          {/each}
        </section>
      {/each}
    </div>
  </aside>

  <main style={mainStyle}>
    <div style={breadcrumbStyle}>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
        >Claude Code Workflows</span
      >
      <span style="padding: 0 12px; color: oklch(1 0 0 / 0.28);">/</span>
      <span style="color: var(--ui-hoverable-text);">Folder Settings</span>
    </div>

    <div style={contentStyle}>
      <section style={cardStyle}>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div
            style="height: 30px; width: 30px; display: grid; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 7px; color: var(--ui-accent-normal-text); background: var(--ui-accent-normal-surface);"
          >
            <Settings size={16} />
          </div>
          <div>
            <h2
              style="margin: 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 760; line-height: 32px;"
            >
              Folder Settings
            </h2>
            <p
              style="margin: 2px 0 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;"
            >
              Settings that only affect prompts in this folder, and are saved to the workspace.
            </p>
          </div>
        </div>
      </section>

      <article style={promptCardStyle}>
        <h3
          style="margin: 0 0 8px; color: var(--ui-normal-text); font-size: 15px; font-weight: 700; line-height: 22px;"
        >
          Description
        </h3>
        <p style="margin: 0; color: var(--ui-secondary-text); font-size: 14px; line-height: 22px;">
          Reusable implementation prompts for Electron, Svelte 5, persistence, and review workflows.
        </p>
      </article>

      <article style={promptCardStyle}>
        <h3
          style="margin: 0 0 8px; color: var(--ui-normal-text); font-size: 15px; font-weight: 700; line-height: 22px;"
        >
          Prompts
        </h3>
        <p style="margin: 0; color: var(--ui-secondary-text); font-size: 14px; line-height: 22px;">
          Repo orientation, focused implementation pass, review for regressions, update tests,
          prepare pull request.
        </p>
      </article>
    </div>
  </main>
</div>
