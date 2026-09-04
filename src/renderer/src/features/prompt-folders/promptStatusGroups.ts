import { Archive, Check, CircleCheckBig, ListTodo } from 'lucide-svelte'
import { getPromptStatusFolderDefinition, PROMPT_STATUS_FOLDERS, PromptStatusFolderId, type Prompt } from '@shared/Prompt'

import type { PromptFolder } from '@shared/PromptFolder'
import { getPromptStatusFolderContentIds } from '@shared/MarkdownContent'

/** Renderer icons kept outside the shared workflow definitions. */
const groupIcons = {
  [PromptStatusFolderId.Active]: { icon: ListTodo, toggleIcon: ListTodo },
  [PromptStatusFolderId.Completed]: { icon: CircleCheckBig, toggleIcon: Check },
  [PromptStatusFolderId.Archived]: { icon: Archive, toggleIcon: Archive }
}

/** Registry definitions enriched with their renderer presentation. */
export const promptStatusGroups = PROMPT_STATUS_FOLDERS.map((group) => ({
  ...group,
  ...groupIcons[group.id]
}))

/** Sidebar retains finalized sections above the category-ordered workflows. */
export const sidebarPromptStatusGroups = [
  ...promptStatusGroups.filter((group) => group.ordering === 'finalizedAt'),
  ...promptStatusGroups.filter((group) => group.ordering === 'category')
]
/** Counts loaded prompts in each exact group owned by the selected root. */
export const getPromptStatusGroupCounts = (
  folder: PromptFolder | null,
  prompts: readonly Prompt[]
): Record<PromptStatusFolderId, number> => {
  /** Loaded membership keyed once for all group counts. */
  const groupByPromptId = new Map(
    prompts.map((prompt) => [prompt.id, getPromptStatusFolderDefinition(prompt.status).id])
  )
  return Object.fromEntries(PROMPT_STATUS_FOLDERS.map((group) => [
    group.id,
    folder?.kind === 'prompt'
      ? getPromptStatusFolderContentIds(folder, group.id).filter(
          (id) => groupByPromptId.get(id) === group.id
        ).length
      : 0
  ])) as Record<PromptStatusFolderId, number>
}
