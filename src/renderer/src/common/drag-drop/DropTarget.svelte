<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import type { HTMLAttributes } from 'svelte/elements'
  import {
    droppable,
    type DroppableEdge,
    type DroppableOptions,
    type DroppableState
  } from './dragDrop.svelte.ts'

  export type DropTargetState = {
    isOver: boolean
    isBlocked: boolean
    edge: DroppableEdge | null
  }

  type AnyDroppableOptions = Omit<
    DroppableOptions<never, unknown>,
    'canDrop' | 'onDrop' | 'payload'
  > & {
    payload?: unknown | ((edge: DroppableEdge | null) => unknown)
    canDrop?: (payload: never, edge: DroppableEdge | null) => boolean
    onDrop?: (payload: never) => void
  }

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Omit options to retain the content without registering a drop target. */
    getOptions?: () => AnyDroppableOptions
    children?: Snippet<[DropTargetState]>
  }

  let { getOptions, children, class: className, ...restProps }: Props = $props()
  let dropState = $state<DroppableState | null>(null)

  const targetState = $derived({
    isOver: dropState?.isOver ?? false,
    isBlocked: dropState?.isBlocked ?? false,
    edge: dropState?.edge ?? null
  })

  /** Updates the registration without replacing the rendered children. */
  const dropTargetAction: Action<HTMLDivElement, (() => AnyDroppableOptions) | undefined> = (
    node,
    initialGetOptions
  ) => {
    /** Initial registration options, absent for an inactive target. */
    const options = initialGetOptions?.()
    dropState = options?.indicator ?? null
    /** Registration can change while the wrapper and its children stay mounted. */
    let action = options ? droppable(node, options) : undefined

    return {
      update(nextGetOptions) {
        /** Latest options determine whether this wrapper participates in dragging. */
        const nextOptions = nextGetOptions?.()
        if (nextOptions) {
          if (action) action.update(nextOptions)
          else action = droppable(node, nextOptions)
        } else {
          action?.destroy()
          action = undefined
        }
        dropState = nextOptions?.indicator ?? null
      },
      destroy() {
        action?.destroy()
        dropState = null
      }
    }
  }
</script>

<div use:dropTargetAction={getOptions} class={className} {...restProps}>
  {#if children}
    {@render children(targetState)}
  {/if}
</div>
