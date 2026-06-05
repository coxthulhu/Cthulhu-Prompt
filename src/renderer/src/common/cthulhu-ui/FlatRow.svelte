<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  export type FlatRowTrailingLayout = 'single' | 'grouped'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
    trailing?: Snippet
    trailingLayout?: FlatRowTrailingLayout
    class?: string
    iconClass?: string
    labelTitle?: string
    labelTestId?: string
    testId?: string
  }

  let {
    icon: Icon,
    label,
    detail,
    trailing,
    trailingLayout = 'single',
    class: className,
    iconClass,
    labelTitle,
    labelTestId,
    testId
  }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiFlatRow', className)}
  data-trailing={trailing ? 'true' : 'false'}
  data-trailing-layout={trailingLayout}
  data-testid={testId}
>
  <span class="cthulhuUiFlatRowIconCell">
    <Icon class={mergeClasses('cthulhuUiFlatRowIcon', iconClass)} size={24} aria-hidden="true" />
  </span>

  <span class="cthulhuUiFlatRowTextStack">
    <span class="cthulhuUiFlatRowText" title={labelTitle} data-testid={labelTestId}>{label}</span>
    <span class="cthulhuUiFlatRowDetail">{detail}</span>
  </span>

  {#if trailing}
    <span class="cthulhuUiFlatRowTrailing">
      {@render trailing()}
    </span>
  {/if}
</div>

<style>
  .cthulhuUiFlatRow {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    display: grid;
    gap: 12px;
    grid-template-columns: 34px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiFlatRow[data-trailing='true'] {
    grid-template-columns: 34px minmax(0, 1fr) minmax(0, auto);
  }

  .cthulhuUiFlatRowIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuUiFlatRowIcon {
    stroke-width: 2;
  }

  .cthulhuUiFlatRowTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiFlatRowText,
  .cthulhuUiFlatRowDetail {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .cthulhuUiFlatRowText {
    color: inherit;
    display: block;
    font-size: var(--cthulhu-ui-font-size-flat-primary);
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .cthulhuUiFlatRowDetail {
    color: var(--ui-muted-text);
    display: block;
    font-size: 13px;
    text-overflow: ellipsis;
  }

  .cthulhuUiFlatRowTrailing {
    align-items: center;
    display: flex;
    justify-content: flex-end;
    min-width: 0;
  }

  .cthulhuUiFlatRow[data-trailing-layout='grouped'] .cthulhuUiFlatRowTrailing {
    gap: 8px;
  }

  @media (max-width: 720px) {
    .cthulhuUiFlatRow[data-trailing='true'][data-trailing-layout='grouped'] {
      grid-template-columns: 34px minmax(0, 1fr);
    }

    .cthulhuUiFlatRow[data-trailing-layout='grouped'] .cthulhuUiFlatRowTrailing {
      grid-column: 2;
      justify-content: flex-start;
    }
  }
</style>
