<script lang="ts">
  import { Archive, Check, ChevronRight, ChevronsUpDown, CircleCheckBig, Clock, FileText, Folder, FolderOpen, Home, Layers, MoreHorizontal, PanelsTopLeft, Plus, Search, Settings, X } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  const projects = ['Cthulhu Prompt', 'Atlas API', 'Personal website']
  const folders = [
    { name: 'Engineering', project: 'Cthulhu Prompt', count: 24 },
    { name: 'Dana', project: 'Cthulhu Prompt', count: 8 },
    { name: 'Research', project: 'Cthulhu Prompt', count: 6 },
    { name: 'Backend', project: 'Atlas API', count: 12 },
    { name: 'Website', project: 'Personal website', count: 5 }
  ]
  const recent = [folders[0]!, folders[3]!, folders[1]!]
  const promptRows: Record<string, string[]> = {
    Engineering: ['Map the current implementation', 'Clarify product requirements', 'Draft an implementation plan', 'Identify edge cases'],
    Dana: ['Review keyboard navigation', 'Audit accessibility behavior', 'Prepare the UI copy'],
    Research: ['Compare sidebar patterns', 'Review project organization', 'Explore prompt search'],
    Backend: ['Review authentication middleware', 'Plan rate limiting', 'Document API error responses'],
    Website: ['Review the personal website', 'Improve the contact form', 'Update project descriptions']
  }
  const templateFolders = [
    { name: 'Engineering', items: ['Plan an implementation', 'Review a pull request', 'Build a test plan', 'Review security boundaries'] },
    { name: 'Writing', items: ['Write developer documentation', 'Summarize a technical decision', 'Prepare release notes'] },
    { name: 'Team workflows', items: ['Prepare a project handoff', 'Create a regression checklist'] }
  ]
  // Local state only previews navigation, disclosure, and popup appearances.
  let tab = $state<'prompts' | 'templates'>('prompts')
  let project = $state('Cthulhu Prompt')
  let folder = $state('Engineering')
  let selected = $state('Map the current implementation')
  let popup = $state<'workspace' | 'projects' | 'folders' | 'actions' | 'create' | null>(null)
  let createKind = $state('folder')
  let search = $state('')
  let hovered = $state('')
  let expanded = $state<Record<string, boolean>>({ Active: true, Research: true, Backlog: true, Engineering: true, Writing: true })
  // Keep fixture folders and switcher results in sync with local selections.
  const projectFolders = $derived(folders.filter((entry) => entry.project === project))
  const matchingFolders = $derived(folders.filter((entry) => `${entry.name} ${entry.project}`.toLowerCase().includes(search.toLowerCase())))
  const buttonStyle = (id: string, active = false) => `display:flex;align-items:center;gap:9px;border:0;cursor:pointer;text-align:left;color:var(${active || hovered === id ? '--ui-normal-text' : '--ui-hoverable-text'});background:var(${active ? '--ui-accent-action-fill' : hovered === id ? '--ui-neutral-normal-surface' : '--ui-ghost-surface'});`
  const menuStyle = 'position:absolute;z-index:30;background:var(--ui-card-overlay-surface);border:1px solid var(--ui-neutral-normal-border);border-radius:10px;box-shadow:0 12px 32px var(--ui-shadow-raised);padding:8px;'
  const openPopup = (value: typeof popup) => { popup = popup === value ? null : value; search = '' }
  const openCreate = (kind: string) => { createKind = kind; popup = 'create' }
  const chooseFolder = (entry: typeof folders[number]) => { project = entry.project; folder = entry.name; tab = 'prompts'; selected = promptRows[entry.name]![0]!; popup = null }
</script>

{#snippet iconButton(Icon: typeof Plus, label: string, onclick: () => void, active = false)}
  <button type="button" aria-label={label} title={label} {onclick} onmouseenter={() => hovered = label} onmouseleave={() => hovered = ''} onfocus={() => hovered = label} onblur={() => hovered = ''} style={`${buttonStyle(label, active)}justify-content:center;width:30px;height:30px;padding:0;border-radius:5px;`}><Icon size={17} strokeWidth={1.7} /></button>
{/snippet}

{#snippet promptRow(title: string, index: number)}
  <button type="button" class="text-sm leading-5" onclick={() => selected = title} onmouseenter={() => hovered = title} onmouseleave={() => hovered = ''} onfocus={() => hovered = title} onblur={() => hovered = ''} style={`${buttonStyle(title, selected === title)}width:100%;min-height:34px;padding:7px 12px 7px 23px;border-radius:5px;position:relative;`}>
    {#if selected === title}<span style="position:absolute;left:0;top:7px;bottom:7px;width:2px;background:var(--ui-accent-strong-border);border-radius:2px;"></span>{/if}
    <FileText size={14} style="flex-shrink:0;color:var(--ui-secondary-icon-glyph);" /><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">{title}</span>
    {#if index === 0 && tab === 'prompts'}<span title="In progress" style="margin-left:auto;flex-shrink:0;width:5px;height:5px;background:var(--ui-warning-icon-glyph);border-radius:50%;"></span>{/if}
  </button>
{/snippet}

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') popup = null }} onclick={(event) => { if (event.target instanceof Element && !event.target.closest('[data-popup-region]')) popup = null }} />

<main class="text-sm leading-5" style="display:flex;position:relative;width:100%;height:100%;min-height:0;color:var(--ui-normal-text);font-family:Aptos,'Segoe UI',sans-serif;">
  <nav aria-label="Primary navigation" style="display:flex;flex-direction:column;align-items:center;gap:7px;flex:0 0 48px;padding:10px 0;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-muted-border);">
    <div data-popup-region style="position:relative;margin-bottom:10px;">
      <button type="button" title="Workspace: CthulhuPromptPublic" aria-label="Open workspace menu" aria-expanded={popup === 'workspace'} onclick={() => openPopup('workspace')} style={`${buttonStyle('workspace', popup === 'workspace')}justify-content:center;width:36px;height:38px;border-radius:7px;`}><img src={appIcon} alt="Cthulhu Prompt" style="width:29px;height:29px;" /></button>
      {#if popup === 'workspace'}
        <div role="dialog" aria-label="Workspace" style={`${menuStyle}left:44px;top:0;width:300px;`}>
          <div style="padding:10px 9px 15px;border-bottom:1px solid var(--ui-neutral-muted-border);"><strong>CthulhuPromptPublic</strong><div class="text-xs leading-5" style="margin-top:4px;color:var(--ui-muted-text);overflow-wrap:anywhere;">C:\Source\PromptApps\CthulhuPromptPublic</div></div>
          {#each ['Open workspace…', 'Open in File Explorer', 'Workspace settings'] as label (label)}<button type="button" onclick={() => popup = null} style={`${buttonStyle(label)}padding:10px;width:100%;border-radius:5px;`}><FolderOpen size={16} />{label}</button>{/each}
        </div>
      {/if}
    </div>
    {@render iconButton(Home, 'Home', () => { popup = null })}
    {@render iconButton(FileText, 'Prompts', () => { tab = 'prompts'; popup = null }, tab === 'prompts')}
    {@render iconButton(Layers, 'Templates', () => { tab = 'templates'; popup = null }, tab === 'templates')}
    {@render iconButton(PanelsTopLeft, 'Mockups', () => { popup = null })}
    <div style="flex:1;"></div>
    <div data-popup-region>{@render iconButton(Settings, 'Settings', () => openPopup('workspace'))}</div>
  </nav>

  <aside aria-label="Prompt sidebar" style="width:328px;flex:0 0 328px;display:flex;flex-direction:column;min-height:0;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-hover-border);">
    <div data-popup-region style="padding:12px 12px 10px;position:relative;border-bottom:1px solid var(--ui-neutral-muted-border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;"><span class="text-xs leading-4" style="color:var(--ui-muted-text);">Recent folders</span><button type="button" class="text-xs leading-4" aria-expanded={popup === 'folders'} onclick={() => openPopup('folders')} onmouseenter={() => hovered = 'all'} onmouseleave={() => hovered = ''} style={`${buttonStyle('all')}padding:2px 0;gap:4px;`}>All folders<ChevronsUpDown size={12} /></button></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">
        {#each recent as entry (entry.name)}
          <button type="button" title={`${entry.project} / ${entry.name}`} aria-pressed={tab === 'prompts' && folder === entry.name} onclick={() => chooseFolder(entry)} onmouseenter={() => hovered = `recent-${entry.name}`} onmouseleave={() => hovered = ''} style={`${buttonStyle(`recent-${entry.name}`, tab === 'prompts' && folder === entry.name)}flex-direction:column;align-items:flex-start;gap:7px;padding:9px 8px;border-radius:7px;border:1px solid var(${tab === 'prompts' && folder === entry.name ? '--ui-accent-normal-border' : '--ui-neutral-muted-border'});`}><Folder size={16} /><span class="text-xs leading-4" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{entry.name}</span></button>
        {/each}
      </div>
      {#if popup === 'folders'}
        <div role="dialog" aria-label="Folder switcher" style={`${menuStyle}top:106px;left:10px;width:366px;`}>
          <label style="display:flex;gap:9px;align-items:center;border:1px solid var(--ui-neutral-normal-border);border-radius:6px;padding:8px 10px;margin-bottom:10px;"><Search size={16} /><input class="text-sm leading-5" aria-label="Find a folder" bind:value={search} placeholder="Find a folder…" style="width:100%;border:0;outline:none;color:var(--ui-normal-text);background:transparent;" /></label>
          {#each projects as name (name)}
            {#if matchingFolders.some((entry) => entry.project === name)}
              <div class="text-xs leading-4" style="padding:9px 8px 4px;color:var(--ui-muted-text);">{name}</div>
              {#each matchingFolders.filter((entry) => entry.project === name) as entry (entry.name)}
                <button type="button" onmouseenter={() => hovered = `switch-${entry.name}`} onmouseleave={() => hovered = ''} onclick={() => chooseFolder(entry)} style={`${buttonStyle(`switch-${entry.name}`, folder === entry.name && tab === 'prompts')}width:100%;padding:9px;border-radius:5px;`}><Folder size={16} /><span style="flex:1;">{entry.name}</span><span class="text-xs" style="color:var(--ui-muted-text);">{entry.count}</span>{#if folder === entry.name && tab === 'prompts'}<Check size={14} />{/if}</button>
              {/each}
            {/if}
          {/each}
          <div class="text-xs leading-4" style="padding:12px 8px 4px;color:var(--ui-muted-text);">Shared templates</div>
          {#each templateFolders.filter((entry) => entry.name.toLowerCase().includes(search.toLowerCase())) as entry (entry.name)}<button type="button" onclick={() => { tab = 'templates'; expanded[entry.name] = true; popup = null }} style={`${buttonStyle(`shared-${entry.name}`)}width:100%;padding:9px;border-radius:5px;`}><Layers size={16} /><span style="flex:1;">{entry.name}</span><span class="text-xs" style="color:var(--ui-muted-text);">{entry.items.length}</span></button>{/each}
          <button type="button" onclick={() => openCreate('folder')} style={`${buttonStyle('newfolder')}width:100%;padding:11px 9px;margin-top:6px;border-top:1px solid var(--ui-neutral-muted-border);`}><Plus size={16} />New folder</button>
        </div>
      {/if}
    </div>

    <div style="display:flex;gap:4px;margin:12px;padding:4px;border-radius:8px;background:var(--ui-card-solid-surface);">
      {#each ['prompts', 'templates'] as value (value)}
        <button type="button" aria-pressed={tab === value} onclick={() => { tab = value as typeof tab; popup = null }} onmouseenter={() => hovered = value} onmouseleave={() => hovered = ''} style={`${buttonStyle(value)}justify-content:center;flex:1;padding:7px;border-radius:5px;background:var(${tab === value ? '--ui-neutral-action-fill' : '--ui-ghost-surface'});color:var(${tab === value || hovered === value ? '--ui-normal-text' : '--ui-muted-text'});font-weight:600;`}>{#if value === 'prompts'}<FileText size={15} />Prompts{:else}<Layers size={15} />Templates{/if}</button>
      {/each}
    </div>

    {#if tab === 'prompts'}
      <div data-popup-region style="position:relative;padding:0 14px 12px;">
        <button type="button" aria-expanded={popup === 'projects'} onclick={() => openPopup('projects')} style={`${buttonStyle('project')}width:100%;padding:4px 0;`}><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:7px;background:var(--ui-info-normal-surface);color:var(--ui-normal-text);font-weight:600;">{project === 'Cthulhu Prompt' ? 'CP' : project === 'Atlas API' ? 'AA' : 'PW'}</span><span style="flex:1;font-weight:600;">{project}</span><ChevronsUpDown size={16} /></button>
        {#if popup === 'projects'}
          <div role="dialog" aria-label="Select project" style={`${menuStyle}top:44px;left:12px;width:304px;`}>
            <div class="text-xs" style="padding:7px 9px;color:var(--ui-muted-text);">Projects</div>
            {#each projects as name (name)}<button type="button" onmouseenter={() => hovered = name} onmouseleave={() => hovered = ''} onclick={() => chooseFolder(folders.find((entry) => entry.project === name)!)} style={`${buttonStyle(name, project === name)}width:100%;padding:11px 9px;border-radius:5px;`}><PanelsTopLeft size={17} /><span style="flex:1;">{name}</span>{#if project === name}<Check size={15} />{/if}</button>{/each}
            <button type="button" onclick={() => openCreate('project')} style={`${buttonStyle('newproject')}width:100%;padding:11px 9px;border-top:1px solid var(--ui-neutral-muted-border);margin-top:7px;`}><Plus size={17} />New project</button>
          </div>
        {/if}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:12px;">
          {#each projectFolders as entry (entry.name)}<button type="button" class="text-xs leading-5" onclick={() => chooseFolder(entry)} onmouseenter={() => hovered = `folder-${entry.name}`} onmouseleave={() => hovered = ''} style={`${buttonStyle(`folder-${entry.name}`, folder === entry.name)}gap:5px;padding:4px 7px;border-radius:5px;border:1px solid var(${folder === entry.name ? '--ui-accent-normal-border' : '--ui-neutral-muted-border'});`}><Folder size={12} />{entry.name}<span style="opacity:0.65;">{entry.count}</span></button>{/each}
        </div>
      </div>
      <div data-popup-region style="display:flex;align-items:center;position:relative;border-top:1px solid var(--ui-neutral-muted-border);padding:9px 12px 6px;gap:6px;">
        <span style="font-weight:600;flex:1;">{folder}</span>{@render iconButton(Plus, 'New prompt', () => openCreate('prompt'))}{@render iconButton(MoreHorizontal, 'Folder options', () => openPopup('actions'))}
        {#if popup === 'actions'}<div role="dialog" aria-label="Folder options" style={`${menuStyle}top:44px;right:10px;width:218px;`}>{#each ['Folder overview', 'Manage categories', 'Rename folder', 'Archive folder'] as label (label)}<button type="button" onclick={() => popup = null} style={`${buttonStyle(label)}width:100%;padding:9px;border-radius:5px;`}>{label}</button>{/each}</div>{/if}
      </div>
      <div style="overflow:auto;flex:1;min-height:0;padding:0 8px 12px;">
        {#each [{ name: 'Active', count: promptRows[folder]!.length + 3, icon: FileText }, { name: 'Backlog', count: 2, icon: Clock }, { name: 'Completed', count: 14, icon: CircleCheckBig }, { name: 'Archived', count: 1, icon: Archive }] as section (section.name)}
          <button type="button" aria-expanded={!!expanded[section.name]} onclick={() => expanded[section.name] = !expanded[section.name]} onmouseenter={() => hovered = section.name} onmouseleave={() => hovered = ''} style={`${buttonStyle(section.name)}padding:11px 6px 8px;width:100%;`}><ChevronRight size={13} style={`transform:rotate(${expanded[section.name] ? 90 : 0}deg);`} /><section.icon size={15} /><span class="text-xs leading-5" style="font-weight:600;flex:1;">{section.name}</span><span class="text-xs" style="color:var(--ui-muted-text);">{section.count}</span></button>
          {#if expanded[section.name]}
            {#if section.name === 'Active'}
              {#each promptRows[folder]! as title, index (title)}{@render promptRow(title, index)}{/each}
              <button type="button" aria-expanded={expanded.Research} onclick={() => expanded.Research = !expanded.Research} style={`${buttonStyle('research')}padding:10px 12px 7px 23px;width:100%;`}><ChevronRight size={13} style={`transform:rotate(${expanded.Research ? 90 : 0}deg);`} /><Folder size={14} /><span style="flex:1;">Research</span><span class="text-xs" style="color:var(--ui-muted-text);">3</span></button>
              {#if expanded.Research}<div style="margin-left:28px;padding-left:1px;border-left:1px solid var(--ui-neutral-emphasis-border);">{#each ['Compare sidebar patterns', 'Prepare the UI copy', 'Audit accessibility behavior'] as title (title)}{@render promptRow(title, 1)}{/each}</div>{/if}
            {:else if section.name === 'Backlog'}{@render promptRow('Explore prompt search', 1)}{@render promptRow('Plan keyboard shortcuts', 1)}
            {:else if section.name === 'Completed'}{@render promptRow('Audit the existing sidebar', 1)}{@render promptRow('Review the data flow', 1)}
            {:else}{@render promptRow('Explore the previous layout', 1)}{/if}
          {/if}
        {/each}
      </div>
      <div class="text-xs leading-5" style="padding:10px 16px;border-top:1px solid var(--ui-neutral-muted-border);color:var(--ui-muted-text);display:flex;gap:7px;align-items:center;"><Folder size={13} />{projectFolders.length} folders in this project</div>
    {:else}
      <header style="padding:4px 16px 15px;border-bottom:1px solid var(--ui-neutral-muted-border);"><div style="display:flex;align-items:center;gap:8px;"><h1 class="text-base leading-6" style="margin:0;font-weight:600;flex:1;">Shared library</h1><div data-popup-region>{@render iconButton(Plus, 'New template folder', () => openCreate('template folder'))}</div></div><p class="text-xs leading-5" style="margin:4px 0 0;color:var(--ui-muted-text);">Available to every project</p></header>
      <div style="flex:1;min-height:0;overflow:auto;padding:8px;">
        {#each templateFolders as entry (entry.name)}
          <button type="button" aria-expanded={!!expanded[entry.name]} onclick={() => expanded[entry.name] = !expanded[entry.name]} onmouseenter={() => hovered = `library-${entry.name}`} onmouseleave={() => hovered = ''} style={`${buttonStyle(`library-${entry.name}`)}padding:11px 7px;width:100%;`}><ChevronRight size={13} style={`transform:rotate(${expanded[entry.name] ? 90 : 0}deg);`} /><Layers size={16} /><span style="flex:1;font-weight:600;">{entry.name}</span><span class="text-xs" style="color:var(--ui-muted-text);">{entry.items.length}</span></button>
          {#if expanded[entry.name]}{#each entry.items as title (title)}{@render promptRow(title, 1)}{/each}{/if}
        {/each}
      </div>
      <div class="text-xs leading-5" style="display:flex;align-items:center;gap:8px;padding:13px 16px;border-top:1px solid var(--ui-neutral-muted-border);color:var(--ui-muted-text);"><Layers size={15} />9 templates · 3 folders</div>
    {/if}
  </aside>

  {#if popup === 'create'}
    <div data-popup-region role="dialog" aria-label={`Create ${createKind}`} style={`${menuStyle}left:64px;top:145px;width:330px;padding:18px;`}>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><h2 class="text-base leading-6" style="margin:0;font-weight:600;">Create {createKind}</h2>{@render iconButton(X, 'Close', () => popup = null)}</div>
      <label class="text-xs leading-5" style="display:block;color:var(--ui-secondary-text);">Name<input class="text-sm leading-5" placeholder="Enter a name" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px 10px;border-radius:5px;border:1px solid var(--ui-neutral-normal-border);color:var(--ui-normal-text);background:var(--ui-neutral-field-surface);" /></label>
      <p class="text-xs leading-5" style="margin:12px 0 20px;color:var(--ui-muted-text);">{createKind === 'project' ? 'CthulhuPromptPublic' : tab === 'prompts' ? project : 'Shared across all projects'}</p>
      <button type="button" onclick={() => popup = null} style={`${buttonStyle('create', true)}justify-content:center;padding:9px 12px;width:100%;border-radius:5px;`}>Create {createKind}</button>
    </div>
  {/if}
</main>
