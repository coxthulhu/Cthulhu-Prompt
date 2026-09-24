<script lang="ts">
  import { ArrowUpRight, BookOpen, Clock3, Copy, FileText, Folder, FolderOpen, FolderPlus, Folders, X } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'

  const workspacePath = 'C:\\Users\\Alex\\Documents\\Prompt Workspaces\\Product Development'
  // Track pointer and keyboard focus only to preview row interaction styling.
  let hoveredWorkspace = $state<string | null>(null)
  let focusedWorkspace = $state<string | null>(null)

  const recentWorkspaces = [
    { name: 'Cthulhu Prompt', path: 'C:\\Source\\CthulhuPrompt\\prompts', opened: '2 hours ago', count: 38 },
    { name: 'Website Redesign', path: 'C:\\Projects\\Website Redesign\\prompts', opened: 'Yesterday', count: 16 },
    { name: 'Personal Prompts', path: 'C:\\Users\\Alex\\Documents\\Personal Prompts', opened: 'Sep 21', count: 12 },
    { name: 'API Toolkit', path: 'C:\\Source\\API Toolkit\\prompts', opened: 'Sep 18', count: 27 }
  ]
</script>

<section style="font-size: 14px; line-height: 20px; display: flex; min-height: 100%; width: 100%; padding: 36px 28px; box-sizing: border-box; color: var(--ui-normal-text);">
  <main style="width: 100%; max-width: 1020px; min-width: 0; margin: auto;">
    <header style="display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 20px; padding-bottom: 25px;">
      <h1 style="margin: 0; font-size: 60px; line-height: 1; font-weight: 650; letter-spacing: -0.055em;">Cthulhu <span style="color: var(--ui-accent-link-text);">Prompt</span></h1>
      <div style="display: flex; align-items: center; gap: 8px;">
        <Button icon={BookOpen} text="Welcome" appearance="outline" />
        <Button icon={ArrowUpRight} text="GitHub" appearance="outline" />
      </div>
    </header>

    <div style="border-top: 1px solid var(--ui-neutral-normal-border); border-bottom: 1px solid var(--ui-neutral-normal-border);">
      <section aria-labelledby="current-workspace-title" style="padding: 20px; border-left: 3px solid var(--ui-accent-strong-border); background: var(--ui-card-normal-surface);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px;">
          <h2 id="current-workspace-title" style="font-size: 12px; line-height: 16px; margin: 0; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-muted-text);">Current workspace</h2>
          <span style="font-size: 12px; line-height: 16px; display: flex; align-items: center; gap: 7px; color: var(--ui-success-normal-text);"><span style="width: 6px; height: 6px; border-radius: 50%; background: var(--ui-success-normal-text);"></span>Open</span>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
          <span style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--ui-accent-muted-border); background: var(--ui-accent-action-fill); color: var(--ui-accent-link-text);"><FolderOpen size={25} strokeWidth={1.6} /></span>
          <div style="min-width: 0; flex: 1;">
            <h3 style="font-size: 24px; line-height: 32px; margin: 0; font-weight: 600; letter-spacing: -0.02em;">Product Development</h3>
            <p title={workspacePath} style="font-size: 12px; line-height: 20px; margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Consolas, monospace; color: var(--ui-muted-text);">{workspacePath}</p>
          </div>
          <IconButton icon={Copy} label="Copy workspace path" borderless />
          <IconButton icon={ArrowUpRight} label="Open workspace folder" borderless />
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 18px; margin-top: 21px; padding-top: 16px; border-top: 1px solid var(--ui-neutral-muted-border);">
          <div style="display: flex; align-items: center; gap: 20px; color: var(--ui-muted-text);">
            <span style="display: inline-flex; align-items: center; gap: 7px;"><FileText size={16} /><strong style="font-weight: 600; color: var(--ui-normal-text);">24</strong> prompts</span>
            <span style="height: 16px; border-left: 1px solid var(--ui-neutral-normal-border);"></span>
            <span style="display: inline-flex; align-items: center; gap: 7px;"><Folders size={16} /><strong style="font-weight: 600; color: var(--ui-normal-text);">3</strong> prompt folders</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <Button icon={FolderOpen} text="Open" variant="accent" />
            <Button icon={FolderPlus} text="Create" appearance="outline" />
            <span style="height: 22px; margin: 0 3px; border-left: 1px solid var(--ui-neutral-normal-border);"></span>
            <Button icon={X} text="Close" appearance="outline" />
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-workspaces-title" style="border-top: 1px solid var(--ui-neutral-normal-border);">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 12px;">
          <h2 id="recent-workspaces-title" style="font-size: 14px; line-height: 20px; display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 600;"><Clock3 size={16} style="color: var(--ui-muted-icon-glyph);" />Recent workspaces</h2>
          <span style="font-size: 12px; line-height: 16px; color: var(--ui-muted-text);">Last opened</span>
        </div>
        <div style="padding: 0 20px 8px;">
          {#each recentWorkspaces as workspace, index (workspace.name)}
            {@const highlighted = hoveredWorkspace === workspace.path || focusedWorkspace === workspace.path}
          <button type="button" aria-label={`Open ${workspace.name}`}
              onpointerenter={() => { hoveredWorkspace = workspace.path }}
              onpointerleave={() => { hoveredWorkspace = null }}
              onfocus={() => { focusedWorkspace = workspace.path }}
              onblur={() => { focusedWorkspace = null }}
              style={`--recent-text: ${highlighted ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; --recent-muted: ${highlighted ? 'var(--ui-normal-text)' : 'var(--ui-muted-text)'}; --recent-icon: ${highlighted ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-icon-glyph)'}; outline: ${focusedWorkspace === workspace.path ? '2px solid var(--ui-neutral-focus-border)' : 'none'}; outline-offset: -2px; display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 0; text-align: left; font: inherit; color: var(--recent-text); background: ${highlighted ? 'var(--ui-neutral-action-fill)' : 'transparent'}; border: 0; border-top: ${index === 0 ? '0' : '1px solid var(--ui-neutral-muted-border)'}; cursor: pointer;`}>
              <span style="display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 34px; height: 36px; color: var(--recent-icon);"><Folder size={21} strokeWidth={1.5} /></span>
              <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
                <span style="font-weight: 550;">{workspace.name}</span>
                <span style="font-size: 12px; line-height: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--recent-muted); font-family: ui-monospace, Consolas, monospace;">{workspace.path}</span>
              </span>
              <span style="font-size: 12px; line-height: 16px; flex-shrink: 0; color: var(--recent-muted);">{workspace.count} prompts</span>
              <span style="font-size: 12px; line-height: 16px; flex-shrink: 0; width: 82px; text-align: right; color: var(--recent-muted);">{workspace.opened}</span>
              <ArrowUpRight size={16} style="flex-shrink: 0; margin-left: 8px; color: var(--recent-icon);" />
            </button>
          {/each}
        </div>
      </section>
    </div>
  </main>
</section>
