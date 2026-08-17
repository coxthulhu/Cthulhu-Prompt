import * as path from 'path'
import { PromptStatus } from '@shared/Prompt'
import { getCategoryOrderCategoryIds } from '@shared/PromptFolder'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import {
  readAllPromptFolders,
  readCategoryStemById,
  readPromptStemByPromptId,
  readPromptTemplateStemById,
  readWorkspaceInfo
} from '../DataAccess/WorkspaceReads'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildCategorySnapshot,
  buildPromptFolderSnapshot,
  buildPromptTemplateSnapshot,
  buildWorkspaceSnapshot,
  getLoadedCategoryEntries,
  getLoadedPromptEntries,
  getLoadedPromptTemplateEntries
} from '../Data/DataSnapshotHelpers'
import {
  isWorkspaceInfoPath,
  PROMPTS_DIRECTORY_NAME,
  TEMPLATES_DIRECTORY_NAME,
  resolveActivePromptFolderName,
  resolveCompletedPromptFolderName,
  resolveWorkspacePathFromInfoPath
} from '../Persistence/PromptPersistencePaths'

type WorkspaceLoadPayload = Omit<Extract<LoadWorkspaceByPathResult, { success: true }>, 'success'>

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

const buildWorkspaceLoadPayloadFromData = (workspaceId: string): WorkspaceLoadPayload => {
  const workspaceEntry = data.workspace.committedStore.getEntry(workspaceId)

  if (!workspaceEntry) {
    throw new Error('Workspace data must be loaded before building workspace payload')
  }

  const promptFolders: WorkspaceLoadPayload['promptFolders'] = []
  const categories: WorkspaceLoadPayload['categories'] = []
  const prompts: WorkspaceLoadPayload['prompts'] = []
  const promptTemplates: WorkspaceLoadPayload['promptTemplates'] = []
  const workspaceSnapshot = buildWorkspaceSnapshot(workspaceEntry)
  const loadedPromptFolderIds = workspaceSnapshot.data.entries.map((entry) => entry.id)
  const loadedPromptIds: string[] = []
  const loadedPromptTemplateIds: string[] = []

  for (const promptFolderId of loadedPromptFolderIds) {
    const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

    if (!promptFolderEntry) {
      continue
    }

    const promptFolderSnapshot = buildPromptFolderSnapshot(promptFolderEntry)
    promptFolders.push(promptFolderSnapshot)

    for (const categoryEntry of getLoadedCategoryEntries(
      getCategoryOrderCategoryIds(promptFolderSnapshot.data.categoryOrder)
    )) {
      categories.push(buildCategorySnapshot(categoryEntry))
    }

    if (promptFolderSnapshot.data.kind === 'template') {
      /** Template IDs in their category-view order. */
      const templateIds = promptFolderSnapshot.data.categoryOrder.categories.flatMap(
        (category) => category.entries.map((entry) => entry.id)
      )
      for (const templateEntry of getLoadedPromptTemplateEntries(templateIds)) {
        loadedPromptTemplateIds.push(templateEntry.committed.id)
        promptTemplates.push(buildPromptTemplateSnapshot(templateEntry))
      }
      continue
    }

    const promptIds = [
      ...promptFolderSnapshot.data.categoryOrder.categories.flatMap((category) =>
        category.entries.map((entry) => entry.id)
      ),
      ...promptFolderSnapshot.data.completedPromptIds
    ]
    const loadedPromptEntries = getLoadedPromptEntries(promptIds)

    loadedPromptIds.push(...loadedPromptEntries.map((promptEntry) => promptEntry.committed.id))
    for (const promptEntry of loadedPromptEntries) {
      prompts.push({
        id: promptEntry.committed.id,
        revision: promptEntry.revision,
        data: {
          id: promptEntry.committed.id,
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
          ...(promptEntry.committed.status === PromptStatus.Completed &&
          promptEntry.committed.completedAt
            ? {
                completedAt: promptEntry.committed.completedAt
              }
            : {})
        }
      })
    }
  }

  // Side effect: drop stale per-folder UI state and clear invalid screen selections.
  UserPersistenceDataAccess.cleanupWorkspacePromptFolderViewState(
    workspaceId,
    loadedPromptFolderIds,
    categories.map((category) => category.data.id)
  )
  // Side effect: remove stale editor view-state rows for content no longer in the workspace.
  MarkdownContentUiStateDataAccess.cleanupWorkspaceMarkdownContentUiState(workspaceId, [
    ...loadedPromptIds,
    ...loadedPromptTemplateIds
  ])

  return {
    workspace: workspaceSnapshot,
    promptFolders,
    categories,
    prompts,
    promptTemplates
  }
}

const loadWorkspaceDataIntoNewDataLayer = async (workspaceInfoPath: string): Promise<string> => {
  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  const workspaceId = readWorkspaceInfo(workspaceInfoPath).workspaceId
  const promptFolders = readAllPromptFolders(workspacePath)
  const promptTemplateFolders = readAllPromptFolders(workspacePath, 'template')
  const allPromptFolders = [...promptFolders, ...promptTemplateFolders]

  // Side effect: hydrate workspace into the new committed data store.
  await data.workspace.loadDataFromPersistence(workspaceId, { workspacePath, workspaceInfoPath })

  const workspace = data.workspace.committedStore.getEntry(workspaceId)?.committed
  if (!workspace) throw new Error('Workspace data not loaded')

  // Side effect: hydrate all prompt folders before loading prompt records.
  await Promise.all(
    allPromptFolders.map((promptFolder) =>
      data.promptFolder.loadDataFromPersistence(promptFolder.id, {
        workspaceId,
        workspacePath,
        folderName: promptFolder.folderName,
        folderPath: promptFolder.folderName,
        kind: promptFolder.kind
      })
    )
  )

  /** Category load tasks hydrate records owned by root prompt and template folders. */
  const categoryLoadTasks = allPromptFolders.flatMap((promptFolder) => {
    /** Root folder name used by category persistence. */
    const rootFolderName = promptFolder.folderName
    const categoryStemById = readCategoryStemById(workspacePath, rootFolderName, promptFolder.kind)
    return getCategoryOrderCategoryIds(promptFolder.categoryOrder).flatMap((categoryId) => {
      const categoryStem = categoryStemById.get(categoryId)
      if (!categoryStem) return []
      return [
        data.category.loadDataFromPersistence(categoryId, {
          workspaceId,
          workspacePath,
          rootPromptFolderId: promptFolder.id,
          rootFolderName,
          kind: promptFolder.kind,
          categoryStem,
          needsFilenameIdSuffix: categoryStem.endsWith(`-${categoryId.slice(0, 8)}`)
        })
      ]
    })
  })

  // Side effect: hydrate root-owned categories before constructing workspace snapshots.
  await Promise.all(categoryLoadTasks)

  const promptLoadTasks = promptFolders.flatMap((promptFolder) => {
    const folderPath = promptFolder.folderName
    const activeFolderPath = resolveActivePromptFolderName(folderPath, promptFolder.kind)
    const promptStemByPromptId = readPromptStemByPromptId(workspacePath, activeFolderPath)
    const completedFolderPath = resolveCompletedPromptFolderName(folderPath, promptFolder.kind)
    const completedPromptStemByPromptId = readPromptStemByPromptId(
      workspacePath,
      completedFolderPath
    )

    return [
      ...[
        ...promptFolder.categoryOrder.categories.flatMap((category) =>
          category.entries.map((entry) => ({ promptId: entry.id, isCompleted: false }))
        ),
        ...promptFolder.completedPromptIds.map((promptId) => ({ promptId, isCompleted: true }))
      ].flatMap(({ promptId, isCompleted }) => {
        const persistedFolderPath = isCompleted ? completedFolderPath : activeFolderPath
        const stems = isCompleted ? completedPromptStemByPromptId : promptStemByPromptId
        if (!stems.has(promptId)) return []
        const promptStem = stems.get(promptId) ?? promptId
        return [
          data.prompt.loadDataFromPersistence(promptId, {
            workspaceId,
            workspacePath,
            folderPath: persistedFolderPath,
            promptFolderId: promptFolder.id,
            promptId,
            promptStem,
            needsFilenameIdSuffix: promptStem.endsWith(`-${promptId.slice(0, 8)}`)
          })
        ]
      })
    ]
  })

  // Side effect: hydrate all prompts only after prompt folder loads complete.
  await Promise.all(promptLoadTasks)

  const promptTemplateLoadTasks = promptTemplateFolders.flatMap((promptFolder) => {
    const folderPath = promptFolder.folderName
    const templateStemById = readPromptTemplateStemById(workspacePath, folderPath)

    return promptFolder.categoryOrder.categories.flatMap((category) => category.entries).flatMap((entry) => {
      const templateStem = templateStemById.get(entry.id)
      if (!templateStem) return []

      return [
        data.promptTemplate.loadDataFromPersistence(entry.id, {
          workspaceId,
          workspacePath,
          folderPath,
          promptFolderId: promptFolder.id,
          promptId: entry.id,
          promptStem: templateStem,
          needsFilenameIdSuffix: templateStem.endsWith(`-${entry.id.slice(0, 8)}`)
        })
      ]
    })
  })

  // Side effect: hydrate all prompt templates only after template folder loads complete.
  await Promise.all(promptTemplateLoadTasks)

  return workspaceId
}

export const loadWorkspaceByPath = async (
  workspaceInfoPath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    if (!isWorkspaceInfoPathValid(workspaceInfoPath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const workspaceId = await loadWorkspaceDataIntoNewDataLayer(workspaceInfoPath)
    const payload = buildWorkspaceLoadPayloadFromData(workspaceId)

    return {
      success: true,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
