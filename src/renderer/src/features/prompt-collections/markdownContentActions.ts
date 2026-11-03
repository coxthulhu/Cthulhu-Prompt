import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import { deletePromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
import { getPromptStatusLocation, setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
import type { PromptContentStatus } from '@shared/domain/prompt/Prompt'

/** Changes a prompt's or template's status through the shared location mutation used by both editor screens. */
export const setMarkdownContentStatus = (
  collectionId: string,
  promptId: string,
  status: PromptContentStatus
): void => {
  void runIpcBestEffort(() =>
    setPromptLocation(collectionId, promptId, getPromptStatusLocation(collectionId, promptId, status))
  )
}

/** Permanently deletes a prompt or template according to its collection's content kind. */
export const deleteMarkdownContent = (collectionId: string, promptId: string): void => {
  /** Collection kind selects the prompt or template mutation. */
  const kind = promptCollectionsCollection.get(collectionId)!.kind
  void runIpcBestEffort(() =>
    kind === 'template' ? deletePromptTemplate(collectionId, promptId) : deletePrompt(collectionId, promptId)
  )
}
