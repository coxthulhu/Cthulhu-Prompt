<script lang="ts">
  import { GripVertical } from 'lucide-svelte'
  import type { Action } from 'svelte/action'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import Title, { type TitleVariant } from '@renderer/common/cthulhu-ui/layout/Title.svelte'

  /** Action attached to the drag handle, such as the shared draggable action. */
  type DraggableTitleAction = Action<HTMLButtonElement, unknown>

  type Props = Omit<HTMLButtonAttributes, 'type' | 'title'> & {
    /** Title text, also shown in full on hover when truncated. */
    title: string
    /** Title size and treatment. */
    variant?: TitleVariant
    /** Shows the dragged-row fill and border while the title's item is being dragged to a new position. */
    dragging?: boolean
    /** Action attached to the handle, typically the drag/drop draggable action. */
    buttonAction?: DraggableTitleAction | null
    /** Parameter passed to buttonAction. */
    buttonActionParameter?: unknown
    testId?: string
  }

  /** Handle without an attached action. */
  const noopButtonAction: DraggableTitleAction = () => undefined

  let {
    title,
    variant = 'dialog',
    dragging = false,
    buttonAction = null,
    buttonActionParameter,
    class: className,
    testId,
    ...restProps
  }: Props = $props()

  /** Attached action, or a no-op so the handle always has one. */
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<!-- One drag handle covers the grip and the title. Only the title takes part in baseline alignment, so the handle's
     baseline is the title's and adjacent text-baseline controls line up with it; the grip centers on the handle. -->
<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiDraggableTitle', className)}
  aria-label={`Reorder ${title}`}
  title="Drag to reorder"
  data-dragging={dragging ? 'true' : 'false'}
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
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      box-shadow var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiDraggableTitle:is(:hover, :focus-visible) {
    background-color: var(--ui-neutral-normal-surface);
  }

  /* Dragged titles share the dragged-row fill and border of reorderable selector lists; the inset border keeps the
     handle's size. */
  .cthulhuUiDraggableTitle[data-dragging='true'] {
    background-color: var(--ui-info-normal-surface);
    box-shadow: inset 0 0 0 1px var(--ui-info-muted-border);
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

  .cthulhuUiDraggableTitle:is(:hover, :focus-visible, [data-dragging='true']) .cthulhuUiDraggableTitleGrip {
    color: var(--ui-hoverable-icon-glyph);
  }
</style>
