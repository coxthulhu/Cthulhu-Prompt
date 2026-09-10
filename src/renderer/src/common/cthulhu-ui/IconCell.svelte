<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  /** Supported cell and glyph size combinations. */
  type IconCellVariant = 'standard' | 'title' | 'compact' | 'small' | 'menu'

  /** Glyph size rendered by each cell variant. */
  const iconSizeByVariant: Record<IconCellVariant, number> = {
    standard: 24,
    title: 24,
    compact: 20,
    small: 16,
    menu: 20
  }

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
    size={iconSizeByVariant[variant]}
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

  .cthulhuUiIconCell[data-variant='small'] {
    flex-basis: 18px;
    height: 18px;
    width: 18px;
  }

  .cthulhuUiIconCell[data-variant='menu'] {
    flex-basis: 28px;
    height: 28px;
    width: 28px;
  }

  .cthulhuUiIconCell:where(
      [data-variant='compact'],
      [data-variant='small'],
      [data-variant='menu']
    ) {
    color: inherit;
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiIconCellIcon {
    stroke-width: 2;
  }
</style>
