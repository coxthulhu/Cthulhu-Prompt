<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    expanded: boolean
    size?: number
    iconSize?: number
    class?: string
    iconClass?: string
  }

  let {
    expanded,
    size = 22,
    iconSize = 20,
    class: className,
    iconClass
  }: Props = $props()

  const chevronStyle = $derived(
    `--cthulhu-ui-flat-rotating-chevron-size: ${size}px; --cthulhu-ui-flat-rotating-chevron-icon-size: ${iconSize}px;`
  )
</script>

<span
  class={mergeClasses('cthulhuUiFlatRotatingChevron', className)}
  data-expanded={expanded ? 'true' : 'false'}
  style={chevronStyle}
>
  <ChevronRight
    class={mergeClasses('cthulhuUiFlatRotatingChevronIcon', iconClass)}
    size={iconSize}
    aria-hidden="true"
  />
</span>

<style>
  .cthulhuUiFlatRotatingChevron {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    height: var(--cthulhu-ui-flat-rotating-chevron-size);
    justify-content: center;
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform 50ms ease-out;
    width: var(--cthulhu-ui-flat-rotating-chevron-size);
  }

  .cthulhuUiFlatRotatingChevron[data-expanded='true'] {
    transform: rotate(90deg);
  }

  .cthulhuUiFlatRotatingChevronIcon {
    height: var(--cthulhu-ui-flat-rotating-chevron-icon-size);
    width: var(--cthulhu-ui-flat-rotating-chevron-icon-size);
  }
</style>
