<script lang="ts">
  import {
    Archive,
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    GripVertical,
    MoreHorizontal,
    Search,
    Sparkles,
    Trash2
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-27232832',
    title: 'Prompt Editors',
    kicker: 'Prompt Editors',
    description: 'Prompt editor cards',
    order: 27232832
  }

  type PromptEditor = {
    id: string
    title: string
    folder: string
    status: 'Ready' | 'Draft' | 'Pinned'
    tag: string
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'review-current-diff',
      title: 'Review Current Diff',
      folder: 'Code Review',
      status: 'Ready',
      tag: 'Review',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with the highest-impact findings. Include file paths, line references, and concrete fixes where possible.`
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      folder: 'Planning',
      status: 'Draft',
      tag: 'Build',
      text: `Turn this request into a focused implementation pass.

Preserve existing patterns, keep the change scoped, and list any assumptions that affect the result.`
    },
    {
      id: 'test-selection',
      title: 'Test Selection',
      folder: 'Testing',
      status: 'Ready',
      tag: 'Verify',
      text: `Choose the smallest meaningful verification set for this change.

Prefer behavior-level tests and include any Playwright flow needed for user-visible regressions.`
    },
    {
      id: 'pull-request-notes',
      title: 'Pull Request Notes',
      folder: 'Release',
      status: 'Pinned',
      tag: 'Ship',
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

    return {
      background: 'var(--ui-neutral-normal-surface)',
      border: 'var(--ui-neutral-normal-border)',
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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 144
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 980
</script>

<div
  style="min-height: 100%; width: 100%; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 6px 0 30px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="display: grid; width: 100%; gap: 10px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const lineCount = getLineCount(prompt.text)}
      {@const statusStyles = getStatusStyles(prompt.status)}
      <section
        role="group"
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        ondragover={(event) => event.preventDefault()}
        ondrop={() => dropPrompt(prompt.id)}
        style={`width: 100%; min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 14px 30px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight); overflow: hidden;`}
      >
        <div
          style="display: grid; grid-template-rows: auto 1fr auto auto; align-items: stretch; gap: 6px; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); padding: 8px;"
        >
          <div
            style="height: 34px; display: grid; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 7px; background: var(--ui-accent-icon-surface); color: var(--ui-accent-icon-glyph); box-shadow: 0 0 0 3px var(--ui-accent-icon-ring); font-size: 12px; font-weight: 800;"
          >
            {index + 1}
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
            style="min-height: 76px; width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); color: var(--ui-muted-text); cursor: grab; justify-self: center;"
          >
            <GripVertical size={17} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            onclick={() => movePrompt(prompt.id, -1)}
            disabled={index === 0}
            style={`width: 34px; height: 30px; display: inline-flex; align-items: center; justify-content: center; justify-self: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.45' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ChevronUp size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            onclick={() => movePrompt(prompt.id, 1)}
            disabled={index === prompts.length - 1}
            style={`width: 34px; height: 30px; display: inline-flex; align-items: center; justify-content: center; justify-self: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.45' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ChevronDown size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div style="min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0;">
          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; border-bottom: 1px solid var(--ui-card-nested-border);"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px 12px;"
            >
              <div
                style="width: 40px; height: 40px; display: inline-grid; place-items: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: 8px; background: var(--ui-card-nested-surface); color: var(--ui-hoverable-text); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
              >
                {#if prompt.status === 'Pinned'}
                  <Sparkles size={17} strokeWidth={2.2} />
                {:else}
                  <FileText size={17} strokeWidth={2.2} />
                {/if}
              </div>

              <div style="min-width: 0; display: grid; gap: 5px;">
                <input
                  data-testid="prompt-title"
                  value={prompt.title}
                  placeholder={`Prompt ${index + 1}`}
                  oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
                  style="width: 100%; min-width: 0; height: 23px; border: 0; background: transparent; color: var(--ui-normal-text); outline: none; padding: 0; font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; font-size: 15px; font-weight: 750; line-height: 22px;"
                />

                <div
                  style="display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 6px;"
                >
                  <span
                    style="max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text); font-size: 11px; font-weight: 700; line-height: 16px;"
                  >
                    {prompt.folder}
                  </span>
                  <span
                    style="width: 3px; height: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span
                    style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px;"
                  >
                    {prompt.tag}
                  </span>
                  <span
                    style="width: 3px; height: 3px; flex: 0 0 auto; border-radius: 999px; background: var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span
                    style="color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 16px;"
                  >
                    {lineCount} lines
                  </span>
                  <span
                    style={`height: 19px; display: inline-flex; align-items: center; border: 1px solid ${statusStyles.border}; border-radius: 999px; background: ${statusStyles.background}; color: ${statusStyles.color}; padding: 0 8px; font-size: 11px; font-weight: 800; line-height: 16px;`}
                  >
                    {prompt.status}
                  </span>
                </div>
              </div>
            </div>

            <div
              style="display: flex; align-items: center; justify-content: flex-end; gap: 7px; border-left: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); padding: 10px;"
            >
              <button
                type="button"
                aria-label="Find in prompt"
                style="height: 34px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <Search size={16} strokeWidth={2.3} />
              </button>

              <button
                type="button"
                data-testid="prompt-copy-button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`height: 34px; min-width: ${copiedPromptId === prompt.id ? '92px' : '38px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--ui-accent-normal-border); border-radius: 7px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 10px; font-size: 12px; font-weight: 800; cursor: pointer;`}
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
                aria-label="Archive prompt"
                style="height: 34px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <Archive size={16} strokeWidth={2.2} />
              </button>

              <button
                type="button"
                aria-label="More actions"
                style="height: 34px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <MoreHorizontal size={16} strokeWidth={2.3} />
              </button>

              <button
                type="button"
                aria-label="Delete prompt"
                onclick={() => {
                  prompts = prompts.filter((item) => item.id !== prompt.id)
                }}
                style="height: 34px; min-width: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-danger-normal-border); border-radius: 7px; background: var(--ui-danger-normal-surface); color: var(--ui-danger-icon-glyph); cursor: pointer;"
              >
                <Trash2 size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 124px; align-items: stretch;"
          >
            <div
              use:measureEditorWidth={prompt.id}
              style="min-width: 0; overflow: hidden; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-card-nested-surface);"
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
              style="display: grid; align-content: start; gap: 8px; background: var(--ui-neutral-muted-surface); padding: 10px;"
            >
              <div
                style="display: grid; gap: 2px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); padding: 8px;"
              >
                <span
                  style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 13px;"
                >
                  Lines
                </span>
                <span
                  style="color: var(--ui-normal-text); font-size: 17px; font-weight: 800; line-height: 21px;"
                >
                  {lineCount}
                </span>
              </div>

              <div
                style="display: grid; gap: 2px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-normal-surface); padding: 8px;"
              >
                <span
                  style="color: var(--ui-muted-text); font-size: 10px; font-weight: 800; line-height: 13px;"
                >
                  Folder
                </span>
                <span
                  style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text); font-size: 12px; font-weight: 750; line-height: 16px;"
                  title={prompt.folder}
                >
                  {prompt.folder}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    {/each}
  </div>
</div>
