<script lang="ts">
  import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    GripVertical,
    MoreHorizontal,
    Pin,
    Trash2
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-27215051',
    title: 'Editor 27215051',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 27215051
  }

  type PromptCard = {
    id: string
    title: string
    section: string
    text: string
  }

  let prompts = $state<PromptCard[]>([
    {
      id: 'prompt-code-review',
      title: 'Review Current Diff',
      section: 'Code Review',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Return the highest-impact issues first. Include file paths and concrete fixes when possible.`
    },
    {
      id: 'prompt-implementation-plan',
      title: 'Implementation Plan',
      section: 'Planning',
      text: `Create a staged implementation plan for this feature.

Keep each step independently testable. Call out unknowns, risky assumptions, and the fastest useful validation path.`
    },
    {
      id: 'prompt-test-pass',
      title: 'Targeted Test Pass',
      section: 'Testing',
      text: `Identify the smallest meaningful test set for this change.

Prefer behavior-level coverage. Include any Playwright flows needed to reproduce user-visible regressions.`
    },
    {
      id: 'prompt-pr-notes',
      title: 'Pull Request Notes',
      section: 'Release',
      text: `Write a concise pull request summary.

Start with user-visible behavior, then include implementation notes and the exact verification commands that were run.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
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

  const getLineCount = (text: string) => text.split('\n').length

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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 136
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 780
</script>

<div
  style="min-height: 100%; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 18px 0 34px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="max-width: 1180px; margin: 0 auto; display: grid; gap: 10px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const lineCount = getLineCount(prompt.text)}
      <section
        role="group"
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        ondragover={(event) => event.preventDefault()}
        ondrop={() => dropPrompt(prompt.id)}
        style={`display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, oklch(0.235 0.012 268 / 92%), oklch(0.165 0.011 268 / 94%)); box-shadow: 0 18px 38px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 9px; backdrop-filter: blur(18px);`}
      >
        <div style="display: grid; grid-template-rows: 1fr auto auto; gap: 6px;">
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
            style="width: 30px; min-height: 96px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); cursor: grab; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            <GripVertical size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            onclick={() => movePrompt(prompt.id, -1)}
            disabled={index === 0}
            style={`width: 30px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.45' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ChevronUp size={15} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            onclick={() => movePrompt(prompt.id, 1)}
            disabled={index === prompts.length - 1}
            style={`width: 30px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.45' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ChevronDown size={15} strokeWidth={2.4} />
          </button>
        </div>

        <div
          style="min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px;"
        >
          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: oklch(1 0 0 / 3%); padding: 7px 8px 7px 10px;"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 9px;"
            >
              <div
                style="width: 24px; height: 24px; display: inline-grid; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 6px; background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph); box-shadow: 0 0 0 3px var(--ui-accent-icon-ring);"
              >
                <Pin size={13} strokeWidth={2.4} />
              </div>

              <div style="min-width: 0; display: grid; gap: 3px;">
                <input
                  data-testid="prompt-title"
                  value={prompt.title}
                  placeholder={`Title (Prompt ${index + 1})`}
                  oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
                  style="width: 100%; min-width: 0; height: 22px; border: 0; background: transparent; color: oklch(0.94 0.004 268); outline: none; padding: 0; font-family: 'Cascadia Code', Consolas, monospace; font-size: 14px; font-weight: 650; line-height: 20px;"
                />

                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                  <span
                    style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text); font-size: 11px; font-weight: 650; line-height: 16px;"
                  >
                    {prompt.section}
                  </span>
                  <span
                    style="width: 3px; height: 3px; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span
                    style="color: var(--ui-muted-text); font-size: 11px; font-weight: 650; line-height: 16px;"
                  >
                    {lineCount} lines
                  </span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button
                type="button"
                data-testid="prompt-copy-button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`height: 30px; min-width: ${copiedPromptId === prompt.id ? '78px' : '34px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--ui-accent-normal-border); border-radius: 6px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 9px; font-size: 12px; font-weight: 700; cursor: pointer;`}
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
                style="height: 30px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <MoreHorizontal size={16} strokeWidth={2.3} />
              </button>

              <button
                type="button"
                aria-label="Delete prompt"
                onclick={() => {
                  prompts = prompts.filter((item) => item.id !== prompt.id)
                }}
                style="height: 30px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-danger-normal-border); border-radius: 6px; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph); cursor: pointer;"
              >
                <Trash2 size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0; overflow: hidden; border: 1px solid var(--ui-neutral-normal-border); border-radius: 7px; background: oklch(0.142 0.01 268); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight), 0 12px 22px var(--ui-shadow-raised);"
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
