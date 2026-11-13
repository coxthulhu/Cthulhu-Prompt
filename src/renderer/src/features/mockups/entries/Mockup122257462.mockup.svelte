<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    ArrowLeft,
    Bug,
    Download,
    FileText,
    GripVertical,
    Home,
    Layers,
    LayoutGrid,
    Move,
    PanelsTopLeft,
    Pencil,
    Plus,
    Search,
    Settings,
    X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import ResizeSash from '@renderer/common/cthulhu-ui/layout/ResizeSash.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/layout/SeparatorDot.svelte'

  type WorkTabScreen = 'new-tab' | 'prompt-collection' | 'template-collection'

  type ScreenTab = {
    id: string
    label: string
    icon: ComponentType
    screenLabel: string
  }

  type WorkTab = {
    id: string
    title: string
    screen: WorkTabScreen
    project: string | null
  }

  type CollectionTile = {
    id: string
    name: string
    kind: 'prompt' | 'template'
    count: number
    /** Relative time since the collection was last updated, in the live Show All dropdown's wording. */
    updated: string
  }

  type ProjectGroup = {
    id: string
    name: string
    collections: CollectionTile[]
  }

  const projects: ProjectGroup[] = [
    {
      id: 'atlas-web',
      name: 'Atlas Web',
      collections: [
        { id: 'bug-triage', name: 'Bug Triage', kind: 'prompt', count: 14, updated: 'Today' },
        { id: 'feature-work', name: 'Feature Work', kind: 'prompt', count: 9, updated: 'Today' },
        { id: 'code-review', name: 'Code Review', kind: 'template', count: 6, updated: 'Yesterday' },
        { id: 'ui-polish', name: 'UI Polish', kind: 'prompt', count: 21, updated: 'Today' },
        { id: 'refactors', name: 'Refactors', kind: 'prompt', count: 7, updated: '2 weeks ago' }
      ]
    },
    {
      id: 'harbor-api',
      name: 'Harbor API',
      collections: [
        { id: 'schema-migrations', name: 'Schema Migrations', kind: 'prompt', count: 11, updated: 'Today' },
        { id: 'endpoint-tests', name: 'Endpoint Tests', kind: 'prompt', count: 18, updated: '2 days ago' },
        { id: 'release-notes', name: 'Release Notes', kind: 'template', count: 4, updated: '5 days ago' }
      ]
    },
    {
      id: 'lantern-mobile',
      name: 'Lantern Mobile',
      collections: [
        { id: 'onboarding-flow', name: 'Onboarding Flow', kind: 'prompt', count: 5, updated: '6 days ago' },
        { id: 'store-listing', name: 'Store Listing', kind: 'template', count: 1, updated: '3 weeks ago' }
      ]
    }
  ]

  let searchQuery = $state('')
  let isSearchFocused = $state(false)

  /** Icon shown for each screen a work tab can be on, matching the live title bar. */
  const workTabIcons: Record<WorkTabScreen, ComponentType> = {
    'new-tab': LayoutGrid,
    'prompt-collection': FileText,
    'template-collection': Layers
  }

  const screenTabs: ScreenTab[] = [
    { id: 'home', label: 'Home', icon: Home, screenLabel: 'Home Screen' },
    { id: 'settings', label: 'System Settings', icon: Settings, screenLabel: 'Settings' },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft, screenLabel: 'Mockups' },
    { id: 'test-screen', label: 'Test Screen', icon: Bug, screenLabel: 'Test Screen' }
  ]

  /** Most work tabs open at once; the New Tab button is disabled at this count. */
  const maxWorkTabs = 6

  let workTabs = $state<WorkTab[]>([
    { id: 'bug-triage', title: 'Bug Triage', screen: 'prompt-collection', project: 'Atlas Web' },
    { id: 'code-review', title: 'Code Review', screen: 'template-collection', project: 'Atlas Web' },
    { id: 'schema-migrations', title: 'Schema Migrations', screen: 'prompt-collection', project: 'Harbor API' },
    { id: 'release-notes', title: 'Release Notes', screen: 'template-collection', project: 'Harbor API' },
    { id: 'new-tab', title: 'New Tab', screen: 'new-tab', project: null }
  ])
  /** Suffix that keeps the ids of tabs added from the New Tab button unique. */
  let addedTabCount = 0

  let activeTabId = $state('new-tab')
  const activeScreenTab = $derived(screenTabs.find((tab) => tab.id === activeTabId))
  const activeWorkTab = $derived(workTabs.find((tab) => tab.id === activeTabId))
  /** Project tabs and System Settings show a sidebar; every other tab fills the body. */
  const hasSidebar = $derived(activeScreenTab?.id === 'settings' || Boolean(activeWorkTab?.project))
  /** Collections shown in other work tabs, keyed by project and collection name, receive the open indicator. */
  const openCollectionKeys = $derived(
    workTabs.filter((tab) => tab.project && tab.id !== activeTabId).map((tab) => `${tab.project}/${tab.title}`)
  )

  /** Appends a New Tab work tab and selects it. */
  const addWorkTab = () => {
    addedTabCount += 1
    const tab: WorkTab = { id: `added-tab-${addedTabCount}`, title: 'New Tab', screen: 'new-tab', project: null }
    workTabs = [...workTabs, tab]
    activeTabId = tab.id
  }

  /** Closes a work tab; closing the selected tab selects its right neighbour, else its left, else Home. */
  const closeWorkTab = (tabId: string) => {
    const wasSelected = activeTabId === tabId
    const index = workTabs.findIndex((tab) => tab.id === tabId)
    workTabs = workTabs.filter((tab) => tab.id !== tabId)
    if (wasSelected) activeTabId = (workTabs[index] ?? workTabs[index - 1])?.id ?? 'home'
  }

  /** Sidebar width follows the live app's 240–400px resize range so every separator position can be checked. */
  let sidebarWidth = $state(280)
  let isResizingSidebar = $state(false)

  const startSidebarResize = (event: PointerEvent) => {
    const sash = event.currentTarget as HTMLElement
    const startX = event.clientX
    const startWidth = sidebarWidth
    const resize = (moveEvent: PointerEvent) => {
      sidebarWidth = Math.min(400, Math.max(240, startWidth + moveEvent.clientX - startX))
    }
    const stop = () => {
      isResizingSidebar = false
      sash.removeEventListener('pointermove', resize)
      sash.removeEventListener('pointerup', stop)
      sash.removeEventListener('pointercancel', stop)
    }
    event.preventDefault()
    sash.setPointerCapture(event.pointerId)
    isResizingSidebar = true
    sash.addEventListener('pointermove', resize)
    sash.addEventListener('pointerup', stop)
    sash.addEventListener('pointercancel', stop)
  }

  /** Inline styles cannot express :hover, so hovered sidebar elements are tracked by id. */
  const hovered = new SvelteSet<string>()
  const hover = (id: string) => ({
    onpointerenter: () => hovered.add(id),
    onpointerleave: () => hovered.delete(id)
  })

  const ghostFill = (id: string) =>
    hovered.has(id) ? 'var(--ui-neutral-normal-surface)' : 'var(--ui-ghost-surface)'
  const ghostGlyph = (id: string) =>
    hovered.has(id) ? 'var(--ui-hoverable-icon-glyph)' : 'var(--ui-muted-icon-glyph)'
  const ghostText = (id: string) =>
    hovered.has(id) ? 'var(--ui-hoverable-text)' : 'var(--ui-secondary-text)'

  const truncate = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
</script>

<!-- The title bar mirrors the live WindowsTitleBar: full-height touching hit areas with inset neutral pills. -->
<div
  style="display: flex; flex-direction: column; height: 100%; min-height: 640px; color: var(--ui-normal-text); font-family: var(--font-sans);"
>
  <header class="titlebar">
    <img class="titlebar__app-icon" src={appIcon} alt="Cthulhu Prompt icon" draggable="false" />

    <nav class="titlebar__screens" aria-label="Screens">
      {#each screenTabs as tab (tab.id)}
        {@const active = activeTabId === tab.id}
        {@const TabIcon = tab.icon}
        <button
          type="button"
          class="titlebar__screen"
          aria-label={tab.label}
          aria-current={active ? 'page' : undefined}
          data-active={active ? 'true' : 'false'}
          title={tab.label}
          onclick={() => {
            activeTabId = tab.id
          }}
        >
          <TabIcon size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      {/each}
    </nav>

    <div class="titlebar__separator" aria-hidden="true"></div>

    <div class="titlebar__tabs" role="tablist" aria-label="Open tabs">
      {#each workTabs as tab (tab.id)}
        {@const TabIcon = workTabIcons[tab.screen]}
        {@const selected = activeTabId === tab.id}
        <div class="titlebar__tab" data-selected={selected}>
          <!-- The tab button covers the whole pill so clicks around the close button still select the tab. -->
          <button
            type="button"
            class="titlebar__tab-select text-sm leading-5"
            role="tab"
            aria-selected={selected}
            onclick={() => {
              activeTabId = tab.id
            }}
            onauxclick={(event) => {
              if (event.button === 1) closeWorkTab(tab.id)
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
            onclick={() => closeWorkTab(tab.id)}
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
      disabled={workTabs.length >= maxWorkTabs}
      onclick={addWorkTab}
    >
      <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>

    <div class="titlebar__controls">
      <button
        type="button"
        class="titlebar__control titlebar__updates"
        aria-label="App updates — update available"
        title="App updates"
      >
        <Download size={20} strokeWidth={1.5} aria-hidden="true" />
        <span class="titlebar__update-dot"></span>
      </button>
      <button type="button" class="titlebar__control" aria-label="Minimize window">
        <span class="titlebar__icon" aria-hidden="true">&#xE921;</span>
      </button>
      <button type="button" class="titlebar__control" aria-label="Restore window">
        <span class="titlebar__icon" aria-hidden="true">&#xE923;</span>
      </button>
      <button type="button" class="titlebar__control titlebar__control--close" aria-label="Close window">
        <span class="titlebar__icon" aria-hidden="true">&#xE8BB;</span>
      </button>
    </div>
  </header>

  <!-- The live title bar has no bottom border; the sidebar and screen below it each draw the top line. -->
  <div
    style="display: flex; flex: 1; min-height: 0; background: var(--background); border-top: 1px solid var(--ui-neutral-hover-border);"
  >
    {#if hasSidebar}
      <!-- Live app surfaces: chrome-colored sidebar, darker content, and a T-junction where the borders meet. -->
      <aside
        style="position: relative; display: flex; flex: 0 0 {sidebarWidth}px; flex-direction: column; min-height: 0; background: var(--ui-chrome-normal-surface); border-right: 1px solid var(--ui-neutral-hover-border); user-select: none;"
      >
        <div style="display: flex; flex: 0 0 auto; align-items: center; gap: 6px; min-height: 40px; padding: 0 6px 0 10px;">
          <div
            class="text-sm leading-4.5"
            style="display: flex; flex: 1; align-items: center; gap: 4px; min-width: 0; font-weight: var(--font-weight-semibold);"
          >
            <h2 style="{truncate} color: var(--ui-secondary-text);">{activeWorkTab?.project ?? 'System Settings'}</h2>
            {#if activeWorkTab?.project}
              <IconButton
                icon={Pencil}
                label="Project Settings"
                title="Project Settings"
                size="tiny"
                baseVariant="muted"
                hoverVariant="glyph"
                textBaseline
              />
            {/if}
          </div>
          {#if activeWorkTab?.project}
            <button
              type="button"
              class="text-xs leading-4"
              aria-label="Return to New Tab"
              title="Return to New Tab"
              {...hover('return-new-tab')}
              style="display: flex; flex: 0 0 auto; align-items: center; gap: 4px; height: 26px; padding: 0 8px 0 6px; border-radius: 6px; background: {ghostFill('return-new-tab')}; color: {ghostText('return-new-tab')};"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              New Tab
            </button>
          {/if}
        </div>
        {#if activeWorkTab?.project}
          <div
            class="text-xs leading-4"
            style="display: flex; flex: 0 0 36px; align-items: center; justify-content: center; border-top: 1px solid var(--ui-neutral-muted-border); border-bottom: 1px solid var(--ui-neutral-muted-border); color: var(--ui-muted-text);"
          >
            Prompt Tree Button Bar
          </div>
        {/if}
        <div
          class="text-sm leading-5"
          style="display: flex; flex: 1; align-items: center; justify-content: center; min-height: 0; color: var(--ui-muted-text);"
        >
          {activeWorkTab?.project ? 'Prompt Tree' : 'Settings Tree'}
        </div>
        <ResizeSash
          orientation="vertical"
          label="Resize sidebar"
          isDragging={isResizingSidebar}
          tabindex={-1}
          onpointerdown={startSidebarResize}
        />
      </aside>
    {/if}

    {#if activeWorkTab?.screen === 'new-tab'}
      <!-- Auto margins center the content vertically and fall back to top alignment once it overflows. -->
      <div style="display: flex; flex: 1; flex-direction: column; min-width: 0; overflow-y: auto;">
        <div
          style="display: flex; flex-direction: column; width: 100%; max-width: 880px; margin: auto; padding: 32px 24px; box-sizing: border-box;"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <label
              {...hover('new-tab-search')}
              style="display: flex; flex: 1; align-items: center; gap: 8px; min-width: 0; height: 36px; padding: 0 12px; border-radius: 6px; border: 1px solid {isSearchFocused
                ? 'var(--ui-neutral-focus-border)'
                : hovered.has('new-tab-search')
                  ? 'var(--ui-neutral-hover-border)'
                  : 'var(--ui-neutral-normal-border)'}; background: var(--ui-neutral-field-surface); color: {isSearchFocused
                ? 'var(--ui-hoverable-icon-glyph)'
                : 'var(--ui-muted-icon-glyph)'}; cursor: text;"
            >
              <Search size={16} aria-hidden="true" style="flex: none;" />
              <input
                type="text"
                class="text-sm leading-5"
                aria-label="Search projects and collections"
                placeholder="Search projects and collections"
                spellcheck="false"
                bind:value={searchQuery}
                onfocus={() => (isSearchFocused = true)}
                onblur={() => (isSearchFocused = false)}
                style="flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ui-normal-text);"
              />
            </label>
            <button
              type="button"
              class="text-sm leading-5"
              {...hover('new-project')}
              style="display: flex; flex: none; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 10px; border-radius: 6px; border: 1px solid {hovered.has('new-project')
                ? 'var(--ui-accent-muted-hover-border)'
                : 'var(--ui-accent-muted-border)'}; background: {hovered.has('new-project')
                ? 'var(--ui-accent-action-hover-fill)'
                : 'var(--ui-accent-action-fill)'}; color: var(--ui-normal-text); font-weight: var(--font-weight-semibold);"
            >
              <Plus size={16} aria-hidden="true" />
              New Project
            </button>
          </div>

          <p
            class="text-xs leading-4"
            style="display: flex; align-items: center; gap: 4px; margin-top: 10px; padding-left: 4px; color: var(--ui-muted-text);"
          >
            <Move size={14} aria-hidden="true" style="flex: none; color: var(--ui-muted-icon-glyph);" />
            Drag to reorder projects and collections
          </p>

          {#each projects as project (project.id)}
            <section aria-label={project.name} style="margin-top: 22px;">
              <div
                class="text-xl leading-7"
                style="display: flex; align-items: center; gap: 4px; height: 40px; margin-bottom: 8px;"
              >
                <!-- The 2px top margin lowers the centered grip 1px onto the baseline-aligned title's capitals. -->
                <button
                  type="button"
                  aria-label={`Reorder ${project.name}`}
                  title="Drag to reorder"
                  {...hover(`project-grip-${project.id}`)}
                  style="display: flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 32px; margin: 2px 0 0 -8px; border-radius: 4px; background: {ghostFill(
                    `project-grip-${project.id}`
                  )}; color: {ghostGlyph(`project-grip-${project.id}`)}; cursor: grab;"
                >
                  <GripVertical size={20} aria-hidden="true" />
                </button>
                <!-- Baseline alignment puts the edit button's text line on the project name's baseline, like the category editor title. -->
                <div style="display: flex; align-items: baseline; gap: 2px; min-width: 0;">
                  <h2 style="{truncate} color: var(--ui-hoverable-text); font-weight: var(--font-weight-semibold);">
                    {project.name}
                  </h2>
                  <!-- The 28px compact button matches the title's 28px line, and the 18px icon scales with the 20px title. -->
                  <IconButton
                    icon={Pencil}
                    label="Project Settings"
                    title="Project Settings"
                    size="compact"
                    iconSize={18}
                    baseVariant="muted"
                    hoverVariant="glyph"
                    textBaseline
                  />
                </div>
                <Button icon={Plus} text="New Collection" appearance="outline" style="margin-left: auto;" />
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">
                {#each project.collections as collection (collection.id)}
                  {@const tileId = `tile-${project.id}-${collection.id}`}
                  {@const isTileHovered = hovered.has(tileId)}
                  {@const isOpen = openCollectionKeys.includes(`${project.name}/${collection.name}`)}
                  {@const KindIcon = collection.kind === 'template' ? Layers : FileText}
                  {@const countText = `${collection.count} ${collection.kind}${collection.count === 1 ? '' : 's'}`}
                  <!-- Geometry and type copy the Show All dropdown's SelectorButton rows (58px, 1px border, 8px padding,
                       34px icon cell, 8px gap, title over dot-separated details) while keeping this mockup's tile colors. -->
                  <button
                    type="button"
                    {...hover(tileId)}
                    style="display: grid; grid-template-columns: 34px 8px minmax(0, 1fr) auto; align-items: center; min-width: 0; height: 58px; padding: 8px; border-radius: var(--cthulhu-ui-radius-card); border: 1px solid {isTileHovered
                      ? 'var(--ui-neutral-hover-border)'
                      : 'var(--ui-neutral-muted-border)'}; background: {isTileHovered
                      ? 'var(--ui-neutral-action-fill)'
                      : 'var(--ui-neutral-normal-surface)'}; text-align: left; cursor: pointer;"
                  >
                    <IconCell
                      icon={KindIcon}
                      variant="compact"
                      style="grid-column: 1; color: {isTileHovered
                        ? 'var(--ui-hoverable-icon-glyph)'
                        : 'var(--ui-secondary-icon-glyph)'};"
                    />
                    <span style="display: flex; grid-column: 3; flex-direction: column; gap: 2px; min-width: 0;">
                      <span
                        class="text-sm leading-5"
                        style="{truncate} color: {isTileHovered
                          ? 'var(--ui-normal-text)'
                          : 'var(--ui-hoverable-text)'}; font-weight: var(--font-weight-semibold);"
                      >
                        {collection.name}
                      </span>
                      <span
                        class="text-xs leading-4.5"
                        title={`${countText} · ${collection.updated}`}
                        style="display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; color: var(--ui-muted-text);"
                      >
                        <span class="min-w-0 truncate">{countText}</span>
                        <SeparatorDot />
                        <span class="min-w-0 truncate">{collection.updated}</span>
                      </span>
                    </span>
                    {#if isOpen}
                      <span
                        class="text-xs leading-4"
                        title="Open in another tab"
                        style="display: flex; grid-column: 4; align-items: center; gap: 5px; padding-left: 8px; color: var(--ui-secondary-text);"
                      >
                        <span
                          style="width: 6px; height: 6px; border-radius: 50%; background: var(--ui-success-normal-text);"
                        ></span>
                        Open
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      </div>
    {:else}
      <div
        class="text-base leading-6"
        style="display: flex; flex: 1; align-items: center; justify-content: center; min-width: 0; color: var(--ui-muted-text);"
      >
        {activeWorkTab ? 'Collection Screen' : activeScreenTab?.screenLabel}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Copied from WindowsTitleBar.svelte without the window drag regions, which would move the app window. */
  .titlebar {
    display: flex;
    flex: none;
    align-items: center;
    background: var(--ui-chrome-normal-surface);
    height: var(--titlebar-height);
    min-height: var(--titlebar-height);
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

  /* Full-height strip of touching tabs, so no drag region sits above, below, or between them. */
  .titlebar__tabs {
    display: flex;
    flex: 0 1 auto;
    align-self: stretch;
    min-width: 0;
  }

  .titlebar__tab {
    position: relative;
    display: flex;
    flex: 0 1 222px;
    width: 222px;
    min-width: 0;
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

  /* Full-height hit area touching the last tab; its pill sits 4px from the last tab pill, like the gap between tabs. */
  .titlebar__new-tab {
    position: relative;
    display: flex;
    flex: none;
    align-self: stretch;
    align-items: center;
    justify-content: center;
    width: 42px;
    color: var(--ui-secondary-icon-glyph);
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

  /* Matches the shared disabled button appearance once the tab limit is reached. */
  .titlebar__new-tab:disabled {
    opacity: 0.5;
  }

  /* The left padding keeps at least a 24px drag gap after the New Tab button. */
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

  .titlebar__updates:is(:hover, :focus-visible) {
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
    border: 2px solid var(--ui-chrome-normal-surface);
    box-sizing: content-box;
  }

  /* Windows glyph metrics are explicitly excluded to preserve native control rendering. */
  .titlebar__icon {
    font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif;
    font-size: 10px;
    line-height: 10px;
  }
</style>
