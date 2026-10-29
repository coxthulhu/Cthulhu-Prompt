import { readNoteFiles } from '../Persistence/workspace/NoteReads'
import { loadAttachedNoteUiStates } from '../Queries/AttachedNoteUiStateQuery'
import { WorkspaceStateDataAccess } from '../Persistence/sqlite/WorkspaceStateDataAccess'
import { createAttachedNoteUiStateKey } from '@shared/domain/ui-state/AttachedNoteUiState'
import { getCollectionNoteIds } from '@shared/domain/note/Note'
import * as path from 'path'
import { getContentStatusFolders, isFinalPromptStatus } from '@shared/domain/prompt/Prompt'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import {
  getPromptCollectionCategoryIds,
  type PromptContentCollection,
  type PromptTemplateCollection
} from '@shared/domain/prompt-collection/PromptCollection'
import type { LoadWorkspaceByPathResult } from '@shared/domain/workspace/Workspace'
import { isWorkspaceRootPath } from '@shared/domain/workspace/workspacePath'
import { getFs } from '../fs-provider'
import {
  readAllPromptCollections,
  readCategoryStemById,
  readPromptStemByPromptId,
  readPromptTemplateStemById,
  readWorkspaceInfo
} from '../Persistence/workspace/WorkspaceReads'
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
import {
  isWorkspaceInfoPath,
  migrateLegacyWorkspaceInfoPath,
  PROMPTS_DIRECTORY_NAME,
  TEMPLATES_DIRECTORY_NAME,
  resolvePromptStatusFolderName,
  resolveWorkspacePathFromInfoPath
} from '../Persistence/PromptPersistencePaths'
import { applyWorkspaceMigrations } from '../Persistence/workspace/WorkspaceMigrations'

type WorkspaceLoadPayload = Omit<
  Extract<LoadWorkspaceByPathResult, { success: true }>,
  'success' | 'workspaceInfoPath'
>

const isWorkspaceInfoPathValid = (workspaceInfoPath: string): boolean => {
  if (!isWorkspaceInfoPath(workspaceInfoPath)) {
    return false
  }

  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  if (isWorkspaceRootPath(workspacePath)) {
    return false
  }

  const fs = getFs()
  return (
    fs.existsSync(workspaceInfoPath) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_DIRECTORY_NAME)) &&
    fs.existsSync(path.join(workspacePath, TEMPLATES_DIRECTORY_NAME))
  )
}

const buildWorkspaceLoadPayloadFromData = async (workspaceId: string): Promise<WorkspaceLoadPayload> => {
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
  /** Task-prompt collection IDs loaded in their type-owned order. */
  const loadedPromptTaskCollectionIds = workspaceSnapshot.data.promptCollectionEntries.map(
    (entry) => entry.id
  )
  /** Prompt-template collection IDs loaded in their type-owned order. */
  const loadedPromptTemplateCollectionIds = workspaceSnapshot.data.templateCollectionEntries.map(
    (entry) => entry.id
  )
  /** Every collection ID traversed while building the workspace payload. */
  const loadedPromptCollectionIds = [
    ...loadedPromptTaskCollectionIds,
    ...loadedPromptTemplateCollectionIds
  ]
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
    loadedPromptTaskCollectionIds,
    loadedPromptTemplateCollectionIds,
    categories.map((category) => category.data.id)
  )
  // Side effect: remove stale editor view-state rows for content no longer in the workspace.
  MarkdownContentUiStateDataAccess.cleanupWorkspaceMarkdownContentUiState(workspaceId, [
    ...loadedPromptIds,
    ...loadedPromptTemplateIds
  ])

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

const loadWorkspaceDataIntoNewDataLayer = async (workspaceInfoPath: string): Promise<string> => {
  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  const workspaceId = readWorkspaceInfo(workspaceInfoPath).workspaceId
  const promptCollections = readAllPromptCollections(workspacePath).filter(
    (collection): collection is PromptContentCollection => collection.kind === 'prompt'
  )
  const promptTemplateCollections = readAllPromptCollections(workspacePath, 'template').filter(
    (collection): collection is PromptTemplateCollection => collection.kind === 'template'
  )
  const allPromptCollections = [...promptCollections, ...promptTemplateCollections]

  // Side effect: hydrate workspace into the new committed data store.
  await data.workspace.loadDataFromPersistence(workspaceId, { workspacePath, workspaceInfoPath })

  const workspace = data.workspace.committedStore.getEntry(workspaceId)?.committed
  if (!workspace) throw new Error('Workspace data not loaded')

  // Side effect: hydrate all prompt collections before loading prompt records.
  await Promise.all(
    allPromptCollections.map((promptCollection) =>
      data.promptCollection.loadDataFromPersistence(promptCollection.id, {
        workspaceId,
        workspacePath,
        folderName: promptCollection.folderName,
        folderPath: promptCollection.folderName,
        kind: promptCollection.kind
      })
    )
  )

  /** Category load tasks hydrate records owned by collection prompt and template collections. */
  const categoryLoadTasks = allPromptCollections.flatMap((promptCollection) => {
    /** collection name used by category persistence. */
    const collectionFolderName = promptCollection.folderName
    const categoryStemById = readCategoryStemById(workspacePath, collectionFolderName, promptCollection.kind)
    return getPromptCollectionCategoryIds(promptCollection).flatMap((categoryId) => {
      const categoryStem = categoryStemById.get(categoryId)
      if (!categoryStem) return []
      return [
        data.category.loadDataFromPersistence(categoryId, {
          workspaceId,
          workspacePath,
          promptCollectionId: promptCollection.id,
          collectionFolderName,
          kind: promptCollection.kind,
          categoryStem,
        })
      ]
    })
  })

  // Side effect: hydrate collection-owned categories before constructing workspace snapshots.
  await Promise.all(categoryLoadTasks)

  const promptLoadTasks = promptCollections.flatMap((promptCollection) => {
    return Object.entries(promptCollection.statusFolders).flatMap(
      ([statusFolderId, layout]) => {
        /** Physical directory selected by one stable prompt status-folder identity. */
        const persistedFolderPath = resolvePromptStatusFolderName(
          promptCollection.folderName,
          statusFolderId as import('@shared/domain/prompt/Prompt').PromptStatusFolderId
        )
        /** Persisted prompt stems discovered within this exact status folder. */
        const stems = readPromptStemByPromptId(workspacePath, persistedFolderPath)
        /** Prompt IDs represented by ordered groups or the unordered layout list. */
        const promptIds =
          layout.ordering === 'category'
            ? layout.categoryOrder.categories.flatMap((category) =>
                category.entries.map((entry) => entry.id)
              )
            : layout.promptIds
        return promptIds.flatMap((promptId) => {
        if (!stems.has(promptId)) return []
        const promptStem = stems.get(promptId) ?? promptId
        return [
          data.prompt.loadDataFromPersistence(promptId, {
            workspaceId,
            workspacePath,
            folderPath: persistedFolderPath,
            promptCollectionId: promptCollection.id,
            promptId,
            promptStem,
          })
        ]
        })
      }
    )
  })

  // Side effect: hydrate all prompts only after prompt collection loads complete.
  await Promise.all(promptLoadTasks)

  const promptTemplateLoadTasks = promptTemplateCollections.flatMap((promptCollection) =>
    getContentStatusFolders('template').flatMap((group) => {
      /** Physical template directory and its discovered stable IDs. */
      const folderPath = resolvePromptStatusFolderName(promptCollection.folderName, group.id)
      /** Filenames used to hydrate both active and archived templates. */
      const stems = readPromptTemplateStemById(workspacePath, folderPath)
      return [...stems].map(([templateId, templateStem]) =>
        data.promptTemplate.loadDataFromPersistence(templateId, {
          workspaceId, workspacePath, folderPath,
          promptCollectionId: promptCollection.id,
          promptId: templateId,
          promptStem: templateStem,
        })
      )
    })
  )

  // Side effect: hydrate all prompt templates only after template collection loads complete.
  await Promise.all(promptTemplateLoadTasks)

  // Hydrate note files after their owners so unattached minimal files are not mistaken for standalone entries.
  for (const collection of allPromptCollections) {
    for (const group of getContentStatusFolders(collection.kind)) {
      /** Physical folder supplies collection/status ownership independently of the extension. */
      const folderPath = resolvePromptStatusFolderName(collection.folderName, group.id)
      for (const { stem, note } of readNoteFiles(workspacePath, folderPath, collection.kind)) {
        if (note.kind === 'attached' && ![...data.prompt.committedStore.getAllEntries(), ...data.promptTemplate.committedStore.getAllEntries()]
          .some((entry) => entry.persistenceFields.promptCollectionId === collection.id && entry.committed.attachedNoteId === note.id)) continue
        await data.note.loadDataFromPersistence(note.id, {
          workspaceId, workspacePath, collectionKind: collection.kind,
          promptCollectionId: collection.id, folderPath, promptId: note.id, promptStem: stem
        })
      }
    }
  }

  return workspaceId
}

export const loadWorkspaceByPath = async (
  requestedWorkspaceInfoPath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    /** Info path after renaming a pre-rename .cthulhuprompt.json file to .cthulhuprompt. */
    const workspaceInfoPath = migrateLegacyWorkspaceInfoPath(requestedWorkspaceInfoPath)
    if (!isWorkspaceInfoPathValid(workspaceInfoPath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    applyWorkspaceMigrations(workspaceInfoPath)
    const workspaceId = await loadWorkspaceDataIntoNewDataLayer(workspaceInfoPath)
    const payload = await buildWorkspaceLoadPayloadFromData(workspaceId)

    return {
      success: true,
      workspaceInfoPath,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
