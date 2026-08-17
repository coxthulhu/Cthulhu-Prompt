import type { DragGhostOptions } from './dragDrop.svelte.ts'
import PromptDragGhost from './PromptDragGhost.svelte'

// Identifies the editor content whose leading icon the drag ghost mirrors.
export type PromptDragGhostKind = import('@shared/PromptFolder').PromptFolderContentKind | 'category'

export const createPromptDragGhost = (
  title: string,
  kind: PromptDragGhostKind = 'prompt'
): DragGhostOptions => ({
  component: PromptDragGhost,
  kind,
  props: { title, kind }
})
