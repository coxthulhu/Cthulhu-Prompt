<script lang="ts">
  import { tick, type ComponentProps } from 'svelte'
  import type { Action } from 'svelte/action'
  import type { monaco } from '@renderer/common/Monaco'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import HydratableMonacoEditor from './HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import {
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX
  } from './promptEditorSizing'

  /** Shared padded surface and background-click focus for prompt, template, and note editors. */
  type Props = Omit<ComponentProps<typeof HydratableMonacoEditor>, 'overflowWidgetsDomNode'> & {
    overflowWidgetsDomNode: HTMLElement | null
    testId?: string
  }

  let {
    class: className,
    testId,
    overflowWidgetsDomNode,
    onEditorLifecycle,
    onImmediateHydrationRequest,
    ...editorProps
  }: Props = $props()

  /** The mounted editor and hydration request always belong to this section. */
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let requestImmediateHydration = $state<(() => Promise<void>) | null>(null)

  const handleEditorLifecycle = (editor: monaco.editor.IStandaloneCodeEditor, active: boolean): void => {
    if (active) editorInstance = editor
    else if (editorInstance === editor) editorInstance = null
    onEditorLifecycle?.(editor, active)
  }

  const focusFromBackgroundClick = async (event: MouseEvent): Promise<void> => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.monaco-editor')) return
    if (!editorInstance) await requestImmediateHydration?.()
    // Side effect: wait for click-triggered hydration to register Monaco before focusing it.
    await tick()
    editorInstance?.focus()
  }

  /** The surface delegates focus to Monaco without adding a separate keyboard tab stop. */
  const focusOnBackgroundClick: Action<HTMLDivElement> = (node) => {
    const handleClick = (event: MouseEvent): void => { void focusFromBackgroundClick(event) }
    node.addEventListener('click', handleClick)
    return { destroy: () => node.removeEventListener('click', handleClick) }
  }
</script>

<div
  class={mergeClasses('monaco-editor-section', className)}
  data-testid={testId}
  style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
  use:focusOnBackgroundClick
>
  {#if overflowWidgetsDomNode}
    <HydratableMonacoEditor
      {...editorProps}
      class="bg-[var(--ui-editor-content-surface)]"
      {overflowWidgetsDomNode}
      onEditorLifecycle={handleEditorLifecycle}
      onImmediateHydrationRequest={(request) => {
        requestImmediateHydration = request
        onImmediateHydrationRequest?.(request)
      }}
    />
  {:else}
    <MonacoEditorPlaceholder
      class="bg-[var(--ui-editor-content-surface)]"
      heightPx={editorProps.placeholderHeightPx}
      sizingConfig={editorProps.sizingConfig}
    />
  {/if}
</div>

<style>
  .monaco-editor-section {
    background: var(--ui-editor-content-surface);
    min-width: 0;
  }
</style>
