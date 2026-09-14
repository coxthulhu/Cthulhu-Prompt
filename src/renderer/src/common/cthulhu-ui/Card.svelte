<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import CardSurface from './CardSurface.svelte'
  import IconCell from './IconCell.svelte'
  import Subtitle from './Subtitle.svelte'
  import Title from './Title.svelte'
  import TitleSubtitleStack from './TitleSubtitleStack.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    icon?: ComponentType
    subtitle?: string
    children: Snippet
    surfaceClass?: string
  }

  let {
    label,
    icon: Icon,
    subtitle,
    children,
    surfaceClass,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiCard', className)} {...restProps}>
  <div class="cthulhuUiCardLabel">
    {#if Icon}
      <IconCell icon={Icon} />
    {/if}
    <TitleSubtitleStack>
      <Title title={label} variant="card" />
      {#if subtitle}
        <Subtitle text={subtitle} />
      {/if}
    </TitleSubtitleStack>
  </div>

  <!-- Labelled card shell for action and display row groups. -->
  <CardSurface class={surfaceClass}>
    {@render children()}
  </CardSurface>
</div>

<style>
  .cthulhuUiCard {
    min-width: 0;
  }

  .cthulhuUiCardLabel {
    align-items: center;
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
</style>
