<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { onDestroy, untrack } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import {
    AlertCircle,
    Ban,
    Check,
    Archive,
    Clock,
    ChevronDown,
    ChevronRight,
    ChevronUp,
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
    Layers,
    NotebookPen,
    Pencil,
    Play,
    Plus,
    Search,
    Trash2,
    Zap,
    X
  } from 'lucide-svelte'
  import * as monaco from 'monaco-editor'
  import { estimateTokenCount } from 'tokenx'
  import CopyButton from '@renderer/common/cthulhu-ui/buttons/CopyButton.svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/buttons/IconButtonBar.svelte'
  import UiSplitIconButton from '@renderer/common/cthulhu-ui/buttons/SplitIconButton.svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import UiIconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import UiSeparator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import UiSeparatorDot from '@renderer/common/cthulhu-ui/layout/SeparatorDot.svelte'
  import EditorMetadataRow from '@renderer/features/prompt-editor/EditorMetadataRow.svelte'
  import PromptStatusIndicator from '@renderer/features/prompt-editor/PromptStatusIndicator.svelte'

  // Snapshot of the prompt-collection screen: all fixtures, controls, and mutations live here.
  // The notes UI uses shared cthulhu-ui and prompt-editor components; the rest is local markup
  // over third-party Svelte/icons/Monaco/token counting and the host's palette/theme.
  // Shared components are imported with a Ui prefix where a local snippet already uses the name.
  // Editor sizing below intentionally uses application defaults, independent of persisted settings.
  // Snapshot: task-prompt collection UI. No workspace, IPC, live components, or domain mutations.
  const NO_TEMPLATE_LABEL = 'No template'
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

  // Side effect: portal the local popup out of editor containers and clamp it like the live dropdown.
  const mountMockMenu = (node: HTMLElement, options: { anchor: HTMLElement; width: number }) => {
    const { anchor, width } = options
    document.body.appendChild(node)
    const rect = anchor.getBoundingClientRect()
    node.style.width = `${Math.max(width, rect.width)}px`
    const menu = node.getBoundingClientRect()
    node.style.left = `${Math.max(16, Math.min(rect.right - menu.width, window.innerWidth - menu.width - 16))}px`
    node.style.top = `${Math.max(16, Math.min(rect.bottom + 4, window.innerHeight - menu.height - 8))}px`
    const dismiss = (event: PointerEvent) => {
      if (!node.contains(event.target as Node) && !anchor.contains(event.target as Node)) {
        statusMenuId = null
        splitMenuKey = null
      }
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') anchor.querySelector('button')?.focus()
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
  let splitMenuAnchor = $state<HTMLElement | null>(null)
  let statusAnchor = $state<HTMLElement | null>(null)
  const toggleStatusMenu = (prompt: MockPrompt, event: MouseEvent) => {
    splitMenuKey = null
    statusAnchor = (event.currentTarget as HTMLElement).parentElement
    statusMenuId = statusMenuId === prompt.id ? null : prompt.id
  }

  type MockIconButtonOptions = {
    active?: boolean
    ariaExpanded?: boolean
    ariaPressed?: boolean
    baseVariant?: 'normal' | 'dim' | 'muted'
    borderless?: boolean
    disabled?: boolean
    hoverVariant?: 'neutral' | 'accent' | 'success' | 'danger' | 'glyph'
    iconClass?: string
    iconSize?: number
    onclick?: (event: MouseEvent) => void
    size?: 'default' | 'compact' | 'compact-large-icon' | 'tiny' | 'sidebar-rail'
    testId?: string
  }

  type MockSplitMenuItem = {
    icon: ComponentType
    title: string
    subtitle: string
    onclick: () => void
  }

  type MockDocument = {
    fixedHeightPx?: number
    id: string
    minLines?: number
    text: string
  }

  type MockPrompt = MockDocument & {
    title: string
    categoryId: string
    templateLabel: string
    modifiedLabel: string
    finalizedAt: number | null
    status: MockPromptStatus
    templateIds: string[]
    templateState: 'not-selected' | 'no-template' | 'selected'
    isEdited: boolean
    kind?: 'note'
    attachedNote?: MockAttachedNote
  }

  type MockAttachedNote = MockDocument & {
    modifiedLabel: string
    visible: boolean
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
    appearance: Partial<Pick<MockPrompt, 'isEdited' | 'modifiedLabel' | 'finalizedAt' | 'kind' | 'attachedNote'>> = {}
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
      {
        attachedNote: {
          id: 'base-discovery-note',
          modifiedLabel: 'Updated yesterday',
          visible: false,
          isEdited: false,
          text: 'Start with the persistence layer before reading the renderer stores.'
        }
      }
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
      { isEdited: true }
    ),
    createPrompt(
      'base-standalone-note',
      'Open questions from planning review',
      'base-root',
      NO_TEMPLATE_LABEL,
      [
        '- Should detached notes keep the original prompt category?',
        '- Confirm whether hidden notes are excluded from copied text.',
        '- Ask design about the empty state for notes without a title.',
        '',
        'Follow up with the team before the release checklist is drafted.'
      ].join('\n'),
      MockPromptStatus.Todo,
      { kind: 'note', modifiedLabel: 'Updated 3 days ago' }
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
      {
        modifiedLabel: 'Updated yesterday',
        attachedNote: {
          id: 'base-plan-note',
          modifiedLabel: 'Updated today',
          visible: true,
          isEdited: false,
          text: [
            'The sidebar drag-and-drop code already handles keyboard reordering, so reuse it.',
            '',
            '- Ask for a smaller first milestone if the plan touches more than three stores.',
            '- Last run skipped the migration step; call it out explicitly this time.'
          ].join('\n')
        }
      }
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
      { finalizedAt: Date.now() - 86_400_000 }
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

  const groups = ['Active', 'Backlog', 'Completed', 'Archived'] as const
  let screenMode = $state<(typeof groups)[number]>('Active')
  let rootTitle = $state('Product Work')
  let statusMenuId = $state<string | null>(null)
  let splitMenuKey = $state<string | null>(null)
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
  const selectGroup = (group: (typeof groups)[number]) => {
    screenMode = group
    statusMenuId = null
    splitMenuKey = null
    breadcrumbCategoryId = null
    viewport?.scrollTo({ top: 0 })
  }
  const visiblePrompts = (prompts: MockPrompt[]) => prompts.filter((prompt) => matchesGroup(prompt))
  const removePrompt = (prompt: MockPrompt) => {
    rootPrompts = rootPrompts.filter((item) => item.id !== prompt.id)
    for (const category of categories) category.prompts = category.prompts.filter((item) => item.id !== prompt.id)
    splitMenuKey = null
  }
  const requestPromptDelete = (prompt: MockPrompt) => {
    if (!prompt.title.trim() && !prompt.text.trim()) { removePrompt(prompt); return }
    confirmation = { title: 'Delete Prompt', description: 'Are you sure you want to permanently delete this prompt?',
      submit: 'Delete', confirm: () => removePrompt(prompt) }
  }
  const addPrompt = (category?: MockCategory, afterId?: string) => {
    const prompts = category ? category.prompts : rootPrompts
    const prompt = createPrompt(window.crypto.randomUUID(), '', category?.id ?? 'base-root', TEMPLATE_NOT_SELECTED_LABEL, '',
      screenMode === 'Backlog' ? MockPromptStatus.Backlog : MockPromptStatus.Todo)
    prompts.splice(afterId ? prompts.findIndex((item) => item.id === afterId) + 1 : 0, 0, prompt)
  }
  const movePrompt = (prompt: MockPrompt, direction: number) => {
    const prompts = categories.find((category) => category.id === prompt.categoryId)?.prompts ?? rootPrompts
    const visible = visiblePrompts(prompts)
    const target = visible[visible.indexOf(prompt) + direction]
    if (!target) return
    const index = prompts.indexOf(prompt)
    const targetIndex = prompts.indexOf(target)
    prompts.splice(index, 1)
    prompts.splice(targetIndex, 0, prompt)
  }

  type MockDragSource = { kind: 'prompt' | 'category'; id: string; title: string }
  type MockDropTarget = { category?: MockCategory; afterId?: string; nextCategoryId?: string | null; categoryOnly?: boolean }
  let dragSource = $state<MockDragSource | null>(null)
  let dragPosition = $state({ x: 0, y: 0 })
  const dropTargets = new SvelteMap<HTMLElement, MockDropTarget>()
  let hoveredDropTarget: HTMLElement | null = null

  const finishDrop = (target: MockDropTarget) => {
    if (!dragSource) return
    if (dragSource.kind === 'category') {
      const category = categories.find((item) => item.id === dragSource?.id)
      if (!category || target.nextCategoryId === category.id) return
      categories = categories.filter((item) => item.id !== category.id)
      const index = categories.findIndex((item) => item.id === target.nextCategoryId)
      categories.splice(index < 0 ? categories.length : index, 0, category)
    } else {
      const prompt = allPrompts.find((item) => item.id === dragSource?.id)
      if (!prompt || target.afterId === prompt.id) return
      removePrompt(prompt)
      prompt.categoryId = target.category?.id ?? 'base-root'
      const prompts = target.category?.prompts ?? rootPrompts
      const index = target.afterId ? prompts.findIndex((item) => item.id === target.afterId) + 1 : 0
      prompts.splice(index, 0, prompt)
    }
  }

  // Side effect: register only local divider elements, never the live screen's drag/drop targets.
  const mockDropTarget = (node: HTMLElement, options: MockDropTarget) => {
    dropTargets.set(node, options)
    return {
      update(next: MockDropTarget) { dropTargets.set(node, next) },
      destroy() { dropTargets.delete(node) }
    }
  }

  // Side effect: own the pointer gesture, local ghost, and divider highlights until drop or Escape.
  const mockDragHandle = (node: HTMLButtonElement, options: MockDragSource) => {
    let source = options
    let cleanupGesture = () => {}
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || isFinalMode) return
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const move = (next: PointerEvent) => {
        if (!dragSource && Math.hypot(next.clientX - startX, next.clientY - startY) < 4) return
        dragSource = source
        dragPosition = { x: next.clientX + 12, y: next.clientY + 12 }
        hoveredDropTarget?.removeAttribute('data-drop-over')
        hoveredDropTarget = null
        for (const [element, target] of dropTargets) {
          const allowed = source.kind === 'category' ? target.nextCategoryId !== undefined : !target.categoryOnly
          if (!allowed) continue
          const rect = element.getBoundingClientRect()
          if (next.clientX >= rect.left && next.clientX <= rect.right && next.clientY >= rect.top && next.clientY <= rect.bottom) {
            hoveredDropTarget = element
            element.setAttribute('data-drop-over', 'true')
            break
          }
        }
        if (viewport) {
          const rect = viewport.getBoundingClientRect()
          if (next.clientY < rect.top + 40) viewport.scrollTop -= 20
          if (next.clientY > rect.bottom - 40) viewport.scrollTop += 20
        }
      }
      const up = () => {
        const target = hoveredDropTarget ? dropTargets.get(hoveredDropTarget) : null
        if (target) finishDrop(target)
        cleanupGesture()
      }
      const cancel = (next: KeyboardEvent) => { if (next.key === 'Escape') cleanupGesture() }
      cleanupGesture = () => {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', cleanupGesture)
        document.removeEventListener('keydown', cancel)
        hoveredDropTarget?.removeAttribute('data-drop-over')
        hoveredDropTarget = null
        dragSource = null
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', cleanupGesture)
      document.addEventListener('keydown', cancel)
    }
    node.addEventListener('pointerdown', down)
    return {
      update(next: MockDragSource) { source = next },
      destroy() { cleanupGesture(); node.removeEventListener('pointerdown', down) }
    }
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
    cancel?: () => void
    informational?: boolean
    acknowledgement?: string
  } | null>(null)
  // Every dismissal path routes through here so pending copy confirmations resolve.
  const cancelConfirmation = () => {
    const cancel = confirmation?.cancel
    confirmation = null
    cancel?.()
  }
  const acceptConfirmation = () => {
    const confirm = confirmation?.confirm
    confirmation = null
    confirm?.()
  }
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
    maxLines: 35
  }
  const lineHeightPx = Math.round(editorSizing.fontSize * 1.35)
  const maxEditorHeightPx = lineHeightPx * editorSizing.maxLines
  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const clampEditorHeight = (heightPx: number, minLines = editorSizing.minLines): number =>
    Math.min(Math.max(heightPx, lineHeightPx * minLines), maxEditorHeightPx)

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
            document.minLines
          )
      }
    })
    mountedEditors.set(document.id, editor)
    editorFindDecorations.set(document.id, editor.createDecorationsCollection())

    const syncHeight = () => {
      const heightPx = document.fixedHeightPx ??
        clampEditorHeight(Math.ceil(editor.getContentHeight()), document.minLines)
      host.style.height = `${heightPx}px`
      editor.layout({ width: Math.max(1, host.clientWidth), height: heightPx })
    }

    syncHeight()
    const contentSizeDisposable = editor.onDidContentSizeChange(syncHeight)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      document.text = editor.getValue()
      if ('isEdited' in document) markDocumentEdited(document as MockPrompt | MockAttachedNote)
    })

    let isDisposed = false
    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      contentSizeDisposable.dispose()
      contentDisposable.dispose()
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

  const mountMockupMonaco = (node: HTMLElement, document: MockDocument) => {
    // Side effect: mount a real Monaco instance for this mock document and dispose it with the host.
    const destroy = createEditor(node, document)
    return { destroy }
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
      if (event.key === 'Escape') {
        closeTemplateDialog()
        nameDialog = null
        closeManageCategories()
        cancelConfirmation()
        copyError = null
        statusMenuId = null
        splitMenuKey = null
        findOpen = false
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

  const markDocumentEdited = (document: MockPrompt | MockAttachedNote) => {
    document.isEdited = true
    document.modifiedLabel = 'Updated today'
  }

  const finalizedLabel = (prompt: MockPrompt) => {
    const days = Math.floor((Date.now() - (prompt.finalizedAt ?? Date.now())) / 86_400_000)
    return `${prompt.status} ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`
  }

  // Resolves true immediately for active prompts, or after the user accepts the status move.
  const confirmCopyMove = (prompt: MockPrompt) => new Promise<boolean>((resolve) => {
    if (prompt.status !== 'Backlog' && prompt.status !== 'Completed' && prompt.status !== 'Archived') {
      resolve(true)
      return
    }
    confirmation = {
      title: 'Copy Prompt',
      description: `Copying this prompt will move it from ${prompt.status} to In Progress.`,
      submit: 'Copy and Move',
      informational: true,
      confirm: () => resolve(true),
      cancel: () => resolve(false)
    }
  })

  const requestCopyPrompt = async (prompt: MockPrompt, selectedTemplate?: MockTemplate | null) => {
    if (await confirmCopyMove(prompt)) void copyPrompt(prompt, selectedTemplate)
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

  const runAttachedNoteAction = (prompt: MockPrompt) => {
    if (prompt.attachedNote) prompt.attachedNote.visible = !prompt.attachedNote.visible
    else prompt.attachedNote = { id: window.crypto.randomUUID(), modifiedLabel: 'Updated today', visible: true, isEdited: false, text: '' }
  }

  const attachedNoteMoreOptions = (prompt: MockPrompt): DropdownPopupDetailedItem[] => [
    prompt.attachedNote
      ? { id: 'delete', label: 'Delete Note', detail: 'Permanently delete attached note', icon: Trash2 }
      : { id: 'add', label: 'Add Note', detail: 'Add and show an attached note', icon: NotebookPen }
  ]

  const requestAttachedNoteDelete = (prompt: MockPrompt) => {
    if (!prompt.attachedNote?.text.trim()) { prompt.attachedNote = undefined; return }
    confirmation = { title: 'Delete Attached Note', description: 'Are you sure you want to permanently delete this attached note?',
      submit: 'Delete', confirm: () => { prompt.attachedNote = undefined } }
  }

  const setPromptStatus = (prompt: MockPrompt, status: MockPromptStatus) => {
    prompt.status = status
    prompt.finalizedAt = status === 'Completed' || status === 'Archived' ? Date.now() : null
    statusMenuId = null
  }
</script>

{#snippet IconButton(
  Icon: ComponentType,
  label: string,
  options: MockIconButtonOptions = {}
)}
  <button
    type="button"
    class="base-icon-button"
    aria-label={label}
    aria-expanded={options.ariaExpanded}
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
  </button>
{/snippet}

{#snippet SplitIconButton(
  Icon: ComponentType,
  label: string,
  options: MockIconButtonOptions,
  menuKey: string,
  menuItem: MockSplitMenuItem
)}
  <div class="base-split-button">
    {@render IconButton(Icon, label, options)}
    <span class="base-split-separator" aria-hidden="true"></span>
    {@render IconButton(ChevronDown, `${label} More Options`, {
      active: splitMenuKey === menuKey,
      ariaExpanded: splitMenuKey === menuKey,
      onclick: (event) => {
        statusMenuId = null
        splitMenuAnchor = event.currentTarget as HTMLElement
        splitMenuKey = splitMenuKey === menuKey ? null : menuKey
      }
    })}
    {#if splitMenuKey === menuKey && splitMenuAnchor}
      <div class="base-status-menu" role="menu" aria-label={`${label} actions`}
        use:mountMockMenu={{ anchor: splitMenuAnchor, width: 240 }}>
        <button class="base-status-menu-item" type="button" role="menuitem" onclick={() => {
          splitMenuKey = null
          menuItem.onclick()
        }}>
          <span class="base-status-menu-icon" data-action="delete"><menuItem.icon size={18} aria-hidden="true" /></span>
          <span class="base-status-menu-text">
            <span class="base-status-menu-title text-sm leading-4.5">{menuItem.title}</span>
            <span class="base-status-menu-subtitle text-xs">{menuItem.subtitle}</span>
          </span>
        </button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet IconCell(Icon: ComponentType, large = false)}
  <span class="base-icon-cell">
    <Icon size={large ? 32 : 24} strokeWidth={large ? 1.5 : 2} aria-hidden="true" />
  </span>
{/snippet}

{#snippet Separator()}
  <div class="base-separator" role="presentation"></div>
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
        {@render IconButton(prompt.status === 'Backlog' ? CircleDashed : Check,
          prompt.status === 'Backlog' ? 'Set prompt to Todo' : 'Complete prompt', {
            hoverVariant: prompt.status === 'Backlog' ? 'neutral' : 'success',
            onclick: () => setPromptStatus(prompt, prompt.status === 'Backlog' ? MockPromptStatus.Todo : MockPromptStatus.Completed)
          })}
      {/if}
    </div>
    {#if statusMenuId === prompt.id && statusAnchor}
      <div class="base-status-menu" role="menu" aria-label="Change status More Options"
        use:mountMockMenu={{ anchor: statusAnchor, width: 260 }}>
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

{#snippet MonacoBody(document: MockDocument, testId: string)}
  <div
    id={`base-document-${document.id}`}
    class="base-monaco-shell"
    style={`padding:${EDITOR_BODY_PADDING_TOP_PX}px ${EDITOR_BODY_PADDING_RIGHT_PX}px ${document.minLines === 1 ? 8 : EDITOR_BODY_PADDING_BOTTOM_PX}px ${EDITOR_BODY_PADDING_LEFT_PX}px;`}
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
  <div class="base-divider-row" use:mockDropTarget={{ category, afterId, nextCategoryId }}>
    <span class="base-drop-indicator text-sm" aria-hidden="true">Move Here</span>
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from left separator" onclick={() => addPrompt(category, afterId)}>
      {@render Separator()}
    </button>
    <div class="base-divider-actions">
      <button type="button" class="base-divider-action-button text-xs leading-4" aria-label="Add Prompt" onclick={() => addPrompt(category, afterId)}>
        <Plus size={13} aria-hidden="true" />
        <span>Add Prompt</span>
      </button>

    </div>
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from right separator" onclick={() => addPrompt(category, afterId)}>
      {@render Separator()}
    </button>
  </div>
  {:else}
    <div class="base-final-gap">{@render Separator()}</div>
  {/if}
{/snippet}

{#snippet PromptCard(prompt: MockPrompt, index: number, siblingCount: number)}
  {@const archiveDefault = prompt.status !== 'Archived' && Boolean(prompt.title.trim() || prompt.text.trim())}
  {@const titleMatches = getTitleMatches(prompt)}
  <article
    id={`base-card-${prompt.id}`}
    class="base-editor-card base-prompt-card"
    data-testid={`base-mockup-prompt-editor-${prompt.id}`}
    data-prompt-category-id={prompt.categoryId}
  >
    <aside class="base-editor-sidebar">
      {#if !isFinalMode}
      <button type="button" aria-label="Move prompt up" disabled={isFinalMode || index === 0} onclick={() => movePrompt(prompt, -1)}>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      {/if}
      <button type="button" aria-label="Drag prompt" class="base-drag-button" tabindex="-1"
        use:mockDragHandle={{ kind: 'prompt', id: prompt.id, title: prompt.title || 'Untitled prompt' }}>
        <GripVertical size={16} aria-hidden="true" />
      </button>
      {#if !isFinalMode}
      <button type="button" aria-label="Move prompt down" disabled={isFinalMode || index === siblingCount - 1} onclick={() => movePrompt(prompt, 1)}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {/if}
    </aside>

    <div class="base-editor-body">
      <header class="base-prompt-title-area">
        <span class="base-status-indicator" data-status={prompt.status} data-edited={prompt.isEdited} aria-hidden="true"></span>
        <div class="base-prompt-title-main">
          <UiIconCell icon={prompt.kind === 'note' ? NotebookPen : FileText} variant="title" />
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
            <input class="text-sm leading-5" aria-label={prompt.kind === 'note' ? 'Note title' : 'Prompt title'} placeholder={prompt.title.trim() ? 'Title...' : prompt.kind === 'note' ? 'New Note...' : 'New Prompt...'} bind:value={prompt.title}
              oninput={() => markDocumentEdited(prompt)}
              onscroll={(event) => syncTitleHighlightScroll(event.currentTarget)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
                  event.preventDefault()
                  mountedEditors.get(prompt.id)?.focus()
                }
              }} />
            </div>
            <EditorMetadataRow>
              {#if prompt.kind !== 'note'}
              <span
                class="base-template-label"
                data-template-state={prompt.templateState}
                title={prompt.templateLabel}
              >
                <Layers size={12} aria-hidden="true" />
                {prompt.templateLabel}
              </span>
              <UiSeparatorDot />
              {/if}
              <span>{prompt.modifiedLabel}</span>
              <UiSeparatorDot />
              <span>{getTokenCount(prompt.text)} {getTokenCount(prompt.text) === 1 ? 'token' : 'tokens'}</span>
              {#if prompt.finalizedAt}
                <UiSeparatorDot />
                <span title={new Date(prompt.finalizedAt).toLocaleString()}>{finalizedLabel(prompt)}</span>
              {/if}
            </EditorMetadataRow>
          </div>
        </div>

        <div class="base-prompt-actions">
          <IconButtonBar>
            {#if prompt.kind === 'note'}
              <CopyButton
                text={prompt.text}
                label="Copy note"
                hoverVariant="accent"
                onBeforeCopy={() => confirmCopyMove(prompt)}
                onCopied={() => setPromptStatus(prompt, MockPromptStatus.InProgress)}
              />
            {:else if prompt.templateState === 'not-selected'}
              {@render IconButton(Zap, 'Select Template and Copy', {
                onclick: () => openTemplateDialog(prompt, 'select-and-copy')
              })}
            {:else}
              {@render IconButton(copiedPromptId === prompt.id ? ClipboardCheck : Copy, copiedPromptId === prompt.id ? 'Copied' : 'Copy prompt', {
                hoverVariant: 'accent',
                onclick: () => requestCopyPrompt(prompt)
              })}
            {/if}
            {#if prompt.kind !== 'note'}
            {@render IconButton(Layers, 'Set Template', {
              onclick: () => openTemplateDialog(prompt)
            })}
            <UiSplitIconButton
              icon={!prompt.attachedNote ? NotebookPen : prompt.attachedNote.visible ? Eye : EyeOff}
              label={!prompt.attachedNote ? 'Add attached note' : prompt.attachedNote.visible ? 'Hide attached note' : 'Show attached note'}
              title={!prompt.attachedNote ? 'Add attached note' : prompt.attachedNote.visible ? 'Hide attached note' : 'Show attached note'}
              ariaPressed={prompt.attachedNote ? !prompt.attachedNote.visible : undefined}
              moreOptions={attachedNoteMoreOptions(prompt)}
              onclick={() => runAttachedNoteAction(prompt)}
              onselect={(item) => item.id === 'delete' ? requestAttachedNoteDelete(prompt) : runAttachedNoteAction(prompt)}
            />
            {/if}
          </IconButtonBar>
          <span class="base-actions-separator" aria-hidden="true"></span>
          {@render StatusControl(prompt)}
          <span class="base-actions-separator" aria-hidden="true"></span>
          {#if prompt.status === 'Archived'}
            {@render IconButton(Trash2, 'Delete prompt', {
              hoverVariant: 'danger',
              onclick: () => requestPromptDelete(prompt)
            })}
          {:else}
            {@render SplitIconButton(archiveDefault ? Archive : Trash2, archiveDefault ? 'Archive prompt' : 'Delete prompt', {
                hoverVariant: archiveDefault ? 'neutral' : 'danger',
                onclick: () => archiveDefault ? setPromptStatus(prompt, MockPromptStatus.Archived) : requestPromptDelete(prompt)
              }, `${prompt.id}:delete`, archiveDefault
                ? { icon: Trash2, title: 'Delete Prompt', subtitle: 'Permanently delete prompt', onclick: () => requestPromptDelete(prompt) }
                : { icon: Archive, title: 'Archive Prompt', subtitle: 'Move to Archived', onclick: () => setPromptStatus(prompt, MockPromptStatus.Archived) })}
          {/if}
        </div>
      </header>

      {@render Separator()}
      {@render MonacoBody(prompt, `base-mockup-monaco-${prompt.id}`)}
      {#if prompt.attachedNote}
        {@render AttachedNote(prompt, prompt.attachedNote)}
      {/if}
    </div>
  </article>
{/snippet}

{#snippet AttachedNote(prompt: MockPrompt, note: MockAttachedNote)}
  <UiSeparator />
  <button
    type="button"
    class="base-note-header"
    data-hidden={!note.visible}
    data-testid={note.visible ? `base-mockup-attached-note-${prompt.id}` : `base-mockup-attached-note-hidden-${prompt.id}`}
    aria-expanded={note.visible}
    aria-label={note.visible ? 'Hide attached note' : 'Show attached note'}
    onclick={() => note.visible = !note.visible}
  >
    <PromptStatusIndicator isEdited={note.isEdited} testId={`base-mockup-attached-note-indicator-${prompt.id}`}
      class="base-note-indicator" />
    <UiIconCell icon={note.visible ? NotebookPen : EyeOff} variant="small" class="base-note-header-icon" />
    <span class="base-note-header-copy">
      <span class="base-note-header-title text-sm leading-5">Attached Note</span>
      <span class="base-note-header-detail text-xs">{note.visible ? note.modifiedLabel : 'Hidden'}</span>
    </span>
  </button>
  {#if note.visible}
    <UiSeparator />
    {@render MonacoBody(note, `base-mockup-attached-note-monaco-${prompt.id}`)}
  {/if}
{/snippet}

{#snippet CategoryCard(category: MockCategory)}
  <section id={`base-category-${category.id}`} class="base-category-section" data-category-id={category.id} data-testid={`base-mockup-category-${category.id}`}>
    <article class="base-editor-card base-category-card">
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
      {#each visiblePrompts(category.prompts) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, visiblePrompts(category.prompts).length)}
        {@render Divider(category, prompt.id)}
      {/each}
    </div>
    {:else}
      <div class="base-category-children base-collapsed-summary" use:mockDropTarget={{ category }}>
        <span class="base-drop-indicator text-sm" aria-hidden="true">Move Here</span>
        <button type="button" class="text-sm leading-5" onclick={() => category.collapsed = false}>
          {visiblePrompts(category.prompts).length} {visiblePrompts(category.prompts).length === 1 ? 'prompt' : 'prompts'} hidden. Click to expand...
        </button>
      </div>
    {/if}
    <div class="base-category-bottom-cap" aria-hidden="true"></div>
  </section>
{/snippet}

<main class="base-prompt-collection-mockup" data-testid="base-prompt-collection-mockup">
  {#if dragSource}
    <div class="base-drag-ghost text-sm" style={`left:${dragPosition.x}px; top:${dragPosition.y}px;`} aria-hidden="true">
      {#if dragSource.kind === 'category'}<Folder size={16} />{:else}<FileText size={16} />{/if}
      <span>{dragSource.title}</span>
    </div>
  {/if}
  <div class="base-header-bar">
    <div class="base-breadcrumb text-sm">
      <button type="button" onclick={() => viewport?.scrollTo({ top: 0 })}>{rootTitle}</button>
      <span>/</span>
      <button type="button" onclick={() => viewport?.scrollTo({ top: 0 })}>{screenMode}</button>
      {#if breadcrumbCategory}
        <span>/</span>
        <button type="button" onclick={() => {
          const section = document.getElementById(`base-category-${breadcrumbCategory.id}`)
          if (section && viewport) viewport.scrollTop += section.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 80
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
  <div class="base-content-viewport" bind:this={viewport} bind:clientHeight={viewportHeight} onscroll={updateBreadcrumb}>
    <section class="base-root-header">
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
              <span class="base-filter-label">{group} <span class="base-filter-count text-xs leading-4.5">{allPrompts.filter((prompt) => matchesGroup(prompt, group)).length}</span></span>
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
            onclick: () => confirmation = { title: 'Delete Collection',
              description: 'This collection and everything inside it will be permanently deleted, including completed and archived prompts.',
              acknowledgement: 'Yes, I want to delete this collection and all of its contents.',
              submit: 'Delete collection', confirm: () => { rootPrompts = []; categories = [] } }
          })}
        </div>
      </div>
    </section>

    <div class="base-entry-flow">
      {#if isFinalMode}
        {#if finalizedPrompts.length}{@render Divider()}{/if}
        {#each finalizedPrompts as prompt, promptIndex (prompt.id)}
          {@render PromptCard(prompt, promptIndex, finalizedPrompts.length)}
          {@render Divider()}
        {/each}
      {:else}
      {@render Divider(undefined, undefined, !visiblePrompts(rootPrompts).length ? categories[0]?.id : undefined)}
      {#each visiblePrompts(rootPrompts) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, visiblePrompts(rootPrompts).length)}
        {@render Divider(undefined, prompt.id, promptIndex === visiblePrompts(rootPrompts).length - 1 ? categories[0]?.id : undefined)}
      {/each}
      <div class="base-categories-inset">
        {#each categories as category, categoryIndex (category.id)}
          {@render CategoryCard(category)}
          <div class="base-final-gap" use:mockDropTarget={{ categoryOnly: true, nextCategoryId: categories[categoryIndex + 1]?.id ?? null }}>
            <span class="base-drop-indicator text-sm" aria-hidden="true">Move Here</span>
            {@render Separator()}
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
        {@render IconButton(X, 'Close', { onclick: closeManageCategories })}
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
        <button type="button" class="base-dialog-cancel-button text-sm" onclick={closeManageCategories}>Close</button>
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
  <ConfirmationDialog
    open
    title={confirmation.title}
    description={confirmation.description}
    confirmText={confirmation.submit}
    variant={confirmation.informational ? 'informational' : 'destructive'}
    icon={confirmation.informational ? Copy : Trash2}
    closeOnOutsideClick={!confirmation.informational}
    confirmationText={confirmation.acknowledgement}
    oncancel={cancelConfirmation}
    onconfirm={acceptConfirmation}
  />
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

      <div class="base-template-dialog-body">
        <div class="base-no-template-panel">
          <button
            type="button"
            class="base-template-root-option text-sm"
            class:active={templateDialogMode === 'select' && selectedTemplateIds.size === 0}
            aria-pressed={templateDialogMode === 'select'
              ? selectedTemplateIds.size === 0
              : undefined}
            onclick={() => selectTemplate(null)}
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
  .base-prompt-collection-mockup {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    min-width: 0;
    width: 100%;
  }


  button {
    cursor: pointer;
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
    background: transparent;
    border: 0;
    color: inherit;
    min-width: 0;
    padding: 0;
  }

  .base-breadcrumb button:first-child {
    color: var(--ui-muted-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-breadcrumb span {
    color: var(--ui-neutral-emphasis-border);
    padding: 0 12px;
  }

  .base-breadcrumb button:last-child {
    color: var(--ui-hoverable-text);
    white-space: nowrap;
  }

  .base-breadcrumb button:first-child:hover,
  .base-breadcrumb button:last-child:hover {
    color: var(--ui-normal-text);
  }

  .base-content-viewport {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
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

  .base-filter-bar button {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-ghost-surface);
    border-radius: 6px;
    color: var(--ui-hoverable-text);
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

  .base-filter-bar button[aria-pressed='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .base-filter-bar button[aria-pressed='true']:hover,
  .base-filter-bar button[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
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
    align-items: center;
    display: grid;
    grid-template-columns: minmax(14px, 1fr) auto minmax(14px, 1fr);
    height: 28px;
    min-width: 0;
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
    color: var(--ui-muted-icon-glyph);
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
    flex: 1 1 52px;
  }

  .base-editor-sidebar button:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .base-editor-sidebar:focus-within {
    box-shadow: inset 0 0 0 2px var(--ui-neutral-focus-border);
  }

  .base-editor-sidebar button:not(.base-drag-button) :global(svg) {
    opacity: 0;
    transition: opacity var(--ui-animation-duration-fast) ease-out;
  }

  .base-editor-sidebar:hover button,
  .base-editor-sidebar:focus-within button {
    border-bottom-color: var(--ui-neutral-normal-border);
  }

  .base-editor-sidebar:hover button:not(.base-drag-button) :global(svg),
  .base-editor-sidebar:focus-within button:not(.base-drag-button) :global(svg) {
    opacity: 1;
  }

  .base-editor-sidebar button:hover,
  .base-editor-sidebar button:focus-visible,
  .base-category-sidebar button:hover,
  .base-category-sidebar button:focus-visible {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
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

  .base-note-header {
    position: relative;
    height: 36px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    /* The 18px small icon cell centers its 16px glyph, so trim 1px each side to keep the glyph and title in place. */
    gap: 9px;
    min-width: 0;
    padding: 0 12px 0 21px;
    background: var(--ui-card-normal-surface);
    border: 0;
    color: var(--ui-muted-text);
    text-align: left;
    cursor: pointer;
  }

  .base-note-header :global(.base-note-header-icon) { flex: 0 0 auto; color: var(--ui-normal-text); }
  .base-note-header-copy { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
  .base-note-header-title { color: var(--ui-normal-text); font-weight: var(--font-weight-semibold); white-space: nowrap; }
  .base-note-header-detail { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .base-note-header[data-hidden='true'] :global(.base-note-header-icon) { color: var(--ui-muted-icon-glyph); }
  .base-note-header[data-hidden='true'] .base-note-header-title { color: var(--ui-secondary-text); font-weight: inherit; }
  .base-note-header[data-hidden='true']:hover :global(.base-note-header-icon),
  .base-note-header[data-hidden='true']:focus-visible :global(.base-note-header-icon) { color: var(--ui-hoverable-icon-glyph); }
  .base-note-header[data-hidden='true']:hover .base-note-header-title,
  .base-note-header[data-hidden='true']:focus-visible .base-note-header-title { color: var(--ui-hoverable-text); }

  .base-note-header :global(.base-note-indicator) {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
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
    color: var(--ui-secondary-icon-glyph);
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
    border-top-right-radius: 0;
  }

  .base-status-segmented[data-leading-action='true'] > .base-status-selector {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    margin-left: -1px;
  }

  .base-status-segmented[data-trailing-action='true'] > .base-status-selector {
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }

  .base-status-segmented[data-trailing-action='true'] > .base-icon-button:last-child {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    margin-left: -1px;
  }

  .base-status-segmented[data-leading-action='true']
    > .base-icon-button:first-child:not(:hover):not(:focus-visible) {
    border-right-color: transparent;
  }

  .base-status-segmented[data-trailing-action='true']
    > .base-icon-button:last-child:not(:hover):not(:focus-visible) {
    border-left-color: transparent;
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

  .base-split-button {
    position: relative;
    align-items: center;
    display: flex;
    flex: 0 0 auto;
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

  .base-template-root-option:hover,
  .base-template-option-button:hover,
  .base-template-category-button:hover {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .base-template-root-option.active,
  .base-template-option-button.active {
    background: var(--ui-accent-action-fill);
    color: var(--ui-normal-text);
  }

  .base-template-root-option.active {
    border-color: var(--ui-accent-muted-border);
  }

  .base-template-root-option.active:hover,
  .base-template-option-button.active:hover {
    background: var(--ui-accent-action-hover-fill);
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
  .base-collapsed-summary button:hover { color: var(--ui-hoverable-text); }
  .base-drop-indicator {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    pointer-events: none;
  }
  .base-drop-indicator::before,
  .base-drop-indicator::after { content: ''; height: 10px; border-radius: 999px; background: var(--ui-info-strong-border); flex: 1; }
  .base-divider-row:global([data-drop-over='true']) > :not(.base-drop-indicator),
  .base-final-gap:global([data-drop-over='true']) > :not(.base-drop-indicator),
  .base-collapsed-summary:global([data-drop-over='true']) > :not(.base-drop-indicator) { visibility: hidden; }
  .base-divider-row:global([data-drop-over='true']) > .base-drop-indicator,
  .base-final-gap:global([data-drop-over='true']) > .base-drop-indicator,
  .base-collapsed-summary:global([data-drop-over='true']) > .base-drop-indicator { display: flex; }
  .base-drag-ghost {
    position: fixed;
    z-index: 80;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 320px;
    padding: 8px 12px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-card-overlay-surface);
    color: var(--ui-normal-text);
    box-shadow: 0 4px 12px var(--ui-card-normal-shadow);
  }
  .base-drag-ghost span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
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
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px;
    position: fixed;
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
    background: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    outline: 1px solid var(--ui-neutral-normal-border);
    overflow: hidden;
  }
  .base-split-button > .base-icon-button {
    border: 0;
    border-radius: 0;
    box-sizing: content-box;
  }
  .base-split-button > .base-icon-button:last-of-type { width: 23px; }
  .base-split-separator {
    align-self: stretch;
    border-left: 1px solid var(--ui-neutral-normal-border);
    flex: 0 0 1px;
  }
  .base-status-segmented[data-status='Todo'] .base-status-value-content :global(svg),
  .base-status-segmented[data-status='Backlog'] .base-status-value-content :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }
</style>
