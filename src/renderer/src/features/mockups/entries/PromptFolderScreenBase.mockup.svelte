<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    AlertCircle,
    Ban,
    Check,
    Archive,
    Bookmark,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    CircleDashed,
    Copy,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    GripVertical,
    Layers,
    Pencil,
    Play,
    Plus,
    Search,
    Settings,
    Trash2,
    Undo2,
    Zap,
    X
  } from 'lucide-svelte'
  import * as monaco from 'monaco-editor'

  // Deliberately local: this visual sandbox only shares Svelte, icons, Monaco, and palette tokens.
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
    { id: MockPromptStatus.Backlog, label: 'Backlog', detail: 'Save this prompt for future work', icon: Bookmark },
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
        deleteMenuId = null
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
  let deleteAnchor = $state<HTMLElement | null>(null)
  let statusAnchor = $state<HTMLElement | null>(null)
  const toggleStatusMenu = (prompt: MockPrompt, event: MouseEvent) => {
    deleteMenuId = null
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
    size?: 'default' | 'compact' | 'tiny' | 'sidebar-rail'
    testId?: string
  }

  type MockDocument = {
    id: string
    minLines?: number
    text: string
  }

  type MockPrompt = MockDocument & {
    title: string
    folderId: string
    templateLabel: string
    modifiedLabel: string
    status: MockPromptStatus
    templateIds: string[]
    templateState: 'not-selected' | 'no-template' | 'selected'
  }

  type MockTemplate = {
    id: string
    title: string
  }

  type MockTemplateFolder = {
    id: string
    title: string
    templates: MockTemplate[]
    children: MockTemplateFolder[]
  }

  type MockFolderSetting = MockDocument & {
    title: string
    description: string
    isPresent: boolean
  }

  type MockFolder = {
    id: string
    title: string
    settings: MockFolderSetting[]
    prompts: MockPrompt[]
    collapsed?: boolean
    settingsHidden?: boolean
  }

  const createSettings = (folderId: string, description: string): MockFolderSetting[] => [
    {
      id: `${folderId}-description`,
      title: 'Category Description',
      description:
        'A general description of this category and the types of prompts that are within it. For informational use only.',
      isPresent: true,
      minLines: 1,
      text: description
    }
  ]

  const createPrompt = (
    id: string,
    title: string,
    folderId: string,
    templateLabel: string,
    text: string,
    status: MockPromptStatus = MockPromptStatus.Todo
  ): MockPrompt => ({
    id,
    title,
    folderId,
    templateLabel,
    modifiedLabel: 'Updated today',
    status,
    templateIds:
      templateLabel === 'Draft Implementation Plan' ? ['draft-implementation-plan'] : [],
    templateState:
      templateLabel === TEMPLATE_NOT_SELECTED_LABEL
        ? 'not-selected'
        : templateLabel === NO_TEMPLATE_LABEL
          ? 'no-template'
          : 'selected',
    text
  })

  const templateFolders: MockTemplateFolder[] = [
    {
      id: 'product-templates',
      title: 'Product Templates',
      templates: [
        { id: 'turn-notes-into-requirements', title: 'Turn Notes into Requirements' },
        { id: 'draft-implementation-plan', title: 'Draft Implementation Plan' }
      ],
      children: [
        {
          id: 'implementation-templates',
          title: 'Implementation',
          templates: [
            { id: 'implement-approved-change', title: 'Implement Approved Change' },
            { id: 'add-regression-coverage', title: 'Add Regression Coverage' }
          ],
          children: []
        }
      ]
    },
    {
      id: 'review-templates',
      title: 'Review Templates',
      templates: [{ id: 'review-completed-change', title: 'Review Completed Change' }],
      children: [
        {
          id: 'handoff-templates',
          title: 'Handoff',
          templates: [
            { id: 'prepare-final-handoff', title: 'Prepare Final Handoff' },
            { id: 'update-developer-docs', title: 'Update Developer Documentation' }
          ],
          children: []
        }
      ]
    }
  ]

  const getTemplateCount = (folder: MockTemplateFolder): number =>
    folder.templates.length +
    folder.children.reduce((count, child) => count + getTemplateCount(child), 0)

  const getTemplates = (folder: MockTemplateFolder): MockTemplate[] => [
    ...folder.templates,
    ...folder.children.flatMap(getTemplates)
  ]

  const collapsedTemplateFolderIds = new SvelteSet<string>()
  const selectedTemplateIds = new SvelteSet<string>()
  let templateDialogPrompt = $state<MockPrompt | null>(null)
  let templateDialogMode = $state<'select' | 'select-and-copy'>('select')

  const openTemplateDialog = (
    prompt: MockPrompt,
    mode: 'select' | 'select-and-copy' = 'select'
  ) => {
    templateDialogPrompt = prompt
    templateDialogMode = mode
    collapsedTemplateFolderIds.clear()
    selectedTemplateIds.clear()
    if (mode === 'select') {
      const selectedTemplateId = prompt.templateIds[0]
      if (selectedTemplateId) selectedTemplateIds.add(selectedTemplateId)
    }
  }

  const closeTemplateDialog = () => {
    templateDialogPrompt = null
  }

  const handleTemplateDialogLayerClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) closeTemplateDialog()
  }

  const selectTemplate = (template: MockTemplate | null) => {
    if (!templateDialogPrompt) return

    if (templateDialogMode === 'select-and-copy') {
      templateDialogPrompt.templateIds = template ? [template.id] : []
      templateDialogPrompt.templateLabel = template?.title ?? NO_TEMPLATE_LABEL
      templateDialogPrompt.templateState = template ? 'selected' : 'no-template'
      void copyPrompt(templateDialogPrompt)
      closeTemplateDialog()
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
    const selectedTemplates = templateFolders
      .flatMap(getTemplates)
      .filter((template) => selectedTemplateIds.has(template.id))

    templateDialogPrompt.templateIds = selectedTemplates.map((template) => template.id)
    templateDialogPrompt.templateLabel = selectedTemplates.length
      ? selectedTemplates.map((template) => template.title).join(', ')
      : NO_TEMPLATE_LABEL
    templateDialogPrompt.templateState = selectedTemplates.length ? 'selected' : 'no-template'
    if (templateDialogPrompt.status === 'Todo') templateDialogPrompt.status = MockPromptStatus.InProgress
    closeTemplateDialog()
  }

  const toggleTemplateFolder = (folderId: string) => {
    if (collapsedTemplateFolderIds.has(folderId)) collapsedTemplateFolderIds.delete(folderId)
    else collapsedTemplateFolderIds.add(folderId)
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
      MockPromptStatus.InProgress
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
      ].join('\n')
    ),
    createPrompt(
      'base-plan',
      'Draft an implementation plan',
      'base-root',
      'Draft Implementation Plan',
      [
        'Create an implementation plan grounded in the current repository.',
        '',
        'Include the files to change and the focused verification for each step.'
      ].join('\n')
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
      ].join('\n')
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
      ].join('\n')
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
      ].join('\n')
    )
  ])

  let subfolders = $state<MockFolder[]>([
    {
      id: 'base-implementation',
      title: 'Implementation',
      settings: createSettings(
        'base-implementation',
        'Prompts used while implementing an approved product change.'
      ),
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
      settings: createSettings('base-verification', 'Prompts for validating product behavior.'),
      prompts: [createPrompt('base-regression', 'Add focused regression coverage',
        'base-verification', NO_TEMPLATE_LABEL, 'Assert the visible user flow before implementation details.')]
    }
  ])

  const groups = ['Active', 'Backlog', 'Completed', 'Archived'] as const
  let screenMode = $state<(typeof groups)[number]>('Active')
  let rootTitle = $state('Product Work')
  let statusMenuId = $state<string | null>(null)
  let deleteMenuId = $state<string | null>(null)
  let findOpen = $state(false)
  let findQuery = $state('')
  let findIndex = $state(0)
  const isFinalMode = $derived(screenMode === 'Completed' || screenMode === 'Archived')
  const allPrompts = $derived([...rootPrompts, ...subfolders.flatMap((folder) => folder.prompts)])
  const matchesGroup = (prompt: MockPrompt, group = screenMode) => group === 'Active'
    ? prompt.status === MockPromptStatus.Todo || prompt.status === MockPromptStatus.InProgress
    : prompt.status === group
  const findMatches = $derived(allPrompts.filter((prompt) => matchesGroup(prompt) && findQuery.length > 0 &&
    `${prompt.title}\n${prompt.text}`.toLowerCase().includes(findQuery.toLowerCase())))
  const revealFindMatch = (direction: number) => {
    if (!findMatches.length) return
    findIndex = (findIndex + direction + findMatches.length) % findMatches.length
    const prompt = findMatches[findIndex]
    const folder = subfolders.find((item) => item.id === prompt.folderId)
    if (folder) folder.collapsed = false
    window.requestAnimationFrame(() => document.getElementById(`base-card-${prompt.id}`)?.scrollIntoView({ block: 'center' }))
  }
  const visiblePrompts = (prompts: MockPrompt[]) => prompts.filter((prompt) => matchesGroup(prompt))
  const removePrompt = (prompt: MockPrompt) => {
    rootPrompts = rootPrompts.filter((item) => item.id !== prompt.id)
    for (const folder of subfolders) folder.prompts = folder.prompts.filter((item) => item.id !== prompt.id)
    deleteMenuId = null
  }
  const requestPromptDelete = (prompt: MockPrompt) => {
    if (!prompt.title.trim() && !prompt.text.trim()) { removePrompt(prompt); return }
    confirmation = { title: 'Delete Prompt', description: 'Are you sure you want to delete this prompt?',
      submit: 'Delete', confirm: () => removePrompt(prompt) }
  }
  const addPrompt = (folder?: MockFolder, afterId?: string) => {
    const prompts = folder ? folder.prompts : rootPrompts
    const prompt = createPrompt(window.crypto.randomUUID(), '', folder?.id ?? 'base-root', TEMPLATE_NOT_SELECTED_LABEL, '',
      screenMode === 'Backlog' ? MockPromptStatus.Backlog : MockPromptStatus.Todo)
    prompts.splice(afterId ? prompts.findIndex((item) => item.id === afterId) + 1 : 0, 0, prompt)
  }
  const movePrompt = (prompt: MockPrompt, direction: number) => {
    const prompts = subfolders.find((folder) => folder.id === prompt.folderId)?.prompts ?? rootPrompts
    const visible = visiblePrompts(prompts)
    const target = visible[visible.indexOf(prompt) + direction]
    if (!target) return
    const index = prompts.indexOf(prompt)
    const targetIndex = prompts.indexOf(target)
    prompts.splice(index, 1)
    prompts.splice(targetIndex, 0, prompt)
  }
  let nameDialog = $state<{ title: string; value: string; categoryId?: string; save: (value: string) => void } | null>(null)
  let nameInteracted = $state(false)
  let nameInput = $state<HTMLInputElement | null>(null)
  const isFolderName = $derived(nameDialog?.title === 'Rename Prompt Folder')
  const nameLabel = $derived(isFolderName ? 'Prompt Folder Name' : 'Category Name')
  const nameError = $derived(!nameDialog?.value.trim()
    ? `${isFolderName ? 'Folder' : 'Category'} name is required`
    : !isFolderName && subfolders.some((folder) => folder.id !== nameDialog?.categoryId &&
      folder.title.trim().toLocaleLowerCase() === nameDialog?.value.trim().toLocaleLowerCase())
      ? 'A category with this name already exists' : null)
  const nameDisabled = $derived(Boolean(nameError) || (isFolderName && nameDialog?.value.trim() === rootTitle))
  let confirmation = $state<{ title: string; description: string; submit: string; confirm: () => void } | null>(null)

  // Side effect: focus and select the local name field each time its dialog mounts.
  $effect(() => {
    if (!nameInput) return
    nameInteracted = false
    nameInput.focus()
    nameInput.select()
  })

  // Side effect: portal local overlays beyond the mockup's containing block.
  const mountMockDialog = (node: HTMLElement) => {
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.appendChild(node)
    return { destroy: () => { node.remove(); previousFocus?.focus() } }
  }
  const addCategory = () => {
    nameDialog = { title: 'Create Category', value: '', save: (title) => {
      subfolders.push({ id: window.crypto.randomUUID(), title, settings: createSettings(window.crypto.randomUUID(), ''), prompts: [] })
    } }
  }

  const EDITOR_BODY_PADDING_TOP_PX = 8
  const EDITOR_BODY_PADDING_RIGHT_PX = 10
  const EDITOR_BODY_PADDING_BOTTOM_PX = 10
  const EDITOR_BODY_PADDING_LEFT_PX = 10
  const editorSizing = {
    fontSize: 15,
    minLines: 3,
    maxLines: 10
  }
  const lineHeightPx = Math.round(editorSizing.fontSize * 1.35)
  const maxEditorHeightPx = lineHeightPx * editorSizing.maxLines
  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const clampEditorHeight = (heightPx: number, minLines = editorSizing.minLines): number =>
    Math.min(Math.max(heightPx, lineHeightPx * minLines), maxEditorHeightPx)

  const getTokenCount = (text: string): number => {
    const trimmed = text.trim()
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  }

  const getEditorUri = (documentId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/prompt-folder-base/${documentId}.md`)

  const createEditor = (host: HTMLElement, document: MockDocument) => {
    const modelUri = getEditorUri(document.id)
    const existingModel = monaco.editor.getModel(modelUri)
    const model = existingModel ?? monaco.editor.createModel(document.text, 'markdown', modelUri)
    model.setValue(document.text)

    const editor = monaco.editor.create(host, {
      model,
      automaticLayout: true,
      ariaLabel: `${document.id} editor`,
      fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: editorSizing.fontSize,
      lineHeight: lineHeightPx,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      minimap: { enabled: false },
      renderLineHighlightOnlyWhenFocus: true,
      renderValidationDecorations: 'off',
      revealHorizontalRightPadding: 0,
      scrollBeyondLastLine: false,
      scrollbar: { alwaysConsumeMouseWheel: false },
      smoothScrolling: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      dimension: {
        width: Math.max(1, host.clientWidth),
        height: clampEditorHeight(
          lineHeightPx * Math.max(1, document.text.split('\n').length),
          document.minLines
        )
      }
    })

    const syncHeight = () => {
      const heightPx = clampEditorHeight(Math.ceil(editor.getContentHeight()), document.minLines)
      host.style.height = `${heightPx}px`
      editor.layout({ width: Math.max(1, host.clientWidth), height: heightPx })
    }

    syncHeight()
    const contentSizeDisposable = editor.onDidContentSizeChange(syncHeight)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      document.text = editor.getValue()
    })

    let isDisposed = false
    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      contentSizeDisposable.dispose()
      contentDisposable.dispose()
      editor.dispose()
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
  })

  // Side effect: handle sandbox find and dismiss open mock dialogs and menus; remove the listener on unmount.
  $effect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTemplateDialog()
        nameDialog = null
        confirmation = null
        statusMenuId = null
        deleteMenuId = null
        findOpen = false
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        findOpen = true
      }
    }
    document.addEventListener('keydown', handleKeydown)

    return () => document.removeEventListener('keydown', handleKeydown)
  })

  const copyPrompt = async (prompt: MockPrompt) => {
    await window.navigator.clipboard.writeText(prompt.text)
    if (prompt.status === 'Todo') prompt.status = MockPromptStatus.InProgress
  }

  const setPromptStatus = (prompt: MockPrompt, status: MockPromptStatus) => {
    prompt.status = status
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
        (options.size === undefined || options.size === 'default'
          ? 20
          : options.size === 'tiny'
            ? 14
            : 16)}
      aria-hidden="true"
    />
  </button>
{/snippet}

{#snippet IconCell(Icon: ComponentType)}
  <span class="base-icon-cell">
    <Icon size={24} aria-hidden="true" />
  </span>
{/snippet}

{#snippet Separator()}
  <div class="base-separator" role="presentation"></div>
{/snippet}

{#snippet SeparatorDot()}
  <span class="base-separator-dot" aria-hidden="true"></span>
{/snippet}

{#snippet TemplateFolderRows(folder: MockTemplateFolder, indentCount: number)}
  {@const isExpanded = !collapsedTemplateFolderIds.has(folder.id)}
  <div class="base-template-folder-row">
    <button
      type="button"
      class="base-template-folder-button text-sm"
      style={`--base-template-indent-count:${indentCount};`}
      aria-expanded={isExpanded}
      onclick={() => toggleTemplateFolder(folder.id)}
    >
      <span class="base-template-chevron" data-expanded={isExpanded ? 'true' : 'false'}>
        <ChevronRight size={20} aria-hidden="true" />
      </span>
      <Folder size={16} aria-hidden="true" />
      <span>{folder.title}</span>
    </button>
  </div>

  {#if isExpanded}
    {#each folder.templates as template (template.id)}
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
    {#each folder.children as child (child.id)}
      {@render TemplateFolderRows(child, indentCount + 1)}
    {/each}
  {/if}
{/snippet}

{#snippet StatusControl(prompt: MockPrompt)}
  {@const isActive = prompt.status === 'Todo' || prompt.status === 'InProgress'}
  {@const hasBackward = isActive || prompt.status === 'Completed'}
  {@const hasForward = isActive || prompt.status === 'Backlog'}
  {@const StatusIcon = prompt.status === 'Completed' ? Check : prompt.status === 'Archived' ? Archive : prompt.status === 'Backlog' ? Bookmark : prompt.status === 'InProgress' ? Play : CircleDashed}
  <div class="base-status-control">
    <div class="base-status-segmented" data-status={prompt.status}
      data-leading-action={hasBackward ? 'true' : 'false'} data-trailing-action={hasForward ? 'true' : 'false'}>
      {#if hasBackward}
        {@render IconButton(prompt.status === 'Todo' ? Bookmark : Undo2,
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
              <span class="base-status-menu-title text-sm">{item.label}</span>
              <span class="base-status-menu-subtitle text-xs" title={item.detail}>{item.detail}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet SettingsToggle(setting: MockFolderSetting)}
  <button
    type="button"
    class="base-settings-toggle text-sm"
    aria-pressed={setting.isPresent}
    title={`${setting.isPresent ? 'Remove' : 'Add'} ${setting.title.toLowerCase()}`}
    onclick={() => {
      if (setting.isPresent) confirmation = {
        title: 'Delete Category Description', description: 'Are you sure you want to delete this category description?',
        submit: 'Delete', confirm: () => { setting.isPresent = false; setting.text = '' }
      }
      else setting.isPresent = true
    }}
  >
    <span class="base-settings-toggle-default-icon">
      {#if setting.isPresent}
        <Check size={16} aria-hidden="true" />
      {:else}
        <Plus size={16} aria-hidden="true" />
      {/if}
    </span>
    {#if setting.isPresent}
      <span class="base-settings-toggle-remove-icon">
        <Trash2 size={16} aria-hidden="true" />
      </span>
    {/if}
    <span>{setting.title.replace('Category Description', 'Description').replace('Prompt Folder ', '')}</span>
  </button>
{/snippet}

{#snippet MonacoBody(document: MockDocument, testId: string)}
  <div
    class="base-monaco-shell"
    style={`padding:${EDITOR_BODY_PADDING_TOP_PX}px ${EDITOR_BODY_PADDING_RIGHT_PX}px ${EDITOR_BODY_PADDING_BOTTOM_PX}px ${EDITOR_BODY_PADDING_LEFT_PX}px;`}
  >
    <div
      class="base-monaco-host"
      data-testid={testId}
      use:mountMockupMonaco={document}
    ></div>
  </div>
{/snippet}

{#snippet Divider(folder?: MockFolder, afterId?: string)}
  {#if !isFinalMode}
  <div class="base-divider-row">
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from left separator" onclick={() => addPrompt(folder, afterId)}>
      {@render Separator()}
    </button>
    <div class="base-divider-actions">
      <button type="button" class="base-divider-action-button text-xs" aria-label="Add Prompt" onclick={() => addPrompt(folder, afterId)}>
        <Plus size={13} aria-hidden="true" />
        <span>Add Prompt</span>
      </button>

    </div>
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from right separator" onclick={() => addPrompt(folder, afterId)}>
      {@render Separator()}
    </button>
  </div>
  {:else}
    <div class="base-final-gap"></div>
  {/if}
{/snippet}

{#snippet PromptCard(prompt: MockPrompt, index: number, siblingCount: number)}
  {@const archiveDefault = prompt.status !== 'Archived' && Boolean(prompt.title.trim() || prompt.text.trim())}
  <article
    id={`base-card-${prompt.id}`}
    class="base-editor-card base-prompt-card"
    data-testid={`base-mockup-prompt-editor-${prompt.id}`}
    data-prompt-folder-id={prompt.folderId}
  >
    <aside class="base-editor-sidebar">
      {#if !isFinalMode}
      <button type="button" aria-label="Move prompt up" disabled={isFinalMode || index === 0} onclick={() => movePrompt(prompt, -1)}>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Drag prompt" class="base-drag-button">
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Move prompt down" disabled={isFinalMode || index === siblingCount - 1} onclick={() => movePrompt(prompt, 1)}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {/if}
    </aside>

    <div class="base-editor-body">
      <header class="base-prompt-title-area">
        <span class="base-status-indicator" data-status={prompt.status} aria-hidden="true"></span>
        <div class="base-prompt-title-main">
          {@render IconCell(FileText)}
          <div class="base-title-copy">
            <input class="text-sm" aria-label="Prompt title" bind:value={prompt.title} />
            <div class="base-metadata-row text-xs">
              <span
                class="base-folder-label"
                data-template-state={prompt.templateState}
                title={prompt.templateLabel}
              >
                <Layers size={12} aria-hidden="true" />
                {prompt.templateLabel}
              </span>
              {@render SeparatorDot()}
              <span>{prompt.modifiedLabel}</span>
              {@render SeparatorDot()}
              <span>{getTokenCount(prompt.text)} tokens</span>
            </div>
          </div>
        </div>

        <div class="base-prompt-actions">
          <div class="base-icon-button-bar">
            {#if prompt.status !== 'Backlog'}
            {#if prompt.templateState === 'not-selected'}
              {@render IconButton(Zap, 'Select Template and Copy', {
                onclick: () => openTemplateDialog(prompt, 'select-and-copy')
              })}
            {:else}
              {@render IconButton(Copy, 'Copy prompt', {
                hoverVariant: 'accent',
                onclick: () => { void copyPrompt(prompt) }
              })}
            {/if}
            {/if}
            {@render IconButton(Layers, 'Set Template', {
              onclick: () => openTemplateDialog(prompt)
            })}
          </div>
          <span class="base-actions-separator" aria-hidden="true"></span>
          {@render StatusControl(prompt)}
          <span class="base-actions-separator" aria-hidden="true"></span>
          <div class="base-prompt-delete-section" data-split={prompt.status !== 'Archived' ? 'true' : 'false'}>
            {@render IconButton(archiveDefault ? Archive : Trash2, archiveDefault ? 'Archive prompt' : 'Delete prompt', {
              hoverVariant: archiveDefault ? 'neutral' : 'danger',
              onclick: () => archiveDefault ? setPromptStatus(prompt, MockPromptStatus.Archived) : requestPromptDelete(prompt)
            })}
            {#if prompt.status !== 'Archived'}
              <span class="base-delete-separator" aria-hidden="true"></span>
              {@render IconButton(ChevronDown, `${archiveDefault ? 'Archive prompt' : 'Delete prompt'} More Options`, {
                active: deleteMenuId === prompt.id,
                ariaExpanded: deleteMenuId === prompt.id,
                onclick: (event) => {
                  statusMenuId = null
                  deleteAnchor = event.currentTarget as HTMLElement
                  deleteMenuId = deleteMenuId === prompt.id ? null : prompt.id
                }
              })}
              {#if deleteMenuId === prompt.id && deleteAnchor}
                <div class="base-status-menu" role="menu" aria-label="Prompt actions"
                  use:mountMockMenu={{ anchor: deleteAnchor, width: 240 }}>
                  <button class="base-status-menu-item" type="button" role="menuitem" onclick={() => {
                    deleteMenuId = null
                    if (archiveDefault) requestPromptDelete(prompt)
                    else setPromptStatus(prompt, MockPromptStatus.Archived)
                  }}>
                    <span class="base-status-menu-icon" data-action="delete">
                      {#if archiveDefault}<Trash2 size={18} aria-hidden="true" />{:else}<Archive size={18} aria-hidden="true" />{/if}
                    </span>
                    <span class="base-status-menu-text">
                      <span class="base-status-menu-title text-sm">{archiveDefault ? 'Delete Prompt' : 'Archive Prompt'}</span>
                      <span class="base-status-menu-subtitle text-xs">{archiveDefault ? 'Permanently delete this prompt' : 'Move this prompt to Archived'}</span>
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
    </div>
  </article>
{/snippet}

{#snippet FolderCard(folder: MockFolder)}
  <section class="base-folder-section" data-testid={`base-mockup-subfolder-${folder.id}`}>
    <article class="base-editor-card base-folder-card">
      <aside class="base-folder-sidebar">
        {#if !isFinalMode}
        <button type="button" aria-label="Drag category" title="Drag category">
          <GripVertical size={16} aria-hidden="true" />
        </button>
        {/if}
      </aside>

      <div class="base-editor-body">
        <header class="base-folder-title-bar" aria-expanded={!folder.collapsed}>
          <div class="base-folder-title-main">
            <button class="base-folder-chevron" type="button" aria-label={folder.collapsed ? 'Expand category prompts' : 'Collapse category prompts'} aria-expanded={!folder.collapsed} onclick={() => folder.collapsed = !folder.collapsed}>
              <ChevronRight size={24} aria-hidden="true" />
            </button>
            {@render IconCell(Folder)}
            <div class="base-folder-title-copy">
              <div class="base-folder-title-line">
                <span class="base-folder-title text-base" title={folder.title}>{folder.title}</span>
                {#if !isFinalMode}
                {@render IconButton(Pencil, 'Rename category', {
                  onclick: () => nameDialog = { title: 'Rename Category', value: folder.title, categoryId: folder.id, save: (value) => folder.title = value },
                  size: 'tiny',
                  baseVariant: 'muted',
                  hoverVariant: 'glyph'
                })}
                {/if}
              </div>
              <div class="base-metadata-row text-xs">
                <span>{visiblePrompts(folder.prompts).length} {visiblePrompts(folder.prompts).length === 1 ? 'prompt' : 'prompts'}</span>
              </div>
            </div>
          </div>

          <div class="base-folder-actions">
            <div class="base-icon-button-bar">
              {#if !isFinalMode}
                {@render IconButton(Settings, folder.settingsHidden ? 'Show category settings' : 'Hide category settings', {
                  hoverVariant: 'accent', active: !folder.settingsHidden, ariaPressed: !folder.settingsHidden,
                  onclick: () => folder.settingsHidden = !folder.settingsHidden
                })}
                {@render IconButton(Trash2, 'Delete category', { hoverVariant: 'danger',
                  onclick: () => confirmation = { title: 'Delete Category',
                    description: `Are you sure you want to delete “${folder.title}”? Its contents will move to Uncategorized.`,
                    submit: 'Delete Category', confirm: () => {
                      for (const prompt of folder.prompts) prompt.folderId = 'base-root'
                      rootPrompts.push(...folder.prompts)
                      subfolders = subfolders.filter((item) => item.id !== folder.id)
                    } }
                })}
              {/if}
            </div>
          </div>
        </header>

        {#if !folder.settingsHidden && !isFinalMode}
        {@render Separator()}
        <div class="base-folder-settings">
          <div class="base-settings-toolbar">
            <div class="base-settings-toolbar-heading text-sm">
              <Settings size={20} aria-hidden="true" />
              <div class="base-settings-toolbar-copy">
                <span>Category Settings</span>
                <span>{folder.settings.filter((setting) => setting.isPresent).length} of {folder.settings.length} configured</span>
              </div>
            </div>
            <div class="base-settings-toolbar-actions" role="group" aria-label="Category settings">
              {#each folder.settings as setting (setting.id)}
                {@render SettingsToggle(setting)}
              {/each}
            </div>
          </div>

          {#if folder.settings.some((setting) => setting.isPresent)}
            {@render Separator()}
          {/if}

          <div class="base-folder-settings-sections">
            {#each folder.settings.filter((setting) => setting.isPresent) as setting, settingIndex (setting.id)}
              <section
                class="base-settings-section"
                class:withTopBorder={settingIndex > 0}
                data-testid={`base-mockup-settings-section-${setting.id}`}
              >
                <header class="text-xs">
                  <div class="base-settings-copy">
                    <span>{setting.title}</span>
                    <span>- {setting.description}</span>
                  </div>
                </header>
                {@render Separator()}
                {@render MonacoBody(setting, `base-mockup-monaco-${setting.id}`)}
              </section>
            {/each}
          </div>
        </div>
        {/if}
      </div>
    </article>

    {#if !folder.collapsed}
    <div class="base-folder-children">
      {@render Divider(folder)}
      {#each visiblePrompts(folder.prompts) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, visiblePrompts(folder.prompts).length)}
        {@render Divider(folder, prompt.id)}
      {/each}
    </div>
    {/if}
    <div class="base-folder-bottom-cap" aria-hidden="true"></div>
  </section>
{/snippet}

<main class="base-prompt-folder-mockup" data-testid="base-prompt-folder-mockup">
  <div class="base-header-bar">
    <div class="base-breadcrumb text-sm">
      <button type="button">{rootTitle}</button>
      <span>/</span>
      <button type="button">{screenMode}</button>
    </div>
    {@render IconButton(Search, 'Find in Folder (Control + F)', { size: 'compact', onclick: () => findOpen = !findOpen })}
  </div>

  {#if findOpen}
    <div class="base-find-widget" role="search" aria-label="Find in Folder">
      <input aria-label="Find" placeholder="Find" bind:value={findQuery} oninput={() => findIndex = 0}
        onkeydown={(event) => { if (event.key === 'Enter') revealFindMatch(event.shiftKey ? -1 : 1) }} />
      <span>{findMatches.length ? `${findIndex + 1} of ${findMatches.length}` : 'No results'}</span>
      {@render IconButton(ChevronUp, 'Previous match', { size: 'compact', disabled: !findMatches.length, onclick: () => revealFindMatch(-1) })}
      {@render IconButton(ChevronDown, 'Next match', { size: 'compact', disabled: !findMatches.length, onclick: () => revealFindMatch(1) })}
      {@render IconButton(X, 'Close find', { size: 'compact', onclick: () => findOpen = false })}
    </div>
  {/if}
  <div class="base-content-viewport">
    <section class="base-root-header">
      <div class="base-root-title-row">
        <div class="base-root-title-block">
          <div class="base-root-eyebrow text-xs">
            <Folder size={14} aria-hidden="true" />
            <span>Prompt Folder</span>
          </div>
          <div class="base-root-title-line">
            <h1>{rootTitle}</h1>
            {@render IconButton(Pencil, 'Rename prompt folder', {
              onclick: () => nameDialog = { title: 'Rename Prompt Folder', value: rootTitle, save: (value) => rootTitle = value },
              size: 'tiny',
              baseVariant: 'muted',
              hoverVariant: 'glyph'
            })}
          </div>
        </div>
        <div class="base-icon-button-bar">
          {@render IconButton(FolderPlus, 'Add category', { hoverVariant: 'accent', onclick: addCategory })}
          {@render IconButton(Trash2, 'Delete prompt folder', { hoverVariant: 'danger',
            onclick: () => confirmation = { title: 'Delete Prompt Folder',
              description: `Are you sure you want to permanently delete “${rootTitle}” and all of its contents?`,
              submit: 'Delete Prompt Folder', confirm: () => { rootPrompts = []; subfolders = [] } }
          })}
        </div>
      </div>

      <div class="base-filter-bar" role="group" aria-label="Filter prompts">
        {#each groups as group (group)}
          <button class:active={screenMode === group} type="button" aria-pressed={screenMode === group}
            onclick={() => { screenMode = group; statusMenuId = null; deleteMenuId = null }}>
            {group} <span class="text-xs">{allPrompts.filter((prompt) => matchesGroup(prompt, group)).length}</span>
          </button>
        {/each}
      </div>
    </section>

    <div class="base-entry-flow">
      {@render Divider()}
      {#each visiblePrompts(rootPrompts) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, visiblePrompts(rootPrompts).length)}
        {@render Divider(undefined, prompt.id)}
      {/each}
      <div class="base-root-folder-inset">
        {#each subfolders.filter((folder) => !isFinalMode || visiblePrompts(folder.prompts).length > 0) as folder (folder.id)}
          {@render FolderCard(folder)}
          <div class="base-final-gap"></div>
        {/each}
      </div>
      {#if !allPrompts.some((prompt) => matchesGroup(prompt))}
        <div class="base-empty">
          <p>No {screenMode.toLowerCase()} prompts in this folder.</p>
          {#if !isFinalMode}<p class="base-empty-detail text-sm">Click the Add Prompt button to create your first prompt.</p>{/if}
        </div>
      {/if}
    </div>
  </div>
</main>

{#if nameDialog}
  {@const NameIcon = isFolderName ? Pencil : FolderPlus}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog>
    <div tabindex="-1" class="base-template-dialog base-name-dialog" role="dialog" aria-modal="true" aria-label={nameDialog.title}>
      <form onsubmit={(event) => {
        event.preventDefault()
        if (!nameDialog || nameDisabled) return
        nameDialog.save(nameDialog.value.trim())
        nameDialog = null
      }}>
        <header class="base-template-dialog-header">
          <div class="base-template-dialog-heading">
            <div class="base-template-dialog-icon"><NameIcon size={24} aria-hidden="true" /></div>
            <div class="base-template-dialog-heading-copy">
              <h2 class="text-lg">{nameDialog.title}</h2>
              <p class="text-sm">{nameDialog.title === 'Create Category' ? 'Add a category to this root folder.' : `Choose a new name for this ${isFolderName ? 'prompt folder' : 'category'}.`}</p>
            </div>
          </div>
          {@render IconButton(X, 'Close', { onclick: () => nameDialog = null })}
        </header>
        {@render Separator()}
        <div class="base-name-row">
          <span class="base-name-row-icon"><NameIcon size={24} aria-hidden="true" /></span>
          <div class="base-name-row-copy">
            <span class="text-base">{nameLabel}</span>
            <small class="text-sm">{isFolderName ? 'Rename this prompt folder.' : 'Name the new category.'}</small>
          </div>
          <div class="base-name-control">
            <input class="base-name-input text-sm" bind:this={nameInput} aria-label={nameLabel}
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
          <button class="base-dialog-confirm-button text-sm" type="submit" disabled={nameDisabled}>{nameDialog.title}</button>
          <button class="base-dialog-cancel-button text-sm" type="button" onclick={() => nameDialog = null}>Cancel</button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if confirmation}
  <div class="base-template-dialog-layer" role="presentation" use:mountMockDialog
    onclick={(event) => { if (event.target === event.currentTarget) confirmation = null }}>
    <div tabindex="-1" class="base-template-dialog base-confirmation-dialog" role="dialog" aria-modal="true" aria-label={confirmation.title}>
      <header class="base-template-dialog-header">
        <div class="base-template-dialog-heading">
          <div class="base-template-dialog-icon"><Trash2 size={24} aria-hidden="true" /></div>
          <h2 class="text-lg">{confirmation.title}</h2>
        </div>
        {@render IconButton(X, 'Close', { onclick: () => confirmation = null })}
      </header>
      <p class="text-base">{confirmation.description}</p>
      <div class="base-template-dialog-footer">
        <button class="base-dialog-confirm-button text-sm" type="button" onclick={() => { confirmation?.confirm(); confirmation = null }}>{confirmation.submit}</button>
        <button class="base-dialog-cancel-button text-sm" type="button" onclick={() => confirmation = null}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if templateDialogPrompt}
  <div
    class="base-template-dialog-layer"
    role="presentation"
    data-testid="base-mockup-template-dialog-layer"
    onclick={handleTemplateDialogLayerClick}
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
          <span class="text-sm">Template Library</span>
        </div>
        {@render Separator()}

        <div class="base-template-tree" data-testid="base-mockup-template-tree">
          {#each templateFolders as rootFolder (rootFolder.id)}
            {@const templateCount = getTemplateCount(rootFolder)}
            <section class="base-template-root-group">
              <div class="base-template-root-heading">
                <span class="base-template-root-folder-icon">
                  <FolderOpen size={18} aria-hidden="true" />
                </span>
                <div class="base-template-root-copy">
                  <strong class="font-semibold">{rootFolder.title}</strong>
                  <span class="text-xs">{templateCount} {templateCount === 1 ? 'template' : 'templates'}</span>
                </div>
              </div>
              <div class="base-template-root-contents">
                {#each rootFolder.templates as template (template.id)}
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
                {#each rootFolder.children as child (child.id)}
                  {@render TemplateFolderRows(child, 0)}
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
  .base-prompt-folder-mockup {
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
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-icon-button[data-active='true'] {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-normal-border);
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
    flex: 0 0 1px;
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
    height: 140px;
    min-width: 0;
    padding: 12px 0 6px;
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
    height: 60px;
    min-width: 0;
  }

  .base-root-eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    gap: 6px;
    height: 17px;
  }

  .base-root-title-line {
    align-items: baseline;
    display: flex;
    gap: 11px;
    height: 36px;
    margin-top: 7px;
    min-width: 0;
  }

  .base-root-title-line h1 {
    color: var(--ui-normal-text);
    font-size: 27px;
    font-weight: var(--font-weight-semibold);
    height: 36px;
    letter-spacing: -0.03em;
    line-height: 32px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    padding-block: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-filter-bar {
    padding-inline: 24px;
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    display: flex;
    gap: 6px;
    height: 44px;
  }

  .base-filter-bar button {
    background: var(--ui-ghost-surface);
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted-text);
    height: 44px;
    margin-bottom: -1px;
    padding: 8px 10px 10px;
  }

  .base-filter-bar button.active {
    border-bottom-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .base-filter-bar span {
    position: relative;
    top: -1px;
    line-height: 18px;
    margin-left: 4px;
    padding: 2px 6px;
  }

  .base-entry-flow {
    min-width: 0;
    padding-bottom: 24px;
  }

  .base-divider-row {
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

  .base-divider-line-button:first-child {
    padding-left: 0;
  }

  .base-divider-line-button:last-child {
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
    overflow: visible;
    width: 100%;
  }

  .base-editor-body {
    container-type: inline-size;
    border-radius: 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card) 0;
    align-content: start;
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
    position: relative;
  }

  .base-editor-sidebar,
  .base-folder-sidebar {
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
  .base-folder-sidebar button:hover,
  .base-folder-sidebar button:focus-visible {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-folder-sidebar {
    align-items: center;
    justify-content: center;
  }

  .base-folder-sidebar button {
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
  .base-folder-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .base-title-copy input {
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

  .base-folder-label {
    align-items: center;
    display: inline-flex;
    gap: 4px;
    max-width: 150px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .base-folder-label[data-template-state='not-selected'] {
    color: var(--ui-secondary-text);
  }

  .base-folder-label[data-template-state='no-template'] {
    color: var(--ui-muted-text);
  }

  .base-folder-label[data-template-state='selected'] {
    color: var(--ui-normal-text);
  }

  .base-prompt-actions,
  .base-folder-actions {
    align-items: center;
    align-self: stretch;
    display: flex;
    min-width: 0;
  }

  .base-prompt-actions {
    gap: 12px;
    padding-right: 12px;
  }

  .base-folder-chevron {
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

  .base-folder-chevron:hover {
    background: var(--ui-hoverable-icon-surface);
    color: var(--ui-hoverable-icon-glyph);
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
    --cthulhu-ui-simple-selector-text: var(--ui-normal-text);

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
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    height: 34px;
    justify-content: center;
    margin-left: auto;
    padding: 0 6px;
  }

  .base-prompt-delete-section {
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

  .base-root-folder-inset {
    min-width: 0;
  }

  .base-folder-section {
    min-width: 0;
  }

  .base-folder-card {
    border-color: var(--ui-card-nested-border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .base-folder-title-bar {
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

  .base-folder-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 30px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .base-folder-chevron {
    height: 30px;
    width: 30px;
  }

  .base-folder-title-line {
    align-items: baseline;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .base-folder-title {
    color: var(--ui-normal-text);
    line-height: 20px;
    font-weight: var(--font-weight-semibold);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-folder-settings {
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
  }

  .base-settings-toolbar {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    gap: 24px;
    height: 56px;
    justify-content: space-between;
    min-width: 0;
    padding: 10px 12px 10px 16px;
  }

  .base-settings-toolbar-heading {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-weight: var(--font-weight-semibold);
    gap: 12px;
    min-width: 0;
  }

  .base-settings-toolbar-heading > :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .base-settings-toolbar-copy {
    display: grid;
    line-height: 16px;
    min-width: 0;
    row-gap: 2px;
  }

  .base-settings-toolbar-copy span:last-child {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: var(--font-weight-normal);
  }

  .base-settings-toolbar-actions {
    align-items: center;
    display: flex;
    flex: 0 1 auto;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
  }

  .base-settings-toggle {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    display: inline-flex;
    flex: 0 0 auto;
    line-height: 16px;
    font-weight: var(--font-weight-semibold);
    gap: 7px;
    height: 30px;
    justify-content: center;
    min-width: 0;
    padding: 0 10px;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
    white-space: nowrap;
  }

  .base-settings-toggle:hover,
  .base-settings-toggle:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
  }

  .base-settings-toggle[aria-pressed='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .base-settings-toggle[aria-pressed='true']:hover,
  .base-settings-toggle[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .base-settings-toggle :global(svg) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-settings-toggle-remove-icon {
    display: none;
  }

  .base-settings-toggle[aria-pressed='true']:hover .base-settings-toggle-default-icon,
  .base-settings-toggle[aria-pressed='true']:focus-visible .base-settings-toggle-default-icon {
    display: none;
  }

  .base-settings-toggle[aria-pressed='true']:hover .base-settings-toggle-remove-icon,
  .base-settings-toggle[aria-pressed='true']:focus-visible .base-settings-toggle-remove-icon {
    display: inline-flex;
  }

  .base-settings-toggle-default-icon,
  .base-settings-toggle-remove-icon {
    align-items: center;
    flex: 0 0 auto;
  }

  .base-folder-settings-sections {
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
  }

  .base-settings-section {
    display: grid;
    min-width: 0;
  }

  .base-settings-section.withTopBorder {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .base-settings-section > header {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-weight: var(--font-weight-semibold);
    gap: 5px;
    height: 28px;
    min-width: 0;
    overflow: hidden;
    padding: 0 16px;
    white-space: nowrap;
  }

  .base-settings-copy {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    gap: 5px;
    min-width: 0;
  }

  .base-settings-copy span:first-child {
    flex: 0 0 auto;
  }

  .base-settings-copy span:last-child {
    color: var(--ui-muted-text);
    flex: 1 1 auto;
    font-weight: var(--font-weight-normal);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .base-folder-children {
    background: var(--ui-card-nested-surface);
    border-left: 1px solid var(--ui-card-nested-border);
    border-right: 1px solid var(--ui-card-nested-border);
    box-sizing: border-box;
    min-width: 0;
    padding-inline: 12px;
  }

  .base-folder-bottom-cap {
    background: var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 0 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card);
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
    background: var(--ui-card-solid-surface);
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
    flex: 0 0 38px;
    height: 38px;
    justify-content: center;
    width: 38px;
  }

  .base-template-dialog-header h2 {
    color: var(--ui-normal-text);
    line-height: 24px;
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
  .base-template-folder-row {
    padding-block: 1px;
    width: 100%;
  }

  .base-template-root-option,
  .base-template-option-button,
  .base-template-folder-button {
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
    grid-template-columns: 32px minmax(0, 1fr) 20px;
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
    padding: 9px 12px;
  }

  .base-template-root-folder-icon {
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
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
    line-height: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-root-copy span {
    color: var(--ui-muted-text);
  }

  .base-template-root-contents {
    background: var(--ui-card-solid-surface);
    padding: 5px;
  }

  .base-template-option-button,
  .base-template-folder-button {
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
  }

  .base-template-root-option,
  .base-template-option-button,
  .base-template-folder-button {
    background: var(--ui-ghost-surface);
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .base-template-root-option:hover,
  .base-template-option-button:hover,
  .base-template-folder-button:hover {
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
  .base-template-folder-button > span:nth-child(3) {
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

  .base-template-folder-button {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 24px 18px minmax(0, 1fr);
    padding: 0 12px 0 calc(9px + 12px * var(--base-template-indent-count, 0));
    text-align: left;
  }

  .base-template-folder-button > :global(svg) {
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
  .base-folder-chevron[aria-expanded='true'] { transform: rotate(90deg); }
  .base-folder-title-copy { display: grid; gap: 4px; min-width: 0; }
  .base-final-gap { height: 28px; }
  .base-empty { color: var(--ui-secondary-text); text-align: center; padding: 48px 0; }
  .base-empty p { margin: 0; }
  .base-empty .base-empty-detail { margin-top: 8px; }
  .base-name-dialog { max-width: 540px; background: var(--ui-card-overlay-surface); }
  .base-name-row { display: flex; align-items: center; gap: 12px; padding: 16px; min-width: 0; }
  .base-name-row-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 34px; height: 34px; color: var(--ui-hoverable-icon-glyph); }
  .base-name-row-copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
  .base-name-row-copy > span { font-weight: var(--font-weight-semibold); }
  .base-name-row-copy small { color: var(--ui-muted-text); }
  .base-name-row-copy > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .base-name-control { position: relative; flex: 0 0 auto; }
  .base-name-input { box-sizing: border-box; width: 220px; height: 40px; border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-field-surface); color: var(--ui-normal-text); border: 1px solid var(--ui-neutral-normal-border); padding: 4px 14px; font-weight: var(--font-weight-semibold); }
  .base-name-input::placeholder { color: var(--ui-muted-text); }
  .base-name-input:focus-visible { outline: none; border-color: var(--ui-neutral-focus-border); box-shadow: var(--cthulhu-ui-shadow-focus); }
  .base-name-input[aria-invalid='true'] { border-color: var(--ui-danger-strong-border); box-shadow: var(--cthulhu-ui-shadow-focus-danger); }
  .base-name-error { position: absolute; top: 100%; left: 0; z-index: 10; margin-top: 2px; height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: var(--cthulhu-ui-radius-control); white-space: nowrap; background: color-mix(in oklch, var(--ui-card-solid-surface) 76%, var(--ui-danger-strong-border)); box-shadow: 0 8px 18px var(--ui-card-normal-shadow); }
  .base-name-error :global(svg) { color: var(--ui-danger-icon-glyph); }
  .base-name-dialog .base-dialog-confirm-button { border-color: var(--ui-accent-muted-border); font-weight: var(--font-weight-semibold); padding-inline: 14px; }
  .base-name-dialog .base-dialog-confirm-button:disabled { opacity: 0.5; pointer-events: none; }
  .base-confirmation-dialog { max-width: 480px; padding-top: 16px; background: var(--ui-card-overlay-surface); }
  .base-confirmation-dialog .base-template-dialog-header { padding-bottom: 12px; }
  .base-confirmation-dialog > p { padding: 4px; margin: 0; }
  .base-confirmation-dialog .base-dialog-confirm-button { background: var(--ui-danger-action-fill); border-color: var(--ui-danger-muted-border); font-weight: var(--font-weight-semibold); }
  .base-confirmation-dialog .base-dialog-confirm-button:hover { background: var(--ui-danger-action-hover-fill); border-color: var(--ui-danger-muted-hover-border); }
  @media (max-width: 720px) {
    .base-name-row { flex-wrap: wrap; align-items: flex-start; row-gap: 8px; }
    .base-name-control { margin-left: 46px; flex-basis: calc(100% - 46px); }
  }
  .base-status-indicator[data-status='Archived'] { background: var(--ui-secondary-icon-glyph); visibility: visible; }
  @container (width < 720px) {
    .base-prompt-title-area { height: 109px; grid-template-columns: 2px minmax(0, 1fr); grid-template-rows: 56px 53px; }
    .base-status-indicator { grid-row: 1 / -1; }
    .base-prompt-title-main { grid-column: 2; grid-row: 1; }
    .base-prompt-actions { grid-column: 2; grid-row: 2; border-top: 1px solid var(--ui-neutral-normal-border); justify-content: space-between; padding-left: 16px; }
    .base-actions-separator { display: none; }
  }
  .base-find-widget { position: absolute; top: 36px; right: 24px; z-index: 30; display: flex; align-items: center; gap: 3px; width: 400px; height: 33px; padding: 0 4px; box-sizing: border-box; background: var(--ui-card-solid-surface); color: var(--ui-normal-text); border: 1px solid var(--ui-neutral-normal-border); box-shadow: 0 0 8px var(--ui-card-normal-shadow); }
  .base-find-widget input { min-width: 0; flex: 1; background: var(--ui-editor-content-surface); color: var(--ui-normal-text); border: 1px solid var(--ui-neutral-normal-border); padding: 2px 6px; }
  .base-find-widget > span { font-size: 12px; min-width: 69px; }

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
    color: var(--ui-normal-text);
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
  .base-status-menu-item:focus-visible { background: var(--ui-neutral-action-fill); }
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
    line-height: 18px;
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
  .base-status-menu-icon[data-action='delete'] { color: var(--ui-hoverable-icon-glyph); }
  .base-prompt-delete-section[data-split='true'] {
    background: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    outline: 1px solid var(--ui-neutral-normal-border);
    overflow: hidden;
  }
  .base-prompt-delete-section[data-split='true'] > .base-icon-button {
    border: 0;
    border-radius: 0;
    box-sizing: content-box;
  }
  .base-prompt-delete-section[data-split='true'] > .base-icon-button:last-of-type { width: 23px; }
  .base-delete-separator {
    align-self: stretch;
    border-left: 1px solid var(--ui-neutral-normal-border);
    flex: 0 0 1px;
  }
  .base-status-segmented[data-status='Todo'] .base-status-value-content :global(svg),
  .base-status-segmented[data-status='Backlog'] .base-status-value-content :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }
</style>
