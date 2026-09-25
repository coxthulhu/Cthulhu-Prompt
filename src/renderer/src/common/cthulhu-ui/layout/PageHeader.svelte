<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
    icon: ComponentType
    title: string
    subtitle: string
    titleTooltip?: string
    titleTestId?: string
    subtitleTestId?: string
    titleAction?: Snippet
  }

  let {
    icon,
    title,
    subtitle,
    titleTooltip,
    titleTestId,
    subtitleTestId,
    titleAction,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiPageHeader', className)} {...restProps}>
  <IconCell {icon} variant="large" />
  <TitleSubtitleStack class="cthulhuUiPageHeaderStack">
    <div class="cthulhuUiPageHeaderTitleLine" data-has-action={!!titleAction}>
      <Title
        {title}
        variant="page"
        tooltip={titleTooltip}
        data-testid={titleTestId}
      />
      {#if titleAction}
        {@render titleAction()}
      {/if}
    </div>
    <Subtitle text={subtitle} wrap={false} class="leading-5" data-testid={subtitleTestId} />
  </TitleSubtitleStack>
</div>

<style>
  .cthulhuUiPageHeader {
    align-items: center;
    display: flex;
    gap: 12px;
    height: 60px;
    min-width: 0;
  }

  .cthulhuUiPageHeader :global(.cthulhuUiPageHeaderStack) {
    gap: 4px;
  }

  .cthulhuUiPageHeaderTitleLine {
    height: 36px;
    min-width: 0;
  }

  .cthulhuUiPageHeaderTitleLine[data-has-action='true'] {
    align-items: baseline;
    display: flex;
    gap: 11px;
  }
</style>
