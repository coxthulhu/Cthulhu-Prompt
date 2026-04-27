<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Check,
    Copy,
    GripVertical,
    Trash2
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  type PromptCard = {
    id: string
    title: string
    text: string
  }

  let prompts = $state<PromptCard[]>([
    {
      id: 'prompt-architecture-review',
      title: 'Architecture Review',
      text: `Review this codebase for architectural risks, hidden coupling, and boundary violations.

Focus on changes that would reduce future maintenance cost without over-engineering the current implementation.`
    },
    {
      id: 'prompt-refactor-plan',
      title: 'Refactor Plan',
      text: `Create a small, staged refactor plan for the selected module.

Keep each step independently shippable and include the tests that should move with the change.`
    },
    {
      id: 'prompt-test-coverage',
      title: 'Test Coverage',
      text: `Identify the missing tests for this feature.

Prioritize behavior that could regress silently and avoid snapshot-only coverage unless the UI surface truly requires it.`
    },
    {
      id: 'prompt-pr-summary',
      title: 'PR Summary',
      text: `Write a concise pull request summary with the user-visible behavior first, implementation notes second, and verification steps last.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let pendingDeletePromptId = $state<string | null>(null)
  let draggedPromptId = $state<string | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let editorWidths = $state<Record<string, number>>({})
  let editorHeights = $state<Record<string, number>>({})
  let copyResetTimer: number | null = null

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const currentIndex = prompts.findIndex((prompt) => prompt.id === promptId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prompts.length) return

    const nextPrompts = [...prompts]
    const [prompt] = nextPrompts.splice(currentIndex, 1)
    nextPrompts.splice(nextIndex, 0, prompt)
    prompts = nextPrompts
  }

  const updateTitle = (promptId: string, title: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, title } : prompt))
  }

  const updateText = (promptId: string, text: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, text } : prompt))
  }

  const copyPrompt = (prompt: PromptCard) => {
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

  const deletePrompt = () => {
    if (!pendingDeletePromptId) return
    prompts = prompts.filter((prompt) => prompt.id !== pendingDeletePromptId)
    pendingDeletePromptId = null
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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 132
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 760
</script>

<div
  style="min-height: 100%; background: oklch(0.13 0.012 268); color: var(--ui-normal-text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 28px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="max-width: 1120px; margin: 0 auto; display: grid; gap: 12px;">
    {#each prompts as prompt, index (prompt.id)}
      <section
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        ondragover={(event) => event.preventDefault()}
        ondrop={() => dropPrompt(prompt.id)}
        style={`display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 10px; border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 16px 34px var(--ui-card-normal-shadow); backdrop-filter: blur(18px);`}
      >
        <div
          style="display: grid; grid-template-rows: 1fr 30px 30px; gap: 6px; min-height: 188px;"
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
            style="width: 34px; min-height: 92px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); cursor: grab; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            <GripVertical size={17} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            onclick={() => movePrompt(prompt.id, -1)}
            disabled={index === 0}
            style={`width: 34px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; cursor: ${index === 0 ? 'default' : 'pointer'}; opacity: ${index === 0 ? '0.46' : '1'};`}
          >
            <ChevronUp size={16} strokeWidth={2.3} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            onclick={() => movePrompt(prompt.id, 1)}
            disabled={index === prompts.length - 1}
            style={`width: 34px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'}; opacity: ${index === prompts.length - 1 ? '0.46' : '1'};`}
          >
            <ChevronDown size={16} strokeWidth={2.3} />
          </button>
        </div>

        <div style="min-width: 0; display: grid; gap: 8px;">
          <div
            style="height: 36px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 0 2px 0 0;"
          >
            <input
              data-testid="prompt-title"
              value={prompt.title}
              placeholder={`Title (Prompt ${index + 1})`}
              oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
              style="width: 100%; min-width: 0; height: 32px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: oklch(0.92 0.006 268); outline: none; padding: 0 8px; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 15px; font-weight: 650; line-height: 20px;"
            />

            <div style="display: flex; align-items: center; gap: 6px;">
              <button
                type="button"
                data-testid="prompt-copy-button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style="height: 30px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 6px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); cursor: pointer;"
              >
                {#if copiedPromptId === prompt.id}
                  <Check size={16} strokeWidth={2.4} />
                {:else}
                  <Copy size={15} strokeWidth={2.2} />
                {/if}
              </button>

              <button
                type="button"
                aria-label="Delete prompt"
                onclick={() => {
                  pendingDeletePromptId = prompt.id
                }}
                style="height: 30px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-danger-normal-border); border-radius: 6px; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph); cursor: pointer;"
              >
                <Trash2 size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0; overflow: hidden; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: oklch(0.16 0.01 268); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), 0 10px 24px var(--ui-shadow-raised);"
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

  {#if pendingDeletePromptId}
    <div
      style="position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 24px; background: oklch(0 0 0 / 54%);"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-prompt-title"
        style="width: min(420px, 100%); border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: oklch(0.16 0.012 268); box-shadow: 0 24px 70px oklch(0 0 0 / 52%); padding: 18px;"
      >
        <div
          id="delete-prompt-title"
          style="color: var(--ui-normal-text); font-size: 15px; font-weight: 700; line-height: 20px;"
        >
          Delete Prompt
        </div>
        <div style="margin-top: 7px; color: var(--ui-secondary-text); font-size: 13px; line-height: 18px;">
          Are you sure you want to delete this prompt?
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
          <button
            type="button"
            onclick={() => {
              pendingDeletePromptId = null
            }}
            style="height: 32px; padding: 0 12px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-neutral-normal-surface); color: var(--ui-secondary-text); font-size: 13px; font-weight: 650; cursor: pointer;"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={deletePrompt}
            style="height: 32px; padding: 0 12px; border: 1px solid var(--ui-danger-hover-border); border-radius: 6px; background: var(--ui-danger-hover-surface); color: var(--ui-danger-icon-glyph); font-size: 13px; font-weight: 650; cursor: pointer;"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
