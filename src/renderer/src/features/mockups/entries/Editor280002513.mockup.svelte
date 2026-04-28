<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Copy,
    ExternalLink,
    FileText,
    Folder,
    GripVertical,
    MoreHorizontal,
    Pin,
    Trash2
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-280002513',
    title: 'Editor 280002513',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 280002513
  }

  type PromptEditor = {
    id: string
    title: string
    folder: string
    status: 'Ready' | 'Draft' | 'Pinned' | 'Saved'
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'review-current-diff',
      title: 'Review Current Diff',
      folder: 'Code Review',
      status: 'Ready',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with the highest-impact findings. Include file paths, line references, and concrete fixes where possible.`
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      folder: 'Planning',
      status: 'Draft',
      text: `Turn this request into a focused implementation pass.

Preserve existing patterns, keep the change scoped, and list any assumptions that affect the result.`
    },
    {
      id: 'test-selection',
      title: 'Test Selection',
      folder: 'Testing',
      status: 'Ready',
      text: `Choose the smallest meaningful verification set for this change.

Prefer behavior-level tests and include any Playwright flow needed for user-visible regressions.`
    },
    {
      id: 'pull-request-notes',
      title: 'Pull Request Notes',
      folder: 'Release',
      status: 'Pinned',
      text: `Write concise pull request notes.

Start with user-visible behavior, then include implementation details and the exact verification commands that were run.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let openedPromptId = $state<string | null>(null)
  let draggedPromptId = $state<string | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let editorWidths = $state<Record<string, number>>({})
  let editorHeights = $state<Record<string, number>>({})
  let copyResetTimer: number | null = null
  let openResetTimer: number | null = null

  const updateTitle = (promptId: string, title: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, title } : prompt))
  }

  const updateText = (promptId: string, text: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, text } : prompt))
  }

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const currentIndex = prompts.findIndex((prompt) => prompt.id === promptId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prompts.length) return

    const nextPrompts = [...prompts]
    const [prompt] = nextPrompts.splice(currentIndex, 1)
    nextPrompts.splice(nextIndex, 0, prompt)
    prompts = nextPrompts
  }

  const dropPrompt = (targetPromptId: string) => {
    if (!draggedPromptId || draggedPromptId === targetPromptId) return

    const draggedIndex = prompts.findIndex((prompt) => prompt.id === draggedPromptId)
    const targetIndex = prompts.findIndex((prompt) => prompt.id === targetPromptId)
    if (draggedIndex < 0 || targetIndex < 0) return

    const nextPrompts = [...prompts]
    const [draggedPrompt] = nextPrompts.splice(draggedIndex, 1)
    nextPrompts.splice(targetIndex, 0, draggedPrompt)
    prompts = nextPrompts
    draggedPromptId = null
  }

  const copyPrompt = (prompt: PromptEditor) => {
    void window.navigator.clipboard.writeText(prompt.text)
    copiedPromptId = prompt.id

    if (copyResetTimer != null) {
      window.clearTimeout(copyResetTimer)
    }

    copyResetTimer = window.setTimeout(() => {
      copiedPromptId = null
      copyResetTimer = null
    }, 1500)
  }

  const openPrompt = (promptId: string) => {
    openedPromptId = promptId

    if (openResetTimer != null) {
      window.clearTimeout(openResetTimer)
    }

    openResetTimer = window.setTimeout(() => {
      openedPromptId = null
      openResetTimer = null
    }, 1500)
  }

  const removePrompt = (promptId: string) => {
    prompts = prompts.filter((prompt) => prompt.id !== promptId)
  }

  const getLineCount = (text: string) => text.split('\n').length
  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

  const getStatusStyles = (status: PromptEditor['status']) => {
    if (status === 'Ready') {
      return {
        background: 'var(--ui-success-normal-surface)',
        border: 'var(--ui-success-normal-border)',
        color: 'var(--ui-success-normal-text)'
      }
    }

    if (status === 'Pinned') {
      return {
        background: 'var(--ui-accent-normal-surface)',
        border: 'var(--ui-accent-normal-border)',
        color: 'var(--ui-accent-normal-text)'
      }
    }

    if (status === 'Draft') {
      return {
        background: 'var(--ui-warning-normal-surface)',
        border: 'var(--ui-warning-normal-border)',
        color: 'var(--ui-secondary-text)'
      }
    }

    return {
      background: 'var(--ui-info-normal-surface)',
      border: 'var(--ui-info-normal-border)',
      color: 'var(--ui-secondary-text)'
    }
  }

  const measureEditorWidth = (node: HTMLElement, promptId: string) => {
    const updateWidth = () => {
      editorWidths = {
        ...editorWidths,
        [promptId]: Math.max(320, Math.floor(node.clientWidth))
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)

    return {
      update(nextPromptId: string) {
        promptId = nextPromptId
        updateWidth()
      },
      destroy() {
        observer.disconnect()
      }
    }
  }

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 152
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 1100
</script>

<div
  style="width: 100%; min-height: 100%; box-sizing: border-box; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 8px 0 34px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="width: 100%; min-width: 0; display: grid; gap: 10px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const lineCount = getLineCount(prompt.text)}
      {@const tokenEstimate = getTokenEstimate(prompt.text)}
      {@const statusStyles = getStatusStyles(prompt.status)}
      <section
        role="group"
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        ondragover={(event) => event.preventDefault()}
        ondrop={() => dropPrompt(prompt.id)}
        style={`width: 100%; min-width: 0; box-sizing: border-box; display: grid; grid-template-columns: 52px minmax(0, 1fr); border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; overflow: hidden; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 16px 34px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);`}
      >
        <div
          style="min-width: 0; display: grid; grid-template-rows: 46px 1fr 38px 38px; gap: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface);"
        >
          <div
            style="display: grid; place-items: center; border-bottom: 1px solid var(--ui-card-nested-border); color: var(--ui-hoverable-text); font-size: 12px; font-weight: 850; line-height: 16px;"
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          <button
            type="button"
            draggable="true"
            aria-label="Drag prompt"
            data-testid="prompt-drag-handle"
            ondragstart={() => {
              draggedPromptId = prompt.id
            }}
            ondragend={() => {
              draggedPromptId = null
            }}
            style="display: inline-flex; align-items: center; justify-content: center; border: 0; border-bottom: 1px solid var(--ui-card-nested-border); background: transparent; color: var(--ui-muted-text); cursor: grab;"
          >
            <GripVertical size={18} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            onclick={() => movePrompt(prompt.id, -1)}
            disabled={index === 0}
            style={`display: inline-flex; align-items: center; justify-content: center; border: 0; border-bottom: 1px solid var(--ui-card-nested-border); background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.45' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            onclick={() => movePrompt(prompt.id, 1)}
            disabled={index === prompts.length - 1}
            style={`display: inline-flex; align-items: center; justify-content: center; border: 0; background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.45' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ArrowDown size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div style="min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr);">
          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; border-bottom: 1px solid var(--ui-card-nested-border);"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px 12px;"
            >
              <div
                style={`width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid ${statusStyles.border}; border-radius: 8px; background: ${statusStyles.background}; color: ${statusStyles.color}; box-shadow: 0 0 0 3px var(--ui-card-nested-inset-highlight);`}
              >
                {#if prompt.status === 'Pinned'}
                  <Pin size={16} strokeWidth={2.3} />
                {:else}
                  <FileText size={16} strokeWidth={2.3} />
                {/if}
              </div>

              <div style="min-width: 0; display: grid; gap: 5px;">
                <input
                  data-testid="prompt-title"
                  value={prompt.title}
                  placeholder={`Prompt ${index + 1}`}
                  oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
                  style="width: 100%; min-width: 0; height: 24px; border: 0; background: transparent; color: var(--ui-normal-text); outline: none; padding: 0; font: inherit; font-size: 15px; font-weight: 800; line-height: 22px;"
                />

                <div
                  style="min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px;"
                >
                  <span
                    style="max-width: 240px; min-width: 0; display: inline-flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text); font-size: 11px; font-weight: 750; line-height: 16px;"
                    title={prompt.folder}
                  >
                    <Folder size={12} strokeWidth={2.4} />
                    {prompt.folder}
                  </span>
                  <span
                    style={`height: 20px; display: inline-flex; align-items: center; border: 1px solid ${statusStyles.border}; border-radius: 999px; background: ${statusStyles.background}; color: ${statusStyles.color}; padding: 0 8px; font-size: 11px; font-weight: 800; line-height: 16px;`}
                  >
                    {prompt.status}
                  </span>
                  <span
                    style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px;"
                  >
                    {lineCount} lines
                  </span>
                  <span
                    style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px;"
                  >
                    {tokenEstimate} tokens
                  </span>
                </div>
              </div>
            </div>

            <div
              style="display: flex; align-items: stretch; border-left: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface);"
            >
              <button
                type="button"
                aria-label="Open prompt"
                onclick={() => openPrompt(prompt.id)}
                style={`min-width: ${openedPromptId === prompt.id ? '98px' : '44px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-info-normal-surface); color: var(--ui-hoverable-text); padding: 0 11px; font-size: 12px; font-weight: 800; cursor: pointer;`}
              >
                <ExternalLink size={16} strokeWidth={2.3} />
                {#if openedPromptId === prompt.id}
                  <span>Opening</span>
                {/if}
              </button>

              <button
                type="button"
                data-testid="prompt-copy-button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`min-width: ${copiedPromptId === prompt.id ? '92px' : '44px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 11px; font-size: 12px; font-weight: 800; cursor: pointer;`}
              >
                {#if copiedPromptId === prompt.id}
                  <Check size={15} strokeWidth={2.4} />
                  <span>Copied</span>
                {:else}
                  <Copy size={16} strokeWidth={2.3} />
                {/if}
              </button>

              <button
                type="button"
                aria-label="More actions"
                style="width: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <MoreHorizontal size={16} strokeWidth={2.3} />
              </button>

              <button
                type="button"
                aria-label="Delete prompt"
                onclick={() => removePrompt(prompt.id)}
                style="width: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph); cursor: pointer;"
              >
                <Trash2 size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0; overflow: hidden; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            {#if overflowHost}
              <HydratableMonacoEditor
                initialValue={prompt.text}
                initialViewStateJson={null}
                viewStateCaptureKey={`mockup:${prompt.id}`}
                containerWidthPx={getEditorWidth(prompt.id)}
                placeholderHeightPx={getEditorHeight(prompt.id)}
                overflowWidgetsDomNode={overflowHost}
                hydrationPriority={index}
                shouldDehydrate={false}
                rowId={`mockup-row-${prompt.id}`}
                findSectionKey="mockup-body"
                findRequest={null}
                onChange={(text, meta) => {
                  updateText(prompt.id, text)
                  editorHeights = { ...editorHeights, [prompt.id]: meta.heightPx }
                }}
              />
            {/if}
          </div>
        </div>
      </section>
    {/each}
  </div>
</div>
