<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuSize } from './types'

  type AccentIconTileSize = Extract<CthulhuSize, 'small' | 'medium' | 'large'>
  type AccentIconTileVariant = 'accent' | 'accent-bordered' | 'danger'

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
    size === 'small' ? 'cthulhuUiAccentIconTile--small' : null,
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
      size === 'small' ? 'h-4 w-4' : null,
      size === 'medium' ? 'h-[18px] w-[18px]' : null,
      size === 'large' ? 'h-6 w-6' : null,
      iconClass
    )}
  />
</div>

<style>
  .cthulhuUiAccentIconTile {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
  }

  .cthulhuUiAccentIconTile[data-variant='accent'] {
    background-color: var(--ui-accent-normal-surface);
    border: 1px solid var(--ui-accent-icon-ring);
    color: var(--ui-accent-icon-glyph);
  }

  .cthulhuUiAccentIconTile[data-variant='accent-bordered'] {
    background-color: var(--ui-accent-normal-surface);
    border: 1px solid var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiAccentIconTile[data-variant='danger'] {
    background-color: var(--ui-danger-icon-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-danger);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiAccentIconTile--small {
    border-radius: 7px;
    height: 30px;
    width: 30px;
  }

  .cthulhuUiAccentIconTile--medium {
    height: 2.25rem;
    width: 2.25rem;
  }

  .cthulhuUiAccentIconTile--large {
    border-radius: var(--cthulhu-ui-radius-large-icon);
    height: 48px;
    width: 48px;
  }
</style>
