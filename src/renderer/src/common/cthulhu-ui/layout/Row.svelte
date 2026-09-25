<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'

  export type RowTrailingLayout = 'single' | 'grouped'

  type Props = {
    variant?: 'default' | 'dialog-heading' | 'workspace'
    icon?: ComponentType
    label: string
    detail?: string
    wrapDetail?: boolean
    detailExtra?: Snippet
    trailing?: Snippet
    trailingLayout?: RowTrailingLayout
    class?: string
    iconClass?: string
    iconTestId?: string
    detailTestId?: string
    detailTitle?: string
    labelTitle?: string
    labelTestId?: string
    testId?: string
  }

  let {
    variant = 'default',
    icon: Icon,
    label,
    detail,
    wrapDetail = false,
    detailExtra,
    trailing,
    trailingLayout = 'single',
    class: className,
    iconClass,
    iconTestId,
    detailTestId,
    detailTitle,
    labelTitle,
    labelTestId,
    testId
  }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiRow', className)}
  data-variant={variant}
  data-trailing={trailing ? 'true' : 'false'}
  data-trailing-layout={trailingLayout}
  data-testid={testId}
>
  {#if Icon}
    <IconCell
      icon={Icon}
      {iconClass}
      variant={variant === 'workspace' ? 'large' : variant === 'dialog-heading' ? 'title' : 'standard'}
      data-testid={iconTestId}
    />
  {/if}

  <TitleSubtitleStack>
    <Title
      title={label}
      variant={variant === 'workspace' ? 'workspace' : variant === 'dialog-heading' ? 'dialog' : 'row'}
      tooltip={labelTitle}
      data-testid={labelTestId}
    />
    {#if detail}
      <Subtitle text={detail} wrap={wrapDetail} title={detailTitle} data-testid={detailTestId} />
    {/if}
    {#if detailExtra}
      <span class="cthulhuUiRowDetailExtra text-sm">
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
    row-gap: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiRow[data-variant='dialog-heading'] .cthulhuUiRowTrailing {
    align-self: flex-start;
  }

  .cthulhuUiRowDetailExtra {
    color: var(--ui-secondary-text);
    display: block;
    font-weight: var(--font-weight-normal);
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
