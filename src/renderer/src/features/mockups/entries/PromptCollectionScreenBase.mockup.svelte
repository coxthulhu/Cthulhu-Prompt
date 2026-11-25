<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import {
    AlertCircle,
    Ban,
    Check,
    Archive,
    ArrowRight,
    ArrowUpToLine,
    Clock,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ChevronsDownUp,
    ChevronsUpDown,
    CircleCheckBig,
    CircleDashed,
    ClipboardCheck,
    Copy,
    Eye,
    EyeOff,
    FileText,
    Folder,
    FolderCog,
    FolderOpen,
    GripVertical,
    Icon as CustomIcon,
    Layers,
    LayoutGrid,
    ListTodo,
    Maximize2,
    MoreHorizontal,
    NotebookPen,
    Pencil,
    Play,
    Plus,
    Search,
    Settings,
    Trash2,
    Zap,
    X,
    type LucideIcon,
    type LucideIconData
  } from '@lucide/svelte'
  import * as monaco from 'monaco-editor'
  import { estimateTokenCount } from 'tokenx'
  import ResizeSash from '@renderer/common/cthulhu-ui/layout/ResizeSash.svelte'

  // Standalone snapshot of a work tab's collection screen beside its Tab Collection Sidebar: all fixtures,
  // controls, and mutations live here. Only third-party Svelte/icons/Monaco/token counting, the host's
  // palette/theme, and the shared ResizeSash are reused. Editor sizing uses application defaults.
  // Snapshot: project breadcrumb, sidebar status accordion and prompt tree with scroll-follow selection,
  // attached notes, arrow-key field navigation, shared wheel scrolling, and drag/drop between both panes.
  // No workspace, IPC, settings, or domain mutations are used; Show All and Open in editor are inert.
  const NO_TEMPLATE_LABEL = 'No template'
  /** Lucide notebook-pen with its lower-right corner opened for a delete mark, matching the live NotebookX icon. */
  const notebookXIcon: LucideIconData = {
    name: 'notebook-x',
    node: [
      ['path', { d: 'M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7' }],
      ['path', { d: 'M2 6h4' }],
      ['path', { d: 'M2 10h4' }],
      ['path', { d: 'M2 14h4' }],
      ['path', { d: 'M2 18h4' }],
      ['path', { d: 'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z' }],
      ['path', { d: 'm17 17 5 5' }],
      ['path', { d: 'm22 17-5 5' }]
    ]
  }
  const TEMPLATE_NOT_SELECTED_LABEL = 'Not selected'

  const MockPromptStatus = {
    Todo: 'Todo',
    InProgress: 'InProgress',
    Completed: 'Completed',
    Backlog: 'Backlog',
    Archived: 'Archived'
  } as const
  type MockPromptStatus = (typeof MockPromptStatus)[keyof typeof MockPromptStatus]

  const statusItems = [
    { id: MockPromptStatus.Todo, label: 'Todo', detail: 'Move back to active todo status', icon: CircleDashed },
    { id: MockPromptStatus.InProgress, label: 'In Progress', detail: 'Mark this prompt as underway', icon: Play },
    { id: MockPromptStatus.Backlog, label: 'Backlog', detail: 'Save this prompt for future work', icon: Clock },
    { id: MockPromptStatus.Completed, label: 'Complete', selectedLabel: 'Completed', detail: 'Move this prompt to completed', icon: Check },
    { id: MockPromptStatus.Archived, label: 'Archived', detail: 'Archived prompts must be restored to another status', icon: Archive }
  ]

  /** Opening point of the open menu: the cursor, or the trigger's left edge and middle for keyboard opening. */
  let menuPoint = { x: 0, y: 0 }
  /** Records where a menu opens; context menus open slightly right of the cursor like the live dropdowns. */
  const captureMenuPoint = (event: MouseEvent, anchor: HTMLElement, isContextMenu = false) => {
    const rect = anchor.getBoundingClientRect()
    menuPoint = event.detail === 0 && !isContextMenu
      ? { x: rect.left, y: rect.top + rect.height / 2 }
      : { x: event.clientX + (isContextMenu ? 4 : 0), y: event.clientY }
  }
  /** Closes every local popup menu. */
  const closeMenus = () => {
    statusMenuId = null
    deleteMenuId = null
    noteMenuId = null
    isCollectionActionsOpen = false
    categoryMenu = null
  }

  // Side effect: portal the local popup, size it to its content, and center its first item on the opening point.
  const mountMockMenu = (node: HTMLElement, options: { anchor: HTMLElement; isContextMenu?: boolean }) => {
    const { anchor, isContextMenu = false } = options
    document.body.appendChild(node)
    const point = menuPoint
    const menu = node.getBoundingClientRect()
    node.style.left = `${Math.max(16, Math.min(point.x, window.innerWidth - menu.width - 16))}px`
    node.style.top = `${Math.max(16, Math.min(point.y - 25, window.innerHeight - menu.height - 8))}px`
    const dismiss = (event: PointerEvent) => {
      if (node.contains(event.target as Node)) return
      // Toggle triggers close from their own click; context menus also close on a left press over their row.
      if (anchor.contains(event.target as Node) && !(isContextMenu && event.button === 0)) return
      closeMenus()
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (anchor instanceof HTMLButtonElement) anchor.focus()
        else anchor.querySelector('button')?.focus()
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const items = [...node.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
      items[next]?.focus()
    }
    const preventBackgroundScroll = (event: Event) => {
      if (!node.contains(event.target as Node)) event.preventDefault()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', keydown)
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false })
    return { destroy: () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('wheel', preventBackgroundScroll)
      node.remove()
    } }
  }
  let deleteAnchor = $state<HTMLElement | null>(null)
  let statusAnchor = $state<HTMLElement | null>(null)
  const toggleStatusMenu = (prompt: MockPrompt, event: MouseEvent) => {
    const isOpen = statusMenuId === prompt.id
    closeMenus()
    if (isOpen) return
    statusAnchor = (event.currentTarget as HTMLElement).parentElement
    captureMenuPoint(event, statusAnchor!)
    statusMenuId = prompt.id
  }

  type MockIconButtonOptions = {
    active?: boolean
    ariaExpanded?: boolean
    ariaHaspopup?: 'menu'
    ariaPressed?: boolean
    baseVariant?: 'normal' | 'dim' | 'muted'
    borderless?: boolean
    disabled?: boolean
    hoverVariant?: 'neutral' | 'accent' | 'success' | 'danger' | 'glyph'
    iconClass?: string
    /** Custom Lucide glyph for actions such as notebook deletion. */
    customIcon?: LucideIconData
    iconSize?: number
    onclick?: (event: MouseEvent) => void
    size?: 'default' | 'compact' | 'compact-large-icon' | 'tiny' | 'sidebar-rail'
    testId?: string
  }

  type MockDocument = {
    fixedHeightPx?: number
    id: string
    minLines?: number
    text: string
  }

  type MockAttachedNote = MockDocument & {
    visible: boolean
    isEdited: boolean
    modifiedLabel: string
  }

  type MockPrompt = MockDocument & {
    note?: MockAttachedNote
    title: string
    categoryId: string
    templateLabel: string
    modifiedLabel: string
    finalizedAt: number | null
    status: MockPromptStatus
    templateIds: string[]
    templateState: 'not-selected' | 'no-template' | 'selected'
    isEdited: boolean
  }

  type MockTemplate = {
    id: string
    title: string
    text?: string
  }

  type MockTemplateGroup = {
    id: string
    title: string
    templates: MockTemplate[]
    children: MockTemplateGroup[]
  }

  type MockCategory = {
    id: string
    title: string
    shortDescription: string
    description: string
    prompts: MockPrompt[]
    collapsed?: boolean
  }

  type MockCategoryDraft = MockDocument & {
    title: string
    shortDescription: string
    hasInteracted: boolean
  }

  const createPrompt = (
    id: string,
    title: string,
    categoryId: string,
    templateLabel: string,
    text: string,
    status: MockPromptStatus = MockPromptStatus.Todo,
    appearance: Partial<Pick<MockPrompt, 'isEdited' | 'modifiedLabel' | 'finalizedAt' | 'note'>> = {}
  ): MockPrompt => ({
    id,
    title,
    categoryId,
    templateLabel,
    modifiedLabel: 'Updated today',
    isEdited: false,
    finalizedAt: status === 'Completed' || status === 'Archived' ? Date.now() : null,
    status,
    templateIds:
      templateLabel === 'Draft Implementation Plan' ? ['draft-implementation-plan'] : [],
    templateState:
      templateLabel === TEMPLATE_NOT_SELECTED_LABEL
        ? 'not-selected'
        : templateLabel === NO_TEMPLATE_LABEL
          ? 'no-template'
          : 'selected',
    text,
    ...appearance
  })

  const templateCollections: MockTemplateGroup[] = [
    {
      id: 'product-templates',
      title: 'Product Templates',
      templates: [
        { id: 'turn-notes-into-requirements', title: 'Turn Notes into Requirements', text: 'Turn these notes into specific requirements and acceptance criteria.\n\n[[PROMPT_TEXT]]' },
        { id: 'draft-implementation-plan', title: 'Draft Implementation Plan', text: 'Create a repository-grounded implementation plan.\n\n[[PROMPT_TEXT]]\n\nInclude focused validation for each step.' }
      ],
      children: [
        {
          id: 'implementation-templates',
          title: 'Implementation',
          templates: [
            { id: 'implement-approved-change', title: 'Implement Approved Change', text: 'Implement this approved change using the repository conventions.\n\n[[PROMPT_TEXT]]\n\nRun the relevant checks and report the outcome.' },
            { id: 'add-regression-coverage', title: 'Add Regression Coverage', text: 'Add focused regression coverage for the following behavior.\n\n[[PROMPT_TEXT]]' }
          ],
          children: []
        }
      ]
    },
    {
      id: 'review-templates',
      title: 'Review Templates',
      templates: [{ id: 'review-completed-change', title: 'Review Completed Change', text: 'Review the following change for concrete defects.\n\n[[PROMPT_TEXT]]\n\nInclude file locations and reproduction steps for each finding.' }],
      children: [
        {
          id: 'handoff-templates',
          title: 'Handoff',
          templates: [
            { id: 'prepare-final-handoff', title: 'Prepare Final Handoff', text: 'Summarize the outcome, changed files, and verification results.\n\n[[PROMPT_TEXT]]' },
            { id: 'update-developer-docs', title: 'Update Developer Documentation', text: 'Update the developer documentation for this change.\n\n[[PROMPT_TEXT]]' }
          ],
          children: []
        }
      ]
    }
  ]

  const getTemplateCount = (group: MockTemplateGroup): number =>
    group.templates.length +
    group.children.reduce((count, child) => count + getTemplateCount(child), 0)

  const getTemplates = (group: MockTemplateGroup): MockTemplate[] => [
    ...group.templates,
    ...group.children.flatMap(getTemplates)
  ]

  const collapsedTemplateCategoryIds = new SvelteSet<string>()
  const selectedTemplateIds = new SvelteSet<string>()
  let templateDialogPrompt = $state<MockPrompt | null>(null)
  let templateDialogMode = $state<'select' | 'select-and-copy'>('select')

  const openTemplateDialog = (
    prompt: MockPrompt,
    mode: 'select' | 'select-and-copy' = 'select'
  ) => {
    templateDialogPrompt = prompt
    templateDialogMode = mode
    collapsedTemplateCategoryIds.clear()
    selectedTemplateIds.clear()
    if (mode === 'select') {
      const selectedTemplateId = prompt.templateIds[0]
      if (selectedTemplateId) selectedTemplateIds.add(selectedTemplateId)
    }
  }

  const closeTemplateDialog = () => {
    templateDialogPrompt = null
  }

  const selectTemplate = (template: MockTemplate | null) => {
    if (!templateDialogPrompt) return

    if (templateDialogMode === 'select-and-copy') {
      const prompt = templateDialogPrompt
      closeTemplateDialog()
      requestCopyPrompt(prompt, template)
      return
    }

    if (!template) {
      selectedTemplateIds.clear()
      return
    }

    selectedTemplateIds.clear()
    selectedTemplateIds.add(template.id)
  }

  /** Double-clicking an option in select mode applies it and copies immediately, like quick selection. */
  const selectAndCopyTemplate = (template: MockTemplate | null) => {
    if (!templateDialogPrompt) return
    const prompt = templateDialogPrompt
    closeTemplateDialog()
    requestCopyPrompt(prompt, template)
  }

  const confirmTemplateSelections = () => {
    if (!templateDialogPrompt) return
    const selectedTemplates = templateCollections
      .flatMap(getTemplates)
      .filter((template) => selectedTemplateIds.has(template.id))

    templateDialogPrompt.templateIds = selectedTemplates.map((template) => template.id)
    templateDialogPrompt.templateLabel = selectedTemplates.length
      ? selectedTemplates.map((template) => template.title).join(', ')
      : NO_TEMPLATE_LABEL
    templateDialogPrompt.templateState = selectedTemplates.length ? 'selected' : 'no-template'
    closeTemplateDialog()
  }

  const toggleTemplateCategory = (categoryId: string) => {
    if (collapsedTemplateCategoryIds.has(categoryId)) collapsedTemplateCategoryIds.delete(categoryId)
    else collapsedTemplateCategoryIds.add(categoryId)
  }

  let rootPrompts = $state<MockPrompt[]>([
    createPrompt(
      'base-discovery',
      'Map the current implementation',
      'base-root',
      TEMPLATE_NOT_SELECTED_LABEL,
      [
        'Inspect the existing implementation and summarize the relevant components, data flow, and tests.',
        '',
        'Call out constraints that the change must preserve.'
      ].join('\n'),
      MockPromptStatus.InProgress,
      { note: {
        id: 'base-discovery-note', minLines: 1, visible: true, isEdited: false,
        modifiedLabel: 'Updated today',
        text: '## Investigation notes\n\nThe collection screen owns the editing workflow; the sidebar handles navigation.\nKeep keyboard focus in the current editor when reordering prompts.'
      } }
    ),
    createPrompt(
      'base-requirements',
      'Turn notes into requirements',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        'Convert the supplied product notes into a concise implementation checklist.',
        '',
        'Separate required behavior from optional polish.'
      ].join('\n'),
      MockPromptStatus.Todo,
      { isEdited: true, note: {
        id: 'base-requirements-note', minLines: 1, visible: false, isEdited: false,
        modifiedLabel: 'Updated yesterday',
        text: 'Confirm the acceptance criteria with the product owner.\nKeep optional polish out of the initial implementation.'
      } }
    ),
    createPrompt(
      'base-plan',
      'Draft an implementation plan',
      'base-root',
      'Draft Implementation Plan',
      [
        '## Implementation plan',
        '',
        'Create an implementation plan grounded in the current repository.',
        '',
        '- Identify the components and data boundaries affected by the change.',
        '- Preserve keyboard navigation and focus behavior.',
        '- Include the files to change and focused verification for each step.',
        '',
        'Return a checklist with concrete acceptance criteria.'
      ].join('\n'),
      MockPromptStatus.Todo,
      { modifiedLabel: 'Updated yesterday' }
    ),
    createPrompt(
      'base-review',
      'Review the completed change',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        'Review the completed change for user-visible regressions, missing edge cases, and unnecessary complexity.',
        '',
        'Report only concrete findings.'
      ].join('\n'),
      MockPromptStatus.Completed,
      { finalizedAt: Date.now() - 86_400_000, note: {
        id: 'base-review-note', minLines: 1, visible: true, isEdited: false,
        modifiedLabel: 'Updated yesterday',
        text: 'Review complete. Keyboard navigation and category expansion verified.\nFollow-up: check the compact toolbar at smaller window widths.'
      } }
    ),
    createPrompt(
      'base-docs',
      'Update developer documentation',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        'Update the relevant developer documentation to match the implemented behavior.',
        '',
        'Keep the guidance specific to this repository.'
      ].join('\n'),
      MockPromptStatus.Backlog
    ),
    createPrompt(
      'base-handoff',
      'Prepare the final handoff',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        'Prepare a short handoff with the outcome, changed files, and verification results.',
        '',
        'Mention any remaining risk explicitly.'
      ].join('\n'),
      MockPromptStatus.Archived,
      { finalizedAt: Date.now() - 3 * 86_400_000 }
    ),
    createPrompt(
      'base-audit',
      'Audit the current settings flow',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        'Walk through the current settings flow and list every screen, field, and saved value.',
        '',
        'Note any field that saves without validation.'
      ].join('\n'),
      MockPromptStatus.Completed,
      { finalizedAt: Date.now() - 2 * 86_400_000, modifiedLabel: 'Updated 2 days ago' }
    )
  ])

  let categories = $state<MockCategory[]>([
    {
      id: 'base-implementation',
      title: 'Implementation',
      shortDescription: 'Build approved product changes.',
      description: 'Prompts used while implementing an approved product change.',
      prompts: [
        createPrompt(
          'base-build',
          'Implement the approved change',
          'base-implementation',
          NO_TEMPLATE_LABEL,
          [
            'Implement the approved change using the existing architecture and shared UI components.',
            '',
            'Keep the patch focused and preserve unrelated work in the tree.'
          ].join('\n'),
          MockPromptStatus.InProgress
        ),
        createPrompt(
          'base-settings-api',
          'Wire the notification settings API',
          'base-implementation',
          'Draft Implementation Plan',
          [
            'Add the notification settings endpoints behind the existing preferences service.',
            '',
            '- Validate every field before saving.',
            '- Return the saved settings so the client can refresh its cache.'
          ].join('\n'),
          MockPromptStatus.Todo,
          { isEdited: true }
        ),
        createPrompt(
          'base-settings-panel',
          'Build the notification settings panel',
          'base-implementation',
          NO_TEMPLATE_LABEL,
          [
            'Build the notification settings panel using the shared form controls.',
            '',
            'Disable Save until a field changes and show inline validation errors.'
          ].join('\n'),
          MockPromptStatus.Todo,
          { modifiedLabel: 'Updated yesterday' }
        )
      ],
    },
    {
      id: 'base-verification',
      title: 'Verification',
      shortDescription: 'Validate behavior and release readiness.',
      description: 'Prompts for validating product behavior and preparing a release.',
      collapsed: true,
      prompts: [
        createPrompt('base-regression', 'Add focused regression coverage',
          'base-verification', NO_TEMPLATE_LABEL, 'Assert the visible user flow before implementation details.'),
        createPrompt('base-backlog', 'Explore follow-up improvements',
          'base-verification', TEMPLATE_NOT_SELECTED_LABEL, 'Collect follow-up ideas after validating the current change.', MockPromptStatus.Backlog),
        createPrompt('base-completed', 'Verify the release checklist',
          'base-verification', NO_TEMPLATE_LABEL, 'Confirm the release checklist matches the delivered behavior.', MockPromptStatus.Completed),
        createPrompt('base-archived', 'Retire the earlier approach',
          'base-verification', NO_TEMPLATE_LABEL, 'Keep the earlier design notes available for reference.', MockPromptStatus.Archived)
      ]
    },
    {
      id: 'base-release',
      title: 'Release preparation',
      shortDescription: 'Ready for the next release cycle.',
      description: 'Add release notes and handoff prompts here once verification is complete.',
      prompts: []
    }
  ])

  /** Header filters list category workflows before finalized groups, like the live status registry. */
  const groups = ['Active', 'Backlog', 'Completed', 'Archived'] as const
  type MockGroup = (typeof groups)[number]
  type MockFinalGroup = 'Completed' | 'Archived'
  const isFinalGroup = (group: MockGroup): group is MockFinalGroup =>
    group === 'Completed' || group === 'Archived'
  let screenMode = $state<MockGroup>('Active')
  /** Project that owns this collection, shown first in the breadcrumb. */
  const projectName = 'Customer Portal'
  let rootTitle = $state('Product Work')
  let statusMenuId = $state<string | null>(null)
  let deleteMenuId = $state<string | null>(null)
  let noteMenuId = $state<string | null>(null)
  let noteAnchor = $state<HTMLElement | null>(null)
  /** Sidebar button-bar Selected Collection Actions menu. */
  let isCollectionActionsOpen = $state(false)
  let collectionActionsAnchor = $state<HTMLElement | null>(null)
  /** Category context menu opened from one status tree's category row. */
  let categoryMenu = $state<{ group: MockGroup; categoryId: string; anchor: HTMLElement } | null>(null)
  let findOpen = $state(false)
  let findQuery = $state('')
  let findIndex = $state(0)
  let findNavigated = $state(false)
  let findInput = $state<HTMLTextAreaElement | null>(null)
  let viewport = $state<HTMLDivElement | null>(null)
  let viewportHeight = $state(0)
  let breadcrumbCategoryId = $state<string | null>(null)
  let copiedPromptId = $state<string | null>(null)
  let copyResetTimer: number | undefined
  const mountedEditors = new SvelteMap<string, monaco.editor.IStandaloneCodeEditor>()
  const editorFindDecorations = new SvelteMap<string, monaco.editor.IEditorDecorationsCollection>()
  // Local view states retain each editor's caret when a note or category is hidden.
  const editorViewStates = new SvelteMap<string, monaco.editor.ICodeEditorViewState>()
  const editorHeightSync = new SvelteMap<string, () => void>()
  const noteHeights = new SvelteMap<string, number>()
  const isFinalMode = $derived(screenMode === 'Completed' || screenMode === 'Archived')
  const allPrompts = $derived([...rootPrompts, ...categories.flatMap((category) => category.prompts)])
  const matchesGroup = (prompt: MockPrompt, group = screenMode) => group === 'Active'
    ? prompt.status === MockPromptStatus.Todo || prompt.status === MockPromptStatus.InProgress
    : prompt.status === group
  const finalizedPrompts = $derived(allPrompts.filter((prompt) => matchesGroup(prompt))
    .sort((left, right) => (right.finalizedAt ?? 0) - (left.finalizedAt ?? 0)))
  const breadcrumbCategory = $derived(isFinalMode ? null : categories.find((category) => category.id === breadcrumbCategoryId))
  // Derived search sections follow the visible prompt order in the selected status group.
  const findSections = $derived.by(() => {
    const promptSections = (prompts: MockPrompt[]) => prompts.flatMap((prompt) => [
      { id: prompt.id, categoryId: prompt.categoryId, field: 'title', text: prompt.title },
      { id: prompt.id, categoryId: prompt.categoryId, field: 'text', text: prompt.text }
    ])
    return isFinalMode ? promptSections(finalizedPrompts) : [
      ...promptSections(visiblePrompts(rootPrompts)),
      ...categories.flatMap((category) => promptSections(visiblePrompts(category.prompts)))
    ]
  })
  const findMatches = $derived.by(() => {
    if (!findQuery) return []
    const query = findQuery.toLowerCase()
    return findSections.flatMap((section) => {
      const matches: (typeof section & { offset: number })[] = []
      const text = section.text.toLowerCase()
      for (let offset = text.indexOf(query); offset !== -1; offset = text.indexOf(query, offset + query.length)) {
        matches.push({ ...section, offset })
      }
      return matches
    })
  })
  // Derived decorations track the current occurrence without taking focus from the find field.
  const activeFindMatch = $derived(findOpen && findNavigated ? findMatches[findIndex] : undefined)
  const getTitleMatches = (prompt: MockPrompt) => findOpen
    ? findMatches.filter((match) => match.id === prompt.id && match.field === 'title')
    : []
  const revealFindMatch = (direction: number) => {
    if (!findMatches.length) return
    findIndex = (findIndex + (findNavigated ? direction : direction < 0 ? -1 : 0) + findMatches.length) % findMatches.length
    findNavigated = true
    const match = findMatches[findIndex]
    const category = categories.find((item) => item.id === match.categoryId)
    if (category && !isFinalMode) {
      category.collapsed = false
    }
    // Wait for a collapsed section's local editor to mount before revealing the exact match.
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`base-card-${match.id}`)
        ?? document.getElementById(`base-document-${match.id}`)
      target?.scrollIntoView({ block: 'center' })
      if (match.field === 'title') {
        const input = target?.querySelector('input')
        const highlight = target?.querySelector<HTMLElement>('[data-current="true"]')
        if (input && highlight) {
          input.scrollLeft = Math.max(0, highlight.offsetLeft + highlight.offsetWidth - input.clientWidth)
          syncTitleHighlightScroll(input)
        }
      } else {
        const editor = mountedEditors.get(match.id)
        const model = editor?.getModel()
        if (editor && model) {
          const start = model.getPositionAt(match.offset)
          const end = model.getPositionAt(match.offset + findQuery.length)
          const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
          editor.revealRangeInCenter(range)
        }
      }
    })
  }
  // Side effect: focus the collection-wide find field when it appears.
  $effect(() => { if (findInput) { findInput.focus(); findInput.select() } })
  // Side effect: query edits reveal the first result while preserving the find field's focus.
  $effect(() => {
    void findQuery
    void findMatches.length
    if (findOpen) untrack(() => {
      findIndex = 0
      findNavigated = false
      revealFindMatch(0)
    })
  })
  // Side effect: decorate all mounted editor matches, including editors mounted by category expansion.
  $effect(() => {
    for (const [id, decorations] of editorFindDecorations) {
      const model = mountedEditors.get(id)?.getModel()
      if (!model) continue
      decorations.set(findOpen ? findMatches.filter((match) => match.id === id && match.field === 'text').map((match) => {
        const start = model.getPositionAt(match.offset)
        const end = model.getPositionAt(match.offset + findQuery.length)
        const isCurrent = match === activeFindMatch
        return {
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          options: { className: isCurrent ? 'base-editor-find-current' : 'base-editor-find-match' }
        }
      }) : [])
    }
  })
  const syncTitleHighlightScroll = (input: HTMLInputElement) => {
    const mirror = input.parentElement?.querySelector<HTMLElement>('.base-title-mirror')
    if (mirror) mirror.style.transform = `translateX(${-input.scrollLeft}px)`
  }
  const updateBreadcrumb = () => {
    if (!viewport || isFinalMode) { breadcrumbCategoryId = null; return }
    const sampleY = viewport.getBoundingClientRect().top + 84
    let categoryId: string | null = null
    for (const section of viewport.querySelectorAll<HTMLElement>('[data-category-id]')) {
      if (section.getBoundingClientRect().top <= sampleY) categoryId = section.dataset.categoryId ?? null
    }
    breadcrumbCategoryId = categoryId
  }
  /** Each status group's last scroll offset, restored when the screen returns to that group. */
  const scrollTopByMode: Partial<Record<MockGroup, number>> = {}
  /** Status groups in visit order, used to leave a finalized group when its sidebar section is hidden. */
  let modeHistory: MockGroup[] = ['Active']

  /** Shows a status group and its sidebar section, then restores that group's scroll offset (live setScreenMode). */
  const setScreenMode = async (group: MockGroup) => {
    closeMenus()
    if (isFinalGroup(group) && !shownFinalGroups[group]) {
      shownFinalGroups[group] = true
      toggledAccordionHeights = null
    }
    if (!accordionSections[group].expanded) {
      accordionSections[group].expanded = true
      toggledAccordionHeights = null
    }
    modeHistory = [group, ...modeHistory.filter((mode) => mode !== group)]
    if (group === screenMode) return
    screenMode = group
    breadcrumbCategoryId = null
    isSelectionManual = false
    // Side effect: restore the next group's offset after its rows replace the previous group's rows.
    await tick()
    if (viewport) viewport.scrollTop = scrollTopByMode[group] ?? 0
    followCenterRow()
    updateBreadcrumb()
  }

  /** Header filters keep the collection header at its current offset in the next status group. */
  const selectGroup = (group: MockGroup) => {
    if (group !== screenMode && viewport) scrollTopByMode[group] = viewport.scrollTop
    void setScreenMode(group)
  }
  const visiblePrompts = (prompts: MockPrompt[], group: MockGroup = screenMode) =>
    prompts.filter((prompt) => matchesGroup(prompt, group))
  const removePrompt = (prompt: MockPrompt) => {
    rootPrompts = rootPrompts.filter((item) => item.id !== prompt.id)
    for (const category of categories) category.prompts = category.prompts.filter((item) => item.id !== prompt.id)
    deleteMenuId = null
  }
  const requestPromptDelete = (prompt: MockPrompt) => {
    if (!prompt.title.trim() && !prompt.text.trim()) { removePrompt(prompt); return }
    confirmation = { title: 'Delete Prompt', description: 'Are you sure you want to permanently delete this prompt?',
      submit: 'Delete', confirm: () => removePrompt(prompt) }
  }
  /** Inserts a blank prompt in the displayed workflow and returns it. */
  const addPrompt = (category?: MockCategory, afterId?: string): MockPrompt => {
    const prompts = category ? category.prompts : rootPrompts
    const prompt = createPrompt(window.crypto.randomUUID(), '', category?.id ?? 'base-root', TEMPLATE_NOT_SELECTED_LABEL, '',
      screenMode === 'Backlog' ? MockPromptStatus.Backlog : MockPromptStatus.Todo)
    prompts.splice(afterId ? prompts.findIndex((item) => item.id === afterId) + 1 : 0, 0, prompt)
    return prompt
  }

  /** Divider creation selects the new prompt, keeps it in view, and focuses its body (the default new-prompt focus). */
  const addPromptFromDivider = async (category?: MockCategory, afterId?: string) => {
    const prompt = addPrompt(category, afterId)
    selection = { kind: 'prompt', id: prompt.id }
    isSelectionManual = true
    // Side effect: wait for the new card and its Monaco editor to mount before focusing it.
    await tick()
    revealInScreenMinimal(document.getElementById(`base-card-${prompt.id}`))
    mountedEditors.get(prompt.id)?.focus()
  }

  // ---- Screen selection mirrored by the sidebar tree ----
  type MockSelection = { kind: 'header' } | { kind: 'prompt' | 'category'; id: string }
  /** Screen row highlighted in the matching status tree, like the live prompt-navigation selection. */
  let selection = $state<MockSelection>({ kind: 'header' })
  /** Tree, breadcrumb, and creation selections hold until the user scrolls the screen again. */
  let isSelectionManual = false
  /** Replays the prompt rail's violet wash after a tree click. */
  let navigationHighlight = $state<{ promptId: string; generation: number } | null>(null)
  let navigationHighlightGeneration = 0
  /** Live reveal offsets: prompts sit 300px below the viewport top and categories 80px. */
  const PROMPT_VERTICAL_BIAS_PX = 300
  const CATEGORY_TOP_OFFSET_PX = 80

  /** Selects the header near the top, otherwise the header, category, or prompt card nearest the viewport center. */
  const followCenterRow = () => {
    if (!viewport) return
    if (viewport.scrollTop < 1) {
      selection = { kind: 'header' }
      return
    }
    const viewportRect = viewport.getBoundingClientRect()
    const centerY = viewportRect.top + viewport.clientHeight / 2
    let nearest: HTMLElement | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const row of viewport.querySelectorAll<HTMLElement>('[data-follow-row]')) {
      const rect = row.getBoundingClientRect()
      const distance = centerY < rect.top ? rect.top - centerY : centerY > rect.bottom ? centerY - rect.bottom : 0
      if (distance < nearestDistance) {
        nearest = row
        nearestDistance = distance
      }
    }
    if (!nearest) return
    const kind = nearest.dataset.followRow
    const id = nearest.dataset.followId ?? ''
    if (kind === 'header') selection = { kind: 'header' }
    else if (kind === 'prompt' || kind === 'category') selection = { kind, id }
  }

  /** User scrolling releases a held selection and follows the centered row again. */
  const releaseManualSelection = () => {
    if (!isSelectionManual) return
    isSelectionManual = false
    followCenterRow()
  }

  // Side effect: wheel input and presses on the screen's own scrollbar count as user scrolling.
  const releaseSelectionOnUserScroll = (node: HTMLElement) => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target === node) releaseManualSelection()
    }
    node.addEventListener('wheel', releaseManualSelection, { passive: true })
    node.addEventListener('pointerdown', handlePointerDown)
    return {
      destroy() {
        node.removeEventListener('wheel', releaseManualSelection)
        node.removeEventListener('pointerdown', handlePointerDown)
      }
    }
  }

  /** Places a row with the live vertical-bias rule: the bias, reduced to center a tall row, but at least 20px. */
  const revealInScreen = (element: HTMLElement | null, verticalBiasPx: number) => {
    if (!element || !viewport) return
    const rect = element.getBoundingClientRect()
    const bias = Math.max(20, Math.min(verticalBiasPx, (viewport.clientHeight - rect.height) / 2))
    viewport.scrollTop += rect.top - viewport.getBoundingClientRect().top - bias
  }

  /** Scrolls only far enough to show the nearer edge of a row. */
  const revealInScreenMinimal = (element: HTMLElement | null) => {
    if (!element || !viewport) return
    const rect = element.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    if (rect.top < viewportRect.top) viewport.scrollTop -= viewportRect.top - rect.top
    else if (rect.bottom > viewportRect.bottom) viewport.scrollTop += Math.min(rect.bottom - viewportRect.bottom, rect.top - viewportRect.top)
  }

  /** Returns the screen and tree to the collection header. */
  const goToTop = () => {
    closeMenus()
    selection = { kind: 'header' }
    isSelectionManual = true
    viewport?.scrollTo({ top: 0 })
  }

  /** Reveals a prompt from its tree row, switching to the row's status group and expanding its category first. */
  const navigateToPrompt = async (group: MockGroup, prompt: MockPrompt) => {
    await setScreenMode(group)
    const category = categories.find((item) => item.id === prompt.categoryId)
    if (category && !isFinalGroup(group)) category.collapsed = false
    selection = { kind: 'prompt', id: prompt.id }
    isSelectionManual = true
    navigationHighlight = { promptId: prompt.id, generation: ++navigationHighlightGeneration }
    // Side effect: wait for an expanded category's cards to mount before measuring the target.
    await tick()
    revealInScreen(document.getElementById(`base-card-${prompt.id}`), PROMPT_VERTICAL_BIAS_PX)
  }

  /** Opens a category from its context menu: expands it in both panes and aligns its card near the top. */
  const openCategory = async (group: MockGroup, category: MockCategory) => {
    await setScreenMode(group)
    category.collapsed = false
    treeCollapsedCategoryIds.delete(category.id)
    selection = { kind: 'category', id: category.id }
    isSelectionManual = true
    // Side effect: wait for the expanded category before aligning its card.
    await tick()
    revealInScreen(document.getElementById(`base-category-card-${category.id}`), CATEGORY_TOP_OFFSET_PX)
  }

  /** Creates a prompt at the top of the collection or a category from the tree, then reveals and focuses it. */
  const addPromptFromTree = async (group: MockGroup, category?: MockCategory) => {
    await setScreenMode(group)
    if (category) {
      category.collapsed = false
      treeCollapsedCategoryIds.delete(category.id)
    }
    const prompt = addPrompt(category)
    selection = { kind: 'prompt', id: prompt.id }
    isSelectionManual = true
    // Side effect: wait for the new card and its Monaco editor to mount before revealing and focusing it.
    await tick()
    revealInScreen(document.getElementById(`base-card-${prompt.id}`), PROMPT_VERTICAL_BIAS_PX)
    mountedEditors.get(prompt.id)?.focus()
  }
  const movePrompt = (prompt: MockPrompt, direction: number) => {
    const sections = [
      { id: 'base-root', prompts: rootPrompts },
      ...categories.map((category) => ({ id: category.id, prompts: category.prompts }))
    ]
    const sectionIndex = sections.findIndex((section) => section.id === prompt.categoryId)
    const prompts = sections[sectionIndex].prompts
    const visible = visiblePrompts(prompts)
    const target = visible[visible.indexOf(prompt) + direction]
    if (target) {
      const targetIndex = prompts.indexOf(target)
      prompts.splice(prompts.indexOf(prompt), 1)
      prompts.splice(targetIndex, 0, prompt)
      return
    }
    // The live shortcuts cross category boundaries, including empty categories.
    const destination = sections[sectionIndex + direction]
    if (!destination) return
    prompts.splice(prompts.indexOf(prompt), 1)
    prompt.categoryId = destination.id
    const lastVisible = visiblePrompts(destination.prompts).at(-1)
    const insertionIndex = direction < 0 && lastVisible
      ? destination.prompts.indexOf(lastVisible) + 1
      : 0
    destination.prompts.splice(insertionIndex, 0, prompt)
    const category = categories.find((item) => item.id === destination.id)
    if (category) category.collapsed = false
  }

  /** Whether a visible blank note makes deletion the note button's main action. */
  const isBlankVisibleNote = (prompt: MockPrompt) =>
    Boolean(prompt.note?.visible && !prompt.note.text.trim())

  /** Adds and focuses a new note, deletes a visible blank note instead of hiding it, or toggles an existing note. */
  const toggleAttachedNote = async (prompt: MockPrompt) => {
    closeMenus()
    if (isBlankVisibleNote(prompt)) {
      prompt.note = undefined
      return
    }
    if (prompt.note) {
      prompt.note.visible = !prompt.note.visible
      return
    }
    const id = window.crypto.randomUUID()
    prompt.note = { id, text: '', minLines: 1, visible: true, isEdited: false, modifiedLabel: 'Updated today' }
    // Side effect: focus only newly added notes after their local Monaco host mounts.
    await tick()
    mountedEditors.get(id)?.focus()
  }

  /** Deletes blank notes immediately and confirms deletion for notes with text. */
  const requestNoteDelete = (prompt: MockPrompt) => {
    closeMenus()
    if (!prompt.note?.text.trim()) {
      prompt.note = undefined
      return
    }
    confirmation = {
      title: 'Delete Attached Note',
      description: 'Are you sure you want to permanently delete this attached note?',
      submit: 'Delete',
      confirm: () => { prompt.note = undefined }
    }
  }

  // Side effect: capture move shortcuts before Monaco handles them, retaining the active field and caret.
  const promptMoveShortcuts = (node: HTMLElement, prompt: MockPrompt) => {
    const keydown = async (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey ||
          !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      const focusedElement = window.document.activeElement as HTMLElement | null
      const editor = [mountedEditors.get(prompt.id), mountedEditors.get(prompt.note?.id ?? '')]
        .find((candidate) => candidate?.hasTextFocus())
      if (!(focusedElement instanceof HTMLInputElement) && !editor) return
      event.preventDefault()
      event.stopPropagation()
      if (isFinalMode) return
      const editorId = editor === mountedEditors.get(prompt.note?.id ?? '') ? prompt.note?.id : prompt.id
      const viewState = editor?.saveViewState()
      const titleSelection = focusedElement instanceof HTMLInputElement
        ? [focusedElement.selectionStart, focusedElement.selectionEnd] as const
        : null
      movePrompt(prompt, event.key === 'ArrowUp' ? -1 : 1)
      // Side effect: restore focus and selection after reordering or remounting in another category.
      await tick()
      if (editor && editorId) {
        const nextEditor = mountedEditors.get(editorId)
        if (viewState) nextEditor?.restoreViewState(viewState)
        nextEditor?.focus()
      } else {
        const input = window.document.getElementById(`base-card-${prompt.id}`)?.querySelector('input')
        input?.focus({ preventScroll: true })
        if (titleSelection) input?.setSelectionRange(...titleSelection)
      }
    }
    node.addEventListener('keydown', keydown, true)
    return { destroy: () => node.removeEventListener('keydown', keydown, true) }
  }

  // ---- Drag and drop shared by screen rails, tree rows, dividers, and sidebar status headers ----
  type MockDragSource = { kind: 'prompt' | 'category'; id: string; title: string }
  type MockDropEdge = 'top' | 'bottom'
  type MockEdgeMode = 'none' | 'top' | 'bottom' | 'top-and-bottom'
  /** Drop action, 'blocked' for a drop that would change nothing, or null when the target rejects the source. */
  type MockDropResult = (() => void) | 'blocked' | null
  type MockDropTarget = {
    key: string
    /** Row edges that choose a before/after placement for this source; whole-target drops omit it. */
    edges?: (source: MockDragSource) => MockEdgeMode
    resolve: (source: MockDragSource, edge: MockDropEdge | null) => MockDropResult
  }
  /** Placement in one status group: before or after a prompt, or first in the category when neither is given. */
  type MockPromptPlacement = { group: MockGroup; categoryId: string; beforeId?: string; afterId?: string }
  let dragSource = $state<MockDragSource | null>(null)
  let dragPosition = $state({ x: 0, y: 0 })
  /** Hovered target and edge; blocked targets draw the gray no-op indicator. */
  let activeDrop = $state<{ key: string; edge: MockDropEdge | null; isBlocked: boolean } | null>(null)
  let activeDropAction: (() => void) | null = null
  const dropTargets = new SvelteMap<HTMLElement, MockDropTarget>()

  const getCategoryPrompts = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.prompts ?? rootPrompts

  /** Status given to a prompt entering a group; prompts already active keep Todo or In Progress. */
  const getGroupEntryStatus = (group: MockGroup, prompt: MockPrompt): MockPromptStatus =>
    group === 'Active'
      ? matchesGroup(prompt, 'Active') ? prompt.status : MockPromptStatus.Todo
      : MockPromptStatus[group]

  const movePromptTo = (prompt: MockPrompt, placement: MockPromptPlacement) => {
    const status = getGroupEntryStatus(placement.group, prompt)
    removePrompt(prompt)
    prompt.categoryId = placement.categoryId
    const prompts = getCategoryPrompts(placement.categoryId)
    const anchorId = placement.beforeId ?? placement.afterId
    const anchorIndex = anchorId ? prompts.findIndex((item) => item.id === anchorId) : -1
    prompts.splice(anchorIndex < 0 ? 0 : anchorIndex + (placement.afterId ? 1 : 0), 0, prompt)
    if (status !== prompt.status) setPromptStatus(prompt, status)
  }

  /** Resolves a prompt drop, blocking drops that leave the prompt in its current place. */
  const resolvePromptMove = (source: MockDragSource, placement: MockPromptPlacement): MockDropResult => {
    if (source.kind !== 'prompt') return null
    const prompt = allPrompts.find((item) => item.id === source.id)
    if (!prompt) return null
    if (matchesGroup(prompt, placement.group)) {
      // Finalized groups order by finalization time, so a move within one changes nothing.
      if (isFinalGroup(placement.group)) return 'blocked'
      if (prompt.categoryId === placement.categoryId) {
        const visible = visiblePrompts(getCategoryPrompts(placement.categoryId), placement.group)
        const index = visible.findIndex((item) => item.id === prompt.id)
        const isNoOp = placement.beforeId !== undefined
          ? placement.beforeId === prompt.id || placement.beforeId === visible[index + 1]?.id
          : placement.afterId !== undefined
            ? placement.afterId === prompt.id || placement.afterId === visible[index - 1]?.id
            : index === 0
        if (isNoOp) return 'blocked'
      }
    }
    return () => movePromptTo(prompt, placement)
  }

  /** Resolves a category reorder before the next category, or to the end for null. */
  const resolveCategoryMove = (source: MockDragSource, nextCategoryId: string | null): MockDropResult => {
    if (source.kind !== 'category') return null
    const index = categories.findIndex((category) => category.id === source.id)
    if (index < 0) return null
    if (nextCategoryId === source.id || (categories[index + 1]?.id ?? null) === nextCategoryId) return 'blocked'
    return () => {
      const [category] = categories.splice(index, 1)
      const nextIndex = nextCategoryId ? categories.findIndex((item) => item.id === nextCategoryId) : -1
      categories.splice(nextIndex < 0 ? categories.length : nextIndex, 0, category)
    }
  }

  /** Screen divider: prompts land after its previous prompt; root boundary dividers also reorder categories. */
  const getDividerDropTarget = (
    category: MockCategory | undefined,
    afterId: string | undefined,
    nextCategoryId: string | null | undefined
  ): MockDropTarget => ({
    key: `divider:${category?.id ?? 'base-root'}:${afterId ?? 'initial'}`,
    resolve: (source) => source.kind === 'category'
      ? nextCategoryId === undefined ? null : resolveCategoryMove(source, nextCategoryId)
      : resolvePromptMove(source, { group: screenMode, categoryId: category?.id ?? 'base-root', afterId })
  })

  /** Sidebar status header: moves a prompt into that group at the top of its category. */
  const getStatusHeaderDropTarget = (group: MockGroup): MockDropTarget => ({
    key: `status-header:${group}`,
    resolve: (source) => {
      const prompt = allPrompts.find((item) => item.id === source.id)
      if (source.kind !== 'prompt' || !prompt) return null
      return matchesGroup(prompt, group) ? 'blocked' : resolvePromptMove(source, { group, categoryId: prompt.categoryId })
    }
  })

  // Side effect: register a local drop target for this mockup's gesture, never the live drag/drop registry.
  const mockDropTarget = (node: HTMLElement, target: MockDropTarget) => {
    dropTargets.set(node, target)
    return {
      update(next: MockDropTarget) { dropTargets.set(node, next) },
      destroy() { dropTargets.delete(node) }
    }
  }

  /** Finds the accepting target under the pointer, ignoring rows scrolled outside their scroll area. */
  const findDropTarget = (source: MockDragSource, x: number, y: number) => {
    for (const [element, target] of dropTargets) {
      const rect = element.getBoundingClientRect()
      if (!rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
      const clip = element.closest('[data-drop-clip]')?.getBoundingClientRect()
      if (clip && (y < clip.top || y > clip.bottom)) continue
      const mode = target.edges?.(source) ?? 'none'
      const edge: MockDropEdge | null = mode === 'none'
        ? null
        : mode === 'top-and-bottom' ? (y < rect.top + rect.height / 2 ? 'top' : 'bottom') : mode
      const result = target.resolve(source, edge)
      if (result !== null) return { key: target.key, edge, result }
    }
    return null
  }

  /** Scrolls the screen or a tree while a drag pauses near its top or bottom edge. */
  const autoScrollDuringDrag = (x: number, y: number) => {
    for (const scroller of document.querySelectorAll<HTMLElement>('[data-drop-clip]')) {
      const rect = scroller.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
      if (y < rect.top + 32) scroller.scrollTop -= 12
      else if (y > rect.bottom - 32) scroller.scrollTop += 12
    }
  }

  /** A drag released over its own row would also click it; swallow that click. */
  const suppressNextClick = () => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
  }

  // Side effect: own the pointer gesture, local ghost, and drop indicators until drop or Escape.
  const mockDragHandle = (node: HTMLElement, options: MockDragSource & { disabled?: boolean }) => {
    let source = options
    let cleanupGesture = () => {}
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || source.disabled) return
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const dragged: MockDragSource = { kind: source.kind, id: source.id, title: source.title }
      const move = (next: PointerEvent) => {
        if (!dragSource && Math.hypot(next.clientX - startX, next.clientY - startY) < 4) return
        if (!dragSource) {
          closeMenus()
          dragSource = dragged
        }
        dragPosition = { x: next.clientX + 4, y: next.clientY + 4 }
        const hit = findDropTarget(dragged, next.clientX, next.clientY)
        activeDropAction = typeof hit?.result === 'function' ? hit.result : null
        const isBlocked = hit?.result === 'blocked'
        if (activeDrop?.key !== hit?.key || activeDrop?.edge !== hit?.edge || activeDrop?.isBlocked !== isBlocked) {
          activeDrop = hit ? { key: hit.key, edge: hit.edge, isBlocked } : null
        }
        autoScrollDuringDrag(next.clientX, next.clientY)
      }
      const up = () => {
        const wasDragging = dragSource !== null
        const action = activeDropAction
        cleanupGesture()
        action?.()
        if (wasDragging) suppressNextClick()
      }
      const cancel = (next: KeyboardEvent) => { if (next.key === 'Escape') cleanupGesture() }
      cleanupGesture = () => {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', cleanupGesture)
        document.removeEventListener('keydown', cancel)
        activeDrop = null
        activeDropAction = null
        dragSource = null
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', cleanupGesture)
      document.addEventListener('keydown', cancel)
    }
    node.addEventListener('pointerdown', down)
    return {
      update(next: MockDragSource & { disabled?: boolean }) { source = next },
      destroy() { cleanupGesture(); node.removeEventListener('pointerdown', down) }
    }
  }

  // ---- Tab Collection Sidebar ----
  /** Sidebar width follows the live app's 275px default and 240–400px resize range. */
  let sidebarWidth = $state(275)
  let isResizingSidebar = $state(false)
  let sidebarElement = $state<HTMLElement | null>(null)

  // Side effect: capture the sash pointer and clamp the sidebar width until release.
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

  /** Sidebar keeps finalized sections above the category-ordered workflows. */
  const sidebarGroups: MockGroup[] = ['Completed', 'Archived', 'Active', 'Backlog']
  const groupIcons: Record<MockGroup, LucideIcon> = {
    Active: ListTodo,
    Backlog: Clock,
    Completed: CircleCheckBig,
    Archived: Archive
  }
  /** Finalized sections appear only after their toolbar toggle or a header filter selects them. */
  let shownFinalGroups = $state<Record<MockFinalGroup, boolean>>({ Completed: false, Archived: false })
  const groupCounts = $derived(Object.fromEntries(groups.map((group) =>
    [group, allPrompts.filter((prompt) => matchesGroup(prompt, group)).length])) as Record<MockGroup, number>)

  /** Shows a finalized group at the top of the screen, or leaves it for the latest visible group when hidden. */
  const toggleFinalGroup = (group: MockFinalGroup) => {
    closeMenus()
    toggledAccordionHeights = null
    if (!shownFinalGroups[group]) {
      shownFinalGroups[group] = true
      scrollTopByMode[group] = 0
      void setScreenMode(group)
      return
    }
    shownFinalGroups[group] = false
    if (screenMode !== group) return
    const returnMode = modeHistory.find((mode) => mode !== group && (!isFinalGroup(mode) || shownFinalGroups[mode]))
    void setScreenMode(returnMode ?? 'Active')
  }

  // Sidebar status accordion: proportional section heights, header toggles, and sashes between expanded sections.
  const ACCORDION_COLLAPSED_HEIGHT_PX = 36
  /** The 36px header plus the live 64px minimum content height. */
  const ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX = 100
  type MockAccordionSection = { group: MockGroup; expanded: boolean; weightPx: number }
  /** Expansion and configured height weight per section; Active starts at 400px and the others at 200px. */
  let accordionSections = $state<Record<MockGroup, { expanded: boolean; weightPx: number }>>({
    Active: { expanded: true, weightPx: 400 },
    Backlog: { expanded: true, weightPx: 200 },
    Completed: { expanded: true, weightPx: 200 },
    Archived: { expanded: true, weightPx: 200 }
  })
  const resolvedAccordionSections = $derived<MockAccordionSection[]>(sidebarGroups
    .filter((group) => !isFinalGroup(group) || shownFinalGroups[group])
    .map((group) => ({ group, ...accordionSections[group] })))
  let accordionElement = $state<HTMLDivElement | null>(null)
  let accordionHeightPx = $state(0)
  /** Heights captured by a header toggle so headers above it keep their positions. */
  let toggledAccordionHeights = $state<Record<string, number> | null>(null)
  let accordionDragGroup = $state<MockGroup | null>(null)
  let accordionDragHeights = $state<Record<string, number> | null>(null)

  /** Gives collapsed sections their header height and shares the rest by weight, honoring minimum heights. */
  const calculateAccordionHeights = (sections: MockAccordionSection[], availableHeightPx: number) => {
    const heights: Record<string, number> = {}
    let unallocated = sections.filter((section) => section.expanded)
    const collapsedHeightPx = (sections.length - unallocated.length) * ACCORDION_COLLAPSED_HEIGHT_PX
    let remainingHeightPx = Math.max(
      unallocated.length * ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX,
      availableHeightPx - collapsedHeightPx
    )
    for (const section of sections) {
      if (!section.expanded) heights[section.group] = ACCORDION_COLLAPSED_HEIGHT_PX
    }
    while (unallocated.length > 0) {
      const scale = remainingHeightPx / unallocated.reduce((sum, section) => sum + section.weightPx, 0)
      const constrained = unallocated.filter((section) => section.weightPx * scale < ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX)
      if (constrained.length === 0) {
        for (const section of unallocated) heights[section.group] = section.weightPx * scale
        break
      }
      for (const section of constrained) {
        heights[section.group] = ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX
        remainingHeightPx -= ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX
      }
      unallocated = unallocated.filter((section) => !constrained.includes(section))
    }
    return heights
  }
  const accordionHeights = $derived(
    accordionDragHeights ?? toggledAccordionHeights ?? calculateAccordionHeights(resolvedAccordionSections, accordionHeightPx)
  )

  /** Shrinks expanded sections in the given order without crossing their minimum and returns the absorbed height. */
  const shrinkAccordionSections = (
    sections: MockAccordionSection[],
    heights: Record<string, number>,
    indexes: number[],
    requestedHeightPx: number
  ) => {
    let remainingHeightPx = requestedHeightPx
    for (const index of indexes) {
      const section = sections[index]
      if (!section.expanded) continue
      const absorbedHeightPx = Math.max(0, Math.min(remainingHeightPx, heights[section.group] - ACCORDION_MINIMUM_EXPANDED_HEIGHT_PX))
      heights[section.group] -= absorbedHeightPx
      remainingHeightPx -= absorbedHeightPx
      if (remainingHeightPx === 0) break
    }
    return requestedHeightPx - remainingHeightPx
  }

  /** Collapses into the last expanded section, or expands by taking space from below first, then above. */
  const toggleAccordionSection = (group: MockGroup) => {
    const sections = resolvedAccordionSections
    const index = sections.findIndex((section) => section.group === group)
    const nextSections = sections.map((section) =>
      section.group === group ? { ...section, expanded: !section.expanded } : section)
    const heights = { ...accordionHeights }
    if (sections[index].expanded) {
      const releasedHeightPx = heights[group] - ACCORDION_COLLAPSED_HEIGHT_PX
      const receivingSection = nextSections.findLast((section) => section.expanded)
      heights[group] = ACCORDION_COLLAPSED_HEIGHT_PX
      if (receivingSection) heights[receivingSection.group] += releasedHeightPx
    } else {
      const targetHeightPx = calculateAccordionHeights(nextSections, accordionHeightPx)[group]
      const unusedHeightPx = Math.max(0, accordionHeightPx - Object.values(heights).reduce((sum, height) => sum + height, 0))
      let remainingHeightPx = Math.max(0, targetHeightPx - heights[group] - unusedHeightPx)
      const belowIndexes = nextSections.map((_, sectionIndex) => sectionIndex).filter((sectionIndex) => sectionIndex > index).reverse()
      remainingHeightPx -= shrinkAccordionSections(nextSections, heights, belowIndexes, remainingHeightPx)
      if (remainingHeightPx > 0) {
        const aboveIndexes = nextSections.map((_, sectionIndex) => sectionIndex).filter((sectionIndex) => sectionIndex < index).reverse()
        shrinkAccordionSections(nextSections, heights, aboveIndexes, remainingHeightPx)
      }
      heights[group] = targetHeightPx
    }
    accordionSections[group].expanded = !accordionSections[group].expanded
    toggledAccordionHeights = heights
  }

  /** An expanded section has a sash when an expanded section above it can trade height. */
  const canResizeAccordionSection = (group: MockGroup) => {
    const index = resolvedAccordionSections.findIndex((section) => section.group === group)
    return index > 0 && resolvedAccordionSections[index].expanded &&
      resolvedAccordionSections.slice(0, index).some((section) => section.expanded)
  }

  /** The first of a trailing run of collapsed sections stays at the bottom. */
  const isAccordionSectionBottomAnchored = (group: MockGroup) => {
    const index = resolvedAccordionSections.findIndex((section) => section.group === group)
    if (index <= 0 || resolvedAccordionSections[index].expanded) return false
    return resolvedAccordionSections[index - 1].expanded &&
      resolvedAccordionSections.slice(index + 1).every((section) => !section.expanded)
  }

  // Side effect: capture a section sash, trade height with the sections above or below, then keep the new weights.
  const startAccordionResize = (group: MockGroup, event: PointerEvent) => {
    if (event.button !== 0 || accordionDragGroup || !canResizeAccordionSection(group)) return
    event.preventDefault()
    event.stopPropagation()
    const sash = event.currentTarget as HTMLElement
    const sections = resolvedAccordionSections
    const index = sections.findIndex((section) => section.group === group)
    const startY = event.clientY
    const startHeights = { ...accordionHeights }
    let hasChanged = false
    accordionDragGroup = group
    accordionDragHeights = { ...startHeights }
    toggledAccordionHeights = null
    document.body.style.cursor = 'ns-resize'
    const resize = (moveEvent: PointerEvent) => {
      const deltaPx = moveEvent.clientY - startY
      const heights = { ...startHeights }
      let absorbedPx = 0
      if (deltaPx > 0) {
        const shrinkingIndexes = sections.map((_, sectionIndex) => sectionIndex).filter((sectionIndex) => sectionIndex >= index)
        absorbedPx = shrinkAccordionSections(sections, heights, shrinkingIndexes, deltaPx)
        heights[sections.slice(0, index).findLast((section) => section.expanded)!.group] += absorbedPx
      } else if (deltaPx < 0) {
        const shrinkingIndexes = sections.map((_, sectionIndex) => sectionIndex).filter((sectionIndex) => sectionIndex < index).reverse()
        absorbedPx = shrinkAccordionSections(sections, heights, shrinkingIndexes, -deltaPx)
        heights[group] += absorbedPx
      }
      if (absorbedPx > 0) hasChanged = true
      accordionDragHeights = heights
    }
    const stop = () => {
      if (hasChanged && accordionDragHeights) {
        for (const section of sections) {
          if (section.expanded) accordionSections[section.group].weightPx = accordionDragHeights[section.group]
        }
      }
      accordionDragGroup = null
      accordionDragHeights = null
      document.body.style.cursor = ''
      sash.removeEventListener('pointermove', resize)
      sash.removeEventListener('pointerup', stop)
      sash.removeEventListener('pointercancel', stop)
    }
    sash.setPointerCapture(event.pointerId)
    sash.addEventListener('pointermove', resize)
    sash.addEventListener('pointerup', stop)
    sash.addEventListener('pointercancel', stop)
  }

  // Side effect: measure the accordion's available height and drop toggle snapshots whenever it resizes.
  $effect(() => {
    if (!accordionElement) return
    const element = accordionElement
    const observer = new ResizeObserver(() => {
      accordionHeightPx = element.clientHeight
      toggledAccordionHeights = null
    })
    accordionHeightPx = element.clientHeight
    observer.observe(element)
    return () => observer.disconnect()
  })

  // Prompt tree rows per status group; category expansion is shared by every tree, like the live per-category key.
  type MockTreeRow =
    | { kind: 'prompt'; key: string; prompt: MockPrompt; indent: 0 | 1; isLastRow: boolean }
    | { kind: 'category'; key: string; category: MockCategory; isExpanded: boolean }
    | { kind: 'empty-category'; key: string; category: MockCategory }
  const treeCollapsedCategoryIds = new SvelteSet<string>()
  const getTreeRows = (group: MockGroup): MockTreeRow[] => {
    if (isFinalGroup(group)) {
      const prompts = allPrompts.filter((prompt) => matchesGroup(prompt, group))
        .sort((left, right) => (right.finalizedAt ?? 0) - (left.finalizedAt ?? 0))
      return prompts.map((prompt, index) =>
        ({ kind: 'prompt', key: `prompt:${prompt.id}`, prompt, indent: 0, isLastRow: index === prompts.length - 1 }))
    }
    const rows: MockTreeRow[] = []
    const uncategorized = visiblePrompts(rootPrompts, group)
    uncategorized.forEach((prompt, index) =>
      rows.push({ kind: 'prompt', key: `prompt:${prompt.id}`, prompt, indent: 0, isLastRow: index === uncategorized.length - 1 }))
    for (const category of categories) {
      const isExpanded = !treeCollapsedCategoryIds.has(category.id)
      rows.push({ kind: 'category', key: `category:${category.id}`, category, isExpanded })
      if (!isExpanded) continue
      const prompts = visiblePrompts(category.prompts, group)
      if (prompts.length === 0) rows.push({ kind: 'empty-category', key: `empty:${category.id}`, category })
      prompts.forEach((prompt, index) =>
        rows.push({ kind: 'prompt', key: `prompt:${prompt.id}`, prompt, indent: 1, isLastRow: index === prompts.length - 1 }))
    }
    return rows
  }
  const treeRowsByGroup = $derived(Object.fromEntries(groups.map((group) => [group, getTreeRows(group)])) as Record<MockGroup, MockTreeRow[]>)
  const areAllTreeCategoriesCollapsed = $derived(
    categories.length > 0 && categories.every((category) => treeCollapsedCategoryIds.has(category.id))
  )
  const toggleTreeCategory = (categoryId: string) => {
    if (treeCollapsedCategoryIds.has(categoryId)) treeCollapsedCategoryIds.delete(categoryId)
    else treeCollapsedCategoryIds.add(categoryId)
  }
  const toggleAllTreeCategories = () => {
    closeMenus()
    if (areAllTreeCategoriesCollapsed) treeCollapsedCategoryIds.clear()
    else for (const category of categories) treeCollapsedCategoryIds.add(category.id)
  }

  /** The header selection highlights the first row of the displayed group's tree. */
  const selectedTreeRowKey = $derived(selection.kind === 'header'
    ? (treeRowsByGroup[screenMode][0]?.key ?? null)
    : `${selection.kind}:${selection.id}`)
  /** Live row states: active rows keep their fill and other rows lose hover feedback during a drag. */
  const getTreeRowState = (group: MockGroup, key: string, source: MockDragSource) =>
    dragSource?.kind === source.kind && dragSource.id === source.id
      ? 'dragging'
      : group === screenMode && selectedTreeRowKey === key
        ? dragSource ? 'drag-active' : 'active'
        : dragSource ? 'drag-idle' : 'idle'

  /** Tree drop edges inset by one indent for drops into a category, matching the live 15px + 12px-per-level rule. */
  const getTreeIndicatorInsetPx = (indent: number) => 15 + indent * 12

  /** Tree prompt row: prompts land before or after it; the first tree row also accepts its top edge. */
  const getTreePromptDropTarget = (group: MockGroup, row: Extract<MockTreeRow, { kind: 'prompt' }>, isFirstRow: boolean): MockDropTarget => ({
    key: `tree:${group}:${row.key}`,
    edges: (source) => source.kind === 'prompt' ? (isFirstRow ? 'top-and-bottom' : 'bottom') : 'none',
    resolve: (source, edge) => resolvePromptMove(source, {
      group,
      categoryId: isFinalGroup(group) && source.kind === 'prompt'
        ? (allPrompts.find((item) => item.id === source.id)?.categoryId ?? 'base-root')
        : row.prompt.categoryId,
      ...(edge === 'top' ? { beforeId: row.prompt.id } : { afterId: row.prompt.id })
    })
  })

  /** Tree category row: prompts drop into the category; categories drop before it. */
  const getTreeCategoryDropTarget = (group: MockGroup, category: MockCategory, isFirstRow: boolean): MockDropTarget => ({
    key: `tree:${group}:category:${category.id}`,
    edges: (source) => source.kind === 'category' ? 'top' : isFirstRow ? 'top-and-bottom' : 'bottom',
    resolve: (source, edge) => source.kind === 'category'
      ? resolveCategoryMove(source, category.id)
      : edge === 'top'
        ? resolvePromptMove(source, { group, categoryId: 'base-root' })
        : resolvePromptMove(source, { group, categoryId: category.id })
  })

  /** Tree bottom spacer: categories move to the end; finalized trees accept prompts. */
  const getTreeBottomDropTarget = (group: MockGroup): MockDropTarget => ({
    key: `tree:${group}:bottom-spacer`,
    edges: () => 'top',
    resolve: (source) => isFinalGroup(group)
      ? getStatusHeaderDropTarget(group).resolve(source, null)
      : resolveCategoryMove(source, null)
  })

  /** Empty status tree: prompts drop at the top of the collection, or into a finalized group. */
  const getTreeEmptyDropTarget = (group: MockGroup): MockDropTarget => ({
    key: `tree:${group}:empty`,
    edges: () => 'top',
    resolve: (source) => isFinalGroup(group)
      ? getStatusHeaderDropTarget(group).resolve(source, null)
      : resolvePromptMove(source, { group, categoryId: 'base-root' })
  })

  /** Plain boundary after a screen category card: accepts only category reorders. */
  const getCategorySeparatorDropTarget = (categoryId: string, nextCategoryId: string | null): MockDropTarget => ({
    key: `separator:${categoryId}`,
    resolve: (source) => resolveCategoryMove(source, nextCategoryId)
  })

  // Side effect: keep the selected row visible in its status tree, scrolling only as far as needed.
  $effect(() => {
    const key = selectedTreeRowKey
    const group = screenMode
    if (!key || !sidebarElement) return
    const sidebar = sidebarElement
    window.requestAnimationFrame(() => {
      const row = sidebar.querySelector<HTMLElement>(`[data-tree-group="${group}"] [data-tree-row-key="${key}"]`)
      const scroller = row?.closest<HTMLElement>('.base-tree-scroll')
      if (!row || !scroller) return
      const rowRect = row.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      if (rowRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - rowRect.top
      else if (rowRect.bottom > scrollerRect.bottom) scroller.scrollTop += rowRect.bottom - scrollerRect.bottom
    })
  })

  /** Opens the Selected Collection Actions or a category context menu at the cursor. */
  const toggleCollectionActions = (event: MouseEvent) => {
    const isOpen = isCollectionActionsOpen
    closeMenus()
    if (isOpen) return
    collectionActionsAnchor = event.currentTarget as HTMLElement
    captureMenuPoint(event, collectionActionsAnchor)
    isCollectionActionsOpen = true
  }
  const openCategoryMenu = async (event: MouseEvent, group: MockGroup, categoryId: string) => {
    event.preventDefault()
    if (event.button !== 2) return
    const anchor = event.currentTarget as HTMLElement
    captureMenuPoint(event, anchor, true)
    closeMenus()
    // Side effect: let an open menu unmount first, so a repeated right-click reopens it at the new cursor point.
    await tick()
    categoryMenu = { group, categoryId, anchor }
  }
  const requestCollectionDelete = () => {
    closeMenus()
    confirmation = { title: 'Delete Collection',
      description: 'This collection and everything inside it will be permanently deleted, including completed and archived prompts.',
      acknowledgement: 'Yes, I want to delete this collection and all of its contents.',
      submit: 'Delete collection', confirm: () => { rootPrompts = []; categories = [] } }
  }
  let nameDialog = $state<{ value: string; save: (value: string) => void } | null>(null)
  let nameInteracted = $state(false)
  let nameInput = $state<HTMLInputElement | null>(null)
  const nameError = $derived(!nameDialog?.value.trim() ? 'Collection name is required' : null)
  const nameDisabled = $derived(Boolean(nameError) || nameDialog?.value.trim() === rootTitle)
  let confirmation = $state<{
    title: string
    description: string
    submit: string
    confirm: () => void
    informational?: boolean
    acknowledgement?: string
    acknowledged?: boolean
  } | null>(null)
  let copyError = $state<string | null>(null)

  let manageCategoriesOpen = $state(false)
  let managementDrafts = $state<MockCategoryDraft[]>([])
  let selectedCategoryId = $state<string | null>(null)
  let managementNameInput = $state<HTMLInputElement | null>(null)
  let shouldFocusManagementName = $state(false)
  const selectedCategoryDraft = $derived(
    managementDrafts.find((draft) => draft.id === selectedCategoryId) ?? null
  )
  const selectedCategoryNameError = $derived(
    !selectedCategoryDraft
      ? null
      : !selectedCategoryDraft.title.trim()
        ? 'Category name is required'
        : managementDrafts.some(
              (draft) =>
                draft.id !== selectedCategoryDraft.id &&
                draft.title.trim().toLocaleLowerCase() ===
                  selectedCategoryDraft.title.trim().toLocaleLowerCase()
            )
          ? 'A category with this name already exists'
          : null
  )
  const managementDraftsValid = $derived(
    managementDrafts.every(
      (draft, index) =>
        draft.title.trim().length > 0 &&
        !managementDrafts.some(
          (candidate, candidateIndex) =>
            candidateIndex !== index &&
            candidate.title.trim().toLocaleLowerCase() ===
              draft.title.trim().toLocaleLowerCase()
        )
    )
  )
  const managementHasChanges = $derived(
    JSON.stringify(
      managementDrafts.map(({ id, title, shortDescription, text }) => ({
        id,
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: text.trim()
      }))
    ) !==
      JSON.stringify(
        categories.map(({ id, title, shortDescription, description }) => ({
          id,
          title,
          shortDescription,
          description
        }))
      )
  )

  const openManageCategories = (categoryId?: string, focusName = false) => {
    managementDrafts = categories.map((category) => ({
      id: category.id,
      title: category.title,
      shortDescription: category.shortDescription,
      text: category.description,
      fixedHeightPx: 176,
      hasInteracted: false
    }))
    selectedCategoryId = categoryId && managementDrafts.some((draft) => draft.id === categoryId)
      ? categoryId
      : (managementDrafts[0]?.id ?? null)
    shouldFocusManagementName = focusName
    manageCategoriesOpen = true
  }

  const closeManageCategories = () => {
    manageCategoriesOpen = false
    managementDrafts = []
    selectedCategoryId = null
    shouldFocusManagementName = false
  }

  /** Close, X, and Escape ask before discarding changed drafts, like the live management dialogs. */
  const requestCloseManageCategories = () => {
    if (!managementHasChanges) {
      closeManageCategories()
      return
    }
    confirmation = {
      title: 'Discard Changes',
      description: 'Your unsaved changes will be lost.',
      submit: 'Discard changes',
      confirm: closeManageCategories
    }
  }

  const addCategoryDraft = () => {
    const id = window.crypto.randomUUID()
    managementDrafts.push({
      id,
      title: '',
      shortDescription: '',
      text: '',
      fixedHeightPx: 176,
      hasInteracted: false
    })
    selectedCategoryId = id
    shouldFocusManagementName = true
  }

  const deleteSelectedCategoryDraft = () => {
    if (!selectedCategoryDraft) return
    const index = managementDrafts.findIndex((draft) => draft.id === selectedCategoryDraft.id)
    managementDrafts.splice(index, 1)
    selectedCategoryId = managementDrafts[index]?.id ?? managementDrafts[index - 1]?.id ?? null
    shouldFocusManagementName = false
  }

  const saveCategoryDrafts = () => {
    if (!managementDraftsValid || !managementHasChanges) return
    const retainedIds = new Set(managementDrafts.map((draft) => draft.id))
    for (const removedCategory of categories.filter((category) => !retainedIds.has(category.id))) {
      for (const prompt of removedCategory.prompts) prompt.categoryId = 'base-root'
      rootPrompts.push(...removedCategory.prompts)
    }
    categories = managementDrafts.map((draft) => {
      const existing = categories.find((category) => category.id === draft.id)
      return {
        id: draft.id,
        title: draft.title.trim(),
        shortDescription: draft.shortDescription.trim(),
        description: draft.text.trim(),
        prompts: existing?.prompts ?? [],
        collapsed: existing?.collapsed ?? false
      }
    })
    closeManageCategories()
  }

  // Side effect: focus and select the local name field each time its dialog mounts.
  $effect(() => {
    if (!nameInput) return
    nameInteracted = false
    nameInput.focus()
    nameInput.select()
  })

  // Side effect: focus and select the managed category name requested by rename or creation.
  $effect(() => {
    if (!managementNameInput || !shouldFocusManagementName) return
    managementNameInput.focus()
    managementNameInput.select()
    shouldFocusManagementName = false
  })

  // Side effect: portal local overlays beyond the mockup's containing block.
  const mountMockDialog = (node: HTMLElement) => {
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.appendChild(node)
    // Keep keyboard focus inside the local modal and restore the initiating control on close.
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .filter((control) => control.getClientRects().length > 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault()
        first?.focus()
      }
    }
    node.addEventListener('keydown', trapFocus)
    const focusFrame = window.requestAnimationFrame(() => {
      if (!node.contains(document.activeElement)) node.querySelector<HTMLElement>('button, input, [tabindex]')?.focus()
    })
    return { destroy: () => {
      window.cancelAnimationFrame(focusFrame)
      node.removeEventListener('keydown', trapFocus)
      node.remove()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    } }
  }
  const EDITOR_BODY_PADDING_TOP_PX = 8
  const EDITOR_BODY_PADDING_RIGHT_PX = 10
  const EDITOR_BODY_PADDING_BOTTOM_PX = 10
  const EDITOR_BODY_PADDING_LEFT_PX = 10
  const editorSizing = {
    fontSize: 16,
    minLines: 2,
    maxLines: 35,
    attachedNoteReservedLines: 10
  }
  const lineHeightPx = Math.round(editorSizing.fontSize * 1.35)
  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const clampEditorHeight = (heightPx: number, document: MockDocument): number => {
    const prompt = allPrompts.find((item) => item.id === document.id)
    const reservedNoteLines = prompt?.note?.visible
      ? Math.ceil((noteHeights.get(prompt.note.id) ?? lineHeightPx) / lineHeightPx)
      : 0
    const maxLines = 'visible' in document
      ? editorSizing.attachedNoteReservedLines
      : editorSizing.maxLines - reservedNoteLines
    const minLines = Math.min(document.minLines ?? editorSizing.minLines, maxLines)
    return Math.min(Math.max(heightPx, lineHeightPx * minLines), lineHeightPx * maxLines)
  }

  // Side effect: visible notes share the prompt's line budget; hiding one returns its space.
  $effect(() => {
    for (const prompt of allPrompts) {
      if (prompt.note) {
        void prompt.note.visible
        void noteHeights.get(prompt.note.id)
      }
      const syncHeight = editorHeightSync.get(prompt.id)
      if (syncHeight) untrack(syncHeight)
    }
  })

  const getTokenCount = (text: string): number => estimateTokenCount(text)

  const getEditorUri = (documentId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/prompt-collection-base/${documentId}.md`)

  const createEditor = (host: HTMLElement, document: MockDocument) => {
    const modelUri = getEditorUri(document.id)
    const existingModel = monaco.editor.getModel(modelUri)
    const model = existingModel ?? monaco.editor.createModel(document.text, 'markdown', modelUri)
    model.setValue(document.text)

    const editor = monaco.editor.create(host, {
      model,
      automaticLayout: true,
      pasteAs: { enabled: false },
      ariaLabel: `${document.id} editor`,
      fontSize: editorSizing.fontSize,
      lineHeight: lineHeightPx,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      minimap: { enabled: false },
      renderLineHighlightOnlyWhenFocus: true,
      renderWhitespace: 'none',
      renderValidationDecorations: 'off',
      revealHorizontalRightPadding: 0,
      scrollBeyondLastLine: false,
      overviewRulerBorder: false,
      scrollbar: { handleMouseWheel: false, alwaysConsumeMouseWheel: false },
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      dimension: {
        width: Math.max(1, host.clientWidth),
        height: document.fixedHeightPx ??
          clampEditorHeight(
            lineHeightPx * Math.max(1, document.text.split('\n').length),
            document
          )
      }
    })
    mountedEditors.set(document.id, editor)
    editorFindDecorations.set(document.id, editor.createDecorationsCollection())

    const syncHeight = () => {
      const heightPx = document.fixedHeightPx ??
        clampEditorHeight(Math.ceil(editor.getContentHeight()), document)
      if ('visible' in document && noteHeights.get(document.id) !== heightPx) {
        noteHeights.set(document.id, heightPx)
      }
      host.style.height = `${heightPx}px`
      editor.layout({ width: Math.max(1, host.clientWidth), height: heightPx })
    }

    editorHeightSync.set(document.id, syncHeight)
    syncHeight()
    const viewState = editorViewStates.get(document.id)
    if (viewState) editor.restoreViewState(viewState)
    const contentSizeDisposable = editor.onDidContentSizeChange(syncHeight)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      document.text = editor.getValue()
      if ('visible' in document) {
        const note = document as MockAttachedNote
        note.isEdited = true
        note.modifiedLabel = 'Updated today'
      } else if ('isEdited' in document) markPromptEdited(document as MockPrompt)
    })

    /** Prompt whose body or attached note this editor shows; category descriptions have none. */
    const getOwnerPrompt = () => 'visible' in document
      ? allPrompts.find((prompt) => prompt.note?.id === document.id)
      : allPrompts.find((prompt) => prompt.id === document.id)
    const getTitleInput = (prompt: MockPrompt) =>
      window.document.getElementById(`base-card-${prompt.id}`)?.querySelector<HTMLInputElement>('input') ?? null

    // Plain ArrowUp at the body's start moves to the title's end, ArrowDown at its end moves to the note's start,
    // and ArrowUp at the note's start returns to the body's end; selections and open suggestions keep Monaco's keys.
    const keyDownDisposable = editor.onKeyDown((event) => {
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
      const isUp = event.keyCode === monaco.KeyCode.UpArrow
      if (!isUp && event.keyCode !== monaco.KeyCode.DownArrow) return
      const owner = getOwnerPrompt()
      if (!owner || editor.getDomNode()?.querySelector('.suggest-widget.visible')) return
      const isNote = 'visible' in document
      if (isNote && !isUp) return
      const leave = isNote
        ? () => focusEditorAtEdge(mountedEditors.get(owner.id), 'end')
        : isUp
          ? () => {
              const input = getTitleInput(owner)
              input?.setSelectionRange(input.value.length, input.value.length)
              input?.focus({ preventScroll: true })
            }
          : owner.note?.visible ? () => focusEditorAtEdge(mountedEditors.get(owner.note!.id), 'start') : null
      if (!leave) return
      const selections = editor.getSelections()
      if (selections?.length !== 1 || !selections[0].isEmpty()) return
      const edge = isUp ? new monaco.Position(1, 1) : editor.getModel()!.getFullModelRange().getEndPosition()
      if (!selections[0].getPosition().equals(edge)) return
      event.preventDefault()
      event.stopPropagation()
      leave()
    })

    // A prompt's title, body, and note share wheel scrolling while any of them has focus; fixed-height editors always
    // scroll. A gesture that starts while the editor can scroll stays with it at its edge instead of moving the screen.
    let lastWheelTimeStampMs = Number.NEGATIVE_INFINITY
    let isWheelGestureLatchedToEditor = false
    const handleWheelCapture = (event: WheelEvent) => {
      const owner = getOwnerPrompt()
      const isFocused = owner
        ? window.document.activeElement === getTitleInput(owner) ||
          mountedEditors.get(owner.id)?.hasWidgetFocus() === true ||
          mountedEditors.get(owner.note?.id ?? '')?.hasWidgetFocus() === true
        : editor.hasWidgetFocus()
      const handleMouseWheel = document.fixedHeightPx !== undefined || isFocused
      if (editor.getOption(monaco.editor.EditorOption.scrollbar).handleMouseWheel !== handleMouseWheel) {
        editor.updateOptions({ scrollbar: { handleMouseWheel } })
      }
      if (!isFocused || event.deltaY === 0) return
      const scrollTop = editor.getScrollTop()
      const canEditorScroll = event.deltaY > 0
        ? scrollTop + editor.getLayoutInfo().height < editor.getScrollHeight()
        : scrollTop > 0
      if (event.timeStamp - lastWheelTimeStampMs > 250) isWheelGestureLatchedToEditor = canEditorScroll
      lastWheelTimeStampMs = event.timeStamp
      if (!isWheelGestureLatchedToEditor || canEditorScroll) return
      event.preventDefault()
      event.stopPropagation()
    }
    host.addEventListener('wheel', handleWheelCapture, { capture: true, passive: false })

    let isDisposed = false
    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      contentSizeDisposable.dispose()
      contentDisposable.dispose()
      keyDownDisposable.dispose()
      host.removeEventListener('wheel', handleWheelCapture, { capture: true })
      const viewState = editor.saveViewState()
      if (viewState) editorViewStates.set(document.id, viewState)
      editorHeightSync.delete(document.id)
      editorFindDecorations.get(document.id)?.clear()
      editorFindDecorations.delete(document.id)
      editor.dispose()
      mountedEditors.delete(document.id)
      if (!existingModel) model.dispose()
    }

    editorCleanupCallbacks.add(cleanup)

    return () => {
      cleanup()
      editorCleanupCallbacks.delete(cleanup)
    }
  }

  /** Focuses an editor with one collapsed cursor at the document edge facing the field being left. */
  const focusEditorAtEdge = (
    editor: monaco.editor.IStandaloneCodeEditor | undefined,
    edge: 'start' | 'end'
  ) => {
    if (!editor) return
    const position = edge === 'start'
      ? new monaco.Position(1, 1)
      : editor.getModel()!.getFullModelRange().getEndPosition()
    editor.setPosition(position, 'keyboard')
    editor.revealPosition(position)
    editor.focus()
  }

  const mountMockupMonaco = (node: HTMLElement, document: MockDocument) => {
    // Side effect: mount a real Monaco instance for this mock document and dispose it with the host.
    const destroy = createEditor(node, document)
    return { destroy }
  }

  // Side effect: clicking the editor's padding focuses that section without adding a tab stop.
  const focusEditorFromPadding = (node: HTMLElement, document: MockDocument) => {
    const click = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.monaco-editor')) mountedEditors.get(document.id)?.focus()
    }
    node.addEventListener('click', click)
    return { destroy: () => node.removeEventListener('click', click) }
  }

  // Side effect: dispose any Monaco instance still owned by the mockup when it unmounts.
  onDestroy(() => {
    for (const cleanup of editorCleanupCallbacks) cleanup()
    editorCleanupCallbacks.clear()
    window.clearTimeout(copyResetTimer)
  })

  // Side effect: handle sandbox find and dismiss open mock dialogs and menus; remove the listener on unmount.
  $effect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Escape closes only the top-most layer, so a discard confirmation can sit above Manage Categories.
      if (event.key === 'Escape') {
        if (statusMenuId || deleteMenuId || noteMenuId || isCollectionActionsOpen || categoryMenu) closeMenus()
        else if (confirmation) confirmation = null
        else if (copyError) copyError = null
        else if (templateDialogPrompt) closeTemplateDialog()
        else if (nameDialog) nameDialog = null
        else if (manageCategoriesOpen) requestCloseManageCategories()
        else findOpen = false
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'f' && !templateDialogPrompt && !nameDialog && !manageCategoriesOpen && !confirmation) {
        event.preventDefault()
        findOpen = true
        findInput?.focus()
        findInput?.select()
      }
      if (event.key === 'F3' && findOpen) {
        event.preventDefault()
        revealFindMatch(event.shiftKey ? -1 : 1)
      }
    }
    document.addEventListener('keydown', handleKeydown)

    return () => document.removeEventListener('keydown', handleKeydown)
  })

  const markPromptEdited = (prompt: MockPrompt) => {
    prompt.isEdited = true
    prompt.modifiedLabel = 'Updated today'
  }

  const finalizedLabel = (prompt: MockPrompt) => {
    const days = Math.floor((Date.now() - (prompt.finalizedAt ?? Date.now())) / 86_400_000)
    return `${prompt.status} ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`
  }

  const requestCopyPrompt = (prompt: MockPrompt, selectedTemplate?: MockTemplate | null) => {
    if (prompt.status === 'Backlog' || prompt.status === 'Completed' || prompt.status === 'Archived') {
      confirmation = {
        title: 'Copy Prompt',
        description: `Copying this prompt will move it from ${prompt.status} to In Progress.`,
        submit: 'Copy and Move',
        informational: true,
        confirm: () => { void copyPrompt(prompt, selectedTemplate) }
      }
      return
    }
    void copyPrompt(prompt, selectedTemplate)
  }

  const copyPrompt = async (prompt: MockPrompt, selectedTemplate?: MockTemplate | null) => {
    const template = selectedTemplate === undefined
      ? templateCollections.flatMap(getTemplates).find((item) => item.id === prompt.templateIds[0])
      : selectedTemplate
    const templateText = template?.text
    const text = templateText?.includes('[[PROMPT_TEXT]]')
      ? templateText.replaceAll('[[PROMPT_TEXT]]', prompt.text)
      : prompt.text
    try {
      await window.navigator.clipboard.writeText(text)
      if (selectedTemplate !== undefined) {
        prompt.templateIds = template ? [template.id] : []
        prompt.templateLabel = template?.title ?? NO_TEMPLATE_LABEL
        prompt.templateState = template ? 'selected' : 'no-template'
      }
      copiedPromptId = prompt.id
      window.clearTimeout(copyResetTimer)
      copyResetTimer = window.setTimeout(() => { copiedPromptId = null }, 1500)
      setPromptStatus(prompt, MockPromptStatus.InProgress)
    } catch {
      copyError = 'Unable to copy to the clipboard. Please try again.'
    }
  }

  const setPromptStatus = (prompt: MockPrompt, status: MockPromptStatus) => {
    prompt.status = status
    prompt.finalizedAt = status === 'Completed' || status === 'Archived' ? Date.now() : null
    statusMenuId = null
  }
</script>

{#snippet IconButton(
  Icon: LucideIcon,
  label: string,
  options: MockIconButtonOptions = {}
)}
  <button
    type="button"
    class="base-icon-button"
    aria-label={label}
    aria-expanded={options.ariaExpanded}
    aria-haspopup={options.ariaHaspopup}
    aria-pressed={options.ariaPressed}
    data-active={options.active === undefined ? undefined : options.active ? 'true' : 'false'}
    data-base-variant={options.baseVariant ?? 'normal'}
    data-borderless={options.borderless ? 'true' : 'false'}
    data-hover-variant={options.hoverVariant ?? 'neutral'}
    data-size={options.size ?? 'default'}
    data-testid={options.testId}
    title={label}
    disabled={options.disabled}
    onclick={options.onclick}
  >
    {#if options.customIcon}
      <CustomIcon
        icon={options.customIcon}
        class={options.iconClass}
        size={options.iconSize ?? 20}
        aria-hidden="true"
      />
    {:else}
      <Icon
        class={options.iconClass}
        size={options.iconSize ??
          (options.size === undefined || options.size === 'default' || options.size === 'compact-large-icon'
            ? 20
            : options.size === 'tiny'
              ? 14
              : 16)}
        aria-hidden="true"
      />
    {/if}
  </button>
{/snippet}

<!-- Live MoveHereIndicator: blue bars around a Move Here label, or one gray bar when the drop changes nothing. -->
{#snippet MoveHereIndicator(isBlocked: boolean)}
  <div class="base-move-here" data-blocked={isBlocked ? 'true' : 'false'} aria-hidden="true">
    <span class="base-move-here-bar"></span>
    {#if !isBlocked}
      <span class="base-move-here-label text-sm"><span>Move Here</span></span>
      <span class="base-move-here-bar"></span>
    {/if}
  </div>
{/snippet}

<!-- Live DropIndicator: a chevron and line on a tree row's top or bottom edge. -->
{#snippet TreeDropIndicator(edge: 'top' | 'bottom', insetPx: number, isBlocked: boolean)}
  <div class="base-tree-drop-indicator" data-edge={edge} data-blocked={isBlocked ? 'true' : 'false'}
    style={`--base-drop-inset:${insetPx}px;`} aria-hidden="true">
    <svg width="100%" height="10">
      <path d="M3 1.5 L8 5 L3 8.5" />
      <line x1="8" y1="5" x2="100%" y2="5"></line>
    </svg>
  </div>
{/snippet}

{#snippet IconCell(Icon: LucideIcon, large = false)}
  <span class="base-icon-cell">
    <Icon size={large ? 32 : 24} strokeWidth={large ? 1.5 : 2} aria-hidden="true" />
  </span>
{/snippet}

{#snippet Separator()}
  <div class="base-separator" role="presentation"></div>
{/snippet}

{#snippet SeparatorDot()}
  <span class="base-separator-dot" aria-hidden="true"></span>
{/snippet}

{#snippet TemplateCategoryRows(category: MockTemplateGroup, indentCount: number)}
  {@const isExpanded = !collapsedTemplateCategoryIds.has(category.id)}
  <div class="base-template-category-row">
    <button
      type="button"
      class="base-template-category-button text-sm"
      style={`--base-template-indent-count:${indentCount};`}
      aria-expanded={isExpanded}
      onclick={() => toggleTemplateCategory(category.id)}
    >
      <span class="base-template-chevron" data-expanded={isExpanded ? 'true' : 'false'}>
        <ChevronRight size={20} aria-hidden="true" />
      </span>
      <Folder size={16} aria-hidden="true" />
      <span>{category.title}</span>
    </button>
  </div>

  {#if isExpanded}
    {#each category.templates as template (template.id)}
      <div class="base-template-option-row">
        <button
          type="button"
          class="base-template-option-button text-sm"
          class:active={templateDialogMode === 'select' && selectedTemplateIds.has(template.id)}
          style={`--base-template-indent-count:${indentCount + 1};`}
          aria-pressed={templateDialogMode === 'select'
            ? selectedTemplateIds.has(template.id)
            : undefined}
          onclick={() => selectTemplate(template)}
          ondblclick={templateDialogMode === 'select' ? () => selectAndCopyTemplate(template) : undefined}
        >
          <span
            class="base-template-guide"
            data-indent-count={indentCount + 1}
            aria-hidden="true"
          ></span>
          <span
            class="base-template-selection-mark"
            data-control={templateDialogMode === 'select-and-copy' ? 'copy' : 'radio'}
            aria-hidden="true"
          >
            {#if templateDialogMode === 'select-and-copy'}
              <Copy size={16} />
            {/if}
          </span>
          <span>{template.title}</span>
        </button>
      </div>
    {/each}
    {#each category.children as child (child.id)}
      {@render TemplateCategoryRows(child, indentCount + 1)}
    {/each}
  {/if}
{/snippet}

{#snippet StatusControl(prompt: MockPrompt)}
  {@const isActive = prompt.status === 'Todo' || prompt.status === 'InProgress'}
  {@const hasBackward = isActive || prompt.status === 'Completed'}
  {@const hasForward = isActive || prompt.status === 'Backlog'}
  {@const StatusIcon = prompt.status === 'Completed' ? Check : prompt.status === 'Archived' ? Archive : prompt.status === 'Backlog' ? Clock : prompt.status === 'InProgress' ? Play : CircleDashed}
  <div class="base-status-control">
    <div class="base-status-segmented" data-status={prompt.status}
      data-leading-action={hasBackward ? 'true' : 'false'} data-trailing-action={hasForward ? 'true' : 'false'}>
      {#if hasBackward}
        {@render IconButton(prompt.status === 'Todo' ? Clock : CircleDashed,
          prompt.status === 'Todo' ? 'Move prompt to Backlog' : prompt.status === 'Completed' ? 'Uncomplete prompt' : 'Set prompt to Todo', {
            onclick: () => setPromptStatus(prompt, prompt.status === 'Todo' ? MockPromptStatus.Backlog : MockPromptStatus.Todo)
          })}
        <span class="base-split-separator" aria-hidden="true"></span>
      {/if}
      <span class="base-status-selector" data-open={statusMenuId === prompt.id ? 'true' : 'false'}>
        <button type="button" class="base-status-value text-sm"
          aria-label={`Change status: ${prompt.status === 'InProgress' ? 'In Progress' : prompt.status}`}
          aria-haspopup="menu" aria-expanded={statusMenuId === prompt.id}
          onclick={(event) => toggleStatusMenu(prompt, event)}>
          <span class="base-status-value-content">
            <StatusIcon size={16} aria-hidden="true" />
            <span>{prompt.status === 'InProgress' ? 'In Progress' : prompt.status}</span>
          </span>
          <span class="base-status-more" title="More Options" aria-hidden="true">
            {#if statusMenuId === prompt.id}
              <ChevronUp size={20} />
            {:else}
              <ChevronDown size={20} />
            {/if}
          </span>
        </button>
        <span class="base-status-width-sizer" aria-hidden="true">
          {#each statusItems.filter((item) => item.id !== 'Archived' || prompt.status === 'Archived') as item (item.id)}
            <span class="base-status-width-sizer-item">
              <item.icon size={16} />
              <span>{item.selectedLabel ?? item.label}</span>
            </span>
          {/each}
        </span>
      </span>
      {#if hasForward}
        <span class="base-split-separator" aria-hidden="true"></span>
        {@render IconButton(prompt.status === 'Backlog' ? CircleDashed : Check,
          prompt.status === 'Backlog' ? 'Set prompt to Todo' : 'Complete prompt', {
            hoverVariant: prompt.status === 'Backlog' ? 'neutral' : 'success',
            onclick: () => setPromptStatus(prompt, prompt.status === 'Backlog' ? MockPromptStatus.Todo : MockPromptStatus.Completed)
          })}
      {/if}
    </div>
    {#if statusMenuId === prompt.id && statusAnchor}
      <div class="base-status-menu" role="menu" aria-label="Change status More Options"
        use:mountMockMenu={{ anchor: statusAnchor }}>
        {#each statusItems.filter((item) => item.id !== prompt.status && item.id !== 'Archived') as item (item.id)}
          <button class="base-status-menu-item" type="button" role="menuitem" onclick={() => setPromptStatus(prompt, item.id)}>
            <span class="base-status-menu-icon" data-status={item.id}><item.icon size={18} aria-hidden="true" /></span>
            <span class="base-status-menu-text">
              <span class="base-status-menu-title text-sm leading-4.5">{item.label}</span>
              <span class="base-status-menu-subtitle text-xs" title={item.detail}>{item.detail}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet AttachedNoteControl(prompt: MockPrompt)}
  <!-- A visible blank note makes deletion the main action, so its options trigger is disabled. -->
  {@const isDeleteDefault = isBlankVisibleNote(prompt)}
  {@const label = !prompt.note
    ? 'Add attached note'
    : isDeleteDefault ? 'Delete attached note' : prompt.note.visible ? 'Hide attached note' : 'Show attached note'}
  <div class="base-split-button">
    {@render IconButton(!prompt.note ? NotebookPen : prompt.note.visible ? Eye : EyeOff, label, {
      ariaPressed: prompt.note && !isDeleteDefault ? prompt.note.visible : undefined,
      hoverVariant: isDeleteDefault ? 'danger' : 'neutral',
      customIcon: isDeleteDefault ? notebookXIcon : undefined,
      onclick: () => { void toggleAttachedNote(prompt) }
    })}
    <span class="base-split-separator" aria-hidden="true"></span>
    {@render IconButton(ChevronDown, `${label} More Options`, {
      disabled: !prompt.note || isDeleteDefault,
      active: noteMenuId === prompt.id,
      ariaExpanded: noteMenuId === prompt.id,
      ariaHaspopup: 'menu',
      onclick: (event) => {
        const isOpen = noteMenuId === prompt.id
        closeMenus()
        if (isOpen) return
        noteAnchor = event.currentTarget as HTMLElement
        captureMenuPoint(event, noteAnchor)
        noteMenuId = prompt.id
      }
    })}
    {#if noteMenuId === prompt.id && noteAnchor}
      <div class="base-status-menu" role="menu" aria-label="Attached note actions"
        use:mountMockMenu={{ anchor: noteAnchor }}>
        <button class="base-status-menu-item" type="button" role="menuitem" onclick={() => requestNoteDelete(prompt)}>
          <span class="base-status-menu-icon" data-action="delete">
            <CustomIcon icon={notebookXIcon} size={20} aria-hidden="true" />
          </span>
          <span class="base-status-menu-text">
            <span class="base-status-menu-title text-sm leading-4.5">Delete Note</span>
            <span class="base-status-menu-subtitle text-xs">Permanently delete attached note</span>
          </span>
        </button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet AttachedNoteSection(prompt: MockPrompt, note: MockAttachedNote)}
  {@render Separator()}
  <button type="button" class="base-attached-note-header" data-hidden={!note.visible}
    aria-expanded={note.visible} aria-label={note.visible ? 'Hide attached note' : 'Show attached note'}
    onclick={() => { void toggleAttachedNote(prompt) }}>
    {#if note.visible}
      <span class="base-status-indicator base-attached-note-indicator" data-edited={note.isEdited} aria-hidden="true"></span>
    {/if}
    <span class="base-attached-note-icon" aria-hidden="true">
      {#if note.visible}<NotebookPen size={16} />{:else}<EyeOff size={16} />{/if}
    </span>
    <span class="base-attached-note-copy">
      <span class="base-attached-note-title text-sm leading-5">Attached Note</span>
      <span class="base-attached-note-metadata text-xs">{note.visible ? note.modifiedLabel : 'Hidden'}</span>
    </span>
  </button>
  {#if note.visible}
    {@render Separator()}
    {@render MonacoBody(note, `base-mockup-note-${note.id}`)}
  {/if}
{/snippet}

{#snippet MonacoBody(document: MockDocument, testId: string)}
  <div
    id={`base-document-${document.id}`}
    class="base-monaco-shell"
    style={`padding:${EDITOR_BODY_PADDING_TOP_PX}px ${EDITOR_BODY_PADDING_RIGHT_PX}px ${document.minLines === 1 && !('visible' in document) ? 8 : EDITOR_BODY_PADDING_BOTTOM_PX}px ${EDITOR_BODY_PADDING_LEFT_PX}px;`}
    use:focusEditorFromPadding={document}
  >
    <div
      class="base-monaco-host"
      data-testid={testId}
      use:mountMockupMonaco={document}
    ></div>
  </div>
{/snippet}

{#snippet Divider(category?: MockCategory, afterId?: string, nextCategoryId?: string | null)}
  {#if !isFinalMode}
    {@const dropTarget = getDividerDropTarget(category, afterId, nextCategoryId)}
    <!-- An empty status group keeps every Add Prompt action revealed. -->
    <div class="base-divider-row" data-revealed={groupCounts[screenMode] === 0 ? 'true' : 'false'}
      use:mockDropTarget={dropTarget}>
      {#if activeDrop?.key === dropTarget.key}
        {@render MoveHereIndicator(activeDrop.isBlocked)}
      {:else}
        <div class="base-divider-content">
          <button type="button" class="base-divider-line-button" tabindex="-1" aria-label="Add Prompt from left separator"
            onclick={() => { void addPromptFromDivider(category, afterId) }}>
            {@render Separator()}
          </button>
          <div class="base-divider-actions">
            <button type="button" class="base-divider-action-button text-xs leading-4" aria-label="Add Prompt"
              onclick={() => { void addPromptFromDivider(category, afterId) }}>
              <Plus size={13} aria-hidden="true" />
              <span>Add Prompt</span>
            </button>
          </div>
          <button type="button" class="base-divider-line-button" tabindex="-1" aria-label="Add Prompt from right separator"
            onclick={() => { void addPromptFromDivider(category, afterId) }}>
            {@render Separator()}
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="base-final-gap">{@render Separator()}</div>
  {/if}
{/snippet}

{#snippet PromptCard(prompt: MockPrompt)}
  {@const archiveDefault = prompt.status !== 'Archived' && Boolean(prompt.title.trim() || prompt.text.trim())}
  {@const titleMatches = getTitleMatches(prompt)}
  {@const isHighlighted = navigationHighlight?.promptId === prompt.id}
  <!-- Focus inside a card selects it in the sidebar tree, like the live prompt-interaction selection. -->
  <article
    id={`base-card-${prompt.id}`}
    class="base-editor-card base-prompt-card"
    data-testid={`base-mockup-prompt-editor-${prompt.id}`}
    data-prompt-category-id={prompt.categoryId}
    data-follow-row="prompt"
    data-follow-id={prompt.id}
    data-dragging={dragSource?.kind === 'prompt' && dragSource.id === prompt.id ? 'true' : 'false'}
    use:promptMoveShortcuts={prompt}
    onfocusin={() => {
      selection = { kind: 'prompt', id: prompt.id }
      isSelectionManual = true
    }}
  >
    <aside class="base-editor-sidebar">
      <!-- Keyed by generation so each tree click replays the rail's violet wash. -->
      {#key isHighlighted ? navigationHighlight?.generation : null}
        <span class="base-rail-highlight" data-navigation-highlight={isHighlighted ? 'true' : undefined} aria-hidden="true"></span>
      {/key}
      <button type="button" aria-label="Drag prompt" class="base-drag-button" tabindex="-1" disabled={isFinalMode}
        use:mockDragHandle={{ kind: 'prompt', id: prompt.id, title: prompt.title.trim() || 'New Prompt', disabled: isFinalMode }}>
        <GripVertical size={16} aria-hidden="true" />
      </button>
    </aside>

    <div class="base-editor-body">
      <header class="base-prompt-title-area">
        <span class="base-status-indicator" data-status={prompt.status} data-edited={prompt.isEdited} aria-hidden="true"></span>
        <div class="base-prompt-title-main">
          {@render IconCell(FileText)}
          <div class="base-title-copy">
            <div class="base-title-field">
              <div class="base-title-highlights text-sm leading-5" aria-hidden="true">
                <div class="base-title-mirror">
                  {#each titleMatches as match, matchIndex (match.offset)}
                    {prompt.title.slice(matchIndex === 0 ? 0 : titleMatches[matchIndex - 1].offset + findQuery.length, match.offset)}<span
                      class="base-title-match" data-current={match === activeFindMatch}
                    >{prompt.title.slice(match.offset, match.offset + findQuery.length)}</span>
                  {/each}{prompt.title.slice(titleMatches.length ? titleMatches[titleMatches.length - 1].offset + findQuery.length : 0)}
                </div>
              </div>
            <input class="text-sm leading-5" aria-label="Prompt title" placeholder={prompt.title.trim() ? 'Title...' : 'New Prompt...'} bind:value={prompt.title}
              oninput={() => markPromptEdited(prompt)}
              onscroll={(event) => syncTitleHighlightScroll(event.currentTarget)}
              onkeydown={(event) => {
                // Plain Enter keeps the body's selection; plain ArrowDown starts at the body's first position.
                if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  mountedEditors.get(prompt.id)?.focus()
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  focusEditorAtEdge(mountedEditors.get(prompt.id), 'start')
                }
              }} />
            </div>
            <div class="base-metadata-row text-xs">
              <span
                class="base-template-label"
                data-template-state={prompt.templateState}
                title={prompt.templateLabel}
              >
                <Layers size={12} aria-hidden="true" />
                {prompt.templateLabel}
              </span>
              {@render SeparatorDot()}
              <span>{prompt.modifiedLabel}</span>
              {@render SeparatorDot()}
              <span>{getTokenCount(prompt.text)} {getTokenCount(prompt.text) === 1 ? 'token' : 'tokens'}</span>
              {#if prompt.finalizedAt}
                {@render SeparatorDot()}
                <span title={new Date(prompt.finalizedAt).toLocaleString()}>{finalizedLabel(prompt)}</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="base-prompt-actions">
          <div class="base-icon-button-bar">
            {#if prompt.templateState === 'not-selected'}
              {@render IconButton(Zap, 'Select Template and Copy', {
                onclick: () => openTemplateDialog(prompt, 'select-and-copy')
              })}
            {:else}
              {@render IconButton(copiedPromptId === prompt.id ? ClipboardCheck : Copy, copiedPromptId === prompt.id ? 'Copied' : 'Copy prompt', {
                hoverVariant: 'accent',
                onclick: () => requestCopyPrompt(prompt)
              })}
            {/if}
            {@render IconButton(Layers, 'Set Template', {
              onclick: () => openTemplateDialog(prompt)
            })}
            {@render AttachedNoteControl(prompt)}
            {@render IconButton(Maximize2, 'Open in editor')}
          </div>
          <span class="base-actions-separator" aria-hidden="true"></span>
          {@render StatusControl(prompt)}
          <span class="base-actions-separator" aria-hidden="true"></span>
          <div class:base-split-button={prompt.status !== 'Archived'}>
            {@render IconButton(archiveDefault ? Archive : Trash2, archiveDefault ? 'Archive prompt' : 'Delete prompt', {
              hoverVariant: archiveDefault ? 'neutral' : 'danger',
              onclick: () => archiveDefault ? setPromptStatus(prompt, MockPromptStatus.Archived) : requestPromptDelete(prompt)
            })}
            {#if prompt.status !== 'Archived'}
              <span class="base-split-separator" aria-hidden="true"></span>
              {@render IconButton(ChevronDown, `${archiveDefault ? 'Archive prompt' : 'Delete prompt'} More Options`, {
                active: deleteMenuId === prompt.id,
                ariaExpanded: deleteMenuId === prompt.id,
                ariaHaspopup: 'menu',
                onclick: (event) => {
                  const isOpen = deleteMenuId === prompt.id
                  closeMenus()
                  if (isOpen) return
                  deleteAnchor = event.currentTarget as HTMLElement
                  captureMenuPoint(event, deleteAnchor)
                  deleteMenuId = prompt.id
                }
              })}
              {#if deleteMenuId === prompt.id && deleteAnchor}
                <div class="base-status-menu" role="menu" aria-label="Prompt actions"
                  use:mountMockMenu={{ anchor: deleteAnchor }}>
                  <button class="base-status-menu-item" type="button" role="menuitem" onclick={() => {
                    deleteMenuId = null
                    if (archiveDefault) requestPromptDelete(prompt)
                    else setPromptStatus(prompt, MockPromptStatus.Archived)
                  }}>
                    <span class="base-status-menu-icon" data-action="delete">
                      {#if archiveDefault}<Trash2 size={18} aria-hidden="true" />{:else}<Archive size={18} aria-hidden="true" />{/if}
                    </span>
                    <span class="base-status-menu-text">
                      <span class="base-status-menu-title text-sm leading-4.5">{archiveDefault ? 'Delete Prompt' : 'Archive Prompt'}</span>
                      <span class="base-status-menu-subtitle text-xs">{archiveDefault ? 'Permanently delete prompt' : 'Move to Archived'}</span>
                    </span>
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </header>

      {@render Separator()}
      {@render MonacoBody(prompt, `base-mockup-monaco-${prompt.id}`)}
      {#if prompt.note}
        {#key prompt.note.id}
          {@render AttachedNoteSection(prompt, prompt.note)}
        {/key}
      {/if}
    </div>
  </article>
{/snippet}

{#snippet CategoryCard(category: MockCategory)}
  <section id={`base-category-${category.id}`} class="base-category-section" data-category-id={category.id} data-testid={`base-mockup-category-${category.id}`}>
    <article id={`base-category-card-${category.id}`} class="base-editor-card base-category-card"
      data-follow-row="category" data-follow-id={category.id}>
      <aside class="base-category-sidebar">
        {#if !isFinalMode}
        <button type="button" aria-label="Drag category" title="Drag category" tabindex="-1"
          use:mockDragHandle={{ kind: 'category', id: category.id, title: category.title }}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
        {/if}
      </aside>

      <div class="base-editor-body">
        <header class="base-category-title-bar">
          <div class="base-category-title-main">
            <button class="base-category-chevron" type="button" aria-label={category.collapsed ? 'Expand category prompts' : 'Collapse category prompts'} aria-expanded={!category.collapsed} onclick={() => category.collapsed = !category.collapsed}>
              <ChevronRight size={24} aria-hidden="true" />
            </button>
            {@render IconCell(Folder)}
            <div class="base-category-title-copy">
              <div class="base-category-title-line">
                <span class="base-category-title text-base leading-5" title={category.title}>{category.title}</span>
                {#if !isFinalMode}
                {@render IconButton(Pencil, 'Rename category', {
                  onclick: () => openManageCategories(category.id, true),
                  size: 'tiny',
                  baseVariant: 'muted',
                  hoverVariant: 'glyph'
                })}
                {/if}
              </div>
              <div class="base-metadata-row text-xs">
                <span>{visiblePrompts(category.prompts).length} {visiblePrompts(category.prompts).length === 1 ? 'prompt' : 'prompts'}</span>
              </div>
            </div>
          </div>

          <div class="base-category-actions">
            <div class="base-icon-button-bar">
              {#if !isFinalMode}
                {@render IconButton(FolderCog, 'Manage category', {
                  hoverVariant: 'accent',
                  onclick: () => openManageCategories(category.id)
                })}
              {/if}
            </div>
          </div>
        </header>
      </div>
    </article>

    {#if !category.collapsed}
    <div class="base-category-children">
      {@render Divider(category)}
      {#each visiblePrompts(category.prompts) as prompt (prompt.id)}
        {@render PromptCard(prompt)}
        {@render Divider(category, prompt.id)}
      {/each}
    </div>
    {:else}
      {@const summaryTarget = {
        key: `collapsed:${category.id}`,
        resolve: (source: MockDragSource) => resolvePromptMove(source, { group: screenMode, categoryId: category.id })
      }}
      <div class="base-category-children base-collapsed-summary" use:mockDropTarget={summaryTarget}>
        {#if activeDrop?.key === summaryTarget.key}
          {@render MoveHereIndicator(activeDrop.isBlocked)}
        {:else}
          <button type="button" class="text-sm leading-5" onclick={() => category.collapsed = false}>
            {visiblePrompts(category.prompts).length} {visiblePrompts(category.prompts).length === 1 ? 'prompt' : 'prompts'} hidden. Click to expand...
          </button>
        {/if}
      </div>
    {/if}
    <div class="base-category-bottom-cap" aria-hidden="true"></div>
  </section>
{/snippet}

<!-- Tree guide lines: one 1px line per indent level, shown while the tree is hovered or focused. -->
{#snippet TreeGutter(indent: number, isLastRow: boolean)}
  <span class="base-tree-gutter" aria-hidden="true">
    {#each Array.from({ length: indent }, (_, index) => index) as lineIndex (lineIndex)}
      <span class="base-tree-guide" data-last={isLastRow ? 'true' : 'false'} style={`--base-guide-index:${lineIndex};`}></span>
    {/each}
  </span>
{/snippet}

<!-- Compact inline text action used by empty categories and empty status trees. -->
{#snippet TreeInlineActionRow(text: string, indent: number, onclick: () => void)}
  <div class="base-tree-inline-row" style={`--base-tree-indent:${indent};`}>
    {#if indent > 0}{@render TreeGutter(indent, true)}{/if}
    <div class="base-tree-inline-button-wrap">
      <button type="button" class="base-inline-text-button text-sm leading-4.5" {onclick}>
        <span>{text}</span>
      </button>
    </div>
  </div>
{/snippet}

{#snippet TreePromptRow(group: MockGroup, row: Extract<MockTreeRow, { kind: 'prompt' }>, isFirstRow: boolean)}
  {@const dropTarget = getTreePromptDropTarget(group, row, isFirstRow)}
  {@const source = { kind: 'prompt' as const, id: row.prompt.id, title: row.prompt.title.trim() || 'New Prompt' }}
  <div class="base-tree-prompt-row" data-tree-row-key={row.key} style={`--base-tree-indent:${row.indent};`}
    use:mockDropTarget={dropTarget}>
    <!-- The status accent overlays the row without changing its geometry. -->
    <span class="base-status-indicator base-tree-status-indicator" data-status={row.prompt.status}
      data-edited={row.prompt.isEdited} aria-hidden="true"></span>
    <button type="button" class="base-tree-prompt-button" data-row-state={getTreeRowState(group, row.key, source)}
      aria-current={group === screenMode && selectedTreeRowKey === row.key ? 'true' : undefined}
      use:mockDragHandle={source}
      onclick={(event) => {
        void navigateToPrompt(group, row.prompt)
        if (event.detail !== 0) event.currentTarget.blur()
      }}>
      {@render TreeGutter(row.indent, row.isLastRow)}
      <span class="base-tree-prompt-label text-sm">{source.title}</span>
    </button>
    {#if activeDrop?.key === dropTarget.key && activeDrop.edge}
      {@render TreeDropIndicator(activeDrop.edge, getTreeIndicatorInsetPx(row.indent), activeDrop.isBlocked)}
    {/if}
  </div>
{/snippet}

<!-- Category rows toggle tree expansion; right-click opens the category options and hover reveals Add to top. -->
{#snippet TreeCategoryRow(group: MockGroup, row: Extract<MockTreeRow, { kind: 'category' }>, isFirstRow: boolean)}
  {@const dropTarget = getTreeCategoryDropTarget(group, row.category, isFirstRow)}
  {@const source = { kind: 'category' as const, id: row.category.id, title: row.category.title }}
  <div class="base-tree-category-row" data-tree-row-key={row.key} use:mockDropTarget={dropTarget}>
    <div class="base-tree-row" role="group" data-row-state={getTreeRowState(group, row.key, source)}
      oncontextmenu={(event) => { void openCategoryMenu(event, group, row.category.id) }}>
      <button type="button" class="base-tree-toggle-button"
        aria-label={`${row.isExpanded ? 'Collapse' : 'Expand'} category ${row.category.title}`}
        aria-expanded={row.isExpanded}
        use:mockDragHandle={source}
        onclick={(event) => {
          toggleTreeCategory(row.category.id)
          if (event.detail !== 0) event.currentTarget.blur()
        }}>
        <span class="base-tree-chevron" data-expanded={row.isExpanded ? 'true' : 'false'}>
          <ChevronRight size={20} aria-hidden="true" />
        </span>
        <span class="base-tree-category-icon"><Folder size={16} aria-hidden="true" /></span>
        <span class="base-tree-category-label text-sm leading-5">{row.category.title}</span>
      </button>
      <div class="base-tree-action-slot">
        <div class="base-tree-category-actions">
          <button type="button" class="base-tree-action-button" aria-label={`Add Prompt to top of category ${row.category.title}`}
            onclick={(event) => {
              void addPromptFromTree(group, row.category)
              if (event.detail !== 0) event.currentTarget.blur()
            }}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
    {#if categoryMenu?.group === group && categoryMenu.categoryId === row.category.id}
      <div class="base-status-menu base-simple-menu" role="menu" aria-label={`Category options for ${row.category.title}`}
        use:mountMockMenu={{ anchor: categoryMenu.anchor, isContextMenu: true }}>
        <button class="base-simple-menu-item" type="button" role="menuitem"
          onclick={() => { closeMenus(); void openCategory(group, row.category) }}>
          <ArrowRight size={16} aria-hidden="true" />
          <span class="text-sm leading-5">Open Category</span>
        </button>
        <button class="base-simple-menu-item" type="button" role="menuitem"
          onclick={() => { closeMenus(); openManageCategories(row.category.id) }}>
          <Settings size={16} aria-hidden="true" />
          <span class="text-sm leading-5">Open Category Settings</span>
        </button>
      </div>
    {/if}
    {#if activeDrop?.key === dropTarget.key && activeDrop.edge}
      {@render TreeDropIndicator(activeDrop.edge, getTreeIndicatorInsetPx(activeDrop.edge === 'bottom' ? 1 : 0), activeDrop.isBlocked)}
    {/if}
  </div>
{/snippet}

<!-- One status group's prompt tree: uncategorized prompts, then categories with their prompts. -->
{#snippet StatusTree(group: MockGroup)}
  {@const rows = treeRowsByGroup[group]}
  <div class="base-sidebar-tree" data-tree-group={group}>
    {#if rows.length === 0}
      {@const emptyTarget = getTreeEmptyDropTarget(group)}
      <div class="base-tree-empty" use:mockDropTarget={emptyTarget}>
        {@render TreeInlineActionRow(
          `No ${group.toLowerCase()} prompts. Click to ${isFinalGroup(group) ? 'view' : 'add'}.`,
          0,
          () => { void (isFinalGroup(group) ? setScreenMode(group) : addPromptFromTree(group)) }
        )}
        {#if activeDrop?.key === emptyTarget.key && activeDrop.edge}
          {@render TreeDropIndicator(activeDrop.edge, getTreeIndicatorInsetPx(0), activeDrop.isBlocked)}
        {/if}
      </div>
    {:else}
      {@const bottomTarget = getTreeBottomDropTarget(group)}
      <div class="base-tree-scroll" data-drop-clip>
        {#each rows as row, rowIndex (row.key)}
          {#if row.kind === 'prompt'}
            {@render TreePromptRow(group, row, rowIndex === 0)}
          {:else if row.kind === 'category'}
            {@render TreeCategoryRow(group, row, rowIndex === 0)}
          {:else}
            {@render TreeInlineActionRow('Category is empty. Click to add.', 1, () => { void addPromptFromTree(group, row.category) })}
          {/if}
        {/each}
        <!-- One trailing row of space that also accepts end-of-tree drops. -->
        <div class="base-tree-bottom-spacer" use:mockDropTarget={bottomTarget}>
          {#if activeDrop?.key === bottomTarget.key && activeDrop.edge}
            {@render TreeDropIndicator(activeDrop.edge, getTreeIndicatorInsetPx(0), activeDrop.isBlocked)}
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<div class="base-app-body" data-dragging={dragSource ? 'true' : 'false'} data-testid="base-prompt-collection-shell">
  {#if dragSource}
    <div class="base-drag-ghost" style={`left:${dragPosition.x}px; top:${dragPosition.y}px;`} aria-hidden="true">
      {#if dragSource.kind === 'category'}<Folder size={16} />{:else}<FileText size={16} />{/if}
      <span class="text-sm">{dragSource.title}</span>
    </div>
  {/if}

  <!-- Tab Collection Sidebar: the collection title and Show All, the button bar, and the status accordion. -->
  <aside class="base-app-sidebar" style:flex-basis={`${sidebarWidth}px`} bind:this={sidebarElement}
    data-testid="base-mockup-sidebar">
    <header class="base-sidebar-header">
      <div class="base-sidebar-title-group text-sm leading-4.5">
        <FileText size={16} class="base-sidebar-title-icon" aria-hidden="true" />
        <h2 class="base-sidebar-title">{rootTitle}</h2>
      </div>
      <button type="button" class="base-show-all-button text-sm leading-5">
        <LayoutGrid size={16} aria-hidden="true" />
        <span>Show All</span>
      </button>
    </header>
    {@render Separator()}

    <div class="base-sidebar-button-bar">
      {@render IconButton(ArrowUpToLine, 'Go to Top', { borderless: true, baseVariant: 'dim', onclick: goToTop })}
      {@render IconButton(Check, 'Show Completed Prompts', {
        borderless: true,
        baseVariant: 'dim',
        active: shownFinalGroups.Completed,
        onclick: () => toggleFinalGroup('Completed')
      })}
      {@render IconButton(Archive, 'Show Archived Prompts', {
        borderless: true,
        baseVariant: 'dim',
        active: shownFinalGroups.Archived,
        onclick: () => toggleFinalGroup('Archived')
      })}
      {@render IconButton(
        areAllTreeCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp,
        areAllTreeCategoriesCollapsed ? 'Expand All Categories' : 'Collapse All Categories',
        { borderless: true, baseVariant: 'dim', onclick: toggleAllTreeCategories }
      )}
      {@render IconButton(MoreHorizontal, 'Selected Collection Actions', {
        borderless: true,
        baseVariant: 'dim',
        active: isCollectionActionsOpen,
        ariaExpanded: isCollectionActionsOpen,
        ariaHaspopup: 'menu',
        onclick: toggleCollectionActions
      })}
      {#if isCollectionActionsOpen && collectionActionsAnchor}
        <div class="base-status-menu base-simple-menu" role="menu" aria-label="Selected Collection Actions"
          use:mountMockMenu={{ anchor: collectionActionsAnchor }}>
          <button class="base-simple-menu-item" type="button" role="menuitem" onclick={() => {
            closeMenus()
            nameDialog = { value: rootTitle, save: (value) => rootTitle = value }
          }}>
            <Pencil size={16} aria-hidden="true" />
            <span class="text-sm leading-5">Rename Collection</span>
          </button>
          <button class="base-simple-menu-item" type="button" role="menuitem" onclick={() => {
            closeMenus()
            openManageCategories()
          }}>
            <FolderCog size={16} aria-hidden="true" />
            <span class="text-sm leading-5">Manage Categories</span>
          </button>
          <button class="base-simple-menu-item" type="button" role="menuitem" data-variant="danger"
            onclick={requestCollectionDelete}>
            <Trash2 size={16} aria-hidden="true" />
            <span class="text-sm leading-5">Delete Collection</span>
          </button>
        </div>
      {/if}
    </div>

    <div class="base-accordion" bind:this={accordionElement}>
      {#each resolvedAccordionSections as section (section.group)}
        {@const GroupIcon = groupIcons[section.group]}
        {@const headerTarget = getStatusHeaderDropTarget(section.group)}
        <section class="base-accordion-section" data-expanded={section.expanded ? 'true' : 'false'}
          data-bottom-anchored={isAccordionSectionBottomAnchored(section.group) ? 'true' : 'false'}
          style={`--base-accordion-section-height:${accordionHeights[section.group] ?? ACCORDION_COLLAPSED_HEIGHT_PX}px;`}>
          {#if canResizeAccordionSection(section.group)}
            <ResizeSash
              orientation="horizontal"
              isDragging={accordionDragGroup === section.group}
              label={`Resize ${section.group} section`}
              tabindex={-1}
              onpointerdown={(event) => startAccordionResize(section.group, event)}
            />
          {/if}
          <!-- Dropping a prompt on a header moves it into that status group. -->
          <button type="button" class="base-accordion-header" aria-expanded={section.expanded}
            data-drop-state={activeDrop?.key === headerTarget.key ? activeDrop.isBlocked ? 'blocked' : 'over' : 'idle'}
            use:mockDropTarget={headerTarget}
            onclick={() => toggleAccordionSection(section.group)}>
            <span class="base-accordion-chevron"><ChevronRight size={20} aria-hidden="true" /></span>
            <span class="base-accordion-icon"><GroupIcon size={16} aria-hidden="true" /></span>
            <span class="base-accordion-label text-sm leading-5">{section.group}</span>
            <span class="base-accordion-count text-xs leading-4.5">{groupCounts[section.group]}</span>
          </button>
          <div class="base-accordion-content" hidden={!section.expanded}>
            {@render StatusTree(section.group)}
          </div>
        </section>
      {/each}
    </div>

    <ResizeSash
      orientation="vertical"
      label="Resize sidebar"
      isDragging={isResizingSidebar}
      tabindex={-1}
      onpointerdown={startSidebarResize}
    />
  </aside>

<div class="base-main-surface">
<main class="base-prompt-collection-mockup" data-testid="base-prompt-collection-mockup">
  <div class="base-header-bar">
    <!-- Project, collection, status group, and the category at the sample point; the project segment is inert. -->
    <div class="base-breadcrumb text-sm">
      <button type="button">{projectName}</button>
      <span>/</span>
      <button type="button" onclick={goToTop}>{rootTitle}</button>
      <span>/</span>
      <button type="button" onclick={goToTop}>{screenMode}</button>
      {#if breadcrumbCategory}
        <span>/</span>
        <button type="button" onclick={() => {
          selection = { kind: 'category', id: breadcrumbCategory.id }
          isSelectionManual = true
          revealInScreen(document.getElementById(`base-category-card-${breadcrumbCategory.id}`), CATEGORY_TOP_OFFSET_PX)
        }}>{breadcrumbCategory.title}</button>
      {/if}
    </div>
    {@render IconButton(Search, 'Find in Collection (Control + F)', { size: 'compact', borderless: true, onclick: () => findOpen = !findOpen })}
  </div>

  {#if findOpen}
    <div class="base-find-widget text-sm" role="search" aria-label="Find in Collection" data-no-results={findQuery.length > 0 && !findMatches.length}>
      <textarea class="text-sm" aria-label="Find" placeholder="Find" rows="1" wrap="off" spellcheck="false" bind:this={findInput} bind:value={findQuery}
        onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); revealFindMatch(event.shiftKey ? -1 : 1) } }}></textarea>
      <span class="text-xs">{findMatches.length ? `${findIndex + 1} of ${findMatches.length}` : 'No results'}</span>
      <button type="button" class="base-find-button codicon codicon-find-previous-match" title="Find Previous" aria-label="Find Previous" disabled={!findMatches.length} onclick={() => revealFindMatch(-1)}></button>
      <button type="button" class="base-find-button codicon codicon-find-next-match" title="Find Next" aria-label="Find Next" disabled={!findMatches.length} onclick={() => revealFindMatch(1)}></button>
      <button type="button" class="base-find-button codicon codicon-widget-close" title="Close" aria-label="Close find" onclick={() => findOpen = false}></button>
    </div>
  {/if}
  <!-- Scrolling records the group's offset, updates the breadcrumb, and moves the tree selection with the centered row;
       wheel and scrollbar input release a selection held by the tree, breadcrumb, or a focused card. -->
  <div class="base-content-viewport" data-drop-clip bind:this={viewport} bind:clientHeight={viewportHeight}
    onscroll={() => {
      if (viewport) scrollTopByMode[screenMode] = viewport.scrollTop
      updateBreadcrumb()
      if (!isSelectionManual) followCenterRow()
    }}
    use:releaseSelectionOnUserScroll>
    <section class="base-root-header" data-follow-row="header">
      <div class="base-root-title-row">
        <div class="base-root-title-block">
          {@render IconCell(FileText, true)}
          <div class="base-root-title-stack">
            <div class="base-root-title-line">
              <h1 class="text-3xl leading-9" title={rootTitle}>{rootTitle}</h1>
              {@render IconButton(Pencil, 'Rename collection', {
                onclick: () => nameDialog = { value: rootTitle, save: (value) => rootTitle = value },
                size: 'compact-large-icon',
                baseVariant: 'muted',
                hoverVariant: 'glyph'
              })}
            </div>
            <span class="base-root-subtitle text-sm leading-5">Task Prompts</span>
          </div>
        </div>
      </div>

      <div class="base-root-toolbar">
        <div class="base-filter-bar" role="group" aria-label="Filter prompts">
          {#each groups as group (group)}
            <button class="text-sm leading-5" type="button" aria-pressed={screenMode === group}
              onclick={() => selectGroup(group)}>
              <span class="base-filter-label">{group} <span class="base-filter-count text-xs leading-4.5">{groupCounts[group]}</span></span>
            </button>
          {/each}
        </div>
        <div class="base-root-actions">
          <button class="base-categories-button text-sm leading-4" type="button" aria-label="Manage categories"
            title="Manage categories" onclick={() => openManageCategories()}>
            <FolderCog size={18} aria-hidden="true" />
            <span>Categories</span>
          </button>
          <span class="base-root-action-divider" aria-hidden="true"></span>
          {@render IconButton(Trash2, 'Delete collection', { borderless: true, hoverVariant: 'danger',
            onclick: requestCollectionDelete
          })}
        </div>
      </div>
    </section>

    <div class="base-entry-flow">
      {#if isFinalMode}
        {#if finalizedPrompts.length}{@render Divider()}{/if}
        {#each finalizedPrompts as prompt (prompt.id)}
          {@render PromptCard(prompt)}
          {@render Divider()}
        {/each}
      {:else}
      {@render Divider(undefined, undefined, !visiblePrompts(rootPrompts).length ? categories[0]?.id : undefined)}
      {#each visiblePrompts(rootPrompts) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt)}
        {@render Divider(undefined, prompt.id, promptIndex === visiblePrompts(rootPrompts).length - 1 ? categories[0]?.id : undefined)}
      {/each}
      <div class="base-categories-inset">
        {#each categories as category, categoryIndex (category.id)}
          {@const separatorTarget = getCategorySeparatorDropTarget(category.id, categories[categoryIndex + 1]?.id ?? null)}
          {@render CategoryCard(category)}
          <div class="base-final-gap" use:mockDropTarget={separatorTarget}>
            {#if activeDrop?.key === separatorTarget.key}
              {@render MoveHereIndicator(activeDrop.isBlocked)}
            {:else}
              {@render Separator()}
            {/if}
          </div>
        {/each}
      </div>
      {/if}
      {#if !allPrompts.some((prompt) => matchesGroup(prompt)) && (isFinalMode || !categories.length)}
        <div class="base-empty">
          <p>No {screenMode.toLowerCase()} prompts in this collection.</p>
          {#if !isFinalMode}<p class="base-empty-detail text-sm">Click the Add Prompt button to create your first prompt.</p>{/if}
        </div>
      {/if}
    </div>
    <div style={`height:${Math.ceil(viewportHeight * 0.75 / 4) * 4}px;`} aria-hidden="true"></div>
  </div>
</main>
</div>
</div>

{#if manageCategoriesOpen}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog>
    <div class="base-template-dialog base-manage-dialog" role="dialog" aria-modal="true" aria-label="Manage Categories">
      <header class="base-template-dialog-header">
        <div class="base-template-dialog-heading">
          <div class="base-template-dialog-icon"><FolderCog size={24} aria-hidden="true" /></div>
          <div class="base-template-dialog-heading-copy">
            <h2 class="text-lg">Manage Categories</h2>
            <p class="text-sm">{rootTitle}</p>
          </div>
        </div>
        {@render IconButton(X, 'Close', { onclick: requestCloseManageCategories })}
      </header>
      {@render Separator()}

      <div class="base-manage-body text-sm leading-5">
        <aside class="base-management-selector" aria-label="All Categories">
          <div class="base-management-selector-header">
            <span class="text-sm leading-5">All Categories</span>
            <span class="text-xs leading-4">{managementDrafts.length}</span>
          </div>
          <div class="base-management-selector-items">
            {#each managementDrafts as draft (draft.id)}
              {@const contentCount = categories.find((category) => category.id === draft.id)?.prompts.length ?? 0}
              <button
                type="button"
                class="base-management-selector-item"
                class:active={selectedCategoryId === draft.id}
                aria-pressed={selectedCategoryId === draft.id}
                onclick={() => {
                  selectedCategoryId = draft.id
                  shouldFocusManagementName = false
                }}
              >
                <span class="base-management-selector-icon">
                  <Folder size={20} aria-hidden="true" />
                </span>
                <span class="base-management-selector-copy">
                  <span class="text-sm leading-5">{draft.title.trim() || 'New Category'}</span>
                  <span class="text-xs leading-4.5">{contentCount} {contentCount === 1 ? 'prompt' : 'prompts'}</span>
                </span>
                {#if selectedCategoryId === draft.id}
                  <ChevronRight size={14} aria-hidden="true" />
                {/if}
              </button>
            {/each}
          </div>
          <button type="button" class="base-management-add-button text-sm leading-5" onclick={addCategoryDraft}>
            <Plus size={16} aria-hidden="true" />
            <span>New Category</span>
          </button>
        </aside>

        <div class="base-management-editor">
          {#if selectedCategoryDraft}
            {#key selectedCategoryDraft.id}
              <div class="base-management-heading-row">
                <span class="base-management-heading-icon"><Folder size={24} aria-hidden="true" /></span>
                <span class="base-management-heading-copy">
                  <strong class="text-base">{selectedCategoryDraft.title.trim() || 'New Category'}</strong>
                  <span class="text-sm">Category settings</span>
                </span>
                {@render IconButton(Trash2, 'Delete category', {
                  hoverVariant: 'danger',
                  onclick: deleteSelectedCategoryDraft
                })}
              </div>

              <div class="base-management-fields">
                <label>
                  <span class="base-management-field-copy">
                    <span class="base-management-field-heading">
                      <strong class="text-sm">Category Name</strong>
                      <span class="text-sm leading-5">*</span>
                    </span>
                    <span class="base-management-field-detail text-sm">Required. Names must be unique in this collection.</span>
                  </span>
                  <span class="base-management-field-control">
                    <input
                      class="base-management-input text-sm"
                      bind:this={managementNameInput}
                      bind:value={selectedCategoryDraft.title}
                      aria-invalid={selectedCategoryDraft.hasInteracted && selectedCategoryNameError ? 'true' : undefined}
                      oninput={() => selectedCategoryDraft.hasInteracted = true}
                    />
                    {#if selectedCategoryDraft.hasInteracted && selectedCategoryNameError}
                      <span class="base-name-error text-sm"><AlertCircle size={16} aria-hidden="true" />{selectedCategoryNameError}</span>
                    {/if}
                  </span>
                </label>

                <label>
                  <span class="base-management-field-copy">
                    <strong class="text-sm">Short Description</strong>
                    <span class="base-management-field-detail text-sm">A brief summary to help you recognize this category.</span>
                  </span>
                  <input class="base-management-input text-sm" bind:value={selectedCategoryDraft.shortDescription} />
                </label>

                <div class="base-management-field">
                  <span class="base-management-field-copy">
                    <strong class="text-sm">Full Description</strong>
                    <span class="base-management-field-detail text-sm">Describe what belongs here and how to use these prompts.</span>
                  </span>
                  <div class="base-management-description-editor">
                    <div class="base-monaco-host" use:mountMockupMonaco={selectedCategoryDraft}></div>
                  </div>
                </div>
              </div>
            {/key}
          {/if}
        </div>
      </div>

      {@render Separator()}
      <footer class="base-template-dialog-footer">
        <button type="button" class="base-dialog-cancel-button text-sm" onclick={requestCloseManageCategories}>Close</button>
        <button
          type="button"
          class="base-dialog-confirm-button text-sm"
          disabled={!managementDraftsValid || !managementHasChanges}
          onclick={saveCategoryDrafts}
        >
          <Check size={16} aria-hidden="true" />
          <span>Save Changes</span>
        </button>
      </footer>
    </div>
  </div>
{/if}

{#if nameDialog}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog>
    <div tabindex="-1" class="base-template-dialog base-name-dialog" role="dialog" aria-modal="true" aria-label="Rename Collection">
      <form onsubmit={(event) => {
        event.preventDefault()
        if (!nameDialog || nameDisabled) return
        nameDialog.save(nameDialog.value.trim())
        nameDialog = null
      }}>
        <header class="base-template-dialog-header">
          <div class="base-template-dialog-heading">
            <div class="base-template-dialog-icon"><Pencil size={24} aria-hidden="true" /></div>
            <div class="base-template-dialog-heading-copy">
              <h2 class="text-lg">Rename Collection</h2>
              <p class="text-sm">Change the name shown in the app and on disk.</p>
            </div>
          </div>
          {@render IconButton(X, 'Close', { onclick: () => nameDialog = null })}
        </header>
        {@render Separator()}
        <div class="base-name-field">
          <div class="base-management-field-copy">
            <div class="base-management-field-heading">
              <strong class="text-sm">Collection Name</strong>
              <span class="text-sm leading-5">*</span>
            </div>
            <span class="base-management-field-detail text-sm">Required. Names must be unique among collections of the same type.</span>
          </div>
          <div class="base-name-control">
            <input class="base-name-input text-sm" bind:this={nameInput} aria-label="Collection Name"
              placeholder="Name..." bind:value={nameDialog.value}
              aria-invalid={nameInteracted && nameError ? 'true' : undefined}
              oninput={() => nameInteracted = true} />
            {#if nameInteracted && nameError}
              <div class="base-name-error text-sm"><AlertCircle size={16} aria-hidden="true" />{nameError}</div>
            {/if}
          </div>
        </div>
        {@render Separator()}
        <div class="base-template-dialog-footer">
          <button class="base-dialog-cancel-button text-sm" type="button" onclick={() => nameDialog = null}>Cancel</button>
          <button class="base-dialog-confirm-button text-sm" type="submit" disabled={nameDisabled}>Rename Collection</button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if confirmation}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog
    onclick={(event) => { if (event.target === event.currentTarget && !confirmation?.informational) confirmation = null }}>
    <div tabindex="-1" class="base-template-dialog base-confirmation-dialog" data-informational={confirmation.informational ?? false}
      data-acknowledgement={!!confirmation.acknowledgement} role="dialog" aria-modal="true" aria-label={confirmation.title}>
      <header class="base-template-dialog-header">
        <div class="base-template-dialog-heading">
          <div class="base-template-dialog-icon">
            {#if confirmation.informational}<Copy size={24} aria-hidden="true" />{:else}<Trash2 size={24} aria-hidden="true" />{/if}
          </div>
          <h2 class="text-lg">{confirmation.title}</h2>
        </div>
        {@render IconButton(X, 'Close', { onclick: () => confirmation = null })}
      </header>
      <div class="base-confirmation-content">
        <p class="text-base">{confirmation.description}</p>
        {#if confirmation.acknowledgement}
          <label class="base-confirmation-acknowledgement text-base">
            <span class="base-confirmation-checkbox">
              <input type="checkbox" bind:checked={confirmation.acknowledged} />
              <span aria-hidden="true"><Check size={13} /></span>
            </span>
            <span>{confirmation.acknowledgement}</span>
          </label>
        {/if}
      </div>
      <div class="base-template-dialog-footer">
        <button class="base-dialog-cancel-button text-sm" type="button" onclick={() => confirmation = null}>Cancel</button>
        <button class="base-dialog-confirm-button text-sm" type="button"
          disabled={!!confirmation.acknowledgement && !confirmation.acknowledged}
          onclick={() => { const action = confirmation?.confirm; confirmation = null; action?.() }}>
          {#if confirmation.informational}<Copy size={16} aria-hidden="true" />{:else}<Trash2 size={16} aria-hidden="true" />{/if}
          {confirmation.submit}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if copyError}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog>
    <div class="base-template-dialog base-confirmation-dialog" role="alertdialog" aria-modal="true" aria-label="Copy failed">
      <header class="base-template-dialog-header">
        <div class="base-template-dialog-heading">
          <AlertCircle size={24} aria-hidden="true" />
          <h2 class="text-lg">Copy failed</h2>
        </div>
        {@render IconButton(X, 'Close', { onclick: () => copyError = null })}
      </header>
      <div class="base-confirmation-content"><p class="text-base">{copyError}</p></div>
      <div class="base-template-dialog-footer">
        <button class="base-dialog-cancel-button text-sm" type="button" onclick={() => copyError = null}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if templateDialogPrompt}
  <div
    class="base-template-dialog-layer"
    role="presentation"
    data-testid="base-mockup-template-dialog-layer"
    use:mountMockDialog
  >
    <div
      class="base-template-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={templateDialogMode === 'select-and-copy'
        ? 'Quick Template Selection'
        : 'Select Template'}
    >
      <header class="base-template-dialog-header">
        <div class="base-template-dialog-heading">
          <div class="base-template-dialog-icon">
            {#if templateDialogMode === 'select-and-copy'}
              <Copy size={24} aria-hidden="true" />
            {:else}
              <Layers size={24} aria-hidden="true" />
            {/if}
          </div>
          <div class="base-template-dialog-heading-copy">
            <h2 class="text-lg">
              {templateDialogMode === 'select-and-copy'
                ? 'Quick Template Selection'
                : 'Select Template'}
            </h2>
            <p class="text-sm">
              {templateDialogMode === 'select-and-copy'
                ? 'Click a template to apply it and copy this prompt immediately.'
                : 'Choose one template, or use the prompt exactly as written.'}
            </p>
          </div>
        </div>
        {@render IconButton(X, 'Close', { onclick: closeTemplateDialog })}
      </header>

      {@render Separator()}

      <div class="base-template-dialog-body" data-mode={templateDialogMode}>
        <div class="base-no-template-panel">
          <button
            type="button"
            class="base-template-root-option text-sm"
            class:active={templateDialogMode === 'select' && selectedTemplateIds.size === 0}
            aria-pressed={templateDialogMode === 'select'
              ? selectedTemplateIds.size === 0
              : undefined}
            onclick={() => selectTemplate(null)}
            ondblclick={templateDialogMode === 'select' ? () => selectAndCopyTemplate(null) : undefined}
          >
            <span class="base-no-template-icon"><Ban size={18} aria-hidden="true" /></span>
            <span class="base-no-template-copy">
              <strong class="text-sm font-semibold">{NO_TEMPLATE_LABEL}</strong>
              <small class="text-xs">Use the prompt exactly as written</small>
            </span>
            <span
              class="base-template-selection-mark"
              data-control={templateDialogMode === 'select-and-copy' ? 'copy' : 'radio'}
              aria-hidden="true"
            >
              {#if templateDialogMode === 'select-and-copy'}
                <Copy size={16} />
              {/if}
            </span>
          </button>
        </div>

        <div class="base-template-tree-label">
          <span class="text-base">Template Library</span>
        </div>
        {@render Separator()}

        <div class="base-template-tree" data-testid="base-mockup-template-tree">
          {#each templateCollections as collection (collection.id)}
            {@const templateCount = getTemplateCount(collection)}
            <section class="base-template-root-group">
              <div class="base-template-root-heading">
                <span class="base-template-collection-icon">
                  <FolderOpen size={18} aria-hidden="true" />
                </span>
                <div class="base-template-root-copy">
                  <strong class="text-sm font-semibold">{collection.title}</strong>
                  <span class="text-xs">{templateCount} {templateCount === 1 ? 'template' : 'templates'}</span>
                </div>
              </div>
              <div class="base-template-root-contents">
                {#each collection.templates as template (template.id)}
                  <div class="base-template-option-row">
                    <button
                      type="button"
                      class="base-template-option-button text-sm"
                      class:active={templateDialogMode === 'select' &&
                        selectedTemplateIds.has(template.id)}
                      style="--base-template-indent-count:0;"
                      aria-pressed={templateDialogMode === 'select'
                        ? selectedTemplateIds.has(template.id)
                        : undefined}
                      onclick={() => selectTemplate(template)}
                      ondblclick={templateDialogMode === 'select' ? () => selectAndCopyTemplate(template) : undefined}
                    >
                      <span
                        class="base-template-guide"
                        data-indent-count="0"
                        aria-hidden="true"
                      ></span>
                      <span
                        class="base-template-selection-mark"
                        data-control={templateDialogMode === 'select-and-copy'
                          ? 'copy'
                          : 'radio'}
                        aria-hidden="true"
                      >
                        {#if templateDialogMode === 'select-and-copy'}
                          <Copy size={16} />
                        {/if}
                      </span>
                      <span>{template.title}</span>
                    </button>
                  </div>
                {/each}
                {#each collection.children as child (child.id)}
                  {@render TemplateCategoryRows(child, 0)}
                {/each}
              </div>
            </section>
          {/each}
        </div>
      </div>

      {@render Separator()}

      <footer class="base-template-dialog-footer">
        <button type="button" class="base-dialog-cancel-button text-sm" onclick={closeTemplateDialog}>
          Cancel
        </button>
        {#if templateDialogMode === 'select'}
          <button
            type="button"
            class="base-dialog-confirm-button text-sm"
            onclick={confirmTemplateSelections}
          >
            <Check size={16} aria-hidden="true" />
            Confirm Selection
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  /* ---- App body: chrome-colored sidebar beside the darker screen surface, as in AppShell ---- */

  .base-app-body {
    display: flex;
    height: 100%;
    min-height: 640px;
    background: var(--app-chrome-surface);
    color: var(--ui-normal-text);
  }

  /* Matches the live drag cursor and keeps text from selecting while a prompt or category drags. */
  .base-app-body[data-dragging='true'],
  .base-app-body[data-dragging='true'] :global(*) {
    cursor: grabbing !important;
    user-select: none;
  }

  .base-app-sidebar {
    --base-sidebar-left-inset: 2px;

    position: relative;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    border-top: 1px solid var(--ui-neutral-hover-border);
    border-right: 1px solid var(--ui-neutral-hover-border);
    user-select: none;
  }

  .base-main-surface {
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

  .base-prompt-collection-mockup {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    width: 100%;
  }

  button {
    cursor: pointer;
  }

  /* ---- Sidebar header and button bar ---- */

  /* 35px below the sidebar's top border puts the separator on the screen header bar's bottom border row. */
  .base-sidebar-header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    min-height: 35px;
    margin-left: var(--base-sidebar-left-inset);
    padding: 0 4px 0 10px;
  }

  .base-sidebar-title-group {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-weight: var(--font-weight-semibold);
  }

  /* With the group's 4px gap, the margin gives the 8px icon-to-title spacing of work tabs and tree rows. */
  .base-sidebar-title-group :global(.base-sidebar-title-icon) {
    flex: none;
    margin-right: 4px;
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-sidebar-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-normal-text);
  }

  .base-show-all-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-ghost-surface);
    color: var(--ui-hoverable-text);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  .base-show-all-button:is(:hover, :focus-visible) {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .base-sidebar-button-bar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 40px;
    margin-left: var(--base-sidebar-left-inset);
    padding: 4px 8px;
  }

  /* ---- Sidebar status accordion ---- */

  .base-accordion {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .base-accordion-section {
    position: relative;
    display: flex;
    flex: 0 0 var(--base-accordion-section-height);
    flex-direction: column;
    min-height: var(--base-accordion-section-height);
    overflow: visible;
  }

  .base-accordion-section[data-bottom-anchored='true'] {
    margin-top: auto;
  }

  .base-accordion-header {
    display: grid;
    flex: 0 0 36px;
    grid-template-columns: 24px 18px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: 36px;
    padding: 0 12px 0 calc(6px + var(--base-sidebar-left-inset));
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    background: transparent;
    color: var(--ui-muted-text);
    text-align: left;
  }

  .base-accordion-header:is(:hover, :focus-visible) {
    color: var(--ui-normal-text);
  }

  .base-accordion-header[data-drop-state='over'] {
    background: var(--ui-info-normal-surface);
    box-shadow: inset 0 0 0 1px var(--ui-info-strong-border);
  }

  .base-accordion-header[data-drop-state='blocked'] {
    background: var(--ui-neutral-emphasis-surface);
    box-shadow: inset 0 0 0 1px var(--ui-neutral-emphasis-border);
  }

  .base-accordion-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ui-muted-icon-glyph);
    transform: rotate(0deg);
  }

  .base-accordion-section[data-expanded='true'] .base-accordion-chevron {
    transform: rotate(90deg);
  }

  .base-accordion-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--ui-secondary-icon-glyph);
  }

  .base-accordion-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.01em;
  }

  .base-accordion-count {
    color: var(--ui-muted-text);
    font-variant-numeric: tabular-nums;
  }

  .base-accordion-header:is(:hover, :focus-visible) :is(.base-accordion-chevron, .base-accordion-icon, .base-accordion-count) {
    color: var(--ui-normal-text);
  }

  /* Visible overflow lets tree-edge drop indicators overlap the adjacent status header slightly. */
  .base-accordion-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: visible;
  }

  .base-accordion-content[hidden] {
    display: none;
  }

  /* ---- Prompt tree ---- */

  .base-sidebar-tree {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    margin-left: var(--base-sidebar-left-inset);
  }

  .base-tree-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* Approximates the live overlay scrollbar: a square 10px thumb on a clear track, shown while the tree is hovered. */
  .base-tree-scroll::-webkit-scrollbar {
    width: 10px;
  }

  .base-tree-scroll::-webkit-scrollbar-track {
    background: var(--ui-ghost-surface);
  }

  .base-tree-scroll::-webkit-scrollbar-thumb {
    border: 0;
    border-radius: 0;
  }

  .base-tree-scroll:not(:hover)::-webkit-scrollbar-thumb {
    background: var(--ui-ghost-surface);
  }

  .base-tree-bottom-spacer {
    position: relative;
    height: 16px;
  }

  .base-tree-empty {
    position: relative;
  }

  .base-tree-category-row,
  .base-tree-prompt-row {
    position: relative;
    width: 100%;
    padding-block: 1px;
  }

  /* Category rows and prompt buttons share row geometry, colors, and row-state feedback. */
  .base-tree-row,
  .base-tree-prompt-button {
    width: 100%;
    height: 30px;
    border: 0;
    background: transparent;
    color: var(--ui-hoverable-text);
    cursor: default;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .base-tree-row {
    position: relative;
    display: flex;
    align-items: center;
  }

  :is(.base-tree-row, .base-tree-prompt-button):is(
      [data-row-state='idle']:hover,
      [data-row-state='active'],
      [data-row-state='drag-active'],
      [data-row-state='dragging']
    ) {
    color: var(--ui-normal-text);
  }

  .base-tree-row:is(
      [data-row-state='idle']:hover,
      [data-row-state='active'],
      [data-row-state='drag-active'],
      [data-row-state='dragging']
    )
    .base-tree-category-icon {
    color: var(--ui-hoverable-icon-glyph);
  }

  :is(.base-tree-row, .base-tree-prompt-button)[data-row-state='idle']:hover {
    background-color: var(--ui-neutral-emphasis-surface);
  }

  /* Selected rows keep this brighter fill while hovered, since choosing a selected prompt again does nothing. */
  :is(.base-tree-row, .base-tree-prompt-button):is([data-row-state='active'], [data-row-state='drag-active']) {
    background-color: var(--ui-neutral-selection-surface);
  }

  :is(.base-tree-row, .base-tree-prompt-button)[data-row-state='dragging'] {
    background-color: var(--ui-info-normal-surface);
  }

  .base-tree-toggle-button {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: 24px 18px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 0 12px 0 6px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: default;
    text-align: left;
  }

  .base-tree-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    transform: rotate(0deg);
    transition: transform var(--ui-animation-duration-fast) ease-out;
  }

  .base-tree-chevron[data-expanded='true'] {
    transform: rotate(90deg);
  }

  .base-tree-row:is([data-row-state='idle']:hover, [data-row-state='active'], [data-row-state='drag-active'], :focus-within)
    .base-tree-chevron {
    color: var(--ui-normal-text);
  }

  .base-tree-category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--ui-secondary-icon-glyph);
    transition: color var(--ui-animation-duration-fast) ease-out;
  }

  .base-tree-category-label,
  .base-tree-prompt-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-tree-action-slot {
    position: relative;
    z-index: 2;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    margin-left: auto;
    margin-right: 14px;
    pointer-events: none;
  }

  .base-tree-category-actions {
    display: none;
    gap: 2px;
    pointer-events: auto;
  }

  .base-tree-row:is([data-row-state='idle']:hover, [data-row-state='active']:hover, :focus-within) .base-tree-toggle-button {
    padding-right: 56px;
  }

  .base-tree-row:is([data-row-state='idle']:hover, [data-row-state='active']:hover, :focus-within) .base-tree-category-actions {
    display: flex;
  }

  /* Compact borderless Add action: the row's text color, with a quieter surface fill on hover. */
  .base-tree-action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-ghost-surface);
    color: var(--ui-normal-text);
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .base-tree-action-button:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-normal-surface);
  }

  .base-tree-prompt-button {
    display: grid;
    grid-template-columns: calc(5px + 12px * var(--base-tree-indent)) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 22px 0 0;
    text-align: left;
  }

  .base-tree-status-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 2;
    width: 2px;
    pointer-events: none;
  }

  /* Guide lines start 13px into the row and step 12px per level; they show while the tree is hovered or focused. */
  .base-tree-gutter {
    position: relative;
    align-self: stretch;
    min-width: 0;
    margin-left: 5px;
  }

  .base-tree-guide {
    position: absolute;
    top: -1px;
    bottom: -1px;
    left: calc(8px + 12px * var(--base-guide-index));
    width: 0;
    border-left: 1px solid var(--ui-neutral-emphasis-border);
    opacity: 0;
    transition: opacity var(--ui-animation-duration-standard) ease-out;
  }

  .base-tree-guide[data-last='true'] {
    bottom: 0;
  }

  .base-sidebar-tree:is(:hover, :focus-within) .base-tree-guide {
    opacity: 1;
  }

  .base-tree-inline-row {
    display: grid;
    grid-template-columns: calc(12px * var(--base-tree-indent)) minmax(0, 1fr);
    align-items: center;
    width: 100%;
    height: 24px;
  }

  .base-tree-inline-row .base-tree-gutter {
    min-height: 22px;
  }

  .base-tree-inline-button-wrap {
    display: flex;
    grid-column: 2;
    align-items: center;
    height: 22px;
    min-width: 0;
    padding-left: 12px;
  }

  .base-inline-text-button {
    max-width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ui-muted-text);
    font-weight: var(--font-weight-normal);
    text-align: inherit;
    transition: color var(--ui-animation-duration-fast) ease-out;
  }

  .base-inline-text-button span {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-inline-text-button:is(:hover, :focus-visible) {
    color: var(--ui-normal-text);
  }

  .base-app-body[data-dragging='true'] .base-inline-text-button:hover {
    color: var(--ui-muted-text);
  }

  /* Tree drop indicator: a chevron and line centered on the row edge, inset by the target's indent. */
  .base-tree-drop-indicator {
    position: absolute;
    right: 2px;
    left: calc(var(--base-drop-inset) - 10px);
    z-index: 3;
    height: 10px;
    pointer-events: none;
    transform: translateY(-50%);
  }

  .base-tree-drop-indicator[data-edge='top'] {
    top: 0;
  }

  .base-tree-drop-indicator[data-edge='bottom'] {
    top: 100%;
  }

  .base-tree-drop-indicator svg {
    display: block;
    overflow: visible;
  }

  .base-tree-drop-indicator :is(path, line) {
    fill: none;
    stroke: var(--ui-info-strong-border);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .base-tree-drop-indicator[data-blocked='true'] :is(path, line) {
    stroke: var(--ui-muted-icon-glyph);
  }

  /* ---- Simple dropdown menu (collection actions and category options) ---- */

  .base-simple-menu {
    gap: 0;
  }

  .base-simple-menu-item {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-ghost-surface);
    color: var(--ui-hoverable-text);
    text-align: left;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
  }

  .base-simple-menu-item :global(svg) {
    justify-self: center;
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-simple-menu-item:is(:hover, :focus-visible) {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .base-simple-menu-item:is(:hover, :focus-visible) :global(svg) {
    color: var(--ui-normal-text);
  }

  .base-simple-menu-item[data-variant='danger']:is(:hover, :focus-visible) {
    background: var(--ui-danger-action-hover-fill);
  }

  .base-simple-menu-item span {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .base-icon-button {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
    height: 36px;
    justify-content: center;
    min-width: 0;
    padding: 0;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
    width: 36px;
  }

  .base-icon-button[data-size='compact'] {
    height: 28px;
    width: 28px;
  }

  .base-icon-button[data-size='compact-large-icon'] {
    height: 28px;
    width: 36px;
  }

  .base-icon-button[data-size='tiny'] {
    border-radius: 0;
    height: 18px;
    width: 18px;
  }

  .base-icon-button[data-base-variant='muted'] {
    color: var(--ui-muted-icon-glyph);
  }

  .base-icon-button[data-base-variant='dim'] {
    color: var(--ui-secondary-icon-glyph);
  }

  .base-icon-button[data-hover-variant='glyph'],
  .base-icon-button[data-borderless='true'] {
    border: 0;
  }

  .base-icon-button:hover,
  .base-icon-button:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .base-icon-button[data-hover-variant='accent']:hover,
  .base-icon-button[data-hover-variant='accent']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .base-icon-button[data-hover-variant='success']:hover,
  .base-icon-button[data-hover-variant='success']:focus-visible {
    background: var(--ui-success-action-hover-fill);
    border-color: var(--ui-success-muted-hover-border);
  }

  .base-icon-button[data-hover-variant='danger']:hover,
  .base-icon-button[data-hover-variant='danger']:focus-visible {
    background: var(--ui-danger-action-hover-fill);
    border-color: var(--ui-danger-muted-hover-border);
  }

  .base-icon-button[data-hover-variant='glyph']:hover,
  .base-icon-button[data-hover-variant='glyph']:focus-visible {
    background: var(--ui-ghost-surface);
    color: var(--ui-normal-text);
  }

  .base-icon-button[data-active='true'] {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-normal-text);
  }

  .base-icon-button:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .base-icon-button-bar {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    min-width: 0;
  }

  .base-icon-cell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .base-separator {
    border-top: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    /* Match the live separator's shrink-0 without overriding its full horizontal width. */
    flex-shrink: 0;
    height: 1px;
    width: 100%;
  }

  .base-separator-dot {
    background: currentColor;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 auto;
    height: 3px;
    width: 3px;
  }

  .base-header-bar {
    align-items: center;
    display: flex;
    flex: 0 0 36px;
    gap: 12px;
    height: 36px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 24px;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .base-breadcrumb {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-weight: var(--font-weight-semibold);
    min-width: 0;
  }

  .base-breadcrumb button {
    flex: 0 1 auto;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    min-width: 0;
    overflow: hidden;
    padding: 0;
    text-overflow: ellipsis;
    transition: color var(--ui-animation-duration-standard);
    white-space: nowrap;
  }

  .base-breadcrumb button:hover {
    color: var(--ui-hoverable-text);
  }

  .base-breadcrumb span {
    color: var(--ui-neutral-emphasis-border);
    padding: 0 12px;
  }

  .base-breadcrumb button:last-child {
    color: var(--ui-hoverable-text);
  }

  .base-breadcrumb button:last-child:hover {
    color: var(--ui-normal-text);
  }

  /* Matches the live virtual window's 24px left and 12px right scroll padding. */
  .base-content-viewport {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    padding-left: 24px;
    padding-right: 12px;
  }

  .base-root-header {
    box-sizing: border-box;
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    height: 144px;
    min-width: 0;
    padding: 16px 0 6px;
  }

  .base-root-title-row {
    padding-inline: 24px;
    align-items: end;
    display: flex;
    gap: 16px;
    height: 60px;
    justify-content: space-between;
    min-width: 0;
  }

  .base-root-title-block {
    align-items: center;
    display: flex;
    gap: 12px;
    height: 60px;
    min-width: 0;
  }

  .base-root-title-stack {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .base-root-title-line {
    align-items: baseline;
    display: flex;
    gap: 11px;
    height: 36px;
    min-width: 0;
  }

  .base-root-title-line h1 {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    height: 40px;
    letter-spacing: -0.03em;
    margin: -2px 0;
    min-width: 0;
    overflow: hidden;
    padding-block: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-root-subtitle {
    color: var(--ui-muted-text);
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-root-toolbar {
    align-items: center;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    min-width: 0;
    padding-inline: 24px;
  }

  .base-filter-bar,
  .base-root-actions {
    align-items: center;
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 10px;
    box-sizing: border-box;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    height: 44px;
    padding: 4px;
  }

  .base-categories-button {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    display: inline-flex;
    flex: 0 0 auto;
    font-weight: var(--font-weight-semibold);
    gap: 8px;
    height: 34px;
    padding: 0 12px;
    white-space: nowrap;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .base-categories-button :global(svg) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-categories-button:where(:hover, :focus-visible) :global(svg) {
    color: var(--ui-normal-text);
  }

  .base-categories-button:hover,
  .base-categories-button:focus-visible {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .base-root-actions > .base-icon-button {
    height: 34px;
    width: 34px;
  }

  .base-root-action-divider {
    background: var(--ui-neutral-normal-border);
    height: 20px;
    margin-inline: 3px;
    width: 1px;
  }

  /* Selectable segments keep the arrow cursor, since choosing the selected one again does nothing. */
  .base-filter-bar button {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-ghost-surface);
    border-radius: 6px;
    color: var(--ui-hoverable-text);
    cursor: default;
    display: flex;
    font-family: inherit;
    gap: 8px;
    height: 34px;
    padding: 0 11px;
  }

  .base-filter-bar button:hover,
  .base-filter-bar button:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  /* The selected segment keeps the brighter accent colors whether or not it is hovered. */
  .base-filter-bar button[aria-pressed='true'],
  .base-filter-bar button[aria-pressed='true']:hover,
  .base-filter-bar button[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
    color: var(--ui-normal-text);
  }

  .base-filter-bar button:focus-visible,
  .base-categories-button:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .base-filter-label {
    align-items: baseline;
    display: flex;
    gap: 8px;
  }

  .base-filter-count {
    margin-left: 4px;
    padding: 2px 6px;
  }

  .base-entry-flow {
    min-width: 0;
  }

  .base-divider-row {
    position: relative;
    height: 28px;
    min-width: 0;
  }

  .base-divider-content {
    align-items: center;
    display: grid;
    grid-template-columns: minmax(14px, 1fr) auto minmax(14px, 1fr);
    height: 100%;
    min-width: 0;
  }

  .base-divider-row[data-revealed='true'] .base-divider-actions {
    opacity: 1;
  }

  /* Live MoveHereIndicator: 10px pill bars around a label at least 96px wide. */
  .base-move-here {
    align-items: center;
    display: grid;
    grid-template-columns: minmax(24px, 1fr) auto minmax(24px, 1fr);
    height: 100%;
    width: 100%;
  }

  .base-move-here[data-blocked='true'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .base-move-here-bar {
    background: var(--ui-info-strong-border);
    border-radius: 999px;
    height: 10px;
  }

  .base-move-here[data-blocked='true'] .base-move-here-bar {
    background: var(--ui-muted-icon-glyph);
  }

  .base-move-here-label {
    align-items: center;
    color: var(--ui-normal-text);
    display: inline-flex;
    font-weight: var(--font-weight-semibold);
    height: 26px;
    justify-content: center;
    min-width: 96px;
    padding: 0 10px;
    white-space: nowrap;
  }

  .base-divider-line-button {
    align-items: center;
    background: transparent;
    border: 0;
    display: flex;
    height: 12px;
    padding: 0 9px;
    width: 100%;
  }

  .base-divider-line-button:first-of-type {
    padding-left: 0;
  }

  .base-divider-line-button:last-of-type {
    padding-right: 0;
  }

  .base-divider-line-button .base-separator {
    transition: border-color var(--ui-animation-duration-standard) ease;
  }

  .base-divider-actions {
    align-items: center;
    display: inline-flex;
    gap: 20px;
    height: 100%;
    min-width: 0;
    opacity: 0;
    transition: opacity var(--ui-animation-duration-standard) ease;
  }

  .base-divider-action-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    display: inline-flex;
    gap: 4px;
    height: 100%;
    padding: 0;
    transition: color var(--ui-animation-duration-standard) ease;
    white-space: nowrap;
  }

  .base-divider-row:hover .base-divider-actions,
  .base-divider-row:focus-within .base-divider-actions {
    opacity: 1;
  }

  .base-divider-row:hover .base-divider-action-button,
  .base-divider-row:focus-within .base-divider-action-button {
    color: var(--ui-accent-normal-text);
  }

  .base-divider-row:has(.base-divider-line-button:hover) .base-divider-line-button .base-separator,
  .base-divider-row:has(.base-divider-action-button:hover) .base-divider-line-button .base-separator,
  .base-divider-row:has(
      .base-divider-line-button:focus-visible,
      .base-divider-action-button:focus-visible
    )
    .base-divider-line-button
    .base-separator {
    border-color: var(--ui-accent-normal-border);
  }

  .base-editor-card {
    align-items: stretch;
    background: var(--ui-card-normal-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }

  .base-editor-body {
    container-type: inline-size;
    align-content: start;
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
    position: relative;
  }

  .base-editor-sidebar,
  .base-category-sidebar {
    background: var(--ui-card-normal-surface);
    border-right: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    width: 32px;
  }

  .base-editor-sidebar button {
    align-items: center;
    background: transparent;
    border: 0;
    border-bottom: 1px solid transparent;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    flex: 0 4 40px;
    justify-content: center;
    min-height: 32px;
    padding: 0;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-standard) ease;
  }

  .base-editor-sidebar .base-drag-button {
    position: relative;
    z-index: 1;
    flex: 1 1 52px;
  }

  .base-editor-sidebar {
    position: relative;
  }

  .base-editor-card {
    transition: opacity var(--ui-animation-duration-fast) ease-out;
  }

  .base-editor-card[data-dragging='true'] {
    opacity: 0.72;
  }

  /* The violet wash sits behind the drag handle without intercepting input. */
  .base-rail-highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--ui-ghost-surface);
  }

  .base-rail-highlight[data-navigation-highlight='true'] {
    animation: base-rail-navigation-highlight 1000ms linear;
  }

  /* 50ms fade in, 500ms hold, then 450ms fade out. */
  @keyframes base-rail-navigation-highlight {
    0%,
    100% {
      background: var(--ui-ghost-surface);
    }
    5%,
    55% {
      background: var(--ui-accent-action-hover-fill);
    }
  }

  .base-editor-sidebar button:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .base-editor-sidebar:focus-within {
    box-shadow: inset 0 0 0 2px var(--ui-neutral-focus-border);
  }

  .base-editor-sidebar:hover button,
  .base-editor-sidebar:focus-within button {
    border-bottom-color: var(--ui-neutral-normal-border);
  }

  .base-editor-sidebar button:hover,
  .base-editor-sidebar button:focus-visible,
  .base-category-sidebar button:hover,
  .base-category-sidebar button:focus-visible {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .base-category-sidebar {
    align-items: center;
    justify-content: center;
  }

  .base-category-sidebar button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    height: 100%;
    justify-content: center;
    padding: 0;
    width: 100%;
  }

  .base-prompt-title-area {
    height: 56px;
    align-items: center;
    display: grid;
    grid-template-columns: 2px minmax(0, 1fr) auto;
    min-width: 0;
  }

  .base-status-indicator {
    align-self: stretch;
    background: transparent;
  }

  .base-status-indicator[data-edited='true'] {
    background: var(--ui-info-strong-border);
  }

  .base-status-indicator[data-status='InProgress'] {
    background: var(--ui-warning-icon-glyph);
  }

  .base-status-indicator[data-status='Completed'] {
    background: var(--ui-success-normal-text);
  }

  .base-prompt-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
  }

  .base-title-copy,
  .base-category-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .base-title-copy input {
    position: relative;
    display: block;
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .base-title-copy input::placeholder {
    color: var(--ui-secondary-text);
  }

  .base-title-field {
    position: relative;
    min-width: 0;
    height: 20px;
  }

  .base-title-highlights {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    color: transparent;
    font-weight: var(--font-weight-semibold);
  }

  .base-title-mirror {
    position: relative;
    width: max-content;
    white-space: pre;
  }

  .base-title-match,
  .base-monaco-host :global(.base-editor-find-match) {
    background: var(--ui-search-match-fill);
  }

  .base-title-match[data-current='true'],
  .base-monaco-host :global(.base-editor-find-current) {
    background: var(--ui-search-current-fill);
  }

  .base-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .base-template-label {
    align-items: center;
    display: inline-flex;
    gap: 4px;
  }

  .base-template-label[data-template-state='not-selected'] {
    color: var(--ui-secondary-text);
  }

  .base-template-label[data-template-state='no-template'] {
    color: var(--ui-muted-text);
  }

  .base-template-label[data-template-state='selected'] {
    color: var(--ui-normal-text);
  }

  .base-prompt-actions,
  .base-category-actions {
    align-items: center;
    align-self: stretch;
    display: flex;
    min-width: 0;
  }

  .base-prompt-actions {
    gap: 12px;
    padding-right: 12px;
  }

  .base-category-chevron {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
  }

  .base-category-chevron:hover {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .base-actions-separator {
    align-self: stretch;
    border-left: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    flex: 0 0 1px;
    width: 1px;
  }

  .base-status-control {
    position: relative;
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
  }

  .base-status-segmented {
    align-items: stretch;
    display: inline-flex;
  }

  .base-status-segmented > .base-icon-button,
  .base-status-segmented > .base-status-selector {
    position: relative;
  }

  .base-status-segmented > .base-icon-button:hover,
  .base-status-segmented > .base-icon-button:focus-visible,
  .base-status-segmented > .base-status-selector:hover,
  .base-status-segmented > .base-status-selector:focus-within {
    z-index: 1;
  }

  .base-status-segmented[data-leading-action='true'] > .base-icon-button:first-child {
    border-bottom-right-radius: 0;
    border-right-width: 0;
    border-top-right-radius: 0;
  }

  .base-status-segmented[data-leading-action='true'] > .base-status-selector {
    border-bottom-left-radius: 0;
    border-left-width: 0;
    border-top-left-radius: 0;
  }

  .base-status-segmented[data-trailing-action='true'] > .base-status-selector {
    border-bottom-right-radius: 0;
    border-right-width: 0;
    border-top-right-radius: 0;
  }

  .base-status-segmented[data-trailing-action='true'] > .base-icon-button:last-child {
    border-bottom-left-radius: 0;
    border-left-width: 0;
    border-top-left-radius: 0;
  }


  .base-status-selector {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-normal-border);
    --cthulhu-ui-simple-selector-text: var(--ui-hoverable-text);

    align-items: stretch;
    background: transparent;
    border: 1px solid var(--cthulhu-ui-simple-selector-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    display: inline-grid;
    height: 36px;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease;
    width: fit-content;
  }

  .base-status-segmented[data-status='InProgress'] .base-status-selector {
    --cthulhu-ui-simple-selector-text: var(--ui-warning-icon-glyph);
  }

  .base-status-segmented[data-status='Completed'] .base-status-selector {
    --cthulhu-ui-simple-selector-text: var(--ui-success-normal-text);
  }

  .base-status-selector:hover {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-hover-border);

    background: var(--ui-neutral-action-fill);
  }

  .base-status-segmented:not([data-status='InProgress']):not([data-status='Completed'])
    .base-status-selector:hover,
  .base-status-segmented:not([data-status='InProgress']):not([data-status='Completed'])
    .base-status-selector[data-open='true'],
  .base-status-segmented:not([data-status='InProgress']):not([data-status='Completed'])
    .base-status-selector:has(:focus-visible) {
    --cthulhu-ui-simple-selector-text: var(--ui-normal-text);
  }

  .base-status-selector[data-open='true'] {
    background: var(--ui-neutral-action-hover-fill);
  }

  .base-status-selector:has(:focus-visible) {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-hover-border);

    background: var(--ui-neutral-action-fill);
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .base-status-value {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
    color: var(--cthulhu-ui-simple-selector-text);
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-weight: var(--font-weight-semibold);
    grid-area: 1 / 1;
    height: 34px;
    padding: 0;
    white-space: nowrap;
    width: 100%;
  }

  .base-status-value:focus-visible {
    outline: none;
  }

  .base-status-value-content {
    align-items: center;
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    gap: 6px;
    height: 34px;
    justify-content: center;
    min-width: 0;
    padding-left: 8px;
  }

  .base-status-width-sizer-item {
    align-items: center;
    display: inline-flex;
    gap: 6px;
  }

  .base-status-width-sizer {
    display: grid;
    grid-area: 1 / 1;
    pointer-events: none;
    visibility: hidden;
  }

  .base-status-width-sizer-item {
    grid-area: 1 / 1;
    padding-left: 8px;
    padding-right: 32px;
    width: max-content;
  }

  .base-status-value-content :global(svg),
  .base-status-width-sizer-item :global(svg) {
    flex: 0 0 auto;
  }

  .base-status-more {
    align-items: center;
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
    height: 34px;
    justify-content: center;
    margin-left: auto;
    padding: 0 6px;
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .base-status-selector:where(:hover, :has(:focus-visible), [data-open='true'])
    .base-status-more {
    color: var(--ui-normal-text);
  }

  .base-status-value:focus-visible,
  .base-status-more:focus-visible {
    outline: none;
  }

  .base-monaco-shell {
    background: var(--ui-editor-content-surface);
    box-sizing: border-box;
    min-width: 0;
  }

  .base-monaco-host {
    min-height: 0;
    min-width: 0;
    position: relative;
    width: 100%;
  }

  .base-categories-inset {
    min-width: 0;
  }

  .base-category-section {
    min-width: 0;
  }

  .base-category-card {
    border-color: var(--ui-neutral-normal-border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    height: 58px;
  }

  .base-category-title-bar {
    align-items: center;
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    height: 56px;
    min-width: 0;
    overflow: hidden;
    padding: 8px 16px;
    user-select: none;
  }

  .base-category-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 30px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .base-category-chevron {
    height: 30px;
    width: 30px;
  }

  .base-category-title-line {
    align-items: baseline;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .base-category-title {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-category-children {
    border-left: 1px solid var(--ui-neutral-normal-border);
    border-right: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    min-width: 0;
    padding-inline: 11px; /* Include the 1px side border in the live 12px inset. */
  }

  .base-category-bottom-cap {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 0 0 8px 8px;
    border-top: 0;
    box-sizing: border-box;
    height: 8px;
    width: 100%;
  }

  .base-template-dialog-layer {
    -webkit-app-region: no-drag;
    align-items: center;
    background: var(--ui-card-normal-shadow);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 16px;
    position: fixed;
    z-index: 50;
  }

  .base-template-dialog {
    background: var(--ui-card-overlay-surface);
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: 0 8px 12px var(--ui-card-normal-shadow);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 32px);
    max-width: 580px;
    min-width: 0;
    padding: 18px 16px 16px;
    width: 100%;
  }

  .base-template-dialog-header {
    align-items: flex-start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 4px 16px;
  }

  .base-template-dialog-heading {
    align-items: center;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .base-template-dialog-heading-copy {
    min-width: 0;
  }

  .base-template-dialog-icon {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .base-template-dialog-header h2 {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-dialog-heading p {
    color: var(--ui-muted-text);
    margin: 3px 0 0;
  }

  .base-template-dialog-body {
    min-width: 0;
    padding-top: 14px;
  }

  .base-no-template-panel {
    margin-bottom: 15px;
  }

  .base-template-tree {
    max-height: min(470px, calc(100vh - 295px));
    overflow-y: auto;
    padding-right: 4px;
    padding-top: 8px;
    width: 100%;
  }

  .base-template-option-row,
  .base-template-category-row {
    padding-block: 1px;
    width: 100%;
  }

  .base-template-root-option,
  .base-template-option-button,
  .base-template-category-button {
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    height: 30px;
    min-width: 0;
    width: 100%;
  }

  .base-template-root-option,
  .base-template-root-heading {
    align-items: center;
    display: flex;
    text-align: left;
  }

  .base-template-root-option {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: grid;
    gap: 11px;
    grid-template-columns: 34px minmax(0, 1fr) 20px;
    height: 54px;
    padding: 0 13px 0 10px;
  }

  .base-no-template-icon {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .base-no-template-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .base-no-template-copy strong {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
  }

  .base-no-template-copy small {
    color: var(--ui-muted-text);
  }

  .base-template-tree-label {
    align-items: flex-end;
    display: flex;
    justify-content: space-between;
    padding: 0 3px 8px;
  }

  .base-template-tree-label > span:first-child {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
  }

  .base-template-tree-label span:last-child:not(:first-child) {
    color: var(--ui-muted-text);
  }

  .base-template-root-group {
    border: 1px solid var(--ui-card-nested-border);
    border-radius: var(--cthulhu-ui-radius-card);
    margin-bottom: 10px;
    overflow: hidden;
  }

  .base-template-root-heading {
    background: var(--ui-card-normal-surface);
    border-bottom: 1px solid var(--ui-card-nested-border);
    color: var(--ui-normal-text);
    gap: 9px;
    height: 50px;
    box-sizing: border-box;
    padding: 7px 12px;
  }

  .base-template-collection-icon {
    flex: 0 0 34px;
    height: 34px;
    justify-content: center;
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
  }

  .base-template-root-copy {
    display: grid;
    flex: 1 1 auto;
    gap: 1px;
    min-width: 0;
  }

  .base-template-root-copy strong {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-root-copy span {
    color: var(--ui-muted-text);
  }

  .base-template-root-contents {
    background: var(--ui-card-solid-surface);
    padding: 6px 5px 7px;
  }

  .base-template-option-button,
  .base-template-category-button {
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
  }

  .base-template-root-option,
  .base-template-option-button,
  .base-template-category-button {
    background: var(--ui-ghost-surface);
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  /* Select-mode options keep the arrow cursor; quick-mode options apply and copy, so they use the pointer. */
  .base-template-root-option,
  .base-template-option-button,
  .base-template-category-button {
    cursor: default;
  }

  .base-template-dialog-body[data-mode='select-and-copy']
    :is(.base-template-root-option, .base-template-option-button, .base-template-category-button) {
    cursor: pointer;
  }

  .base-template-root-option:hover {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }

  /* Template and folder rows reuse the prompt tree's row hover. */
  .base-template-option-button:hover,
  .base-template-category-button:hover {
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  /* Choosing the selected option again does nothing, so it keeps the brighter accent fill while hovered. */
  .base-template-root-option.active,
  .base-template-option-button.active,
  .base-template-option-button.active:hover {
    background: var(--ui-accent-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .base-template-root-option.active {
    border-color: var(--ui-accent-muted-border);
  }

  .base-template-option-button {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns:
      calc(5px + 12px * var(--base-template-indent-count, 1))
      20px
      minmax(0, 1fr);
    padding: 0 14px 0 0;
    text-align: left;
  }

  .base-template-option-button > span:last-child,
  .base-template-category-button > span:nth-child(3) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-guide {
    align-self: stretch;
    border-right: 1px solid var(--ui-neutral-normal-border);
    justify-self: start;
    margin-left: calc(1px + 12px * var(--base-template-indent-count, 1));
    opacity: 0;
    transition: opacity var(--ui-animation-duration-standard) ease-out;
    width: 1px;
  }

  .base-template-guide[data-indent-count='0'] {
    border-right: 0;
  }

  .base-template-selection-mark {
    align-items: center;
    box-sizing: border-box;
    display: inline-flex;
    height: 17px;
    justify-content: center;
    width: 17px;
  }

  .base-template-selection-mark[data-control='radio'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 50%;
  }

  .base-template-selection-mark[data-control='radio']::after {
    background: transparent;
    border-radius: 50%;
    content: '';
    height: 9px;
    width: 9px;
  }

  .base-template-selection-mark[data-control='copy'] {
    color: var(--ui-secondary-icon-glyph);
  }

  .base-template-option-button.active .base-template-selection-mark[data-control='radio'],
  .base-template-root-option.active .base-template-selection-mark[data-control='radio'] {
    border-color: var(--ui-accent-normal-border);
  }

  .base-template-option-button.active .base-template-selection-mark[data-control='radio']::after,
  .base-template-root-option.active .base-template-selection-mark[data-control='radio']::after {
    background: var(--ui-normal-text);
  }

  .base-template-tree:hover .base-template-guide,
  .base-template-tree:focus-within .base-template-guide {
    opacity: 1;
  }

  .base-template-category-button {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 24px 18px minmax(0, 1fr);
    padding: 0 12px 0 calc(9px + 12px * var(--base-template-indent-count, 0));
    text-align: left;
  }

  .base-template-category-button > :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .base-template-chevron {
    align-items: center;
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    height: 24px;
    justify-content: center;
    transition: transform var(--ui-animation-duration-standard) ease;
    width: 24px;
  }

  .base-template-chevron[data-expanded='true'] {
    transform: rotate(90deg);
  }

  .base-template-dialog-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    padding-top: 16px;
  }

  .base-dialog-confirm-button {
    align-items: center;
    background: var(--ui-accent-action-fill);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    display: inline-flex;
    font-weight: var(--font-weight-semibold);
    gap: 7px;
    height: 40px;
    padding: 0 15px;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease;
  }

  .base-dialog-confirm-button:hover,
  .base-dialog-confirm-button:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .base-dialog-cancel-button {
    align-items: center;
    background: var(--ui-neutral-action-fill);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: inline-flex;
    font-weight: var(--font-weight-semibold);
    height: 40px;
    padding: 0 14px;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease;
  }

  .base-dialog-cancel-button:hover,
  .base-dialog-cancel-button:focus-visible {
    background: var(--ui-neutral-action-hover-fill);
    border-color: var(--ui-neutral-hover-border);
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: -2px;
  }
  .base-category-chevron :global(svg) { transition: transform var(--ui-animation-duration-fast) ease-out; }
  .base-category-chevron[aria-expanded='true'] :global(svg) { transform: rotate(90deg); }
  .base-category-title-copy { display: grid; gap: 4px; min-width: 0; }
  .base-final-gap { position: relative; height: 28px; display: flex; align-items: center; }
  .base-collapsed-summary { position: relative; height: 28px; display: flex; align-items: center; justify-content: center; }
  .base-collapsed-summary button { background: var(--ui-ghost-surface); border: 0; color: var(--ui-secondary-text); padding: 0; }
  .base-collapsed-summary button:hover { color: var(--ui-normal-text); }
  /* Live prompt drag ghost: the dragged item's icon and title on a compact field surface. */
  .base-drag-ghost {
    position: fixed;
    z-index: 80;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    width: max-content;
    min-width: 120px;
    max-width: 400px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
  }
  .base-drag-ghost :global(svg) { flex: 0 0 auto; color: var(--ui-hoverable-icon-glyph); }
  .base-drag-ghost span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .base-editor-sidebar .base-drag-button,
  .base-category-sidebar button { cursor: grab; }
  .base-empty { color: var(--ui-secondary-text); text-align: center; padding: 48px 0; }
  .base-empty p { margin: 0; }
  .base-empty .base-empty-detail { margin-top: 8px; }
  .base-name-dialog { max-width: 520px; background: var(--ui-card-overlay-surface); }
  .base-name-field { display: grid; gap: 7px; min-width: 0; padding: 16px; }
  .base-name-control { position: relative; min-width: 0; }
  .base-name-input { box-sizing: border-box; width: 100%; height: 40px; border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-field-surface); color: var(--ui-normal-text); border: 1px solid var(--ui-neutral-normal-border); padding: 4px 14px; font-weight: var(--font-weight-semibold); }
  .base-name-input::placeholder { color: var(--ui-muted-text); }
  .base-name-input:focus-visible { outline: none; border-color: var(--ui-neutral-focus-border); box-shadow: var(--cthulhu-ui-shadow-focus); }
  .base-name-input[aria-invalid='true'] { border-color: var(--ui-danger-strong-border); box-shadow: var(--cthulhu-ui-shadow-focus-danger); }
  .base-name-error { position: absolute; top: 100%; left: 0; z-index: 10; margin-top: 2px; height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: var(--cthulhu-ui-radius-control); white-space: nowrap; background: color-mix(in oklch, var(--ui-card-solid-surface) 76%, var(--ui-danger-strong-border)); box-shadow: 0 8px 18px var(--ui-card-normal-shadow); }
  .base-name-error :global(svg) { color: var(--ui-danger-icon-glyph); }
  .base-name-dialog .base-dialog-confirm-button { border-color: var(--ui-accent-muted-border); font-weight: var(--font-weight-semibold); padding-inline: 14px; }
  .base-name-dialog .base-dialog-confirm-button:disabled { opacity: 0.5; pointer-events: none; }
  .base-manage-dialog { background: var(--ui-card-overlay-surface); max-width: min(1040px, calc(100vw - 32px)); width: 100%; }
  .base-manage-body { display: grid; grid-template-columns: 232px minmax(0, 1fr); height: min(570px, calc(100vh - 212px)); min-height: 240px; }
  .base-management-selector { border-right: 1px solid var(--ui-neutral-normal-border); display: flex; flex-direction: column; min-height: 0; padding: 18px 14px 20px 0; }
  .base-management-selector-header { align-items: center; color: var(--ui-normal-text); display: flex; font-weight: var(--font-weight-semibold); justify-content: space-between; padding: 0 10px 14px; }
  .base-management-selector-header span:last-child { color: var(--ui-muted-text); font-weight: var(--font-weight-normal); }
  .base-management-selector-items { display: flex; flex: 1; flex-direction: column; gap: 2px; overflow: auto; }
  .base-management-selector-item { align-items: center; background: var(--ui-ghost-surface); border: 1px solid var(--ui-ghost-surface); border-radius: var(--cthulhu-ui-radius-card); box-sizing: border-box; color: var(--ui-hoverable-text); display: grid; grid-template-columns: 34px 8px minmax(0, 1fr) 22px; height: 58px; padding: 8px; text-align: left; width: 100%; }
  .base-management-selector-item:hover,
  .base-management-selector-item:focus-visible { background: var(--ui-neutral-action-fill); border-color: var(--ui-neutral-hover-border); color: var(--ui-normal-text); }
  .base-management-selector-item.active { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-muted-border); color: var(--ui-normal-text); }
  .base-management-selector-item.active:hover,
  .base-management-selector-item.active:focus-visible { background: var(--ui-accent-action-hover-fill); border-color: var(--ui-accent-muted-hover-border); }
  .base-management-selector-icon { align-items: center; color: var(--ui-secondary-icon-glyph); display: flex; grid-column: 1; height: 34px; justify-content: center; width: 34px; }
  .base-management-selector-copy { display: flex; flex-direction: column; gap: 2px; grid-column: 3; min-width: 0; }
  .base-management-selector-copy > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .base-management-selector-copy > span:first-child { font-weight: var(--font-weight-semibold); }
  .base-management-selector-copy > span:last-child { color: inherit; }
  .base-management-selector-item > :global(svg) { color: var(--ui-secondary-icon-glyph); grid-column: 4; justify-self: center; }
  .base-management-add-button { align-items: center; background: var(--ui-neutral-action-fill); border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-normal-text); display: inline-flex; font-weight: var(--font-weight-semibold); gap: 7px; height: 40px; justify-content: center; margin-top: 16px; padding: 0 14px; width: 100%; }
  .base-management-add-button:hover,
  .base-management-add-button:focus-visible { background: var(--ui-neutral-action-hover-fill); border-color: var(--ui-neutral-hover-border); }
  .base-management-editor { min-width: 0; overflow: auto; padding: 16px 8px 22px 26px; }
  .base-management-heading-row { align-items: center; color: var(--ui-normal-text); display: flex; gap: 12px; margin-bottom: 22px; min-width: 0; width: 100%; }
  .base-management-heading-icon { align-items: center; color: var(--ui-hoverable-icon-glyph); display: flex; flex: 0 0 34px; height: 34px; justify-content: center; width: 34px; }
  .base-management-heading-copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
  .base-management-heading-copy strong,
  .base-management-heading-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .base-management-heading-copy span { color: var(--ui-muted-text); }
  .base-management-fields { display: grid; gap: 17px; }
  .base-management-fields label,
  .base-management-field { display: grid; gap: 7px; min-width: 0; }
  .base-management-field-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .base-management-field-heading { align-items: center; display: flex; gap: 4px; }
  .base-management-field-heading strong,
  .base-management-field-copy > strong { color: var(--ui-normal-text); font-weight: var(--font-weight-semibold); }
  .base-management-field-heading span,
  .base-management-field-detail { color: var(--ui-muted-text); }
  .base-management-field-control { min-width: 0; position: relative; }
  .base-management-input { background: var(--ui-neutral-field-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); box-sizing: border-box; color: var(--ui-normal-text); font-weight: var(--font-weight-semibold); height: 40px; min-width: 0; outline: none; padding: 4px 14px; width: 100%; }
  .base-management-input:focus-visible { border-color: var(--ui-neutral-focus-border); box-shadow: var(--cthulhu-ui-shadow-focus); outline: none; }
  .base-management-input[aria-invalid='true'] { border-color: var(--ui-danger-strong-border); }
  .base-management-input[aria-invalid='true']:focus-visible { box-shadow: var(--cthulhu-ui-shadow-focus-danger); }
  .base-management-description-editor { background: var(--ui-editor-content-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); display: block; min-width: 0; overflow: hidden; }
  .base-manage-dialog .base-dialog-confirm-button:disabled { cursor: default; opacity: 0.5; pointer-events: none; }
  .base-confirmation-dialog { max-width: 520px; padding-top: 16px; background: var(--ui-card-overlay-surface); }
  .base-confirmation-dialog .base-template-dialog-header { padding-bottom: 12px; }
  .base-confirmation-content { display: grid; gap: 20px; min-width: 0; padding: 0 12px 4px; }
  .base-confirmation-content p { margin: 0; color: var(--ui-normal-text); }
  .base-confirmation-dialog[data-informational='true'] .base-confirmation-content,
  .base-confirmation-dialog[data-acknowledgement='true'] .base-confirmation-content { padding: 12px; }
  .base-confirmation-acknowledgement {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 16px;
    border: 1px solid var(--ui-danger-muted-border);
    border-radius: 8px;
    background: var(--ui-danger-normal-surface);
    color: var(--ui-normal-text);
  }
  .base-confirmation-checkbox { position: relative; flex: 0 0 17px; height: 17px; margin-top: 2px; }
  .base-confirmation-checkbox input { position: absolute; inset: 0; width: 17px; height: 17px; margin: 0; opacity: 0; cursor: pointer; }
  .base-confirmation-checkbox > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 17px;
    height: 17px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
    pointer-events: none;
  }
  .base-confirmation-checkbox input:checked + span { background: var(--ui-danger-selection-fill); border-color: var(--ui-danger-selection-border); color: var(--ui-normal-text); }
  .base-confirmation-checkbox input:focus-visible + span { outline: 2px solid var(--ui-danger-strong-border); outline-offset: 2px; }
  .base-confirmation-dialog .base-dialog-confirm-button { background: var(--ui-danger-action-fill); border-color: var(--ui-danger-muted-border); font-weight: var(--font-weight-semibold); }
  .base-confirmation-dialog .base-dialog-confirm-button:hover { background: var(--ui-danger-action-hover-fill); border-color: var(--ui-danger-muted-hover-border); }
  .base-confirmation-dialog .base-dialog-confirm-button:disabled { opacity: 0.5; pointer-events: none; }
  .base-confirmation-dialog[data-informational='true'] .base-dialog-confirm-button { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-muted-border); }
  .base-confirmation-dialog[data-informational='true'] .base-dialog-confirm-button:hover { background: var(--ui-accent-action-hover-fill); border-color: var(--ui-accent-muted-hover-border); }
  .base-status-indicator[data-status='Archived'] { background: var(--ui-secondary-icon-glyph); visibility: visible; }
  @container (width < 720px) {
    .base-prompt-title-area { height: 109px; grid-template-columns: 2px minmax(0, 1fr); grid-template-rows: 56px 53px; }
    .base-status-indicator { grid-row: 1 / -1; }
    .base-prompt-title-main { grid-column: 2; grid-row: 1; }
    .base-prompt-actions { grid-column: 2; grid-row: 2; border-top: 1px solid var(--ui-neutral-normal-border); justify-content: space-between; padding-left: 16px; }
    .base-actions-separator { display: none; }
  }
  .base-find-widget {
    position: absolute;
    top: 36px;
    right: 18px;
    z-index: 40;
    display: flex;
    align-items: center;
    width: 400px;
    max-width: calc(100% - 36px);
    height: 33px;
    padding: 0 4px 0 8px;
    box-sizing: border-box;
    background: var(--ui-card-solid-surface);
    color: var(--ui-normal-text);
    border: 1px solid var(--ui-neutral-normal-border);
    border-top: 0;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 0 8px 2px var(--ui-card-normal-shadow);
  }
  .base-find-widget textarea {
    min-width: 0;
    flex: 1;
    height: 25px;
    resize: none;
    overflow: hidden;
    background: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 2px;
    padding: 2px 6px;
    font-family: inherit;
  }
  .base-find-widget textarea:focus-visible { outline: 1px solid var(--ui-info-strong-border); outline-offset: -1px; }
  .base-find-widget > span { min-width: 69px; margin-left: 3px; padding: 2px 0 0 2px; }
  .base-find-widget[data-no-results='true'] > span { color: var(--ui-danger-icon-glyph); }
  .base-find-button {
    box-sizing: content-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 3px;
    margin-left: 3px;
    border: 0;
    border-radius: 5px;
    color: inherit;
    background: var(--ui-ghost-surface);
  }
  .base-find-button:hover { background: var(--ui-neutral-action-hover-fill); }
  .base-find-button:disabled { opacity: 0.4; pointer-events: none; }

  .base-status-menu {
    background: var(--ui-card-overlay-surface);
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: 0 0 12px var(--ui-shadow-raised);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: grid;
    gap: 1px;
    max-height: calc(100vh - 32px);
    /* Menus fit their text but never narrow below a comfortable 200px click width. */
    max-width: calc(100vw - 32px);
    min-width: 200px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px;
    position: fixed;
    width: max-content;
    z-index: 60;
  }
  .base-status-menu-item {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: 28px minmax(0, 1fr);
    min-height: 50px;
    padding: 6px 8px;
    text-align: left;
    transition: background-color var(--ui-animation-duration-standard) ease;
    width: 100%;
  }
  .base-status-menu-item:hover,
  .base-status-menu-item:focus-visible { background: var(--ui-neutral-action-fill); color: var(--ui-normal-text); }
  .base-status-menu-icon {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    height: 28px;
    justify-content: center;
    width: 28px;
  }
  .base-status-menu-icon[data-status='InProgress'] { color: var(--ui-warning-icon-glyph); }
  .base-status-menu-icon[data-status='Completed'] { color: var(--ui-success-normal-text); }
  .base-status-menu-text { display: grid; gap: 2px; min-width: 0; }
  .base-status-menu-title {
    font-weight: var(--font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .base-status-menu-subtitle {
    color: var(--ui-secondary-text);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .base-status-menu-item:where(:hover, :focus-visible) .base-status-menu-subtitle { color: var(--ui-normal-text); }
  .base-status-menu-item:where(:hover, :focus-visible)
    .base-status-menu-icon:not([data-status='InProgress']):not([data-status='Completed']) { color: var(--ui-normal-text); }
  .base-status-menu-icon[data-action='delete'] { color: var(--ui-hoverable-icon-glyph); }
  .base-split-button {
    align-items: stretch;
    display: inline-flex;
    min-width: 0;
  }
  .base-split-button > .base-icon-button {
    position: relative;
  }
  .base-split-button > .base-icon-button:first-child {
    border-bottom-right-radius: 0;
    border-right-width: 0;
    border-top-right-radius: 0;
  }
  .base-split-button > .base-icon-button:last-of-type {
    border-bottom-left-radius: 0;
    border-left-width: 0;
    border-top-left-radius: 0;
    width: 23px;
  }
  .base-split-button > .base-icon-button:is(:hover, :focus-visible) {
    z-index: 1;
  }
  .base-split-separator {
    align-self: stretch;
    background: var(--ui-ghost-surface);
    border-left: 0.25px solid var(--ui-neutral-normal-border);
    box-sizing: content-box;
    flex: 0 0 auto;
    width: 0;
  }
  .base-split-button > .base-icon-button:is(:hover, :focus-visible) + .base-split-separator,
  .base-split-button > .base-split-separator:has(+ .base-icon-button:is(:hover, :focus-visible)),
  .base-status-segmented > :is(:hover, :focus-visible, :has(:focus-visible)) + .base-split-separator,
  .base-status-segmented > .base-split-separator:has(+ :is(:hover, :focus-visible, :has(:focus-visible))) {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
  }
  .base-split-button > .base-icon-button[data-hover-variant='danger']:is(:hover, :focus-visible) + .base-split-separator {
    background: var(--ui-danger-action-hover-fill);
    border-color: var(--ui-danger-muted-hover-border);
  }
  .base-status-segmented > .base-split-separator:has(+ .base-icon-button[data-hover-variant='success']:is(:hover, :focus-visible)) {
    background: var(--ui-success-action-hover-fill);
    border-color: var(--ui-success-muted-hover-border);
  }

  .base-attached-note-header {
    align-items: center;
    background: var(--ui-card-normal-surface);
    border: 0;
    color: var(--ui-muted-text);
    display: flex;
    gap: 9px;
    height: 36px;
    min-width: 0;
    padding: 0 12px 0 21px;
    position: relative;
    text-align: left;
    width: 100%;
  }
  .base-attached-note-icon {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    flex: 0 0 18px;
    height: 18px;
    justify-content: center;
    width: 18px;
  }
  .base-attached-note-copy {
    align-items: baseline;
    display: flex;
    gap: 12px;
    min-width: 0;
  }
  .base-attached-note-title {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
  }
  .base-attached-note-header[data-hidden='true'] .base-attached-note-icon {
    color: var(--ui-muted-icon-glyph);
  }
  .base-attached-note-header[data-hidden='true'] .base-attached-note-title {
    color: var(--ui-secondary-text);
    font-weight: var(--font-weight-normal);
  }
  .base-attached-note-header[data-hidden='true']:is(:hover, :focus-visible) .base-attached-note-title {
    color: var(--ui-hoverable-text);
  }
  .base-attached-note-header[data-hidden='true']:is(:hover, :focus-visible) .base-attached-note-icon {
    color: var(--ui-hoverable-icon-glyph);
  }
  .base-attached-note-metadata {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .base-attached-note-indicator {
    inset: 0 auto 0 0;
    position: absolute;
    width: 2px;
  }
  .base-status-segmented[data-status='Todo'] .base-status-value-content :global(svg),
  .base-status-segmented[data-status='Backlog'] .base-status-value-content :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }
</style>
