<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type IconCellVariant = 'standard' | 'title' | 'compact'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    icon: ComponentType
    iconClass?: string
    variant?: IconCellVariant
  }

  let {
    icon: Icon,
    iconClass,
    variant = 'standard',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiIconCell', className)}
  data-variant={variant}
  {...restProps}
>
  <Icon
    class={mergeClasses('cthulhuUiIconCellIcon', iconClass)}
    size={variant === 'compact' ? 20 : 24}
    aria-hidden="true"
  />
</span>

<style>
  .cthulhuUiIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 34px;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuUiIconCell[data-variant='title'] {
    flex-basis: 40px;
    height: 40px;
    width: 40px;
  }

  .cthulhuUiIconCell[data-variant='compact'] {
    color: var(--ui-normal-text);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiIconCellIcon {
    stroke-width: 2;
  }
</style>
