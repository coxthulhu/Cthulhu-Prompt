import type { DragGhostOptions } from './dragDrop.svelte.ts'
import PromptDragGhost from './PromptDragGhost.svelte'

export const createPromptDragGhost = (title: string, kind = 'prompt'): DragGhostOptions => ({
  component: PromptDragGhost,
  kind,
  props: { title }
})
