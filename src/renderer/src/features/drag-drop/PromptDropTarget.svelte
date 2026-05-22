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
  import type { PromptHandleDragPayload, PromptHandleDropPayload } from './promptHandleDrag'

  export type PromptDropTargetState = {
    isOver: boolean
    edge: DroppableEdge | null
  }

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    getOptions: () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
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
    () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
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
