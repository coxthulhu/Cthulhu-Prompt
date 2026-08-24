<script lang="ts">
  import { PanelLeftClose, PanelLeftOpen } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  // Application artwork shared with the sidebar accent icon.
  import appIcon from '@renderer/assets/cutethulhu.png'

  let { title, isDevBuild = false, isAppSidebarExpanded, onAppSidebarToggle } = $props<{
    title: string
    isDevBuild?: boolean
    /** Whether the resizable application sidebar is currently visible. */
    isAppSidebarExpanded: boolean
    /** Toggles the resizable application sidebar without affecting the activity bar. */
    onAppSidebarToggle: () => void
  }>()

  const windowControls = window.windowControls
  let isMaximized = $state(false)

  const handleMinimize = () => {
    void windowControls.minimize()
  }

  const handleToggleMaximize = () => {
    void windowControls.toggleMaximize()
  }

  const handleClose = () => {
    void windowControls.close()
  }

  const handleDoubleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) {
      return
    }
    void windowControls.toggleMaximize()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.preventDefault()
    void windowControls.toggleMaximize()
  }

  // Side effect: sync maximize state with the main process and keep it updated.
  $effect(() => {
    let isActive = true
    windowControls.isMaximized().then((value) => {
      if (isActive) {
        isMaximized = value
      }
    })
    const unsubscribe = windowControls.onMaximizeChange((value) => {
      isMaximized = value
    })
    return () => {
      isActive = false
      unsubscribe()
    }
  })
</script>

<div
  class="titlebar text-foreground"
  role="button"
  tabindex="0"
  aria-label="Toggle maximize"
  ondblclick={handleDoubleClick}
  onkeydown={handleKeyDown}
>
  <!-- Keep the title centered by matching the left action width to the control cluster. -->
  <div class="titlebar__actions">
    <!-- The application icon fills the title-bar space directly above the activity bar. -->
    <img
      class="titlebar__app-icon"
      src={appIcon}
      alt="Cthulhu Prompt icon"
      draggable="false"
      ondragstart={(event) => event.preventDefault()}
    />
    <IconButton
      icon={isAppSidebarExpanded ? PanelLeftClose : PanelLeftOpen}
      label={isAppSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      title={isAppSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      size="compact"
      iconSize={18}
      borderless
      ariaExpanded={isAppSidebarExpanded}
      testId="app-sidebar-toggle-button"
      iconTestId={isAppSidebarExpanded ? 'app-sidebar-close-icon' : 'app-sidebar-open-icon'}
      class="titlebar__sidebar-toggle"
      onclick={onAppSidebarToggle}
    />
  </div>
  <div class="titlebar__title" data-dev-build={isDevBuild} {title}>{title}</div>
  <div class="titlebar__controls">
    <button
      type="button"
      class="titlebar__control"
      data-window-control="minimize"
      aria-label="Minimize window"
      onclick={handleMinimize}
    >
      <span class="titlebar__icon" aria-hidden="true">&#xE921;</span>
    </button>
    <button
      type="button"
      class="titlebar__control"
      data-window-control="maximize"
      aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      onclick={handleToggleMaximize}
    >
      <span class="titlebar__icon" aria-hidden="true">
        {#if isMaximized}
          &#xE923;
        {:else}
          &#xE922;
        {/if}
      </span>
    </button>
    <button
      type="button"
      class="titlebar__control titlebar__control--close"
      data-window-control="close"
      aria-label="Close window"
      onclick={handleClose}
    >
      <span class="titlebar__icon" aria-hidden="true">&#xE8BB;</span>
    </button>
  </div>
</div>

<style>
  .titlebar {
    display: grid;
    grid-template-columns: var(--titlebar-controls-width) 1fr var(--titlebar-controls-width);
    align-items: center;
    background: var(--app-chrome-surface);
    height: var(--titlebar-height);
    min-height: var(--titlebar-height);
    -webkit-app-region: drag;
    user-select: none;
  }

  .titlebar__actions {
    width: var(--titlebar-controls-width);
    height: 100%;
    display: flex;
    align-items: center;
  }

  .titlebar__app-icon {
    width: 16px;
    height: 16px;
    margin: 0 22px 0 10px;
    object-fit: contain;
  }

  .titlebar__actions :global(.titlebar__sidebar-toggle) {
    -webkit-app-region: no-drag;
    color: var(--ui-muted-icon-glyph);
  }

  .titlebar__actions :global(.titlebar__sidebar-toggle:hover),
  .titlebar__actions :global(.titlebar__sidebar-toggle:focus-visible) {
    color: var(--ui-normal-text);
  }

  .titlebar__title {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    line-height: var(--titlebar-height);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 12px;
  }

  .titlebar__title[data-dev-build='true'] {
    color: var(--ui-development-indicator-text);
  }

  .titlebar__controls {
    display: flex;
    justify-content: flex-end;
    align-items: stretch;
    height: 100%;
  }

  .titlebar__control {
    width: var(--titlebar-button-width);
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: inherit;
    border: none;
    padding: 0;
    -webkit-app-region: no-drag;
    cursor: default;
  }

  .titlebar__control:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .titlebar__control:active {
    background: rgba(255, 255, 255, 0.16);
  }

  .titlebar__control--close:hover {
    background: #e81123;
    color: #ffffff;
  }

  .titlebar__control--close:active {
    background: #f1707a;
    color: #ffffff;
  }

  .titlebar__icon {
    font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif;
    font-size: 10px;
    line-height: 1;
  }
</style>
