<script lang="ts">
  import { BookOpen, Bug, ChevronRight, ExternalLink, FileText, FolderOpen, FolderPlus, Folders, X } from 'lucide-svelte'

  const recentWorkspaces = [
    { name: 'Product Development', path: 'C:\\Users\\Alex\\Documents\\Prompt Workspaces\\Product Development', prompts: 24, folders: 3 },
    { name: 'Cthulhu Prompt', path: 'C:\\Source\\CthulhuPrompt', prompts: 48, folders: 5 },
    { name: 'Personal Projects', path: 'C:\\Users\\Alex\\Documents\\Prompt Workspaces\\Personal Projects', prompts: 12, folders: 2 }
  ]

  // Local state previews opening and closing a sample workspace without touching the application.
  let workspace = $state<(typeof recentWorkspaces)[number] | null>(recentWorkspaces[0])
  let hovered = $state<string | null>(null)
  let focused = $state<string | null>(null)
  const isActive = (key: string) => hovered === key || focused === key
  const cardStyle = 'border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-card-normal-surface); min-width: 0; overflow: hidden;'
  const controlStyle = (key: string, filled = false) => `display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 13px; border-radius: 6px; border: 1px solid var(${isActive(key) ? '--ui-neutral-hover-border' : '--ui-neutral-normal-border'}); background: var(${filled ? (isActive(key) ? '--ui-accent-action-hover-fill' : '--ui-accent-action-fill') : (isActive(key) ? '--ui-neutral-subtle-action-hover-fill' : '--ui-ghost-surface')}); color: var(${filled || isActive(key) ? '--ui-normal-text' : '--ui-hoverable-text'}); font-family: inherit; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap;`
</script>

<section class="text-base leading-6" style="display: flex; min-width: 0; min-height: 100%; padding: 48px 32px; color: var(--ui-normal-text); font-family: ui-sans-serif, system-ui, sans-serif;" data-testid="home-screen">
  <main style="width: 100%; max-width: 960px; min-width: 0; margin: auto; display: flex; flex-direction: column; gap: 30px;">
    <header style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
      <h1 class="text-4xl leading-tight font-semibold" style="margin: 0; letter-spacing: -0.035em;" data-testid="home-title">Cthulhu <span style="color: var(--ui-accent-link-text);">Prompt</span></h1>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" class="text-sm leading-5" style={controlStyle('welcome')} onmouseenter={() => hovered = 'welcome'} onmouseleave={() => hovered = null} onfocus={() => focused = 'welcome'} onblur={() => focused = null}>
          <BookOpen size={16} aria-hidden="true" /> Welcome
        </button>
        <a class="text-sm leading-5" style={controlStyle('github')} href="https://github.com/coxthulhu/Cthulhu-Prompt" target="_blank" rel="noreferrer" onmouseenter={() => hovered = 'github'} onmouseleave={() => hovered = null} onfocus={() => focused = 'github'} onblur={() => focused = null}>
          <Bug size={16} aria-hidden="true" /> Github <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </header>

    <section style={cardStyle} aria-label="Current workspace" data-testid="home-primary-card">
      <div style="display: flex; align-items: center; gap: 18px; padding: 28px 24px; min-width: 0;">
        <span style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 44px; height: 44px; color: var(--ui-hoverable-icon-glyph);"><FolderOpen size={30} strokeWidth={1.5} aria-hidden="true" /></span>
        <div style="flex: 1; min-width: 0;">
          <h2 class="text-2xl leading-8 font-semibold" style="margin: 0 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{workspace?.name ?? 'No workspace open'}</h2>
          <p class="text-sm leading-5" style="margin: 0; color: var(--ui-muted-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title={workspace?.path} data-testid="workspace-ready-path">{workspace?.path ?? 'Open a workspace or create one to get started.'}</p>
        </div>
        {#if workspace}
          <button type="button" class="text-sm leading-5" style={`${controlStyle('explorer')} width: 38px; padding: 0; flex-shrink: 0;`} aria-label="Open workspace folder" title="Open workspace folder" onmouseenter={() => hovered = 'explorer'} onmouseleave={() => hovered = null} onfocus={() => focused = 'explorer'} onblur={() => focused = null}>
            <ExternalLink size={19} aria-hidden="true" />
          </button>
        {/if}
      </div>
      <div style="height: 1px; background: var(--ui-neutral-muted-border);"></div>
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; padding: 18px 24px;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 22px; color: var(--ui-muted-text);">
          <span class="text-sm leading-5" style="display: inline-flex; align-items: center; gap: 8px;"><FileText size={17} aria-hidden="true" /><strong class="text-base leading-6 font-semibold" style="color: var(--ui-normal-text);">{workspace?.prompts ?? 0}</strong> Prompts</span>
          <span class="text-sm leading-5" style="display: inline-flex; align-items: center; gap: 8px;"><Folders size={18} aria-hidden="true" /><strong class="text-base leading-6 font-semibold" style="color: var(--ui-normal-text);">{workspace?.folders ?? 0}</strong> Prompt Folders</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
          <button type="button" class="text-sm leading-5" style={controlStyle('open', true)} data-testid="open-workspace-button" onclick={() => workspace = recentWorkspaces[0]} onmouseenter={() => hovered = 'open'} onmouseleave={() => hovered = null} onfocus={() => focused = 'open'} onblur={() => focused = null}><FolderOpen size={16} aria-hidden="true" /> Open</button>
          <button type="button" class="text-sm leading-5" style={controlStyle('create')} data-testid="create-workspace-button" onmouseenter={() => hovered = 'create'} onmouseleave={() => hovered = null} onfocus={() => focused = 'create'} onblur={() => focused = null}><FolderPlus size={16} aria-hidden="true" /> Create</button>
          <button type="button" class="text-sm leading-5" style={`${controlStyle('close')} ${workspace ? '' : 'opacity: 0.4; cursor: default;'}`} disabled={!workspace} data-testid="close-workspace-button" onclick={() => workspace = null} onmouseenter={() => hovered = 'close'} onmouseleave={() => hovered = null} onfocus={() => focused = 'close'} onblur={() => focused = null}><X size={16} aria-hidden="true" /> Close</button>
        </div>
      </div>
    </section>

    <section aria-labelledby="recent-workspaces-heading" style="min-width: 0;">
      <h2 id="recent-workspaces-heading" class="text-lg leading-7 font-semibold" style="margin: 0 0 12px;">Recent Workspaces</h2>
      <div style={`${cardStyle} padding: 8px; display: flex; flex-direction: column; gap: 4px;`}>
        {#each recentWorkspaces as recent (recent.path)}
          <button type="button" style={`display: flex; width: 100%; min-width: 0; align-items: center; gap: 14px; padding: 17px 14px; border: 0; border-radius: 6px; text-align: left; font-family: inherit; cursor: pointer; background: var(${isActive(recent.path) ? '--ui-neutral-action-fill' : '--ui-ghost-surface'}); color: var(${isActive(recent.path) ? '--ui-normal-text' : '--ui-hoverable-text'});`} onclick={() => workspace = recent} onmouseenter={() => hovered = recent.path} onmouseleave={() => hovered = null} onfocus={() => focused = recent.path} onblur={() => focused = null}>
            <span style="display: flex; width: 34px; flex-shrink: 0; justify-content: center;"><FolderOpen size={23} strokeWidth={1.5} aria-hidden="true" /></span>
            <span style="display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px;">
              <span class="text-lg leading-6 font-semibold" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{recent.name}</span>
              <span class="text-sm leading-5" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title={recent.path}>{recent.path}</span>
            </span>
            <span class="text-sm leading-5" style="display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; white-space: nowrap;"><FileText size={15} aria-hidden="true" />{recent.prompts} prompts</span>
            <ChevronRight size={18} style="flex-shrink: 0;" aria-hidden="true" />
          </button>
        {/each}
      </div>
    </section>
  </main>
</section>
