<script lang="ts">
  import type { Snippet } from 'svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import { EDITOR_CARD_SECTION_HEADER_HEIGHT_PX } from '../prompt-folders/promptFolderSettingsSizing'

  type Props = {
    title: string
    description?: string
    children: Snippet
    actions?: Snippet
    sectionElement?: HTMLElement | null
    class?: string
    testId?: string
    showTopBorder?: boolean
  }

  let {
    title,
    description,
    children,
    actions,
    sectionElement = $bindable(null),
    class: className,
    testId,
    showTopBorder = false
  }: Props = $props()
</script>

<section
  bind:this={sectionElement}
  class={mergeClasses('editor-card-section', className)}
  data-top-border={showTopBorder ? 'true' : 'false'}
  data-testid={testId}
>
  <div
    class="editor-card-section-header"
    data-testid={testId ? `editor-card-section-header-${testId}` : undefined}
    style={`height:${EDITOR_CARD_SECTION_HEADER_HEIGHT_PX}px; min-height:${EDITOR_CARD_SECTION_HEADER_HEIGHT_PX}px; max-height:${EDITOR_CARD_SECTION_HEADER_HEIGHT_PX}px;`}
  >
    <div class="editor-card-section-copy">
      <span class="editor-card-section-title">{title}</span>
      {#if description}
        <span class="editor-card-section-description">- {description}</span>
      {/if}
    </div>
    {#if actions}
      <div
        class="editor-card-section-actions"
        data-testid={testId ? `editor-card-section-actions-${testId}` : undefined}
      >
        {@render actions()}
      </div>
    {/if}
  </div>

  <Separator />

  {@render children()}
</section>

<style>
  .editor-card-section {
    box-sizing: border-box;
    display: grid;
    min-width: 0;
  }

  .editor-card-section[data-top-border='true'] {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .editor-card-section-header {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    font-weight: 700;
    gap: 5px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    padding: 0 16px;
    white-space: nowrap;
  }

  .editor-card-section-copy {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    gap: 5px;
    min-width: 0;
  }

  .editor-card-section-actions {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    margin-left: auto;
  }

  .editor-card-section-title {
    flex: 0 0 auto;
    min-width: 0;
  }

  .editor-card-section-description {
    color: var(--ui-muted-text);
    flex: 1 1 auto;
    font-weight: 400;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
