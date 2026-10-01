<script lang="ts">
  import {
    Archive, ArrowUpToLine, Bookmark, Bug, Check, ChevronDown, ChevronRight,
    ChevronsDownUp, Download, ExternalLink, FileText, Folder, FolderCog,
    Home, Layers, ListTodo, MoreHorizontal, PanelsTopLeft, RefreshCw, Settings, X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import ProgressBar from '@renderer/common/cthulhu-ui/loading/ProgressBar.svelte'

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

  <section aria-label="App Updates" style="position:absolute;left:58px;bottom:10px;width:338px;max-width:calc(100% - 72px);z-index:5;">
    <CardSurface variant="overlay" class="flex flex-col">
    <header class="flex min-w-0 items-center gap-2 px-4 py-3">
      <Download size={24} class="shrink-0" aria-hidden="true" />
      <h2 class="m-0 flex-1 text-lg font-semibold">App Updates</h2>
      <IconButton icon={X} label="Close updates" />
    </header>
    <Separator />
    <div class="min-w-0 p-4">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="flex:1;"><div class="text-sm" style="color:var(--ui-muted-text);margin-bottom:4px;">Current version</div><div class="text-xl leading-7 font-semibold" style="font-variant-numeric:tabular-nums;">{update.currentVersion}</div><div class="mt-1 text-sm" style="color:var(--ui-secondary-text);">Sep 14, 2026</div></div>
        <ChevronRight size={18} style="color:var(--ui-muted-icon-glyph);" />
        <div style="flex:1;padding:9px 13px;border:1px solid var(--ui-accent-muted-border);border-radius:6px;background:var(--ui-accent-action-fill);"><div class="text-sm" style="color:var(--ui-secondary-text);margin-bottom:4px;">Latest version</div><div class="text-xl leading-7 font-semibold" style="font-variant-numeric:tabular-nums;">{update.state === 'current' ? update.currentVersion : update.latestVersion}</div><div class="mt-1 text-sm" style="color:var(--ui-secondary-text);">{update.state === 'current' ? 'Sep 14, 2026' : 'Sep 28, 2026'}</div></div>
      </div>
      {#if update.state === 'downloading'}
        <div style="padding:14px 0 17px;border-top:1px solid var(--ui-neutral-muted-border);">
          <ProgressBar
            value={64}
            label="Downloading update…"
            detail="54.2 MB of 84.7 MB"
            ariaLabel="Download progress"
          />
        </div>
      {/if}
      <Button
        variant="accent"
        state={update.state === 'downloading' ? 'disabled' : 'enabled'}
        icon={update.state === 'ready' || update.state === 'current' ? RefreshCw : Download}
        text={update.state === 'ready' ? 'Update & Restart' : update.state === 'current' ? 'Check for updates' : update.state === 'downloading' ? 'Downloading…' : 'Download'}
        style="width:100%;max-width:none;justify-content:center;"
      />
      <Button
        appearance="outline"
        icon={ExternalLink}
        text="View GitHub releases"
        class="mt-2"
        style="width:100%;max-width:none;justify-content:center;"
      />
    </div>
    </CardSurface>
  </section>
</main>
