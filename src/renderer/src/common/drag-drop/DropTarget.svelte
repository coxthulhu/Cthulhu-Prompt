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
    getOptions: () => AnyDroppableOptions
    children?: Snippet<[DropTargetState]>
  }

  let { getOptions, children, class: className, ...restProps }: Props = $props()
  let dropState = $state<DroppableState | null>(null)

  const targetState = $derived({
    isOver: dropState?.isOver ?? false,
    isBlocked: dropState?.isBlocked ?? false,
    edge: dropState?.edge ?? null
  })

  const dropTargetAction: Action<HTMLDivElement, () => AnyDroppableOptions> = (
    node,
    initialGetOptions
  ) => {
    let resolveOptions = initialGetOptions
    const readOptions = () => {
      const options = resolveOptions()
      dropState = options.indicator
      return options
    }
    const action = droppable(node, readOptions())

    return {
      update(nextGetOptions) {
        resolveOptions = nextGetOptions
        action.update(readOptions())
      },
      destroy() {
        action.destroy()
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
