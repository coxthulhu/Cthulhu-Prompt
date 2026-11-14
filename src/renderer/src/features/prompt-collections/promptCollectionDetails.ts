import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { getOrderedMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { formatPromptModifiedRelative } from '@renderer/features/prompt-editor/promptModifiedTime'

/** Count and relative modification time shown beneath a collection's name in the Show All dropdown and New Tab tiles. */
export type PromptCollectionDetails = {
  /** Active content count, including Backlog for task collections. */
  count: number
  /** Count with its content noun, such as "3 prompts". */
  countText: string
  /** Capitalized time since the newest content change, or null when no content has a modification time. */
  modifiedText: string | null
}

/** Summarizes one collection's active content from the loaded prompts and templates. */
export const getPromptCollectionDetails = (
  promptCollection: PromptCollection,
  promptById: Map<string, { modifiedAt: string }>,
  templateById: Map<string, { modifiedAt: string }>,
  nowMs: number
): PromptCollectionDetails => {
  /** Templates count their Active folder; task prompts count every category-ordered folder, including Backlog. */
  const entryIds = promptCollection.kind === 'template'
    ? getOrderedMarkdownContentIds(promptCollection, 'template')
    : Object.values(promptCollection.statusFolders).flatMap((layout) => layout.ordering === 'category'
      ? layout.categoryOrder.categories.flatMap((group) => group.entries.map((entry) => entry.id))
      : [])
  /** Content lookup matching the collection's kind. */
  const contentById = promptCollection.kind === 'template' ? templateById : promptById
  let newestModifiedAt: string | null = null
  for (const entryId of entryIds) {
    const modifiedAt = contentById.get(entryId)?.modifiedAt
    if (modifiedAt && (!newestModifiedAt || modifiedAt > newestModifiedAt)) newestModifiedAt = modifiedAt
  }
  /** Lowercase relative time, such as "2 days ago". */
  const relativeTime = newestModifiedAt ? formatPromptModifiedRelative(newestModifiedAt, nowMs) : null

  return {
    count: entryIds.length,
    countText: `${entryIds.length} ${promptCollection.kind === 'template' ? 'template' : 'prompt'}${entryIds.length === 1 ? '' : 's'}`,
    modifiedText: relativeTime && `${relativeTime[0]!.toUpperCase()}${relativeTime.slice(1)}`
  }
}
