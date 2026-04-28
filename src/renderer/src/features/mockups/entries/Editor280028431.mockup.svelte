<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Check,
    Copy,
    ExternalLink,
    FileText,
    Hash,
    MoreHorizontal,
    PanelRightOpen
  } from 'lucide-svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-280028431',
    title: 'Editor 280028431',
    kicker: 'Mockup',
    description: 'Prompt editor cards',
    order: 280028431
  }

  type PromptState = 'Ready' | 'Draft' | 'Pinned' | 'Review'

  type PromptEditor = {
    id: string
    title: string
    subtitle: string
    state: PromptState
    updated: string
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'review-current-diff',
      title: 'Review Current Diff',
      subtitle: 'Code Review',
      state: 'Ready',
      updated: '2 min ago',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with the highest-impact findings. Include file paths, line references, and concrete fixes where possible.`
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      subtitle: 'Planning',
      state: 'Draft',
      updated: '15 min ago',
      text: `Turn this request into a focused implementation pass.

Preserve existing patterns, keep the change scoped, and list any assumptions that affect the result.`
    },
    {
      id: 'test-selection',
      title: 'Test Selection',
      subtitle: 'Testing',
      state: 'Review',
      updated: '1 hr ago',
      text: `Choose the smallest meaningful verification set for this change.

Prefer behavior-level tests and include any Playwright flow needed for user-visible regressions.`
    },
    {
      id: 'pull-request-notes',
      title: 'Pull Request Notes',
      subtitle: 'Release',
      state: 'Pinned',
      updated: 'Yesterday',
      text: `Write concise pull request notes.

Start with user-visible behavior, then include implementation details and the exact verification commands that were run.`
    }
  ])

  let copiedPromptId = $state<string | null>(null)
  let selectedPromptId = $state('review-current-diff')
  let overflowHost = $state<HTMLDivElement | null>(null)
  let editorWidths = $state<Record<string, number>>({})
  let editorHeights = $state<Record<string, number>>({})
  let copyResetTimer: number | null = null

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
    }, 1400)
  }

  const getLineCount = (text: string) => text.split('\n').length
  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

  const getStateStyles = (state: PromptState) => {
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

    if (state === 'Review') {
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

  const measureEditorWidth = (node: HTMLElement, promptId: string) => {
    const updateWidth = () => {
      editorWidths = {
        ...editorWidths,
        [promptId]: Math.max(340, Math.floor(node.clientWidth))
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

  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 1080
  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 132
</script>

<div
  style="width: 100%; min-height: 100%; box-sizing: border-box; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 8px 0 32px;"
>
  <div
    bind:this={overflowHost}
    style="position: fixed; inset: 0; pointer-events: none; z-index: 80;"
  ></div>

  <div style="width: 100%; min-width: 0; display: grid; gap: 9px;">
    {#each prompts as prompt, index (prompt.id)}
      {@const stateStyles = getStateStyles(prompt.state)}
      {@const isSelected = selectedPromptId === prompt.id}
      {@const lineCount = getLineCount(prompt.text)}
      {@const tokenEstimate = getTokenEstimate(prompt.text)}
      <section
        aria-label={prompt.title}
        data-testid={`mockup-prompt-editor-${prompt.id}`}
        style={`width: 100%; min-width: 0; box-sizing: border-box; display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 8px; border: 1px solid ${isSelected ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; padding: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 14px 30px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-inset-highlight);`}
      >
        <aside
          style="min-width: 0; display: grid; grid-template-rows: 36px 1fr 34px 34px 34px; gap: 6px;"
        >
          <div
            style={`display: grid; place-items: center; border: 1px solid ${stateStyles.border}; border-radius: 7px; background: ${stateStyles.surface}; color: ${stateStyles.text}; font-size: 12px; font-weight: 850; line-height: 16px;`}
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          <button
            type="button"
            aria-label="Open prompt"
            onclick={() => {
              selectedPromptId = prompt.id
            }}
            style={`display: grid; place-items: center; border: 1px solid ${isSelected ? 'var(--ui-accent-normal-border)' : 'var(--ui-card-nested-border)'}; border-radius: 7px; background: ${isSelected ? 'var(--ui-accent-icon-surface)' : 'var(--ui-neutral-muted-surface)'}; color: ${isSelected ? 'var(--ui-accent-icon-glyph)' : 'var(--ui-secondary-text)'}; cursor: pointer;`}
          >
            <PanelRightOpen size={17} strokeWidth={2.3} />
          </button>

          <button
            type="button"
            aria-label="Move prompt up"
            disabled={index === 0}
            style={`display: grid; place-items: center; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: ${index === 0 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === 0 ? '0.45' : '1'}; cursor: ${index === 0 ? 'default' : 'pointer'};`}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="Move prompt down"
            disabled={index === prompts.length - 1}
            style={`display: grid; place-items: center; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: ${index === prompts.length - 1 ? 'var(--ui-muted-text)' : 'var(--ui-secondary-text)'}; opacity: ${index === prompts.length - 1 ? '0.45' : '1'}; cursor: ${index === prompts.length - 1 ? 'default' : 'pointer'};`}
          >
            <ArrowDown size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            aria-label="More actions"
            style="display: grid; place-items: center; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); cursor: pointer;"
          >
            <MoreHorizontal size={16} strokeWidth={2.3} />
          </button>
        </aside>

        <div style="min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px;">
          <header
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 8px;"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 8px 10px;"
            >
              <div
                style={`height: 38px; width: 38px; display: grid; place-items: center; border: 1px solid ${stateStyles.border}; border-radius: 7px; background: ${stateStyles.surface}; color: ${stateStyles.text};`}
              >
                <FileText size={17} strokeWidth={2.3} />
              </div>

              <div style="min-width: 0; display: grid; gap: 4px;">
                <div
                  style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 15px; font-weight: 850; line-height: 20px;"
                >
                  {prompt.title}
                </div>

                <div
                  style="min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px;"
                >
                  <span
                    style="display: inline-flex; align-items: center; gap: 5px; color: var(--ui-secondary-text);"
                  >
                    <Hash size={12} strokeWidth={2.4} />
                    {prompt.subtitle}
                  </span>
                  <span
                    style={`height: 19px; display: inline-flex; align-items: center; border: 1px solid ${stateStyles.border}; border-radius: 999px; background: ${stateStyles.surface}; color: ${stateStyles.text}; padding: 0 8px; font-size: 11px; font-weight: 800; line-height: 16px;`}
                  >
                    {prompt.state}
                  </span>
                  <span>{lineCount} lines</span>
                  <span>{tokenEstimate} tokens</span>
                  <span>{prompt.updated}</span>
                </div>
              </div>
            </div>

            <div
              style="display: grid; grid-template-columns: 42px 42px; gap: 6px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-card-nested-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 6px;"
            >
              <button
                type="button"
                aria-label="Open prompt"
                onclick={() => {
                  selectedPromptId = prompt.id
                }}
                style="display: grid; place-items: center; border: 1px solid var(--ui-info-normal-border); border-radius: 6px; background: var(--ui-info-normal-surface); color: var(--ui-hoverable-text); cursor: pointer;"
              >
                <ExternalLink size={16} strokeWidth={2.3} />
              </button>

              <button
                type="button"
                aria-label="Copy prompt"
                onclick={() => copyPrompt(prompt)}
                style={`display: grid; place-items: center; border: 1px solid ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 6px; background: ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-surface)' : 'var(--ui-accent-normal-surface)'}; color: ${copiedPromptId === prompt.id ? 'var(--ui-success-normal-text)' : 'var(--ui-accent-normal-text)'}; cursor: pointer;`}
              >
                {#if copiedPromptId === prompt.id}
                  <Check size={16} strokeWidth={2.4} />
                {:else}
                  <Copy size={16} strokeWidth={2.3} />
                {/if}
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
