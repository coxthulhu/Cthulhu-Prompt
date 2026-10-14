<script lang="ts">
  import { Archive, ArrowUpRight, Check, ChevronDown, ChevronRight, ChevronsUpDown, CircleCheckBig, Clock, FileText, Folder, FolderOpen, Home, Layers, MoreHorizontal, PanelsTopLeft, Plus, Search, Settings, Users, X } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  const projects = ['Cthulhu Prompt', 'Atlas API']
  const recentFolders = [
    { name: 'Product', project: 'Cthulhu Prompt', mark: 'CP' },
    { name: 'Backend', project: 'Atlas API', mark: 'AA' },
    { name: 'My prompts', project: 'Cthulhu Prompt', mark: 'CP' }
  ]
  const projectFolders = [
    { name: 'Product', count: 24, detail: 'Shared with the team', prompts: ['Map the current implementation', 'Clarify product requirements', 'Draft an implementation plan'], categories: ['Research', 'Verification'] },
    { name: 'My prompts', count: 8, detail: 'Personal', prompts: ['Review keyboard shortcuts', 'Investigate startup performance', 'Prepare release notes'], categories: ['Ideas'] },
    { name: 'Design', count: 12, detail: 'Shared with the team', prompts: ['Explore sidebar navigation', 'Audit accessible contrast', 'Review empty states'], categories: ['Components'] }
  ]
  const otherFolders = [
    { name: 'Backend', count: 16, detail: 'Shared with the team', prompts: ['Review authentication flow', 'Plan the database migration', 'Document API boundaries'], categories: ['Testing'] },
    { name: 'Infrastructure', count: 6, detail: 'Shared with the team', prompts: ['Review deployment workflow', 'Audit environment configuration'], categories: ['Operations'] }
  ]
  // Selection, expansion, and overlays only preview the sidebar with local sample data.
  let project = $state('Cthulhu Prompt')
  let selectedFolder = $state('Product')
  let selectedPrompt = $state('Map the current implementation')
  let popup = $state<'workspace' | 'project' | 'folders' | 'new' | 'options' | 'templates' | null>(null)
  let templateDrawer = $state(true)
  let templateLibrary = $state('Engineering')
  let search = $state('')
  let hovered = $state('')
  let focused = $state('')
  let expandedCategory = $state('')
  // Keep the visual folder list aligned with the selected sample project.
  const folders = $derived(project === 'Cthulhu Prompt' ? projectFolders : otherFolders)
  const buttonStyle = (id: string, active = false) => `display:flex;align-items:center;gap:8px;border:0;border-radius:6px;cursor:pointer;text-align:left;color:var(--ui-${active || hovered === id || focused === id ? 'normal' : 'secondary'}-text);background:${active ? 'var(--ui-accent-action-fill)' : hovered === id || focused === id ? 'var(--ui-neutral-normal-surface)' : 'transparent'};`
  const hover = (id: string) => ({ onmouseenter: () => { hovered = id }, onmouseleave: () => { hovered = '' }, onfocus: () => { focused = id }, onblur: () => { focused = '' } })
  const chooseFolder = (name: string, projectName = project) => { project = projectName; selectedFolder = name; popup = null }
  const togglePopup = (name: typeof popup) => { popup = popup === name ? null : name; search = '' }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') popup = null }} />

<main class="text-sm leading-5" style="display:flex;width:100%;height:100%;min-height:0;position:relative;color:var(--ui-normal-text);font-family:Aptos, 'Segoe UI', sans-serif;">
  <nav aria-label="Primary navigation" style="display:flex;flex-direction:column;align-items:center;gap:7px;width:52px;flex-shrink:0;padding:10px 5px;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-muted-border);">
    <button type="button" aria-label="Workspace: PromptApps" title="PromptApps workspace" aria-expanded={popup === 'workspace'} onclick={() => togglePopup('workspace')} {...hover('workspace')} style={`${buttonStyle('workspace', popup === 'workspace')}width:40px;height:42px;justify-content:center;margin-bottom:13px;`}><img src={appIcon} alt="" style="width:31px;height:31px;object-fit:contain;" /></button>
    {#each [{ icon: Home, label: 'Home' }, { icon: FileText, label: 'Projects' }, { icon: Layers, label: 'Templates' }, { icon: PanelsTopLeft, label: 'Mockups' }] as activity (activity.label)}
      <button type="button" title={activity.label} aria-label={activity.label} {...hover(activity.label)} onclick={() => { if (activity.label === 'Templates') togglePopup('templates') }} style={`${buttonStyle(activity.label, activity.label === 'Projects')}width:40px;height:42px;justify-content:center;${activity.label === 'Projects' ? 'box-shadow:inset 2px 0 var(--ui-accent-strong-border);' : ''}`}><activity.icon size={22} strokeWidth={1.6} /></button>
    {/each}
    <div style="flex:1;"></div>
    <button type="button" aria-label="Settings" title="Settings" {...hover('settings')} style={`${buttonStyle('settings')}width:40px;height:42px;justify-content:center;`}><Settings size={22} strokeWidth={1.6} /></button>
  </nav>

  <aside aria-label="Project prompts" style="width:326px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--ui-neutral-normal-border);background:var(--ui-chrome-normal-surface);">
    <div style="padding:12px 12px 10px;border-bottom:1px solid var(--ui-neutral-muted-border);">
      <div style="display:flex;gap:5px;align-items:stretch;">
        {#each recentFolders as folder, index (folder.project + folder.name)}
          <button type="button" title={`${folder.project} / ${folder.name}`} aria-label={`Open recent folder ${folder.name} in ${folder.project}`} onclick={() => chooseFolder(folder.name, folder.project)} {...hover(`recent-${index}`)} style={`${buttonStyle(`recent-${index}`, folder.name === selectedFolder && folder.project === project)}flex:1;min-width:0;flex-direction:column;align-items:flex-start;gap:6px;padding:8px 7px;border:1px solid ${folder.name === selectedFolder && folder.project === project ? 'var(--ui-accent-normal-border)' : 'var(--ui-neutral-muted-border)'};`}>
            <span class="text-xs leading-4" style="display:flex;align-items:center;justify-content:space-between;width:100%;color:var(--ui-muted-text);"><Folder size={14} /><span>{folder.mark}</span></span>
            <span class="text-xs leading-4" style="white-space:nowrap;">{folder.name}</span>
          </button>
        {/each}
        <button type="button" aria-label="Open folder switcher" title="All folders" aria-expanded={popup === 'folders'} onclick={() => togglePopup('folders')} {...hover('all-folders')} style={`${buttonStyle('all-folders', popup === 'folders')}width:26px;justify-content:center;`}><ChevronsUpDown size={17} /></button>
      </div>
    </div>

    <div style="padding:17px 13px 13px;">
      <button type="button" aria-label="Select project" aria-expanded={popup === 'project'} onclick={() => togglePopup('project')} {...hover('project')} style={`${buttonStyle('project')}width:100%;padding:4px 1px;gap:10px;`}>
        <span class="text-xs leading-5" style="display:flex;align-items:center;justify-content:center;height:32px;width:32px;flex-shrink:0;border:1px solid var(--ui-accent-normal-border);border-radius:8px;background:var(--ui-accent-action-fill);color:var(--ui-normal-text);font-weight:600;">{project === 'Cthulhu Prompt' ? 'CP' : project === 'Atlas API' ? 'AA' : 'PW'}</span>
        <span style="flex:1;min-width:0;"><span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);margin-bottom:2px;">Project</span><span style="font-weight:600;">{project}</span></span><ChevronDown size={16} />
      </button>
    </div>

    <div style="display:flex;align-items:center;gap:5px;padding:0 13px 10px;">
      <span class="text-xs leading-4" style="flex:1;color:var(--ui-muted-text);">PROMPT FOLDERS</span>
      <button type="button" aria-label="Create prompt or folder" title="Create prompt or folder" aria-expanded={popup === 'new'} onclick={() => togglePopup('new')} {...hover('new')} style={`${buttonStyle('new')}padding:4px;`}><Plus size={16} /></button>
      <button type="button" aria-label="Project options" title="Project options" aria-expanded={popup === 'options'} onclick={() => togglePopup('options')} {...hover('options')} style={`${buttonStyle('options')}padding:4px;`}><MoreHorizontal size={17} /></button>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:0 9px 12px;">
      {#each folders as folder (folder.name)}
        {@const open = selectedFolder === folder.name}
        <section style={`margin-bottom:7px;border:1px solid ${open ? 'var(--ui-neutral-emphasis-border)' : 'var(--ui-neutral-muted-border)'};border-radius:8px;overflow:hidden;background:${open ? 'var(--ui-neutral-subtle-action-hover-fill)' : 'transparent'};`}>
          <button type="button" aria-expanded={open} onclick={() => { selectedFolder = open ? '' : folder.name }} {...hover(folder.name)} style={`${buttonStyle(folder.name)}padding:11px 10px;width:100%;border-radius:0;gap:8px;`}>
            {#if open}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
            {#if open}<FolderOpen size={17} />{:else}<Folder size={17} />{/if}
            <span style="flex:1;font-weight:600;">{folder.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{folder.count}</span>
          </button>
          {#if open}
            <div class="text-xs leading-4" style="display:flex;gap:5px;align-items:center;padding:0 13px 12px 32px;color:var(--ui-muted-text);"><Users size={12} />{folder.detail}</div>
            <div style="border-top:1px solid var(--ui-neutral-muted-border);padding:8px 6px 10px;">
              <div class="text-xs leading-4" style="display:flex;gap:6px;align-items:center;padding:5px 8px 8px;color:var(--ui-muted-text);"><span style="width:5px;height:5px;background:var(--ui-success-normal-text);border-radius:50%;"></span><span style="flex:1;">Active</span><span>{folder.prompts.length + 7}</span></div>
              {#each folder.prompts as prompt, index (prompt)}
                <button type="button" onclick={() => { selectedPrompt = prompt }} {...hover(prompt)} style={`${buttonStyle(prompt, selectedPrompt === prompt)}min-height:35px;width:100%;padding:7px 8px;gap:8px;`}><FileText size={14} style="flex-shrink:0;opacity:0.7;" /><span class="text-sm leading-5" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">{prompt}</span>{#if index === 0}<span style="width:5px;height:5px;border-radius:50%;background:var(--ui-warning-icon-glyph);flex-shrink:0;"></span>{/if}</button>
              {/each}
              {#each folder.categories as category (category)}
                <button type="button" aria-expanded={expandedCategory === category} onclick={() => { expandedCategory = expandedCategory === category ? '' : category }} {...hover(category)} style={`${buttonStyle(category)}padding:8px;width:100%;`}><ChevronRight size={13} style={`transform:rotate(${expandedCategory === category ? '90' : '0'}deg);`} /><Folder size={14} /><span style="flex:1;">{category}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">4</span></button>
                {#if expandedCategory === category}
                  {#each ['Compare implementation approaches', 'Audit accessibility behavior'] as title (title)}
                    <button type="button" {...hover(`${category}-${title}`)} onclick={() => { selectedPrompt = title }} style={`${buttonStyle(`${category}-${title}`, selectedPrompt === title)}width:100%;padding:7px 8px 7px 28px;`}><FileText size={13} /><span class="text-xs leading-5" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{title}</span></button>
                  {/each}
                {/if}
              {/each}
              <div style="height:1px;background:var(--ui-neutral-muted-border);margin:7px 8px;"></div>
              {#each [{ icon: Clock, name: 'Backlog', count: 5 }, { icon: CircleCheckBig, name: 'Completed', count: 9 }] as group (group.name)}
                <button type="button" aria-expanded={expandedCategory === group.name} onclick={() => { expandedCategory = expandedCategory === group.name ? '' : group.name }} {...hover(group.name)} style={`${buttonStyle(group.name)}width:100%;padding:7px 8px;`}><ChevronRight size={13} style={`transform:rotate(${expandedCategory === group.name ? '90' : '0'}deg);`} /><group.icon size={14} /><span class="text-xs leading-4" style="flex:1;">{group.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{group.count}</span></button>
                {#if expandedCategory === group.name}<div class="text-xs leading-5" style="padding:5px 8px 7px 30px;color:var(--ui-secondary-text);">{group.name === 'Backlog' ? 'Explore prompt search' : 'Audit the existing sidebar'}</div>{/if}
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>

    <section style="border-top:1px solid var(--ui-card-nested-border);background:var(--ui-card-nested-surface);padding:10px 10px 12px;">
      <div style="display:flex;align-items:center;gap:3px;">
        <button type="button" aria-expanded={templateDrawer} onclick={() => { templateDrawer = !templateDrawer }} {...hover('templates-drawer')} style={`${buttonStyle('templates-drawer')}flex:1;padding:6px 5px;`}><Layers size={18} style="color:var(--ui-accent-link-text);" /><span style="flex:1;font-weight:600;">Shared templates</span><ChevronDown size={14} style={`transform:rotate(${templateDrawer ? '0' : '-90'}deg);`} /></button>
        <button type="button" aria-label="Browse template libraries" title="Browse template libraries" onclick={() => togglePopup('templates')} {...hover('browse-templates')} style={`${buttonStyle('browse-templates')}padding:6px;`}><ArrowUpRight size={16} /></button>
      </div>
      {#if templateDrawer}
        <p class="text-xs leading-4" style="margin:3px 5px 12px 31px;color:var(--ui-muted-text);">Available in every project</p>
        {#each ['Engineering', 'Writing & documentation'] as library, index (library)}
          <button type="button" onclick={() => { templateLibrary = library; togglePopup('templates') }} {...hover(library)} style={`${buttonStyle(library)}width:100%;padding:8px 6px;`}><Folder size={15} /><span class="text-sm leading-5" style="flex:1;">{library}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{index === 0 ? 18 : 7}</span><ChevronRight size={13} /></button>
        {/each}
      {/if}
    </section>
  </aside>

  {#if popup}
    <button type="button" aria-label="Dismiss popup" onclick={() => { popup = null }} style="position:absolute;inset:0;border:0;background:transparent;z-index:10;cursor:default;"></button>
    <div role="dialog" aria-label={popup === 'folders' ? 'Folder switcher' : popup === 'project' ? 'Select project' : popup === 'workspace' ? 'Workspace' : popup === 'templates' ? 'Template libraries' : 'Project actions'} class="text-sm leading-5" style={`position:absolute;left:${popup === 'workspace' ? 58 : 66}px;${popup === 'templates' ? 'bottom:24px;' : `top:${popup === 'workspace' ? 10 : popup === 'folders' ? 86 : popup === 'project' ? 160 : 206}px;`}width:${popup === 'folders' || popup === 'templates' ? 356 : 300}px;max-width:calc(100% - 76px);max-height:calc(100% - 110px);overflow:auto;background:var(--ui-card-overlay-surface);border:1px solid var(--ui-neutral-emphasis-border);border-radius:10px;padding:9px;box-shadow:0 12px 35px var(--ui-shadow-raised);z-index:11;`}>
      <header style="display:flex;align-items:center;padding:5px 7px 10px;gap:8px;"><span style="flex:1;font-weight:600;">{popup === 'folders' ? 'Switch folder' : popup === 'project' ? 'Switch project' : popup === 'workspace' ? 'PromptApps' : popup === 'templates' ? 'Template libraries' : popup === 'new' ? 'Create' : project}</span><button type="button" aria-label="Close popup" onclick={() => { popup = null }} {...hover('close')} style={`${buttonStyle('close')}padding:3px;`}><X size={16} /></button></header>
      {#if popup === 'folders' || popup === 'project' || popup === 'templates'}
        <label style="display:flex;align-items:center;gap:8px;border:1px solid var(--ui-neutral-normal-border);border-radius:6px;padding:8px 10px;margin:0 5px 10px;color:var(--ui-muted-text);"><Search size={16} /><input aria-label="Search" class="text-sm leading-5" bind:value={search} placeholder={popup === 'folders' ? 'Find a folder…' : popup === 'project' ? 'Find a project…' : 'Find a template…'} style="width:100%;border:0;outline:none;background:transparent;color:var(--ui-normal-text);" /></label>
      {/if}
      {#if popup === 'project'}
        {#each projects.filter((entry) => entry.toLowerCase().includes(search.toLowerCase())) as entry (entry)}
          <button type="button" onclick={() => { project = entry; selectedFolder = entry === 'Cthulhu Prompt' ? 'Product' : 'Backend'; popup = null }} {...hover(`project-${entry}`)} style={`${buttonStyle(`project-${entry}`, project === entry)}width:100%;padding:11px 9px;`}><span class="text-xs leading-5" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--ui-neutral-normal-border);">{entry === 'Cthulhu Prompt' ? 'CP' : 'AA'}</span><span style="flex:1;">{entry}<span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);">{entry === 'Cthulhu Prompt' ? '3 folders · 44 prompts' : '2 folders · 22 prompts'}</span></span>{#if project === entry}<Check size={16} />{/if}</button>
        {/each}
      {:else if popup === 'folders'}
        {#each ['Cthulhu Prompt', 'Atlas API'] as projectName (projectName)}
          <p class="text-xs leading-4" style="margin:14px 9px 5px;color:var(--ui-muted-text);">{projectName}</p>
          {#each (projectName === 'Cthulhu Prompt' ? projectFolders : otherFolders).filter((folder) => folder.name.toLowerCase().includes(search.toLowerCase())) as folder (folder.name)}
            <button type="button" onclick={() => chooseFolder(folder.name, projectName)} {...hover(`switch-${folder.name}`)} style={`${buttonStyle(`switch-${folder.name}`, selectedFolder === folder.name && project === projectName)}padding:10px;width:100%;`}><Folder size={18} /><span style="flex:1;">{folder.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{folder.count}</span>{#if selectedFolder === folder.name && project === projectName}<Check size={15} />{/if}</button>
          {/each}
        {/each}
      {:else if popup === 'templates'}
        <p class="text-xs leading-4" style="margin:10px 8px;color:var(--ui-muted-text);">{templateLibrary}</p>
        {#each (templateLibrary === 'Engineering' ? ['Plan an implementation', 'Review a pull request', 'Build a test plan', 'Review security boundaries'] : ['Write developer documentation', 'Summarize a technical decision', 'Prepare release notes']).filter((entry) => entry.toLowerCase().includes(search.toLowerCase())) as entry (entry)}
          <button type="button" onclick={() => { selectedPrompt = entry; popup = null }} {...hover(entry)} style={`${buttonStyle(entry)}width:100%;padding:11px 9px;`}><Layers size={16} /><span style="flex:1;">{entry}</span><ArrowUpRight size={14} /></button>
        {/each}
      {:else if popup === 'workspace'}
        <p class="text-xs leading-5" style="margin:0 7px 13px;color:var(--ui-muted-text);">C:\Source\PromptApps</p>
        {#each ['Open workspace folder', 'Switch workspace', 'Workspace settings'] as action (action)}
          <button type="button" onclick={() => { popup = null }} {...hover(action)} style={`${buttonStyle(action)}width:100%;padding:10px;`}><Folder size={16} />{action}</button>
        {/each}
      {:else if popup === 'new'}
        {#each [{ icon: FileText, label: 'New prompt', detail: selectedFolder || 'Product' }, { icon: Folder, label: 'New prompt folder', detail: project }, { icon: Layers, label: 'New template', detail: 'Shared templates' }] as action (action.label)}
          <button type="button" onclick={() => { popup = null }} {...hover(action.label)} style={`${buttonStyle(action.label)}width:100%;padding:11px 9px;`}><action.icon size={18} /><span>{action.label}<span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);">{action.detail}</span></span></button>
        {/each}
      {:else}
        {#each [{ icon: Settings, label: 'Project settings' }, { icon: FolderOpen, label: 'Open project folder' }, { icon: Archive, label: 'Show archived prompts' }] as action (action.label)}
          <button type="button" onclick={() => { popup = null }} {...hover(action.label)} style={`${buttonStyle(action.label)}width:100%;padding:10px;`}><action.icon size={16} />{action.label}</button>
        {/each}
      {/if}
      {#if popup === 'project' || popup === 'folders' || popup === 'templates'}
        <div style="border-top:1px solid var(--ui-neutral-muted-border);margin-top:10px;padding-top:7px;"><button type="button" onclick={() => { popup = 'new' }} {...hover('create-footer')} style={`${buttonStyle('create-footer')}width:100%;padding:9px;`}><Plus size={16} />{popup === 'project' ? 'New project' : popup === 'folders' ? 'New prompt folder' : 'New template library'}</button></div>
      {/if}
    </div>
  {/if}
</main>
