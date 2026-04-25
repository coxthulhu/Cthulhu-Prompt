<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type AccentIconTileSize = 'default' | 'large'
  type AccentIconTileVariant = 'accent' | 'danger'

  type Props = HTMLAttributes<HTMLDivElement> & {
    icon: ComponentType
    iconClass?: string
    size?: AccentIconTileSize
    variant?: AccentIconTileVariant
  }

  let {
    icon: Icon,
    iconClass,
    size = 'default',
    variant = 'accent',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<!-- Shared rounded-square accent icon tile used by cards and metadata pills. -->
<div
  class={mergeClasses(
    'cthulhuUiAccentIconTile',
    size === 'default' ? 'cthulhuUiAccentIconTile--default rounded-2xl' : null,
    size === 'large' ? 'cthulhuUiAccentIconTile--large' : null,
    className
  )}
  data-variant={variant}
  {...restProps}
>
  <Icon
    class={mergeClasses(
      size === 'default' ? 'h-[18px] w-[18px]' : null,
      size === 'large' ? 'h-6 w-6' : null,
      iconClass
    )}
  />
</div>

<style>
  .cthulhuUiAccentIconTile {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
  }

  .cthulhuUiAccentIconTile[data-variant='accent'] {
    background-color: var(--ui-accent-icon-surface);
    box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
    color: var(--ui-accent-icon-glyph);
  }

  .cthulhuUiAccentIconTile[data-variant='danger'] {
    background-color: var(--ui-danger-icon-surface);
    box-shadow: 0 0 0 1px var(--ui-danger-icon-ring);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiAccentIconTile--default {
    height: 3rem;
    width: 3rem;
  }

  .cthulhuUiAccentIconTile--large {
    border-radius: 18px;
    height: 54px;
    width: 54px;
  }
</style>
