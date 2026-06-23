<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronDown, ChevronRight, FileText, Folder, Pencil } from 'lucide-svelte'
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
    folder: string
    modifiedLabel: string
    text: string
  }

  type MockFolder = {
    id: string
    title: string
    children: MockTreeItem[]
  }

  type MockTreeItem =
    | {
        kind: 'folder'
        folder: MockFolder
      }
    | {
        kind: 'prompt'
        promptId: string
      }

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Workspace imports',
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
      folder: 'Workspace imports',
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
      folder: 'Prompt tree',
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
      folder: 'Prompt tree',
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
      folder: 'Launch notes',
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
      folder: 'Launch notes',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    },
    {
      id: 'mockup-template',
      title: 'Create reusable bug report template',
      folder: 'Issue templates',
      modifiedLabel: 'Updated Jun 6',
      text: [
        'Create a compact bug report template for prompt editor issues.',
        '',
        'Include steps to reproduce, expected result, actual result, relevant workspace state, and whether the issue survives app restart.'
      ].join('\n')
    },
    {
      id: 'mockup-fixtures',
      title: 'Build nested workspace fixtures',
      folder: 'Issue templates',
      modifiedLabel: 'Updated Jun 3',
      text: [
        'Build fixture data for a workspace with root prompts, nested folders, and intentionally long prompt titles.',
        '',
        'Keep the data readable enough that future tests can copy only the folder shape they need.'
      ].join('\n')
    }
  ])

  let mockTree = $state<MockTreeItem[]>([
    {
      kind: 'folder',
      folder: {
        id: 'folder-workspace-imports',
        title: 'Workspace imports',
        children: [
          { kind: 'prompt', promptId: 'mockup-outline' },
          { kind: 'prompt', promptId: 'mockup-refactor' },
          {
            kind: 'folder',
            folder: {
              id: 'folder-issue-templates',
              title: 'Issue templates',
              children: [
                { kind: 'prompt', promptId: 'mockup-template' },
                { kind: 'prompt', promptId: 'mockup-fixtures' }
              ]
            }
          }
        ]
      }
    },
    {
      kind: 'folder',
      folder: {
        id: 'folder-prompt-tree',
        title: 'Prompt tree',
        children: [
          { kind: 'prompt', promptId: 'mockup-review' },
          { kind: 'prompt', promptId: 'mockup-tests' }
        ]
      }
    },
    {
      kind: 'folder',
      folder: {
        id: 'folder-launch-notes',
        title: 'Launch notes',
        children: [
          { kind: 'prompt', promptId: 'mockup-release' },
          { kind: 'prompt', promptId: 'mockup-polish' }
        ]
      }
    }
  ])

  const collapsedFolderIds = new SvelteSet<string>(['folder-launch-notes'])

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

  const styles = {
    root: [
      'box-sizing:border-box',
      'min-width:0',
      'padding:0 0 8px',
      'width:100%',
      '--mockup-monaco-editor-background:#1f1f1f',
      '--mockup-folder-title-surface:#252829',
      '--mockup-folder-title-surface-alt:#222526',
      '--mockup-folder-title-surface-nested:#2a2a24',
      '--mockup-folder-title-icon:#9fb39b',
      '--mockup-tree-line:#536058',
      '--mockup-tree-line-nested:#746f57'
    ].join(';'),
    editorRow: [
      'align-items:stretch',
      'display:grid',
      'gap:0',
      'grid-template-columns:minmax(0,1fr)',
      'min-width:0',
      'width:100%'
    ].join(';'),
    folderBlock: ['display:grid', 'grid-template-columns:minmax(0,1fr)', 'min-width:0'].join(';'),
    folderChildren: [
      'display:grid',
      'gap:0',
      'grid-template-columns:28px minmax(0,1fr)',
      'min-width:0'
    ].join(';'),
    folderChildrenContent: [
      'display:grid',
      'gap:0',
      'grid-template-columns:minmax(0,1fr)',
      'min-width:0'
    ].join(';'),
    treeGutter: ['display:flex', 'justify-content:center', 'min-width:0'].join(';'),
    treeLine: [
      'background:linear-gradient(var(--mockup-tree-line),var(--mockup-tree-line))',
      'border-radius:999px',
      'display:block',
      'min-height:100%',
      'opacity:.78',
      'width:2px'
    ].join(';'),
    promptIndent: ['display:grid', 'grid-template-columns:minmax(0,1fr)', 'min-width:0'].join(';'),
    promptEditorCard: [
      'align-items:stretch',
      'background:var(--ui-card-overlay-surface)',
      'border-radius:var(--cthulhu-ui-radius-card)',
      'box-sizing:border-box',
      'display:grid',
      'grid-template-columns:36px minmax(0,1fr)',
      'min-width:0',
      'overflow:hidden'
    ].join(';'),
    promptEditorBody: [
      'align-content:start',
      'background:var(--ui-editor-normal-surface)',
      'border-radius:var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card)',
      'display:grid',
      'gap:0',
      'grid-template-rows:auto 1px auto',
      'min-width:0',
      'position:relative',
      'z-index:1'
    ].join(';'),
    promptTitleBar: [
      'align-items:center',
      'background:transparent',
      'border:0',
      'border-radius:0',
      'display:grid',
      'gap:8px',
      'grid-template-columns:minmax(0,1fr) auto',
      'min-width:0',
      'overflow:hidden',
      'padding:8px 16px'
    ].join(';'),
    promptTitleMain: [
      'align-items:center',
      'display:grid',
      'gap:8px',
      'grid-template-columns:40px minmax(0,1fr)',
      'min-width:0'
    ].join(';'),
    titleIcon: [
      'align-items:center',
      'border-radius:var(--cthulhu-ui-radius-card)',
      'color:var(--ui-hoverable-icon-glyph)',
      'display:flex',
      'flex:0 0 40px',
      'height:40px',
      'justify-content:center',
      'width:40px'
    ].join(';'),
    titleCopy: ['display:grid', 'gap:4px', 'min-width:0'].join(';'),
    titleInput: [
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
    ].join(';'),
    metadataRow: [
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
    ].join(';'),
    metadataFolder: [
      'align-items:center',
      'color:var(--ui-secondary-text)',
      'display:inline-flex',
      'flex:0 1 auto',
      'gap:4px',
      'max-width:120px',
      'min-width:0',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap'
    ].join(';'),
    metadataFolderIcon: ['color:var(--ui-secondary-icon-glyph)', 'flex:0 0 auto', 'stroke-width:2.4'].join(
      ';'
    ),
    separatorDot: [
      'background:var(--ui-muted-text)',
      'border-radius:var(--cthulhu-ui-radius-control)',
      'flex:0 0 3px',
      'height:3px',
      'width:3px'
    ].join(';'),
    titleBodySeparator: [
      'background:var(--ui-neutral-muted-border)',
      'height:1px',
      'min-width:0',
      'width:100%'
    ].join(';'),
    monacoShell: ['background:var(--mockup-monaco-editor-background)', 'box-sizing:border-box', 'min-width:0'].join(
      ';'
    ),
    monacoHost: ['min-height:60px', 'min-width:0', 'position:relative', 'width:100%'].join(';')
  }

  const getLineCount = (text: string): number => Math.max(1, text.split('\n').length)
  const getTokenCount = (text: string): number => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return 0
    return trimmed.split(/\s+/).length
  }

  const getEditorUri = (promptId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-230012381/${promptId}.md`)

  const getPromptById = (promptId: string) => mockPrompts.find((prompt) => prompt.id === promptId)

  const countFolderPrompts = (folder: MockFolder): number =>
    folder.children.reduce((count, child) => {
      if (child.kind === 'prompt') return count + 1
      return count + countFolderPrompts(child.folder)
    }, 0)

  const collectVisiblePromptIds = (items: MockTreeItem[]): string[] =>
    items.flatMap((item) => {
      if (item.kind === 'prompt') return [item.promptId]
      if (collapsedFolderIds.has(item.folder.id)) return []
      return collectVisiblePromptIds(item.folder.children)
    })

  const findContainingFolderTitle = (
    promptId: string,
    items: MockTreeItem[] = mockTree,
    currentFolderTitle = 'Prompts'
  ): string => {
    for (const item of items) {
      if (item.kind === 'prompt' && item.promptId === promptId) return currentFolderTitle
      if (item.kind === 'folder') {
        const nestedTitle = findContainingFolderTitle(promptId, item.folder.children, item.folder.title)
        if (nestedTitle !== 'Prompts') return nestedTitle
      }
    }
    return 'Prompts'
  }

  const visiblePromptIds = $derived(collectVisiblePromptIds(mockTree))

  let nextPromptSequence = $state(1)

  const createNewPrompt = (folder: string): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder,
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const insertPromptAfterInItems = (
    items: MockTreeItem[],
    previousPromptId: string,
    nextPromptId: string
  ): { items: MockTreeItem[]; inserted: boolean } => {
    const nextItems: MockTreeItem[] = []

    for (const item of items) {
      if (item.kind === 'prompt') {
        nextItems.push(item)
        if (item.promptId === previousPromptId) {
          nextItems.push({ kind: 'prompt', promptId: nextPromptId })
          nextItems.push(...items.slice(nextItems.length - 1))
          return { items: nextItems, inserted: true }
        }
        continue
      }

      const result = insertPromptAfterInItems(item.folder.children, previousPromptId, nextPromptId)
      nextItems.push(
        result.inserted
          ? { kind: 'folder', folder: { ...item.folder, children: result.items } }
          : item
      )
      if (result.inserted) {
        nextItems.push(...items.slice(nextItems.length))
        return { items: nextItems, inserted: true }
      }
    }

    return { items: nextItems, inserted: false }
  }

  const removePromptFromItems = (items: MockTreeItem[], promptId: string): MockTreeItem[] =>
    items.flatMap((item): MockTreeItem[] => {
      if (item.kind === 'prompt') return item.promptId === promptId ? [] : [item]
      return [
        {
          kind: 'folder',
          folder: {
            ...item.folder,
            children: removePromptFromItems(item.folder.children, promptId)
          }
        }
      ]
    })

  const movePromptInItems = (
    items: MockTreeItem[],
    promptId: string,
    direction: -1 | 1
  ): { items: MockTreeItem[]; moved: boolean } => {
    const directIndex = items.findIndex((item) => item.kind === 'prompt' && item.promptId === promptId)
    if (directIndex !== -1) {
      const targetIndex = directIndex + direction
      if (targetIndex < 0 || targetIndex >= items.length) return { items, moved: false }

      const nextItems = [...items]
      const [item] = nextItems.splice(directIndex, 1)
      nextItems.splice(targetIndex, 0, item)
      return { items: nextItems, moved: true }
    }

    let moved = false
    const nextItems = items.map((item) => {
      if (item.kind === 'prompt' || moved) return item

      const result = movePromptInItems(item.folder.children, promptId, direction)
      if (!result.moved) return item

      moved = true
      return { kind: 'folder' as const, folder: { ...item.folder, children: result.items } }
    })

    return { items: nextItems, moved }
  }

  const addPromptAfter = (previousPromptId: string | null) => {
    const folder = previousPromptId ? findContainingFolderTitle(previousPromptId) : 'Prompts'
    const nextPrompt = createNewPrompt(folder)
    mockPrompts = [...mockPrompts, nextPrompt]

    if (previousPromptId === null) {
      mockTree = [{ kind: 'prompt', promptId: nextPrompt.id }, ...mockTree]
      return
    }

    const result = insertPromptAfterInItems(mockTree, previousPromptId, nextPrompt.id)
    mockTree = result.inserted ? result.items : [...mockTree, { kind: 'prompt', promptId: nextPrompt.id }]
  }

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const result = movePromptInItems(mockTree, promptId, direction)
    if (result.moved) mockTree = result.items
  }

  const deletePrompt = (promptId: string) => {
    mockPrompts = mockPrompts.filter((prompt) => prompt.id !== promptId)
    mockTree = removePromptFromItems(mockTree, promptId)
  }

  const toggleFolder = (folderId: string) => {
    if (collapsedFolderIds.has(folderId)) {
      collapsedFolderIds.delete(folderId)
      return
    }
    collapsedFolderIds.add(folderId)
  }

  const noopPromptTreeDrop = () => undefined

  const getFolderTitleStyle = (depth: number, collapsed: boolean): string =>
    [
      'align-items:center',
      collapsed
        ? 'background:var(--mockup-folder-title-surface-alt)'
        : depth > 0
          ? 'background:var(--mockup-folder-title-surface-nested)'
          : 'background:var(--mockup-folder-title-surface)',
      'border:0',
      'border-radius:var(--cthulhu-ui-radius-card)',
      'box-sizing:border-box',
      'display:grid',
      'gap:8px',
      'grid-template-columns:32px 40px minmax(0,1fr)',
      'height:56px',
      'min-width:0',
      `margin:${depth === 0 ? '4px 0 0' : '4px 0'}`,
      'overflow:hidden',
      'padding:8px 8px 8px 6px'
    ].join(';')

  const getFolderButtonStyle = (collapsed: boolean): string =>
    [
      'align-items:center',
      'background:transparent',
      'border:0',
      'border-radius:var(--cthulhu-ui-radius-control)',
      'color:var(--ui-secondary-icon-glyph)',
      'cursor:pointer',
      'display:flex',
      'height:32px',
      'justify-content:center',
      'padding:0',
      'width:32px',
      collapsed ? 'opacity:.82' : 'opacity:1'
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
  <span style={styles.separatorDot} aria-hidden="true"></span>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(previousPromptId)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : 'mockup-prompt-divider-add-initial'}
  />
{/snippet}

{#snippet FolderTitle(folder: MockFolder, depth: number)}
  {@const collapsed = collapsedFolderIds.has(folder.id)}
  <header style={getFolderTitleStyle(depth, collapsed)}>
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${folder.title}` : `Collapse ${folder.title}`}
      onclick={() => toggleFolder(folder.id)}
      style={getFolderButtonStyle(collapsed)}
    >
      {#if collapsed}
        <ChevronRight size={20} aria-hidden="true" />
      {:else}
        <ChevronDown size={20} aria-hidden="true" />
      {/if}
    </button>

    <span
      style="align-items:center;color:var(--mockup-folder-title-icon);display:flex;height:40px;justify-content:center;width:40px"
    >
      <Folder size={24} aria-hidden="true" />
    </span>

    <div style="display:grid;gap:3px;min-width:0">
      <div style="align-items:center;display:flex;gap:7px;min-width:0">
        <span
          style="color:var(--ui-normal-text);flex:0 1 auto;font-size:15px;font-weight:650;line-height:20px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
        >
          {folder.title}
        </span>
        <button
          type="button"
          aria-label={`Edit ${folder.title} title`}
          style="align-items:center;background:transparent;border:0;border-radius:var(--cthulhu-ui-radius-control);color:var(--ui-secondary-icon-glyph);cursor:pointer;display:flex;flex:0 0 22px;height:22px;justify-content:center;padding:0;width:22px"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
      <span
        style="color:var(--ui-muted-text);font-size:12px;line-height:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
      >
        {countFolderPrompts(folder)} prompts
      </span>
    </div>

  </header>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt)}
  {@const visibleIndex = visiblePromptIds.indexOf(prompt.id)}
  <article
    style={styles.promptEditorCard}
    data-testid={`mockup-prompt-editor-${prompt.id}`}
  >
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId="mockup-prompts"
      title={prompt.title}
      isFirstPrompt={visibleIndex === 0}
      isLastPrompt={visibleIndex === visiblePromptIds.length - 1}
      onMoveUp={() => movePrompt(prompt.id, -1)}
      onMoveDown={() => movePrompt(prompt.id, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div style={styles.promptEditorBody}>
      <header
        style={`${styles.promptTitleBar};height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px`}
      >
        <div style={styles.promptTitleMain}>
          <span style={styles.titleIcon}>
            <FileText size={24} aria-hidden="true" />
          </span>

          <div style={styles.titleCopy}>
            <input
              style={styles.titleInput}
              value={prompt.title}
              aria-label="Prompt title"
            />
            <div style={styles.metadataRow}>
              <span style={styles.metadataFolder} title={prompt.folder}>
                <Folder style={styles.metadataFolderIcon} size={12} aria-hidden="true" />
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

        <PromptEditorButtonBar
          title={prompt.title}
          draftText={prompt.text}
          onDelete={() => deletePrompt(prompt.id)}
        />
      </header>

      <span style={styles.titleBodySeparator} aria-hidden="true"></span>

      <div
        style={`${styles.monacoShell};padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px`}
      >
        <div
          style={styles.monacoHost}
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet PromptTreeItem(item: MockTreeItem, depth: number)}
  {#if item.kind === 'folder'}
    {@render FolderBlock(item.folder, depth)}
  {:else if getPromptById(item.promptId)}
    {@const prompt = getPromptById(item.promptId)}
    {#if prompt}
      <div style={styles.promptIndent}>
        {@render PromptEditor(prompt)}
        {@render PromptDividerRow(prompt.id)}
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet FolderBlock(folder: MockFolder, depth: number)}
  {@const collapsed = collapsedFolderIds.has(folder.id)}
  <section style={styles.folderBlock}>
    {@render FolderTitle(folder, depth)}

    {#if !collapsed}
      <div style={styles.folderChildren}>
        <div style={styles.treeGutter} aria-hidden="true">
          <span style={styles.treeLine}></span>
        </div>
        <div style={styles.folderChildrenContent}>
          {#each folder.children as child (child.kind === 'prompt' ? child.promptId : child.folder.id)}
            {@render PromptTreeItem(child, depth + 1)}
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/snippet}

<section
  style={styles.root}
  data-testid="subfolders-230012381-mockup"
>
  <div style={styles.editorRow}>
    {@render PromptDividerRow(null)}
    {#each mockTree as item (item.kind === 'prompt' ? item.promptId : item.folder.id)}
      {@render PromptTreeItem(item, 0)}
    {/each}
  </div>
</section>
