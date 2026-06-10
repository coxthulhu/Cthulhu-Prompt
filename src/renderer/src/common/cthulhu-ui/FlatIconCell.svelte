<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type FlatIconCellSize = 'row' | 'title'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    icon: ComponentType
    iconClass?: string
    size?: FlatIconCellSize
  }

  let {
    icon: Icon,
    iconClass,
    size = 'row',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiFlatIconCell', className)}
  data-size={size}
  {...restProps}
>
  <Icon
    class={mergeClasses('cthulhuUiFlatIconCellIcon', iconClass)}
    size={24}
    aria-hidden="true"
  />
</span>

<style>
  .cthulhuUiFlatIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-flat-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 34px;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuUiFlatIconCell[data-size='title'] {
    flex-basis: 40px;
    height: 40px;
    width: 40px;
  }

  .cthulhuUiFlatIconCellIcon {
    stroke-width: 2;
  }
</style>
