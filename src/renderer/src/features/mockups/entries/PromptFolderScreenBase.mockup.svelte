<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    Ban,
    Check,
    CheckCheck,
    CheckCircle2,
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

  const MockPromptStatus = {
    Todo: 'Todo',
    InProgress: 'InProgress',
    Completed: 'Completed'
  } as const
  type MockPromptStatus = (typeof MockPromptStatus)[keyof typeof MockPromptStatus]

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
    children: MockFolder[]
  }

  const createSettings = (folderId: string, description: string): MockFolderSetting[] => [
    {
      id: `${folderId}-description`,
      title: 'Folder Description',
      description:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
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
      templateLabel === 'Not Selected'
        ? 'not-selected'
        : templateLabel === 'No Template'
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
      for (const templateId of prompt.templateIds) selectedTemplateIds.add(templateId)
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
      templateDialogPrompt.templateLabel = template?.title ?? 'No Template'
      templateDialogPrompt.templateState = template ? 'selected' : 'no-template'
      closeTemplateDialog()
      return
    }

    if (!template) {
      selectedTemplateIds.clear()
      return
    }

    if (selectedTemplateIds.has(template.id)) selectedTemplateIds.delete(template.id)
    else selectedTemplateIds.add(template.id)
  }

  const confirmTemplateSelections = () => {
    if (!templateDialogPrompt) return
    const selectedTemplates = templateFolders
      .flatMap(getTemplates)
      .filter((template) => selectedTemplateIds.has(template.id))

    templateDialogPrompt.templateIds = selectedTemplates.map((template) => template.id)
    templateDialogPrompt.templateLabel = selectedTemplates.length
      ? selectedTemplates.map((template) => template.title).join(', ')
      : 'No Template'
    templateDialogPrompt.templateState = selectedTemplates.length ? 'selected' : 'no-template'
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
      'Not Selected',
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
      'No Template',
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
      'No Template',
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
      'No Template',
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
      'No Template',
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
          'No Template',
          [
            'Implement the approved change using the existing architecture and shared UI components.',
            '',
            'Keep the patch focused and preserve unrelated work in the tree.'
          ].join('\n'),
          MockPromptStatus.InProgress
        )
      ],
      children: [
        {
          id: 'base-verification',
          title: 'Verification',
          settings: createSettings(
            'base-verification',
            'Prompts for validating product behavior after implementation.'
          ),
          prompts: [
            createPrompt(
              'base-regression',
              'Add focused regression coverage',
              'base-verification',
              'No Template',
              [
                'Add focused regression coverage for the behavior changed in this task.',
                '',
                'Assert the visible user flow before implementation details.'
              ].join('\n')
            )
          ],
          children: []
        }
      ]
    }
  ])

  const EDITOR_TITLE_HEIGHT_PX = 56
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

  // Side effect: mirror the live dialog's Escape-key dismissal while the mock selector is open.
  $effect(() => {
    if (!templateDialogPrompt) return

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTemplateDialog()
    }
    document.addEventListener('keydown', handleKeydown)

    return () => document.removeEventListener('keydown', handleKeydown)
  })

  const setPromptStatus = (prompt: MockPrompt, status: MockPromptStatus) => {
    prompt.status = status
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
      class="base-template-folder-button"
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
          class="base-template-option-button"
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
            data-control={templateDialogMode === 'select-and-copy' ? 'copy' : 'checkbox'}
            aria-hidden="true"
          >
            {#if templateDialogMode === 'select-and-copy'}
              <Copy size={16} />
            {:else}
              <Check size={13} />
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
  {@const isCompleted = prompt.status === MockPromptStatus.Completed}
  {@const isTodo = prompt.status === MockPromptStatus.Todo}
  {@const StatusIcon = isCompleted
    ? CheckCircle2
    : prompt.status === MockPromptStatus.InProgress
      ? Play
      : CircleDashed}
  <div class="base-status-control">
    <div
      class="base-status-segmented"
      data-status={prompt.status}
      data-leading-action={!isTodo ? 'true' : 'false'}
      data-trailing-action={!isCompleted ? 'true' : 'false'}
    >
      {#if !isTodo}
        {@render IconButton(Undo2, isCompleted ? 'Uncomplete prompt' : 'Set prompt to Todo', {
          hoverVariant: 'neutral',
          onclick: () => setPromptStatus(prompt, MockPromptStatus.Todo)
        })}
      {/if}
      <span class="base-status-selector">
        <button
          type="button"
          class="base-status-value"
          aria-label={`Change status: ${isCompleted ? 'Completed' : prompt.status === MockPromptStatus.InProgress ? 'In Progress' : 'Todo'}`}
          onclick={() => {
            setPromptStatus(
              prompt,
              prompt.status === MockPromptStatus.Todo
                ? MockPromptStatus.InProgress
                : prompt.status === MockPromptStatus.InProgress
                  ? MockPromptStatus.Completed
                  : MockPromptStatus.Todo
            )
          }}
        >
          <StatusIcon size={16} aria-hidden="true" />
          <span>{isCompleted ? 'Completed' : prompt.status === MockPromptStatus.InProgress ? 'In Progress' : 'Todo'}</span>
        </button>
        <button type="button" class="base-status-more" aria-label="Change status More Options" title="More Options">
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </span>
      {#if !isCompleted}
        {@render IconButton(CheckCheck, 'Complete prompt', {
          hoverVariant: 'success',
          onclick: () => setPromptStatus(prompt, MockPromptStatus.Completed)
        })}
      {/if}
    </div>
  </div>
{/snippet}

{#snippet SettingsToggle(setting: MockFolderSetting)}
  <button
    type="button"
    class="base-settings-toggle"
    aria-pressed={setting.isPresent}
    title={`${setting.isPresent ? 'Remove' : 'Add'} ${setting.title.toLowerCase()}`}
    onclick={() => {
      setting.isPresent = !setting.isPresent
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
    <span>{setting.title.replace('Folder Description', 'Description').replace('Prompt Folder ', '')}</span>
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

{#snippet Divider()}
  <div class="base-divider-row">
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from left separator">
      {@render Separator()}
    </button>
    <div class="base-divider-actions">
      <button type="button" class="base-divider-action-button" aria-label="Add Prompt">
        <Plus size={13} aria-hidden="true" />
        <span>Add Prompt</span>
      </button>
      <button type="button" class="base-divider-action-button" aria-label="Add Subfolder">
        <FolderPlus size={13} aria-hidden="true" />
        <span>Add Subfolder</span>
      </button>
    </div>
    <button type="button" class="base-divider-line-button" aria-label="Add Prompt from right separator">
      {@render Separator()}
    </button>
  </div>
{/snippet}

{#snippet PromptCard(prompt: MockPrompt, index: number, siblingCount: number)}
  <article
    class="base-editor-card base-prompt-card"
    data-testid={`base-mockup-prompt-editor-${prompt.id}`}
    data-prompt-folder-id={prompt.folderId}
  >
    <aside class="base-editor-sidebar">
      <button type="button" aria-label="Move prompt up" disabled={index === 0}>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Drag prompt" class="base-drag-button">
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Move prompt down" disabled={index === siblingCount - 1}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </aside>

    <div class="base-editor-body">
      <header class="base-prompt-title-area" style={`height:${EDITOR_TITLE_HEIGHT_PX}px;`}>
        <span class="base-status-indicator" data-status={prompt.status} aria-hidden="true"></span>
        <div class="base-prompt-title-main">
          {@render IconCell(FileText)}
          <div class="base-title-copy">
            <input aria-label="Prompt title" bind:value={prompt.title} />
            <div class="base-metadata-row">
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
            {#if prompt.templateState === 'not-selected'}
              {@render IconButton(Zap, 'Select Template and Copy', {
                onclick: () => openTemplateDialog(prompt, 'select-and-copy')
              })}
            {:else}
              {@render IconButton(Copy, 'Copy prompt', {
                hoverVariant: 'accent',
                onclick: () => {
                  if (prompt.status === MockPromptStatus.Todo) {
                    setPromptStatus(prompt, MockPromptStatus.InProgress)
                  }
                }
              })}
            {/if}
            {@render IconButton(Layers, 'Set Template', {
              onclick: () => openTemplateDialog(prompt)
            })}
          </div>
          <span class="base-actions-separator" aria-hidden="true"></span>
          {@render StatusControl(prompt)}
          <span class="base-actions-separator" aria-hidden="true"></span>
          <div class="base-prompt-delete-section">
            {@render IconButton(Trash2, 'Delete prompt', { hoverVariant: 'danger' })}
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
        <button type="button" aria-label="Drag prompt folder" title="Drag prompt folder">
          <GripVertical size={16} aria-hidden="true" />
        </button>
      </aside>

      <div class="base-editor-body">
        <header class="base-folder-title-bar" aria-expanded="true">
          <div class="base-folder-title-main">
            <button class="base-folder-chevron" type="button" aria-label="Folder prompts shown">
              <ChevronRight size={24} aria-hidden="true" />
            </button>
            {@render IconCell(Folder)}
            <div class="base-folder-title-copy">
              <div class="base-folder-title-line">
                <span class="base-folder-title" title={folder.title}>{folder.title}</span>
                {@render IconButton(Pencil, 'Rename prompt folder', {
                  size: 'tiny',
                  baseVariant: 'muted',
                  hoverVariant: 'glyph'
                })}
              </div>
              <div class="base-metadata-row">
                <span>{folder.prompts.length} prompt</span>
                {@render SeparatorDot()}
                <span>0 completed prompts</span>
                {@render SeparatorDot()}
                <span>{folder.children.length} {folder.children.length === 1 ? 'subfolder' : 'subfolders'}</span>
              </div>
            </div>
          </div>

          <div class="base-folder-actions">
            <div class="base-icon-button-bar">
              {@render IconButton(Trash2, 'Delete prompt folder', { hoverVariant: 'danger' })}
              {@render IconButton(Settings, 'Hide folder settings', {
                hoverVariant: 'accent',
                active: true,
                ariaPressed: true,
                testId: `base-mockup-settings-expanded-${folder.id}`
              })}
            </div>
          </div>
        </header>

        {@render Separator()}
        <div class="base-folder-settings">
          <div class="base-settings-toolbar">
            <div class="base-settings-toolbar-heading">
              <Settings size={20} aria-hidden="true" />
              <div class="base-settings-toolbar-copy">
                <span>Folder Settings</span>
                <span>{folder.settings.filter((setting) => setting.isPresent).length} of {folder.settings.length} configured</span>
              </div>
            </div>
            <div class="base-settings-toolbar-actions" role="group" aria-label="Folder settings">
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
                <header>
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
      </div>
    </article>

    <div class="base-folder-children">
      {@render Divider()}
      {#each folder.prompts as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, folder.prompts.length)}
        {@render Divider()}
      {/each}
      {#each folder.children as child (child.id)}
        {@render FolderCard(child)}
        {@render Divider()}
      {/each}
    </div>
    <div class="base-folder-bottom-cap" aria-hidden="true"></div>
  </section>
{/snippet}

<main class="base-prompt-folder-mockup" data-testid="base-prompt-folder-mockup">
  <div class="base-header-bar">
    <div class="base-breadcrumb">
      <button type="button">Product Work</button>
      <span>/</span>
      <button type="button">Prompts</button>
    </div>
    {@render IconButton(Search, 'Find in Folder (Control + F)', { size: 'compact' })}
  </div>

  <div class="base-content-viewport">
    <section class="base-root-header">
      <div class="base-root-title-row">
        <div class="base-root-title-block">
          <div class="base-root-eyebrow">
            <Folder size={14} aria-hidden="true" />
            <span>Prompt Folder</span>
          </div>
          <div class="base-root-title-line">
            <h1>Product Work</h1>
            {@render IconButton(Pencil, 'Rename prompt folder', {
              size: 'tiny',
              baseVariant: 'muted',
              hoverVariant: 'glyph'
            })}
          </div>
        </div>
        {@render IconButton(Trash2, 'Delete prompt folder', { hoverVariant: 'danger' })}
      </div>

      <div class="base-filter-bar" role="group" aria-label="Filter prompts">
        <button class="active" type="button" aria-pressed="true">
          Todo/In Progress <span>8</span>
        </button>
        <button type="button" aria-pressed="false">Completed <span>0</span></button>
      </div>
    </section>

    <div class="base-entry-flow">
      {@render Divider()}
      {#each rootPrompts.slice(0, 3) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, rootPrompts.length)}
        {@render Divider()}
      {/each}

      <div class="base-root-folder-inset">
        {#each subfolders as folder (folder.id)}
          {@render FolderCard(folder)}
        {/each}
      </div>

      {@render Divider()}
      {#each rootPrompts.slice(3) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex + 3, rootPrompts.length)}
        {@render Divider()}
      {/each}
    </div>
  </div>
</main>

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
        : 'Configure Templates'}
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
            <h2>
              {templateDialogMode === 'select-and-copy'
                ? 'Quick Template Selection'
                : 'Configure Templates'}
            </h2>
            <p>
              {templateDialogMode === 'select-and-copy'
                ? 'Click a template to apply it and copy this prompt immediately.'
                : 'Select one or more templates to apply to this prompt.'}
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
            class="base-template-root-option"
            class:active={templateDialogMode === 'select' && selectedTemplateIds.size === 0}
            aria-pressed={templateDialogMode === 'select'
              ? selectedTemplateIds.size === 0
              : undefined}
            onclick={() => selectTemplate(null)}
          >
            <span class="base-no-template-icon"><Ban size={18} aria-hidden="true" /></span>
            <span class="base-no-template-copy">
              <strong>No Template</strong>
              <small>Use the prompt exactly as written</small>
            </span>
            <span
              class="base-template-selection-mark"
              data-control={templateDialogMode === 'select-and-copy' ? 'copy' : 'checkbox'}
              aria-hidden="true"
            >
              {#if templateDialogMode === 'select-and-copy'}
                <Copy size={16} />
              {:else}
                <Check size={13} />
              {/if}
            </span>
          </button>
        </div>

        <div class="base-template-tree-label">
          <span>Template Library</span>
          {#if templateDialogMode === 'select'}
            <span>{selectedTemplateIds.size} selected</span>
          {/if}
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
                  <strong>{rootFolder.title}</strong>
                  <span>{templateCount} {templateCount === 1 ? 'template' : 'templates'}</span>
                </div>
              </div>
              <div class="base-template-root-contents">
                {#each rootFolder.templates as template (template.id)}
                  <div class="base-template-option-row">
                    <button
                      type="button"
                      class="base-template-option-button"
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
                          : 'checkbox'}
                        aria-hidden="true"
                      >
                        {#if templateDialogMode === 'select-and-copy'}
                          <Copy size={16} />
                        {:else}
                          <Check size={13} />
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
        <button type="button" class="base-dialog-cancel-button" onclick={closeTemplateDialog}>
          Cancel
        </button>
        {#if templateDialogMode === 'select'}
          <button
            type="button"
            class="base-dialog-confirm-button"
            onclick={confirmTemplateSelections}
          >
            <Check size={16} aria-hidden="true" />
            Confirm Selections
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .base-prompt-folder-mockup {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    min-width: 0;
    width: 100%;
  }

  button,
  input {
    font: inherit;
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
    font-size: 14px;
    font-weight: 500;
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
    padding: 12px 24px 6px;
  }

  .base-root-title-row {
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
    font-size: 12px;
    gap: 6px;
    height: 17px;
    line-height: 17px;
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
    font-weight: 700;
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
    background: var(--ui-neutral-normal-surface);
    border-radius: 999px;
    font-size: 11px;
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
    font-size: 12px;
    gap: 4px;
    height: 100%;
    line-height: 16px;
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
    overflow: hidden;
    width: 100%;
  }

  .base-editor-body {
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
    align-items: center;
    display: grid;
    grid-template-columns: 2px minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
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
    font-size: 15px;
    font-weight: 600;
    height: 20px;
    line-height: 20px;
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
    font-size: 12px;
    gap: 8px;
    line-height: 16px;
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
    --base-status-color: var(--ui-normal-text);

    align-items: stretch;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    display: inline-flex;
    height: 36px;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease;
  }

  .base-status-segmented[data-status='InProgress'] .base-status-selector {
    --base-status-color: var(--ui-warning-icon-glyph);
  }

  .base-status-segmented[data-status='Completed'] .base-status-selector {
    --base-status-color: var(--ui-success-normal-text);
  }

  .base-status-selector:hover,
  .base-status-selector:focus-within {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
  }

  .base-status-value,
  .base-status-more {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--base-status-color);
    display: inline-flex;
    height: 34px;
    justify-content: center;
    padding: 0;
  }

  .base-status-value {
    box-sizing: border-box;
    font-size: 14px;
    font-weight: 500;
    gap: 6px;
    padding: 0 12px;
    white-space: nowrap;
    width: 116px;
  }

  .base-status-more {
    width: 23px;
  }

  .base-prompt-delete-section {
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
    transform: rotate(90deg);
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
    font-size: 16px;
    font-weight: 700;
    line-height: 20px;
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
    font-size: 14px;
    font-weight: 700;
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
    font-weight: 400;
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
    font-size: 14px;
    font-weight: 600;
    gap: 7px;
    height: 30px;
    justify-content: center;
    line-height: 16px;
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
    font-size: 12px;
    font-weight: 700;
    gap: 5px;
    height: 28px;
    line-height: 16px;
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
    font-weight: 400;
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
    font-size: 18px;
    font-weight: 500;
    line-height: 24px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-dialog-heading p {
    color: var(--ui-muted-text);
    font-size: 13px;
    line-height: 19px;
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
    font-size: 14px;
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
    font-size: 14px;
    font-weight: 600;
    line-height: 19px;
  }

  .base-no-template-copy small {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 17px;
  }

  .base-template-tree-label {
    align-items: flex-end;
    display: flex;
    justify-content: space-between;
    padding: 0 3px 8px;
  }

  .base-template-tree-label > span:first-child {
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }

  .base-template-tree-label span:last-child:not(:first-child) {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
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
    font-weight: 650;
    line-height: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-template-root-copy span {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
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

  .base-template-selection-mark[data-control='checkbox'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .base-template-selection-mark[data-control='copy'] {
    color: var(--ui-secondary-icon-glyph);
  }

  .base-template-option-button.active
    .base-template-selection-mark[data-control='checkbox'],
  .base-template-root-option.active .base-template-selection-mark[data-control='checkbox'] {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
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
    font-size: 14px;
    font-weight: 600;
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
    font-size: 14px;
    font-weight: 500;
    height: 40px;
    line-height: 20px;
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
</style>
