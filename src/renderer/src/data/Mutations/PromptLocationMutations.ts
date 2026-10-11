import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getPromptStatusFolderDefinition, PromptStatus, type PromptContentStatus, type PromptLocation } from '@shared/domain/prompt/Prompt'
import { planSetPromptLocationDomainMutation } from '@shared/domain/prompt/PromptDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { markPromptClientStateEdited } from '@renderer/data/Collections/PromptClientStateCollection'
import { markPromptTemplateClientStateEdited } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'

/** Reads a complete current location from canonical content and its collection ordering. */
export const getPromptLocation = (promptCollectionId: string, promptId: string): PromptLocation => {
  /** Loaded collection identifies the prompt or template collection. */
  const collection = promptCollectionsCollection.get(promptCollectionId)!
  /** Canonical content includes the exact status, including In Progress within Active. */
  const prompt = (collection.kind === 'prompt' ? promptsCollection : promptTemplatesCollection).get(promptId)!
  /** Physical layout owning this prompt's ordering. */
  const layout = collection.statusFolders[getPromptStatusFolderDefinition(prompt.status ?? (collection.kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)).id]
  /** Current category order is authoritative for manually ordered locations. */
  const group = layout.ordering === 'category'
    ? layout.categoryOrder.categories.find((group) => group.entries.some((entry) => entry.id === promptId))
    : undefined
  return {
    promptCollectionId,
    categoryId: group ? group.categoryId : prompt.category ?? null,
    previousEntryId: group?.entries[group.entries.findIndex((entry) => entry.id === promptId) - 1]?.id ?? null,
    status: prompt.status ?? (collection.kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)
  }
}

/** Preserves placement within a status folder; moves into category-ordered collections insert at the top. */
export const getPromptStatusLocation = (promptCollectionId: string, promptId: string, status: PromptContentStatus): PromptLocation => {
  /** Current placement retained when the status stays within the same physical layout. */
  const current = getPromptLocation(promptCollectionId, promptId)
  /** Loaded collection supplies destination categories for prompts and templates. */
  const collection = promptCollectionsCollection.get(promptCollectionId)!
  /** Physical status folder determines whether the current placement can be retained. */
  const destinationStatus = getPromptStatusFolderDefinition(status)
  if (getPromptStatusFolderDefinition(current.status).id === destinationStatus.id) return { ...current, status }
  /** Destination layout used to select the retained or Uncategorized group. */
  const layout = collection.statusFolders[destinationStatus.id]
  if (layout.ordering === 'finalizedAt') return { ...current, status, previousEntryId: null }
  /** Deleted categories restore into Uncategorized. */
  const group = layout.categoryOrder.categories.find((group) => group.categoryId === current.categoryId)
    ?? layout.categoryOrder.categories[0]!
  return {
    promptCollectionId,
    categoryId: group.categoryId,
    previousEntryId: null,
    status
  }
}

/** Sets a prompt or template location through the single shared atomic IPC mutation. */
export const setPromptLocation = async (sourcePromptCollectionId: string, promptId: string, location: PromptLocation): Promise<void> => {
  /** Source collection identifies the content kind used by both planners. */
  const source = promptCollectionsCollection.get(sourcePromptCollectionId)!
  /** Current location determines whether a template move should mark its editor as edited. */
  const current = getPromptLocation(sourcePromptCollectionId, promptId)
  /** Serializable command shared by optimistic and committed planning. */
  const command = { kind: source.kind, sourcePromptCollectionId, promptId, location, modifiedAt: getCurrentIsoSecondTimestamp() }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSetPromptLocationDomainMutation },
    ipc: { channel: 'set-prompt-location' },
    renderer: {
      mutate: ({ collections }) => {
        if (source.kind === 'prompt') {
          collections.promptClientState.update(promptId, markPromptClientStateEdited)
        } else if (current.status === location.status) {
          collections.promptTemplateClientState.update(promptId, markPromptTemplateClientStateEdited)
        }
      }
    }
  })
}
