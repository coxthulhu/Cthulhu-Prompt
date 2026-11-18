<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import {
    Archive,
    ArrowUpToLine,
    Bug,
    Check,
    ChevronsDownUp,
    Download,
    FileText,
    Folder,
    GripVertical,
    Home,
    Layers,
    LayoutGrid,
    MoreHorizontal,
    Move,
    PanelsTopLeft,
    Plus,
    Search,
    Settings,
    X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import ResizeSash from '@renderer/common/cthulhu-ui/layout/ResizeSash.svelte'

  /** A task collection holds prompts; a template collection holds templates. */
  type CollectionKind = 'prompt' | 'template'

  type MockCollection = {
    id: string
    name: string
    kind: CollectionKind
    /** Active content count shown on the tile. */
    count: number
    /** Days since the newest content change, or null for a collection without content. */
    modifiedDaysAgo: number | null
  }

  type MockProject = {
    id: string
    name: string
    collections: MockCollection[]
  }

  /** A work tab shows its New Tab screen until a collection is opened in it; each tab keeps its own search and scroll. */
  type WorkTab = {
    id: string
    collectionId: string | null
    view: { search: string; scrollTop: number }
  }

  type FixedScreen = {
    id: string
    label: string
    icon: ComponentType
    screenLabel: string
  }

  /** Boundary a dragged project or tile would drop on: right before or right after one item. */
  type DropTarget = { id: string; after: boolean }

  /** Project section or collection tile being dragged, with its drop boundary and cursor ghost. */
  type ReorderDrag = {
    kind: 'project' | 'collection'
    id: string
    /** Project whose grid a dragged tile stays inside; null for project drags. */
    projectId: string | null
    target: DropTarget | null
    ghost: { title: string; icon: ComponentType; x: number; y: number }
  }

  type ReorderOptions = {
    kind: ReorderDrag['kind']
    id: string
    projectId: string | null
    title: string
    icon: ComponentType
    /** Element that holds pointer capture while the drag runs. */
    owner: HTMLElement
    /** Visible item IDs in display order. */
    getIds: () => string[]
    /** Boundary under the pointer, or null while it is outside the drop area. */
    getDropTarget: (clientX: number, clientY: number) => DropTarget | null
    /** Moves the dragged item right after previousId, or first when it is null. */
    onDrop: (id: string, previousId: string | null) => void
  }

  const fixedScreens: FixedScreen[] = [
    { id: 'home', label: 'Home', icon: Home, screenLabel: 'Home Screen' },
    { id: 'settings', label: 'System Settings', icon: Settings, screenLabel: 'Settings Screen' },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft, screenLabel: 'Mockups Screen' },
    { id: 'test-screen', label: 'Test Screen', icon: Bug, screenLabel: 'Test Screen' }
  ]

  /** Creation actions in each project's New Collection menu. */
  const createCollectionItems = [
    { id: 'prompt', label: 'Create Task Collection', icon: FileText },
    { id: 'template', label: 'Create Template Collection', icon: Layers }
  ]

  const workspaceName = 'Lantern Studio Prompts'

  const collection = (
    id: string,
    name: string,
    kind: CollectionKind,
    count: number,
    modifiedDaysAgo: number | null
  ): MockCollection => ({ id, name, kind, count, modifiedDaysAgo })

  /** Projects in saved order, each with its collections in Show All order. */
  let projects = $state<MockProject[]>([
    {
      id: 'atlas-web',
      name: 'Atlas Web',
      collections: [
        collection('bug-triage', 'Bug Triage', 'prompt', 12, 0),
        collection('code-review', 'Code Review', 'template', 8, 1),
        collection('ui-polish', 'UI Polish', 'prompt', 5, 3),
        collection('accessibility-audit', 'Accessibility Audit', 'prompt', 7, 9),
        collection('component-library', 'Component Library Conventions and Patterns', 'template', 14, 18)
      ]
    },
    {
      id: 'harbor-api',
      name: 'Harbor API',
      collections: [
        collection('schema-migrations', 'Schema Migrations', 'prompt', 9, 2),
        collection('release-notes', 'Release Notes', 'template', 4, 8),
        collection('endpoint-hardening', 'Endpoint Hardening', 'prompt', 6, 0),
        collection('load-testing', 'Load Testing', 'prompt', 1, 41)
      ]
    },
    {
      id: 'lighthouse-analytics',
      name: 'Lighthouse Analytics',
      collections: [
        collection('query-tuning', 'Query Tuning', 'prompt', 11, 5),
        collection('dashboard-specs', 'Dashboard Specs', 'template', 1, 23),
        collection('etl-backfill', 'ETL Backfill', 'prompt', 0, null)
      ]
    },
    {
      id: 'sandbox',
      name: 'Sandbox',
      collections: [
        collection('scratchpad', 'Scratchpad', 'prompt', 21, 0),
        collection('prompt-experiments', 'Prompt Experiments', 'template', 2, 130)
      ]
    }
  ])

  const createWorkTab = (id: string, collectionId: string | null): WorkTab => ({
    id,
    collectionId,
    view: { search: '', scrollTop: 0 }
  })

  let workTabs = $state<WorkTab[]>([
    createWorkTab('tab-1', 'bug-triage'),
    createWorkTab('tab-2', 'code-review'),
    createWorkTab('tab-3', 'schema-migrations'),
    createWorkTab('tab-4', 'release-notes'),
    createWorkTab('tab-5', null)
  ])
  /** Suffix that keeps the IDs of tabs added from the New Tab button unique; starts at the seeded tab count. */
  let addedTabCount = 5
  /** Selected fixed screen ID or work tab ID. */
  let selectedId = $state('tab-5')

  const collectionById = $derived(
    new Map(projects.flatMap((project) => project.collections.map((item) => [item.id, item] as const)))
  )
  const selectedWorkTab = $derived(workTabs.find((tab) => tab.id === selectedId))
  const selectedFixedScreen = $derived(fixedScreens.find((screen) => screen.id === selectedId))
  /** Collection shown by the selected work tab, absent on its New Tab screen. */
  const selectedCollection = $derived(
    selectedWorkTab?.collectionId ? collectionById.get(selectedWorkTab.collectionId) : undefined
  )
  /** Collections shown by work tabs, whose tiles are marked open. */
  const openCollectionIds = $derived(workTabs.flatMap((tab) => tab.collectionId ?? []))
  /** The sidebar shows beside System Settings and a work tab's collection; New Tab and the other screens fill the body. */
  const hasSidebar = $derived(selectedId === 'settings' || Boolean(selectedCollection))

  const getCollectionIcon = (kind: CollectionKind): ComponentType => (kind === 'template' ? Layers : FileText)

  /** A collection tab is named after its collection and shows its kind icon; other tabs are New Tab. */
  const getTabDisplay = (tab: WorkTab): { title: string; icon: ComponentType } => {
    const shown = tab.collectionId ? collectionById.get(tab.collectionId) : undefined
    return shown ? { title: shown.name, icon: getCollectionIcon(shown.kind) } : { title: 'New Tab', icon: LayoutGrid }
  }

  /** Capitalized relative time, matching the live collection details. */
  const formatModified = (days: number): string => {
    if (days < 1) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    const weeks = Math.floor(days / 7)
    if (weeks === 1) return 'Last week'
    if (days < 30) return `${weeks} weeks ago`
    const months = Math.floor(days / 30)
    if (months === 1) return 'Last month'
    if (days < 365) return `${months} months ago`
    const years = Math.floor(days / 365)
    return years === 1 ? 'Last year' : `${years} years ago`
  }

  /** Count with its content noun, then the relative modification time when the collection has content. */
  const getDetailParts = (item: MockCollection): string[] => {
    const countText = `${item.count} ${item.kind === 'template' ? 'template' : 'prompt'}${item.count === 1 ? '' : 's'}`
    return item.modifiedDaysAgo === null ? [countText] : [countText, formatModified(item.modifiedDaysAgo)]
  }

  /** Projects whose names match keep every collection; others keep only matching collections and hide without any. */
  const visibleProjects = $derived.by((): MockProject[] => {
    const query = (selectedWorkTab?.view.search ?? '').trim().toLowerCase()
    return projects.flatMap((project) => {
      if (project.name.toLowerCase().includes(query)) return [project]
      const collections = project.collections.filter((item) => item.name.toLowerCase().includes(query))
      return collections.length > 0 ? [{ ...project, collections }] : []
    })
  })
  const hasSearch = $derived(Boolean(selectedWorkTab?.view.search.trim()))

  // ---- Work tabs ----

  /** Stationary tab strip that scrolls sideways and owns pointer capture while a tab drags. */
  let tabStripElement = $state<HTMLElement>()
  /** Dragged work tab and its horizontal offset from its current slot. */
  let draggedTab = $state<{ id: string; offsetX: number } | null>(null)

  /** Appends a New Tab work tab and selects it. */
  const addWorkTab = () => {
    addedTabCount += 1
    const tab = createWorkTab(`tab-${addedTabCount}`, null)
    workTabs.push(tab)
    selectedId = tab.id
  }

  /** Closes a work tab; closing the selected tab selects its right neighbour, else its left, else Home. */
  const closeWorkTab = (tabId: string) => {
    const wasSelected = selectedId === tabId
    const index = workTabs.findIndex((tab) => tab.id === tabId)
    workTabs = workTabs.filter((tab) => tab.id !== tabId)
    if (wasSelected) selectedId = (workTabs[index] ?? workTabs[index - 1])?.id ?? 'home'
  }

  /** Moves a dragged work tab into the given display slot. */
  const moveWorkTab = (tabId: string, index: number) => {
    const otherTabs = workTabs.filter((tab) => tab.id !== tabId)
    workTabs = [...otherTabs.slice(0, index), workTabs.find((tab) => tab.id === tabId)!, ...otherTabs.slice(index)]
  }

  /** Selects a work tab on a left press, then slides it along the strip once the pointer moves 4px. */
  const handleTabPointerDown = (event: PointerEvent, tabId: string) => {
    if (event.button !== 0) return
    selectedId = tabId
    const strip = tabStripElement!
    /** Shared width of the touching tab slots. */
    const slotWidth = (event.currentTarget as HTMLElement).getBoundingClientRect().width
    let index = workTabs.findIndex((tab) => tab.id === tabId)
    const startLeft = index * slotWidth
    const maxLeft = (workTabs.length - 1) * slotWidth
    const move = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - event.clientX
      if (!draggedTab) {
        if (Math.max(Math.abs(deltaX), Math.abs(moveEvent.clientY - event.clientY)) < 4) return
        strip.setPointerCapture(event.pointerId)
      }
      const left = Math.min(Math.max(startLeft + deltaX, 0), maxLeft)
      const nextIndex = Math.round(left / slotWidth)
      if (nextIndex !== index) {
        index = nextIndex
        moveWorkTab(tabId, index)
      }
      draggedTab = { id: tabId, offsetX: left - index * slotWidth }
    }
    const finish = () => {
      draggedTab = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  // Side effect: scroll the selected work tab fully into view whenever the selection changes, such as a new tab added
  // past the strip's right edge.
  $effect(() => {
    void selectedId
    tabStripElement?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  // ---- Sidebar ----

  /** Sidebar width follows the live app's 240–400px resize range. */
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

  // ---- New Tab screen ----

  /** Side effect: restores a tab's retained viewport once its New Tab screen has mounted with its filtered content. */
  const restoreScroll: Action<HTMLElement, WorkTab['view']> = (node, view) => {
    node.scrollTop = view.scrollTop
  }

  /** Opens a clicked collection in the selected tab, including collections already open elsewhere. */
  const openCollection = (collectionId: string) => {
    if (justDragged || !selectedWorkTab) return
    selectedWorkTab.collectionId = collectionId
  }

  /** Project whose New Collection menu is open; the menu is CSS-anchored to that project's trigger, like the live
      dropdown, so it follows the trigger when the screen scrolls. */
  let collectionMenu = $state<{ projectId: string } | null>(null)
  let collectionMenuElement = $state<HTMLElement>()

  /** CSS anchor name of one project's New Collection button. */
  const getCollectionMenuAnchor = (projectId: string): string => `--new-collection-${projectId}`

  /** Toggles a project's New Collection menu. */
  const toggleCollectionMenu = (projectId: string) => {
    collectionMenu = collectionMenu?.projectId === projectId ? null : { projectId }
  }

  // Side effect: close the open New Collection menu on outside presses and Escape, and hold the background still
  // while it is open, like the live dropdown.
  $effect(() => {
    if (!collectionMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (collectionMenuElement?.contains(target) || target.closest('[data-collection-menu-trigger]')) return
      collectionMenu = null
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collectionMenu = null
    }
    const preventBackgroundScroll = (event: Event) => {
      if (!collectionMenuElement?.contains(event.target as Node)) event.preventDefault()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('wheel', preventBackgroundScroll, { capture: true, passive: false })
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('wheel', preventBackgroundScroll, { capture: true })
    }
  })

  // ---- Drag reordering ----

  let reorderDrag = $state<ReorderDrag | null>(null)
  /** Swallows the click that follows a drag's release, so a dropped tile does not open its collection. */
  let justDragged = false

  /** Index of the item a boundary precedes, or the item count after the last item. */
  const getBoundaryIndex = (ids: string[], target: DropTarget): number => ids.indexOf(target.id) + (target.after ? 1 : 0)

  /** Whether dropping on the boundary leaves the dragged item where it is. */
  const isDropBlocked = (ids: string[], draggedId: string, target: DropTarget): boolean => {
    const draggedIndex = ids.indexOf(draggedId)
    const boundaryIndex = getBoundaryIndex(ids, target)
    return boundaryIndex === draggedIndex || boundaryIndex === draggedIndex + 1
  }

  /** Visible IDs of the list the active drag reorders. */
  const getReorderIds = (drag: ReorderDrag): string[] =>
    drag.kind === 'project'
      ? visibleProjects.map((project) => project.id)
      : (visibleProjects.find((project) => project.id === drag.projectId)?.collections.map((item) => item.id) ?? [])

  /** The drop indicator turns gray when the drop would change nothing. */
  const isReorderBlocked = $derived(
    reorderDrag?.target ? isDropBlocked(getReorderIds(reorderDrag), reorderDrag.id, reorderDrag.target) : false
  )

  /** Moves an item right after previousId, or first without one. */
  const moveAfter = <T extends { id: string }>(items: T[], id: string, previousId: string | null): T[] => {
    const moved = items.find((item) => item.id === id)!
    const rest = items.filter((item) => item.id !== id)
    const insertIndex = previousId === null ? 0 : rest.findIndex((item) => item.id === previousId) + 1
    return [...rest.slice(0, insertIndex), moved, ...rest.slice(insertIndex)]
  }

  /** Starts a drag after 4px of movement; items stay put while a drop indicator marks the boundary. */
  const startReorder = (event: PointerEvent, options: ReorderOptions) => {
    if (event.button !== 0) return
    let started = false
    const move = (moveEvent: PointerEvent) => {
      if (!started) {
        if (Math.max(Math.abs(moveEvent.clientX - event.clientX), Math.abs(moveEvent.clientY - event.clientY)) < 4) return
        started = true
        options.owner.setPointerCapture(event.pointerId)
        reorderDrag = {
          kind: options.kind,
          id: options.id,
          projectId: options.projectId,
          target: null,
          ghost: { title: options.title, icon: options.icon, x: 0, y: 0 }
        }
      }
      const drag = reorderDrag!
      drag.ghost.x = Math.round(moveEvent.clientX + 4)
      drag.ghost.y = Math.round(moveEvent.clientY + 4)
      const nextTarget = options.getDropTarget(moveEvent.clientX, moveEvent.clientY)
      if (nextTarget?.id !== drag.target?.id || nextTarget?.after !== drag.target?.after) drag.target = nextTarget
    }
    const finish = (cancelled: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keydown', handleKeyDown, true)
      if (!started) return
      const target = reorderDrag?.target ?? null
      const ids = options.getIds()
      reorderDrag = null
      justDragged = true
      window.setTimeout(() => {
        justDragged = false
      })
      if (cancelled || !target || isDropBlocked(ids, options.id, target)) return
      options.onDrop(options.id, ids[getBoundaryIndex(ids, target) - 1] ?? null)
    }
    const handlePointerUp = () => finish(false)
    const handlePointerCancel = () => finish(true)
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || !started) return
      keyEvent.preventDefault()
      finish(true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown, true)
  }

  /** Drags a project section; it goes before the first section whose middle is below the pointer, else after the last. */
  const startProjectDrag = (event: PointerEvent, project: MockProject) => {
    const list = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-project-list]')!
    startReorder(event, {
      kind: 'project',
      id: project.id,
      projectId: null,
      title: project.name,
      icon: Folder,
      owner: list,
      getIds: () => visibleProjects.map((visible) => visible.id),
      getDropTarget: (_, clientY) => {
        const sections = [...list.children] as HTMLElement[]
        const nextSection = sections.find((section) => {
          const rect = section.getBoundingClientRect()
          return rect.top + rect.height / 2 > clientY
        })
        return nextSection
          ? { id: nextSection.dataset.projectId!, after: false }
          : { id: sections[sections.length - 1].dataset.projectId!, after: true }
      },
      onDrop: (id, previousId) => {
        projects = moveAfter(projects, id, previousId)
      }
    })
  }

  /** Tiles per row, matching the grid's three columns. */
  const tileColumnCount = 3
  /** Gap between tiles, matching the grid's 8px gap. */
  const tileGapPx = 8
  /** Distance outside a drop line's tile, or the grid's end, from which a dragged tile snaps to it. */
  const tileSnapPx = 100

  /**
   * Drags a collection tile inside its project's grid. Drop lines sit on each tile's left side, plus the grid's end one
   * gap past the last tile, which covers the last row's empty cells. The row nearest the pointer wins, then the nearest
   * line in it, from up to 100px outside the target.
   */
  const startTileDrag = (event: PointerEvent, projectId: string, item: MockCollection) => {
    const grid = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-tile-grid]')!
    const getVisibleTiles = () => visibleProjects.find((project) => project.id === projectId)?.collections ?? []
    startReorder(event, {
      kind: 'collection',
      id: item.id,
      projectId,
      title: item.name,
      icon: getCollectionIcon(item.kind),
      owner: grid,
      getIds: () => getVisibleTiles().map((tile) => tile.id),
      getDropTarget: (clientX, clientY) => {
        const tiles = getVisibleTiles()
        const slots = [...grid.children] as HTMLElement[]
        const lastRect = slots[slots.length - 1].getBoundingClientRect()
        /** Empty cells after the last tile; past a full row the grid's end is a zero-width line at the row's end. */
        const emptyCellCount = (tileColumnCount - (tiles.length % tileColumnCount)) % tileColumnCount
        const endLeft = lastRect.right + tileGapPx
        const candidates: { target: DropTarget; rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> }[] = [
          ...slots.map((slot, index) => ({ target: { id: tiles[index].id, after: false }, rect: slot.getBoundingClientRect() })),
          {
            target: { id: tiles[tiles.length - 1].id, after: true },
            rect: {
              left: endLeft,
              right: endLeft + Math.max(0, emptyCellCount * (lastRect.width + tileGapPx) - tileGapPx),
              top: lastRect.top,
              bottom: lastRect.bottom
            }
          }
        ]
        let nearest: { target: DropTarget; rowDistance: number; distance: number } | null = null
        for (const { target, rect } of candidates) {
          if (
            clientX < rect.left - tileSnapPx ||
            clientX > rect.right + tileSnapPx ||
            clientY < rect.top - tileSnapPx ||
            clientY > rect.bottom + tileSnapPx
          ) continue
          /** Vertical gap from the pointer to the target's row, compared before the distance to its left-side line. */
          const rowDistance = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
          const distance = Math.hypot(clientX - rect.left, rowDistance)
          if (
            !nearest ||
            rowDistance < nearest.rowDistance ||
            (rowDistance === nearest.rowDistance && distance < nearest.distance)
          ) {
            nearest = { target, rowDistance, distance }
          }
        }
        return nearest?.target ?? null
      },
      onDrop: (id, previousId) => {
        const project = projects.find((candidate) => candidate.id === projectId)!
        project.collections = moveAfter(project.collections, id, previousId)
      }
    })
  }
</script>

<!-- Dim borderless 36px sidebar button-bar action. -->
{#snippet barButton(label: string, Icon: ComponentType)}
  <button type="button" class="mockIconButton" aria-label={label} title={label}>
    <Icon size={20} aria-hidden="true" />
  </button>
{/snippet}

<div class="newTabMockup" data-reordering={reorderDrag ? 'true' : 'false'}>
  <!-- The title bar mirrors the live WindowsTitleBar without its window drag regions and development folder label. -->
  <header class="titlebar">
    <img class="titlebar__app-icon" src={appIcon} alt="Cthulhu Prompt icon" draggable="false" />

    <nav class="titlebar__screens" aria-label="Screens">
      {#each fixedScreens as screen (screen.id)}
        {@const active = selectedId === screen.id}
        {@const ScreenIcon = screen.icon}
        <button
          type="button"
          class="titlebar__screen"
          aria-label={screen.label}
          aria-current={active ? 'page' : undefined}
          data-active={active ? 'true' : 'false'}
          title={screen.label}
          onclick={() => {
            selectedId = screen.id
          }}
        >
          <ScreenIcon size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      {/each}
    </nav>

    <div class="titlebar__separator" aria-hidden="true"></div>

    <div class="titlebar__tab-row">
      <!-- Vertical wheel input scrolls the tabs sideways once they reach their 120px minimum width. -->
      <div
        class="titlebar__tab-viewport"
        role="presentation"
        onwheel={(event) => {
          tabStripElement!.scrollLeft += event.deltaY
        }}
        onmousedown={(event) => {
          // Middle presses would start Chromium's autoscroll on the overflowing strip and swallow the middle-click close.
          if (event.button === 1) event.preventDefault()
        }}
      >
        <div bind:this={tabStripElement} class="titlebar__tabs" role="tablist" aria-label="Open tabs">
          {#each workTabs as tab (tab.id)}
            {@const display = getTabDisplay(tab)}
            {@const TabIcon = display.icon}
            {@const selected = selectedId === tab.id}
            {@const dragging = draggedTab?.id === tab.id}
            <div
              class="titlebar__tab"
              data-selected={selected}
              data-dragging={dragging}
              style:transform={dragging ? `translateX(${draggedTab!.offsetX}px)` : undefined}
              onauxclick={(event) => {
                if (event.button === 1) closeWorkTab(tab.id)
              }}
            >
              <!-- The tab button covers the whole pill so presses around the close button still select and drag the tab. -->
              <button
                type="button"
                class="titlebar__tab-select text-sm leading-5"
                role="tab"
                aria-selected={selected}
                onpointerdown={(event) => handleTabPointerDown(event, tab.id)}
                onclick={() => {
                  selectedId = tab.id
                }}
              >
                <TabIcon size={16} aria-hidden="true" />
                <span class="titlebar__tab-title">{display.title}</span>
              </button>
              <button
                type="button"
                class="titlebar__tab-close"
                aria-label={`Close ${display.title}`}
                title="Close Tab"
                onclick={() => closeWorkTab(tab.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          {/each}
        </div>
      </div>
      <button type="button" class="titlebar__new-tab" aria-label="New Tab" title="New Tab" onclick={addWorkTab}>
        <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>

    <div class="titlebar__controls">
      <button type="button" class="titlebar__control titlebar__updates" aria-label="App updates — update available" title="App updates">
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
  <div class="appBody">
    {#if hasSidebar}
      <aside class="appSidebar" style:flex-basis={`${sidebarWidth}px`}>
        {#if selectedCollection}
          {@const KindIcon = getCollectionIcon(selectedCollection.kind)}
          <!-- Tab Collection Sidebar: the collection's title and Show All, then the prompt tree's button bar. -->
          <header class="sidebarHeader" data-screen-header="true">
            <div class="sidebarHeaderTitleGroup text-sm leading-4.5">
              <KindIcon size={16} class="sidebarHeaderIcon" aria-hidden="true" />
              <h2 class="sidebarHeaderTitle">{selectedCollection.name}</h2>
            </div>
            <button
              type="button"
              class="mockButton mockButton--showAll text-sm leading-5"
              onclick={() => {
                if (selectedWorkTab) selectedWorkTab.collectionId = null
              }}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              <span class="mockButtonLabel">Show All</span>
            </button>
          </header>
          <div class="sidebarSeparator" aria-hidden="true"></div>
          <div class="sidebarButtonBar">
            {@render barButton('Go to Top', ArrowUpToLine)}
            {#if selectedCollection.kind === 'prompt'}
              {@render barButton('Show Completed Prompts', Check)}
            {/if}
            {@render barButton(`Show Archived ${selectedCollection.kind === 'template' ? 'Templates' : 'Prompts'}`, Archive)}
            {@render barButton('Collapse All Categories', ChevronsDownUp)}
            {@render barButton('Selected Collection Actions', MoreHorizontal)}
          </div>
          <div class="placeholder text-sm leading-5">Prompt Tree</div>
        {:else}
          <header class="sidebarHeader">
            <div class="sidebarHeaderTitleGroup text-sm leading-4.5">
              <h2 class="sidebarHeaderTitle">System Settings</h2>
            </div>
          </header>
          <div class="placeholder text-sm leading-5">Settings Tree</div>
        {/if}
        <ResizeSash
          orientation="vertical"
          label="Resize sidebar"
          isDragging={isResizingSidebar}
          tabindex={-1}
          onpointerdown={startSidebarResize}
        />
      </aside>
    {/if}

    <div class="mainScreenSurface">
      {#if selectedWorkTab && !selectedCollection}
        <!-- Keyed by tab, so switching tabs remounts the screen and restores that tab's search and scroll. -->
        {#each [selectedWorkTab] as tab (tab.id)}
          <!-- Content is top aligned and the scrollbar's space is always reserved, so search results changing its
               height never move the search bar or shift the content sideways. -->
          <main
            class="newTabScreen"
            use:restoreScroll={tab.view}
            onscroll={(event) => {
              tab.view.scrollTop = event.currentTarget.scrollTop
            }}
          >
            <div class="newTabContent">
              <div class="workspaceTitle text-2xl leading-8" title={workspaceName}>{workspaceName}</div>

              <div class="searchRow">
                <!-- The 38px left padding starts the text after the 16px icon and an 8px gap. -->
                <span class="searchField">
                  <input
                    class="searchInput text-sm leading-5"
                    type="text"
                    value={tab.view.search}
                    aria-label="Search projects and collections"
                    placeholder="Search projects and collections"
                    spellcheck="false"
                    oninput={(event) => {
                      tab.view.search = event.currentTarget.value
                    }}
                  />
                  <Search class="searchIcon" size={16} aria-hidden="true" />
                </span>
                <button type="button" class="mockButton mockButton--action text-sm leading-5">
                  <Plus size={16} aria-hidden="true" />
                  <span class="mockButtonLabel">New Project</span>
                </button>
              </div>

              <p class="newTabHint text-xs leading-4">
                <Move size={14} aria-hidden="true" />
                Drag to reorder projects and collections
              </p>

              <div data-project-list>
                {#each visibleProjects as project (project.id)}
                  {@const projectDragging = reorderDrag?.kind === 'project' && reorderDrag.id === project.id}
                  <section class="projectSection" aria-label={project.name} data-project-id={project.id}>
                    {#if reorderDrag?.kind === 'project' && reorderDrag.target?.id === project.id}
                      <!-- The indicator overlays the middle of the 22px gap above the section, or the same spot below the last one. -->
                      <div class="moveHere" data-after={reorderDrag.target.after} data-blocked={isReorderBlocked} aria-hidden="true">
                        {#if isReorderBlocked}
                          <div class="moveHereBar"></div>
                        {:else}
                          <div class="moveHereBar"></div>
                          <div class="moveHereLabel text-sm leading-5">Move Here</div>
                          <div class="moveHereBar"></div>
                        {/if}
                      </div>
                    {/if}

                    <div class="projectHeader text-lg leading-7">
                      <!-- One drag handle covers the grip and the title; the -9px margin keeps the grip glyph 5px
                           outside the content edge inside its 26px cell. -->
                      <button
                        type="button"
                        class="draggableTitle"
                        aria-label={`Reorder ${project.name}`}
                        title="Drag to reorder"
                        data-dragging={projectDragging}
                        onpointerdown={(event) => startProjectDrag(event, project)}
                      >
                        <span class="draggableTitleGrip">
                          <GripVertical size={18} aria-hidden="true" />
                        </span>
                        <span class="projectTitle text-lg leading-7" title={project.name}>{project.name}</span>
                      </button>
                      <!-- The 40px outline icon button matches the New Collection button beside it. -->
                      <button type="button" class="mockButton mockButton--icon" aria-label="Edit Project" title="Edit Project">
                        <Settings size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        class="mockButton mockButton--action text-sm leading-5"
                        aria-haspopup="menu"
                        aria-expanded={collectionMenu?.projectId === project.id}
                        data-collection-menu-trigger
                        style:anchor-name={getCollectionMenuAnchor(project.id)}
                        onclick={() => toggleCollectionMenu(project.id)}
                      >
                        <Plus size={16} aria-hidden="true" />
                        <span class="mockButtonLabel">New Collection</span>
                      </button>
                    </div>

                    <div class="tileGrid" data-tile-grid>
                      {#each project.collections as item (item.id)}
                        {@const TileIcon = getCollectionIcon(item.kind)}
                        {@const detailParts = getDetailParts(item)}
                        {@const isOpen = openCollectionIds.includes(item.id)}
                        <div class="tileSlot">
                          <button
                            type="button"
                            class="tile"
                            data-open-in-tab={isOpen}
                            data-dragging={reorderDrag?.kind === 'collection' && reorderDrag.id === item.id}
                            onpointerdown={(event) => startTileDrag(event, project.id, item)}
                            onclick={() => openCollection(item.id)}
                          >
                            <span class="tileIconCell">
                              <TileIcon size={20} aria-hidden="true" />
                            </span>
                            <span class="tileTextStack">
                              <span class="tileName text-sm leading-5">{item.name}</span>
                              <span class="tileDetail text-xs leading-4.5" title={detailParts.join(' · ')}>
                                {#each detailParts as part, index (index)}
                                  {#if index > 0}
                                    <span class="separatorDot" aria-hidden="true"></span>
                                  {/if}
                                  <span class="tileDetailText">{part}</span>
                                {/each}
                              </span>
                            </span>
                            {#if isOpen}
                              <span class="openIndicator text-xs leading-4" title="Open in another tab">
                                <span class="openIndicatorDot" aria-hidden="true"></span>
                                Open
                              </span>
                            {/if}
                          </button>
                          {#if reorderDrag?.kind === 'collection' && reorderDrag.projectId === project.id && reorderDrag.target?.id === item.id}
                            <!-- The tile-high line starts at the tile's top and centers in the 8px gap on its left; the
                                 grid's end line centers in the gap after the last tile. -->
                            <div
                              class="tileDropIndicator"
                              data-edge={reorderDrag.target.after ? 'end' : 'left'}
                              data-blocked={isReorderBlocked}
                              aria-hidden="true"
                            >
                              <svg class="tileDropIndicatorSvg" width="10" height="100%">
                                <path class="tileDropIndicatorStroke" d="M1.5 3 L5 8 L8.5 3" />
                                <line class="tileDropIndicatorStroke" x1="5" y1="8" x2="5" y2="100%"></line>
                              </svg>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </section>
                {/each}
              </div>

              {#if hasSearch && visibleProjects.length === 0}
                <p class="newTabNoResults text-sm leading-5">No projects or collections match your search.</p>
              {/if}
            </div>
          </main>
        {/each}
      {:else}
        <div class="placeholder text-base leading-6">
          {selectedCollection ? 'Collection Screen' : (selectedFixedScreen?.screenLabel ?? '')}
        </div>
      {/if}
    </div>
  </div>

  {#if collectionMenu}
    <!-- New Collection menu: a 260px overlay card 4px below the trigger, right-aligned with it. -->
    <div
      bind:this={collectionMenuElement}
      class="dropdownLayer"
      style:position-anchor={getCollectionMenuAnchor(collectionMenu.projectId)}
    >
      <div class="dropdownCard" role="menu" aria-label="New Collection">
        {#each createCollectionItems as menuItem (menuItem.id)}
          {@const ItemIcon = menuItem.icon}
          <button
            type="button"
            class="dropdownItem"
            role="menuitem"
            onclick={() => {
              collectionMenu = null
            }}
          >
            <span class="dropdownItemIcon">
              <ItemIcon size={16} aria-hidden="true" />
            </span>
            <span class="dropdownItemLabel text-sm leading-5">{menuItem.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if reorderDrag}
    {@const GhostIcon = reorderDrag.ghost.icon}
    <!-- Cursor ghost 4px below and right of the pointer, showing the dragged item's icon and title. -->
    <div class="dragGhost" style:left={`${reorderDrag.ghost.x}px`} style:top={`${reorderDrag.ghost.y}px`}>
      <div class="dragGhostButton">
        <GhostIcon class="dragGhostIcon" size={16} aria-hidden="true" />
        <span class="dragGhostLabel text-sm leading-5">{reorderDrag.ghost.title}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .newTabMockup {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 640px;
    color: var(--ui-normal-text);
    font-family: var(--font-sans);
  }

  /* Matches the live drag cursor and keeps text from selecting while a project or tile drags. */
  .newTabMockup[data-reordering='true'],
  .newTabMockup[data-reordering='true'] :global(*) {
    cursor: grabbing !important;
    user-select: none;
  }

  /* ---- Title bar, copied from WindowsTitleBar.svelte without its drag regions ---- */

  .titlebar {
    display: flex;
    flex: none;
    align-items: center;
    background: var(--app-chrome-surface);
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

  /* Full-height row of touching screen buttons; the 1px side margins keep the outer pills 13px from the app icon and
     12px from the separator. */
  .titlebar__screens {
    display: flex;
    flex: none;
    align-self: stretch;
    margin: 0 1px;
  }

  .titlebar__screen {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    color: var(--ui-secondary-icon-glyph);
    cursor: default;
  }

  /* Hovered and selected screens use an inset pill, 36px square and 4px from its neighbours. */
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

  /* The tabs and the New Tab button; the right margin keeps at least a 40px gap before the window controls. */
  .titlebar__tab-row {
    display: flex;
    flex: 0 1 auto;
    align-self: stretch;
    min-width: 0;
    margin-right: 40px;
  }

  /* The 1px negative margins let the outer tabs overlap their surroundings so the outer pills stay in place. */
  .titlebar__tab-viewport {
    position: relative;
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    margin: 0 -1px;
  }

  /* Full-height strip of touching tabs that scrolls sideways once its tabs reach their minimum width. */
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

  /* The dragged tab keeps the selected hover fill, layered on the chrome surface so the tabs beneath stay hidden. */
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

  /* Full-height hit area touching the last tab; its pill sits 4px from the last tab pill. */
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
    cursor: default;
  }

  .titlebar__control:hover {
    background: var(--ui-neutral-action-fill);
  }

  .titlebar__control:active {
    background: var(--ui-neutral-action-hover-fill);
  }

  /* Native Windows close-button colors, as in the live title bar. */
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
    border: 2px solid var(--app-chrome-surface);
    box-sizing: content-box;
  }

  /* Windows glyph metrics are explicitly excluded to preserve native control rendering. */
  .titlebar__icon {
    font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif;
    font-size: 10px;
    line-height: 10px;
  }

  /* ---- App body: chrome-colored sidebar beside the darker screen surface ---- */

  .appBody {
    display: flex;
    flex: 1;
    min-height: 0;
    background: var(--app-chrome-surface);
  }

  .appSidebar {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid var(--ui-neutral-hover-border);
    border-right: 1px solid var(--ui-neutral-hover-border);
    user-select: none;
  }

  .mainScreenSurface {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: clip;
    background: var(--background);
    border-top: 1px solid var(--ui-neutral-hover-border);
  }

  .placeholder {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 0;
    color: var(--ui-muted-text);
  }

  /* ---- Sidebar header and button bar ---- */

  /* The 2px left margin is the live sidebar's content inset; the separator below spans the sidebar. */
  .sidebarHeader {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    margin-left: 2px;
    padding: 0 4px 0 10px;
  }

  /* A collection title lines up with the 36px collection screen header bar beside the sidebar. */
  .sidebarHeader[data-screen-header='true'] {
    min-height: 35px;
  }

  .sidebarHeaderTitleGroup {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-weight: var(--font-weight-semibold);
  }

  .sidebarHeaderTitleGroup :global(.sidebarHeaderIcon) {
    flex: none;
    margin-right: 4px;
    color: var(--ui-hoverable-icon-glyph);
  }

  .sidebarHeaderTitle {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-secondary-text);
  }

  .sidebarHeader[data-screen-header='true'] .sidebarHeaderTitle {
    color: var(--ui-normal-text);
  }

  .sidebarSeparator {
    flex: none;
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .sidebarButtonBar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 40px;
    margin-left: 2px;
    padding: 4px 8px;
  }

  /* Borderless dim icon button: a secondary glyph that brightens over the neutral action fill. */
  .mockIconButton {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-ghost-surface);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  .mockIconButton:is(:hover, :focus-visible) {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  /* ---- Outline buttons ---- */

  .mockButton {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    min-width: 0;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background-color: var(--ui-ghost-surface);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  .mockButton:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-subtle-action-hover-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .mockButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .mockButton :global(svg) {
    flex: 0 0 auto;
  }

  /* Dropdown triggers stay highlighted while their menu is open. */
  .mockButton[aria-expanded='true'] {
    background-color: var(--ui-neutral-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .mockButton--action {
    gap: 4px;
    height: 40px;
    max-width: 14rem;
    padding: 0 14px;
    overflow: hidden;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .mockButton--icon {
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockButton--showAll {
    gap: 4px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .mockButtonLabel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---- New Tab screen ---- */

  .newTabScreen {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .newTabContent {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 880px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .workspaceTitle {
    min-width: 0;
    margin-bottom: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.03em;
    font-weight: var(--font-weight-semibold);
    color: var(--ui-normal-text);
  }

  .searchRow {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .searchField {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .searchInput {
    width: 100%;
    min-width: 0;
    height: 40px;
    padding: 4px 14px 4px 38px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    outline: none;
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    transition:
      color var(--ui-animation-duration-standard),
      box-shadow var(--ui-animation-duration-standard),
      background-color var(--ui-animation-duration-standard),
      border-color var(--ui-animation-duration-standard);
  }

  .searchInput::placeholder {
    color: var(--ui-muted-text);
  }

  .searchInput::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .searchInput:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: var(--cthulhu-ui-shadow-focus);
  }

  /* The icon sits at the text's usual 14px inset past the 1px border, and brightens while the field has focus. */
  .searchField :global(.searchIcon) {
    position: absolute;
    top: 50%;
    left: 15px;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--ui-muted-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .searchField:focus-within :global(.searchIcon) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .newTabHint {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    padding-left: 4px;
    color: var(--ui-muted-text);
  }

  .newTabHint :global(svg) {
    flex: none;
    color: var(--ui-muted-icon-glyph);
  }

  .newTabNoResults {
    margin-top: 22px;
    color: var(--ui-muted-text);
  }

  .projectSection {
    position: relative;
    margin-top: 22px;
  }

  .projectHeader {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    margin-bottom: 8px;
  }

  /* The 3px vertical padding gives the title line a ghost highlight 6px taller than the text; the -9px margin keeps
     the grip glyph 5px outside the content edge. */
  .draggableTitle {
    display: flex;
    align-items: baseline;
    min-width: 0;
    margin-right: auto;
    margin-left: -9px;
    padding: 3px 8px 3px 0;
    border-radius: var(--cthulhu-ui-radius-control);
    background-color: var(--ui-ghost-surface);
    text-align: left;
    cursor: grab;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      box-shadow var(--ui-animation-duration-standard) ease;
  }

  .draggableTitle:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-normal-surface);
  }

  /* A dragged title shares the dragged-row fill and border; the inset border keeps the handle's size. */
  .draggableTitle[data-dragging='true'] {
    background-color: var(--ui-info-normal-surface);
    box-shadow: inset 0 0 0 1px var(--ui-info-muted-border);
  }

  .draggableTitle:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .draggableTitleGrip {
    display: flex;
    flex: none;
    align-self: center;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 28px;
    color: var(--ui-muted-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .draggableTitle:is(:hover, :focus-visible, [data-dragging='true']) .draggableTitleGrip {
    color: var(--ui-hoverable-icon-glyph);
  }

  .projectTitle {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
    color: var(--ui-normal-text);
  }

  /* ---- Project drop indicator: blue bars around Move Here, or one gray bar when the drop changes nothing ---- */

  .moveHere {
    position: absolute;
    right: 0;
    left: 0;
    top: -11px;
    display: grid;
    grid-template-columns: minmax(24px, 1fr) auto minmax(24px, 1fr);
    align-items: center;
    transform: translateY(-50%);
  }

  .moveHere[data-after='true'] {
    top: auto;
    bottom: -11px;
    transform: translateY(50%);
  }

  .moveHere[data-blocked='true'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .moveHereBar {
    height: 10px;
    border-radius: 999px;
    background: var(--ui-info-strong-border);
  }

  .moveHere[data-blocked='true'] .moveHereBar {
    background: var(--ui-muted-icon-glyph);
  }

  .moveHereLabel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    min-width: 96px;
    padding: 0 10px;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
    color: var(--ui-normal-text);
  }

  /* ---- Collection tiles ---- */

  .tileGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .tileSlot {
    position: relative;
    min-width: 0;
  }

  /* Bordered card on a raised surface that brightens with its icon on hover and focus. */
  .tile {
    display: grid;
    grid-template-columns: 34px 8px minmax(0, 1fr);
    align-items: center;
    width: 100%;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    background-color: var(--ui-neutral-normal-surface);
    color: var(--ui-hoverable-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  /* The open indicator takes a trailing column sized to its label. */
  .tile[data-open-in-tab='true'] {
    grid-template-columns: 34px 8px minmax(0, 1fr) auto;
  }

  .tile:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  /* A dragged tile takes the accent selection variant's dragged-row fill and border. */
  .tile[data-dragging='true'] {
    background-color: var(--ui-info-normal-surface);
    border-color: var(--ui-info-muted-border);
    color: var(--ui-normal-text);
  }

  .tileIconCell {
    display: flex;
    grid-column: 1;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    color: var(--ui-secondary-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .tile:is(:hover, :focus-visible, [data-dragging='true']) .tileIconCell {
    color: var(--ui-hoverable-icon-glyph);
  }

  .tileTextStack {
    display: flex;
    grid-column: 3;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tileName {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .tileDetail {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    color: var(--ui-muted-text);
  }

  .tileDetailText {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .separatorDot {
    display: inline-block;
    flex: 0 0 auto;
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: currentColor;
  }

  /* Green dot and label marking a collection that a work tab already shows. */
  .openIndicator {
    display: flex;
    grid-column: 4;
    align-items: center;
    gap: 5px;
    padding-left: 8px;
    white-space: nowrap;
    color: var(--ui-secondary-text);
  }

  .openIndicatorDot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--ui-success-normal-text);
  }

  /* ---- Tile drop indicator: a tile-high chevron line centered in the 8px gap left of a tile or after the last ---- */

  .tileDropIndicator {
    position: absolute;
    top: 0;
    bottom: 2px;
    width: 10px;
    transform: translateX(-50%);
  }

  .tileDropIndicator[data-edge='left'] {
    left: -4px;
  }

  .tileDropIndicator[data-edge='end'] {
    left: calc(100% + 4px);
  }

  .tileDropIndicatorSvg {
    display: block;
    overflow: visible;
  }

  .tileDropIndicatorStroke {
    fill: none;
    stroke: var(--ui-info-strong-border);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .tileDropIndicator[data-blocked='true'] .tileDropIndicatorStroke {
    stroke: var(--ui-muted-icon-glyph);
  }

  /* ---- New Collection menu ---- */

  .dropdownLayer {
    position: fixed;
    top: calc(anchor(bottom) + 4px);
    left: calc(anchor(right) - 260px);
    width: 260px;
    z-index: var(--z-popup);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: 0 0 12px var(--ui-shadow-raised);
    color: var(--ui-normal-text);
  }

  .dropdownCard {
    display: grid;
    padding: 4px;
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    background: var(--ui-card-overlay-surface);
  }

  .dropdownItem {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 4px 8px;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  .dropdownItem:is(:hover, :focus-visible) {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .dropdownItemIcon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--ui-hoverable-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .dropdownItem:is(:hover, :focus-visible) .dropdownItemIcon {
    color: var(--ui-normal-text);
  }

  .dropdownItemLabel {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* ---- Drag ghost ---- */

  .dragGhost {
    position: fixed;
    z-index: var(--z-drag);
    pointer-events: none;
  }

  .dragGhostButton {
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    min-width: 120px;
    max-width: 400px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
  }

  .dragGhostButton :global(.dragGhostIcon) {
    flex: 0 0 auto;
    color: var(--ui-hoverable-icon-glyph);
  }

  .dragGhostLabel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
