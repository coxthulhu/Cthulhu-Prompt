<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-svelte'
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

  type PromptNode = {
    type: 'prompt'
    promptId: string
  }

  type FolderNode = {
    type: 'folder'
    id: string
    title: string
    modifiedLabel: string
    children: TreeNode[]
  }

  type TreeNode = FolderNode | PromptNode

  type VisibleFolderRow = {
    type: 'folder'
    folder: FolderNode
    depth: number
    ancestorsLast: boolean[]
    isLast: boolean
  }

  type VisiblePromptRow = {
    type: 'prompt'
    prompt: MockPrompt
    depth: number
    ancestorsLast: boolean[]
    isLast: boolean
  }

  type VisibleRow = VisibleFolderRow | VisiblePromptRow

  type TreeInsertResult = {
    nodes: TreeNode[]
    inserted: boolean
  }

  let mockPrompts = $state<Record<string, MockPrompt>>({
    'mockup-outline': {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Workspace Hygiene',
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
      folder: 'Workspace Hygiene',
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
      folder: 'Prompt Tree',
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
      folder: 'Prompt Tree',
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
      folder: 'Ship Notes',
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
      folder: 'Ship Notes',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    },
    'mockup-audit': {
      id: 'mockup-audit',
      title: 'Audit empty-folder states',
      folder: 'Tree Polish',
      modifiedLabel: 'Updated Jun 4',
      text: [
        'Walk through empty-folder, single-prompt folder, and deeply nested folder states.',
        '',
        'Find cases where controls jump, counts drift, or the selected prompt no longer has enough visible context.'
      ].join('\n')
    },
    'mockup-shortcuts': {
      id: 'mockup-shortcuts',
      title: 'Check keyboard navigation',
      folder: 'Tree Polish',
      modifiedLabel: 'Updated May 29',
      text: [
        'Review keyboard navigation for the prompt folder screen.',
        '',
        'Confirm that focus order follows the visual order, collapsed folders are skipped, and editor controls remain reachable without pointer input.'
      ].join('\n')
    }
  })

  let tree = $state<TreeNode[]>([
    {
      type: 'folder',
      id: 'folder-workspace',
      title: 'Workspace Hygiene',
      modifiedLabel: '6 recent edits',
      children: [
        { type: 'prompt', promptId: 'mockup-outline' },
        { type: 'prompt', promptId: 'mockup-refactor' },
        {
          type: 'folder',
          id: 'folder-tree-polish',
          title: 'Tree Polish',
          modifiedLabel: '2 prompts',
          children: [
            { type: 'prompt', promptId: 'mockup-audit' },
            { type: 'prompt', promptId: 'mockup-shortcuts' }
          ]
        }
      ]
    },
    {
      type: 'folder',
      id: 'folder-prompt-tree',
      title: 'Prompt Tree',
      modifiedLabel: 'Active',
      children: [
        { type: 'prompt', promptId: 'mockup-review' },
        { type: 'prompt', promptId: 'mockup-tests' }
      ]
    },
    {
      type: 'folder',
      id: 'folder-ship-notes',
      title: 'Ship Notes',
      modifiedLabel: 'Ready',
      children: [
        { type: 'prompt', promptId: 'mockup-release' },
        { type: 'prompt', promptId: 'mockup-polish' }
      ]
    }
  ])

  const expandedFolderIds = new SvelteSet(['folder-workspace', 'folder-tree-polish', 'folder-prompt-tree', 'folder-ship-notes'])
  let hoveredFolderId = $state<string | null>(null)
  let hoveredPromptId = $state<string | null>(null)
  let nextPromptSequence = $state(1)

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
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-222216132/${promptId}.md`)

  const countPrompts = (nodes: TreeNode[]): number =>
    nodes.reduce((count, node) => {
      if (node.type === 'prompt') {
        return mockPrompts[node.promptId] ? count + 1 : count
      }

      return count + countPrompts(node.children)
    }, 0)

  const collectVisibleRows = (
    nodes: TreeNode[],
    depth = 0,
    ancestorsLast: boolean[] = []
  ): VisibleRow[] => {
    const rows: VisibleRow[] = []
    const visibleNodes = nodes.filter((node) => node.type === 'folder' || mockPrompts[node.promptId])

    visibleNodes.forEach((node, index) => {
      const isLast = index === visibleNodes.length - 1

      if (node.type === 'folder') {
        rows.push({ type: 'folder', folder: node, depth, ancestorsLast, isLast })

        if (expandedFolderIds.has(node.id)) {
          rows.push(...collectVisibleRows(node.children, depth + 1, [...ancestorsLast, isLast]))
        }

        return
      }

      const prompt = mockPrompts[node.promptId]
      if (prompt) {
        rows.push({ type: 'prompt', prompt, depth, ancestorsLast, isLast })
      }
    })

    return rows
  }

  const isVisiblePromptRow = (row: VisibleRow): row is VisiblePromptRow => row.type === 'prompt'

  let visibleRows = $derived(collectVisibleRows(tree))
  let visiblePrompts = $derived(visibleRows.filter(isVisiblePromptRow))

  const toggleFolder = (folderId: string) => {
    if (expandedFolderIds.has(folderId)) {
      expandedFolderIds.delete(folderId)
    } else {
      expandedFolderIds.add(folderId)
    }
  }

  const createNewPrompt = (): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder: 'Prompt Tree',
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const insertPromptAfterInNodes = (
    nodes: TreeNode[],
    previousPromptId: string,
    nextPromptId: string
  ): TreeInsertResult => {
    let inserted = false

    const nextNodes = nodes.map((node) => {
      if (node.type === 'folder') {
        const childResult = insertPromptAfterInNodes(node.children, previousPromptId, nextPromptId)
        if (childResult.inserted) inserted = true
        return { ...node, children: childResult.nodes }
      }

      return node
    })

    if (inserted) {
      return { nodes: nextNodes, inserted }
    }

    const targetIndex = nextNodes.findIndex(
      (node) => node.type === 'prompt' && node.promptId === previousPromptId
    )

    if (targetIndex === -1) {
      return { nodes: nextNodes, inserted: false }
    }

    nextNodes.splice(targetIndex + 1, 0, { type: 'prompt', promptId: nextPromptId })
    return { nodes: nextNodes, inserted: true }
  }

  const insertPromptAfter = (
    nodes: TreeNode[],
    previousPromptId: string | null,
    nextPromptId: string
  ): TreeNode[] => {
    if (previousPromptId === null) {
      return [{ type: 'prompt', promptId: nextPromptId }, ...nodes]
    }

    const result = insertPromptAfterInNodes(nodes, previousPromptId, nextPromptId)
    return result.inserted ? result.nodes : [...result.nodes, { type: 'prompt', promptId: nextPromptId }]
  }

  const addPromptAfter = (previousPromptId: string | null) => {
    const nextPrompt = createNewPrompt()
    mockPrompts = { ...mockPrompts, [nextPrompt.id]: nextPrompt }
    tree = insertPromptAfter(tree, previousPromptId, nextPrompt.id)
  }

  const removePromptFromTree = (nodes: TreeNode[], promptId: string): TreeNode[] =>
    nodes
      .map((node) => {
        if (node.type === 'folder') {
          return { ...node, children: removePromptFromTree(node.children, promptId) }
        }

        return node
      })
      .filter((node) => node.type === 'folder' || node.promptId !== promptId)

  const deletePrompt = (promptId: string) => {
    const nextPrompts = { ...mockPrompts }
    delete nextPrompts[promptId]
    mockPrompts = nextPrompts
    tree = removePromptFromTree(tree, promptId)
  }

  const swapPromptIds = (nodes: TreeNode[], firstPromptId: string, secondPromptId: string): TreeNode[] =>
    nodes.map((node) => {
      if (node.type === 'folder') {
        return { ...node, children: swapPromptIds(node.children, firstPromptId, secondPromptId) }
      }

      if (node.promptId === firstPromptId) return { ...node, promptId: secondPromptId }
      if (node.promptId === secondPromptId) return { ...node, promptId: firstPromptId }
      return node
    })

  const movePrompt = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= visiblePrompts.length) return

    const promptId = visiblePrompts[index].prompt.id
    const targetPromptId = visiblePrompts[targetIndex].prompt.id
    tree = swapPromptIds(tree, promptId, targetPromptId)
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

  const rowGapPx = 0
  const gutterStepPx = 24
  const gutterCenterPx = 11

  const getGutterWidth = (depth: number) => Math.max(20, depth * gutterStepPx + 18)

  const getGutterLineLeft = (index: number) => index * gutterStepPx + gutterCenterPx

  const getTreeRowStyle = (isHovered: boolean) =>
    [
      'align-items:center',
      `background:${isHovered ? 'var(--ui-neutral-subtle-action-hover-fill)' : 'transparent'}`,
      'border:0',
      'box-sizing:border-box',
      'color:var(--ui-normal-text)',
      'display:grid',
      'font:inherit',
      'grid-template-columns:auto minmax(0, 1fr)',
      'min-height:34px',
      'min-width:0',
      'padding:3px 8px 3px 0',
      'text-align:left',
      'transition:background-color 120ms ease, color 120ms ease',
      'width:100%'
    ].join(';')

  const getPromptShellStyle = () =>
    [
      'box-sizing:border-box',
      'display:grid',
      `gap:${rowGapPx}px`,
      'grid-template-columns:auto minmax(0, 1fr)',
      'min-width:0',
      'width:100%'
    ].join(';')

  const getContentWrapStyle = (isHovered: boolean) =>
    [
      'align-items:center',
      `background:${isHovered ? 'var(--ui-neutral-normal-surface)' : 'transparent'}`,
      'border-radius:var(--cthulhu-ui-radius-card)',
      'box-sizing:border-box',
      'display:grid',
      'gap:8px',
      'grid-template-columns:auto minmax(0, 1fr) auto',
      'min-width:0',
      'padding:4px 10px',
      'transition:background-color 120ms ease'
    ].join(';')
</script>

{#snippet SeparatorDot()}
  <span
    aria-hidden="true"
    style="background:var(--ui-muted-text);border-radius:var(--cthulhu-ui-radius-control);flex:0 0 3px;height:3px;width:3px;"
  ></span>
{/snippet}

{#snippet Gutter(depth: number, ancestorsLast: boolean[], isLast: boolean)}
  <span
    aria-hidden="true"
    style={`align-self:stretch;box-sizing:border-box;display:block;min-height:100%;position:relative;width:${getGutterWidth(depth)}px;`}
  >
    {#each ancestorsLast as ancestorIsLast, index (index)}
      {#if !ancestorIsLast}
        <span
          style={`background:var(--ui-neutral-muted-border);bottom:0;display:block;left:${getGutterLineLeft(index)}px;position:absolute;top:0;width:1px;`}
        ></span>
      {/if}
    {/each}

    {#if depth > 0}
      <span
        style={`background:var(--ui-neutral-muted-border);display:block;height:${isLast ? '50%' : '100%'};left:${getGutterLineLeft(depth - 1)}px;position:absolute;top:0;width:1px;`}
      ></span>
      <span
        style={`background:var(--ui-neutral-muted-border);display:block;height:1px;left:${getGutterLineLeft(depth - 1)}px;position:absolute;top:50%;width:${gutterStepPx - 5}px;`}
      ></span>
    {/if}
  </span>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, depth: number, ancestorsLast: boolean[], isLast: boolean)}
  <div style={getPromptShellStyle()}>
    {@render Gutter(depth, ancestorsLast, isLast)}
    <PromptDivider
      onAddPrompt={() => addPromptAfter(previousPromptId)}
      testId={previousPromptId
        ? `mockup-prompt-divider-add-after-${previousPromptId}`
        : 'mockup-prompt-divider-add-initial'}
    />
  </div>
{/snippet}

{#snippet FolderRow(row: VisibleFolderRow)}
  {@const isExpanded = expandedFolderIds.has(row.folder.id)}
  {@const isHovered = hoveredFolderId === row.folder.id}
  <button
    type="button"
    aria-expanded={isExpanded}
    onclick={() => toggleFolder(row.folder.id)}
    onmouseenter={() => (hoveredFolderId = row.folder.id)}
    onmouseleave={() => (hoveredFolderId = null)}
    style={getTreeRowStyle(isHovered)}
  >
    {@render Gutter(row.depth, row.ancestorsLast, row.isLast)}
    <span style={getContentWrapStyle(isHovered)}>
      <span
        style={`align-items:center;color:${isHovered ? 'var(--ui-hoverable-icon-glyph)' : 'var(--ui-secondary-icon-glyph)'};display:flex;height:22px;justify-content:center;width:22px;`}
      >
        {#if isExpanded}
          <ChevronDown size={16} aria-hidden="true" />
        {:else}
          <ChevronRight size={16} aria-hidden="true" />
        {/if}
      </span>

      <span style="align-items:center;display:flex;gap:8px;min-width:0;">
        <Folder
          size={16}
          aria-hidden="true"
          style={`color:${isHovered ? 'var(--ui-accent-normal-text)' : 'var(--ui-secondary-icon-glyph)'};flex:0 0 auto;stroke-width:2.25;`}
        />
        <span
          style="color:var(--ui-normal-text);font-size:13px;font-weight:650;line-height:18px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        >
          {row.folder.title}
        </span>
      </span>

      <span
        style="align-items:center;color:var(--ui-muted-text);display:inline-flex;font-size:11px;gap:7px;line-height:16px;white-space:nowrap;"
      >
        <span>{countPrompts(row.folder.children)} prompts</span>
        {@render SeparatorDot()}
        <span>{row.folder.modifiedLabel}</span>
      </span>
    </span>
  </button>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number)}
  <article
    data-testid={`mockup-prompt-editor-${prompt.id}`}
    style="align-items:stretch;background:var(--ui-card-overlay-surface);border-radius:var(--cthulhu-ui-radius-card);box-sizing:border-box;display:grid;grid-template-columns:36px minmax(0, 1fr);min-width:0;overflow:hidden;"
  >
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId="mockup-prompts"
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === visiblePrompts.length - 1}
      onMoveUp={() => movePrompt(index, -1)}
      onMoveDown={() => movePrompt(index, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div
      style="align-content:start;background:var(--ui-editor-normal-surface);border-radius:var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);display:grid;gap:0;grid-template-rows:auto 1px auto;min-width:0;position:relative;z-index:1;"
    >
      <header
        style={`align-items:center;background:transparent;border:0;border-radius:0;display:grid;gap:8px;grid-template-columns:minmax(0, 1fr) auto;height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;min-width:0;overflow:hidden;padding:8px 16px;`}
      >
        <div style="align-items:center;display:grid;gap:8px;grid-template-columns:40px minmax(0, 1fr);min-width:0;">
          <span
            style="align-items:center;border-radius:var(--cthulhu-ui-radius-card);color:var(--ui-hoverable-icon-glyph);display:flex;flex:0 0 40px;height:40px;justify-content:center;width:40px;"
          >
            <FileText size={24} aria-hidden="true" />
          </span>

          <div style="display:grid;gap:4px;min-width:0;">
            <input
              style="background:transparent;border:0;color:var(--ui-normal-text);font-family:inherit;font-size:15px;font-weight:600;height:22px;line-height:20px;min-width:0;outline:none;padding:0;width:100%;"
              value={prompt.title}
              aria-label="Prompt title"
            />
            <div
              style="align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:12px;gap:7px;line-height:16px;min-width:0;overflow:hidden;white-space:nowrap;"
            >
              <span
                title={prompt.folder}
                style="align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:4px;max-width:140px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              >
                <Folder
                  size={12}
                  aria-hidden="true"
                  style="color:var(--ui-secondary-icon-glyph);flex:0 0 auto;stroke-width:2.4;"
                />
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

      <span
        aria-hidden="true"
        style="background:var(--ui-neutral-muted-border);height:1px;min-width:0;width:100%;"
      ></span>

      <div
        style={`background:#1f1f1f;box-sizing:border-box;min-width:0;padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          aria-label={`${prompt.title} body`}
          style="min-height:60px;min-width:0;position:relative;width:100%;"
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet PromptRow(row: VisiblePromptRow, index: number)}
  {@const isHovered = hoveredPromptId === row.prompt.id}
  <div
    role="group"
    onmouseenter={() => (hoveredPromptId = row.prompt.id)}
    onmouseleave={() => (hoveredPromptId = null)}
    style={getPromptShellStyle()}
  >
    {@render Gutter(row.depth, row.ancestorsLast, row.isLast)}
    <div
      style={`border-radius:var(--cthulhu-ui-radius-card);box-shadow:${isHovered ? '0 0 0 1px var(--ui-neutral-hover-border)' : 'none'};min-width:0;transition:box-shadow 120ms ease;`}
    >
      {@render PromptEditor(row.prompt, index)}
    </div>
  </div>
{/snippet}

<section
  data-testid="prompt-folder-subfolders-222216132-mockup"
  style="box-sizing:border-box;min-width:0;padding-bottom:8px;width:100%;"
>
  <div style="align-items:stretch;display:grid;gap:0;grid-template-columns:minmax(0, 1fr);min-width:0;width:100%;">
    {@render PromptDividerRow(null, 0, [], false)}
    {#each visibleRows as row (row.type === 'folder' ? row.folder.id : row.prompt.id)}
      {#if row.type === 'folder'}
        {@render FolderRow(row)}
      {:else}
        {@const visiblePromptIndex = visiblePrompts.findIndex((promptRow) => promptRow.prompt.id === row.prompt.id)}
        {@render PromptRow(row, visiblePromptIndex)}
        {@render PromptDividerRow(row.prompt.id, row.depth, row.ancestorsLast, row.isLast)}
      {/if}
    {/each}
  </div>
</section>
