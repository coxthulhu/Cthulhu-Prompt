<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    ArrowLeft,
    Bug,
    ChevronRight,
    Download,
    FileText,
    Home,
    Layers,
    LayoutGrid,
    PanelsTopLeft,
    Plus,
    Search,
    Settings,
    Settings2,
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

  type RecentCollection = {
    title: string
    kind: CollectionKind
    project: string
  }

  type Project = {
    name: string
    collections: Array<{ title: string; kind: CollectionKind; count: number }>
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

  const recentCollections: RecentCollection[] = [
    { title: 'Test Coverage', kind: 'task', project: 'Atlas Web' },
    { title: 'Endpoint Docs', kind: 'template', project: 'Harbor API' },
    { title: 'UI Polish', kind: 'task', project: 'Tide Mobile' },
    { title: 'Feature Spec', kind: 'template', project: 'Atlas Web' }
  ]

  const projects: Project[] = [
    {
      name: 'Atlas Web',
      collections: [
        { title: 'Bug Triage', kind: 'task', count: 24 },
        { title: 'Refactoring', kind: 'task', count: 18 },
        { title: 'Test Coverage', kind: 'task', count: 11 },
        { title: 'Code Review', kind: 'template', count: 7 },
        { title: 'Feature Spec', kind: 'template', count: 5 }
      ]
    },
    {
      name: 'Harbor API',
      collections: [
        { title: 'Schema Migrations', kind: 'task', count: 9 },
        { title: 'Incident Follow-ups', kind: 'task', count: 14 },
        { title: 'Endpoint Docs', kind: 'template', count: 6 },
        { title: 'Release Notes', kind: 'template', count: 4 }
      ]
    },
    {
      name: 'Tide Mobile',
      collections: [
        { title: 'Offline Sync', kind: 'task', count: 13 },
        { title: 'UI Polish', kind: 'task', count: 21 },
        { title: 'Bug Report', kind: 'template', count: 3 }
      ]
    }
  ]

  let activeTabId = $state('bug-triage')
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
  const tabSurface = (selected: boolean) =>
    selected ? 'var(--background)' : 'var(--ui-ghost-surface)'

  const truncate = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
</script>

{#snippet tabBackdrop(selected: boolean, isHovered: boolean)}
  {#if selected}
    <!-- Concave corners blend the selected tab into the full-width band below it. -->
    <span
      aria-hidden="true"
      style="position: absolute; left: -8px; bottom: 0; width: 8px; height: 8px; background: radial-gradient(circle at 0 0, transparent 7.5px, var(--background) 8px);"
    ></span>
    <span
      aria-hidden="true"
      style="position: absolute; right: -8px; bottom: 0; width: 8px; height: 8px; background: radial-gradient(circle at 100% 0, transparent 7.5px, var(--background) 8px);"
    ></span>
  {:else if isHovered}
    <span
      aria-hidden="true"
      style="position: absolute; inset: 3px; border-radius: 6px; background: var(--ui-neutral-normal-surface);"
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
    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
{/snippet}

<!-- Option 1: the selected tab opens into a full-width band, so the sidebar split always starts below it. -->
<div
  style="display: flex; flex-direction: column; height: 100%; min-height: 640px; color: var(--ui-normal-text); font-family: var(--font-sans);"
>
  <header
    style="display: flex; flex: 0 0 40px; align-items: flex-end; min-width: 0; background: var(--ui-chrome-normal-surface); user-select: none;"
  >
    <img
      src={appIcon}
      alt="Cthulhu Prompt icon"
      draggable="false"
      style="flex: 0 0 auto; width: 20px; height: 20px; margin: 0 10px 7px 12px; object-fit: contain;"
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
          style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 34px; border-radius: 8px 8px 0 0; background: {tabSurface(selected)}; color: {selected
            ? 'var(--ui-normal-text)'
            : ghostGlyph(tab.id)};"
        >
          {@render tabBackdrop(selected, hovered.has(tab.id))}
          <TabIcon size={18} strokeWidth={1.5} style="position: relative;" aria-hidden="true" />
        </button>
      {/each}
    </div>

    <div
      aria-hidden="true"
      style="flex: 0 0 auto; width: 1px; height: 18px; margin: 0 9px 8px; background: var(--ui-neutral-normal-border);"
    ></div>

    <div role="tablist" aria-label="Open tabs" style="display: flex; flex: 0 1 auto; gap: 2px; min-width: 0;">
      {#each workTabs as tab (tab.id)}
        {@const selected = activeTabId === tab.id}
        {@const isHovered = hovered.has(tab.id)}
        {@const closeId = `${tab.id}:close`}
        {@const TabIcon = tab.icon}
        <div
          {...hover(tab.id)}
          style="position: relative; display: flex; flex: 0 1 200px; width: 200px; min-width: 0; height: 34px; border-radius: 8px 8px 0 0; background: {tabSurface(selected)};"
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
            style="position: relative; display: flex; flex: 1; align-items: center; gap: 8px; min-width: 0; height: 100%; padding: 0 6px 0 12px; text-align: left; color: {selected
              ? 'var(--ui-normal-text)'
              : ghostText(tab.id)}; font-weight: {selected ? 'var(--font-weight-semibold)' : 'normal'};"
          >
            <TabIcon
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              style="flex: 0 0 auto; color: {selected
                ? 'var(--ui-hoverable-icon-glyph)'
                : ghostGlyph(tab.id)};"
            />
            <span style={truncate}>{tab.title}</span>
          </button>
          <button
            type="button"
            aria-label={`Close ${tab.title}`}
            title="Close Tab"
            {...hover(closeId)}
            style="position: relative; display: flex; flex: 0 0 auto; align-self: center; align-items: center; justify-content: center; width: 20px; height: 20px; margin-right: 7px; border-radius: 4px; visibility: {selected ||
            isHovered
              ? 'visible'
              : 'hidden'}; background: {hovered.has(closeId)
              ? 'var(--ui-neutral-action-hover-fill)'
              : 'var(--ui-ghost-surface)'}; color: {hovered.has(closeId)
              ? 'var(--ui-normal-text)'
              : 'var(--ui-secondary-icon-glyph)'};"
          >
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      {/each}
    </div>

    <button
      type="button"
      aria-label="New Tab"
      title="New Tab"
      {...hover('new-tab-button')}
      style="display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 28px; height: 28px; margin: 0 0 3px 10px; border-radius: 6px; background: {ghostFill('new-tab-button')}; color: {ghostGlyph('new-tab-button')};"
    >
      <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
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
        <Download size={18} strokeWidth={1.5} aria-hidden="true" />
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

  <!-- The band matches the selected tab and holds the location that used to sit in the sidebar header. -->
  <div
    style="display: flex; flex: 0 0 36px; align-items: center; gap: 6px; min-width: 0; padding: 0 10px; background: var(--background); border-bottom: 1px solid var(--ui-neutral-muted-border); user-select: none;"
  >
    {#if activeWorkTab?.project}
      <button
        type="button"
        class="text-xs leading-4"
        aria-label="Return to New Tab"
        title="Return to New Tab"
        {...hover('return-new-tab')}
        style="display: flex; flex: 0 0 auto; align-items: center; gap: 4px; height: 26px; padding: 0 8px 0 6px; border-radius: 6px; background: {ghostFill('return-new-tab')}; color: {ghostText('return-new-tab')};"
      >
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        New Tab
      </button>
      <div
        aria-hidden="true"
        style="flex: 0 0 auto; width: 1px; height: 16px; margin: 0 4px; background: var(--ui-neutral-normal-border);"
      ></div>
      <h2
        class="text-sm leading-4.5"
        style="{truncate} flex: 0 1 auto; font-weight: var(--font-weight-semibold); color: var(--ui-secondary-text);"
      >
        {activeWorkTab.project}
      </h2>
      {@render ghostIconButton('band-project-settings', 'Project Settings', Settings2)}
      <ChevronRight size={16} strokeWidth={1.75} style="flex: 0 0 auto; color: var(--ui-muted-icon-glyph);" aria-hidden="true" />
      <span class="text-sm leading-5" style="{truncate} color: var(--ui-normal-text);">{activeWorkTab.title}</span>
    {:else}
      <h2
        class="text-sm leading-4.5"
        style="{truncate} font-weight: var(--font-weight-semibold); color: var(--ui-secondary-text);"
      >
        {activeScreenTab?.label ?? activeWorkTab?.title}
      </h2>
    {/if}
  </div>

  <div style="display: flex; flex: 1; min-height: 0; background: var(--background);">
    {#if hasSidebar}
      <aside
        style="position: relative; display: flex; flex: 0 0 {sidebarWidth}px; flex-direction: column; min-height: 0; background: var(--ui-chrome-normal-surface); border-right: 1px solid var(--ui-neutral-hover-border); user-select: none;"
      >
        {#if activeWorkTab?.project}
          <div
            class="text-xs leading-4"
            style="display: flex; flex: 0 0 36px; align-items: center; justify-content: center; border-bottom: 1px solid var(--ui-neutral-muted-border); color: var(--ui-muted-text);"
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

    {#if activeWorkTab && !activeWorkTab.project}
      <div style="flex: 1; min-width: 0; overflow-y: auto;">
        <div style="display: flex; flex-direction: column; gap: 28px; max-width: 960px; margin: 0 auto; padding: 40px 32px;">
          <div
            style="display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 8px; background: var(--ui-neutral-field-surface);"
          >
            <Search size={16} strokeWidth={1.75} style="flex: 0 0 auto; color: var(--ui-muted-icon-glyph);" aria-hidden="true" />
            <input
              type="text"
              class="text-sm leading-5"
              placeholder="Search collections"
              aria-label="Search collections"
              style="flex: 1; min-width: 0; outline: none; color: var(--ui-normal-text);"
            />
          </div>

          <section style="display: flex; flex-direction: column; gap: 10px;">
            <h2 class="text-sm leading-5" style="font-weight: var(--font-weight-semibold); color: var(--ui-secondary-text);">
              Recent
            </h2>
            <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">
              {#each recentCollections as item (item.title)}
                {@const id = `recent:${item.title}`}
                {@const ItemIcon = kindIcons[item.kind]}
                <button
                  type="button"
                  {...hover(id)}
                  style="display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; text-align: left; border: 1px solid {hovered.has(id)
                    ? 'var(--ui-neutral-focus-border)'
                    : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: var(--ui-card-normal-surface);"
                >
                  <ItemIcon size={16} strokeWidth={1.75} style="flex: 0 0 auto; color: var(--ui-secondary-icon-glyph);" aria-hidden="true" />
                  <span style="display: flex; flex-direction: column; min-width: 0;">
                    <span class="text-sm leading-5" style="{truncate} color: var(--ui-normal-text);">{item.title}</span>
                    <span class="text-xs leading-4" style="{truncate} color: var(--ui-muted-text);">{item.project}</span>
                  </span>
                </button>
              {/each}
            </div>
          </section>

          <section style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; min-height: 28px;">
              <h2 class="text-sm leading-5" style="font-weight: var(--font-weight-semibold); color: var(--ui-secondary-text);">
                Projects
              </h2>
              <button
                type="button"
                class="text-xs leading-4"
                {...hover('new-project')}
                style="display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 8px; border: 1px solid {hovered.has('new-project')
                  ? 'var(--ui-neutral-focus-border)'
                  : 'var(--ui-neutral-normal-border)'}; border-radius: 6px; background: {ghostFill('new-project')}; color: {ghostText('new-project')};"
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                New Project
              </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start;">
              {#each projects as project (project.name)}
                <div
                  style="display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: var(--ui-card-normal-surface);"
                >
                  <div
                    style="display: flex; align-items: center; gap: 2px; height: 40px; padding: 0 8px 0 12px; border-bottom: 1px solid var(--ui-neutral-muted-border);"
                  >
                    <h3 class="text-sm leading-5" style="{truncate} flex: 1; font-weight: var(--font-weight-semibold); color: var(--ui-normal-text);">
                      {project.name}
                    </h3>
                    {@render ghostIconButton(`${project.name}:settings`, 'Project Settings', Settings2)}
                    {@render ghostIconButton(`${project.name}:create`, 'Create Collection', Plus)}
                  </div>
                  <div style="display: flex; flex-direction: column; padding: 4px;">
                    {#each project.collections as collection (collection.title)}
                      {@const id = `${project.name}:${collection.title}`}
                      {@const CollectionIcon = kindIcons[collection.kind]}
                      <button
                        type="button"
                        {...hover(id)}
                        style="display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; text-align: left; border-radius: 6px; background: {ghostFill(id)};"
                      >
                        <CollectionIcon size={16} strokeWidth={1.75} style="flex: 0 0 auto; color: {ghostGlyph(id)};" aria-hidden="true" />
                        <span class="text-sm leading-5" style="{truncate} flex: 1; color: {ghostText(id)};">{collection.title}</span>
                        <span class="text-xs leading-4" style="flex: 0 0 auto; color: var(--ui-muted-text);">{collection.count}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </section>
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
