import type { PromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { deletePromptClientStates } from '../UiState/PromptClientStateMutations.svelte.ts'
import { deletePromptTemplateClientStates } from '../UiState/PromptTemplateClientStateMutations.svelte.ts'
import { deleteMarkdownContentUiStates } from '../UiState/MarkdownContentUiStateAutosave.svelte.ts'
import { categoryCollection } from '../Collections/CategoryCollection'

/** Removes a closed root folder's authoritative content graph from renderer collections. */
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
