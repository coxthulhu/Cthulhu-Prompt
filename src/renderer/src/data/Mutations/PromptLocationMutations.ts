import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getPromptStatusFolderDefinition, PromptStatus, PromptStatusFolderId, type PromptContentStatus, type PromptLocation } from '@shared/domain/prompt/Prompt'
import { planSetPromptLocationDomainMutation } from '@shared/domain/prompt/PromptDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { markPromptClientStateEdited } from '@renderer/data/Collections/PromptClientStateCollection'
import { markPromptTemplateClientStateEdited } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'

/** Reads a complete current location from canonical content and its root ordering. */
export const getPromptLocation = (promptFolderId: string, promptId: string): PromptLocation => {
  /** Loaded root identifies the prompt or template collection. */
  const folder = promptFolderCollection.get(promptFolderId)!
  /** Canonical content includes the exact status, including In Progress within Active. */
  const prompt = (folder.kind === 'prompt' ? promptCollection : promptTemplateCollection).get(promptId)!
  /** Physical layout owning this prompt's ordering. */
  const layout = folder.statusFolders[getPromptStatusFolderDefinition(prompt.status ?? (folder.kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)).id]
  /** Current category order is authoritative for manually ordered locations. */
  const group = layout.ordering === 'category'
    ? layout.categoryOrder.categories.find((group) => group.entries.some((entry) => entry.id === promptId))
    : undefined
  return {
    promptFolderId,
    categoryId: group ? group.categoryId : prompt.category ?? null,
    previousEntryId: group?.entries[group.entries.findIndex((entry) => entry.id === promptId) - 1]?.id ?? null,
    status: prompt.status ?? (folder.kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)
  }
}

/** Resolves status controls to a complete location using existing restore and insertion rules. */
export const getPromptStatusLocation = (promptFolderId: string, promptId: string, status: PromptContentStatus): PromptLocation => {
  /** Current placement retained when the status stays within the same physical layout. */
  const current = getPromptLocation(promptFolderId, promptId)
  /** Loaded root supplies destination categories and template restoration behavior. */
  const folder = promptFolderCollection.get(promptFolderId)!
  /** Destination workflow determines whether an explicit predecessor applies. */
  const destinationStatus = getPromptStatusFolderDefinition(status)
  if (getPromptStatusFolderDefinition(current.status).id === destinationStatus.id) return { ...current, status }
  /** Destination layout used to select the retained or Uncategorized group. */
  const layout = folder.statusFolders[destinationStatus.id]
  if (layout.ordering === 'finalizedAt') return { ...current, status, previousEntryId: null }
  /** Deleted categories restore into Uncategorized. */
  const group = layout.categoryOrder.categories.find((group) => group.categoryId === current.categoryId)
    ?? layout.categoryOrder.categories[0]!
  return {
    promptFolderId,
    categoryId: group.categoryId,
    previousEntryId: folder.kind === 'prompt' && destinationStatus.id === PromptStatusFolderId.Active
      ? group.entries.at(-1)?.id ?? null
      : null,
    status
  }
}

/** Sets a prompt or template location through the single shared atomic IPC mutation. */
export const setPromptLocation = async (sourcePromptFolderId: string, promptId: string, location: PromptLocation): Promise<void> => {
  /** Source root identifies the content kind used by both planners. */
  const source = promptFolderCollection.get(sourcePromptFolderId)!
  /** Current location determines whether a template move should mark its editor as edited. */
  const current = getPromptLocation(sourcePromptFolderId, promptId)
  /** Serializable command shared by optimistic and committed planning. */
  const command = { kind: source.kind, sourcePromptFolderId, promptId, location, modifiedAt: getCurrentIsoSecondTimestamp() }
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
