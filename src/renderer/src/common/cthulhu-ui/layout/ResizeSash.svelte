<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** Shared draggable divider for resizable sidebars, accordion sections, and stacked editors. */
  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    /** Horizontal sashes sit on a top edge and resize heights; vertical sashes sit on a right edge and resize widths. */
    orientation: 'horizontal' | 'vertical'
    /** Highlights the sash while its drag is active. */
    isDragging?: boolean
    label: string
    testId?: string
    class?: string
  }

  let { orientation, isDragging = false, label, testId, class: className, ...restProps }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiResizeSash', className)}
  data-orientation={orientation}
  data-dragging={isDragging ? 'true' : 'false'}
  data-testid={testId}
  aria-label={label}
  {...restProps}
></button>

<style>
  .cthulhuUiResizeSash {
    position: absolute;
    touch-action: none;
    z-index: var(--z-raised);
  }

  .cthulhuUiResizeSash[data-orientation='horizontal'] {
    cursor: ns-resize;
    height: 4px;
    left: 0;
    right: 0;
    top: 0;
  }

  .cthulhuUiResizeSash[data-orientation='vertical'] {
    background: var(--ui-ghost-surface);
    cursor: ew-resize;
    height: 100%;
    right: 0;
    top: 0;
    transform: translateX(50%);
    width: 6px;
    z-index: var(--z-chrome);
  }

  .cthulhuUiResizeSash[data-dragging='true'] {
    background: var(--ui-info-strong-border);
  }
</style>
