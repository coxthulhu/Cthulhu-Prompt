<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import IconCell from './IconCell.svelte'
  import Subtitle from './Subtitle.svelte'
  import TitleSubtitleStack from './TitleSubtitleStack.svelte'

  export type RowTrailingLayout = 'single' | 'grouped'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
    wrapDetail?: boolean
    detailExtra?: Snippet
    trailing?: Snippet
    trailingLayout?: RowTrailingLayout
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
    wrapDetail = false,
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
  class={mergeClasses('cthulhuUiRow', className)}
  data-trailing={trailing ? 'true' : 'false'}
  data-trailing-layout={trailingLayout}
  data-testid={testId}
>
  <IconCell icon={Icon} {iconClass} />

  <TitleSubtitleStack>
    <span class="cthulhuUiRowText" title={labelTitle} data-testid={labelTestId}>{label}</span>
    <Subtitle text={detail} wrap={wrapDetail} />
    {#if detailExtra}
      <span class="cthulhuUiRowDetailExtra">
        {@render detailExtra()}
      </span>
    {/if}
  </TitleSubtitleStack>

  {#if trailing}
    <span class="cthulhuUiRowTrailing">
      {@render trailing()}
    </span>
  {/if}
</div>

<style>
  .cthulhuUiRow {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    column-gap: 12px;
    display: flex;
    min-width: 0;
    padding: 16px;
    row-gap: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiRowText {
    color: inherit;
    display: block;
    font-size: var(--cthulhu-ui-font-size-primary);
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiRowDetailExtra {
    color: var(--ui-secondary-text);
    display: block;
    font-size: 14px;
    line-height: 18px;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .cthulhuUiRowTrailing {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    justify-content: flex-end;
    min-width: 0;
  }

  .cthulhuUiRow[data-trailing-layout='grouped'] .cthulhuUiRowTrailing {
    gap: 8px;
  }

  @media (max-width: 720px) {
    .cthulhuUiRow[data-trailing='true'][data-trailing-layout='grouped'] {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .cthulhuUiRow[data-trailing-layout='grouped'] .cthulhuUiRowTrailing {
      flex-basis: calc(100% - 46px);
      justify-content: flex-start;
      margin-left: 46px;
      max-width: calc(100% - 46px);
    }
  }
</style>
