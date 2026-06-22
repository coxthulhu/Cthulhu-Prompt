<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-svelte'
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

  type MockPromptNode = {
    kind: 'prompt'
    promptId: string
  }

  type MockFolderNode = {
    kind: 'folder'
    id: string
    title: string
    modifiedLabel: string
    children: MockTreeNode[]
  }

  type MockTreeNode = MockFolderNode | MockPromptNode

  type VisibleFolderRow = {
    kind: 'folder'
    id: string
    title: string
    modifiedLabel: string
    promptCount: number
    depth: number
    ancestorIds: string[]
    collapsed: boolean
  }

  type VisiblePromptRow = {
    kind: 'prompt'
    prompt: MockPrompt
    depth: number
    parentFolderId: string | null
    ancestorIds: string[]
  }

  type VisibleRow = VisibleFolderRow | VisiblePromptRow

  let mockPrompts = $state<Record<string, MockPrompt>>({
    'import-edge-cases': {
      id: 'import-edge-cases',
      title: 'Outline workspace import edge cases',
      folder: 'Workspace flows',
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
    'drag-drop-review': {
      id: 'drag-drop-review',
      title: 'Review drag and drop persistence',
      folder: 'Workspace flows',
      modifiedLabel: 'Updated 18 min ago',
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
    'folder-collapse': {
      id: 'folder-collapse',
      title: 'Add folder collapse coverage',
      folder: 'Workspace flows / Folder behavior',
      modifiedLabel: 'Updated 32 min ago',
      text: [
        'Add Playwright coverage for collapsing a folder, navigating away, returning, and verifying the folder state and prompt order are restored.',
        '',
        'Use the existing workspace fixtures and keep the assertions focused on visible user behavior.'
      ].join('\n')
    },
    'nested-folder-drop': {
      id: 'nested-folder-drop',
      title: 'Test nested folder drops',
      folder: 'Workspace flows / Folder behavior',
      modifiedLabel: 'Updated 44 min ago',
      text: [
        'Create a focused test for moving a prompt into a subfolder nested under another subfolder.',
        '',
        'Verify the prompt remains indented at the correct depth after reload and that the parent folder count updates.'
      ].join('\n')
    },
    'editor-sizing': {
      id: 'editor-sizing',
      title: 'Refactor editor sizing controller',
      folder: 'Editor polish',
      modifiedLabel: 'Updated 1 hr ago',
      text: [
        'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
        '',
        'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
      ].join('\n')
    },
    'settings-controls': {
      id: 'settings-controls',
      title: 'Polish settings controls',
      folder: 'Editor polish',
      modifiedLabel: 'Updated yesterday',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    },
    'release-notes': {
      id: 'release-notes',
      title: 'Draft release notes',
      folder: 'Release prep',
      modifiedLabel: 'Updated Jun 12',
      text: [
        'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
        '',
        'Keep the tone concise and avoid implementation details unless they affect users directly.'
      ].join('\n')
    },
    'smoke-plan': {
      id: 'smoke-plan',
      title: 'Build release smoke plan',
      folder: 'Release prep',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Write a short smoke test plan for the next release candidate.',
        '',
        'Cover workspace selection, prompt creation, editing, copy actions, folder collapse, and persistence after restart.'
      ].join('\n')
    },
    'copy-actions': {
      id: 'copy-actions',
      title: 'Audit copy button states',
      folder: 'Release prep / Final checks',
      modifiedLabel: 'Updated Jun 7',
      text: [
        'Audit the copy controls for disabled, loading, success, and failure states.',
        '',
        'Check both keyboard and pointer flows.'
      ].join('\n')
    }
  })

  let mockTree = $state<MockTreeNode[]>([
    {
      kind: 'folder',
      id: 'workspace-flows',
      title: 'Workspace flows',
      modifiedLabel: 'Updated 2 min ago',
      children: [
        { kind: 'prompt', promptId: 'import-edge-cases' },
        { kind: 'prompt', promptId: 'drag-drop-review' },
        {
          kind: 'folder',
          id: 'folder-behavior',
          title: 'Folder behavior',
          modifiedLabel: 'Updated 32 min ago',
          children: [
            { kind: 'prompt', promptId: 'folder-collapse' },
            { kind: 'prompt', promptId: 'nested-folder-drop' }
          ]
        }
      ]
    },
    {
      kind: 'folder',
      id: 'editor-polish',
      title: 'Editor polish',
      modifiedLabel: 'Updated 1 hr ago',
      children: [
        { kind: 'prompt', promptId: 'editor-sizing' },
        { kind: 'prompt', promptId: 'settings-controls' }
      ]
    },
    {
      kind: 'folder',
      id: 'release-prep',
      title: 'Release prep',
      modifiedLabel: 'Updated Jun 12',
      children: [
        { kind: 'prompt', promptId: 'release-notes' },
        { kind: 'prompt', promptId: 'smoke-plan' },
        {
          kind: 'folder',
          id: 'final-checks',
          title: 'Final checks',
          modifiedLabel: 'Updated Jun 7',
          children: [{ kind: 'prompt', promptId: 'copy-actions' }]
        }
      ]
    }
  ])

  const collapsedFolderIds = new SvelteSet<string>()
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
  const formatPromptCount = (promptCount: number): string =>
    promptCount === 1 ? '1 prompt' : `${promptCount} prompts`

  const getEditorUri = (promptId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-222207083/${promptId}.md`)

  const countPrompts = (nodes: MockTreeNode[]): number =>
    nodes.reduce((total, node) => {
      if (node.kind === 'prompt') return total + (mockPrompts[node.promptId] ? 1 : 0)
      return total + countPrompts(node.children)
    }, 0)

  const flattenTree = (
    nodes: MockTreeNode[],
    depth = 0,
    ancestorIds: string[] = [],
    parentFolderId: string | null = null
  ): VisibleRow[] => {
    const rows: VisibleRow[] = []

    for (const node of nodes) {
      if (node.kind === 'prompt') {
        const prompt = mockPrompts[node.promptId]
        if (prompt) {
          rows.push({
            kind: 'prompt',
            prompt,
            depth,
            parentFolderId,
            ancestorIds
          })
        }
        continue
      }

      const collapsed = collapsedFolderIds.has(node.id)
      rows.push({
        kind: 'folder',
        id: node.id,
        title: node.title,
        modifiedLabel: node.modifiedLabel,
        promptCount: countPrompts(node.children),
        depth,
        ancestorIds,
        collapsed
      })

      if (!collapsed) {
        rows.push(...flattenTree(node.children, depth + 1, [...ancestorIds, node.id], node.id))
      }
    }

    return rows
  }

  let visibleRows = $derived(flattenTree(mockTree))
  let visiblePromptIds = $derived(
    visibleRows
      .filter((row): row is VisiblePromptRow => row.kind === 'prompt')
      .map((row) => row.prompt.id)
  )

  const getVisibleRowKey = (row: VisibleRow): string =>
    row.kind === 'folder' ? `folder-${row.id}` : `prompt-${row.prompt.id}`

  const toggleFolder = (folderId: string) => {
    if (collapsedFolderIds.has(folderId)) {
      collapsedFolderIds.delete(folderId)
      return
    }

    collapsedFolderIds.add(folderId)
  }

  const findFolderPath = (
    nodes: MockTreeNode[],
    folderId: string | null,
    path: string[] = []
  ): string | null => {
    if (folderId === null) return 'Prompts'

    for (const node of nodes) {
      if (node.kind === 'prompt') continue

      const nextPath = [...path, node.title]
      if (node.id === folderId) return nextPath.join(' / ')

      const childPath = findFolderPath(node.children, folderId, nextPath)
      if (childPath) return childPath
    }

    return null
  }

  const createNewPrompt = (parentFolderId: string | null): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1
    const folder = findFolderPath(mockTree, parentFolderId) ?? 'Prompts'

    return {
      id: `subfolder-mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder,
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const insertPromptNodeAfter = (
    nodes: MockTreeNode[],
    previousPromptId: string,
    nextPromptId: string
  ): boolean => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (node.kind === 'prompt' && node.promptId === previousPromptId) {
        nodes.splice(index + 1, 0, { kind: 'prompt', promptId: nextPromptId })
        return true
      }

      if (node.kind === 'folder' && insertPromptNodeAfter(node.children, previousPromptId, nextPromptId)) {
        return true
      }
    }

    return false
  }

  const addPromptAfter = (previousPromptId: string | null, parentFolderId: string | null) => {
    const nextPrompt = createNewPrompt(parentFolderId)
    mockPrompts = { ...mockPrompts, [nextPrompt.id]: nextPrompt }

    if (previousPromptId === null) {
      mockTree = [{ kind: 'prompt', promptId: nextPrompt.id }, ...mockTree]
      return
    }

    const nextTree = [...mockTree]
    if (!insertPromptNodeAfter(nextTree, previousPromptId, nextPrompt.id)) {
      nextTree.push({ kind: 'prompt', promptId: nextPrompt.id })
    }
    mockTree = nextTree
  }

  const findPromptLocation = (
    nodes: MockTreeNode[],
    promptId: string
  ): { nodes: MockTreeNode[]; index: number } | null => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (node.kind === 'prompt' && node.promptId === promptId) return { nodes, index }

      if (node.kind === 'folder') {
        const childLocation = findPromptLocation(node.children, promptId)
        if (childLocation) return childLocation
      }
    }

    return null
  }

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const currentIndex = visiblePromptIds.indexOf(promptId)
    const targetPromptId = visiblePromptIds[currentIndex + direction]
    if (!targetPromptId) return

    const currentLocation = findPromptLocation(mockTree, promptId)
    const targetLocation = findPromptLocation(mockTree, targetPromptId)
    if (!currentLocation || !targetLocation) return

    const currentNode = currentLocation.nodes[currentLocation.index]
    const targetNode = targetLocation.nodes[targetLocation.index]
    currentLocation.nodes[currentLocation.index] = targetNode
    targetLocation.nodes[targetLocation.index] = currentNode
    mockTree = [...mockTree]
  }

  const removePromptNode = (nodes: MockTreeNode[], promptId: string): boolean => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (node.kind === 'prompt' && node.promptId === promptId) {
        nodes.splice(index, 1)
        return true
      }

      if (node.kind === 'folder' && removePromptNode(node.children, promptId)) return true
    }

    return false
  }

  const deletePrompt = (promptId: string) => {
    const nextTree = [...mockTree]
    removePromptNode(nextTree, promptId)
    mockTree = nextTree

    const { [promptId]: removedPrompt, ...nextPrompts } = mockPrompts
    void removedPrompt
    mockPrompts = nextPrompts
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

  const rowGutterWidth = (depth: number) => 30 + depth * 26
  const lineLeft = (lineIndex: number) => 15 + lineIndex * 26

  const rootStyle =
    '--mockup-monaco-editor-background:#1f1f1f;box-sizing:border-box;min-width:0;padding-bottom:8px;width:100%;'
  const editorRowStyle =
    'align-items:stretch;display:grid;gap:0;grid-template-columns:minmax(0,1fr);min-width:0;width:100%;'
  const promptCardBaseStyle =
    'align-items:stretch;background:var(--ui-card-overlay-surface);border-radius:var(--cthulhu-ui-radius-card);box-sizing:border-box;display:grid;grid-template-columns:36px minmax(0,1fr);min-width:0;overflow:hidden;transition:box-shadow 140ms ease, transform 140ms ease;'
  const promptBodyStyle =
    'align-content:start;background:var(--ui-editor-normal-surface);border-radius:var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);display:grid;gap:0;grid-template-rows:auto 1px auto;min-width:0;position:relative;z-index:1;'
  const titleBarBaseStyle =
    'align-items:center;background:transparent;border:0;border-radius:0;display:grid;gap:8px;grid-template-columns:minmax(0,1fr) auto;min-width:0;overflow:hidden;padding:8px 16px;'
  const titleMainStyle =
    'align-items:center;display:grid;gap:8px;grid-template-columns:40px minmax(0,1fr);min-width:0;'
  const titleIconStyle =
    'align-items:center;border-radius:var(--cthulhu-ui-radius-card);color:var(--ui-hoverable-icon-glyph);display:flex;flex:0 0 40px;height:40px;justify-content:center;width:40px;'
  const titleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const titleInputStyle =
    'background:transparent;border:0;color:var(--ui-normal-text);font-family:inherit;font-size:15px;font-weight:600;height:22px;line-height:20px;min-width:0;outline:none;padding:0;width:100%;'
  const metadataRowStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:12px;gap:7px;line-height:16px;min-width:0;overflow:hidden;white-space:nowrap;'
  const metadataFolderStyle =
    'align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:4px;max-width:190px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const separatorDotStyle =
    'background:var(--ui-muted-text);border-radius:var(--cthulhu-ui-radius-control);flex:0 0 3px;height:3px;width:3px;'
  const titleBodySeparatorStyle =
    'background:var(--ui-neutral-muted-border);height:1px;min-width:0;width:100%;'
  const monacoShellStyle = `background:var(--mockup-monaco-editor-background);box-sizing:border-box;min-width:0;padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`
  const monacoHostStyle = 'min-height:60px;min-width:0;position:relative;width:100%;'
  const gutterLineStyle = (lineIndex: number) =>
    `background:var(--ui-neutral-emphasis-border);bottom:-1px;left:${lineLeft(lineIndex)}px;position:absolute;top:-1px;width:1px;`
  const gutterStemStyle = (depth: number) =>
    `background:var(--ui-neutral-emphasis-border);height:1px;left:${lineLeft(depth - 1)}px;position:absolute;top:50%;width:18px;`
  const rowShellStyle = (depth: number) =>
    `box-sizing:border-box;display:grid;grid-template-columns:${rowGutterWidth(depth)}px minmax(0,1fr);min-width:0;position:relative;width:100%;`
  const dividerShellStyle = (depth: number) =>
    `box-sizing:border-box;display:grid;grid-template-columns:${rowGutterWidth(depth)}px minmax(0,1fr);min-width:0;position:relative;width:100%;`
  const gutterStyle = 'min-width:0;position:relative;'
  const folderButtonStyle = (row: VisibleFolderRow) =>
    [
      'align-items:center',
      'background:' +
        (hoveredFolderId === row.id
          ? 'var(--ui-neutral-action-hover-fill)'
          : 'linear-gradient(90deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end))'),
      'border:1px solid ' +
        (hoveredFolderId === row.id
          ? 'var(--ui-neutral-hover-border)'
          : 'var(--ui-card-normal-border)'),
      'border-radius:var(--cthulhu-ui-radius-card)',
      'box-shadow:0 8px 18px var(--ui-card-normal-shadow)',
      'box-sizing:border-box',
      'color:var(--ui-normal-text)',
      'cursor:pointer',
      'display:grid',
      'font:inherit',
      'gap:10px',
      'grid-template-columns:24px 30px minmax(0,1fr) auto',
      'height:42px',
      'margin:5px 0',
      'min-width:0',
      'padding:0 12px 0 10px',
      'text-align:left',
      'transition:background 140ms ease,border-color 140ms ease,box-shadow 140ms ease'
    ].join(';')
  const chevronStyle =
    'align-items:center;color:var(--ui-secondary-icon-glyph);display:flex;height:24px;justify-content:center;width:24px;'
  const folderIconStyle = (row: VisibleFolderRow) =>
    `align-items:center;background:${row.collapsed ? 'var(--ui-neutral-normal-surface)' : 'var(--ui-accent-action-fill)'};border:1px solid ${row.collapsed ? 'var(--ui-neutral-normal-border)' : 'var(--ui-accent-normal-border)'};border-radius:7px;color:${row.collapsed ? 'var(--ui-secondary-icon-glyph)' : 'var(--ui-accent-normal-text)'};display:flex;height:28px;justify-content:center;width:30px;`
  const folderTitleStyle =
    'color:var(--ui-normal-text);font-size:13px;font-weight:650;line-height:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  const folderMetaStyle =
    'align-items:center;color:var(--ui-muted-text);display:flex;font-size:12px;gap:8px;line-height:16px;white-space:nowrap;'
</script>

{#snippet SeparatorDot()}
  <span style={separatorDotStyle} aria-hidden="true"></span>
{/snippet}

{#snippet GutterLines(depth: number, ancestorIds: string[], showStem: boolean)}
  <div style={gutterStyle} aria-hidden="true">
    {#each ancestorIds as ancestorId, lineIndex (ancestorId)}
      <span style={gutterLineStyle(lineIndex)}></span>
    {/each}
    {#if showStem && depth > 0}
      <span style={gutterStemStyle(depth)}></span>
    {/if}
  </div>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, parentFolderId: string | null, depth: number, ancestorIds: string[])}
  <div style={dividerShellStyle(depth)}>
    {@render GutterLines(depth, ancestorIds, false)}
    <PromptDivider
      onAddPrompt={() => addPromptAfter(previousPromptId, parentFolderId)}
      testId={previousPromptId
        ? `mockup-prompt-divider-add-after-${previousPromptId}`
        : 'mockup-prompt-divider-add-initial'}
    />
  </div>
{/snippet}

{#snippet FolderRow(row: VisibleFolderRow)}
  <div style={rowShellStyle(row.depth)} data-testid={`mockup-folder-row-${row.id}`}>
    {@render GutterLines(row.depth, row.ancestorIds, row.depth > 0)}
    <button
      type="button"
      style={folderButtonStyle(row)}
      aria-expanded={!row.collapsed}
      onmouseenter={() => {
        hoveredFolderId = row.id
      }}
      onmouseleave={() => {
        hoveredFolderId = null
      }}
      onclick={() => toggleFolder(row.id)}
    >
      <span style={chevronStyle}>
        {#if row.collapsed}
          <ChevronRight size={17} aria-hidden="true" />
        {:else}
          <ChevronDown size={17} aria-hidden="true" />
        {/if}
      </span>

      <span style={folderIconStyle(row)}>
        {#if row.collapsed}
          <Folder size={16} aria-hidden="true" />
        {:else}
          <FolderOpen size={16} aria-hidden="true" />
        {/if}
      </span>

      <span style={folderTitleStyle}>{row.title}</span>

      <span style={folderMetaStyle}>
        <span>{formatPromptCount(row.promptCount)}</span>
        {@render SeparatorDot()}
        <span>{row.modifiedLabel}</span>
      </span>
    </button>
  </div>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number, totalPrompts: number)}
  <article
    style={`${promptCardBaseStyle}box-shadow:${hoveredPromptId === prompt.id ? 'inset 0 0 0 1px var(--ui-accent-strong-border),0 10px 20px var(--ui-shadow-raised)' : 'inset 0 0 0 1px transparent'};transform:${hoveredPromptId === prompt.id ? 'translateY(-1px)' : 'translateY(0)'};`}
    data-testid={`mockup-prompt-editor-${prompt.id}`}
    onmouseenter={() => {
      hoveredPromptId = prompt.id
    }}
    onmouseleave={() => {
      hoveredPromptId = null
    }}
  >
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId="mockup-prompts"
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === totalPrompts - 1}
      onMoveUp={() => movePrompt(prompt.id, -1)}
      onMoveDown={() => movePrompt(prompt.id, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div style={promptBodyStyle}>
      <header
        style={`${titleBarBaseStyle}height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      >
        <div style={titleMainStyle}>
          <span style={titleIconStyle}>
            <FileText size={24} aria-hidden="true" />
          </span>

          <div style={titleCopyStyle}>
            <input style={titleInputStyle} value={prompt.title} aria-label="Prompt title" />
            <div style={metadataRowStyle}>
              <span style={metadataFolderStyle} title={prompt.folder}>
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

      <span style={titleBodySeparatorStyle} aria-hidden="true"></span>

      <div style={monacoShellStyle}>
        <div
          style={monacoHostStyle}
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

<section style={rootStyle} data-testid="subfolders-222207083-mockup">
  <div style={editorRowStyle}>
    {@render PromptDividerRow(null, null, 0, [])}

    {#each visibleRows as row (getVisibleRowKey(row))}
      {#if row.kind === 'folder'}
        {@render FolderRow(row)}
      {:else}
        {@const promptIndex = visiblePromptIds.indexOf(row.prompt.id)}
        <div style={rowShellStyle(row.depth)} data-testid={`mockup-prompt-row-${row.prompt.id}`}>
          {@render GutterLines(row.depth, row.ancestorIds, row.depth > 0)}
          {@render PromptEditor(row.prompt, promptIndex, visiblePromptIds.length)}
        </div>
        {@render PromptDividerRow(row.prompt.id, row.parentFolderId, row.depth, row.ancestorIds)}
      {/if}
    {/each}
  </div>
</section>
