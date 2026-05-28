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

  export type PromptDropTargetState = {
    isOver: boolean
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
    children: Snippet<[PromptDropTargetState]>
  }

  let { getOptions, children, class: className, ...restProps }: Props = $props()
  let dropState = $state<DroppableState | null>(null)

  const targetState = $derived({
    isOver: dropState?.isOver ?? false,
    edge: dropState?.edge ?? null
  })

  const promptDroppable: Action<
    HTMLDivElement,
    () => AnyDroppableOptions
  > = (node, initialGetOptions) => {
    let resolveOptions = initialGetOptions
    const readOptions = () => {
      const options = resolveOptions()
      dropState = options.state ?? null
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

<div use:promptDroppable={getOptions} class={className} {...restProps}>
  {@render children(targetState)}
</div>
