<script lang="ts">
  import { Archive, ArrowUpRight, Check, ChevronDown, ChevronRight, ChevronsUpDown, CircleCheckBig, Clock, FileText, Folder, FolderOpen, FolderPlus, Home, Layers, MoreHorizontal, PanelsTopLeft, Plus, Search, Settings, X } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  const projects = [
    { name: 'Cthulhu Prompt', initials: 'CP', detail: 'Desktop app', folders: ['Product', 'Alex', 'Sam'] },
    { name: 'Atlas API', initials: 'AA', detail: 'Backend services', folders: ['Engineering', 'Release notes'] },
    { name: 'Personal site', initials: 'PS', detail: 'Web project', folders: ['Website', 'Content'] }
  ]
  const recentFolders = [
    { name: 'Product', project: 0 },
    { name: 'Engineering', project: 1 },
    { name: 'Alex', project: 0 }
  ]
  const templates = ['Plan an implementation', 'Review a pull request', 'Write a test plan']
  // These runes only control the mockup's open panels and visual selections.
  let popup = $state<'workspace' | 'project' | 'folders' | 'templates' | 'create' | 'options' | null>(null)
  let selectedProject = $state(0)
  let selectedFolder = $state('Product')
  let selectedPrompt = $state('Map the current implementation')
  let search = $state('')
  let expanded = $state<Record<string, boolean>>({ Active: true, Research: true, Backlog: false, Completed: false })
  let hover = $state('')
  let focus = $state('')
  // Keep the visible project heading in sync with the local switcher selection.
  const project = $derived(projects[selectedProject]!)
  const buttonBase = 'display:flex;align-items:center;gap:9px;border:0;cursor:pointer;text-align:left;border-radius:6px;'
  const rowStyle = (id: string, active = false) => `${buttonBase}background:${active ? 'var(--ui-accent-action-fill)' : hover === id || focus === id ? 'var(--ui-neutral-normal-surface)' : 'transparent'};color:${active || hover === id || focus === id ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};`
  const panelStyle = 'position:absolute;z-index:30;background:var(--ui-card-overlay-surface);border:1px solid var(--ui-neutral-emphasis-border);border-radius:10px;box-shadow:0 14px 40px var(--ui-card-normal-shadow);padding:8px;'
  const toggle = (name: typeof popup) => { popup = popup === name ? null : name; search = '' }
  const chooseFolder = (projectIndex: number, folder: string) => { selectedProject = projectIndex; selectedFolder = folder; popup = null }
</script>

{#snippet iconButton(Icon: typeof Plus, label: string, onclick: () => void, active = false)}
  <button type="button" title={label} aria-label={label} {onclick}
    onmouseenter={() => { hover = label }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = label }} onblur={() => { focus = '' }}
    style={`${rowStyle(label, active)}width:30px;height:30px;padding:0;justify-content:center;flex-shrink:0;`}>
    <Icon size={17} strokeWidth={1.6} />
  </button>
{/snippet}

{#snippet promptRow(title: string, indent = 0, inProgress = false)}
  <button type="button" class="text-sm leading-5" onclick={() => { selectedPrompt = title }}
    onmouseenter={() => { hover = title }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = title }} onblur={() => { focus = '' }}
    aria-current={selectedPrompt === title ? 'true' : undefined}
    style={`${rowStyle(title, selectedPrompt === title)}width:100%;min-height:33px;padding:6px 10px 6px ${12 + indent * 20}px;position:relative;`}>
    {#if selectedPrompt === title}<span style="position:absolute;left:0;top:8px;bottom:8px;width:2px;background:var(--ui-accent-link-text);border-radius:2px;"></span>{/if}
    <FileText size={14} strokeWidth={1.5} style="flex-shrink:0;opacity:0.7;" />
    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">{title}</span>
    {#if inProgress}<span title="In progress" style="width:6px;height:6px;border-radius:50%;background:var(--ui-warning-icon-glyph);flex-shrink:0;"></span>{/if}
  </button>
{/snippet}

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') popup = null }} />

<main class="text-sm leading-5" style="display:flex;width:100%;height:100%;min-height:0;position:relative;color:var(--ui-normal-text);font-family:Aptos,'Segoe UI Variable','Segoe UI',sans-serif;">
  {#if popup}
    <button type="button" aria-label="Close popup" onclick={() => { popup = null }} style="position:absolute;inset:0;z-index:20;border:0;background:transparent;cursor:default;"></button>
  {/if}
  <nav aria-label="Primary navigation" style="display:flex;flex-direction:column;align-items:center;width:52px;flex-shrink:0;padding:10px 0;gap:8px;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-muted-border);">
    <button type="button" aria-label="Workspace: CthulhuPromptPublic" title="CthulhuPromptPublic" aria-expanded={popup === 'workspace'} onclick={() => toggle('workspace')} style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--ui-neutral-normal-border);border-radius:10px;background:var(--ui-neutral-normal-surface);cursor:pointer;margin-bottom:13px;">
      <img src={appIcon} alt="" style="width:29px;height:29px;object-fit:contain;" />
    </button>
    {@render iconButton(Home, 'Home', () => { selectedPrompt = 'Project overview' })}
    <div style="border-left:2px solid var(--ui-accent-link-text);width:100%;display:flex;justify-content:center;">
      {@render iconButton(FileText, 'Project prompts', () => { popup = null }, true)}
    </div>
    {@render iconButton(Layers, 'Shared templates', () => toggle('templates'))}
    <div style="flex:1;"></div>
    {@render iconButton(PanelsTopLeft, 'Mockups', () => { popup = null })}
    {@render iconButton(Settings, 'Workspace settings', () => toggle('workspace'))}
  </nav>

  <aside aria-label="Project sidebar" style="display:flex;flex-direction:column;position:relative;width:342px;flex-shrink:0;min-height:0;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-normal-border);">
    <div style="padding:10px 10px 11px;display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--ui-neutral-muted-border);">
      {#each recentFolders as recent (`${recent.project}:${recent.name}`)}
        <button type="button" class="text-xs leading-4" title={`${projects[recent.project]!.name} / ${recent.name}`} onclick={() => chooseFolder(recent.project, recent.name)}
          onmouseenter={() => { hover = `recent-${recent.name}` }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = `recent-${recent.name}` }} onblur={() => { focus = '' }}
          style={`${rowStyle(`recent-${recent.name}`, selectedFolder === recent.name)}padding:8px 7px;gap:5px;min-width:0;`}>
          <Folder size={13} style="flex-shrink:0;" /><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{recent.name}</span>
        </button>
      {/each}
      <div style="margin-left:auto;">{@render iconButton(ChevronsUpDown, 'Switch folder', () => toggle('folders'), popup === 'folders')}</div>
    </div>

    <div style="padding:16px 14px 12px;">
      <button type="button" aria-expanded={popup === 'project'} onclick={() => toggle('project')}
        onmouseenter={() => { hover = 'project' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'project' }} onblur={() => { focus = '' }}
        style={`${rowStyle('project')}width:100%;padding:7px;gap:11px;`}>
        <span class="text-xs leading-5" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--ui-accent-action-fill);border:1px solid var(--ui-accent-normal-border);color:var(--ui-normal-text);font-weight:600;">{project.initials}</span>
        <span style="flex:1;"><span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);margin-bottom:2px;">Project</span><span class="text-base leading-5" style="font-weight:600;letter-spacing:-0.02em;">{project.name}</span></span>
        <ChevronDown size={16} />
      </button>
    </div>

    <div style="padding:0 14px 10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 8px 4px;">
        <span class="text-xs leading-4" style="color:var(--ui-muted-text);font-weight:600;">PROMPT FOLDERS</span>
        {@render iconButton(FolderPlus, 'New prompt folder', () => toggle('create'))}
      </div>
      {#each project.folders as folder (folder)}
        <button type="button" class="text-sm leading-5" onclick={() => { selectedFolder = folder }}
          onmouseenter={() => { hover = `folder-${folder}` }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = `folder-${folder}` }} onblur={() => { focus = '' }}
          style={`${rowStyle(`folder-${folder}`)}padding:7px 10px;width:100%;background:${selectedFolder === folder ? 'var(--ui-neutral-action-fill)' : hover === `folder-${folder}` || focus === `folder-${folder}` ? 'var(--ui-neutral-normal-surface)' : 'transparent'};color:${selectedFolder === folder ? 'var(--ui-normal-text)' : hover === `folder-${folder}` || focus === `folder-${folder}` ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};`}>
          {#if selectedFolder === folder}<FolderOpen size={16} />{:else}<Folder size={16} />{/if}
          <span style="flex:1;">{folder}</span><span class="text-xs" style="color:var(--ui-muted-text);">{folder === 'Product' ? 24 : folder === 'Alex' ? 12 : 8}</span>
        </button>
      {/each}
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin:0 14px;padding:10px 7px;border-top:1px solid var(--ui-neutral-normal-border);">
      <FolderOpen size={15} style="color:var(--ui-accent-link-text);" /><span style="font-weight:600;flex:1;">{selectedFolder}</span>
      {@render iconButton(Plus, 'New prompt', () => toggle('create'))}
      {@render iconButton(MoreHorizontal, 'Folder options', () => toggle('options'))}
    </div>

    <div style="flex:1;min-height:120px;overflow-y:auto;padding:0 14px 18px;">
      <button type="button" class="text-xs leading-5" aria-expanded={expanded.Active} onclick={() => { expanded.Active = !expanded.Active }} onmouseenter={() => { hover = 'active' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'active' }} onblur={() => { focus = '' }} style={`${rowStyle('active')}width:100%;padding:6px;gap:7px;`}>
        <ChevronRight size={14} style={`transform:rotate(${expanded.Active ? 90 : 0}deg);`} /><span style="font-weight:600;flex:1;">Active</span><span style="color:var(--ui-muted-text);">14</span>
      </button>
      {#if expanded.Active}
        {@render promptRow('Map the current implementation', 0, true)}
        {@render promptRow('Clarify product requirements')}
        {@render promptRow('Draft an implementation plan')}
        <button type="button" class="text-sm leading-5" aria-expanded={expanded.Research} onclick={() => { expanded.Research = !expanded.Research }} onmouseenter={() => { hover = 'research' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'research' }} onblur={() => { focus = '' }} style={`${rowStyle('research')}width:100%;padding:8px 6px;gap:7px;margin-top:5px;`}>
          <ChevronRight size={14} style={`transform:rotate(${expanded.Research ? 90 : 0}deg);`} /><Folder size={14} /><span style="flex:1;">Research</span><span class="text-xs" style="color:var(--ui-muted-text);">3</span>
        </button>
        {#if expanded.Research}
          <div style="border-left:1px solid var(--ui-neutral-emphasis-border);margin-left:12px;">
            {@render promptRow('Compare sidebar patterns', 1)}
            {@render promptRow('Prepare the UI copy', 1)}
            {@render promptRow('Audit accessibility', 1)}
          </div>
        {/if}
        <button type="button" class="text-sm leading-5" onclick={() => { expanded.Verification = !expanded.Verification }} aria-expanded={expanded.Verification ?? false} onmouseenter={() => { hover = 'verification' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'verification' }} onblur={() => { focus = '' }} style={`${rowStyle('verification')}width:100%;padding:8px 6px;gap:7px;`}>
          <ChevronRight size={14} style={`transform:rotate(${expanded.Verification ? 90 : 0}deg);`} /><Folder size={14} /><span style="flex:1;">Verification</span><span class="text-xs" style="color:var(--ui-muted-text);">8</span>
        </button>
        {#if expanded.Verification}{@render promptRow('Verify folder interactions', 1)}{@render promptRow('Review the final diff', 1)}{/if}
      {/if}
      {#each [{ name: 'Backlog', count: 6, icon: Clock, prompt: 'Explore prompt search' }, { name: 'Completed', count: 4, icon: CircleCheckBig, prompt: 'Audit the existing sidebar' }] as section (section.name)}
        <button type="button" class="text-xs leading-5" aria-expanded={expanded[section.name]} onclick={() => { expanded[section.name] = !expanded[section.name] }} onmouseenter={() => { hover = section.name }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = section.name }} onblur={() => { focus = '' }} style={`${rowStyle(section.name)}width:100%;padding:10px 6px;gap:7px;border-top:1px solid var(--ui-neutral-muted-border);margin-top:7px;`}>
          <ChevronRight size={14} style={`transform:rotate(${expanded[section.name] ? 90 : 0}deg);`} /><section.icon size={14} /><span style="font-weight:600;flex:1;">{section.name}</span><span>{section.count}</span>
        </button>
        {#if expanded[section.name]}{@render promptRow(section.prompt)}{/if}
      {/each}
    </div>

    <section aria-label="Shared template library" style="border-top:1px solid var(--ui-accent-muted-border);background:var(--ui-card-nested-surface);padding:12px 14px;">
      <div style="display:flex;align-items:center;gap:8px;padding:0 5px 8px;">
        <Layers size={17} style="color:var(--ui-accent-link-text);" /><span style="flex:1;font-weight:600;">Shared templates</span>
        {@render iconButton(ArrowUpRight, 'Browse template library', () => toggle('templates'))}
      </div>
      <button type="button" class="text-xs leading-4" onclick={() => toggle('templates')} onmouseenter={() => { hover = 'library' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'library' }} onblur={() => { focus = '' }} style={`${rowStyle('library')}padding:5px 8px;margin-bottom:5px;width:100%;`}><span style="flex:1;">Engineering</span><span>18 templates</span><ChevronDown size={13} /></button>
      {#each templates.slice(0, 2) as template (template)}{@render promptRow(template)}{/each}
      <div class="text-xs leading-4" style="padding:8px 8px 0;color:var(--ui-muted-text);">Available in every project</div>
    </section>
  </aside>

  {#if popup === 'folders'}
    <div role="dialog" aria-label="Switch folder" style={`${panelStyle}left:64px;top:54px;width:390px;`}>
      <div style="display:flex;align-items:center;gap:8px;padding:7px 8px 11px;border-bottom:1px solid var(--ui-neutral-muted-border);"><Search size={17} style="color:var(--ui-muted-text);" /><input aria-label="Find a folder" placeholder="Find a folder…" bind:value={search} class="text-sm leading-5" style="min-width:0;flex:1;background:transparent;border:0;outline:none;color:var(--ui-normal-text);" />{@render iconButton(X, 'Close folder switcher', () => { popup = null })}</div>
      {#each projects as entry, index (entry.name)}
        <div class="text-xs leading-4" style="padding:14px 10px 6px;color:var(--ui-muted-text);font-weight:600;">{entry.name}</div>
        {#each entry.folders.filter((folder) => `${entry.name} ${folder}`.toLowerCase().includes(search.toLowerCase())) as folder (folder)}
          <button type="button" onclick={() => chooseFolder(index, folder)} class="text-sm leading-5"
            onmouseenter={() => { hover = `switch-${index}-${folder}` }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = `switch-${index}-${folder}` }} onblur={() => { focus = '' }}
            style={`${rowStyle(`switch-${index}-${folder}`, selectedProject === index && selectedFolder === folder)}padding:10px;width:100%;`}>
            <Folder size={17} /><span style="flex:1;">{folder}</span>{#if selectedProject === index && selectedFolder === folder}<Check size={16} />{/if}
          </button>
        {/each}
      {/each}
      <div style="border-top:1px solid var(--ui-neutral-muted-border);margin-top:10px;padding-top:5px;"><button type="button" class="text-sm leading-5" onclick={() => { popup = 'create' }} onmouseenter={() => { hover = 'newfolder' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'newfolder' }} onblur={() => { focus = '' }} style={`${rowStyle('newfolder')}padding:10px;width:100%;`}><FolderPlus size={17} />New prompt folder</button></div>
    </div>
  {:else if popup === 'project'}
    <div role="dialog" aria-label="Switch project" style={`${panelStyle}left:72px;top:137px;width:330px;`}>
      <div class="text-xs leading-4" style="padding:8px 10px 12px;color:var(--ui-muted-text);font-weight:600;">PROJECTS</div>
      {#each projects as entry, index (entry.name)}
        <button type="button" onclick={() => chooseFolder(index, entry.folders[0]!)}
          onmouseenter={() => { hover = entry.name }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = entry.name }} onblur={() => { focus = '' }}
          style={`${rowStyle(entry.name, index === selectedProject)}padding:12px 10px;width:100%;margin-bottom:3px;`}>
          <span class="text-xs leading-5" style="display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--ui-neutral-emphasis-border);border-radius:8px;">{entry.initials}</span>
          <span style="flex:1;"><span class="text-sm leading-5" style="display:block;font-weight:600;">{entry.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{entry.detail} · {entry.folders.length} folders</span></span>
          {#if index === selectedProject}<Check size={16} />{/if}
        </button>
      {/each}
      <button type="button" onclick={() => { popup = 'create' }} class="text-sm leading-5" onmouseenter={() => { hover = 'newproject' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'newproject' }} onblur={() => { focus = '' }} style={`${rowStyle('newproject')}padding:12px 10px;width:100%;border-top:1px solid var(--ui-neutral-muted-border);margin-top:7px;`}><Plus size={17} />New project</button>
    </div>
  {:else if popup === 'workspace'}
    <div role="dialog" aria-label="Workspace" style={`${panelStyle}left:58px;top:10px;width:310px;`}>
      <div style="display:flex;gap:12px;padding:12px 10px 16px;"><img src={appIcon} alt="" style="width:35px;height:35px;" /><div><div style="font-weight:600;">CthulhuPromptPublic</div><div class="text-xs leading-4" style="color:var(--ui-muted-text);margin-top:3px;">3 projects · 2 template libraries</div></div></div>
      {#each ['Open workspace…', 'Workspace settings', 'Close workspace'] as item (item)}
        <button type="button" class="text-sm leading-5" onclick={() => { popup = null }} onmouseenter={() => { hover = item }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = item }} onblur={() => { focus = '' }} style={`${rowStyle(item)}width:100%;padding:10px;`}><Folder size={16} />{item}</button>
      {/each}
    </div>
  {:else if popup === 'templates'}
    <div role="dialog" aria-label="Shared templates" style={`${panelStyle}left:404px;bottom:14px;width:340px;`}>
      <div style="display:flex;align-items:center;padding:9px 10px;gap:8px;"><Layers size={18} style="color:var(--ui-accent-link-text);" /><span style="font-weight:600;flex:1;">Template libraries</span>{@render iconButton(X, 'Close template libraries', () => { popup = null })}</div>
      {#each [{ name: 'Engineering', count: 18 }, { name: 'Writing', count: 8 }] as library (library.name)}
        <button type="button" class="text-sm leading-5" onclick={() => { expanded[library.name] = !(expanded[library.name] ?? library.name === 'Engineering') }} aria-expanded={expanded[library.name] ?? library.name === 'Engineering'} onmouseenter={() => { hover = library.name }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = library.name }} onblur={() => { focus = '' }} style={`${rowStyle(library.name)}width:100%;padding:11px 10px;border-top:1px solid var(--ui-neutral-muted-border);`}><Layers size={16} /><span style="flex:1;font-weight:600;">{library.name}</span><span class="text-xs">{library.count}</span><ChevronDown size={15} /></button>
        {#if expanded[library.name] ?? library.name === 'Engineering'}
          {#each library.name === 'Engineering' ? templates : ['Write developer documentation', 'Summarize a technical decision'] as template (template)}{@render promptRow(template, 1)}{/each}
        {/if}
      {/each}
      <button type="button" class="text-sm leading-5" onclick={() => { popup = 'create' }} onmouseenter={() => { hover = 'newlibrary' }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = 'newlibrary' }} onblur={() => { focus = '' }} style={`${rowStyle('newlibrary')}padding:12px 10px;width:100%;border-top:1px solid var(--ui-neutral-muted-border);margin-top:10px;`}><Plus size={17} />New template library</button>
    </div>
  {:else if popup === 'options'}
    <div role="dialog" aria-label="Folder options" style={`${panelStyle}left:226px;top:320px;width:210px;`}>
      {#each [{ label: 'Folder overview', icon: FolderOpen }, { label: 'Manage categories', icon: Settings }, { label: 'Show archived', icon: Archive }] as item (item.label)}
        <button type="button" class="text-sm leading-5" onclick={() => { popup = null }} onmouseenter={() => { hover = item.label }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = item.label }} onblur={() => { focus = '' }} style={`${rowStyle(item.label)}padding:10px;width:100%;`}><item.icon size={16} />{item.label}</button>
      {/each}
    </div>
  {:else if popup === 'create'}
    <div role="dialog" aria-label="Create new" style={`${panelStyle}left:90px;top:205px;width:310px;`}>
      <div style="display:flex;align-items:center;padding:7px 10px 13px;"><span style="font-weight:600;flex:1;">Create new</span>{@render iconButton(X, 'Close create menu', () => { popup = null })}</div>
      {#each [{ name: 'Prompt', detail: `In ${selectedFolder}`, icon: FileText }, { name: 'Prompt folder', detail: `In ${project.name}`, icon: FolderPlus }, { name: 'Project', detail: 'In this workspace', icon: PanelsTopLeft }, { name: 'Template library', detail: 'Shared across projects', icon: Layers }] as item (item.name)}
        <button type="button" onclick={() => { popup = null }} onmouseenter={() => { hover = item.name }} onmouseleave={() => { hover = '' }} onfocus={() => { focus = item.name }} onblur={() => { focus = '' }} style={`${rowStyle(item.name)}padding:11px 10px;width:100%;`}><item.icon size={19} /><span><span class="text-sm leading-5" style="display:block;">{item.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{item.detail}</span></span></button>
      {/each}
    </div>
  {/if}
</main>
