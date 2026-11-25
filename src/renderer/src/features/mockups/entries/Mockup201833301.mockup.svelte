<script lang="ts">
  import type { Action } from 'svelte/action'
  import {
    AlertCircle,
    Archive,
    ArrowUpToLine,
    Bug,
    Check,
    ChevronsDownUp,
    Download,
    EyeOff,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    Home,
    Layers,
    LayoutGrid,
    MoreHorizontal,
    Move,
    PanelLeftClose,
    PanelLeftOpen,
    PanelsTopLeft,
    Plus,
    Search,
    Settings,
    X,
    type LucideIcon
  } from '@lucide/svelte'
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

  /** One project section shown for the current search. */
  type VisibleProject = MockProject & {
    /** The project's collections the search hides from its grid. */
    hiddenCollectionCount: number
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
    icon: LucideIcon
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
    ghost: { title: string; icon: LucideIcon; x: number; y: number }
  }

  type ReorderOptions = {
    kind: ReorderDrag['kind']
    id: string
    projectId: string | null
    title: string
    icon: LucideIcon
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
        collection('component-library', 'Component Library Conventions and Patterns', 'template', 14, 18),
        collection('e2e-test-fixes', 'E2E Test Fixes', 'prompt', 3, 2)
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

  const createWorkTab = (id: string, collectionId: string | null, search = ''): WorkTab => ({
    id,
    collectionId,
    view: { search, scrollTop: 0 }
  })

  /** The last tab keeps a "test" search, which shows hidden collection cards and the hidden project count. */
  let workTabs = $state<WorkTab[]>([
    createWorkTab('tab-1', 'bug-triage'),
    createWorkTab('tab-2', 'code-review'),
    createWorkTab('tab-3', 'schema-migrations'),
    createWorkTab('tab-4', 'release-notes'),
    createWorkTab('tab-5', null),
    createWorkTab('tab-6', null, 'test')
  ])
  /** Suffix that keeps the IDs of tabs added from the New Tab button unique; starts at the seeded tab count. */
  let addedTabCount = 6
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
  /** System Settings and a work tab's collection have a sidebar; New Tab and the other screens fill the body. */
  const hasSidebar = $derived(selectedId === 'settings' || Boolean(selectedCollection))
  /** Sidebar expansion preference shared by System Settings and collection tabs, flipped by the title bar toggle. */
  let sidebarExpanded = $state(true)
  /** Screens without a sidebar always use the collapsed layout. */
  const isAppSidebarExpanded = $derived(hasSidebar && sidebarExpanded)
  /** Icon for the action the title bar's sidebar button performs. */
  const SidebarIcon = $derived(isAppSidebarExpanded ? PanelLeftClose : PanelLeftOpen)
  /** Tooltip and accessible name describing the sidebar action. */
  const sidebarLabel = $derived(isAppSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar')

  const getCollectionIcon = (kind: CollectionKind): LucideIcon => (kind === 'template' ? Layers : FileText)

  /** A collection tab is named after its collection and shows its kind icon; other tabs are New Tab. */
  const getTabDisplay = (tab: WorkTab): { title: string; icon: LucideIcon } => {
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

  /** Case-insensitive search text of the selected tab; empty matches everything. */
  const normalizedQuery = $derived((selectedWorkTab?.view.search ?? '').trim().toLowerCase())
  /** Projects whose names match keep every collection; others keep only matching collections, counting the rest as
      hidden, and hide without any. */
  const visibleProjects = $derived(
    projects.flatMap((project): VisibleProject[] => {
      if (project.name.toLowerCase().includes(normalizedQuery)) return [{ ...project, hiddenCollectionCount: 0 }]
      const collections = project.collections.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      return collections.length > 0
        ? [{ ...project, collections, hiddenCollectionCount: project.collections.length - collections.length }]
        : []
    })
  )
  /** Projects the search hides entirely, counted after the last visible project. */
  const hiddenProjectCount = $derived(projects.length - visibleProjects.length)

  // ---- Screens and work tabs ----

  /** Switches to a fixed screen and expands the sidebar; re-clicking the selected screen does nothing. */
  const activateFixedScreen = (screenId: string) => {
    if (screenId === selectedId) return
    selectedId = screenId
    sidebarExpanded = true
  }

  /** Selects a work tab; switching to a tab that shows a collection expands the sidebar, while reselecting keeps it. */
  const selectWorkTab = (tabId: string) => {
    const changedTab = selectedId !== tabId
    selectedId = tabId
    if (changedTab && workTabs.find((tab) => tab.id === tabId)?.collectionId) sidebarExpanded = true
  }

  /** Stationary tab strip that scrolls sideways and owns pointer capture while a tab drags. */
  let tabStripElement = $state<HTMLElement>()
  /** Viewport around the tab strip, whose bounds release a held strip width. */
  let tabViewportElement = $state<HTMLElement>()
  /** Dragged work tab and its horizontal offset from its current slot. */
  let draggedTab = $state<{ id: string; offsetX: number } | null>(null)
  /** Strip width held after a mouse close so the next close button lands under the pointer, or null while the tabs
      fill the row. */
  let heldStripWidth = $state<number | null>(null)
  /** Whether a tab is pressed, from pointer down through release, which keeps any held strip width. */
  let isTabPressed = false
  /** Vertical wheel input scrolls the tabs sideways at the rate the app's screens scroll. */
  const wheelScrollMultiplier = 0.4

  /** Appends a New Tab work tab and selects it. */
  const addWorkTab = () => {
    heldStripWidth = null
    addedTabCount += 1
    const tab = createWorkTab(`tab-${addedTabCount}`, null)
    workTabs.push(tab)
    selectWorkTab(tab.id)
  }

  /** Closes a work tab; closing the selected tab selects its right neighbour, else its left, else Home. */
  const closeWorkTab = (tabId: string) => {
    const wasSelected = selectedId === tabId
    const index = workTabs.findIndex((tab) => tab.id === tabId)
    workTabs = workTabs.filter((tab) => tab.id !== tabId)
    if (!wasSelected) return
    const nextTab = workTabs[index] ?? workTabs[index - 1]
    if (nextTab) selectWorkTab(nextTab.id)
    else selectedId = 'home'
  }

  /** Closes a tab from its close button or a middle click; mouse closes hold the strip's width so the next close
      button lands under the pointer. */
  const closeTab = (event: MouseEvent, tabId: string) => {
    if ((event as PointerEvent).pointerType === 'mouse') {
      /** Width shared by every tab slot. */
      const tabWidth = (event.currentTarget as HTMLElement).closest('.titlebar__tab')!.getBoundingClientRect().width
      // Closing the rightmost tab keeps the strip's right edge, so the remaining tabs widen under the pointer.
      heldStripWidth = tabWidth * (workTabs.at(-1)!.id === tabId ? workTabs.length : workTabs.length - 1)
    }
    closeWorkTab(tabId)
  }

  /** Releases a held strip width once the pointer is off the tabs and no tab is pressed. The live app polls the OS
      cursor because its drag region swallows pointer events; the mockup has no drag region, so pointer events do. */
  const releaseHeldStripWidth = (clientX: number, clientY: number) => {
    if (isTabPressed || heldStripWidth === null) return
    const rect = tabViewportElement!.getBoundingClientRect()
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      heldStripWidth = null
    }
  }

  /** Moves a dragged work tab into the given display slot. */
  const moveWorkTab = (tabId: string, index: number) => {
    const otherTabs = workTabs.filter((tab) => tab.id !== tabId)
    workTabs = [...otherTabs.slice(0, index), workTabs.find((tab) => tab.id === tabId)!, ...otherTabs.slice(index)]
  }

  /** Selects a work tab on a left press, then slides it along the strip once the pointer moves 4px. */
  const handleTabPointerDown = (event: PointerEvent, tabId: string) => {
    if (event.button !== 0) return
    isTabPressed = true
    selectWorkTab(tabId)
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
    const finish = (finishEvent: PointerEvent) => {
      draggedTab = null
      isTabPressed = false
      releaseHeldStripWidth(finishEvent.clientX, finishEvent.clientY)
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

  // ---- Tab strip overlay scrollbar, mirroring the shared Scrollbar the live title bar uses ----

  /** Shortest thumb, matching the shared scrollbar. */
  const minThumbPx = 20
  /** Delay before a scroll-revealed scrollbar starts fading while the pointer is off the tabs. */
  const scrollbarHideDelayMs = 500
  /** Tab strip's horizontal scroll position, visible width, and content width. */
  let tabScroll = $state({ offsetPx: 0, viewportPx: 0, contentPx: 0 })
  /** Whether the pointer is over the tabs, which keeps their scrollbar shown. */
  let isTabStripHovered = $state(false)
  /** Whether the scrollbar's thumb or track is being dragged, which keeps it shown. */
  let isDraggingTabScrollbar = $state(false)
  /** 'visible' while hovered, scrolling, or dragging; 'fading' fades out over 800ms; 'hidden' hides at once. */
  let tabScrollbarVisibility = $state<'visible' | 'fading' | 'hidden'>('hidden')
  let tabScrollbarHideTimeout: number | undefined
  let tabScrollbarTrackElement = $state<HTMLElement>()

  const isTabScrollbarNeeded = $derived(tabScroll.contentPx > tabScroll.viewportPx)
  /** The track spans the visible strip, so the thumb's share of it matches the visible share of the tabs. */
  const tabThumbLengthPx = $derived(
    tabScroll.contentPx <= 0
      ? tabScroll.viewportPx
      : Math.min(tabScroll.viewportPx, Math.max(minThumbPx, (tabScroll.viewportPx / tabScroll.contentPx) * tabScroll.viewportPx))
  )
  const tabThumbOffsetPx = $derived.by(() => {
    const maxScrollOffsetPx = tabScroll.contentPx - tabScroll.viewportPx
    return maxScrollOffsetPx > 0 ? (tabScroll.offsetPx / maxScrollOffsetPx) * (tabScroll.viewportPx - tabThumbLengthPx) : 0
  })

  /** Copies the tab strip's scroll position and extents into state. */
  const syncTabScroll = () => {
    tabScroll = {
      offsetPx: tabStripElement!.scrollLeft,
      viewportPx: tabStripElement!.clientWidth,
      contentPx: tabStripElement!.scrollWidth
    }
  }

  /** Shows the scrollbar when the tabs overflow, then fades it after a delay unless hovered or dragged. */
  const revealTabScrollbar = () => {
    window.clearTimeout(tabScrollbarHideTimeout)
    if (!isTabScrollbarNeeded) {
      tabScrollbarVisibility = 'hidden'
      return
    }
    tabScrollbarVisibility = 'visible'
    if (isTabStripHovered || isDraggingTabScrollbar) return
    tabScrollbarHideTimeout = window.setTimeout(() => {
      if (!isTabStripHovered && !isDraggingTabScrollbar) tabScrollbarVisibility = 'fading'
    }, scrollbarHideDelayMs)
  }

  /** Scrolls the strip so the thumb's left edge sits at the given track offset. */
  const setTabThumbOffset = (thumbOffsetPx: number) => {
    const maxThumbOffsetPx = tabScroll.viewportPx - tabThumbLengthPx
    const clampedOffsetPx = Math.min(Math.max(thumbOffsetPx, 0), maxThumbOffsetPx)
    tabStripElement!.scrollLeft =
      maxThumbOffsetPx > 0 ? (clampedOffsetPx / maxThumbOffsetPx) * (tabScroll.contentPx - tabScroll.viewportPx) : 0
  }

  /** Drags the thumb from where it was pressed, or centers it on a pressed track point and drags from there. */
  const handleTabScrollbarPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isDraggingTabScrollbar) return
    event.preventDefault()
    const track = event.currentTarget as HTMLElement
    const trackLeft = tabScrollbarTrackElement!.getBoundingClientRect().left
    const pressOffsetPx = event.clientX - trackLeft
    const pressedThumb = event.target !== track
    /** Pointer distance from the thumb's left edge, held for the whole drag. */
    const grabOffsetPx = pressedThumb
      ? Math.min(Math.max(pressOffsetPx - tabThumbOffsetPx, 0), tabThumbLengthPx)
      : tabThumbLengthPx / 2
    if (!pressedThumb) setTabThumbOffset(pressOffsetPx - grabOffsetPx)
    isDraggingTabScrollbar = true
    track.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => setTabThumbOffset(moveEvent.clientX - trackLeft - grabOffsetPx)
    const finish = () => {
      isDraggingTabScrollbar = false
      track.removeEventListener('pointermove', move)
      track.removeEventListener('pointerup', finish)
      track.removeEventListener('pointercancel', finish)
    }
    track.addEventListener('pointermove', move)
    track.addEventListener('pointerup', finish)
    track.addEventListener('pointercancel', finish)
  }

  // Side effect: re-measure the tab strip's scroll extents when it resizes or its tab count changes; observing fires
  // the first measurement.
  $effect(() => {
    void workTabs.length
    const observer = new ResizeObserver(syncTabScroll)
    observer.observe(tabStripElement!)
    return () => observer.disconnect()
  })

  // Side effect: show the scrollbar while the pointer is over overflowing tabs, fade it after the pointer leaves unless
  // its thumb is still dragged, and cancel any pending fade on unmount.
  $effect(() => {
    if (isTabStripHovered) revealTabScrollbar()
    else if (!isDraggingTabScrollbar) tabScrollbarVisibility = isTabScrollbarNeeded ? 'fading' : 'hidden'
    return () => window.clearTimeout(tabScrollbarHideTimeout)
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

  /** Opens a clicked collection in the selected tab, including collections already open elsewhere, and expands the
      sidebar beside it. */
  const openCollection = (collectionId: string) => {
    if (justDragged || !selectedWorkTab) return
    selectedWorkTab.collectionId = collectionId
    sidebarExpanded = true
  }

  // ---- Create Collection dialog, mirroring CreatePromptCollectionDialog and PromptCollectionNameDialog ----

  /** Collection types offered by the dialog's side-by-side picker, with the icons their tiles use and the bullet points
      listed under each card's header. */
  const collectionTypeOptions: { id: CollectionKind; label: string; bullets: string[]; icon: LucideIcon }[] = [
    {
      id: 'prompt',
      label: 'Task Collection',
      bullets: [
        'Describes one piece of work',
        'Refine it with the AI, then run it',
        "Mark it complete when it's done",
        'Apply a template to guide the work'
      ],
      icon: FileText
    },
    {
      id: 'template',
      label: 'Template Collection',
      bullets: [
        'Wraps a task when applied to it',
        'Guides how the AI does the work',
        'Lists steps for the AI to follow',
        'Sets response rules, like "be concise"'
      ],
      icon: Layers
    }
  ]

  /** Characters a collection's folder name cannot hold. */
  // eslint-disable-next-line no-control-regex
  const illegalNameCharacters = /[<>:"/\\|?*\x00-\x1f]/
  /** Windows device names a collection's folder cannot use. */
  const reservedNames = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((digit) => [`COM${digit}`, `LPT${digit}`])
  ])

  /** Folder name a collection saves under: its name without whitespace. */
  const getFolderName = (name: string): string => name.replace(/\s+/g, '')

  /** First rule a name breaks, worded like the live validation, including a folder name clash with another collection of
      the same type in the project; null when the name is valid. */
  const getCollectionNameError = (name: string, projectId: string, kind: CollectionKind): string | null => {
    if (!name.trim()) return 'Collection name cannot be empty'
    if (name.length > 100) return 'Collection name must be 100 characters or less'
    if (illegalNameCharacters.test(name)) return 'Collection name contains illegal characters: < > : " / \\ | ? *'
    const folderName = getFolderName(name).toLowerCase()
    if (reservedNames.has(folderName.toUpperCase())) return 'This is a reserved system name and cannot be used'
    if (name.startsWith('.') || name.endsWith('.')) return 'Collection name cannot start or end with dots'
    const project = projects.find((candidate) => candidate.id === projectId)
    const hasConflict = project?.collections.some(
      (item) => item.kind === kind && getFolderName(item.name).toLowerCase() === folderName
    )
    return hasConflict ? 'A collection with this name already exists' : null
  }

  /** Project that receives the collection created from its New Collection button; null while the dialog is closed. The
      mockup opens the dialog for Atlas Web on load. */
  let createCollectionProjectId = $state<string | null>('atlas-web')
  /** Type chosen in the dialog's picker; each opening starts on Task. */
  let createCollectionKind = $state<CollectionKind>('prompt')
  let createCollectionName = $state('')
  /** Validation messages wait until the name has been edited. */
  let hasEditedCollectionName = $state(false)
  /** Suffix that keeps the IDs of created collections unique. */
  let createdCollectionCount = 0

  /** Current name's validation error, which also disables the submit button. */
  const createCollectionError = $derived(
    createCollectionProjectId
      ? getCollectionNameError(createCollectionName, createCollectionProjectId, createCollectionKind)
      : null
  )

  /** Opens collection creation for one project with the Task type selected and an empty name. */
  const openCreateCollectionDialog = (projectId: string) => {
    createCollectionKind = 'prompt'
    createCollectionName = ''
    hasEditedCollectionName = false
    createCollectionProjectId = projectId
  }

  const closeCreateCollectionDialog = () => {
    createCollectionProjectId = null
  }

  /** Adds the trimmed name to the end of its project's collections, like the live create mutation, and closes. */
  const submitCreateCollection = () => {
    if (createCollectionError || !createCollectionProjectId) return
    const project = projects.find((candidate) => candidate.id === createCollectionProjectId)!
    createdCollectionCount += 1
    project.collections.push(
      collection(`created-${createdCollectionCount}`, createCollectionName.trim(), createCollectionKind, 0, null)
    )
    closeCreateCollectionDialog()
  }

  /** Side effect: shows the dialog as a native modal, which makes the screen behind it inert, focuses the name field,
      and returns focus to the opening button when the dialog unmounts. */
  const showModalDialog: Action<HTMLDialogElement> = (node) => {
    const opener = document.activeElement as HTMLElement | null
    node.showModal()
    node.querySelector('input')?.focus()
    return {
      destroy() {
        node.close()
        opener?.focus({ preventScroll: true })
      }
    }
  }

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
        /** Tile slots in display order, without the hidden-collections card that can follow them. */
        const slots = [...grid.querySelectorAll<HTMLElement>(':scope > [data-tile-slot]')]
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
{#snippet barButton(label: string, Icon: LucideIcon)}
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
          onclick={() => activateFixedScreen(screen.id)}
        >
          <ScreenIcon size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      {/each}
      <!-- The sidebar toggle names the action it performs, and is disabled on screens without a sidebar. -->
      <button
        type="button"
        class="titlebar__screen"
        disabled={!hasSidebar}
        aria-expanded={isAppSidebarExpanded}
        aria-label={sidebarLabel}
        title={sidebarLabel}
        onclick={() => {
          sidebarExpanded = !sidebarExpanded
        }}
      >
        <SidebarIcon size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </nav>

    <div class="titlebar__separator" aria-hidden="true"></div>

    <div class="titlebar__tab-row">
      <!-- Hovering the tabs shows their scrollbar, and vertical wheel input scrolls them sideways once they reach their
           120px minimum width. -->
      <div
        bind:this={tabViewportElement}
        class="titlebar__tab-viewport"
        role="presentation"
        onmouseenter={() => {
          isTabStripHovered = true
        }}
        onmouseleave={(event) => {
          isTabStripHovered = false
          releaseHeldStripWidth(event.clientX, event.clientY)
        }}
        onwheel={(event) => {
          tabStripElement!.scrollLeft += event.deltaY * wheelScrollMultiplier
        }}
        onmousedown={(event) => {
          // Middle presses would start Chromium's autoscroll on the overflowing strip and swallow the middle-click close.
          if (event.button === 1) event.preventDefault()
        }}
      >
        <div
          bind:this={tabStripElement}
          class="titlebar__tabs"
          role="tablist"
          aria-label="Open tabs"
          style:max-width={heldStripWidth === null ? undefined : `${heldStripWidth}px`}
          onscroll={() => {
            syncTabScroll()
            revealTabScrollbar()
          }}
        >
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
                if (event.button === 1) closeTab(event, tab.id)
              }}
            >
              <!-- The tab button covers the whole pill so presses around the close button still select and drag the tab.
                   Mouse presses select on pointer down; the click keeps Enter and Space selection. -->
              <button
                type="button"
                class="titlebar__tab-select text-sm leading-5"
                role="tab"
                aria-selected={selected}
                onpointerdown={(event) => handleTabPointerDown(event, tab.id)}
                onclick={() => selectWorkTab(tab.id)}
              >
                <TabIcon size={16} aria-hidden="true" />
                <span class="titlebar__tab-title">{display.title}</span>
              </button>
              <button
                type="button"
                class="titlebar__tab-close"
                aria-label={`Close ${display.title}`}
                title="Close Tab"
                onclick={(event) => closeTab(event, tab.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          {/each}
        </div>
        <!-- 3px overlay scrollbar along the bottom of the tabs, shown while they overflow and are hovered or scrolled.
             Pressing the track centers the thumb on the press and drags it from there. -->
        <div class="tabScrollbar" data-visibility={tabScrollbarVisibility} aria-hidden="true">
          <div
            bind:this={tabScrollbarTrackElement}
            class="tabScrollbarTrack"
            role="presentation"
            onpointerdown={handleTabScrollbarPointerDown}
          >
            <div
              class="tabScrollbarThumb"
              data-active={isDraggingTabScrollbar}
              style:width={`${tabThumbLengthPx}px`}
              style:transform={`translate3d(${tabThumbOffsetPx}px, 0, 0)`}
            ></div>
          </div>
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
    {#if isAppSidebarExpanded}
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
                    class="textInput text-sm leading-5"
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
                  {@const { hiddenCollectionCount } = project}
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
                        onclick={() => openCreateCollectionDialog(project.id)}
                      >
                        <Plus size={16} aria-hidden="true" />
                        <span class="mockButtonLabel">New Collection</span>
                      </button>
                    </div>

                    <!-- Equal rows keep the hidden-collections card as tall as a tile, even alone in its own row. -->
                    <div class="tileGrid" data-tile-grid>
                      {#each project.collections as item (item.id)}
                        {@const TileIcon = getCollectionIcon(item.kind)}
                        {@const detailParts = getDetailParts(item)}
                        {@const isOpen = openCollectionIds.includes(item.id)}
                        <div class="tileSlot" data-tile-slot>
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
                      {#if hiddenCollectionCount > 0}
                        <!-- A non-interactive placeholder in the cell after the last tile, where the grid's end drop
                             target already places a dropped tile after the last visible one. Its padding and gap line
                             its icon and text up with a tile's. -->
                        <div class="hiddenCollections">
                          <span class="hiddenCollectionsIcon">
                            <EyeOff size={20} aria-hidden="true" />
                          </span>
                          <span class="hiddenCollectionsText text-sm leading-5">
                            {hiddenCollectionCount} {hiddenCollectionCount === 1 ? 'Collection' : 'Collections'} Hidden
                          </span>
                        </div>
                      {/if}
                    </div>
                  </section>
                {/each}
              </div>

              {#if normalizedQuery && visibleProjects.length === 0}
                <p class="newTabNoResults text-sm leading-5">No projects or collections match your search.</p>
              {:else if hiddenProjectCount > 0}
                <p class="newTabHiddenProjects text-sm leading-5">
                  {hiddenProjectCount} {hiddenProjectCount === 1 ? 'Project' : 'Projects'} Hidden
                </p>
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

  {#if createCollectionProjectId}
    {@const nameError = hasEditedCollectionName ? createCollectionError : null}
    <!-- Create Collection dialog: a native modal card centered over a dimmed backdrop. Escape and the Close and Cancel
         buttons dismiss it; backdrop presses do not. -->
    <dialog
      class="dialogLayer"
      aria-label="Create Collection"
      use:showModalDialog
      oncancel={(event) => {
        event.preventDefault()
        closeCreateCollectionDialog()
      }}
    >
      <div class="dialogSurface">
        <div class="dialogHeader">
          <span class="dialogHeaderIcon">
            <FolderPlus size={24} aria-hidden="true" />
          </span>
          <div class="dialogHeaderText">
            <div class="dialogTitle text-lg leading-7">Create Collection</div>
            <span class="dialogSubtitle text-sm leading-5">Choose a type and name for the new collection.</span>
          </div>
          <button
            type="button"
            class="mockButton mockButton--close"
            aria-label="Close"
            onclick={closeCreateCollectionDialog}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div class="dialogSeparator" aria-hidden="true"></div>

        <div class="dialogFields">
          <div>
            <div class="fieldHeading">
              <div class="fieldTitle text-sm leading-5">Collection Type</div>
              <span id="new-tab-mockup-type-help" class="fieldHelp text-sm leading-5">
                Choose what the collection holds. The type can't be changed later.
              </span>
            </div>
            <!-- Side-by-side single-choice cards; each card carries its pressed state and the radio mark is decorative. -->
            <div class="optionCards" role="group" aria-label="Collection Type" aria-describedby="new-tab-mockup-type-help">
              {#each collectionTypeOptions as option (option.id)}
                {@const OptionIcon = option.icon}
                <button
                  type="button"
                  class="optionCard"
                  aria-pressed={createCollectionKind === option.id}
                  onclick={() => {
                    createCollectionKind = option.id
                  }}
                >
                  <span class="optionCardHeader">
                    <OptionIcon class="optionCardIcon" size={20} aria-hidden="true" />
                    <span class="optionCardLabel text-sm leading-5">{option.label}</span>
                    <span class="optionCardRadio" aria-hidden="true"></span>
                  </span>
                  <span class="optionCardBullets">
                    {#each option.bullets as bullet (bullet)}
                      <span class="optionCardBullet text-sm leading-5">{bullet}</span>
                    {/each}
                  </span>
                </button>
              {/each}
            </div>
          </div>

          <div>
            <div class="fieldHeading">
              <div class="fieldTitleRow">
                <div class="fieldTitle text-sm leading-5">Collection Name</div>
                <span class="fieldHelp text-sm leading-5">*</span>
              </div>
              <span id="new-tab-mockup-name-help" class="fieldHelp text-sm leading-5">
                Required. Names must be unique among collections of the same type.
              </span>
            </div>
            <!-- The validation message floats below the field, outside the dialog's layout flow. -->
            <div class="validationAnchor">
              <input
                class="textInput text-sm leading-5"
                type="text"
                placeholder="Name..."
                value={createCollectionName}
                aria-label="Collection Name"
                aria-invalid={nameError ? 'true' : undefined}
                aria-describedby="new-tab-mockup-name-help"
                oninput={(event) => {
                  createCollectionName = event.currentTarget.value
                  hasEditedCollectionName = true
                }}
                onkeydown={(event) => {
                  if (event.key === 'Enter') submitCreateCollection()
                }}
              />
              {#if nameError}
                <div class="validationMessage text-sm leading-5">
                  <AlertCircle class="validationMessageIcon" size={16} aria-hidden="true" />
                  {nameError}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="dialogSeparator" aria-hidden="true"></div>

        <div class="dialogFooter">
          <button
            type="button"
            class="mockButton mockButton--action mockButton--filled text-sm leading-5"
            onclick={closeCreateCollectionDialog}
          >
            <span class="mockButtonLabel">Cancel</span>
          </button>
          <button
            type="button"
            class="mockButton mockButton--action mockButton--filled mockButton--accent text-sm leading-5"
            disabled={Boolean(createCollectionError)}
            onclick={submitCreateCollection}
          >
            <span class="mockButtonLabel">Create Collection</span>
          </button>
        </div>
      </div>
    </dialog>
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

  .titlebar__screen:enabled:is(:hover, :focus-visible, [data-active='true']) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .titlebar__screen:where(:enabled):is(:hover, :focus-visible)::before {
    background: var(--ui-neutral-emphasis-surface);
  }

  /* Choosing the shown screen again does nothing, so its brighter fill stays the same while hovered. */
  .titlebar__screen[data-active='true']::before {
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
    background: var(--ui-neutral-emphasis-surface);
  }

  /* Choosing the selected tab again does nothing, so its brighter fill stays the same while hovered. */
  .titlebar__tab[data-selected='true']::before {
    background: var(--ui-neutral-selection-surface);
  }

  /* The dragged tab slides over its neighbours. */
  .titlebar__tab[data-dragging='true'] {
    z-index: 1;
  }

  /* The dragged tab keeps the selected fill, layered on the chrome surface so the tabs beneath stay hidden. */
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

  /* The sidebar toggle matches the shared disabled button appearance on screens without a sidebar; only the glyph
     fades. */
  .titlebar__screen:disabled :global(svg) {
    opacity: 0.5;
  }

  /* ---- Tab strip overlay scrollbar, copied from the shared Scrollbar along the bottom of the tabs ---- */

  .tabScrollbar {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    height: 3px;
    user-select: none;
  }

  .tabScrollbar[data-visibility='visible'] {
    z-index: var(--z-chrome);
    transition: opacity var(--ui-animation-duration-standard) linear;
  }

  .tabScrollbar:is([data-visibility='fading'], [data-visibility='hidden']) {
    opacity: 0;
    pointer-events: none;
  }

  .tabScrollbar[data-visibility='fading'] {
    transition: opacity 800ms linear;
  }

  .tabScrollbarTrack {
    position: relative;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  /* Thumb colors are copied from the shared Scrollbar component. */
  .tabScrollbarThumb {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: rgba(121, 121, 121, 0.4);
    touch-action: none;
  }

  .tabScrollbarThumb:hover {
    background: rgba(100, 100, 100, 0.7);
  }

  .tabScrollbarThumb[data-active='true'] {
    background: rgba(191, 191, 191, 0.4);
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

  .mockButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  /* Filled actions keep a white foreground in both idle and interacted states. */
  .mockButton--filled {
    background-color: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .mockButton--filled:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-action-hover-fill);
  }

  .mockButton--accent {
    background-color: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
  }

  .mockButton--accent:is(:hover, :focus-visible) {
    background-color: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  /* The dialog's 36px ghost close button keeps the stronger icon-button hover fill. */
  .mockButton--close {
    align-self: flex-start;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockButton--close:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-action-fill);
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

  /* Text field shared by the search bar and the Create Collection name field. */
  .textInput {
    width: 100%;
    min-width: 0;
    height: 40px;
    padding: 4px 14px;
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

  .textInput::placeholder {
    color: var(--ui-muted-text);
  }

  .textInput::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .textInput:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: var(--cthulhu-ui-shadow-focus);
  }

  .textInput[aria-invalid='true'] {
    border-color: var(--ui-danger-strong-border);
  }

  .textInput[aria-invalid='true']:focus-visible {
    box-shadow: var(--cthulhu-ui-shadow-focus-danger);
  }

  /* The search text starts after the 16px icon and an 8px gap. */
  .searchField .textInput {
    padding-left: 38px;
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

  .newTabNoResults,
  .newTabHiddenProjects {
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
    grid-auto-rows: minmax(0, 1fr);
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

  /* Dashed placeholder counting the collections a search hides; its border, padding, and 34px icon cell match a
     tile's. */
  .hiddenCollections {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border: 1px dashed var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-muted-text);
  }

  .hiddenCollectionsIcon {
    display: flex;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    color: var(--ui-muted-icon-glyph);
  }

  .hiddenCollectionsText {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  /* ---- Create Collection dialog, copied from Popup, Dialog, OptionCardSelector, and FloatingValidationMessage ---- */

  /* Full-window native modal layer that centers the card 16px inside the viewport. */
  .dialogLayer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 16px;
    border: 0;
    background: var(--ui-ghost-surface);
    color: var(--ui-normal-text);
  }

  .dialogLayer[open] {
    display: flex;
  }

  .dialogLayer::backdrop {
    background: var(--ui-card-normal-shadow);
  }

  /* Overlay card: header, separator, fields, separator, and footer. The 18px top padding is for a header with a
     subtitle. */
  .dialogSurface {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 660px;
    min-width: 0;
    max-height: calc(100vh - 32px);
    padding: 18px 0 16px;
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    background: var(--ui-card-overlay-surface);
    box-shadow: 0 8px 12px var(--ui-card-normal-shadow);
  }

  /* A 40px icon cell beside the title and its wrapping subtitle, with the close button at the top right. */
  .dialogHeader {
    display: flex;
    align-items: center;
    column-gap: 12px;
    min-width: 0;
    padding: 0 20px 16px;
  }

  .dialogHeaderIcon {
    display: flex;
    flex: 0 0 40px;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--ui-hoverable-icon-glyph);
  }

  .dialogHeaderText,
  .fieldHeading {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .dialogTitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .dialogSubtitle,
  .fieldHelp {
    overflow-wrap: anywhere;
    color: var(--ui-muted-text);
  }

  .dialogSeparator {
    flex: none;
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  /* Fields sit 32px from the card's sides: the dialog body's 16px inset plus the fields' own 16px padding. */
  .dialogFields {
    display: grid;
    gap: 17px;
    min-width: 0;
    padding: 16px 32px;
  }

  .fieldHeading {
    margin-bottom: 7px;
  }

  .fieldTitleRow {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .fieldTitle {
    font-weight: var(--font-weight-semibold);
    color: var(--ui-normal-text);
  }

  .dialogFooter {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    padding: 16px 16px 0;
  }

  /* Two equal-height single-choice cards side by side: a header row with the icon, label, and radio mark above a
     divider and a short bullet list. Hover, focus, and selection color only the card border and the header row and
     leave the bullet body clear: gray while hovered or focused, accent while selected. */
  .optionCards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .optionCard {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    text-align: left;
    transition:
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .optionCard:is(:hover, :focus-visible) {
    border-color: var(--ui-neutral-emphasis-border);
    color: var(--ui-normal-text);
  }

  .optionCard:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  /* Choosing the selected option again does nothing, so it keeps its accent colors while hovered. */
  .optionCard[aria-pressed='true'] {
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  /* The header's top corners follow the card's inner radius so its tint stays inside the rounded border. */
  .optionCardHeader {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 12px 12px 11px 14px;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    border-radius: calc(var(--cthulhu-ui-radius-control) - 1px) calc(var(--cthulhu-ui-radius-control) - 1px) 0 0;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out;
  }

  /* The divider takes the card's border color in each state. */
  .optionCard:is(:hover, :focus-visible) .optionCardHeader {
    background: var(--ui-neutral-subtle-action-hover-fill);
    border-bottom-color: var(--ui-neutral-emphasis-border);
  }

  .optionCard[aria-pressed='true'] .optionCardHeader {
    background: var(--ui-accent-action-fill);
    border-bottom-color: var(--ui-accent-normal-border);
  }

  .optionCard :global(.optionCardIcon) {
    flex: none;
    color: var(--ui-hoverable-icon-glyph);
  }

  .optionCard:is(:hover, :focus-visible, [aria-pressed='true']) :global(.optionCardIcon) {
    color: var(--ui-normal-text);
  }

  .optionCardLabel {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .optionCardBullets {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 11px 14px 13px;
  }

  /* Each bullet hangs its wrapped lines past a 4px dot centered on the first line. Bullets and dots keep these colors
     in every state, so only the header brightens. */
  .optionCardBullet {
    position: relative;
    padding-left: 14px;
    color: var(--ui-secondary-text);
    text-wrap: pretty;
  }

  .optionCardBullet::before {
    position: absolute;
    top: 8px;
    left: 1px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--ui-muted-icon-glyph);
    content: '';
  }

  /* Decorative 17px radio mark whose white center shows on the selected card. */
  .optionCardRadio {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 50%;
  }

  .optionCardRadio::after {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    content: '';
  }

  .optionCard[aria-pressed='true'] .optionCardRadio {
    border-color: var(--ui-accent-normal-border);
  }

  .optionCard[aria-pressed='true'] .optionCardRadio::after {
    background: var(--ui-normal-text);
  }

  .validationAnchor {
    position: relative;
  }

  /* Danger row floating 2px below the field, tinted toward the danger border. */
  .validationMessage {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: var(--z-overlay);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    margin-top: 2px;
    padding: 0 12px;
    border-radius: var(--cthulhu-ui-radius-control);
    background: color-mix(in oklch, var(--ui-card-solid-surface) 76%, var(--ui-danger-strong-border));
    box-shadow: 0 8px 18px var(--ui-card-normal-shadow);
    white-space: nowrap;
    color: var(--ui-normal-text);
  }

  .validationMessage :global(.validationMessageIcon) {
    flex: none;
    color: var(--ui-danger-icon-glyph);
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
