import type { DragGhostOptions } from './dragDrop.svelte.ts'
import PromptDragGhost from './PromptDragGhost.svelte'

export const createPromptDragGhost = (title: string): DragGhostOptions => ({
  component: PromptDragGhost,
  kind: 'prompt',
  props: { title }
})
