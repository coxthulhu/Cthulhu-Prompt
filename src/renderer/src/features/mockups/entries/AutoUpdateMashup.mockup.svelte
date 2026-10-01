<script lang="ts">
  import {
    Archive, ArrowUpToLine, Bookmark, Bug, Check, ChevronDown, ChevronRight,
    ChevronsDownUp, Download, ExternalLink, FileText, Folder, FolderCog,
    Home, Layers, ListTodo, MoreHorizontal, PanelsTopLeft, RefreshCw, Settings, X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  const activities = [
    { label: 'Home', icon: Home },
    { label: 'Task Prompts', icon: FileText },
    { label: 'Prompt Templates', icon: Layers },
    { label: 'Settings', icon: Settings },
    { label: 'Mockups', icon: PanelsTopLeft },
    { label: 'Test Screen', icon: Bug }
  ]
  const toolbar = [
    { label: 'Show Folder Overview', icon: ArrowUpToLine },
    { label: 'Show Completed Prompts', icon: Check },
    { label: 'Show Archived Prompts', icon: Archive },
    { label: 'Collapse All Categories', icon: ChevronsDownUp },
    { label: 'Manage Categories', icon: FolderCog },
    { label: 'Selected Folder Actions', icon: MoreHorizontal }
  ]
  const prompts = ['Map the current implementation', 'Clarify product requirements', 'Draft an implementation plan', 'Identify edge cases', 'Define acceptance criteria', 'Review the data flow']
  const categories = [
    { title: 'Research', prompts: ['Compare sidebar patterns', 'Prepare the UI copy', 'Audit accessibility behavior'] },
    { title: 'Verification', prompts: ['Verify folder interactions', 'Create a regression checklist', 'Inspect performance risks', 'Document architecture decisions'] }
  ]
  const update: { state: 'current' | 'available' | 'downloading' | 'ready'; currentVersion: string; latestVersion: string } = {
    state: 'downloading', currentVersion: '1.8.2', latestVersion: '1.9.0'
  }
  const iconStyle = 'display:flex;align-items:center;justify-content:center;flex:none;border:0;background:transparent;color:var(--ui-normal-text);padding:0;'
</script>

<main class="text-sm leading-5" style="display:flex;position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:hidden;color:var(--ui-normal-text);font-family:Aptos,'Segoe UI Variable','Segoe UI',sans-serif;">
  <nav aria-label="Primary navigation" style="display:flex;flex:0 0 48px;flex-direction:column;align-items:center;gap:4px;padding:10px 0;box-sizing:border-box;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-muted-border);border-top:1px solid var(--ui-neutral-hover-border);">
    {#each activities as activity (activity.label)}
      <button type="button" title={activity.label} aria-label={activity.label} aria-current={activity.label === 'Task Prompts' ? 'page' : undefined} style={`${iconStyle}position:relative;height:44px;width:100%;opacity:${activity.label === 'Task Prompts' ? 1 : 0.7};`}>
        {#if activity.label === 'Task Prompts'}<span style="position:absolute;left:0;top:4px;bottom:4px;width:2px;background:var(--ui-accent-strong-border);border-radius:0 2px 2px 0;"></span>{/if}
        <activity.icon size={24} strokeWidth={1.5} />
      </button>
    {/each}
    <div style="flex:1;"></div>
    <button type="button" title="Check for updates" aria-label="Check for updates — update available" aria-expanded="true" style={`${iconStyle}position:relative;width:36px;height:36px;border-radius:6px;background:var(--ui-accent-action-fill);border:1px solid var(--ui-accent-normal-border);`}>
      <Download size={20} strokeWidth={1.75} />
      {#if update.state !== 'current'}<span style="position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:var(--ui-success-normal-text);border:2px solid var(--ui-chrome-normal-surface);box-sizing:content-box;"></span>{/if}
    </button>
  </nav>

  <aside aria-label="Cthulhu Prompt sidebar" style="display:flex;flex:0 0 275px;flex-direction:column;min-height:0;box-sizing:border-box;background:var(--ui-chrome-normal-surface);border-right:1px solid var(--ui-neutral-hover-border);border-top:1px solid var(--ui-neutral-hover-border);">
    <header style="display:flex;gap:8px;padding:16px 8px 12px;align-items:flex-start;">
      <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none;"><img src={appIcon} alt="Cthulhu Prompt" style="width:32px;height:32px;object-fit:contain;" /></div>
      <div style="min-width:0;">
        <div style="display:flex;align-items:center;gap:4px;"><h1 class="text-sm font-semibold" style="margin:0;letter-spacing:-0.025em;">CthulhuPromptPublic</h1><ExternalLink size={14} style="color:var(--ui-muted-icon-glyph);" /></div>
        <p class="text-xs" style="margin:2px 0 0;color:var(--ui-muted-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">C:\Source\PromptApps\CthulhuPromptPublic</p>
      </div>
    </header>
    <div style="border-top:1px solid var(--ui-neutral-muted-border);padding:10px 15px;display:flex;gap:12px;align-items:center;">
      <FileText size={20} />
      <div style="flex:1;"><div class="font-semibold">Product Work</div><div class="text-xs leading-5" style="color:var(--ui-secondary-text);">22 prompts · Updated today</div></div>
      <ChevronDown size={20} />
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 8px;border-top:1px solid var(--ui-neutral-muted-border);">
      {#each toolbar as action (action.label)}<button type="button" aria-label={action.label} title={action.label} style={`${iconStyle}height:36px;width:36px;`}><action.icon size={20} /></button>{/each}
    </div>
    <div style="display:flex;align-items:center;gap:7px;min-height:36px;padding:0 12px 0 10px;border-top:1px solid var(--ui-neutral-muted-border);color:var(--ui-secondary-text);"><ChevronDown size={20} /><ListTodo size={16} /><span class="font-semibold" style="flex:1;">Active</span><span class="text-xs">20</span></div>
    <div style="flex:1;min-height:0;overflow:hidden;">
      {#each prompts as prompt, index (prompt)}
        <div style={`height:30px;display:flex;align-items:center;padding:0 12px;border-left:2px solid ${index === 0 ? 'var(--ui-warning-icon-glyph)' : index === 1 ? 'var(--ui-info-strong-border)' : 'transparent'};background:${index === 0 ? 'var(--ui-neutral-emphasis-surface)' : 'transparent'};color:var(--ui-hoverable-text);white-space:nowrap;overflow:hidden;`}><span style="overflow:hidden;text-overflow:ellipsis;">{prompt}</span></div>
      {/each}
      {#each categories as category (category.title)}
        <div style="height:32px;display:flex;gap:8px;align-items:center;padding:0 12px 0 10px;color:var(--ui-secondary-text);"><ChevronDown size={18} /><Folder size={16} /><span>{category.title}</span></div>
        {#each category.prompts as prompt (prompt)}<div style="height:30px;display:flex;align-items:center;padding:0 14px 0 28px;color:var(--ui-hoverable-text);white-space:nowrap;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;">{prompt}</span></div>{/each}
      {/each}
    </div>
    <div style="display:flex;align-items:center;gap:7px;min-height:36px;padding:0 12px 0 10px;border-top:1px solid var(--ui-neutral-muted-border);color:var(--ui-secondary-text);"><ChevronRight size={20} /><Bookmark size={16} /><span class="font-semibold" style="flex:1;">Backlog</span><span class="text-xs">2</span></div>
  </aside>

  <section aria-label="App updates" style="position:absolute;left:58px;bottom:10px;width:338px;max-width:calc(100% - 72px);box-sizing:border-box;border:1px solid var(--ui-accent-normal-border);border-radius:10px;background:var(--ui-card-overlay-surface);box-shadow:0 12px 32px var(--ui-card-normal-shadow),0 0 0 1px var(--ui-neutral-muted-border);overflow:hidden;z-index:5;">
    <header style="display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--ui-neutral-muted-border);">
      <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--ui-accent-muted-border);border-radius:8px;background:var(--ui-accent-action-fill);"><Download size={18} /></div>
      <h2 class="text-sm font-semibold" style="flex:1;margin:0;">App updates</h2>
      <button type="button" aria-label="Close updates" style={`${iconStyle}width:24px;height:24px;`}><X size={17} /></button>
    </header>
    <div style="padding:18px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:16px;color:var(--ui-success-normal-text);">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--ui-success-normal-text);"></span>
        <span class="text-xs font-semibold">{update.state === 'current' ? 'No Updates Available' : update.state === 'ready' ? 'Ready to install' : 'Update available'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="flex:1;"><div class="text-xs" style="color:var(--ui-muted-text);margin-bottom:4px;">Current version</div><div class="text-xl leading-7 font-semibold" style="font-variant-numeric:tabular-nums;">{update.currentVersion}</div></div>
        <ChevronRight size={18} style="color:var(--ui-muted-icon-glyph);" />
        <div style="flex:1;padding:9px 13px;border:1px solid var(--ui-accent-muted-border);border-radius:6px;background:var(--ui-accent-action-fill);"><div class="text-xs" style="color:var(--ui-secondary-text);margin-bottom:4px;">Latest version</div><div class="text-xl leading-7 font-semibold" style="font-variant-numeric:tabular-nums;">{update.state === 'current' ? update.currentVersion : update.latestVersion}</div></div>
      </div>
      <div class="text-xs" style="display:flex;justify-content:space-between;gap:12px;padding-bottom:18px;color:var(--ui-muted-text);"><span>Release date</span><span style="color:var(--ui-secondary-text);">September 28, 2026</span></div>
      {#if update.state === 'downloading'}
        <div style="padding:14px 0 17px;border-top:1px solid var(--ui-neutral-muted-border);">
          <div class="text-xs" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span>Downloading update…</span><span class="font-semibold" style="font-variant-numeric:tabular-nums;">64%</span></div>
          <div role="progressbar" aria-label="Download progress" aria-valuenow={64} aria-valuemin={0} aria-valuemax={100} style="height:5px;border-radius:3px;background:var(--ui-neutral-emphasis-surface);overflow:hidden;"><div style="width:64%;height:100%;background:var(--ui-accent-link-text);border-radius:3px;"></div></div>
          <div class="text-xs" style="display:flex;justify-content:space-between;margin-top:8px;color:var(--ui-muted-text);"><span>54.2 MB of 84.7 MB</span><span>About 12 seconds left</span></div>
        </div>
      {/if}
      <button type="button" disabled={update.state === 'downloading'} class="text-sm font-semibold" style={`display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:40px;border-radius:6px;border:1px solid var(--ui-accent-normal-border);background:var(--ui-accent-action-fill);color:var(--ui-normal-text);opacity:${update.state === 'downloading' ? 0.55 : 1};`}>
        {#if update.state === 'ready'}<RefreshCw size={16} />Update &amp; Restart
        {:else if update.state === 'current'}<RefreshCw size={16} />Check for updates
        {:else if update.state === 'downloading'}<Download size={16} />Downloading…
        {:else}<Download size={16} />Download{/if}
      </button>
    </div>
    <footer style="padding:0 18px 15px;">
      <button type="button" class="text-xs" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:34px;border:1px solid var(--ui-neutral-normal-border);border-radius:6px;background:transparent;color:var(--ui-normal-text);">View GitHub releases<ExternalLink size={13} /></button>
    </footer>
  </section>
</main>
