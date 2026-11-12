<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { Download, FileText, Layers, LayoutGrid, Plus, X } from 'lucide-svelte'
  // Application artwork shown at the start of the title bar.
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import type { WorkTab, WorkTabScreen } from '@shared/domain/user-persistence/UserPersistence'
  import { getNextTestScreenTooltip, INITIAL_TEST_SCREEN_TOOLTIP } from './testScreenTooltip'

  let {
    selectedTabId,
    workTabs,
    isDevMode = false,
    executionFolderName = null,
    onNavigate,
    onSelectWorkTab,
    onAddWorkTab,
    onCloseWorkTab,
    updatesOpen,
    updateAvailable,
    onToggleUpdates,
    updatesButton = $bindable()
  } = $props<{
    /** Highlighted screen button or work tab, or null while a project is shown. */
    selectedTabId: string | null
    /** Open work tabs in display order. */
    workTabs: WorkTab[]
    /** Selects a work tab. */
    onSelectWorkTab: (tabId: string) => void
    /** Appends and selects a new work tab. */
    onAddWorkTab: () => void
    /** Closes a work tab from its close button or a middle click. */
    onCloseWorkTab: (tabId: string) => void
    /** Shows the development-only Mockups and Test Screen buttons. */
    isDevMode?: boolean
    /** Folder the app was launched from, shown behind the tabs in development mode. */
    executionFolderName?: string | null
    /** Changes the screen when one of the screen buttons is pressed. */
    onNavigate: (screen: ScreenId) => void
    /** Reflects the updater popup independently of screen navigation. */
    updatesOpen: boolean
    /** Shows a notification dot while a newer public release exists. */
    updateAvailable: boolean
    /** Toggles the shell-owned updater surface. */
    onToggleUpdates: () => void
    /** Bound updater toggle, which anchors the shell-owned popup. */
    updatesButton?: HTMLButtonElement
  }>()

  const windowControls = window.windowControls
  let isMaximized = $state(false)
  /** Screen buttons in title bar order. */
  const titleBarScreenIds: ScreenId[] = ['home', 'settings', 'mockups', 'test-screen']
  /** Screen buttons available in this build. */
  const visibleScreenIds = $derived(
    titleBarScreenIds.filter((screenId) => isDevMode || !screens[screenId].devOnly)
  )
  /** Most work tabs open at once; the New Tab button is disabled at this count. */
  const maxWorkTabs = 6
  /** Icon shown for each screen a work tab can be on. */
  const workTabIcons: Record<WorkTabScreen, ComponentType> = {
    'new-tab': LayoutGrid,
    'prompt-collection': FileText,
    'template-collection': Layers
  }
  /** Rotating hover message on the Test Screen button; it changes on each pointer entry. */
  let testScreenTooltip = $state<string>(INITIAL_TEST_SCREEN_TOOLTIP)

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
    // Keys pressed on the title bar's own buttons activate those buttons instead.
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
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
  <!-- Rendered first because Electron applies drag regions in document order: the later no-drag buttons
       must override the drag region this label inherits, or the label would swallow their clicks. -->
  {#if isDevMode && executionFolderName}
    <div class="titlebar__execution-folder text-sm leading-5" data-testid="execution-folder-name">
      {executionFolderName}
    </div>
  {/if}
  <!-- The application icon stays part of the window drag region. -->
  <img
    class="titlebar__app-icon"
    src={appIcon}
    alt="Cthulhu Prompt icon"
    draggable="false"
    ondragstart={(event) => event.preventDefault()}
  />
  <nav class="titlebar__screens" aria-label="Screens">
    {#each visibleScreenIds as screenId (screenId)}
      {@const config = screens[screenId]}
      {@const ScreenIcon = config.icon!}
      {@const active = selectedTabId === screenId}
      <button
        type="button"
        class="titlebar__screen"
        aria-label={config.label}
        aria-current={active ? 'page' : undefined}
        data-active={active ? 'true' : 'false'}
        data-testid={config.testId}
        title={screenId === 'test-screen' ? testScreenTooltip : config.label}
        onmouseenter={screenId === 'test-screen'
          ? () => { testScreenTooltip = getNextTestScreenTooltip(testScreenTooltip) }
          : undefined}
        onclick={() => onNavigate(screenId)}
      >
        <ScreenIcon size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
    {/each}
  </nav>
  <div class="titlebar__separator" aria-hidden="true"></div>
  <div class="titlebar__tabs" role="tablist" aria-label="Open tabs">
    {#each workTabs as tab (tab.id)}
      {@const TabIcon = workTabIcons[tab.screen]}
      {@const selected = selectedTabId === tab.id}
      <div class="titlebar__tab" data-selected={selected} data-testid="work-tab">
        <!-- The tab button covers the whole pill so clicks around the close button still select the tab. -->
        <button
          type="button"
          class="titlebar__tab-select text-sm leading-5"
          role="tab"
          aria-selected={selected}
          onclick={() => onSelectWorkTab(tab.id)}
          onauxclick={(event) => {
            if (event.button === 1) onCloseWorkTab(tab.id)
          }}
        >
          <TabIcon size={16} aria-hidden="true" />
          <span class="titlebar__tab-title">{tab.title}</span>
        </button>
        <button
          type="button"
          class="titlebar__tab-close"
          aria-label={`Close ${tab.title}`}
          title="Close Tab"
          data-testid="work-tab-close"
          onclick={() => onCloseWorkTab(tab.id)}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    {/each}
  </div>
  <button
    type="button"
    class="titlebar__new-tab"
    aria-label="New Tab"
    title="New Tab"
    data-testid="new-tab-button"
    disabled={workTabs.length >= maxWorkTabs}
    onclick={onAddWorkTab}
  >
    <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
  </button>
  <div class="titlebar__controls">
    <button
      bind:this={updatesButton}
      type="button"
      class="titlebar__control titlebar__updates"
      aria-label={updateAvailable ? 'App updates — update available' : 'App updates'}
      aria-expanded={updatesOpen}
      title="App updates"
      data-testid="app-updates-button"
      onclick={onToggleUpdates}
    >
      <Download size={20} strokeWidth={1.5} aria-hidden="true" />
      {#if updateAvailable}<span class="titlebar__update-dot" data-testid="update-available-dot"></span>{/if}
    </button>
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
  /* Isolation keeps the background folder label above the title bar fill but beneath every control. */
  .titlebar {
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    background: var(--app-chrome-surface);
    height: var(--titlebar-height);
    min-height: var(--titlebar-height);
    -webkit-app-region: drag;
    user-select: none;
  }

  .titlebar__app-icon {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 0 10px 0 12px;
    object-fit: contain;
  }

  /* Full-height row of touching screen buttons, so no drag region sits above, below, or between them. */
  .titlebar__screens {
    display: flex;
    flex: none;
    align-self: stretch;
  }

  .titlebar__screen {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    color: var(--ui-secondary-icon-glyph);
    -webkit-app-region: no-drag;
    cursor: default;
  }

  /* The outer buttons overlap their surroundings by 2px so the wider hit areas leave the outer pills in place. */
  .titlebar__screen:first-child {
    margin-left: -2px;
  }

  .titlebar__screen:last-child {
    margin-right: -2px;
  }

  /* Hovered and selected screens reuse the prompt tree's row fills as an inset pill, 36px square and 10px from its neighbours. */
  .titlebar__screen::before {
    position: absolute;
    inset: 4px 5px;
    border-radius: var(--cthulhu-ui-radius-control);
    content: '';
  }

  .titlebar__screen :global(svg) {
    position: relative;
  }

  .titlebar__screen:is(:hover, :focus-visible, [data-active='true']) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .titlebar__screen:is(:hover, :focus-visible)::before {
    background: var(--ui-neutral-normal-surface);
  }

  .titlebar__screen[data-active='true']::before {
    background: var(--ui-neutral-emphasis-surface);
  }

  .titlebar__screen[data-active='true']:hover::before {
    background: var(--ui-neutral-selection-surface);
  }

  .titlebar__separator {
    flex: none;
    width: 1px;
    height: 18px;
    margin: 0 9px;
    background: var(--ui-neutral-normal-border);
  }

  /* Full-height strip of touching tabs, so no drag region sits above, below, or between them. The opaque fill hides the background folder label. */
  .titlebar__tabs {
    display: flex;
    flex: 0 1 auto;
    align-self: stretch;
    min-width: 0;
    background: var(--app-chrome-surface);
  }

  .titlebar__tab {
    position: relative;
    display: flex;
    flex: 0 1 222px;
    width: 222px;
    min-width: 0;
    -webkit-app-region: no-drag;
  }

  /* The outer tabs overlap their surroundings by 1px so the wider hit areas leave the outer pills in place. */
  .titlebar__tab:first-child {
    margin-left: -1px;
  }

  .titlebar__tab:last-child {
    margin-right: -1px;
  }

  /* Insets keep each pill 36px tall in the 44px title bar and 4px from its neighbours across the touching hit areas. */
  .titlebar__tab::before {
    position: absolute;
    inset: 4px 2px;
    border-radius: var(--cthulhu-ui-radius-control);
    content: '';
  }

  .titlebar__tab:is(:hover, :focus-within)::before {
    background: var(--ui-neutral-normal-surface);
  }

  .titlebar__tab[data-selected='true']::before {
    background: var(--ui-neutral-emphasis-surface);
  }

  .titlebar__tab[data-selected='true']:hover::before {
    background: var(--ui-neutral-selection-surface);
  }

  /* The right padding reserves the close button's slot inside the full-pill tab button. */
  .titlebar__tab-select {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 34px 0 13px;
    text-align: left;
    color: var(--ui-hoverable-text);
    cursor: default;
  }

  .titlebar__tab-select :global(svg) {
    flex: none;
    color: var(--ui-secondary-icon-glyph);
  }

  .titlebar__tab:is(:hover, :focus-within, [data-selected='true']) .titlebar__tab-select {
    color: var(--ui-normal-text);
  }

  .titlebar__tab:is(:hover, :focus-within, [data-selected='true']) .titlebar__tab-select :global(svg) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .titlebar__tab-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .titlebar__tab-close {
    position: relative;
    display: flex;
    flex: none;
    align-self: center;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin: 0 8px 0 auto;
    border-radius: 4px;
    color: var(--ui-secondary-icon-glyph);
    cursor: default;
  }

  .titlebar__tab-close:is(:hover, :focus-visible) {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-normal-text);
  }

  /* Full-height hit area touching the last tab; its pill sits 4px from the last tab pill, like the gap between tabs. The opaque fill hides the background folder label. */
  .titlebar__new-tab {
    position: relative;
    display: flex;
    flex: none;
    align-self: stretch;
    align-items: center;
    justify-content: center;
    width: 42px;
    background: var(--app-chrome-surface);
    color: var(--ui-secondary-icon-glyph);
    -webkit-app-region: no-drag;
    cursor: default;
  }

  /* The hover pill matches the tab pills' 36px visible height. */
  .titlebar__new-tab::before {
    position: absolute;
    inset: 4px 3px;
    border-radius: var(--cthulhu-ui-radius-control);
    content: '';
  }

  .titlebar__new-tab :global(svg) {
    position: relative;
  }

  .titlebar__new-tab:is(:hover, :focus-visible):not(:disabled) {
    color: var(--ui-normal-text);
  }

  .titlebar__new-tab:is(:hover, :focus-visible):not(:disabled)::before {
    background: var(--ui-neutral-normal-surface);
  }

  /* Matches the shared disabled button appearance once the tab limit is reached; only the glyph fades so the opaque fill still hides the folder label. */
  .titlebar__new-tab:disabled :global(svg) {
    opacity: 0.5;
  }

  /* Background label 8px left of the updates button and three window controls; the opaque tab strip and New Tab button hide it when they reach it. */
  .titlebar__execution-folder {
    position: absolute;
    top: 50%;
    right: calc(var(--titlebar-button-width) * 4 + 8px);
    z-index: -1;
    transform: translateY(-50%);
    color: var(--ui-development-indicator-text);
    white-space: nowrap;
    pointer-events: none;
  }

  /* The left padding keeps at least the mockup's 24px drag gap after the New Tab button. */
  .titlebar__controls {
    display: flex;
    align-items: stretch;
    height: 100%;
    margin-left: auto;
    padding-left: 24px;
  }

  .titlebar__control {
    width: var(--titlebar-button-width);
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: no-drag;
    cursor: default;
  }

  .titlebar__control:hover {
    background: var(--ui-neutral-action-fill);
  }

  .titlebar__control:active {
    background: var(--ui-neutral-action-hover-fill);
  }

  .titlebar__control--close:hover {
    background: #e81123;
    color: #ffffff;
  }

  .titlebar__control--close:active {
    background: #f1707a;
  }

  .titlebar__updates {
    position: relative;
    color: var(--ui-secondary-icon-glyph);
  }

  .titlebar__updates:is(:hover, :focus-visible, [aria-expanded='true']) {
    color: var(--ui-normal-text);
  }

  .titlebar__update-dot {
    position: absolute;
    right: 9px;
    top: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ui-success-normal-text);
    border: 2px solid var(--app-chrome-surface);
    box-sizing: content-box;
  }

  /* Windows glyph metrics are explicitly excluded to preserve native control rendering. */
  .titlebar__icon {
    font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif;
    font-size: 10px;
    line-height: 10px;
  }
</style>
