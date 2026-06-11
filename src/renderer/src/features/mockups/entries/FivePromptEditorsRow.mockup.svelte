<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Snippet } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    ChevronDown,
    ChevronUp,
    Clipboard,
    FileText,
    Folder,
    GripVertical,
    Trash2
  } from 'lucide-svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'

  type MockPrompt = {
    id: string
    title: string
    folder: string
    modifiedLabel: string
    text: string
  }

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Prompts',
      modifiedLabel: 'Updated 2 min ago',
      text: [
        'Review the workspace import flow and identify any edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
        '',
        'Return the findings as concrete bugs with file references and suggested tests.'
      ].join('\n')
    },
    {
      id: 'mockup-refactor',
      title: 'Refactor editor sizing controller',
      folder: 'Prompts',
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
      folder: 'Prompts',
      modifiedLabel: 'Updated 1 hr ago',
      text: [
        'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
        '',
        'List only issues that can produce user-visible regressions.'
      ].join('\n')
    },
    {
      id: 'mockup-tests',
      title: 'Write Playwright coverage',
      folder: 'Prompts',
      modifiedLabel: 'Updated yesterday',
      text: [
        'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
        '',
        'Use the existing test helpers and data-testid selectors.'
      ].join('\n')
    },
    {
      id: 'mockup-polish',
      title: 'Polish settings controls',
      folder: 'Prompts',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    }
  ])

  const sizingConfig = {
    fontSize: 15,
    minLines: 5,
    maxLines: 10
  }
  const lineHeightPx = Math.round(sizingConfig.fontSize * 1.35)
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
    monaco.Uri.file(`/cthulhu-prompt/mockups/five-prompt-editors-row/${promptId}.md`)

  const handleCopy = (text: string) => {
    void window.navigator.clipboard?.writeText(text)
  }

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
      padding: { top: 5, bottom: 5 },
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

{#snippet ChevronUpIcon()}
  <ChevronUp size={16} aria-hidden="true" />
{/snippet}

{#snippet GripVerticalIcon()}
  <GripVertical size={16} aria-hidden="true" />
{/snippet}

{#snippet ChevronDownIcon()}
  <ChevronDown size={16} aria-hidden="true" />
{/snippet}

{#snippet ClipboardIcon()}
  <Clipboard size={16} aria-hidden="true" />
{/snippet}

{#snippet TrashIcon()}
  <Trash2 size={16} aria-hidden="true" />
{/snippet}

{#snippet IconButton(icon: Snippet, label: string, disabled = false, onclick?: () => void)}
  <button
    type="button"
    class="mockup-icon-button"
    aria-label={label}
    title={label}
    data-disabled={disabled ? 'true' : 'false'}
    disabled={disabled}
    {onclick}
  >
    {@render icon()}
  </button>
{/snippet}

{#snippet SeparatorDot()}
  <span class="mockup-separator-dot" aria-hidden="true"></span>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number)}
  <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <aside class="mockup-prompt-editor-sidebar" aria-label={`${prompt.title} prompt controls`}>
      {@render IconButton(ChevronUpIcon, 'Move prompt up', index === 0)}
      {@render IconButton(GripVerticalIcon, 'Drag prompt')}
      {@render IconButton(ChevronDownIcon, 'Move prompt down', index === mockPrompts.length - 1)}
    </aside>

    <div class="mockup-prompt-editor-body">
      <header class="mockup-prompt-editor-title-bar">
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

        <div class="mockup-button-bar">
          {@render IconButton(ClipboardIcon, 'Copy prompt', false, () => handleCopy(prompt.text))}
          <span class="mockup-vertical-separator" aria-hidden="true"></span>
          {@render IconButton(TrashIcon, 'Delete prompt')}
        </div>
      </header>

      <div class="mockup-monaco-shell">
        <div
          class="mockup-monaco-host"
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

<section class="five-prompt-editors-row-mockup" data-testid="five-prompt-editors-row-mockup">
  <div class="mockup-editor-row">
    {#each mockPrompts as prompt, index (prompt.id)}
      {@render PromptEditor(prompt, index)}
    {/each}
  </div>
</section>

<style>
  .five-prompt-editors-row-mockup {
    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-prompt-editor-card {
    align-items: stretch;
    background: var(--ui-flat-card-normal-surface-gradient-start);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    gap: 10px;
    grid-template-columns: 28px minmax(0, 1fr);
    min-width: 0;
    padding: 10px;
  }

  .mockup-prompt-editor-sidebar {
    display: grid;
    flex: 0 0 28px;
    gap: 6px;
    grid-template-rows: 28px minmax(0, 1fr) 28px;
    height: 100%;
    min-height: 136px;
    width: 28px;
  }

  .mockup-prompt-editor-body {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-template-rows: auto auto;
    min-width: 0;
  }

  .mockup-prompt-editor-title-bar {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 7px;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    padding: 8px 8px 8px 10px;
  }

  .mockup-prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-title-icon {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-flat-hoverable-icon-glyph);
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

  .mockup-button-bar {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
  }

  .mockup-icon-button {
    align-items: center;
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-normal-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 36px;
    justify-content: center;
    min-width: 0;
    padding: 0;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 36px;
  }

  .mockup-prompt-editor-sidebar .mockup-icon-button {
    background: var(--ui-flat-neutral-action-fill);
    height: 28px;
    width: 28px;
  }

  .mockup-prompt-editor-sidebar .mockup-icon-button:nth-child(2) {
    height: 100%;
    min-height: 0;
  }

  .mockup-icon-button:hover,
  .mockup-icon-button:focus-visible {
    background: var(--ui-flat-neutral-action-hover-fill);
  }

  .mockup-icon-button:focus-visible {
    outline: 2px solid var(--ui-flat-neutral-focus-border);
    outline-offset: 2px;
  }

  .mockup-icon-button[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .mockup-vertical-separator {
    background: var(--ui-neutral-muted-border);
    flex: 0 0 1px;
    height: 24px;
    width: 1px;
  }

  .mockup-monaco-shell {
    min-width: 0;
  }

  .mockup-monaco-host {
    min-height: 101px;
    min-width: 0;
    position: relative;
    width: 100%;
  }
</style>
