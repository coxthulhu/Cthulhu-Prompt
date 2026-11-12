<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    ArrowLeft,
    Bug,
    Clock,
    Download,
    FileText,
    GripVertical,
    Home,
    Layers,
    LayoutGrid,
    PanelsTopLeft,
    Plus,
    Settings,
    Settings2,
    Star,
    X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import ResizeSash from '@renderer/common/cthulhu-ui/layout/ResizeSash.svelte'

  type CollectionKind = 'task' | 'template'

  type ScreenTab = {
    id: string
    label: string
    icon: ComponentType
    screenLabel: string
  }

  type WorkTab = {
    id: string
    title: string
    icon: ComponentType
    project: string | null
  }

  const kindIcons: Record<CollectionKind, ComponentType> = {
    task: FileText,
    template: Layers
  }

  const screenTabs: ScreenTab[] = [
    { id: 'home', label: 'Home', icon: Home, screenLabel: 'Home Screen' },
    { id: 'settings', label: 'System Settings', icon: Settings, screenLabel: 'Settings' },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft, screenLabel: 'Mockups' },
    { id: 'test-screen', label: 'Test Screen', icon: Bug, screenLabel: 'Test Screen' }
  ]

  const workTabs: WorkTab[] = [
    { id: 'bug-triage', title: 'Bug Triage', icon: kindIcons.task, project: 'Atlas Web' },
    { id: 'code-review', title: 'Code Review', icon: kindIcons.template, project: 'Atlas Web' },
    { id: 'schema-migrations', title: 'Schema Migrations', icon: kindIcons.task, project: 'Harbor API' },
    { id: 'release-notes', title: 'Release Notes', icon: kindIcons.template, project: 'Harbor API' },
    { id: 'new-tab', title: 'New Tab', icon: LayoutGrid, project: null }
  ]

  let activeTabId = $state('new-tab')
  const activeScreenTab = $derived(screenTabs.find((tab) => tab.id === activeTabId))
  const activeWorkTab = $derived(workTabs.find((tab) => tab.id === activeTabId))
  /** Project tabs and System Settings show a sidebar; every other tab fills the body. */
  const hasSidebar = $derived(activeScreenTab?.id === 'settings' || Boolean(activeWorkTab?.project))

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

  /** Inline styles cannot express :hover, so hovered elements are tracked by id. */
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

  type Collection = {
    id: string
    name: string
    kind: CollectionKind
    count: number
    favorite?: boolean
  }

  type Project = {
    id: string
    name: string
    collections: Collection[]
  }

  type CollectionTile = {
    key: string
    collection: Collection
    meta: string
  }

  const projects: Project[] = [
    {
      id: 'atlas-web',
      name: 'Atlas Web',
      collections: [
        { id: 'bug-triage', name: 'Bug Triage', kind: 'task', count: 14, favorite: true },
        { id: 'feature-specs', name: 'Feature Specs', kind: 'task', count: 9 },
        { id: 'refactoring', name: 'Refactoring', kind: 'task', count: 22 },
        { id: 'ui-polish', name: 'UI Polish', kind: 'task', count: 7 },
        { id: 'code-review', name: 'Code Review', kind: 'template', count: 6, favorite: true },
        { id: 'component-scaffolds', name: 'Component Scaffolds', kind: 'template', count: 4 }
      ]
    },
    {
      id: 'harbor-api',
      name: 'Harbor API',
      collections: [
        { id: 'schema-migrations', name: 'Schema Migrations', kind: 'task', count: 11, favorite: true },
        { id: 'endpoint-design', name: 'Endpoint Design', kind: 'task', count: 16 },
        { id: 'query-performance', name: 'Query Performance', kind: 'task', count: 5 },
        { id: 'auth-hardening', name: 'Auth Hardening', kind: 'task', count: 8 },
        { id: 'release-notes', name: 'Release Notes', kind: 'template', count: 3 },
        { id: 'test-generation', name: 'Test Generation', kind: 'template', count: 8 }
      ]
    },
    {
      id: 'lantern-cli',
      name: 'Lantern CLI',
      collections: [
        { id: 'command-parsing', name: 'Command Parsing', kind: 'task', count: 6 },
        { id: 'error-messages', name: 'Error Messages', kind: 'task', count: 12, favorite: true },
        { id: 'packaging', name: 'Packaging', kind: 'task', count: 4 },
        { id: 'commit-messages', name: 'Commit Messages', kind: 'template', count: 5 }
      ]
    },
    {
      id: 'tidewater-docs',
      name: 'Tidewater Docs',
      collections: [
        { id: 'onboarding-guides', name: 'Onboarding Guides', kind: 'task', count: 10 },
        { id: 'api-reference', name: 'API Reference', kind: 'task', count: 18 },
        { id: 'style-rules', name: 'Style Rules', kind: 'template', count: 7 }
      ]
    }
  ]

  const recentOpens = [
    { projectId: 'harbor-api', collectionId: 'release-notes', opened: '12 minutes ago' },
    { projectId: 'atlas-web', collectionId: 'bug-triage', opened: '1 hour ago' },
    { projectId: 'harbor-api', collectionId: 'schema-migrations', opened: '3 hours ago' },
    { projectId: 'tidewater-docs', collectionId: 'onboarding-guides', opened: 'Yesterday' },
    { projectId: 'atlas-web', collectionId: 'refactoring', opened: '2 days ago' }
  ]

  const countLabel = (collection: Collection) => {
    const noun = collection.kind === 'task' ? 'prompt' : 'template'
    return `${collection.count} ${noun}${collection.count === 1 ? '' : 's'}`
  }

  const favoriteTiles: CollectionTile[] = projects.flatMap((project) =>
    project.collections
      .filter((collection) => collection.favorite)
      .map((collection) => ({
        key: `favorite:${project.id}:${collection.id}`,
        collection,
        meta: `${project.name} · ${countLabel(collection)}`
      }))
  )

  const recentTiles: CollectionTile[] = recentOpens.flatMap(({ projectId, collectionId, opened }) => {
    const project = projects.find((candidate) => candidate.id === projectId)
    const collection = project?.collections.find((candidate) => candidate.id === collectionId)
    return project && collection
      ? [{ key: `recent:${project.id}:${collection.id}`, collection, meta: `${project.name} · ${opened}` }]
      : []
  })

  const projectTiles = (project: Project): CollectionTile[] =>
    project.collections.map((collection) => ({
      key: `project:${project.id}:${collection.id}`,
      collection,
      meta: countLabel(collection)
    }))

  const tileGridStyle =
    'display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 10px;'
</script>

{#snippet sectionTitle(headingId: string, title: string, detail: string)}
  <h2
    id={headingId}
    class="text-base leading-6"
    style="flex: 0 1 auto; {truncate} font-weight: var(--font-weight-semibold); color: var(--ui-normal-text);"
  >
    {title}
  </h2>
  <span class="text-xs leading-4" style="flex: 0 0 auto; margin-left: 10px; color: var(--ui-muted-text);">{detail}</span>
  <span
    aria-hidden="true"
    style="flex: 1 1 0; min-width: 24px; height: 1px; margin-left: 14px; background: var(--ui-neutral-muted-border);"
  ></span>
{/snippet}

{#snippet collectionTile(tile: CollectionTile)}
  {@const isHovered = hovered.has(tile.key)}
  {@const starId = `${tile.key}:star`}
  {@const isFavorite = Boolean(tile.collection.favorite)}
  {@const KindIcon = kindIcons[tile.collection.kind]}
  <div
    {...hover(tile.key)}
    style="position: relative; min-width: 0; border-radius: 8px; border: 1px solid {isHovered
      ? 'var(--ui-neutral-focus-border)'
      : 'var(--ui-card-normal-border)'}; background: {isHovered
      ? 'linear-gradient(var(--ui-neutral-normal-surface), var(--ui-neutral-normal-surface)), '
      : ''}var(--ui-card-normal-surface); box-shadow: 0 1px 2px var(--ui-shadow-raised);"
  >
    <button
      type="button"
      title={tile.collection.name}
      style="display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; padding: 12px 44px 12px 14px; text-align: left;"
    >
      <KindIcon
        size={20}
        strokeWidth={1.5}
        aria-hidden="true"
        style="flex: 0 0 auto; color: {isHovered ? 'var(--ui-hoverable-icon-glyph)' : 'var(--ui-secondary-icon-glyph)'};"
      />
      <span style="display: flex; flex: 1; flex-direction: column; min-width: 0;">
        <span
          class="text-sm leading-5"
          style="{truncate} font-weight: 500; color: {isHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'};"
        >
          {tile.collection.name}
        </span>
        <span class="text-xs leading-4" style="{truncate} color: var(--ui-muted-text);">{tile.meta}</span>
      </span>
    </button>
    {#if isFavorite || isHovered}
      <button
        type="button"
        aria-label={isFavorite ? `Remove ${tile.collection.name} from Favorites` : `Add ${tile.collection.name} to Favorites`}
        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-pressed={isFavorite}
        {...hover(starId)}
        style="position: absolute; top: 50%; right: 10px; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; margin-top: -13px; border-radius: 6px; background: {ghostFill(starId)}; color: {isFavorite
          ? 'var(--ui-favorite-icon-glyph)'
          : hovered.has(starId)
            ? 'var(--ui-hoverable-icon-glyph)'
            : 'var(--ui-muted-icon-glyph)'};"
      >
        <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    {/if}
  </div>
{/snippet}

{#snippet tabBackdrop(selected: boolean, isHovered: boolean)}
  {#if selected || isHovered}
    <!-- Selected tabs reuse the prompt tree's active-row fills: emphasis at rest, selection on hover. -->
    <span
      aria-hidden="true"
      style="position: absolute; inset: 3px; border-radius: 6px; background: {selected
        ? isHovered
          ? 'var(--ui-neutral-selection-surface)'
          : 'var(--ui-neutral-emphasis-surface)'
        : 'var(--ui-neutral-normal-surface)'};"
    ></span>
  {/if}
{/snippet}

{#snippet windowControl(id: string, label: string, glyph: string, isClose: boolean)}
  <button
    type="button"
    aria-label={label}
    {...hover(id)}
    style="display: inline-flex; align-items: center; justify-content: center; width: var(--titlebar-button-width); height: 100%; background: {hovered.has(id)
      ? isClose
        ? '#e81123'
        : 'var(--ui-neutral-action-fill)'
      : 'var(--ui-ghost-surface)'}; color: var(--ui-normal-text);"
  >
    <span
      aria-hidden="true"
      style="font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif; font-size: 10px; line-height: 10px;"
      >{glyph}</span
    >
  </button>
{/snippet}

{#snippet ghostIconButton(id: string, label: string, Icon: ComponentType)}
  <button
    type="button"
    aria-label={label}
    title={label}
    {...hover(id)}
    style="display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: {ghostFill(id)}; color: {ghostGlyph(id)};"
  >
    <Icon size={16} aria-hidden="true" />
  </button>
{/snippet}

<!-- Option 3A: the continuous line stays, and the selected tab is a neutral filled pill like an active prompt tree row. -->
<div
  style="display: flex; flex-direction: column; height: 100%; min-height: 640px; color: var(--ui-normal-text); font-family: var(--font-sans);"
>
  <header
    style="display: flex; flex: 0 0 44px; align-items: center; min-width: 0; background: var(--ui-chrome-normal-surface); border-bottom: 1px solid var(--ui-neutral-hover-border); user-select: none;"
  >
    <img
      src={appIcon}
      alt="Cthulhu Prompt icon"
      draggable="false"
      style="flex: 0 0 auto; width: 20px; height: 20px; margin: 0 10px 0 12px; object-fit: contain;"
    />

    <div role="tablist" aria-label="Screens" style="display: flex; flex: 0 0 auto; gap: 4px;">
      {#each screenTabs as tab (tab.id)}
        {@const selected = activeTabId === tab.id}
        {@const TabIcon = tab.icon}
        <button
          type="button"
          role="tab"
          aria-selected={selected}
          aria-label={tab.label}
          title={tab.label}
          onclick={() => {
            activeTabId = tab.id
          }}
          {...hover(tab.id)}
          style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; color: {selected || hovered.has(tab.id)
            ? 'var(--ui-hoverable-icon-glyph)'
            : 'var(--ui-secondary-icon-glyph)'};"
        >
          {@render tabBackdrop(selected, hovered.has(tab.id))}
          <TabIcon size={20} strokeWidth={1.5} style="position: relative;" aria-hidden="true" />
        </button>
      {/each}
    </div>

    <div
      aria-hidden="true"
      style="flex: 0 0 auto; width: 1px; height: 18px; margin: 0 9px; background: var(--ui-neutral-normal-border);"
    ></div>

    <div role="tablist" aria-label="Open tabs" style="display: flex; flex: 0 1 auto; gap: 2px; min-width: 0;">
      {#each workTabs as tab (tab.id)}
        {@const selected = activeTabId === tab.id}
        {@const isHovered = hovered.has(tab.id)}
        {@const closeId = `${tab.id}:close`}
        {@const TabIcon = tab.icon}
        <div
          {...hover(tab.id)}
          style="position: relative; display: flex; flex: 0 1 200px; width: 200px; min-width: 0; height: 42px;"
        >
          {@render tabBackdrop(selected, isHovered)}
          <button
            type="button"
            role="tab"
            aria-selected={selected}
            class="text-sm leading-5"
            onclick={() => {
              activeTabId = tab.id
            }}
            style="position: relative; display: flex; flex: 1; align-items: center; gap: 8px; min-width: 0; height: 100%; padding: 0 6px 0 12px; text-align: left; color: {selected ||
            isHovered
              ? 'var(--ui-normal-text)'
              : 'var(--ui-hoverable-text)'};"
          >
            <TabIcon
              size={16}
              aria-hidden="true"
              style="flex: 0 0 auto; color: {selected || isHovered
                ? 'var(--ui-hoverable-icon-glyph)'
                : 'var(--ui-secondary-icon-glyph)'};"
            />
            <span style={truncate}>{tab.title}</span>
          </button>
          <button
            type="button"
            aria-label={`Close ${tab.title}`}
            title="Close Tab"
            {...hover(closeId)}
            style="position: relative; display: flex; flex: 0 0 auto; align-self: center; align-items: center; justify-content: center; width: 20px; height: 20px; margin-right: 7px; border-radius: 4px; background: {hovered.has(closeId)
              ? 'var(--ui-neutral-action-hover-fill)'
              : 'var(--ui-ghost-surface)'}; color: {hovered.has(closeId)
              ? 'var(--ui-normal-text)'
              : 'var(--ui-secondary-icon-glyph)'};"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      {/each}
    </div>

    <div
      aria-hidden="true"
      style="flex: 0 0 auto; width: 1px; height: 18px; margin: 0 4px 0 9px; background: var(--ui-neutral-normal-border);"
    ></div>

    <button
      type="button"
      aria-label="New Tab"
      title="New Tab"
      {...hover('new-tab-button')}
      style="display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: {ghostFill('new-tab-button')}; color: {hovered.has('new-tab-button')
        ? 'var(--ui-normal-text)'
        : 'var(--ui-secondary-icon-glyph)'};"
    >
      <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>

    <div style="flex: 1 0 24px; align-self: stretch;"></div>

    <div style="display: flex; flex: 0 0 auto; align-self: stretch;">
      <button
        type="button"
        aria-label="App updates — update available"
        title="App updates"
        {...hover('app-updates')}
        style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: var(--titlebar-button-width); height: 100%; background: {hovered.has('app-updates')
          ? 'var(--ui-neutral-action-fill)'
          : 'var(--ui-ghost-surface)'}; color: {hovered.has('app-updates')
          ? 'var(--ui-normal-text)'
          : 'var(--ui-secondary-icon-glyph)'};"
      >
        <Download size={20} strokeWidth={1.5} aria-hidden="true" />
        <span
          aria-hidden="true"
          style="position: absolute; right: 9px; top: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--ui-success-normal-text); border: 2px solid var(--ui-chrome-normal-surface); box-sizing: content-box;"
        ></span>
      </button>
      {@render windowControl('minimize', 'Minimize window', '', false)}
      {@render windowControl('restore', 'Restore window', '', false)}
      {@render windowControl('close', 'Close window', '', true)}
    </div>
  </header>

  <div style="display: flex; flex: 1; min-height: 0; background: var(--background);">
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
              {@render ghostIconButton('sidebar-project-settings', 'Project Settings', Settings2)}
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

    {#if activeTabId === 'new-tab'}
      <div style="flex: 1; min-width: 0; min-height: 0; overflow-y: auto;">
        <div style="display: flex; flex-direction: column; gap: 32px; max-width: 1120px; margin: 0 auto; padding: 28px 48px 48px;">
          <section aria-labelledby="new-tab-favorites">
            <div style="display: flex; align-items: center; height: 28px; margin: 0 0 12px -30px;">
              <span
                aria-hidden="true"
                style="display: flex; flex: 0 0 22px; align-items: center; justify-content: center; margin-right: 8px; color: var(--ui-favorite-icon-glyph);"
              >
                <Star size={16} fill="currentColor" />
              </span>
              {@render sectionTitle('new-tab-favorites', 'Favorite Collections', `${favoriteTiles.length}`)}
            </div>
            <div style={tileGridStyle}>
              {#each favoriteTiles as tile (tile.key)}
                {@render collectionTile(tile)}
              {/each}
            </div>
          </section>

          <section aria-labelledby="new-tab-recent">
            <div style="display: flex; align-items: center; height: 28px; margin: 0 0 12px -30px;">
              <span
                aria-hidden="true"
                style="display: flex; flex: 0 0 22px; align-items: center; justify-content: center; margin-right: 8px; color: var(--ui-secondary-icon-glyph);"
              >
                <Clock size={16} />
              </span>
              {@render sectionTitle('new-tab-recent', 'Recent Collections', `${recentTiles.length}`)}
            </div>
            <div style={tileGridStyle}>
              {#each recentTiles as tile (tile.key)}
                {@render collectionTile(tile)}
              {/each}
            </div>
          </section>

          {#each projects as project (project.id)}
            {@const gripId = `${project.id}:grip`}
            {@const headingId = `new-tab-project-${project.id}`}
            <section aria-labelledby={headingId}>
              <div style="display: flex; align-items: center; height: 28px; margin: 0 0 12px -30px;">
                <button
                  type="button"
                  aria-label={`Reorder ${project.name}`}
                  title="Drag to Reorder"
                  {...hover(gripId)}
                  style="display: flex; flex: 0 0 22px; align-items: center; justify-content: center; height: 28px; margin-right: 8px; border-radius: 5px; cursor: grab; background: {ghostFill(gripId)}; color: {ghostGlyph(gripId)};"
                >
                  <GripVertical size={16} aria-hidden="true" />
                </button>
                {@render sectionTitle(
                  headingId,
                  project.name,
                  `${project.collections.length} collection${project.collections.length === 1 ? '' : 's'}`
                )}
              </div>
              <div style={tileGridStyle}>
                {#each projectTiles(project) as tile (tile.key)}
                  {@render collectionTile(tile)}
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
