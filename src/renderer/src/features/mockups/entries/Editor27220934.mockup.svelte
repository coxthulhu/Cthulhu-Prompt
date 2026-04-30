<script lang="ts">
  import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    GripVertical,
    Trash2
  } from 'lucide-svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'

  export const mockupMeta = {
    id: 'editor-27220934',
    title: 'Prompt Editors',
    kicker: 'Prompt Editors',
    description: 'Prompt Editors',
    order: 27220934
  }

  type PromptEditor = {
    id: string
    title: string
    folder: string
    status: string
    updated: string
    text: string
  }

  let prompts = $state<PromptEditor[]>([
    {
      id: 'review-current-diff',
      title: 'Review Current Diff',
      folder: 'Prompts',
      status: 'Ready',
      updated: '2 min ago',
      text: `Review the current diff for correctness, maintainability, and hidden risk.

Start with the highest-impact findings. Include file paths, line references, and concrete fixes where possible.`
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      folder: 'Prompts',
      status: 'Draft',
      updated: '15 min ago',
      text: `Turn this request into a focused implementation pass.

Preserve existing patterns, keep the change scoped, and list any assumptions that affect the result.`
    },
    {
      id: 'test-selection',
      title: 'Test Selection',
      folder: 'Prompts',
      status: 'Ready',
      updated: '1 hr ago',
      text: `Choose the smallest meaningful verification set for this change.

Prefer behavior-level tests and include any Playwright flow needed for user-visible regressions.`
    },
    {
      id: 'pull-request-notes',
      title: 'Pull Request Notes',
      folder: 'Prompts',
      status: 'Pinned',
      updated: 'Yesterday',
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
  const getTokenEstimate = (text: string) => Math.max(1, Math.round(text.length / 4))

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

  const getEditorHeight = (promptId: string) => editorHeights[promptId] ?? 88
  const getEditorWidth = (promptId: string) => editorWidths[promptId] ?? 820
</script>

<div
  style="min-height: 100%; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif; padding: 18px 0 34px;"
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
        style={`display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; border: 1px solid ${draggedPromptId === prompt.id ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius: 8px; background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 16px 34px var(--ui-card-normal-shadow); padding: 10px; backdrop-filter: blur(18px);`}
      >
        <div style="display: grid; grid-template-rows: 32px 1fr 32px; gap: 6px; min-height: 136px;">
          <IconOnlyButton
            icon={ChevronUp}
            label="Move prompt up"
            appearance="muted-border"
            size="rail"
            onclick={() => movePrompt(prompt.id, -1)}
            disabled={index === 0}
          />

          <IconOnlyButton
            icon={GripVertical}
            label="Drag prompt"
            appearance="muted-border"
            size="rail-fill"
            draggable={true}
            testId="prompt-drag-handle"
            ondragstart={() => {
              draggedPromptId = prompt.id
            }}
            ondragend={() => {
              draggedPromptId = null
            }}
          />

          <IconOnlyButton
            icon={ChevronDown}
            label="Move prompt down"
            appearance="muted-border"
            size="rail"
            onclick={() => movePrompt(prompt.id, 1)}
            disabled={index === prompts.length - 1}
          />
        </div>

        <div
          style="min-width: 0; align-self: start; display: grid; grid-template-rows: auto auto; align-content: start; gap: 8px;"
        >
          <div
            style="min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--ui-card-nested-border); border-radius: 7px; background: var(--ui-neutral-muted-surface); box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding: 8px 8px 8px 10px;"
          >
            <div
              style="min-width: 0; display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 10px;"
            >
              <div
                style="width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 7px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-normal-text);"
              >
                <FileText size={17} strokeWidth={2.3} />
              </div>

              <div style="min-width: 0; display: grid; gap: 4px;">
                <input
                  data-testid="prompt-title"
                  value={prompt.title}
                  placeholder={`Prompt ${index + 1}`}
                  oninput={(event) => updateTitle(prompt.id, event.currentTarget.value)}
                  style="width: 100%; min-width: 0; height: 22px; border: 0; background: transparent; color: var(--ui-normal-text); outline: none; padding: 0; font-family: inherit; font-size: 15px; font-weight: 850; line-height: 20px;"
                />

                <div
                  style="min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--ui-muted-text); font-size: 11px; font-weight: 750; line-height: 16px;"
                >
                  <span
                    style="max-width: 220px; min-width: 0; display: inline-flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-secondary-text);"
                    title={prompt.folder}
                  >
                    <Folder size={12} strokeWidth={2.4} />
                    {prompt.folder}
                  </span>
                  <span>{lineCount} lines</span>
                  <span>{tokenEstimate} tokens</span>
                  <span>{prompt.updated}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <IconOnlyButton
                icon={copiedPromptId === prompt.id ? Check : Copy}
                label="Copy prompt"
                title={copiedPromptId === prompt.id ? 'Copied' : 'Copy prompt'}
                tone="accent"
                testId="prompt-copy-button"
                onclick={() => copyPrompt(prompt)}
              />

              <IconOnlyButton
                icon={Trash2}
                label="Delete prompt"
                tone="danger"
                onclick={() => {
                  prompts = prompts.filter((item) => item.id !== prompt.id)
                }}
              />
            </div>
          </div>

          <div
            use:measureEditorWidth={prompt.id}
            style="min-width: 0;"
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
