<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuSize } from './types'

  type AccentIconTileSize = Extract<CthulhuSize, 'medium' | 'large'>
  type AccentIconTileVariant = 'accent' | 'accent-white-icon' | 'danger'

  type Props = HTMLAttributes<HTMLDivElement> & {
    icon: ComponentType
    iconClass?: string
    size?: AccentIconTileSize
    variant?: AccentIconTileVariant
  }

  let {
    icon: Icon,
    iconClass,
    size = 'medium',
    variant = 'accent',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<!-- Shared rounded-square accent icon tile used by cards and metadata pills. -->
<div
  class={mergeClasses(
    'cthulhuUiAccentIconTile',
    size === 'medium'
      ? 'cthulhuUiAccentIconTile--medium rounded-[var(--cthulhu-ui-radius-control)]'
      : null,
    size === 'large' ? 'cthulhuUiAccentIconTile--large' : null,
    className
  )}
  data-variant={variant}
  {...restProps}
>
  <Icon
    class={mergeClasses(
      size === 'medium' ? 'h-[18px] w-[18px]' : null,
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
    box-shadow: var(--cthulhu-ui-shadow-icon-accent);
    color: var(--ui-accent-icon-glyph);
  }

  .cthulhuUiAccentIconTile[data-variant='accent-white-icon'] {
    background-color: var(--ui-accent-icon-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-accent);
    color: var(--ui-normal-text);
  }

  .cthulhuUiAccentIconTile[data-variant='danger'] {
    background-color: var(--ui-danger-icon-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-danger);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiAccentIconTile--medium {
    height: 3rem;
    width: 3rem;
  }

  .cthulhuUiAccentIconTile--large {
    border-radius: var(--cthulhu-ui-radius-large-icon);
    height: 54px;
    width: 54px;
  }
</style>
