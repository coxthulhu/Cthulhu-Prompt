<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type IconCellSize = 'row' | 'title'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    icon: ComponentType
    iconClass?: string
    size?: IconCellSize
  }

  let { icon: Icon, iconClass, size = 'row', class: className, ...restProps }: Props = $props()
</script>

<span class={mergeClasses('cthulhuUiIconCell', className)} data-size={size} {...restProps}>
  <Icon class={mergeClasses('cthulhuUiIconCellIcon', iconClass)} size={24} aria-hidden="true" />
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

  .cthulhuUiIconCell[data-size='title'] {
    flex-basis: 40px;
    height: 40px;
    width: 40px;
  }

  .cthulhuUiIconCellIcon {
    stroke-width: 2;
  }
</style>
