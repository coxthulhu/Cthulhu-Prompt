import { ipcMain } from 'electron'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest,
  parseMovePromptFolderRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import * as path from 'path'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
import { folderEntryRef, removeEntry, type EntryRef } from '@shared/OrderContainer'
import {
  buildPromptFolderSnapshot,
  buildWorkspaceSnapshot,
  collectLoadedPromptFolderDescendantIds
} from '../Data/DataSnapshotHelpers'
import {
  refreshPromptFolderTreePersistencePaths,
  collectWorkspacePromptFolders
} from './PromptFolderPathHelpers'

const resolvePromptFolderInsertIndex = (
  entries: readonly EntryRef[],
  previousEntryId: string | null
): number | null => {
  if (previousEntryId === null) {
    return 0
  }

  const previousIndex = entries.findIndex((entry) => entry.id === previousEntryId)
  return previousIndex === -1 ? null : previousIndex + 1
}

const MAX_SUBFOLDER_DEPTH = 8

export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> => {
      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal  revision mutation entity shape.
      return await runMutationIpcRequest(
        request,
        parseCreateWorkspaceRequest,
        async (validatedRequest) => {
          const payload = validatedRequest.payload
          return await createWorkspace(
            payload.workspacePath,
            payload.workspaceName,
            payload.includeExamplePrompts
          )
        }
      )
    }
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> => {
      return await runMutationIpcRequest(request, parseCloseWorkspaceRequest, async () => {
        return { success: true }
      })
    }
  )

  ipcMain.handle('move-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseMovePromptFolderRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const requestedWorkspace = payload.workspace
          const committedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

          if (!committedWorkspace) {
            return { success: false, error: 'Workspace not loaded' }
          }

          const movedPromptFolder = data.promptFolder.committedStore.getEntry(
            payload.promptFolderId
          )

          if (!movedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const sourceParentPromptFolder = payload.sourceParentPromptFolder
            ? data.promptFolder.committedStore.getEntry(payload.sourceParentPromptFolder.id)
            : null
          const destinationParentPromptFolder = payload.destinationParentPromptFolder
            ? data.promptFolder.committedStore.getEntry(payload.destinationParentPromptFolder.id)
            : null
          const promptFolders = collectWorkspacePromptFolders(committedWorkspace.committed)
          const treeIndex = buildPromptFolderTreeIndex(committedWorkspace.committed, promptFolders)
          const movedLocation = treeIndex.get(payload.promptFolderId)
          if (!movedLocation) return { success: false, error: 'Prompt folder not in workspace' }

          const sourceParentPromptFolderId = movedLocation.parentPromptFolderId
          const destinationParentPromptFolderId =
            payload.destinationParentPromptFolder?.id ?? null

          if ((payload.sourceParentPromptFolder?.id ?? null) !== sourceParentPromptFolderId) {
            return { success: false, error: 'Source parent prompt folder did not match' }
          }

          if (payload.sourceParentPromptFolder && !sourceParentPromptFolder) {
            return { success: false, error: 'Source parent prompt folder not loaded' }
          }

          if (payload.destinationParentPromptFolder && !destinationParentPromptFolder) {
            return { success: false, error: 'Destination parent prompt folder not loaded' }
          }

          const descendantIds = collectLoadedPromptFolderDescendantIds(payload.promptFolderId)
          if (
            destinationParentPromptFolderId === payload.promptFolderId ||
            (destinationParentPromptFolderId !== null &&
              descendantIds.includes(destinationParentPromptFolderId))
          ) {
            return { success: false, error: 'Cannot move a prompt folder into itself' }
          }

          const sourceEntries =
            sourceParentPromptFolder?.committed.entries ?? committedWorkspace.committed.entries

          if (
            !sourceEntries.some(
              (entry) => entry.kind === 'folder' && entry.id === payload.promptFolderId
            )
          ) {
            return { success: false, error: 'Prompt folder not found in source parent' }
          }

          const isSameParent = sourceParentPromptFolderId === destinationParentPromptFolderId
          const destinationEntries = isSameParent
            ? removeEntry(sourceEntries, 'folder', payload.promptFolderId)
            : (destinationParentPromptFolder?.committed.entries ??
              committedWorkspace.committed.entries)
          const insertIndex = resolvePromptFolderInsertIndex(
            destinationEntries,
            payload.previousEntryId
          )

          if (insertIndex === null) {
            return { success: false, error: 'Previous entry not found' }
          }

          const nextDepth = destinationParentPromptFolderId
            ? (treeIndex.get(destinationParentPromptFolderId)?.depth ?? 0) + 1
            : 0
          const depthDelta = nextDepth - movedLocation.depth
          const deepestMovedDepth = Math.max(
            movedLocation.depth,
            ...descendantIds.map(
              (promptFolderId) => treeIndex.get(promptFolderId)?.depth ?? movedLocation.depth
            )
          )

          if (deepestMovedDepth + depthDelta > MAX_SUBFOLDER_DEPTH) {
            return {
              success: false,
              error: 'Prompt folders can contain up to 8 nested subfolder layers'
            }
          }

          const movedFolderPath = destinationParentPromptFolder
            ? path.join(
                destinationParentPromptFolder.persistenceFields.folderPath,
                movedPromptFolder.committed.folderName
              )
            : movedPromptFolder.committed.folderName
          const modifiedPromptFolderIds = new Set<string>()

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            const handles: Record<
              string,
              ReturnType<typeof tx.workspace.update> | ReturnType<typeof tx.promptFolder.update>
            > = {}

            const nextDestinationEntries = [...destinationEntries]
            nextDestinationEntries.splice(insertIndex, 0, folderEntryRef(payload.promptFolderId))

            if (sourceParentPromptFolderId === null && destinationParentPromptFolderId === null) {
              handles.workspace = tx.workspace.update({
                id: requestedWorkspace.id,
                expectedRevision: requestedWorkspace.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextDestinationEntries.filter(
                    (entry) => entry.kind === 'folder'
                  )
                }
              })
            } else if (isSameParent && sourceParentPromptFolder) {
              modifiedPromptFolderIds.add(sourceParentPromptFolder.committed.id)
              handles.sourceParentPromptFolder = tx.promptFolder.update({
                id: sourceParentPromptFolder.committed.id,
                expectedRevision: payload.sourceParentPromptFolder?.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextDestinationEntries
                }
              })
            } else {
              if (sourceParentPromptFolder) {
                modifiedPromptFolderIds.add(sourceParentPromptFolder.committed.id)
                handles.sourceParentPromptFolder = tx.promptFolder.update({
                  id: sourceParentPromptFolder.committed.id,
                  expectedRevision: payload.sourceParentPromptFolder?.expectedRevision,
                  recipe: (draft) => {
                    draft.entries = removeEntry(draft.entries, 'folder', payload.promptFolderId)
                  }
                })
              } else {
                handles.workspace = tx.workspace.update({
                  id: requestedWorkspace.id,
                  expectedRevision: requestedWorkspace.expectedRevision,
                  recipe: (draft) => {
                    draft.entries = removeEntry(draft.entries, 'folder', payload.promptFolderId)
                  }
                })
              }

              if (destinationParentPromptFolder) {
                modifiedPromptFolderIds.add(destinationParentPromptFolder.committed.id)
                handles.destinationParentPromptFolder = tx.promptFolder.update({
                  id: destinationParentPromptFolder.committed.id,
                  expectedRevision: payload.destinationParentPromptFolder?.expectedRevision,
                  recipe: (draft) => {
                    draft.entries = nextDestinationEntries
                  }
                })
              } else {
                handles.destinationWorkspace = tx.workspace.update({
                  id: requestedWorkspace.id,
                  expectedRevision: requestedWorkspace.expectedRevision,
                  recipe: (draft) => {
                    draft.entries = nextDestinationEntries.filter(
                      (entry) => entry.kind === 'folder'
                    )
                  }
                })
              }
            }

            if (!isSameParent) {
              modifiedPromptFolderIds.add(payload.promptFolderId)
              handles.movedPromptFolder = tx.promptFolder.update({
                id: payload.promptFolderId,
                recipe: () => {},
                persistenceFields: {
                  ...movedPromptFolder.persistenceFields,
                  folderPath: movedFolderPath,
                  previousFolderPath: movedPromptFolder.persistenceFields.folderPath
                }
              })
            }

            return handles
          })

          if (transactionOutcome.status === 'conflict') {
            const latestWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

            if (!latestWorkspace) {
              return { success: false, error: 'Workspace not loaded' }
            }

            return {
              success: false,
              conflict: true,
              payload: {
                workspace: buildWorkspaceSnapshot(latestWorkspace),
                promptFolders: [...modifiedPromptFolderIds].flatMap((promptFolderId) => {
                  const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
                  return promptFolder ? [buildPromptFolderSnapshot(promptFolder)] : []
                })
              }
            }
          }

          refreshPromptFolderTreePersistencePaths(payload.promptFolderId)

          const updatedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

          if (!updatedWorkspace) {
            return { success: false, error: 'Prompt folder move commit did not complete' }
          }

          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(updatedWorkspace),
              promptFolders: [...modifiedPromptFolderIds].flatMap((promptFolderId) => {
                const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
                return promptFolder ? [buildPromptFolderSnapshot(promptFolder)] : []
              })
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
        }
      }
    )
  })
}
