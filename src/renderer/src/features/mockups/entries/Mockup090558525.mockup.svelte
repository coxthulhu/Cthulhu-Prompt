<script lang="ts">
  import {
    Archive, ArrowUpRight, Check, ChevronDown, ChevronRight, ChevronsUpDown,
    CircleCheck, Code, FileText, Folder, FolderOpen, Home, Layers, MoreHorizontal,
    PanelsTopLeft, Plus, Search, Settings, Users, X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  type Popup = 'workspace' | 'project' | 'folders' | 'add' | 'options'
  // These runes only preview navigation, tree expansion, and popup visibility.
  let popup = $state<Popup | null>(null)
  let project = $state('Cthulhu Prompt')
  let selectedFolder = $state('Team prompts')
  let selectedPrompt = $state('Map the current implementation')
  let query = $state('')
  let expanded = $state<Record<string, boolean>>({ projects: true, templates: true, 'Team prompts': true, Engineering: true, Research: true })
  const projects = ['Cthulhu Prompt', 'Atlas API', 'Personal website']
  const recent = [
    { name: 'Team prompts', label: 'Team', detail: 'Cthulhu Prompt', icon: Users },
    { name: 'My prompts', label: 'My prompts', detail: 'Cthulhu Prompt', icon: Folder },
    { name: 'Engineering', label: 'Engineering', detail: 'Shared templates', icon: Layers }
  ]
  const projectFolders = [
    { name: 'Team prompts', count: 12, icon: Users, prompts: ['Map the current implementation', 'Clarify product requirements', 'Draft an implementation plan'] },
    { name: 'My prompts', count: 6, icon: Folder, prompts: ['Improve keyboard navigation', 'Investigate editor performance', 'Review component boundaries'] },
    { name: 'Release planning', count: 4, icon: Folder, prompts: ['Prepare release notes', 'Review migration checklist', 'Verify update experience'] }
  ]
  const templateFolders = [
    { name: 'Engineering', count: 18, prompts: ['Plan an implementation', 'Review a pull request', 'Build a test plan'] },
    { name: 'Writing', count: 8, prompts: ['Write developer documentation', 'Summarize a technical decision'] }
  ]
  // Keep the folder switcher's labels aligned with the locally previewed project.
  const allFolders = $derived([...projectFolders.map((folder) => ({ ...folder, scope: project })), ...templateFolders.map((folder) => ({ ...folder, scope: 'Shared templates' }))])
  const filteredFolders = $derived(allFolders.filter((folder) => folder.name.toLowerCase().includes(query.toLowerCase())))
  const buttonStyle = 'display:flex;align-items:center;gap:9px;border:0;border-radius:5px;padding:0 9px;height:32px;background:transparent;color:var(--ui-hoverable-text);cursor:pointer;text-align:left;'
  const panelStyle = 'position:absolute;z-index:30;padding:8px;border:1px solid var(--ui-neutral-emphasis-border);border-radius:9px;background:var(--ui-card-overlay-surface);box-shadow:0 12px 35px var(--ui-shadow-raised);'
  const toggle = (name: string) => { expanded[name] = !expanded[name] }
  const openFolder = (name: string) => {
    selectedFolder = name
    expanded[name] = true
    expanded[templateFolders.some((folder) => folder.name === name) ? 'templates' : 'projects'] = true
    popup = null
  }
  const togglePopup = (name: Popup) => { popup = popup === name ? null : name }

  // Give inline-styled controls the same brighter pointer and keyboard focus treatment.
  function brighten(node: HTMLButtonElement) {
    const normal = node.style.color
    const enter = () => { node.style.color = 'var(--ui-normal-text)' }
    const leave = () => { node.style.color = normal }
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focus', enter)
    node.addEventListener('blur', leave)
    return { destroy() {
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
      node.removeEventListener('focus', enter)
      node.removeEventListener('blur', leave)
    } }
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') popup = null }} />

{#snippet iconButton(Icon: typeof Plus, label: string, action: () => void, active = false)}
  <button use:brighten type="button" aria-label={label} title={label} onclick={action}
    style={`${buttonStyle}justify-content:center;width:30px;padding:0;flex-shrink:0;${active ? 'background:var(--ui-neutral-action-fill);color:var(--ui-normal-text);' : ''}`}>
    <Icon size={17} strokeWidth={1.6} />
  </button>
{/snippet}

{#snippet promptRow(title: string, template = false)}
  <button use:brighten type="button" class="text-sm leading-5" onclick={() => { selectedPrompt = title }}
    aria-current={selectedPrompt === title ? 'page' : undefined}
    style={`${buttonStyle}width:100%;height:33px;padding-left:12px;gap:8px;${selectedPrompt === title ? 'background:var(--ui-accent-action-fill);color:var(--ui-normal-text);box-shadow:inset 2px 0 var(--ui-accent-strong-border);' : ''}`}>
    {#if template}<Layers size={13} style="flex-shrink:0;opacity:0.6;" />{:else}<FileText size={13} style="flex-shrink:0;opacity:0.6;" />{/if}
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{title}</span>
  </button>
{/snippet}

<main class="text-sm leading-5" style="display:flex;width:100%;height:100%;min-height:0;position:relative;color:var(--ui-normal-text);">
  <nav aria-label="Application navigation" style="width:50px;flex-shrink:0;display:flex;align-items:center;flex-direction:column;gap:7px;padding:10px 0;border-right:1px solid var(--ui-neutral-muted-border);background:var(--ui-chrome-normal-surface);">
    <button use:brighten type="button" aria-label="Workspace: CthulhuPromptPublic" title="CthulhuPromptPublic" aria-expanded={popup === 'workspace'} onclick={() => togglePopup('workspace')}
      style={`${buttonStyle}height:38px;width:38px;padding:4px;justify-content:center;margin-bottom:12px;`}>
      <img src={appIcon} alt="" style="width:30px;height:30px;object-fit:contain;" />
    </button>
    {@render iconButton(Home, 'Home', () => { popup = null })}
    <button type="button" title="Prompts and templates" aria-label="Prompts and templates" aria-current="page" style={`${buttonStyle}width:38px;height:38px;justify-content:center;padding:0;background:var(--ui-accent-action-fill);color:var(--ui-normal-text);border:1px solid var(--ui-accent-normal-border);`}><FileText size={21} strokeWidth={1.6} /></button>
    <div style="flex:1;"></div>
    {@render iconButton(PanelsTopLeft, 'Mockups', () => { popup = null })}
    {@render iconButton(Settings, 'Settings', () => togglePopup('options'))}
  </nav>

  <aside aria-label="Projects and shared templates" style="width:324px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--ui-neutral-normal-border);">
    <div style="padding:10px 10px 11px;border-bottom:1px solid var(--ui-neutral-muted-border);position:relative;">
      <div style="display:flex;align-items:center;gap:4px;">
        {#each recent as folder (folder.name)}
          <button use:brighten type="button" title={`${folder.name} · ${folder.detail}`} aria-label={`Switch to ${folder.name}`} aria-pressed={selectedFolder === folder.name} onclick={() => openFolder(folder.name)}
            style={`display:flex;flex:1;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:61px;padding:6px 3px;cursor:pointer;border-radius:6px;border:1px solid ${selectedFolder === folder.name ? 'var(--ui-accent-normal-border)' : 'var(--ui-neutral-muted-border)'};background:${selectedFolder === folder.name ? 'var(--ui-accent-action-fill)' : 'var(--ui-neutral-normal-surface)'};color:${selectedFolder === folder.name ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'};`}>
            <folder.icon size={18} strokeWidth={1.5} />
            <span class="text-xs leading-4" style="width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">{folder.label}</span>
          </button>
        {/each}
        <button use:brighten type="button" aria-label="Open folder switcher" title="All folders" aria-expanded={popup === 'folders'} onclick={() => { query = ''; togglePopup('folders') }} style={`${buttonStyle}width:30px;height:61px;justify-content:center;padding:0;`}><ChevronsUpDown size={18} /></button>
      </div>
      {#if popup === 'folders'}
        <div role="dialog" aria-label="Folder switcher" tabindex="-1" style={`${panelStyle}left:9px;top:79px;width:340px;`}>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid var(--ui-neutral-normal-border);border-radius:5px;margin-bottom:9px;">
            <Search size={16} style="color:var(--ui-muted-icon-glyph);" /><input class="text-sm leading-5" aria-label="Find a folder" placeholder="Find a folder…" bind:value={query} style="width:100%;min-width:0;border:0;outline:none;background:transparent;color:var(--ui-normal-text);" />
            {@render iconButton(X, 'Close folder switcher', () => { popup = null })}
          </div>
          {#each [project, 'Shared templates'] as scope (scope)}
            <p class="text-xs leading-4" style="padding:5px 8px;margin:4px 0;color:var(--ui-muted-text);">{scope}</p>
            {#each filteredFolders.filter((folder) => folder.scope === scope) as folder (folder.name)}
              <button use:brighten type="button" class="text-sm leading-5" onclick={() => openFolder(folder.name)} style={`${buttonStyle}height:48px;width:100%;${selectedFolder === folder.name ? 'background:var(--ui-accent-action-fill);color:var(--ui-normal-text);' : ''}`}>
                {#if scope === 'Shared templates'}<Layers size={19} />{:else}<Folder size={19} />{/if}
                <span style="flex:1;">{folder.name}<span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);">{folder.count} {scope === 'Shared templates' ? 'templates' : 'prompts'}</span></span>
                {#if selectedFolder === folder.name}<Check size={16} />{/if}
              </button>
            {/each}
          {/each}
          {#if filteredFolders.length === 0}<p style="padding:8px;color:var(--ui-muted-text);">No folders found</p>{/if}
          <div style="border-top:1px solid var(--ui-neutral-muted-border);margin-top:8px;padding-top:6px;"><button use:brighten class="text-sm leading-5" type="button" onclick={() => { popup = 'add' }} style={`${buttonStyle}width:100%;`}><Plus size={16} />New folder</button></div>
        </div>
      {/if}
    </div>

    <div style="display:flex;align-items:center;gap:3px;padding:13px 10px 10px;position:relative;">
      <button use:brighten type="button" class="text-sm leading-5" aria-label="Select project" aria-expanded={popup === 'project'} onclick={() => togglePopup('project')} style={`${buttonStyle}flex:1;min-width:0;height:35px;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-normal-border);`}>
        <Code size={17} style="color:var(--ui-accent-link-text);" /><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">{project}</span><ChevronDown size={15} />
      </button>
      {@render iconButton(Plus, 'Create', () => togglePopup('add'), popup === 'add')}
      {@render iconButton(MoreHorizontal, 'Sidebar options', () => togglePopup('options'), popup === 'options')}
      {#if popup === 'project'}
        <div role="dialog" aria-label="Select project" tabindex="-1" style={`${panelStyle}top:54px;left:10px;width:303px;`}>
          <p class="text-xs leading-4" style="margin:3px 8px 7px;color:var(--ui-muted-text);">Projects</p>
          {#each projects as name, index (name)}
            <button use:brighten type="button" class="text-sm leading-5" onclick={() => { project = name; popup = null }} style={`${buttonStyle}width:100%;height:47px;${project === name ? 'background:var(--ui-accent-action-fill);color:var(--ui-normal-text);' : ''}`}>
              <Code size={18} /><span style="flex:1;">{name}<span class="text-xs leading-4" style="display:block;color:var(--ui-muted-text);">{index === 0 ? '3 folders · 22 prompts' : index === 1 ? '2 folders · 14 prompts' : '1 folder · 6 prompts'}</span></span>{#if project === name}<Check size={16} />{/if}
            </button>
          {/each}
          <div style="border-top:1px solid var(--ui-neutral-muted-border);margin-top:8px;padding-top:6px;"><button use:brighten type="button" class="text-sm leading-5" style={`${buttonStyle}width:100%;`} onclick={() => { popup = 'add' }}><Plus size={16} />New project</button></div>
        </div>
      {:else if popup === 'add' || popup === 'options'}
        <div role="dialog" aria-label={popup === 'add' ? 'Create' : 'Sidebar options'} tabindex="-1" style={`${panelStyle}top:54px;right:10px;width:224px;`}>
          {#if popup === 'add'}
            {#each [{ label: 'New prompt', icon: FileText }, { label: 'New project folder', icon: Folder }, { label: 'New shared template', icon: Layers }, { label: 'New project', icon: Code }] as item (item.label)}
              <button use:brighten type="button" class="text-sm leading-5" onclick={() => { popup = null }} style={`${buttonStyle}width:100%;height:36px;`}><item.icon size={16} />{item.label}</button>
            {/each}
          {:else}
            <button use:brighten type="button" class="text-sm leading-5" onclick={() => { expanded = {}; popup = null }} style={`${buttonStyle}width:100%;`}><ChevronRight size={16} />Collapse all folders</button>
            <button use:brighten type="button" class="text-sm leading-5" onclick={() => { expanded.templates = !expanded.templates; popup = null }} style={`${buttonStyle}width:100%;`}><Layers size={16} />{expanded.templates ? 'Hide' : 'Show'} shared templates</button>
            <button use:brighten type="button" class="text-sm leading-5" onclick={() => { popup = null }} style={`${buttonStyle}width:100%;`}><Settings size={16} />Project settings</button>
          {/if}
        </div>
      {/if}
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:0 10px 15px;">
      <button use:brighten type="button" class="text-xs leading-4" aria-expanded={!!expanded.projects} onclick={() => toggle('projects')} style={`${buttonStyle}width:100%;height:36px;padding:0 3px;color:var(--ui-secondary-text);font-weight:600;letter-spacing:0.07em;`}>
        {#if expanded.projects}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}PROJECT PROMPTS<span style="margin-left:auto;color:var(--ui-muted-text);font-weight:400;letter-spacing:0;">22</span>
      </button>
      {#if expanded.projects}
        <div style="border-left:1px solid var(--ui-accent-normal-border);margin-left:9px;padding-left:7px;">
          {#each projectFolders as folder (folder.name)}
            <button use:brighten type="button" class="text-sm leading-5" aria-expanded={!!expanded[folder.name]} onclick={() => { toggle(folder.name); selectedFolder = folder.name }} style={`${buttonStyle}width:100%;height:36px;padding:0 5px;gap:7px;${selectedFolder === folder.name ? 'color:var(--ui-normal-text);' : ''}`}>
              {#if expanded[folder.name]}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
              <folder.icon size={16} style="color:var(--ui-accent-link-text);" /><span style="flex:1;font-weight:500;">{folder.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{folder.count}</span>
            </button>
            {#if expanded[folder.name]}
              <div style="padding-left:10px;margin:1px 0 6px;">
                {#each folder.prompts as title (title)}{@render promptRow(title)}{/each}
                {#if folder.name === 'Team prompts'}
                  <button use:brighten type="button" class="text-sm leading-5" aria-expanded={!!expanded.Research} onclick={() => toggle('Research')} style={`${buttonStyle}width:100%;padding-left:8px;`}>
                    {#if expanded.Research}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}<FolderOpen size={14} /><span>Research</span><span class="text-xs leading-4" style="margin-left:auto;color:var(--ui-muted-text);">3</span>
                  </button>
                  {#if expanded.Research}<div style="margin-left:14px;border-left:1px solid var(--ui-neutral-muted-border);padding-left:3px;">{@render promptRow('Compare sidebar patterns')}{@render promptRow('Audit accessibility behavior')}</div>{/if}
                  <button use:brighten type="button" class="text-xs leading-4" onclick={() => toggle('backlog')} aria-expanded={!!expanded.backlog} style={`${buttonStyle}width:100%;height:30px;padding-left:12px;color:var(--ui-muted-text);`}><ChevronRight size={13} style={`transform:rotate(${expanded.backlog ? 90 : 0}deg);`} />Backlog<span style="margin-left:auto;">4</span></button>
                  {#if expanded.backlog}{@render promptRow('Explore prompt search')}{@render promptRow('Plan keyboard shortcuts')}{/if}
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {/if}

      <div style="height:12px;"></div>
      <button use:brighten type="button" class="text-xs leading-4" aria-expanded={!!expanded.templates} onclick={() => toggle('templates')} style={`${buttonStyle}width:100%;height:36px;padding:0 3px;color:var(--ui-secondary-text);font-weight:600;letter-spacing:0.07em;`}>
        {#if expanded.templates}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}SHARED TEMPLATES<Layers size={13} style="margin-left:auto;opacity:0.6;" />
      </button>
      {#if expanded.templates}
        <div style="margin-left:9px;border-left:1px solid var(--ui-info-muted-border);padding-left:7px;">
          {#each templateFolders as folder (folder.name)}
            <button use:brighten type="button" class="text-sm leading-5" aria-expanded={!!expanded[folder.name]} onclick={() => { toggle(folder.name); selectedFolder = folder.name }} style={`${buttonStyle}width:100%;height:36px;padding:0 5px;gap:7px;`}>
              {#if expanded[folder.name]}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}<Layers size={16} style="color:var(--ui-secondary-icon-glyph);" /><span style="flex:1;font-weight:500;">{folder.name}</span><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{folder.count}</span>
            </button>
            {#if expanded[folder.name]}<div style="padding-left:10px;margin-bottom:5px;">{#each folder.prompts as title (title)}{@render promptRow(title, true)}{/each}</div>{/if}
          {/each}
        </div>
      {/if}
    </div>
    <footer style="display:flex;gap:4px;padding:7px 10px;border-top:1px solid var(--ui-neutral-muted-border);">
      <button use:brighten type="button" class="text-xs leading-4" onclick={() => toggle('completed')} aria-expanded={!!expanded.completed} style={`${buttonStyle}height:29px;flex:1;color:var(--ui-muted-text);`}><CircleCheck size={15} />Completed<span style="margin-left:auto;">8</span></button>
      {@render iconButton(Archive, 'Archived prompts', () => toggle('archived'), !!expanded.archived)}
    </footer>
    {#if expanded.completed || expanded.archived}<div style="padding:5px 12px 10px;border-top:1px solid var(--ui-neutral-muted-border);">{@render promptRow(expanded.archived ? 'Explore the previous layout' : 'Audit the existing sidebar')}</div>{/if}
  </aside>

  {#if popup === 'workspace'}
    <div role="dialog" aria-label="Workspace" tabindex="-1" style={`${panelStyle}top:9px;left:48px;width:298px;`}>
      <div style="display:flex;align-items:center;gap:10px;padding:9px 8px 14px;"><img src={appIcon} alt="" style="width:32px;height:32px;" /><div><div style="font-weight:600;">CthulhuPromptPublic</div><div class="text-xs leading-4" style="color:var(--ui-muted-text);">C:\Source\PromptApps</div></div>{@render iconButton(X, 'Close workspace menu', () => { popup = null })}</div>
      <div style="border-top:1px solid var(--ui-neutral-muted-border);padding-top:5px;">
        {#each [{ label: 'Open workspace folder', icon: ArrowUpRight }, { label: 'Switch workspace', icon: FolderOpen }, { label: 'Workspace settings', icon: Settings }] as item (item.label)}
          <button use:brighten type="button" class="text-sm leading-5" onclick={() => { popup = null }} style={`${buttonStyle}height:36px;width:100%;`}><item.icon size={16} />{item.label}</button>
        {/each}
      </div>
    </div>
  {/if}
</main>
