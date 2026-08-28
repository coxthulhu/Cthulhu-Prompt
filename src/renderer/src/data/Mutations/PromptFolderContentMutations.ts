import type { PromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { deletePromptClientStates } from '../UiState/PromptClientStateMutations.svelte.ts'
import { deletePromptTemplateClientStates } from '../UiState/PromptTemplateClientStateMutations.svelte.ts'
import { deleteMarkdownContentUiStates } from '../UiState/MarkdownContentUiStateAutosave.svelte.ts'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { categoryCollection } from '../Collections/CategoryCollection'

type MutationOptions = Parameters<typeof runRevisionMutation<unknown>>[0]
type OptimisticCollections = Parameters<MutationOptions['mutateOptimistically']>[0][
  'collections'
]

export const deletePromptFolderContentsOptimistically = (
  collections: OptimisticCollections,
  graph: PromptFolderGraphIds
): void => {
  const promptIds = [...graph.contentIds.prompt]
  const templateIds = [...graph.contentIds.template]
  if (promptIds.length > 0) {
    collections.prompt.delete(promptIds)
    collections.promptClientState.delete(promptIds)
  }
  if (templateIds.length > 0) {
    collections.promptTemplate.delete(templateIds)
    collections.promptTemplateClientState.delete(templateIds)
  }
  const categoryIds = [...graph.categoryIds]
  if (categoryIds.length > 0) collections.category.delete(categoryIds)
}

export const deletePromptFolderContentRecords = (graph: PromptFolderGraphIds): void => {
  const promptIds = [...graph.contentIds.prompt]
  const templateIds = [...graph.contentIds.template]
  promptCollection.utils.deleteManyAuthoritative(promptIds)
  promptTemplateCollection.utils.deleteManyAuthoritative(templateIds)
  deletePromptClientStates(promptIds)
  deletePromptTemplateClientStates(templateIds)
  deleteMarkdownContentUiStates([...promptIds, ...templateIds])
  categoryCollection.utils.deleteManyAuthoritative([...graph.categoryIds])
}
