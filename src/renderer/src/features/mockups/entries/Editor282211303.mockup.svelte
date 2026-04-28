<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Copy,
    ExternalLink,
    FileText,
    GripVertical,
    MoreHorizontal,
    Star
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-282211303',
    title: 'Editor 282211303',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 282211303
  }

  type PromptStatus = 'Ready' | 'Draft' | 'Pinned' | 'Review'

  type PromptEditor = {
    id: string
    title: string
    folder: string
    status: PromptStatus
    updated: string
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'daily-review',
      title: 'Daily Review',
      folder: 'Code Review',
      status: 'Ready',
      updated: 'Saved 2 min ago',
      text: `Review the current branch for correctness, maintainability, and user-visible regressions.

Start with findings ordered by severity. Include file paths and concrete fixes where possible.`
    },
    {
      id: 'implementation-plan',
      title: 'Implementation Plan',
      folder: 'Planning',
      status: 'Draft',
      updated: 'Saved 14 min ago',
      text: `Turn the request into a practical implementation plan.

Call out assumptions, affected files, test coverage, and the smallest useful sequence of changes.`
    },
    {
      id: 'playwright-flow',
      title: 'Playwright Flow',
      folder: 'Testing',
      status: 'Review',
      updated: 'Saved 1 hr ago',
      text: `Create an end-to-end test for the main user flow.

Use data-testid selectors, keep setup explicit, and assert the final user-visible state.`
    },
    {
      id: 'release-notes',
      title: 'Release Notes',
      folder: 'Release',
      status: 'Pinned',
      updated: 'Saved yesterday',
      text: `Write concise release notes for this change.

Lead with behavior, include any migration notes, and list the verification commands that passed.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let activePromptId = $state('daily-review')
  let overflowHost = $state<HTMLDivElement | null>(null)
  let editorWidths = $state<Record<string, number>>({})
  let editorHeights = $state<Record<string, number>>({})
  let copyResetTimer: number | null = null

  const editorBackground = '#1F1F1F'

  const updatePromptTitle = (promptId: string, title: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, title } : prompt))
  }

  const updatePromptText = (promptId: string, text: string) => {
    prompts = prompts.map((prompt) => (prompt.id === promptId ? { ...prompt, text } : prompt))
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
    }, 1200)
  }

  const getStatusStyles = (status: PromptStatus) => {
    if (status === 'Ready') {
      return {
        surface: 'var(--ui-success-normal-surface)',
        border: 'var(--ui-success-normal-border)',
        text: 'var(--ui-success-normal-text)'
      }
    }

    if (status === 'Pinned') {
      return {
        surface: 'var(--ui-accent-normal-surface)',
        border: 'var(--ui-accent-normal-border)',
        text: 'var(--ui-accent-normal-text)'
      }
    }

    if (status === 'Review') {
      return {
        surface: 'var(--ui-info-normal-surface)',
        border: 'var(--ui-info-normal-border)',
        text: 'var(--ui-hoverable-text)'
      }
    }

    return {
      surface: 'var(--ui-warning-normal-surface)',
      border: 'var(--ui-warning-normal-border)',
      text: 'var(--ui-secondary-text)'
    }
  }

  const getLineCount = (text: string) => text.split('\n').length

  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

  const measureEditorWidth = (node: HTMLElement, promptId: string) => {
    const updateWidth = () => {
      editorWidths = {
        ...editorWidths,
        [promptId]: Math.max(320, Math.floor(node.clientWidth))
      }
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(node)

    return {
      update(nextPromptId: string) {
        promptId = nextPromptId
        updateWidth()
      },
      destroy() {
        resizeObserver.disconnect()
      }
    }
  }

  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 960
  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 116
</script>

<div
  style="box-sizing: border-box; width: 100%; min-height: 100%; padding: 6px 0 32px; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; z-index: 80; pointer-events: none;"
  ></div>

  <div style="display: grid; width: 100%; min-width: 0; gap: 10px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const statusStyles = getStatusStyles(prompt.status)}
      {@const isActive = activePromptId === prompt.id}
      <section
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        style={`box-sizing: border-box; display: grid; width: 100%; min-width: 0; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; padding: 8px; border: 1px solid ${isActive ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 14px 32px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);`}
      >
        <aside
          style="display: grid; min-width: 0; grid-template-rows: 34px 1fr 34px 34px 34px; gap: 6px;"
        >
          <div
            style={`display: grid; place-items: center; border: 1px solid ${statusStyles.border}; border-radius: 7px; background: ${statusStyles.surface}; color: ${statusStyles.text}; font-size: 12px; font-weight: 850; line-height: 1;`}
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          <button
            type="button"
            aria-label="Drag prompt"
            style="display: grid; min-height: 0; place-items: center; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-card-nested-surface); color: var(--ui-muted-text); cursor: grab; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            <GripVertical size={18} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            disabled={index === 0}
            style={`display: grid; place-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.44' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            disabled={index === prompts.length - 1}
            style={`display: grid; place-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.44' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ArrowDown size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Open prompt"
            onclick={() => {
              activePromptId = prompt.id
            }}
            style={`display: grid; place-items: center; border: 1px solid ${isActive ? 'var(--ui-info-normal-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: 7px; background: ${isActive ? 'var(--ui-info-normal-surface)' : 'var(--ui-neutral-muted-surface)'}; color: ${isActive ? 'var(--ui-hoverable-text)' : 'var(--ui-secondary-text)'}; cursor: pointer;`}
          >
            <ExternalLink size={16} strokeWidth={2.4} />
          </button>
        </aside>

        <div
          style="display: grid; min-width: 0; grid-template-rows: auto minmax(0, 1fr); gap: 8px;"
        >
          <header
            style={`display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: ${editorBackground}; box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);`}
          >
            <div
              style="display: grid; min-width: 0; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 10px;"
            >
              <div
                style={`display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid ${statusStyles.border}; border-radius: 7px; background: ${statusStyles.surface}; color: ${statusStyles.text};`}
              >
                {#if prompt.status === 'Pinned'}
                  <Star size={15} strokeWidth={2.35} />
                {:else}
                  <FileText size={15} strokeWidth={2.35} />
                {/if}
              </div>

              <div style="display: grid; min-width: 0; gap: 4px;">
                <input
                  aria-label="Prompt title"
                  value={prompt.title}
                  oninput={(event) => {
                    updatePromptTitle(prompt.id, (event.currentTarget as HTMLInputElement).value)
                  }}
                  style="box-sizing: border-box; width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ui-normal-text); font: inherit; font-size: 15px; font-weight: 850; line-height: 20px; padding: 0;"
                />

                <div
                  style="display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px;"
                >
                  <span
                    style={`display: inline-flex; height: 19px; align-items: center; border: 1px solid ${statusStyles.border}; border-radius: 999px; background: ${statusStyles.surface}; color: ${statusStyles.text}; padding: 0 8px; font-size: 11px; font-weight: 850; line-height: 16px;`}
                  >
                    {prompt.status}
                  </span>
                  <span
                    style="max-width: 180px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text);"
                    title={prompt.folder}
                  >
                    {prompt.folder}
                  </span>
                  <span>{getLineCount(prompt.text)} lines</span>
                  <span>{getTokenEstimate(prompt.text)} tokens</span>
                  <span>{prompt.updated}</span>
                </div>
              </div>
            </div>

            <div
              style="display: grid; grid-template-columns: auto 36px 36px; gap: 6px; align-items: center; padding: 6px; border-left: 1px solid var(--ui-card-nested-border);"
            >
              <button
                type="button"
                onclick={() => {
                  activePromptId = prompt.id
                }}
                style={`display: inline-flex; height: 36px; align-items: center; gap: 7px; border: 1px solid ${isActive ? 'var(--ui-info-normal-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: 7px; background: ${isActive ? 'var(--ui-info-normal-surface)' : 'var(--ui-neutral-muted-surface)'}; color: ${isActive ? 'var(--ui-hoverable-text)' : 'var(--ui-secondary-text)'}; padding: 0 10px; font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;`}
              >
                <ExternalLink size={15} strokeWidth={2.4} />
                Open
              </button>

              <button
                type="button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 7px; background: ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-surface)' : 'var(--ui-accent-normal-surface)'}; color: ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-text)' : 'var(--ui-accent-normal-text)'}; cursor: pointer;`}
              >
                {#if copiedPromptId === prompt.id}
                  <Check size={15} strokeWidth={2.4} />
                {:else}
                  <Copy size={15} strokeWidth={2.4} />
                {/if}
              </button>

              <button
                type="button"
                aria-label="More actions"
                style="display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <MoreHorizontal size={16} strokeWidth={2.4} />
              </button>
            </div>
          </header>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0; overflow: hidden; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
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
                  updatePromptText(prompt.id, text)
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
