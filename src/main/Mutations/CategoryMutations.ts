import { ipcMain } from 'electron'
import {
  type CategoryRevisionResponsePayload
} from '@shared/Category'
import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand,
  parseMoveCategoryDomainCommand,
  parseRenameCategoryDomainCommand,
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planRenameCategoryDomainMutation
} from '@shared/CategoryDomainMutations'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildCategorySnapshot } from '../Data/DataSnapshotHelpers'
import { parseSetCategoryDescriptionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers create, rename, description, and deletion category mutation channels. */
export const setupCategoryMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'create-category' },
    mutation: {
      parseCommand: parseCreateCategoryDomainCommand,
      plan: planCreateCategoryDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'delete-category' },
    mutation: {
      parseCommand: parseDeleteCategoryDomainCommand,
      plan: planDeleteCategoryDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'rename-category' },
    mutation: {
      parseCommand: parseRenameCategoryDomainCommand,
      plan: planRenameCategoryDomainMutation
    }
  })

  ipcMain.handle('set-category-description', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseSetCategoryDescriptionRequest,
      async (validated) => {
        try {
          const requestedCategory = validated.payload.category
          const categoryEntry = data.category.committedStore.getEntry(requestedCategory.id)
          if (!categoryEntry) return { success: false, error: 'Category not loaded' }
          const outcome = await runAtomicDataTransaction((tx) => ({
            category: tx.category.update({
              id: requestedCategory.id,
              expectedRevision: requestedCategory.expectedRevision,
              recipe: (draft) => {
                draft.description = validated.payload.description
              }
            })
          }))
          const latestCategory = data.category.committedStore.getEntry(requestedCategory.id)
          if (!latestCategory) return { success: false, error: 'Category not loaded' }
          const payload: CategoryRevisionResponsePayload = {
            category: buildCategorySnapshot(latestCategory)
          }
          return outcome.status === 'conflict'
            ? { success: false, conflict: true, payload }
            : { success: true, payload }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })

  handleMainDomainMutation({
    ipc: { channel: 'move-category' },
    mutation: {
      parseCommand: parseMoveCategoryDomainCommand,
      plan: planMoveCategoryDomainMutation
    }
  })
}
