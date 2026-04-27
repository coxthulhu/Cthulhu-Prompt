<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Copy,
    FileText,
    Folder,
    GripVertical,
    MoreHorizontal,
    Pin,
    Trash2
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-27232901',
    title: 'Editor 27232901',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 27232901
  }

  type PromptEditor = {
    id: string
    title: string
    folder: string
    state: 'Ready' | 'Draft' | 'Pinned' | 'Saved'
    accent: 'accent' | 'success' | 'warning' | 'info'
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'review-current-diff',
      title: 'Review Current Diff',
      folder: 'Code Review',
      state: 'Ready',
      accent: 'success',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with the highest-impact findings. Include file paths, line references, and concrete fixes where possible.`
    },
    {
      id: 'feature-pass',
      title: 'Plan Feature Pass',
      folder: 'Planning',
      state: 'Draft',
      accent: 'warning',
      text: `Turn this request into a focused implementation pass.

Preserve existing patterns, keep the change scoped, and list any assumptions that affect the result.`
    },
    {
      id: 'test-strategy',
      title: 'Compose Test Strategy',
      folder: 'Testing',
      state: 'Pinned',
      accent: 'accent',
      text: `Choose the smallest meaningful verification set for this change.

Prefer behavior-level tests and include any Playwright flow needed for user-visible regressions.`
    },
    {
      id: 'pull-request-notes',
      title: 'Draft Pull Request Notes',
      folder: 'Release',
      state: 'Saved',
      accent: 'info',
      text: `Write concise pull request notes.

Start with user-visible behavior, then include implementation details and the exact verification commands that were run.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let draggedPromptId = $state<string | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let editorWidths = $state<Record<string, number>>({})
  let editorHeights = $state<Record<string, number>>({})
  let copyResetTimer: number | null = null

  const getLineCount = (text: string) => text.split('\n').length
  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

  const getStateSurface = (prompt: PromptEditor) => {
    if (prompt.accent === 'success') return 'var(--ui-success-normal-surface)'
    if (prompt.accent === 'warning') return 'var(--ui-warning-normal-surface)'
    if (prompt.accent === 'info') return 'var(--ui-info-normal-surface)'
    return 'var(--ui-accent-normal-surface)'
  }

  const getStateBorder = (prompt: PromptEditor) => {
    if (prompt.accent === 'success') return 'var(--ui-success-normal-border)'
    if (prompt.accent === 'warning') return 'var(--ui-warning-normal-border)'
    if (prompt.accent === 'info') return 'var(--ui-info-normal-border)'
    return 'var(--ui-accent-normal-border)'
  }

  const getStateText = (prompt: PromptEditor) => {
    if (prompt.accent === 'success') return 'var(--ui-success-normal-text)'
    if (prompt.accent === 'accent') return 'var(--ui-accent-normal-text)'
    return 'var(--ui-secondary-text)'
  }

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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 146
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 960
</script>

<div
  style="width: 100%; min-height: 100%; box-sizing: border-box; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 16px 18px 36px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="width: 100%; display: grid; gap: 12px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const lineCount = getLineCount(prompt.text)}
      {@const tokenEstimate = getTokenEstimate(prompt.text)}
      <section
        role="group"
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        ondragover={(event) => event.preventDefault()}
        ondrop={() => dropPrompt(prompt.id)}
        style={`width: 100%; min-width: 0; box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; overflow: hidden; border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 18px 36px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); backdrop-filter: blur(18px);`}
      >
        <div
          style="min-width: 0; display: flex; align-items: stretch; gap: 0; border-bottom: 1px solid var(--ui-card-nested-border);"
        >
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
            style="width: 42px; flex: 0 0 42px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); cursor: grab;"
          >
            <GripVertical size={17} strokeWidth={2.4} />
          </button>

          <div
            style="min-width: 0; flex: 1 1 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 9px 10px;"
          >
            <div
              style={`width: 30px; height: 30px; flex: 0 0 auto; display: inline-grid; place-items: center; border: 1px solid ${getStateBorder(prompt)}; border-radius: 7px; background: ${getStateSurface(prompt)}; color: ${getStateText(prompt)}; box-shadow: 0 0 0 3px var(--ui-card-nested-inset-highlight);`}
            >
              {#if prompt.state === 'Pinned'}
                <Pin size={15} strokeWidth={2.3} />
              {:else}
                <FileText size={15} strokeWidth={2.3} />
              {/if}
            </div>

            <input
              data-testid="prompt-title"
              value={prompt.title}
              placeholder={`Prompt ${index + 1}`}
              oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
              style="min-width: 220px; flex: 1 1 340px; height: 30px; border: 0; background: transparent; color: var(--ui-normal-text); outline: none; padding: 0; font-family: 'Cascadia Code', Consolas, monospace; font-size: 15px; font-weight: 700; line-height: 22px;"
            />

            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 7px;">
              <span
                style="height: 24px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 0 9px; font-size: 11px; font-weight: 700; line-height: 16px;"
              >
                <Folder size={12} strokeWidth={2.4} />
                {prompt.folder}
              </span>
              <span
                style={`height: 24px; display: inline-flex; align-items: center; border: 1px solid ${getStateBorder(prompt)}; border-radius: 999px; background: ${getStateSurface(prompt)}; color: ${getStateText(prompt)}; padding: 0 9px; font-size: 11px; font-weight: 800; line-height: 16px;`}
              >
                {prompt.state}
              </span>
              <span
                style="height: 24px; display: inline-flex; align-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); padding: 0 9px; font-size: 11px; font-weight: 700; line-height: 16px;"
              >
                {lineCount} lines
              </span>
              <span
                style="height: 24px; display: inline-flex; align-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); padding: 0 9px; font-size: 11px; font-weight: 700; line-height: 16px;"
              >
                {tokenEstimate} tokens
              </span>
            </div>
          </div>

          <div
            style="flex: 0 0 auto; display: flex; align-items: stretch; border-left: 1px solid var(--ui-card-nested-border);"
          >
            <button
              type="button"
              aria-label="Move prompt up"
              onclick={() => movePrompt(prompt.id, -1)}
              disabled={index === 0}
              style={`width: 38px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.45' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              aria-label="Move prompt down"
              onclick={() => movePrompt(prompt.id, 1)}
              disabled={index === prompts.length - 1}
              style={`width: 38px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.45' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
            >
              <ArrowDown size={15} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              data-testid="prompt-copy-button"
              aria-label="Copy prompt"
              onclick={() => copyPrompt(prompt)}
              style={`min-width: ${copiedPromptId === prompt.id ? '90px' : '42px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 11px; font-size: 12px; font-weight: 800; cursor: pointer;`}
            >
              {#if copiedPromptId === prompt.id}
                <Check size={15} strokeWidth={2.4} />
                <span>Copied</span>
              {:else}
                <Copy size={15} strokeWidth={2.3} />
              {/if}
            </button>
            <button
              type="button"
              aria-label="More actions"
              style="width: 42px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
            >
              <MoreHorizontal size={16} strokeWidth={2.3} />
            </button>
            <button
              type="button"
              aria-label="Delete prompt"
              onclick={() => {
                prompts = prompts.filter((item) => item.id !== prompt.id)
              }}
              style="width: 42px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph); cursor: pointer;"
            >
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div
          style="min-width: 0; display: flex; flex-wrap: wrap; align-items: stretch; gap: 0;"
        >
          <div
            style="flex: 0 0 42px; display: grid; grid-template-rows: repeat(3, 1fr); border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface);"
          >
            <div
              style="display: grid; place-items: center; border-bottom: 1px solid var(--ui-card-nested-border); color: var(--ui-muted-text); font-size: 10px; font-weight: 800; letter-spacing: 0;"
            >
              {String(index + 1).padStart(2, '0')}
            </div>
            <div
              style="display: grid; place-items: center; border-bottom: 1px solid var(--ui-card-nested-border); color: var(--ui-muted-text); font-size: 10px; font-weight: 800; letter-spacing: 0;"
            >
              TXT
            </div>
            <div
              style={`display: grid; place-items: center; color: ${getStateText(prompt)}; font-size: 10px; font-weight: 800; letter-spacing: 0;`}
            >
              ON
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 320px; flex: 1 1 720px; overflow: hidden; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
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

          <div
            style="min-width: 180px; flex: 0 1 220px; display: grid; grid-template-columns: 1fr 1fr; align-content: stretch; border-left: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface);"
          >
            <div
              style="min-width: 0; display: grid; align-content: center; gap: 4px; border-right: 1px solid var(--ui-card-nested-border); border-bottom: 1px solid var(--ui-card-nested-border); padding: 12px;"
            >
              <span
                style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 12px;"
              >
                Folder
              </span>
              <span
                style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 12px; font-weight: 800; line-height: 16px;"
                title={prompt.folder}
              >
                {prompt.folder}
              </span>
            </div>
            <div
              style="min-width: 0; display: grid; align-content: center; gap: 4px; border-bottom: 1px solid var(--ui-card-nested-border); padding: 12px;"
            >
              <span
                style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 12px;"
              >
                State
              </span>
              <span
                style={`min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${getStateText(prompt)}; font-size: 12px; font-weight: 800; line-height: 16px;`}
              >
                {prompt.state}
              </span>
            </div>
            <div
              style="min-width: 0; display: grid; align-content: center; gap: 4px; border-right: 1px solid var(--ui-card-nested-border); padding: 12px;"
            >
              <span
                style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 12px;"
              >
                Lines
              </span>
              <span style="color: var(--ui-normal-text); font-size: 12px; font-weight: 800;">
                {lineCount}
              </span>
            </div>
            <div
              style="min-width: 0; display: grid; align-content: center; gap: 4px; padding: 12px;"
            >
              <span
                style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 12px;"
              >
                Tokens
              </span>
              <span style="color: var(--ui-normal-text); font-size: 12px; font-weight: 800;">
                {tokenEstimate}
              </span>
            </div>
          </div>
        </div>
      </section>
    {/each}
  </div>
</div>
