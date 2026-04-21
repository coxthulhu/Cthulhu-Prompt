<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    icon: ComponentType
    iconClass?: string
  }

  let { icon: Icon, iconClass, class: className, ...restProps }: Props = $props()
</script>

<!-- Shared rounded-square accent icon tile used by cards and metadata pills. -->
<div class={mergeClasses('cthulhuUiAccentIconTile rounded-2xl', className)} {...restProps}>
  <Icon class={mergeClasses('h-[18px] w-[18px]', iconClass)} />
</div>

<style>
  .cthulhuUiAccentIconTile {
    align-items: center;
    background-color: var(--ui-accent-icon-surface);
    box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
    color: var(--ui-accent-icon-glyph);
    display: flex;
    flex: 0 0 auto;
    height: 3rem;
    justify-content: center;
    width: 3rem;
  }
</style>
