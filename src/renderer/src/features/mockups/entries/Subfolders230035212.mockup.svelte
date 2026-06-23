<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import PromptEditorButtonBar from '@renderer/features/prompt-editor/PromptEditorButtonBar.svelte'
  import PromptDivider from '@renderer/features/prompt-editor/PromptDivider.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import {
    getLineHeightPx,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX
  } from '@renderer/features/prompt-editor/promptEditorSizing'

  type FolderPath = string[]

  type MockPrompt = {
    id: string
    title: string
    folderPath: FolderPath
    modifiedLabel: string
    text: string
  }

  type MockSubfolder = {
    id: string
    name: string
    path: FolderPath
    color: string
  }

  type MockFolder = {
    id: string
    name: string
    path: FolderPath
    color: string
    subfolders: MockSubfolder[]
  }

  const mockFolders: MockFolder[] = [
    {
      id: 'workspace',
      name: 'Workspace',
      path: ['Workspace'],
      color: '#8fb4ff',
      subfolders: [
        {
          id: 'workspace-imports',
          name: 'Imports',
          path: ['Workspace', 'Imports'],
          color: '#89d0c2'
        },
        {
          id: 'workspace-tests',
          name: 'Tests',
          path: ['Workspace', 'Tests'],
          color: '#e6b56f'
        }
      ]
    },
    {
      id: 'editor',
      name: 'Editor',
      path: ['Editor'],
      color: '#d99adf',
      subfolders: [
        {
          id: 'editor-monaco',
          name: 'Monaco',
          path: ['Editor', 'Monaco'],
          color: '#a7c86f'
        },
        {
          id: 'editor-polish',
          name: 'Polish',
          path: ['Editor', 'Polish'],
          color: '#ee9f86'
        }
      ]
    }
  ]

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folderPath: ['Workspace', 'Imports'],
      modifiedLabel: 'Updated 2 min ago',
      text: [
        'Review the workspace import flow and identify any edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
        '',
        'Return the findings as concrete bugs with file references and suggested tests.',
        '',
        'Include scenarios for partially written workspace files, prompts that reference folders removed during import, and imports where the destination workspace already has similarly named prompts.',
        '',
        'Separate confirmed issues from follow-up questions. Do not include general cleanup notes unless they can cause data loss or a visible recovery problem.'
      ].join('\n')
    },
    {
      id: 'mockup-refactor',
      title: 'Refactor editor sizing controller',
      folderPath: ['Editor', 'Monaco'],
      modifiedLabel: 'Updated 18 min ago',
      text: [
        'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
        '',
        'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
      ].join('\n')
    },
    {
      id: 'mockup-review',
      title: 'Review drag and drop persistence',
      folderPath: ['Workspace', 'Tests'],
      modifiedLabel: 'Updated 1 hr ago',
      text: [
        'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
        '',
        'List only issues that can produce user-visible regressions.',
        '',
        'Pay special attention to cross-folder moves, moving the first or last prompt in a folder, cancelled drags, and drops that happen while the target folder is collapsed.',
        '',
        'For each finding, include the smallest user flow that reproduces it and the assertion a Playwright test should make.'
      ].join('\n')
    },
    {
      id: 'mockup-tests',
      title: 'Write Playwright coverage',
      folderPath: ['Workspace', 'Tests'],
      modifiedLabel: 'Updated yesterday',
      text: [
        'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
        '',
        'Use the existing test helpers and data-testid selectors.',
        '',
        'Cover the add button above the first prompt and the add button after an existing prompt. Verify the new row appears in the expected position before typing.',
        '',
        'After navigation, assert that the prompt order, title text, Monaco body text, and selected folder are still restored.'
      ].join('\n')
    },
    {
      id: 'mockup-release',
      title: 'Draft release notes',
      folderPath: ['Workspace'],
      modifiedLabel: 'Updated Jun 12',
      text: [
        'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
        '',
        'Keep the tone concise and avoid implementation details unless they affect users directly.'
      ].join('\n')
    },
    {
      id: 'mockup-polish',
      title: 'Polish settings controls',
      folderPath: ['Editor', 'Polish'],
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    },
    {
      id: 'mockup-toolbar',
      title: 'Align prompt editor actions',
      folderPath: ['Editor'],
      modifiedLabel: 'Updated Jun 6',
      text: [
        'Adjust the prompt editor action row so copy, delete, and menu controls keep a stable hit target while long prompt titles truncate.',
        '',
        'Verify the layout at compact width and with a prompt body that wraps to several lines.'
      ].join('\n')
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

  const getEditorUri = (promptId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-230035212/${promptId}.md`)

  const getFolderLabel = (folderPath: FolderPath): string => folderPath.join(' / ')
  const isSameFolderPath = (left: FolderPath, right: FolderPath): boolean =>
    left.length === right.length && left.every((segment, index) => segment === right[index])
  const getPromptsForPath = (folderPath: FolderPath): MockPrompt[] =>
    mockPrompts.filter((prompt) => isSameFolderPath(prompt.folderPath, folderPath))
  const getFolderPromptCount = (folder: MockFolder): number =>
    mockPrompts.filter((prompt) => prompt.folderPath[0] === folder.name).length

  let nextPromptSequence = $state(1)

  const createNewPrompt = (folderPath: FolderPath): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folderPath: [...folderPath],
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptAfter = (previousPromptId: string | null, folderPath: FolderPath) => {
    const nextPrompt = createNewPrompt(folderPath)
    if (previousPromptId === null) {
      const firstPromptIndex = mockPrompts.findIndex((prompt) =>
        isSameFolderPath(prompt.folderPath, folderPath)
      )

      if (firstPromptIndex === -1) {
        mockPrompts = [...mockPrompts, nextPrompt]
        return
      }

      const nextPrompts = [...mockPrompts]
      nextPrompts.splice(firstPromptIndex, 0, nextPrompt)
      mockPrompts = nextPrompts
      return
    }

    const previousPromptIndex = mockPrompts.findIndex((prompt) => prompt.id === previousPromptId)
    if (previousPromptIndex === -1) {
      mockPrompts = [...mockPrompts, nextPrompt]
      return
    }

    const nextPrompts = [...mockPrompts]
    nextPrompts.splice(previousPromptIndex + 1, 0, nextPrompt)
    mockPrompts = nextPrompts
  }

  const movePrompt = (promptId: string, folderPath: FolderPath, direction: -1 | 1) => {
    const folderPromptIds = getPromptsForPath(folderPath).map((prompt) => prompt.id)
    const sourceFolderIndex = folderPromptIds.indexOf(promptId)
    const targetFolderIndex = sourceFolderIndex + direction
    if (
      sourceFolderIndex === -1 ||
      targetFolderIndex < 0 ||
      targetFolderIndex >= folderPromptIds.length
    ) {
      return
    }

    const sourceIndex = mockPrompts.findIndex(
      (prompt) => prompt.id === folderPromptIds[sourceFolderIndex]
    )
    const targetIndex = mockPrompts.findIndex(
      (prompt) => prompt.id === folderPromptIds[targetFolderIndex]
    )
    if (sourceIndex === -1 || targetIndex === -1) return

    const nextPrompts = [...mockPrompts]
    const sourcePrompt = nextPrompts[sourceIndex]
    nextPrompts[sourceIndex] = nextPrompts[targetIndex]
    nextPrompts[targetIndex] = sourcePrompt
    mockPrompts = nextPrompts
  }

  const deletePrompt = (promptId: string) => {
    mockPrompts = mockPrompts.filter((prompt) => prompt.id !== promptId)
  }

  const noopPromptTreeDrop = () => undefined

  const rootStyle = [
    'box-sizing:border-box',
    'min-width:0',
    'padding:0 0 8px',
    'width:100%'
  ].join(';')
  const folderStackStyle = [
    'display:grid',
    'gap:12px',
    'grid-template-columns:minmax(0,1fr)',
    'min-width:0',
    'width:100%'
  ].join(';')
  const folderShellStyle = (color: string) =>
    [
      'box-sizing:border-box',
      'display:grid',
      'gap:8px',
      'grid-template-columns:minmax(0,1fr)',
      'min-width:0',
      'overflow:hidden',
      'padding:8px 0 0',
      'position:relative',
      'width:100%',
      `border-top:1px solid color-mix(in srgb, ${color} 44%, var(--ui-neutral-muted-border))`
    ].join(';')
  const folderHeaderStyle = (color: string) =>
    [
      'align-items:center',
      'box-sizing:border-box',
      'display:grid',
      'gap:10px',
      'grid-template-columns:auto minmax(0,1fr) auto',
      'min-width:0',
      'padding:4px 2px 4px 0',
      'width:100%',
      `color:${color}`
    ].join(';')
  const folderIconStyle = (color: string) =>
    [
      'align-items:center',
      `background:color-mix(in srgb, ${color} 18%, transparent)`,
      `border:1px solid color-mix(in srgb, ${color} 34%, transparent)`,
      'border-radius:8px',
      'box-sizing:border-box',
      'display:flex',
      'height:34px',
      'justify-content:center',
      'width:34px'
    ].join(';')
  const folderNameStyle = [
    'color:var(--ui-normal-text)',
    'font-size:15px',
    'font-weight:650',
    'line-height:20px',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')
  const folderMetaStyle = [
    'align-items:center',
    'color:var(--ui-muted-text)',
    'display:flex',
    'font-size:12px',
    'gap:7px',
    'line-height:16px',
    'min-width:0',
    'white-space:nowrap'
  ].join(';')
  const promptListStyle = [
    'display:grid',
    'gap:0',
    'grid-template-columns:minmax(0,1fr)',
    'min-width:0',
    'width:100%'
  ].join(';')
  const subfolderWrapStyle = [
    'display:grid',
    'gap:8px',
    'grid-template-columns:minmax(0,1fr)',
    'min-width:0',
    'padding-left:18px',
    'position:relative',
    'width:100%'
  ].join(';')
  const subfolderHeaderStyle = (color: string) =>
    [
      'align-items:center',
      `background:linear-gradient(90deg,color-mix(in srgb, ${color} 14%, var(--ui-card-overlay-surface)),transparent)`,
      `border:1px solid color-mix(in srgb, ${color} 28%, var(--ui-neutral-muted-border))`,
      'border-radius:8px',
      'box-sizing:border-box',
      'display:grid',
      'gap:8px',
      'grid-template-columns:auto auto minmax(0,1fr) auto',
      'min-width:0',
      'padding:6px 10px',
      'width:100%'
    ].join(';')
  const subfolderNameStyle = [
    'color:var(--ui-normal-text)',
    'font-size:13px',
    'font-weight:650',
    'line-height:18px',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')
  const subfolderCountStyle = [
    'color:var(--ui-secondary-text)',
    'font-size:12px',
    'line-height:16px',
    'white-space:nowrap'
  ].join(';')
  const separatorDotStyle = [
    'background:var(--ui-muted-text)',
    'border-radius:var(--cthulhu-ui-radius-control)',
    'display:inline-block',
    'flex:0 0 3px',
    'height:3px',
    'width:3px'
  ].join(';')
  const promptEditorCardStyle = [
    'align-items:stretch',
    'background:var(--ui-card-overlay-surface)',
    'border-radius:var(--cthulhu-ui-radius-card)',
    'box-sizing:border-box',
    'display:grid',
    'grid-template-columns:36px minmax(0,1fr)',
    'min-width:0',
    'overflow:hidden'
  ].join(';')
  const promptEditorBodyStyle = [
    'align-content:start',
    'background:var(--ui-editor-normal-surface)',
    'border-radius:var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card)',
    'display:grid',
    'gap:0',
    'grid-template-rows:auto 1px auto',
    'min-width:0',
    'position:relative',
    'z-index:1'
  ].join(';')
  const titleBarBaseStyle = [
    'align-items:center',
    'background:transparent',
    'border:0',
    'border-radius:0',
    'display:grid',
    'gap:8px',
    'grid-template-columns:minmax(0,1fr) auto',
    `height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px`,
    `min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px`,
    `max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px`,
    'min-width:0',
    'overflow:hidden',
    'padding:8px 16px'
  ].join(';')
  const titleMainStyle = [
    'align-items:center',
    'display:grid',
    'gap:8px',
    'grid-template-columns:40px minmax(0,1fr)',
    'min-width:0'
  ].join(';')
  const titleIconStyle = [
    'align-items:center',
    'border-radius:var(--cthulhu-ui-radius-card)',
    'color:var(--ui-hoverable-icon-glyph)',
    'display:flex',
    'flex:0 0 40px',
    'height:40px',
    'justify-content:center',
    'width:40px'
  ].join(';')
  const titleCopyStyle = ['display:grid', 'gap:4px', 'min-width:0'].join(';')
  const titleInputStyle = [
    'background:transparent',
    'border:0',
    'color:var(--ui-normal-text)',
    'font-family:inherit',
    'font-size:15px',
    'font-weight:600',
    'height:22px',
    'line-height:20px',
    'min-width:0',
    'outline:none',
    'padding:0',
    'width:100%'
  ].join(';')
  const metadataRowStyle = [
    'align-items:center',
    'color:var(--ui-muted-text)',
    'display:flex',
    'flex-wrap:nowrap',
    'font-size:12px',
    'gap:7px',
    'line-height:16px',
    'min-width:0',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';')
  const metadataFolderStyle = [
    'align-items:center',
    'color:var(--ui-secondary-text)',
    'display:inline-flex',
    'flex:0 1 auto',
    'gap:4px',
    'max-width:180px',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')
  const titleBodySeparatorStyle = [
    'background:var(--ui-neutral-muted-border)',
    'height:1px',
    'min-width:0',
    'width:100%'
  ].join(';')
  const monacoShellBaseStyle = [
    'background:#1f1f1f',
    'box-sizing:border-box',
    'min-width:0'
  ].join(';')
  const monacoHostStyle = [
    'min-height:60px',
    'min-width:0',
    'position:relative',
    'width:100%'
  ].join(';')

  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const createEditor = (host: HTMLElement, prompt: MockPrompt) => {
    const existingModel = monaco.editor.getModel(getEditorUri(prompt.id))
    const model =
      existingModel ?? monaco.editor.createModel(prompt.text, 'markdown', getEditorUri(prompt.id))
    model.setValue(prompt.text)

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
        height: clampEditorHeight(lineHeightPx * getLineCount(prompt.text))
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
      prompt.text = editor.getValue()
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

  const mountMockupMonaco = (node: HTMLElement, prompt: MockPrompt) => {
    // Side effect: create a local Monaco editor for this mock prompt and dispose it on teardown.
    const destroy = createEditor(node, prompt)

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
  <span style={separatorDotStyle} aria-hidden="true"></span>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, folderPath: FolderPath)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(previousPromptId, folderPath)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : `mockup-prompt-divider-add-initial-${folderPath.join('-').toLowerCase()}`}
  />
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number, promptCount: number)}
  <article
    class="mockup-prompt-editor-card"
    style={promptEditorCardStyle}
    data-testid={`mockup-prompt-editor-${prompt.id}`}
  >
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId={`mockup-${prompt.folderPath.join('-').toLowerCase()}`}
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === promptCount - 1}
      onMoveUp={() => movePrompt(prompt.id, prompt.folderPath, -1)}
      onMoveDown={() => movePrompt(prompt.id, prompt.folderPath, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div class="mockup-prompt-editor-body" style={promptEditorBodyStyle}>
      <header class="mockup-prompt-editor-title-bar" style={titleBarBaseStyle}>
        <div class="mockup-prompt-editor-title-main" style={titleMainStyle}>
          <span class="mockup-title-icon" style={titleIconStyle}>
            <FileText size={24} aria-hidden="true" />
          </span>

          <div class="mockup-title-copy" style={titleCopyStyle}>
            <input
              class="mockup-title-input"
              style={titleInputStyle}
              value={prompt.title}
              aria-label="Prompt title"
            />
            <div class="mockup-metadata-row" style={metadataRowStyle}>
              <span
                class="mockup-metadata-folder"
                style={metadataFolderStyle}
                title={getFolderLabel(prompt.folderPath)}
              >
                <Folder
                  size={12}
                  style="color:var(--ui-secondary-icon-glyph);flex:0 0 auto;stroke-width:2.4;"
                  aria-hidden="true"
                />
                {getFolderLabel(prompt.folderPath)}
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

        <PromptEditorButtonBar
          title={prompt.title}
          draftText={prompt.text}
          onDelete={() => deletePrompt(prompt.id)}
        />
      </header>

      <span style={titleBodySeparatorStyle} aria-hidden="true"></span>

      <div
        class="mockup-monaco-shell"
        style={`${monacoShellBaseStyle};padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          class="mockup-monaco-host"
          style={monacoHostStyle}
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet PromptList(folderPath: FolderPath)}
  {@const prompts = getPromptsForPath(folderPath)}
  <div style={promptListStyle}>
    {@render PromptDividerRow(null, folderPath)}
    {#each prompts as prompt, index (prompt.id)}
      {@render PromptEditor(prompt, index, prompts.length)}
      {@render PromptDividerRow(prompt.id, folderPath)}
    {/each}
  </div>
{/snippet}

{#snippet SubfolderSection(subfolder: MockSubfolder)}
  {@const promptCount = getPromptsForPath(subfolder.path).length}
  <section style={subfolderWrapStyle}>
    <header style={subfolderHeaderStyle(subfolder.color)}>
      <ChevronRight
        size={14}
        style="color:var(--ui-muted-text);stroke-width:2.4;"
        aria-hidden="true"
      />
      <Folder size={16} style={`color:${subfolder.color};stroke-width:2.4;`} aria-hidden="true" />
      <div style={subfolderNameStyle}>{subfolder.name}</div>
      <div style={subfolderCountStyle}>
        {promptCount}
        {promptCount === 1 ? 'prompt' : 'prompts'}
      </div>
    </header>

    {@render PromptList(subfolder.path)}
  </section>
{/snippet}

{#snippet FolderSection(folder: MockFolder)}
  {@const directPromptCount = getPromptsForPath(folder.path).length}
  {@const folderPromptCount = getFolderPromptCount(folder)}
  <section style={folderShellStyle(folder.color)}>
    <header style={folderHeaderStyle(folder.color)}>
      <div style={folderIconStyle(folder.color)}>
        <FolderOpen size={19} style="stroke-width:2.4;" aria-hidden="true" />
      </div>

      <div style="display:grid;gap:2px;min-width:0;">
        <div style={folderNameStyle}>{folder.name}</div>
        <div style={folderMetaStyle}>
          <span>
            {folderPromptCount}
            {folderPromptCount === 1 ? 'prompt' : 'prompts'}
          </span>
          {@render SeparatorDot()}
          <span>
            {folder.subfolders.length}
            {folder.subfolders.length === 1 ? 'subfolder' : 'subfolders'}
          </span>
        </div>
      </div>

      <div style={subfolderCountStyle}>
        {directPromptCount}
        direct
      </div>
    </header>

    {@render PromptList(folder.path)}

    <div style="display:grid;gap:10px;min-width:0;width:100%;">
      {#each folder.subfolders as subfolder (subfolder.id)}
        {@render SubfolderSection(subfolder)}
      {/each}
    </div>
  </section>
{/snippet}

<section
  class="subfolders-230035212-mockup"
  style={rootStyle}
  data-testid="subfolders-230035212-mockup"
>
  <div style={folderStackStyle}>
    {#each mockFolders as folder (folder.id)}
      {@render FolderSection(folder)}
    {/each}
  </div>
</section>
