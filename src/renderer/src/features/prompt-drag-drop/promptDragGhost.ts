import { FileText, Folder, Repeat, type LucideIcon } from '@lucide/svelte'
import type { DragGhostOptions } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
import PromptDragGhost from './PromptDragGhost.svelte'

// Identifies the dragged item: editor content, a category, or a New Tab project or collection.
export type PromptDragGhostKind =
  | import('@shared/domain/prompt-collection/PromptCollection').PromptCollectionKind
  | 'category'
  | 'project'
  | 'collection'

/** Cursor ghost showing the dragged item's icon and title; categories default to a folder and others to a document. */
export const createPromptDragGhost = (
  title: string,
  kind: PromptDragGhostKind = 'prompt',
  icon: LucideIcon = kind === 'category' ? Folder : kind === 'routine' ? Repeat : FileText
): DragGhostOptions => ({
  component: PromptDragGhost,
  kind,
  props: { title, icon }
})
