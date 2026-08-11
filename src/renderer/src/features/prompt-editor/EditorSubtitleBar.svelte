<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { EDITOR_SUBTITLE_BAR_HEIGHT_PX } from './promptEditorSizing'

  type Props = {
    icon: ComponentType
    title: string
    configuredCount: number
    totalCount: number
    actionsLabel: string
    actions: Snippet
    testId?: string
  }

  let {
    icon: Icon,
    title,
    configuredCount,
    totalCount,
    actionsLabel,
    actions,
    testId
  }: Props = $props()
</script>

<div
  class="editor-subtitle-bar"
  style={`height:${EDITOR_SUBTITLE_BAR_HEIGHT_PX}px; min-height:${EDITOR_SUBTITLE_BAR_HEIGHT_PX}px; max-height:${EDITOR_SUBTITLE_BAR_HEIGHT_PX}px;`}
  data-testid={testId}
>
  <div class="editor-subtitle-bar-heading">
    <Icon size={20} aria-hidden="true" />
    <div class="editor-subtitle-bar-heading-copy">
      <span>{title}</span>
      <span class="editor-subtitle-bar-metadata">
        {configuredCount} of {totalCount} configured
      </span>
    </div>
  </div>

  <div class="editor-subtitle-bar-actions" role="group" aria-label={actionsLabel}>
    {@render actions()}
  </div>
</div>

<style>
  .editor-subtitle-bar {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    gap: 24px;
    justify-content: space-between;
    min-width: 0;
    padding: 10px 12px 10px 10px;
  }

  .editor-subtitle-bar-heading {
    align-items: center;
    color: var(--ui-normal-text);
    display: grid;
    font-size: 14px;
    font-weight: 700;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
  }

  .editor-subtitle-bar-heading :global(svg) {
    color: var(--ui-secondary-icon-glyph);
    justify-self: center;
  }

  .editor-subtitle-bar-heading-copy {
    display: grid;
    line-height: 16px;
    min-width: 0;
    row-gap: 2px;
  }

  .editor-subtitle-bar-metadata {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 400;
  }

  .editor-subtitle-bar-actions {
    align-items: center;
    display: flex;
    flex: 0 1 auto;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
  }
</style>
