<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
    trailing?: Snippet
    class?: string
    iconClass?: string
    testId?: string
  }

  let {
    icon: Icon,
    label,
    detail,
    trailing,
    class: className,
    iconClass,
    testId
  }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiFlatDisplayRow', className)}
  data-trailing={trailing ? 'true' : 'false'}
  data-testid={testId}
>
  <span class="cthulhuUiFlatDisplayRowIconCell">
    <Icon class={mergeClasses('cthulhuUiFlatDisplayRowIcon', iconClass)} size={24} aria-hidden="true" />
  </span>

  <span class="cthulhuUiFlatDisplayRowTextStack">
    <span class="cthulhuUiFlatDisplayRowText">{label}</span>
    <span class="cthulhuUiFlatDisplayRowDetail">{detail}</span>
  </span>

  {#if trailing}
    <span class="cthulhuUiFlatDisplayRowTrailing">
      {@render trailing()}
    </span>
  {/if}
</div>

<style>
  .cthulhuUiFlatDisplayRow {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
    display: grid;
    gap: 12px;
    grid-template-columns: 34px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiFlatDisplayRow[data-trailing='true'] {
    grid-template-columns: 34px minmax(0, 1fr) auto;
  }

  .cthulhuUiFlatDisplayRowIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuUiFlatDisplayRowIcon {
    stroke-width: 2;
  }

  .cthulhuUiFlatDisplayRowTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiFlatDisplayRowText,
  .cthulhuUiFlatDisplayRowDetail {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .cthulhuUiFlatDisplayRowText {
    color: inherit;
    display: block;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .cthulhuUiFlatDisplayRowDetail {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 13px;
    gap: 6px;
  }

  .cthulhuUiFlatDisplayRowTrailing {
    display: flex;
    justify-content: flex-end;
    min-width: 0;
  }
</style>
