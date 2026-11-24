import { rmSync } from 'node:fs'
import { UserPersistenceDataAccess } from '../Persistence/sqlite/UserPersistenceDataAccess'
import { migrateTabSession, readTabSession, writeTabSession } from '../Persistence/sqlite/TabSessionPersistence'
import { removeCollectionFromTabSession, pruneCollectionTabViews } from '@shared/domain/ui-state/TabSession'
import { getWorkspaceCollectionEntries } from '@shared/domain/workspace/Project'
import { loadAttachedNoteUiStates } from '../Queries/AttachedNoteUiStateQuery'
import { WorkspaceStateDataAccess } from '../Persistence/sqlite/WorkspaceStateDataAccess'
import { createAttachedNoteUiStateKey } from '@shared/domain/ui-state/AttachedNoteUiState'
import { getCollectionNoteIds } from '@shared/domain/note/Note'
import { isFinalPromptStatus } from '@shared/domain/prompt/Prompt'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { getPromptCollectionCategoryIds } from '@shared/domain/prompt-collection/PromptCollection'
import type { LoadWorkspaceByPathResult } from '@shared/domain/workspace/Workspace'
import { getFs } from '../fs-provider'
import { importWorkspace } from './importWorkspace'
import { attachWorkspace, contentKinds, detachWorkspace, isManagedWorkspacePath, saveWorkspaceOrder } from '../Persistence/sqlite/WorkspaceDatabase'
import { SqliteDataAccess } from '../Persistence/sqlite/SqliteDataAccess'
import { WorkspaceUiStateDataAccess } from '../Persistence/sqlite/WorkspaceUiStateDataAccess'
import { MarkdownContentUiStateDataAccess } from '../Persistence/sqlite/MarkdownContentUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildNoteSnapshot,
  buildCategorySnapshot,
  buildPromptCollectionSnapshot,
  buildPromptTemplateSnapshot,
  buildWorkspaceSnapshot,
  getLoadedCategoryEntries,
  getLoadedPromptEntries,
  getLoadedPromptTemplateEntries
} from '../Data/DataSnapshotHelpers'

type WorkspaceLoadPayload = Omit<
  Extract<LoadWorkspaceByPathResult, { success: true }>,
  'success' | 'workspaceInfoPath'
>

const buildWorkspaceLoadPayloadFromData = async (workspaceId: string, requestedPath: string): Promise<WorkspaceLoadPayload> => {
  const workspaceEntry = data.workspace.committedStore.getEntry(workspaceId)

  if (!workspaceEntry) {
    throw new Error('Workspace data must be loaded before building workspace payload')
  }

  const promptCollections: WorkspaceLoadPayload['promptCollections'] = []
  const categories: WorkspaceLoadPayload['categories'] = []
  const prompts: WorkspaceLoadPayload['prompts'] = []
  /** Full note records are available before any editor mounts. */
  const notes: WorkspaceLoadPayload['notes'] = []
  const promptTemplates: WorkspaceLoadPayload['promptTemplates'] = []
  const workspaceSnapshot = buildWorkspaceSnapshot(workspaceEntry)
  /** Every collection ID traversed while building the workspace payload, in project order. */
  const loadedPromptCollectionIds = getWorkspaceCollectionEntries(workspaceSnapshot.data).map((entry) => entry.id)
  const loadedPromptIds: string[] = []
  const loadedPromptTemplateIds: string[] = []

  for (const promptCollectionId of loadedPromptCollectionIds) {
    const promptCollectionEntry = data.promptCollection.committedStore.getEntry(promptCollectionId)

    if (!promptCollectionEntry) {
      continue
    }

    const promptCollectionSnapshot = buildPromptCollectionSnapshot(promptCollectionEntry)
    promptCollections.push(promptCollectionSnapshot)
    for (const noteId of getCollectionNoteIds({
      get: (type, id) => data[type].committedStore.getEntry(id)?.committed as never,
      getAll: (type) => data[type].committedStore.getAllEntries().map((entry) => entry.committed) as never
    }, promptCollectionSnapshot.data)) {
      /** Note is independently revisioned even while attached. */
      const note = data.note.committedStore.getEntry(noteId)
      if (note) notes.push(buildNoteSnapshot(note))
    }

    for (const categoryEntry of getLoadedCategoryEntries(
      getPromptCollectionCategoryIds(promptCollectionSnapshot.data)
    )) {
      categories.push(buildCategorySnapshot(categoryEntry))
    }

    if (promptCollectionSnapshot.data.kind === 'template') {
      /** Template IDs in their category-view order. */
      const templateIds = getMarkdownContentIds(promptCollectionSnapshot.data, 'template')
      for (const templateEntry of getLoadedPromptTemplateEntries(templateIds)) {
        loadedPromptTemplateIds.push(templateEntry.committed.id)
        promptTemplates.push(buildPromptTemplateSnapshot(templateEntry))
      }
      continue
    }

    const promptIds = getMarkdownContentIds(promptCollectionSnapshot.data, 'prompt')
    const loadedPromptEntries = getLoadedPromptEntries(promptIds)

    loadedPromptIds.push(...loadedPromptEntries.map((promptEntry) => promptEntry.committed.id))
    for (const promptEntry of loadedPromptEntries) {
      prompts.push({
        id: promptEntry.committed.id,
        revision: promptEntry.revision,
        data: {
          id: promptEntry.committed.id,
          ...(promptEntry.committed.attachedNoteId ? { attachedNoteId: promptEntry.committed.attachedNoteId } : {}),
          title: promptEntry.committed.title,
          fallbackTitle: promptEntry.committed.fallbackTitle,
          modifiedAt: promptEntry.committed.modifiedAt,
          ...(promptEntry.committed.category !== undefined
            ? { category: promptEntry.committed.category }
            : {}),
          ...(promptEntry.committed.templates !== undefined
            ? { templates: promptEntry.committed.templates }
            : {}),
          status: promptEntry.committed.status,
          ...(isFinalPromptStatus(promptEntry.committed.status) &&
          promptEntry.committed.finalizedAt
            ? {
                finalizedAt: promptEntry.committed.finalizedAt
              }
            : {})
        }
      })
    }
  }

  // Side effect: drop stale per-collection UI state and clear invalid screen selections.
  WorkspaceUiStateDataAccess.cleanupWorkspacePromptCollectionUiState(
    workspaceId,
    loadedPromptCollectionIds,
    categories.map((category) => category.data.id),
    workspaceSnapshot.data.projects
  )
  // Side effect: remove stale editor view-state rows for content no longer in the workspace.
  MarkdownContentUiStateDataAccess.cleanupWorkspaceMarkdownContentUiState(workspaceId, [
    ...loadedPromptIds,
    ...loadedPromptTemplateIds
  ])

  // Convert legacy navigation only after collection ownership has been loaded and repaired.
  migrateTabSession(workspaceId, promptCollections.map((entry) => entry.data), requestedPath)
  /** Existing tabs whose collections disappeared externally return to their New Tab screens. */
  const session = readTabSession(workspaceId)
  if (session) {
    for (const id of new Set([...Object.keys(session.lastClosedCollections), ...session.tabs.flatMap((tab) => tab.collectionId ?? [])])) {
      if (!loadedPromptCollectionIds.includes(id)) removeCollectionFromTabSession(session, id)
    }
    for (const { data: collection } of promptCollections) {
      pruneCollectionTabViews(session, collection.id, getPromptCollectionCategoryIds(collection), getMarkdownContentIds(collection), notes.map((note) => note.id))
    }
    writeTabSession(session)
  }

  /** Live attachment identities prune preferences left by external deletes or detachments. */
  const attachedNoteIds = new Set(notes.filter((note) => note.data.kind === 'attached').map((note) => note.id))
  /** Each saved identity is checked against the workspace's current attachments. */
  for (const noteId of WorkspaceStateDataAccess.listEntityIds(workspaceId, 'attached-note')) {
    if (attachedNoteIds.has(noteId)) continue
    WorkspaceStateDataAccess.delete(workspaceId, 'attached-note', noteId)
    data.attachedNoteUiState.committedStore.remove(createAttachedNoteUiStateKey(workspaceId, noteId))
  }

  return {
    workspace: workspaceSnapshot,
    promptCollections,
    categories,
    notes,
    attachedNoteUiStates: await loadAttachedNoteUiStates(workspaceId, [...attachedNoteIds]),
    prompts,
    promptTemplates
  }
}

/** Hydrates authoritative records from the selected file, migrating a remembered legacy path on first open. */
export const loadWorkspaceByPath = async (requestedPath: string): Promise<LoadWorkspaceByPathResult> => {
  /** A failed automatic restore must release its new filename for a retry. */
  let imported: string | undefined
  try {
    if (!isManagedWorkspacePath(requestedPath)) {
      /** Only a remembered v8 path participates in automatic migration. */
      const remembered = UserPersistenceDataAccess.readUserPersistence().lastWorkspaceInfoPath
      if (requestedPath !== remembered || !getFs().existsSync(requestedPath)) throw new Error('Invalid workspace path')
      imported = importWorkspace(requestedPath)
    }
    /** Remember the managed database once the workspace has loaded successfully. */
    const workspaceInfoPath = imported ?? requestedPath
    /** Stable identity used to look up the existing machine-specific state. */
    const { id } = attachWorkspace(workspaceInfoPath)
    await data.workspace.loadDataFromPersistence(id, {})
    /** One query per entity kind hydrates all committed stores for this workspace. */
    const db = SqliteDataAccess.getDatabase()
    for (const kind of contentKinds) {
      /** Each domain record retains the ID stored in the v8 source. */
      const rows = db.prepare('SELECT id, data FROM content.records WHERE kind = ?').all(kind) as { id: string; data: string }[]
      for (const row of rows) data[kind].committedStore.setFromDisk(row.id, JSON.parse(row.data), {})
    }
    SqliteDataAccess.runTransaction(() => saveWorkspaceOrder(data.workspace.committedStore.getEntry(id)!.committed))
    /** Reconcile saved tabs and local preferences using the original request path. */
    const payload = await buildWorkspaceLoadPayloadFromData(id, requestedPath)
    if (imported) {
      UserPersistenceDataAccess.updateUserPersistence({ ...UserPersistenceDataAccess.readUserPersistence(), lastWorkspaceInfoPath: imported })
    }
    return { success: true, workspaceInfoPath, ...payload }
  } catch (error) {
    detachWorkspace()
    if (imported) rmSync(imported)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
