<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import FlatIconCell from './FlatIconCell.svelte'

  export type FlatRowTrailingLayout = 'single' | 'grouped'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
    detailExtra?: Snippet
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
    detailExtra,
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
  <FlatIconCell icon={Icon} iconClass={iconClass} />

  <span class="cthulhuUiFlatRowTextStack">
    <span class="cthulhuUiFlatRowText" title={labelTitle} data-testid={labelTestId}>{label}</span>
    <span class="cthulhuUiFlatRowDetail">{detail}</span>
    {#if detailExtra}
      <span class="cthulhuUiFlatRowDetailExtra">
        {@render detailExtra()}
      </span>
    {/if}
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
    color: var(--ui-flat-normal-text);
    column-gap: 12px;
    display: flex;
    min-width: 0;
    padding: 16px;
    row-gap: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiFlatRowTextStack {
    display: flex;
    flex: 1 1 auto;
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

  .cthulhuUiFlatRowDetail,
  .cthulhuUiFlatRowDetailExtra {
    color: var(--ui-flat-muted-text);
    display: block;
    font-size: 13px;
  }

  .cthulhuUiFlatRowDetail {
    text-overflow: ellipsis;
  }

  .cthulhuUiFlatRowDetailExtra {
    color: var(--ui-flat-secondary-text);
    line-height: 18px;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .cthulhuUiFlatRowTrailing {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    justify-content: flex-end;
    min-width: 0;
  }

  .cthulhuUiFlatRow[data-trailing-layout='grouped'] .cthulhuUiFlatRowTrailing {
    gap: 8px;
  }

  @media (max-width: 720px) {
    .cthulhuUiFlatRow[data-trailing='true'][data-trailing-layout='grouped'] {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .cthulhuUiFlatRow[data-trailing-layout='grouped'] .cthulhuUiFlatRowTrailing {
      flex-basis: calc(100% - 46px);
      justify-content: flex-start;
      margin-left: 46px;
      max-width: calc(100% - 46px);
    }
  }
</style>
