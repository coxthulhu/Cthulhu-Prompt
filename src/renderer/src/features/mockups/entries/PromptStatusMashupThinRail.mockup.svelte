<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CircleDashed,
    FileText,
    Folder,
    FolderPlus,
    Hourglass,
    Pencil,
    Plus,
  } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import PromptEditorButtonBar from '@renderer/features/prompt-editor/PromptEditorButtonBar.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import {
    getLineHeightPx,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX
  } from '@renderer/features/prompt-editor/promptEditorSizing'

  type MockEditorDocument = {
    id: string
    text: string
  }

  type MockPromptStatus = 'todo' | 'in-progress' | 'completed'

  type MockPrompt = MockEditorDocument & {
    title: string
    folder: string
    modifiedLabel: string
    status: MockPromptStatus
  }

  type MockFolderField = MockEditorDocument & {
    label: string
    helperText: string
  }

  type MockSubfolder = {
    id: string
    title: string
    isExpanded: boolean
    subfolderCount: number
    fields: MockFolderField[]
    prompts: MockPrompt[]
  }

  const createFolderFields = (folderId: string, description: string, prefix: string, suffix: string) => [
    {
      id: `${folderId}-description`,
      label: 'Folder Description',
      helperText: 'shared context for the whole folder',
      text: description
    },
    {
      id: `${folderId}-prefix`,
      label: 'Folder Prefix',
      helperText: 'added before prompts in this folder',
      text: prefix
    },
    {
      id: `${folderId}-suffix`,
      label: 'Folder Suffix',
      helperText: 'added after prompts in this folder',
      text: suffix
    }
  ]

  let topLevelPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-inbox-triage',
      title: 'Triage imported prompts',
      folder: 'Prompts',
      modifiedLabel: 'Updated 2 min ago',
      status: 'in-progress',
      text: [
        'Review the imported workspace prompts and group them by project area, risk, and expected follow-up owner.',
        '',
        'Return a short list of prompts that should move into subfolders and note any duplicated instructions.'
      ].join('\n')
    },
    {
      id: 'mockup-workspace-cleanup',
      title: 'Clean workspace front matter',
      folder: 'Prompts',
      modifiedLabel: 'Updated 18 min ago',
      status: 'completed',
      text: [
        'Normalize prompt front matter for the current workspace.',
        '',
        'Keep titles stable, preserve folder assignments, and report any fields that cannot be mapped safely.'
      ].join('\n')
    }
  ])

  let mockSubfolders = $state<MockSubfolder[]>([
    {
      id: 'mockup-folder-architecture',
      title: 'Architecture Reviews',
      isExpanded: true,
      subfolderCount: 2,
      fields: createFolderFields(
        'mockup-folder-architecture',
        [
          'Reusable review prompts for large renderer and main-process changes.',
          '',
          'Keep findings concrete, scoped, and tied to behavior that can regress in the shipped app.'
        ].join('\n'),
        [
          'You are reviewing Cthulhu Prompt architecture changes.',
          'Prioritize data flow, IPC boundaries, persistence behavior, and renderer state ownership.'
        ].join('\n'),
        [
          'Group findings by severity.',
          'Include file references and the smallest verification path for each issue.'
        ].join('\n')
      ),
      prompts: [
        {
          id: 'mockup-outline',
          title: 'Outline workspace import edge cases',
          folder: 'Architecture Reviews',
          modifiedLabel: 'Updated 24 min ago',
          status: 'todo',
          text: [
            'Review the workspace import flow and identify edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
            '',
            'Return the findings as concrete bugs with file references and suggested tests.',
            '',
            'Include scenarios for partially written workspace files, prompts that reference folders removed during import, and imports where the destination workspace already has similarly named prompts.'
          ].join('\n')
        },
        {
          id: 'mockup-refactor',
          title: 'Refactor editor sizing controller',
          folder: 'Architecture Reviews',
          modifiedLabel: 'Updated 41 min ago',
          status: 'completed',
          text: [
            'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
            '',
            'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
          ].join('\n')
        },
        {
          id: 'mockup-review',
          title: 'Review drag and drop persistence',
          folder: 'Architecture Reviews',
          modifiedLabel: 'Updated 1 hr ago',
          status: 'todo',
          text: [
            'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
            '',
            'List only issues that can produce user-visible regressions.',
            '',
            'Pay special attention to cross-folder moves, moving the first or last prompt in a folder, cancelled drags, and drops that happen while the target folder is collapsed.'
          ].join('\n')
        }
      ]
    },
    {
      id: 'mockup-folder-testing',
      title: 'Testing Workflows',
      isExpanded: true,
      subfolderCount: 1,
      fields: createFolderFields(
        'mockup-folder-testing',
        [
          'Prompts for Vitest and Playwright coverage work.',
          '',
          'Use these when a change needs durable regression coverage rather than a manual smoke check.'
        ].join('\n'),
        [
          'Use the existing test helpers.',
          'Prefer stable selectors and assert the visible user flow before checking implementation details.'
        ].join('\n'),
        [
          'End with the exact commands that should be run.',
          'Mention any coverage gap that remains.'
        ].join('\n')
      ),
      prompts: [
        {
          id: 'mockup-tests',
          title: 'Write Playwright coverage',
          folder: 'Testing Workflows',
          modifiedLabel: 'Updated yesterday',
          status: 'completed',
          text: [
            'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
            '',
            'Use the existing test helpers and data-testid selectors.',
            '',
            'Cover the add button above the first prompt and the add button after an existing prompt.'
          ].join('\n')
        },
        {
          id: 'mockup-vitest',
          title: 'Add memfs persistence test',
          folder: 'Testing Workflows',
          modifiedLabel: 'Updated Jun 20',
          status: 'todo',
          text: [
            'Add a Vitest case that writes a prompt into a nested folder, reloads the workspace, and verifies the prompt order and folder metadata are preserved.',
            '',
            'Use memfs and keep the assertions focused on serialized workspace data.'
          ].join('\n')
        }
      ]
    },
    {
      id: 'mockup-folder-release',
      title: 'Release Notes',
      isExpanded: false,
      subfolderCount: 0,
      fields: createFolderFields(
        'mockup-folder-release',
        'Prompts for converting recent changes into concise user-facing release notes.',
        'Focus on visible behavior, workflow improvements, and any settings that users need to revisit.',
        'Keep implementation details out unless they affect upgrade behavior.'
      ),
      prompts: [
        {
          id: 'mockup-release',
          title: 'Draft release notes',
          folder: 'Release Notes',
          modifiedLabel: 'Updated Jun 12',
          status: 'completed',
          text: [
            'Summarize the recent prompt folder changes for a release note.',
            '',
            'Focus on visible user-facing behavior, workflow improvements, and any test coverage added.'
          ].join('\n')
        },
        {
          id: 'mockup-polish',
          title: 'Polish settings controls',
          folder: 'Release Notes',
          modifiedLabel: 'Updated Jun 8',
          status: 'todo',
          text: [
            'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
            '',
            'Stay within the existing palette and cthulhu-ui component conventions.'
          ].join('\n')
        }
      ]
    }
  ])

  const sizingConfig = {
    fontSize: 15,
    minLines: 3,
    maxLines: 10
  }
  const lineHeightPx = getLineHeightPx(sizingConfig.fontSize)
  const minEditorHeightPx = lineHeightPx * sizingConfig.minLines
  const maxEditorHeightPx = lineHeightPx * sizingConfig.maxLines
  const clampEditorHeight = (heightPx: number): number =>
    Math.min(Math.max(heightPx, minEditorHeightPx), maxEditorHeightPx)

  const getLineCount = (text: string): number => Math.max(1, text.split('\n').length)
  const getTokenCount = (text: string): number => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return 0
    return trimmed.split(/\s+/).length
  }

  const getEditorUri = (documentId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/fable-mockup-2/${documentId}.md`)

  const getPromptLabel = (count: number) => `${count} ${count === 1 ? 'prompt' : 'prompts'}`
  const getSubfolderLabel = (count: number) =>
    `${count} ${count === 1 ? 'subfolder' : 'subfolders'}`
  const getLastPromptId = (prompts: MockPrompt[]): string | null =>
    prompts.length > 0 ? prompts[prompts.length - 1].id : null
  const getPreviousSubfolder = (folderIndex: number): MockSubfolder | null =>
    folderIndex > 0 ? (mockSubfolders[folderIndex - 1] ?? null) : null
  const getNextPromptStatus = (status: MockPromptStatus): MockPromptStatus =>
    status === 'todo' ? 'in-progress' : status === 'in-progress' ? 'completed' : 'todo'
  const getPromptStatusToggleLabel = (status: MockPromptStatus): string => {
    if (status === 'completed') return 'Mark prompt as todo'
    if (status === 'in-progress') return 'Mark prompt completed'
    return 'Mark prompt in progress'
  }
  const getPromptStatusToggleClass = (status: MockPromptStatus): string => {
    if (status === 'completed') {
      return 'mockup-status-toggle-button mockup-status-toggle-button-completed'
    }

    if (status === 'in-progress') {
      return 'mockup-status-toggle-button mockup-status-toggle-button-in-progress'
    }

    return 'mockup-status-toggle-button'
  }

  let nextPromptSequence = $state(1)
  let nextSubfolderSequence = $state(1)

  const createNewPrompt = (folder: string): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder,
      modifiedLabel: 'Just now',
      status: 'todo',
      text: ''
    }
  }

  const createNewSubfolder = (): MockSubfolder => {
    const subfolderNumber = nextSubfolderSequence
    nextSubfolderSequence += 1

    return {
      id: `mockup-new-subfolder-${subfolderNumber}`,
      title: `New subfolder ${subfolderNumber}`,
      isExpanded: true,
      subfolderCount: 0,
      fields: createFolderFields(
        `mockup-new-subfolder-${subfolderNumber}`,
        'Describe when this subfolder should be used.',
        'Add shared setup instructions for prompts in this subfolder.',
        'Add shared closing instructions for prompts in this subfolder.'
      ),
      prompts: []
    }
  }

  const addSubfolderAfter = (previousPromptId: string | null, targetFolderId: string | null) => {
    const nextSubfolder = createNewSubfolder()

    if (targetFolderId === null) {
      mockSubfolders = [nextSubfolder, ...mockSubfolders]
      return
    }

    const targetFolderIndex = mockSubfolders.findIndex((folder) => folder.id === targetFolderId)
    const insertionIndex =
      targetFolderIndex === -1 ? mockSubfolders.length : targetFolderIndex + 1
    const nextSubfolders = [...mockSubfolders]
    nextSubfolders.splice(insertionIndex, 0, {
      ...nextSubfolder,
      title: previousPromptId ? `${nextSubfolder.title} after prompt` : nextSubfolder.title
    })
    mockSubfolders = nextSubfolders
  }

  const addPromptAfter = (previousPromptId: string | null, targetFolderId: string | null) => {
    if (targetFolderId === null) {
      const nextPrompt = createNewPrompt('Prompts')
      if (previousPromptId === null) {
        topLevelPrompts = [nextPrompt, ...topLevelPrompts]
        return
      }

      const previousPromptIndex = topLevelPrompts.findIndex((prompt) => prompt.id === previousPromptId)
      if (previousPromptIndex === -1) {
        topLevelPrompts = [...topLevelPrompts, nextPrompt]
        return
      }

      const nextPrompts = [...topLevelPrompts]
      nextPrompts.splice(previousPromptIndex + 1, 0, nextPrompt)
      topLevelPrompts = nextPrompts
      return
    }

    mockSubfolders = mockSubfolders.map((folder) => {
      if (folder.id !== targetFolderId) return folder

      const nextPrompt = createNewPrompt(folder.title)
      if (previousPromptId === null) {
        return {
          ...folder,
          prompts: [nextPrompt, ...folder.prompts]
        }
      }

      const previousPromptIndex = folder.prompts.findIndex((prompt) => prompt.id === previousPromptId)
      const nextPrompts = [...folder.prompts]
      nextPrompts.splice(
        previousPromptIndex === -1 ? nextPrompts.length : previousPromptIndex + 1,
        0,
        nextPrompt
      )

      return {
        ...folder,
        prompts: nextPrompts
      }
    })
  }

  const movePromptInList = (
    prompts: MockPrompt[],
    promptId: string,
    direction: -1 | 1
  ): MockPrompt[] | null => {
    const index = prompts.findIndex((prompt) => prompt.id === promptId)
    if (index === -1) return null

    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= prompts.length) return prompts

    const nextPrompts = [...prompts]
    const [prompt] = nextPrompts.splice(index, 1)
    nextPrompts.splice(targetIndex, 0, prompt)
    return nextPrompts
  }

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const topLevelResult = movePromptInList(topLevelPrompts, promptId, direction)
    if (topLevelResult !== null) {
      topLevelPrompts = topLevelResult
      return
    }

    mockSubfolders = mockSubfolders.map((folder) => {
      const folderResult = movePromptInList(folder.prompts, promptId, direction)
      if (folderResult === null) return folder
      return {
        ...folder,
        prompts: folderResult
      }
    })
  }

  const moveSubfolder = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= mockSubfolders.length) return

    const nextFolders = [...mockSubfolders]
    const [folder] = nextFolders.splice(index, 1)
    nextFolders.splice(targetIndex, 0, folder)
    mockSubfolders = nextFolders
  }

  const deletePrompt = (promptId: string) => {
    topLevelPrompts = topLevelPrompts.filter((prompt) => prompt.id !== promptId)
    mockSubfolders = mockSubfolders.map((folder) => ({
      ...folder,
      prompts: folder.prompts.filter((prompt) => prompt.id !== promptId)
    }))
  }

  const togglePromptStatus = (promptId: string) => {
    const toggleStatus = (prompt: MockPrompt): MockPrompt =>
      prompt.id === promptId
        ? {
            ...prompt,
            status: getNextPromptStatus(prompt.status)
          }
        : prompt

    topLevelPrompts = topLevelPrompts.map(toggleStatus)
    mockSubfolders = mockSubfolders.map((folder) => ({
      ...folder,
      prompts: folder.prompts.map(toggleStatus)
    }))
  }

  const toggleSubfolder = (folderId: string) => {
    mockSubfolders = mockSubfolders.map((folder) =>
      folder.id === folderId
        ? {
            ...folder,
            isExpanded: !folder.isExpanded
          }
        : folder
    )
  }

  const handleSubfolderTitleKeydown = (event: KeyboardEvent, folderId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    toggleSubfolder(folderId)
  }

  const noopPromptTreeDrop = () => undefined

  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const createEditor = (host: HTMLElement, document: MockEditorDocument) => {
    const existingModel = monaco.editor.getModel(getEditorUri(document.id))
    const model =
      existingModel ?? monaco.editor.createModel(document.text, 'markdown', getEditorUri(document.id))
    model.setValue(document.text)

    const editor = monaco.editor.create(host, {
      model,
      theme: PROMPT_EDITOR_THEME,
      automaticLayout: true,
      fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: sizingConfig.fontSize,
      lineHeight: lineHeightPx,
      minimap: { enabled: false },
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      scrollbar: {
        alwaysConsumeMouseWheel: false
      },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      revealHorizontalRightPadding: 0,
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
      renderLineHighlightOnlyWhenFocus: true,
      renderValidationDecorations: 'off',
      dimension: {
        width: Math.max(1, host.clientWidth),
        height: clampEditorHeight(lineHeightPx * getLineCount(document.text))
      }
    })

    const syncHeight = () => {
      const heightPx = clampEditorHeight(Math.ceil(editor.getContentHeight()))
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
      if (!existingModel) {
        model.dispose()
      }
    }

    editorCleanupCallbacks.add(cleanup)

    return () => {
      cleanup()
      editorCleanupCallbacks.delete(cleanup)
    }
  }

  const mountMockupMonaco = (node: HTMLElement, document: MockEditorDocument) => {
    // Side effect: create a local Monaco editor for this mock document and dispose it on teardown.
    const destroy = createEditor(node, document)

    return {
      destroy
    }
  }

  // Side effect: dispose any Monaco instances whose host action has not already cleaned up.
  onDestroy(() => {
    for (const cleanup of editorCleanupCallbacks) {
      cleanup()
    }
    editorCleanupCallbacks.clear()
  })
</script>

{#snippet SeparatorDot()}
  <span class="mockup-separator-dot" aria-hidden="true"></span>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, targetFolderId: string | null)}
  <div class="mockup-insertion-rail">
    <span class="mockup-insertion-line" aria-hidden="true"></span>
    <div class="mockup-insertion-actions">
      <button
        class="mockup-insertion-button"
        type="button"
        aria-label="Add prompt here"
        title="Add prompt here"
        data-testid={previousPromptId
          ? `mockup-prompt-divider-add-after-${previousPromptId}`
          : targetFolderId
            ? `mockup-prompt-divider-add-initial-${targetFolderId}`
            : 'mockup-prompt-divider-add-initial'}
        onclick={() => addPromptAfter(previousPromptId, targetFolderId)}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        class="mockup-insertion-button"
        type="button"
        aria-label="Add subfolder here"
        title="Add subfolder here"
        data-testid={previousPromptId
          ? `mockup-subfolder-divider-add-after-${previousPromptId}`
          : targetFolderId
            ? `mockup-subfolder-divider-add-initial-${targetFolderId}`
            : 'mockup-subfolder-divider-add-initial'}
        onclick={() => addSubfolderAfter(previousPromptId, targetFolderId)}
      >
        <FolderPlus size={14} aria-hidden="true" />
      </button>
    </div>
  </div>
{/snippet}

{#snippet SubfolderDividerRow(previousFolder: MockSubfolder)}
  {@const previousPromptId = getLastPromptId(previousFolder.prompts)}
  <div class="mockup-insertion-rail">
    <span class="mockup-insertion-line" aria-hidden="true"></span>
    <div class="mockup-insertion-actions">
      <button
        class="mockup-insertion-button"
        type="button"
        aria-label="Add prompt here"
        title="Add prompt here"
        data-testid={previousPromptId
          ? `mockup-prompt-divider-add-after-${previousPromptId}`
          : `mockup-prompt-divider-add-initial-${previousFolder.id}`}
        onclick={() => addPromptAfter(previousPromptId, previousFolder.id)}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        class="mockup-insertion-button"
        type="button"
        aria-label="Add subfolder here"
        title="Add subfolder here"
        data-testid={`mockup-subfolder-divider-add-after-${previousFolder.id}`}
        onclick={() => addSubfolderAfter(null, previousFolder.id)}
      >
        <FolderPlus size={14} aria-hidden="true" />
      </button>
    </div>
  </div>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number, siblingCount: number)}
  <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId="mockup-prompts"
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === siblingCount - 1}
      onMoveUp={() => movePrompt(prompt.id, -1)}
      onMoveDown={() => movePrompt(prompt.id, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div class="mockup-prompt-editor-body">
      <header
        class="mockup-prompt-editor-title-bar"
        style={`height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      >
        <div class="mockup-prompt-editor-title-main">
          <span class="mockup-title-icon">
            <FileText size={24} aria-hidden="true" />
          </span>

          <div class="mockup-title-copy">
            <input class="mockup-title-input" value={prompt.title} aria-label="Prompt title" />
            <div class="mockup-metadata-row">
              <span class="mockup-metadata-folder" title={prompt.folder}>
                <Folder class="mockup-metadata-folder-icon" size={12} aria-hidden="true" />
                {prompt.folder}
              </span>
              {@render SeparatorDot()}
              <span>{getLineCount(prompt.text)} lines</span>
              {@render SeparatorDot()}
              <span>{getTokenCount(prompt.text)} tokens</span>
              {@render SeparatorDot()}
              <span>{prompt.modifiedLabel}</span>
            </div>
          </div>
        </div>

        <div class="mockup-title-actions">
          <PromptEditorButtonBar
            title={prompt.title}
            draftText={prompt.text}
            onDelete={() => deletePrompt(prompt.id)}
          />

          <span
            class="mockup-title-actions-separator"
            aria-hidden="true"
          ></span>

          <div class="mockup-status-control">
            <IconButton
              icon={Check}
              label={getPromptStatusToggleLabel(prompt.status)}
              title={getPromptStatusToggleLabel(prompt.status)}
              hoverVariant="success"
              ariaPressed={prompt.status === 'completed'}
              class={getPromptStatusToggleClass(prompt.status)}
              testId={`mockup-prompt-status-toggle-${prompt.id}`}
              onclick={() => togglePromptStatus(prompt.id)}
            />

            {#if prompt.status === 'completed'}
              <span
                class="mockup-status-pill"
                data-status="completed"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                Completed
              </span>
            {:else if prompt.status === 'in-progress'}
              <span
                class="mockup-status-pill"
                data-status="in-progress"
              >
                <Hourglass size={14} aria-hidden="true" />
                In Progress
              </span>
            {:else}
              <span
                class="mockup-status-pill"
                data-status="todo"
              >
                <CircleDashed size={14} aria-hidden="true" />
                Todo
              </span>
            {/if}
          </div>
        </div>
      </header>

      <span class="mockup-title-body-separator" aria-hidden="true"></span>

      <div
        class="mockup-monaco-shell"
        style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          class="mockup-monaco-host"
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet SubfolderEditor(folder: MockSubfolder, index: number)}
  <article class="mockup-prompt-editor-card mockup-subfolder-card" data-testid={`mockup-subfolder-${folder.id}`}>
    <PromptEditorSidebar
      promptId={folder.id}
      promptFolderId="mockup-prompts"
      title={folder.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === mockSubfolders.length - 1}
      onMoveUp={() => moveSubfolder(index, -1)}
      onMoveDown={() => moveSubfolder(index, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div class="mockup-prompt-editor-body mockup-subfolder-body">
      <header
        class="mockup-prompt-editor-title-bar mockup-subfolder-title-bar"
        style={`height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
        role="button"
        tabindex="0"
        aria-expanded={folder.isExpanded}
        onclick={() => toggleSubfolder(folder.id)}
        onkeydown={(event) => handleSubfolderTitleKeydown(event, folder.id)}
      >
        <div class="mockup-subfolder-title-main">
          <button
            class="mockup-subfolder-toggle"
            type="button"
            aria-label={folder.isExpanded ? 'Collapse folder' : 'Expand folder'}
            aria-expanded={folder.isExpanded}
            onclick={(event) => {
              event.stopPropagation()
              toggleSubfolder(folder.id)
            }}
          >
            {#if folder.isExpanded}
              <ChevronDown size={18} aria-hidden="true" />
            {:else}
              <ChevronRight size={18} aria-hidden="true" />
            {/if}
          </button>

          <span class="mockup-title-icon mockup-folder-title-icon">
            <Folder size={25} aria-hidden="true" />
          </span>

          <div class="mockup-title-copy">
            <div class="mockup-subfolder-title-line">
              <span class="mockup-subfolder-title">{folder.title}</span>
              <button
                class="mockup-subfolder-title-edit"
                type="button"
                aria-label="Edit folder title"
                onclick={(event) => event.stopPropagation()}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>
            <div class="mockup-metadata-row">
              <span>{getPromptLabel(folder.prompts.length)}</span>
              {@render SeparatorDot()}
              <span>{getSubfolderLabel(folder.subfolderCount)}</span>
            </div>
          </div>
        </div>
      </header>

      <span class="mockup-title-body-separator" aria-hidden="true"></span>

      <div class="mockup-folder-fields">
        {#each folder.fields as field (field.id)}
          <section class="mockup-folder-field">
            <label class="mockup-folder-field-label" for={`mockup-folder-field-${field.id}`}>
              <span class="mockup-folder-field-label-text">{field.label}</span>
              <span class="mockup-folder-field-helper">- {field.helperText}</span>
            </label>
            <div
              class="mockup-monaco-shell mockup-folder-monaco-shell"
              style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
            >
              <div
                id={`mockup-folder-field-${field.id}`}
                class="mockup-monaco-host"
                aria-label={field.label}
                use:mountMockupMonaco={field}
              ></div>
            </div>
          </section>
        {/each}
      </div>
    </div>
  </article>
{/snippet}

<section
  class="prompt-folder-subfolders-mockup"
  data-testid="prompt-folder-subfolders-mockup"
>
  <div class="mockup-editor-row">
    {@render PromptDividerRow(null, null)}
    {#each topLevelPrompts as prompt, index (prompt.id)}
      {@render PromptEditor(prompt, index, topLevelPrompts.length)}
      {@render PromptDividerRow(prompt.id, null)}
    {/each}

    {#each mockSubfolders as folder, folderIndex (folder.id)}
      {@const previousFolder = getPreviousSubfolder(folderIndex)}
      {#if previousFolder}
        {@render SubfolderDividerRow(previousFolder)}
      {/if}

      <div class="mockup-subfolder-section">
        {@render SubfolderEditor(folder, folderIndex)}

        {#if folder.isExpanded}
          <div class="mockup-subfolder-children">
            <div class="mockup-tree-gutter" aria-hidden="true">
              <span class="mockup-tree-line"></span>
            </div>

            <div class="mockup-child-editor-row">
              {@render PromptDividerRow(null, folder.id)}
              {#each folder.prompts as prompt, promptIndex (prompt.id)}
                {@render PromptEditor(prompt, promptIndex, folder.prompts.length)}
                {@render PromptDividerRow(prompt.id, folder.id)}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .prompt-folder-subfolders-mockup {
    --mockup-monaco-editor-background: var(--ui-editor-normal-surface);
    --mockup-folder-line: var(--ui-neutral-muted-border);

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 0;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-subfolder-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-subfolder-children {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-tree-gutter {
    min-width: 0;
    position: relative;
  }

  .mockup-tree-line {
    background: var(--mockup-folder-line);
    border-radius: var(--cthulhu-ui-radius-control);
    bottom: 12px;
    left: 13px;
    position: absolute;
    top: 0;
    width: 2px;
  }

  .mockup-child-editor-row {
    align-items: stretch;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-insertion-rail {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    height: 10px;
    justify-content: center;
    min-width: 0;
    position: relative;
    z-index: 2;
  }

  .mockup-insertion-line {
    background: var(--ui-neutral-muted-border);
    height: 1px;
    inset-inline: 0;
    opacity: 0;
    position: absolute;
    transition: opacity 120ms ease;
  }

  .mockup-insertion-actions {
    align-items: center;
    display: flex;
    gap: 2px;
    opacity: 0;
    pointer-events: none;
    position: relative;
    transition: opacity 120ms ease;
  }

  .mockup-insertion-rail:hover .mockup-insertion-line,
  .mockup-insertion-rail:focus-within .mockup-insertion-line,
  .mockup-insertion-rail:hover .mockup-insertion-actions,
  .mockup-insertion-rail:focus-within .mockup-insertion-actions {
    opacity: 1;
  }

  .mockup-insertion-rail:hover .mockup-insertion-actions,
  .mockup-insertion-rail:focus-within .mockup-insertion-actions {
    pointer-events: auto;
  }

  .mockup-insertion-button {
    align-items: center;
    background: var(--ui-card-overlay-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    height: 26px;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
    width: 26px;
  }

  .mockup-insertion-button:hover {
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-insertion-button:focus-visible {
    box-shadow: 0 0 0 2px var(--ui-hoverable-icon-glyph);
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-prompt-editor-card {
    align-items: stretch;
    background: var(--ui-card-overlay-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
  }

  .mockup-prompt-editor-body {
    align-content: start;
    background: var(--ui-editor-normal-surface);
    border-radius: var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);
    display: grid;
    gap: 0;
    grid-template-rows: auto 1px auto;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  .mockup-subfolder-body {
    background: var(--ui-editor-normal-surface);
  }

  .mockup-prompt-editor-title-bar {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
    padding: 8px 8px 8px 16px;
  }

  .mockup-subfolder-title-bar {
    cursor: pointer;
    grid-template-columns: minmax(0, 1fr);
    outline: none;
    padding: 8px 16px;
  }

  .mockup-subfolder-title-bar:focus-visible {
    box-shadow: inset 0 0 0 2px var(--ui-hoverable-icon-glyph);
  }

  .mockup-prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-subfolder-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 24px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-title-icon {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .mockup-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .mockup-subfolder-title-line {
    align-items: center;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .mockup-subfolder-title {
    color: var(--ui-normal-text);
    flex: 0 1 auto;
    font-size: 16px;
    font-weight: 700;
    line-height: 21px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mockup-subfolder-title-edit,
  .mockup-subfolder-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
  }

  .mockup-subfolder-title-edit {
    height: 22px;
    width: 22px;
  }

  .mockup-subfolder-toggle {
    height: 32px;
    width: 24px;
  }

  .mockup-subfolder-title-edit:hover,
  .mockup-subfolder-toggle:hover {
    background: var(--ui-card-overlay-surface);
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-subfolder-title-edit:focus-visible,
  .mockup-subfolder-toggle:focus-visible {
    box-shadow: inset 0 0 0 2px var(--ui-hoverable-icon-glyph);
  }

  .mockup-title-input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    height: 22px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .mockup-title-input::placeholder {
    color: var(--ui-secondary-text);
  }

  .mockup-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 12px;
    gap: 7px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .mockup-metadata-folder {
    align-items: center;
    color: var(--ui-secondary-text);
    display: inline-flex;
    flex: 0 1 auto;
    gap: 4px;
    max-width: 120px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.mockup-metadata-folder-icon) {
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
    stroke-width: 2.4;
  }

  .mockup-separator-dot {
    background: var(--ui-muted-text);
    border-radius: var(--cthulhu-ui-radius-control);
    flex: 0 0 3px;
    height: 3px;
    width: 3px;
  }

  .mockup-title-actions {
    align-items: center;
    align-self: stretch;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .mockup-title-actions-separator {
    align-self: stretch;
    background: var(--ui-neutral-normal-border);
    flex: 0 0 1px;
    margin: -8px 0;
    width: 1px;
  }

  .mockup-status-control {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
    gap: 4px;
  }

  :global(.mockup-status-toggle-button-completed) {
    color: var(--ui-success-normal-text);
  }

  :global(.mockup-status-toggle-button-in-progress) {
    color: var(--ui-warning-icon-glyph);
  }

  .mockup-status-pill {
    align-items: center;
    border-radius: 999px;
    box-sizing: border-box;
    display: inline-flex;
    flex: 0 0 116px;
    gap: 6px;
    justify-content: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 116px;
  }

  .mockup-status-pill[data-status='completed'] {
    border: 1px solid var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    padding: 4px 4px;
  }

  .mockup-status-pill[data-status='in-progress'] {
    border: 1px solid var(--ui-warning-normal-border);
    color: var(--ui-warning-icon-glyph);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    padding: 4px 4px;
  }

  .mockup-status-pill[data-status='todo'] {
    border: 1px solid var(--ui-neutral-normal-border);
    color: var(--ui-secondary-text);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    padding: 4px 4px;
  }

  .mockup-status-pill[data-status='in-progress'] :global(svg) {
    color: var(--ui-warning-icon-glyph);
    flex: 0 0 auto;
  }

  .mockup-status-pill[data-status='completed'] :global(svg) {
    color: var(--ui-success-normal-text);
    flex: 0 0 auto;
  }

  .mockup-status-pill[data-status='todo'] :global(svg) {
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
  }

  .mockup-title-body-separator {
    background: var(--ui-neutral-muted-border);
    height: 1px;
    min-width: 0;
    width: 100%;
  }

  .mockup-folder-fields {
    background: var(--ui-editor-normal-surface);
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .mockup-folder-field {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .mockup-folder-field + .mockup-folder-field {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .mockup-folder-field-label {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    font-weight: 700;
    gap: 5px;
    height: 28px;
    letter-spacing: 0;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    padding: 0 16px;
    white-space: nowrap;
  }

  .mockup-folder-field-label-text {
    flex: 0 0 auto;
  }

  .mockup-folder-field-helper {
    color: var(--ui-muted-text);
    flex: 1 1 auto;
    font-weight: 400;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mockup-monaco-shell {
    background: var(--mockup-monaco-editor-background);
    box-sizing: border-box;
    min-width: 0;
  }

  .mockup-folder-monaco-shell {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .mockup-monaco-host {
    min-height: 60px;
    min-width: 0;
    position: relative;
    width: 100%;
  }
</style>
