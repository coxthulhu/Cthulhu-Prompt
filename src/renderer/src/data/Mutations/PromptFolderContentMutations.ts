import type { PromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { deletePromptDrafts } from '../UiState/PromptDraftMutations.svelte.ts'
import { deletePromptTemplateDrafts } from '../UiState/PromptTemplateDraftMutations.svelte.ts'
import { deletePromptUiStates } from '../UiState/PromptUiStateDraftMutations.svelte.ts'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

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
  if (promptIds.length > 0) collections.prompt.delete(promptIds)
  if (templateIds.length > 0) {
    collections.promptTemplate.delete(templateIds)
    collections.promptTemplateDraft.delete(templateIds)
  }
}

export const deletePromptFolderContentRecords = (graph: PromptFolderGraphIds): void => {
  const promptIds = [...graph.contentIds.prompt]
  const templateIds = [...graph.contentIds.template]
  promptCollection.utils.deleteManyAuthoritative(promptIds)
  promptTemplateCollection.utils.deleteManyAuthoritative(templateIds)
  deletePromptDrafts(promptIds)
  deletePromptTemplateDrafts(templateIds)
  deletePromptUiStates(promptIds)
}
