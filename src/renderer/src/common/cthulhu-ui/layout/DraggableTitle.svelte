<script lang="ts">
  import { GripVertical } from 'lucide-svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import Title, { type TitleVariant } from '@renderer/common/cthulhu-ui/layout/Title.svelte'

  type Props = Omit<HTMLButtonAttributes, 'type' | 'title'> & {
    /** Title text, also shown in full on hover when truncated. */
    title: string
    /** Title size and treatment. */
    variant?: TitleVariant
    testId?: string
  }

  let { title, variant = 'dialog', class: className, testId, ...restProps }: Props = $props()
</script>

<!-- One drag handle covers the grip and the title. Only the title takes part in baseline alignment, so the handle's
     baseline is the title's and adjacent text-baseline controls line up with it; the grip centers on the handle. -->
<button
  type="button"
  class={mergeClasses('cthulhuUiDraggableTitle', className)}
  aria-label={`Reorder ${title}`}
  title="Drag to reorder"
  data-testid={testId}
  {...restProps}
>
  <span class="cthulhuUiDraggableTitleGrip">
    <GripVertical size={18} aria-hidden="true" />
  </span>
  <Title {title} tooltip={title} {variant} class="min-w-0" />
</button>

<style>
  /* The 3px vertical padding gives the title line a ghost highlight 6px taller than the text. */
  .cthulhuUiDraggableTitle {
    align-items: baseline;
    background-color: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    cursor: grab;
    display: flex;
    min-width: 0;
    padding: 3px 8px 3px 0;
    text-align: left;
    transition: background-color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiDraggableTitle:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-normal-surface);
  }

  .cthulhuUiDraggableTitle:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiDraggableTitleGrip {
    align-items: center;
    align-self: center;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    flex: none;
    height: 28px;
    justify-content: center;
    transition: color var(--ui-animation-duration-standard) ease;
    width: 26px;
  }

  .cthulhuUiDraggableTitle:is(:hover, :focus-visible) .cthulhuUiDraggableTitleGrip {
    color: var(--ui-hoverable-icon-glyph);
  }
</style>
