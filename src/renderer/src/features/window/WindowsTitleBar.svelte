<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { Download, FileText, Layers, LayoutGrid, Plus, X } from 'lucide-svelte'
  // Application artwork shown at the start of the title bar.
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { startPointerDrag } from '@renderer/common/drag-drop/pointerDrag'
  import Scrollbar from '@renderer/common/scrollbar/Scrollbar.svelte'
  import { WHEEL_SCROLL_MULTIPLIER } from '@renderer/common/scrollTimings'
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
    onMoveWorkTab,
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
    /** Moves a dragged work tab into the given display slot. */
    onMoveWorkTab: (tabId: string, index: number) => void
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
  /** Icon shown for each screen a work tab can be on. */
  const workTabIcons: Record<WorkTabScreen, ComponentType> = {
    'new-tab': LayoutGrid,
    'prompt-collection': FileText,
    'template-collection': Layers
  }
  /** Rotating hover message on the Test Screen button; it changes on each pointer entry. */
  let testScreenTooltip = $state<string>(INITIAL_TEST_SCREEN_TOOLTIP)
  /** Distance the pointer must move along either axis before a pressed tab starts dragging. */
  const tabDragThresholdPx = 4
  /** Stationary tab strip that owns pointer capture while its tabs reorder. */
  let tabStripElement = $state<HTMLElement>()
  /** Dragged work tab and its horizontal offset from its current slot, or null while no tab is dragged. */
  let draggedTab = $state<{ id: string; offsetX: number } | null>(null)
  /** Tab strip's horizontal scroll position, visible width, and content width, mirrored for its scrollbar. */
  let tabScroll = $state({ offsetPx: 0, viewportPx: 0, contentPx: 0 })
  /** Increments on each tab strip scroll so its scrollbar briefly shows. */
  let tabScrollRevealVersion = $state(0)
  /** Whether the pointer is over the tab strip, which shows its scrollbar. */
  let isTabStripHovered = $state(false)

  /** Copies the tab strip's scroll position and extents into state. */
  const syncTabScroll = (): void => {
    tabScroll = {
      offsetPx: tabStripElement!.scrollLeft,
      viewportPx: tabStripElement!.clientWidth,
      contentPx: tabStripElement!.scrollWidth
    }
  }

  /** Scrolls the tab strip sideways by vertical wheel input, at the rate the app's screens scroll. */
  const handleTabStripWheel = (event: WheelEvent): void => {
    tabStripElement!.scrollLeft += event.deltaY * WHEEL_SCROLL_MULTIPLIER
  }

  /** Selects a work tab on a left press, then drags it along the strip once the pointer moves far enough. */
  const handleTabPointerDown = (event: PointerEvent, tabId: string): void => {
    if (event.button !== 0) return
    onSelectWorkTab(tabId)
    /** Shared width of the touching tab slots. */
    const slotWidth = (event.currentTarget as HTMLElement).getBoundingClientRect().width
    /** Slot the tab occupies, updated as it snaps into new slots. */
    let index = workTabs.findIndex((tab: WorkTab) => tab.id === tabId)
    /** Tab's left edge relative to the first slot when pressed. */
    const startLeft = index * slotWidth
    /** Left edge of the last slot, which keeps the tab inside the strip. */
    const maxLeft = (workTabs.length - 1) * slotWidth
    const session = startPointerDrag({
      target: tabStripElement!,
      event,
      captureImmediately: false,
      onMove: (moveEvent) => {
        /** Horizontal pointer movement since the press; vertical movement only counts toward the threshold. */
        const deltaX = moveEvent.clientX - event.clientX
        if (!draggedTab) {
          if (Math.max(Math.abs(deltaX), Math.abs(moveEvent.clientY - event.clientY)) < tabDragThresholdPx) return
          session.capture()
        }
        /** Tab's left edge relative to the first slot, clamped to the strip. */
        const left = Math.min(Math.max(startLeft + deltaX, 0), maxLeft)
        /** Slot whose previous tab the dragged tab covers by at least half. */
        const nextIndex = Math.round(left / slotWidth)
        if (nextIndex !== index) {
          index = nextIndex
          onMoveWorkTab(tabId, index)
        }
        draggedTab = { id: tabId, offsetX: left - index * slotWidth }
      },
      onFinish: () => {
        draggedTab = null
      }
    })
  }

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
    // The tab row also holds the tab strip's scrollbar, which is not a button.
    if (target?.closest('button, .titlebar__tab-row')) {
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

  // Side effect: re-measure the tab strip's scroll extents when it resizes or its tab count changes; observing fires
  // the first measurement.
  $effect(() => {
    void workTabs.length
    const observer = new ResizeObserver(syncTabScroll)
    observer.observe(tabStripElement!)
    return () => observer.disconnect()
  })

  // Side effect: scroll the selected work tab fully into view whenever the selection changes, such as a new tab added
  // past the strip's right edge.
  $effect(() => {
    void selectedTabId
    tabStripElement!.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
  <div class="titlebar__tab-row">
    <!-- Hovering the tabs shows their scrollbar, and vertical wheel input scrolls them sideways. -->
    <div
      class="titlebar__tab-viewport"
      role="presentation"
      onmouseenter={() => { isTabStripHovered = true }}
      onmouseleave={() => { isTabStripHovered = false }}
      onwheel={handleTabStripWheel}
      onmousedown={(event) => {
        // Middle presses would start Chromium's autoscroll on the overflowing strip, which swallows the tab's
        // middle-click close; cancelling the press keeps the auxclick.
        if (event.button === 1) event.preventDefault()
      }}
    >
      <div
        bind:this={tabStripElement}
        class="titlebar__tabs"
        role="tablist"
        aria-label="Open tabs"
        onscroll={() => {
          syncTabScroll()
          tabScrollRevealVersion += 1
        }}
      >
        {#each workTabs as tab (tab.id)}
          {@const TabIcon = workTabIcons[tab.screen]}
          {@const selected = selectedTabId === tab.id}
          {@const dragging = draggedTab?.id === tab.id}
          <div
            class="titlebar__tab"
            data-selected={selected}
            data-dragging={dragging}
            data-testid="work-tab"
            style:transform={dragging ? `translateX(${draggedTab!.offsetX}px)` : undefined}
          >
            <!-- The tab button covers the whole pill so presses around the close button still select and drag the tab.
                 Mouse presses select on pointer down; the click keeps Enter and Space selection. -->
            <button
              type="button"
              class="titlebar__tab-select text-sm leading-5"
              role="tab"
              aria-selected={selected}
              onpointerdown={(event) => handleTabPointerDown(event, tab.id)}
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
      <Scrollbar
        orientation="horizontal"
        overlay
        scrollOffsetPx={tabScroll.offsetPx}
        viewportSizePx={tabScroll.viewportPx}
        contentSizePx={tabScroll.contentPx}
        thicknessPx={3}
        isHovered={isTabStripHovered}
        revealVersion={tabScrollRevealVersion}
        onScrollOffsetChange={(offsetPx) => {
          tabStripElement!.scrollLeft = offsetPx
        }}
      />
    </div>
    <button
      type="button"
      class="titlebar__new-tab"
      aria-label="New Tab"
      title="New Tab"
      data-testid="new-tab-button"
      onclick={onAddWorkTab}
    >
      <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>
  </div>
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

  /* Full-height row of touching screen buttons, so no drag region sits above, below, or between them. The row is one
     no-drag rectangle because Electron rounds each button's rectangle separately at fractional display scales, which
     can leave draggable 1px seams between them. The 1px side margins keep the outer pills 13px from the app icon and
     12px from the separator. */
  .titlebar__screens {
    display: flex;
    flex: none;
    align-self: stretch;
    margin: 0 1px;
    -webkit-app-region: no-drag;
  }

  .titlebar__screen {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    color: var(--ui-secondary-icon-glyph);
    -webkit-app-region: no-drag;
    cursor: default;
  }

  /* Hovered and selected screens reuse the prompt tree's row fills as an inset pill, 36px square and 4px from its neighbours. */
  .titlebar__screen::before {
    position: absolute;
    inset: 4px 2px;
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

  /* One no-drag rectangle across the tabs and the New Tab button, which leaves no draggable seams between them at
     fractional display scales. The right margin keeps at least a 40px drag gap before the window controls. */
  .titlebar__tab-row {
    display: flex;
    flex: 0 1 auto;
    align-self: stretch;
    min-width: 0;
    margin-right: 40px;
    -webkit-app-region: no-drag;
  }

  /* Anchors the overlay scrollbar along the bottom of the tabs. Its 1px negative margins let the outer tabs overlap
     their surroundings so the wider hit areas leave the outer pills in place; they sit here because the scrolling
     strip would clip them on its own tabs. */
  .titlebar__tab-viewport {
    position: relative;
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    margin: 0 -1px;
  }

  /* Full-height strip of touching tabs, so no drag region sits above, below, or between them. The opaque fill hides the background folder label.
     It scrolls sideways once its tabs reach their minimum width, with the native scrollbar replaced by the overlay one.
     The arrow cursor stays while the strip holds pointer capture during a tab drag. */
  .titlebar__tabs {
    display: flex;
    flex: 0 1 auto;
    align-self: stretch;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--app-chrome-surface);
    cursor: default;
  }

  /* Tabs shrink from 222px to 120px to fit the strip before it scrolls. */
  .titlebar__tab {
    position: relative;
    display: flex;
    flex: 0 1 222px;
    width: 222px;
    min-width: 120px;
    -webkit-app-region: no-drag;
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

  /* The dragged tab slides over its neighbours. */
  .titlebar__tab[data-dragging='true'] {
    z-index: 1;
  }

  /* The dragged tab keeps the selected hover fill, layered on the chrome surface so the tabs beneath stay hidden.
     It follows the selected hover rule so it wins that specificity tie whether or not the tab keeps :hover. */
  .titlebar__tab[data-selected='true'][data-dragging='true']::before {
    background: linear-gradient(var(--ui-neutral-selection-surface), var(--ui-neutral-selection-surface)),
      var(--app-chrome-surface);
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

  .titlebar__new-tab:is(:hover, :focus-visible) {
    color: var(--ui-normal-text);
  }

  .titlebar__new-tab:is(:hover, :focus-visible)::before {
    background: var(--ui-neutral-normal-surface);
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

  /* One no-drag rectangle across the window controls, which leaves no draggable seams between them at fractional display scales. */
  .titlebar__controls {
    display: flex;
    align-items: stretch;
    height: 100%;
    margin-left: auto;
    -webkit-app-region: no-drag;
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
