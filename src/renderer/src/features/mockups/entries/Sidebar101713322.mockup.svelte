<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    FolderOpen,
    Home,
    Plus,
    Search,
    Settings,
    Sparkles
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type NavItem = {
    label: string
    icon: ComponentType
    active?: boolean
  }

  type FolderItem = {
    name: string
    count: number
    open?: boolean
    active?: boolean
    children?: FolderItem[]
  }

  type PromptItem = {
    title: string
    folder: string
    active?: boolean
  }

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home },
    { label: 'Prompts', icon: Sparkles, active: true },
    { label: 'Settings', icon: Settings }
  ]

  const folderItems: FolderItem[] = [
    {
      name: 'Coding',
      count: 18,
      open: true,
      active: true,
      children: [
        { name: 'Bug fixes', count: 6 },
        { name: 'Refactors', count: 5 },
        { name: 'Reviews', count: 7 }
      ]
    },
    {
      name: 'Planning',
      count: 9,
      open: true,
      children: [
        { name: 'Specs', count: 4 },
        { name: 'Release notes', count: 5 }
      ]
    },
    { name: 'Research', count: 12 },
    { name: 'Archive', count: 31 }
  ]

  const promptItems: PromptItem[] = [
    { title: 'Svelte component review', folder: 'Reviews', active: true },
    { title: 'IPC handler audit', folder: 'Bug fixes' },
    { title: 'Prompt folder migration', folder: 'Refactors' },
    { title: 'Release checklist', folder: 'Release notes' }
  ]

  const shellStyle =
    'box-sizing:border-box;width:100%;min-height:720px;display:grid;grid-template-columns:304px minmax(0,1fr);gap:18px;color:var(--ui-normal-text);font-family:Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;'

  const sidebarStyle =
    'box-sizing:border-box;min-height:720px;display:flex;flex-direction:column;border:1px solid var(--ui-neutral-normal-border);border-radius:8px;background:linear-gradient(180deg, oklch(0.218 0.025 258 / 0.92), oklch(0.154 0.018 268 / 0.96));box-shadow:0 18px 55px var(--ui-shadow-raised), inset 1px 0 0 oklch(1 0 0 / 8%);overflow:hidden;'

  const contentStyle =
    'box-sizing:border-box;min-width:0;min-height:720px;border:1px solid var(--ui-neutral-muted-border);border-radius:8px;background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end));display:flex;flex-direction:column;overflow:hidden;'

  const sectionLabelStyle =
    'margin:0;color:var(--ui-muted-text);font-size:11px;font-weight:700;line-height:1;text-transform:uppercase;letter-spacing:0;'

  const iconButtonStyle =
    'width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--ui-neutral-normal-border);border-radius:6px;background:var(--ui-neutral-normal-surface);color:var(--ui-secondary-text);padding:0;'

  const getNavStyle = (active = false) =>
    `width:100%;height:38px;display:flex;align-items:center;gap:10px;border:1px solid ${active ? 'var(--ui-accent-normal-border)' : 'transparent'};border-radius:7px;background:${active ? 'linear-gradient(90deg, var(--ui-accent-normal-surface), oklch(0.666 0.181 254.617 / 12%))' : 'transparent'};color:${active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};font:inherit;font-size:13px;font-weight:650;text-align:left;padding:0 10px;`

  const getFolderStyle = (active = false, nested = false) =>
    `height:34px;display:grid;grid-template-columns:18px 18px minmax(0,1fr) auto;align-items:center;gap:7px;border:1px solid ${active ? 'var(--ui-info-normal-border)' : 'transparent'};border-radius:6px;background:${active ? 'oklch(0.666 0.181 254.617 / 14%)' : 'transparent'};color:${active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};font-size:13px;font-weight:${active ? '700' : '600'};padding:0 8px;margin-left:${nested ? '18px' : '0'};`

  const getPromptStyle = (active = false) =>
    `display:grid;grid-template-columns:22px minmax(0,1fr);gap:9px;align-items:start;border:1px solid ${active ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-muted-border)'};border-radius:7px;background:${active ? 'linear-gradient(135deg, var(--ui-accent-normal-fill), oklch(0.666 0.181 254.617 / 10%))' : 'oklch(1 0 0 / 4%)'};padding:9px;color:var(--ui-normal-text);`
</script>

<div style={shellStyle}>
  <aside style={sidebarStyle} aria-label="Prompts sidebar">
    <div
      style="display:flex;align-items:center;gap:11px;padding:14px 14px 12px;border-bottom:1px solid var(--ui-neutral-muted-border);"
    >
      <div
        style="width:38px;height:38px;display:grid;place-items:center;border-radius:7px;background:linear-gradient(135deg, var(--ui-accent-strong-surface), oklch(0.666 0.181 254.617));box-shadow:0 0 0 1px var(--ui-accent-strong-border), 0 10px 30px oklch(0.541 0.281 293.009 / 30%);color:var(--ui-normal-text);"
        aria-hidden="true"
      >
        <Sparkles size={18} strokeWidth={2.4} />
      </div>
      <div style="min-width:0;display:flex;flex-direction:column;gap:3px;">
        <strong
          style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:14px;font-weight:750;line-height:1.2;"
          >Cthulhu Prompt</strong
        >
        <span
          style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-muted-text);font-size:12px;line-height:1.2;"
          >Windows workspace</span
        >
      </div>
    </div>

    <nav
      style="display:flex;flex-direction:column;gap:4px;padding:12px 10px 10px;"
      aria-label="Primary"
    >
      {#each navItems as item (item.label)}
        {@const Icon = item.icon}
        <button
          type="button"
          style={getNavStyle(item.active)}
          aria-current={item.active ? 'page' : undefined}
        >
          <Icon size={16} strokeWidth={2.25} />
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
            >{item.label}</span
          >
        </button>
      {/each}
    </nav>

    <div style="padding:0 10px 11px;">
      <label
        style="height:36px;display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:8px;border:1px solid var(--ui-neutral-normal-border);border-radius:7px;background:oklch(0.112 0.018 266 / 58%);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:0 10px;color:var(--ui-muted-text);"
      >
        <Search size={15} strokeWidth={2.2} />
        <input
          value="component"
          aria-label="Search prompts"
          style="min-width:0;border:0;outline:0;background:transparent;color:var(--ui-normal-text);font:inherit;font-size:13px;font-weight:520;padding:0;"
        />
      </label>
    </div>

    <div
      style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px 8px;"
    >
      <p style={sectionLabelStyle}>Folders</p>
      <button type="button" aria-label="New folder" style={iconButtonStyle}>
        <Plus size={15} strokeWidth={2.3} />
      </button>
    </div>

    <div style="min-height:0;flex:1;overflow:hidden;padding:0 10px 12px;">
      <div style="display:flex;min-height:100%;flex-direction:column;gap:3px;">
        {#each folderItems as folder (folder.name)}
          <div style={getFolderStyle(folder.active)}>
            {#if folder.open}
              <ChevronDown size={14} strokeWidth={2.4} />
              <FolderOpen size={15} strokeWidth={2.2} />
            {:else}
              <ChevronRight size={14} strokeWidth={2.4} />
              <Folder size={15} strokeWidth={2.2} />
            {/if}
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              >{folder.name}</span
            >
            <span style="color:var(--ui-muted-text);font-size:11px;font-weight:750;"
              >{folder.count}</span
            >
          </div>

          {#if folder.open && folder.children}
            {#each folder.children as child (child.name)}
              <div style={getFolderStyle(child.active, true)}>
                <span style="width:18px;" aria-hidden="true"></span>
                <Folder size={14} strokeWidth={2.15} />
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                  >{child.name}</span
                >
                <span style="color:var(--ui-muted-text);font-size:11px;font-weight:750;"
                  >{child.count}</span
                >
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    </div>

    <div
      style="border-top:1px solid var(--ui-neutral-muted-border);background:linear-gradient(180deg, oklch(1 0 0 / 4%), oklch(0 0 0 / 10%));padding:11px 10px 12px;"
    >
      <div
        style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;"
      >
        <p style={sectionLabelStyle}>Recent prompts</p>
        <span
          style="border:1px solid var(--ui-success-normal-border);border-radius:999px;background:var(--ui-success-normal-surface);color:var(--ui-success-normal-text);font-size:11px;font-weight:750;line-height:1;padding:4px 7px;"
          >4</span
        >
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        {#each promptItems as prompt (prompt.title)}
          <button type="button" style={getPromptStyle(prompt.active)}>
            <span
              style="width:22px;height:22px;display:grid;place-items:center;border:1px solid var(--ui-neutral-normal-border);border-radius:5px;background:oklch(1 0 0 / 6%);color:var(--ui-accent-icon-glyph);"
              aria-hidden="true"
            >
              <FileText size={13} strokeWidth={2.25} />
            </span>
            <span style="min-width:0;display:flex;flex-direction:column;gap:3px;text-align:left;">
              <span
                style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:12px;font-weight:700;line-height:1.2;"
                >{prompt.title}</span
              >
              <span
                style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-muted-text);font-size:11px;font-weight:600;line-height:1.2;"
                >{prompt.folder}</span
              >
            </span>
          </button>
        {/each}
      </div>
    </div>
  </aside>

  <main style={contentStyle}>
    <div
      style="height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--ui-neutral-muted-border);padding:0 18px;"
    >
      <div style="min-width:0;display:flex;align-items:center;gap:10px;">
        <FileText size={18} strokeWidth={2.2} style="color:var(--ui-accent-icon-glyph);" />
        <h1
          style="margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:15px;font-weight:760;line-height:1.2;"
        >
          Svelte component review
        </h1>
      </div>
      <button
        type="button"
        style="height:32px;border:1px solid var(--ui-accent-normal-border);border-radius:6px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);font:inherit;font-size:12px;font-weight:750;padding:0 12px;"
      >
        Copy prompt
      </button>
    </div>

    <div
      style="box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 246px;gap:16px;padding:18px;"
    >
      <section
        style="min-width:0;border:1px solid var(--ui-neutral-muted-border);border-radius:7px;background:oklch(0.1 0.014 268 / 34%);padding:18px;"
      >
        <p style="margin:0 0 14px;color:var(--ui-secondary-text);font-size:13px;font-weight:700;">
          Prompt
        </p>
        <div
          style="min-height:420px;color:var(--ui-secondary-text);font-family:'Cascadia Code', Consolas, monospace;font-size:13px;line-height:1.65;"
        >
          Review this Svelte component for state ownership, accessibility, and renderer/main process
          boundaries. Prioritize defects that can cause data loss, broken keyboard navigation, or
          confusing prompt ordering.
        </div>
      </section>

      <aside style="display:flex;min-width:0;flex-direction:column;gap:10px;">
        <div
          style="border:1px solid var(--ui-neutral-muted-border);border-radius:7px;background:var(--ui-neutral-muted-surface);padding:12px;"
        >
          <p
            style="margin:0 0 8px;color:var(--ui-muted-text);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:0;"
          >
            Folder
          </p>
          <p style="margin:0;color:var(--ui-normal-text);font-size:13px;font-weight:700;">
            Reviews
          </p>
        </div>
        <div
          style="border:1px solid var(--ui-neutral-muted-border);border-radius:7px;background:var(--ui-neutral-muted-surface);padding:12px;"
        >
          <p
            style="margin:0 0 8px;color:var(--ui-muted-text);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:0;"
          >
            Updated
          </p>
          <p style="margin:0;color:var(--ui-normal-text);font-size:13px;font-weight:700;">Today</p>
        </div>
      </aside>
    </div>
  </main>
</div>
