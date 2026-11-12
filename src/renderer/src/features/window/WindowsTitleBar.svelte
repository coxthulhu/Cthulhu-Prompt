<script lang="ts">
  import { Download } from 'lucide-svelte'
  // Application artwork shown at the start of the title bar.
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { getNextTestScreenTooltip, INITIAL_TEST_SCREEN_TOOLTIP } from './testScreenTooltip'

  let {
    activeScreen,
    isDevMode = false,
    isDevBuild = false,
    onNavigate,
    updatesOpen,
    updateAvailable,
    onToggleUpdates,
    updatesButton = $bindable()
  } = $props<{
    /** Screen highlighted among the title bar's screen buttons. */
    activeScreen: ScreenId
    /** Shows the development-only Mockups and Test Screen buttons. */
    isDevMode?: boolean
    /** Colors the updates button with the development indicator. */
    isDevBuild?: boolean
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
      {@const active = activeScreen === screenId}
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
  <div class="titlebar__controls">
    <button
      bind:this={updatesButton}
      type="button"
      class="titlebar__control titlebar__updates"
      data-dev-build={isDevBuild}
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
  .titlebar {
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

  .titlebar__screens {
    display: flex;
    flex: none;
    gap: 4px;
  }

  .titlebar__screen {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    color: var(--ui-secondary-icon-glyph);
    -webkit-app-region: no-drag;
    cursor: default;
  }

  /* Hovered and selected screens reuse the prompt tree's row fills as an inset pill. */
  .titlebar__screen::before {
    position: absolute;
    inset: 3px;
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

  .titlebar__controls {
    display: flex;
    align-items: stretch;
    height: 100%;
    margin-left: auto;
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

  /* Development builds keep the semantic indicator color in every state. */
  .titlebar__updates[data-dev-build='true'] {
    color: var(--ui-development-indicator-text);
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
