import { getStandaloneNoteIds } from '@shared/domain/note/Note'
import { promptsCollection } from './PromptsCollection'
import { promptTemplatesCollection } from './PromptTemplatesCollection'
import {
  MARKDOWN_CONTENT_KINDS,
  getMarkdownContentIds
} from '@shared/domain/markdown-content/MarkdownContent'
import { getPromptCollectionCategoryIds, type PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'
import { promptCollectionsCollection } from './PromptCollectionsCollection'

export type PromptCollectionGraphIds = {
  promptCollectionIds: Set<string>
  categoryIds: Set<string>
  /** Note IDs reachable through ordering or owner attachment references. */
  noteIds: Set<string>
  contentIds: Record<PromptCollectionContentKind, Set<string>>
}

export const collectPromptCollectionGraphIds = (
  promptCollectionIds: Iterable<string>
): PromptCollectionGraphIds => {
  const graph: PromptCollectionGraphIds = {
    promptCollectionIds: new Set<string>(),
    categoryIds: new Set<string>(),
    noteIds: new Set<string>(),
    contentIds: { prompt: new Set<string>(), template: new Set<string>() }
  }
  const visitCollection = (promptCollectionId: string): void => {
    if (graph.promptCollectionIds.has(promptCollectionId)) return
    graph.promptCollectionIds.add(promptCollectionId)
    const promptCollection = promptCollectionsCollection.get(promptCollectionId)
    if (!promptCollection) return
    for (const categoryId of getPromptCollectionCategoryIds(promptCollection)) {
      graph.categoryIds.add(categoryId)
    }

    for (const id of getStandaloneNoteIds(promptCollection)) graph.noteIds.add(id)
    for (const kind of MARKDOWN_CONTENT_KINDS) {
      for (const contentId of getMarkdownContentIds(promptCollection, kind)) {
        graph.contentIds[kind].add(contentId)
        /** Attached notes remain reachable without independent ordering entries. */
        const owner = (kind === 'prompt' ? promptsCollection : promptTemplatesCollection).get(contentId)
        if (owner?.attachedNoteId) graph.noteIds.add(owner.attachedNoteId)
      }
    }
  }

  for (const promptCollectionId of promptCollectionIds) visitCollection(promptCollectionId)
  return graph
}
