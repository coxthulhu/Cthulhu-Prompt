<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronDown, FileText, Folder, FolderOpen, Plus } from 'lucide-svelte'
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

  type MockPrompt = {
    id: string
    title: string
    folderId: string
    folderPath: string
    modifiedLabel: string
    text: string
  }

  type MockFolder = {
    id: string
    title: string
    accentColor: string
    modifiedLabel: string
    promptIds: string[]
    subfolders: MockFolder[]
  }

  let mockFolders = $state<MockFolder[]>([
    {
      id: 'feature-work',
      title: 'Feature Work',
      accentColor: 'var(--ui-accent-strong-border)',
      modifiedLabel: 'Updated today',
      promptIds: ['mockup-outline', 'mockup-refactor'],
      subfolders: [
        {
          id: 'feature-work-reviews',
          title: 'Reviews',
          accentColor: 'var(--ui-warning-icon-glyph)',
          modifiedLabel: 'Updated 1 hr ago',
          promptIds: ['mockup-review'],
          subfolders: []
        },
        {
          id: 'feature-work-tests',
          title: 'Tests',
          accentColor: 'oklch(0.72 0.16 145)',
          modifiedLabel: 'Updated yesterday',
          promptIds: ['mockup-tests'],
          subfolders: []
        }
      ]
    },
    {
      id: 'shipping',
      title: 'Shipping',
      accentColor: 'var(--ui-info-strong-border)',
      modifiedLabel: 'Updated Jun 12',
      promptIds: ['mockup-release'],
      subfolders: [
        {
          id: 'shipping-polish',
          title: 'Polish',
          accentColor: 'var(--ui-accent-normal-text)',
          modifiedLabel: 'Updated Jun 8',
          promptIds: ['mockup-polish'],
          subfolders: []
        }
      ]
    }
  ])

  let mockPrompts = $state<Record<string, MockPrompt>>({
    'mockup-outline': {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folderId: 'feature-work',
      folderPath: 'Feature Work',
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
    'mockup-refactor': {
      id: 'mockup-refactor',
      title: 'Refactor editor sizing controller',
      folderId: 'feature-work',
      folderPath: 'Feature Work',
      modifiedLabel: 'Updated 18 min ago',
      text: [
        'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
        '',
        'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
      ].join('\n')
    },
    'mockup-review': {
      id: 'mockup-review',
      title: 'Review drag and drop persistence',
      folderId: 'feature-work-reviews',
      folderPath: 'Feature Work / Reviews',
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
    'mockup-tests': {
      id: 'mockup-tests',
      title: 'Write Playwright coverage',
      folderId: 'feature-work-tests',
      folderPath: 'Feature Work / Tests',
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
    'mockup-release': {
      id: 'mockup-release',
      title: 'Draft release notes',
      folderId: 'shipping',
      folderPath: 'Shipping',
      modifiedLabel: 'Updated Jun 12',
      text: [
        'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
        '',
        'Keep the tone concise and avoid implementation details unless they affect users directly.'
      ].join('\n')
    },
    'mockup-polish': {
      id: 'mockup-polish',
      title: 'Polish settings controls',
      folderId: 'shipping-polish',
      folderPath: 'Shipping / Polish',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    }
  })

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
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-230040551/${promptId}.md`)

  const getFolderPrompts = (folder: MockFolder): MockPrompt[] =>
    folder.promptIds
      .map((promptId) => mockPrompts[promptId])
      .filter((prompt): prompt is MockPrompt => Boolean(prompt))

  const countPrompts = (folder: MockFolder): number =>
    folder.promptIds.length +
    folder.subfolders.reduce((promptCount, subfolder) => promptCount + countPrompts(subfolder), 0)

  const countSubfolders = (folder: MockFolder): number =>
    folder.subfolders.length +
    folder.subfolders.reduce(
      (subfolderCount, subfolder) => subfolderCount + countSubfolders(subfolder),
      0
    )

  const findFolderById = (folderId: string, folders: MockFolder[] = mockFolders): MockFolder | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder

      const match = findFolderById(folderId, folder.subfolders)
      if (match) return match
    }

    return null
  }

  const getFolderPath = (folderId: string, folders: MockFolder[] = mockFolders, path: string[] = []) => {
    for (const folder of folders) {
      const nextPath = [...path, folder.title]
      if (folder.id === folderId) return nextPath.join(' / ')

      const nestedPath = getFolderPath(folderId, folder.subfolders, nextPath)
      if (nestedPath) return nestedPath
    }

    return 'Prompts'
  }

  let nextPromptSequence = $state(1)

  const createNewPrompt = (folder: MockFolder): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folderId: folder.id,
      folderPath: getFolderPath(folder.id),
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptAfter = (folderId: string, previousPromptId: string | null) => {
    const folder = findFolderById(folderId)
    if (!folder) return

    const nextPrompt = createNewPrompt(folder)
    mockPrompts = {
      ...mockPrompts,
      [nextPrompt.id]: nextPrompt
    }

    if (previousPromptId === null) {
      folder.promptIds = [nextPrompt.id, ...folder.promptIds]
      return
    }

    const previousPromptIndex = folder.promptIds.indexOf(previousPromptId)
    if (previousPromptIndex === -1) {
      folder.promptIds = [...folder.promptIds, nextPrompt.id]
      return
    }

    const nextPromptIds = [...folder.promptIds]
    nextPromptIds.splice(previousPromptIndex + 1, 0, nextPrompt.id)
    folder.promptIds = nextPromptIds
  }

  const movePrompt = (folderId: string, promptId: string, direction: -1 | 1) => {
    const folder = findFolderById(folderId)
    if (!folder) return

    const promptIndex = folder.promptIds.indexOf(promptId)
    const targetIndex = promptIndex + direction
    if (promptIndex === -1 || targetIndex < 0 || targetIndex >= folder.promptIds.length) return

    const nextPromptIds = [...folder.promptIds]
    const [movedPromptId] = nextPromptIds.splice(promptIndex, 1)
    nextPromptIds.splice(targetIndex, 0, movedPromptId)
    folder.promptIds = nextPromptIds
  }

  const removePromptId = (promptId: string, folders: MockFolder[]) => {
    for (const folder of folders) {
      folder.promptIds = folder.promptIds.filter((folderPromptId) => folderPromptId !== promptId)
      removePromptId(promptId, folder.subfolders)
    }
  }

  const deletePrompt = (promptId: string) => {
    removePromptId(promptId, mockFolders)
    const remainingPrompts = { ...mockPrompts }
    delete remainingPrompts[promptId]
    mockPrompts = remainingPrompts
  }

  const noopPromptTreeDrop = () => undefined

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

  const rootStyle =
    'box-sizing:border-box;min-width:0;padding:0 0 8px;width:100%;--mockup-monaco-editor-background:#1f1f1f;'
  const folderStackStyle =
    'align-items:stretch;display:grid;gap:12px;grid-template-columns:minmax(0,1fr);min-width:0;width:100%;'
  const folderContentStyle =
    'display:grid;gap:0;grid-template-columns:minmax(0,1fr);min-width:0;width:100%;'
  const subfolderStackStyle =
    'display:grid;gap:10px;grid-template-columns:minmax(0,1fr);margin-top:12px;min-width:0;width:100%;'
  const promptCardStyle =
    'align-items:stretch;background:var(--ui-card-overlay-surface);border-radius:var(--cthulhu-ui-radius-card);box-sizing:border-box;display:grid;grid-template-columns:36px minmax(0,1fr);min-width:0;overflow:hidden;'
  const promptEditorBodyStyle =
    'align-content:start;background:var(--ui-editor-normal-surface);border-radius:var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);display:grid;gap:0;grid-template-rows:auto 1px auto;min-width:0;position:relative;z-index:1;'
  const promptTitleBarStyle =
    'align-items:center;background:transparent;border:0;border-radius:0;display:grid;gap:8px;grid-template-columns:minmax(0,1fr) auto;min-width:0;overflow:hidden;padding:8px 16px;'
  const promptTitleMainStyle =
    'align-items:center;display:grid;gap:8px;grid-template-columns:40px minmax(0,1fr);min-width:0;'
  const titleIconStyle =
    'align-items:center;border-radius:var(--cthulhu-ui-radius-card);color:var(--ui-hoverable-icon-glyph);display:flex;flex:0 0 40px;height:40px;justify-content:center;width:40px;'
  const titleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const titleInputStyle =
    'background:transparent;border:0;color:var(--ui-normal-text);font-family:inherit;font-size:15px;font-weight:600;height:22px;line-height:20px;min-width:0;outline:none;padding:0;width:100%;'
  const metadataRowStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:12px;gap:7px;line-height:16px;min-width:0;overflow:hidden;white-space:nowrap;'
  const metadataFolderStyle =
    'align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:4px;max-width:180px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const separatorDotStyle =
    'background:var(--ui-muted-text);border-radius:var(--cthulhu-ui-radius-control);flex:0 0 3px;height:3px;width:3px;'
  const titleBodySeparatorStyle =
    'background:var(--ui-neutral-muted-border);height:1px;min-width:0;width:100%;'
  const monacoShellStyle =
    'background:var(--mockup-monaco-editor-background);box-sizing:border-box;min-width:0;'
  const monacoHostStyle = 'min-height:60px;min-width:0;position:relative;width:100%;'
</script>

{#snippet SeparatorDot()}
  <span style={separatorDotStyle} aria-hidden="true"></span>
{/snippet}

{#snippet PromptDividerRow(folderId: string, previousPromptId: string | null)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(folderId, previousPromptId)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : `mockup-prompt-divider-add-initial-${folderId}`}
  />
{/snippet}

{#snippet FolderHeader(folder: MockFolder, level: number)}
  <header
    style={`align-items:center;background:linear-gradient(90deg, color-mix(in srgb, ${folder.accentColor} 14%, transparent), transparent 72%);border:1px solid var(--ui-neutral-muted-border);border-left:4px solid ${folder.accentColor};border-radius:var(--cthulhu-ui-radius-card);box-sizing:border-box;display:grid;gap:10px;grid-template-columns:minmax(0,1fr) auto;min-width:0;padding:${level === 0 ? 10 : 8}px 12px;`}
  >
    <div
      style="align-items:center;display:grid;gap:10px;grid-template-columns:auto minmax(0,1fr);min-width:0;"
    >
      <span
        style={`align-items:center;background:color-mix(in srgb, ${folder.accentColor} 20%, transparent);border:1px solid color-mix(in srgb, ${folder.accentColor} 36%, transparent);border-radius:var(--cthulhu-ui-radius-card);color:${folder.accentColor};display:flex;height:${level === 0 ? 36 : 32}px;justify-content:center;width:${level === 0 ? 36 : 32}px;`}
      >
        {#if level === 0}
          <FolderOpen size={20} aria-hidden="true" />
        {:else}
          <Folder size={18} aria-hidden="true" />
        {/if}
      </span>

      <div style="display:grid;gap:3px;min-width:0;">
        <div
          style="align-items:center;display:flex;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;"
        >
          <ChevronDown
            size={15}
            aria-hidden="true"
            color="var(--ui-secondary-icon-glyph)"
            style="flex:0 0 auto;"
          />
          <span
            style={`color:var(--ui-normal-text);font-size:${level === 0 ? 15 : 14}px;font-weight:650;line-height:20px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`}
          >
            {folder.title}
          </span>
        </div>

        <div style={metadataRowStyle}>
          <span>{countPrompts(folder)} prompts</span>
          {@render SeparatorDot()}
          <span>{countSubfolders(folder)} folders</span>
          {@render SeparatorDot()}
          <span>{folder.modifiedLabel}</span>
        </div>
      </div>
    </div>

    <button
      type="button"
      style="align-items:center;background:var(--ui-neutral-normal-surface);border:1px solid var(--ui-neutral-muted-border);border-radius:var(--cthulhu-ui-radius-control);color:var(--ui-normal-text);display:inline-flex;font:inherit;font-size:12px;font-weight:600;gap:6px;height:30px;line-height:16px;padding:0 10px;white-space:nowrap;"
      onclick={() => addPromptAfter(folder.id, null)}
    >
      <Plus size={14} aria-hidden="true" />
      Prompt
    </button>
  </header>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number, folderPromptCount: number)}
  <article style={promptCardStyle} data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId={prompt.folderId}
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === folderPromptCount - 1}
      onMoveUp={() => movePrompt(prompt.folderId, prompt.id, -1)}
      onMoveDown={() => movePrompt(prompt.folderId, prompt.id, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div style={promptEditorBodyStyle}>
      <header
        style={`${promptTitleBarStyle}height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      >
        <div style={promptTitleMainStyle}>
          <span style={titleIconStyle}>
            <FileText size={24} aria-hidden="true" />
          </span>

          <div style={titleCopyStyle}>
            <input style={titleInputStyle} value={prompt.title} aria-label="Prompt title" />
            <div style={metadataRowStyle}>
              <span style={metadataFolderStyle} title={prompt.folderPath}>
                <Folder
                  size={12}
                  aria-hidden="true"
                  color="var(--ui-secondary-icon-glyph)"
                  style="flex:0 0 auto;stroke-width:2.4;"
                />
                {prompt.folderPath}
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
        style={`${monacoShellStyle}padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          style={monacoHostStyle}
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet FolderSection(folder: MockFolder, level: number)}
  {@const folderPrompts = getFolderPrompts(folder)}
  <section
    style={`box-sizing:border-box;display:grid;gap:0;min-width:0;padding:${level === 0 ? 0 : '0 0 0 18px'};position:relative;width:100%;`}
    data-testid={`mockup-folder-${folder.id}`}
  >
    {#if level > 0}
      <span
        style={`background:${folder.accentColor};border-radius:999px;bottom:8px;left:4px;opacity:0.7;position:absolute;top:8px;width:2px;`}
        aria-hidden="true"
      ></span>
    {/if}

    {@render FolderHeader(folder, level)}

    <div style={`${folderContentStyle}margin-top:8px;`}>
      {@render PromptDividerRow(folder.id, null)}
      {#each folderPrompts as prompt, index (prompt.id)}
        {@render PromptEditor(prompt, index, folderPrompts.length)}
        {@render PromptDividerRow(folder.id, prompt.id)}
      {/each}
    </div>

    {#if folder.subfolders.length > 0}
      <div style={subfolderStackStyle}>
        {#each folder.subfolders as subfolder (subfolder.id)}
          {@render FolderSection(subfolder, level + 1)}
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

<section style={rootStyle} data-testid="subfolders-230040551-mockup">
  <div style={folderStackStyle}>
    {#each mockFolders as folder (folder.id)}
      {@render FolderSection(folder, 0)}
    {/each}
  </div>
</section>
