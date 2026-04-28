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
    Sparkles
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-280059112',
    title: 'Prompt Editors',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 280059112
  }

  type PromptEditor = {
    id: string
    title: string
    label: string
    state: 'Ready' | 'Draft' | 'Pinned' | 'Saved'
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'current-diff-review',
      title: 'Current Diff Review',
      label: 'Code Review',
      state: 'Ready',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with findings ordered by severity. Include file paths and concrete fixes.`
    },
    {
      id: 'implementation-plan',
      title: 'Implementation Plan',
      label: 'Planning',
      state: 'Draft',
      text: `Turn this request into a scoped implementation plan.

Call out assumptions, affected files, likely tests, and any risky edge cases before changing code.`
    },
    {
      id: 'focused-test-pass',
      title: 'Focused Test Pass',
      label: 'Testing',
      state: 'Saved',
      text: `Choose the smallest meaningful verification set.

Prefer fast tests first, then add a Playwright path only when user-visible behavior changed.`
    },
    {
      id: 'pull-request-notes',
      title: 'Pull Request Notes',
      label: 'Release',
      state: 'Pinned',
      text: `Write concise pull request notes.

Summarize the behavior change, implementation details, and exact verification commands.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let openedPromptId = $state<string | null>(null)
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

  const copyPrompt = (prompt: PromptEditor) => {
    void window.navigator.clipboard.writeText(prompt.text)
    copiedPromptId = prompt.id

    if (copyResetTimer != null) {
      window.clearTimeout(copyResetTimer)
    }

    copyResetTimer = window.setTimeout(() => {
      copiedPromptId = null
      copyResetTimer = null
    }, 1400)
  }

  const openPrompt = (promptId: string) => {
    openedPromptId = promptId

    if (openResetTimer != null) {
      window.clearTimeout(openResetTimer)
    }

    openResetTimer = window.setTimeout(() => {
      openedPromptId = null
      openResetTimer = null
    }, 1400)
  }

  const getLineCount = (text: string) => text.split('\n').length
  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

  const getStateStyles = (state: PromptEditor['state']) => {
    if (state === 'Ready') {
      return {
        surface: 'var(--ui-success-normal-surface)',
        border: 'var(--ui-success-normal-border)',
        text: 'var(--ui-success-normal-text)'
      }
    }

    if (state === 'Pinned') {
      return {
        surface: 'var(--ui-accent-normal-surface)',
        border: 'var(--ui-accent-normal-border)',
        text: 'var(--ui-accent-normal-text)'
      }
    }

    if (state === 'Draft') {
      return {
        surface: 'var(--ui-warning-normal-surface)',
        border: 'var(--ui-warning-normal-border)',
        text: 'var(--ui-secondary-text)'
      }
    }

    return {
      surface: 'var(--ui-info-normal-surface)',
      border: 'var(--ui-info-normal-border)',
      text: 'var(--ui-secondary-text)'
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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 128
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 1024
</script>

<div
  style="width: 100%; min-height: 100%; box-sizing: border-box; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 4px 0 32px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="width: 100%; min-width: 0; display: grid; gap: 12px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const stateStyles = getStateStyles(prompt.state)}
      {@const lineCount = getLineCount(prompt.text)}
      {@const tokenEstimate = getTokenEstimate(prompt.text)}

      <section
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        style="width: 100%; min-width: 0; box-sizing: border-box; display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 8px;"
      >
        <aside
          style="min-width: 0; display: grid; grid-template-rows: 38px 1fr 34px 34px; overflow: hidden; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 12px 26px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
        >
          <div
            style={`display: grid; place-items: center; border-bottom: 1px solid var(--ui-card-nested-border); background: ${stateStyles.surface}; color: ${stateStyles.text}; font-size: 12px; font-weight: 850; line-height: 16px;`}
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          <button
            type="button"
            aria-label="Drag prompt"
            style="display: inline-flex; align-items: center; justify-content: center; border: 0; border-bottom: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface); color: var(--ui-muted-text); cursor: grab;"
          >
            <GripVertical size={18} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            disabled={index === 0}
            style={`display: inline-flex; align-items: center; justify-content: center; border: 0; border-bottom: 1px solid var(--ui-card-nested-border); background: ${index === 0 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.42' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            disabled={index === prompts.length - 1}
            style={`display: inline-flex; align-items: center; justify-content: center; border: 0; background: ${index === prompts.length - 1 ? 'var(--ui-neutral-muted-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.42' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ArrowDown size={16} strokeWidth={2.4} />
          </button>
        </aside>

        <div style="min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px;">
          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; overflow: hidden; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 12px 26px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 11px;"
            >
              <div
                style={`width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid ${stateStyles.border}; border-radius: 8px; background: ${stateStyles.surface}; color: ${stateStyles.text}; box-sizing: border-box;`}
              >
                {#if prompt.state === 'Pinned'}
                  <Sparkles size={15} strokeWidth={2.3} />
                {:else}
                  <FileText size={15} strokeWidth={2.3} />
                {/if}
              </div>

              <div style="min-width: 0; display: grid; gap: 4px;">
                <input
                  aria-label="Prompt title"
                  value={prompt.title}
                  oninput={(event) =>
                    updateTitle(prompt.id, (event.currentTarget as HTMLInputElement).value)}
                  style="width: 100%; min-width: 0; height: 22px; box-sizing: border-box; border: 0; background: transparent; color: var(--ui-normal-text); outline: none; padding: 0; font: inherit; font-size: 15px; font-weight: 800; line-height: 22px;"
                />

                <div
                  style="min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px;"
                >
                  <span
                    style="max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text); font-size: 11px; font-weight: 750; line-height: 16px;"
                    title={prompt.label}
                  >
                    {prompt.label}
                  </span>
                  <span
                    style={`height: 19px; display: inline-flex; align-items: center; border: 1px solid ${stateStyles.border}; border-radius: 999px; background: ${stateStyles.surface}; color: ${stateStyles.text}; padding: 0 8px; font-size: 11px; font-weight: 800; line-height: 16px; box-sizing: border-box;`}
                  >
                    {prompt.state}
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

              <button
                type="button"
                aria-label="More actions"
                style="width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: 8px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
              >
                <MoreHorizontal size={16} strokeWidth={2.3} />
              </button>
            </div>

            <div
              style="display: flex; align-items: stretch; border-left: 1px solid var(--ui-card-nested-border); background: var(--ui-neutral-muted-surface);"
            >
              <button
                type="button"
                aria-label="Open prompt"
                onclick={() => openPrompt(prompt.id)}
                style={`min-width: ${openedPromptId === prompt.id ? '96px' : '46px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-right: 1px solid var(--ui-card-nested-border); background: var(--ui-info-normal-surface); color: var(--ui-hoverable-text); padding: 0 12px; font-size: 12px; font-weight: 800; cursor: pointer;`}
              >
                <ExternalLink size={16} strokeWidth={2.3} />
                {#if openedPromptId === prompt.id}
                  <span>Open</span>
                {/if}
              </button>

              <button
                type="button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`min-width: ${copiedPromptId === prompt.id ? '98px' : '46px'}; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text); padding: 0 12px; font-size: 12px; font-weight: 800; cursor: pointer;`}
              >
                {#if copiedPromptId === prompt.id}
                  <Check size={15} strokeWidth={2.4} />
                  <span>Copied</span>
                {:else}
                  <Copy size={16} strokeWidth={2.3} />
                {/if}
              </button>
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0; overflow: hidden; border: 1px solid var(--ui-card-normal-border); border-radius: 8px; background: var(--ui-card-nested-surface); box-shadow: 0 12px 26px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
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
                findSectionKey={`mockup-${prompt.id}`}
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
