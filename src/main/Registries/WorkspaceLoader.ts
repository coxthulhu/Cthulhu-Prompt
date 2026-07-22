import * as path from 'path'
import { PromptStatus } from '@shared/Prompt'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import {
  readAllPromptFolders,
  readPromptStemByPromptId,
  readPromptTemplateStemById,
  readWorkspaceInfo
} from '../DataAccess/WorkspaceReads'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  buildWorkspaceSnapshot,
  collectLoadedPromptFolderDescendantIds,
  getLoadedPromptEntries,
  getLoadedPromptTemplateEntries
} from '../Data/DataSnapshotHelpers'
import {
  isWorkspaceInfoPath,
  PROMPTS_DIRECTORY_NAME,
  TEMPLATES_DIRECTORY_NAME,
  resolveCompletedPromptFolderName,
  resolveWorkspacePathFromInfoPath
} from '../Persistence/PromptPersistencePaths'

type WorkspaceLoadPayload = Omit<Extract<LoadWorkspaceByPathResult, { success: true }>, 'success'>

const resolveLoadedPromptFolderPath = (
  promptFolderId: string,
  promptFolderById: Map<string, { folderName: string }>,
  parentPromptFolderIdById: ReadonlyMap<string, string | null>
): string => {
  const promptFolder = promptFolderById.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const parentPromptFolderId = parentPromptFolderIdById.get(promptFolderId) ?? null
  if (parentPromptFolderId === null) {
    return promptFolder.folderName
  }

  return path.join(
    resolveLoadedPromptFolderPath(parentPromptFolderId, promptFolderById, parentPromptFolderIdById),
    promptFolder.folderName
  )
}

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
  const prompts: WorkspaceLoadPayload['prompts'] = []
  const promptTemplates: WorkspaceLoadPayload['promptTemplates'] = []
  const workspaceSnapshot = buildWorkspaceSnapshot(workspaceEntry)
  const loadedPromptFolderIds = workspaceSnapshot.data.entries.flatMap((entry) => [
    entry.id,
    ...collectLoadedPromptFolderDescendantIds(entry.id)
  ])
  const loadedPromptTemplateFolderIds = workspaceSnapshot.data.templateEntries.flatMap((entry) => [
    entry.id,
    ...collectLoadedPromptFolderDescendantIds(entry.id)
  ])
  const loadedPromptIds: string[] = []

  for (const promptFolderId of [...loadedPromptFolderIds, ...loadedPromptTemplateFolderIds]) {
    const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

    if (!promptFolderEntry) {
      continue
    }

    const promptFolderSnapshot = buildPromptFolderSnapshot(promptFolderEntry)
    promptFolders.push(promptFolderSnapshot)

    if (promptFolderSnapshot.data.kind === 'template') {
      const templateIds = promptFolderSnapshot.data.entries
        .filter((entry) => entry.kind === 'template')
        .map((entry) => entry.id)
      for (const templateEntry of getLoadedPromptTemplateEntries(templateIds)) {
        promptTemplates.push({
          id: templateEntry.committed.id,
          revision: templateEntry.revision,
          data: {
            id: templateEntry.committed.id,
            title: templateEntry.committed.title,
            fallbackTitle: templateEntry.committed.fallbackTitle,
            modifiedAt: templateEntry.committed.modifiedAt
          }
        })
      }
      continue
    }

    const promptIds = [
      ...promptFolderSnapshot.data.entries
        .filter((entry) => entry.kind === 'prompt')
        .map((entry) => entry.id),
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
  UserPersistenceDataAccess.cleanupWorkspacePromptFolderUiState(workspaceId, loadedPromptFolderIds)
  // Side effect: remove stale prompt editor view-state rows for prompts no longer in the workspace.
  PromptUiStateDataAccess.cleanupWorkspacePromptUiState(workspaceId, loadedPromptIds)

  return {
    workspace: workspaceSnapshot,
    promptFolders,
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
  const promptFolderById = new Map(
    allPromptFolders.map((promptFolder) => [promptFolder.id, promptFolder])
  )

  // Side effect: hydrate workspace into the new committed data store.
  await data.workspace.loadDataFromPersistence(workspaceId, { workspacePath, workspaceInfoPath })

  const workspace = data.workspace.committedStore.getEntry(workspaceId)?.committed
  if (!workspace) throw new Error('Workspace data not loaded')

  const treeIndex = new Map([
    ...buildPromptFolderTreeIndex(workspace, promptFolders),
    ...buildPromptFolderTreeIndex(
      { id: workspace.id, entries: workspace.templateEntries },
      promptTemplateFolders
    )
  ])
  const parentPromptFolderIdById = new Map(
    [...treeIndex].map(([promptFolderId, location]) => [
      promptFolderId,
      location.parentPromptFolderId
    ])
  )
  const promptFolderPathById = new Map(
    allPromptFolders.map((promptFolder) => [
      promptFolder.id,
      resolveLoadedPromptFolderPath(promptFolder.id, promptFolderById, parentPromptFolderIdById)
    ])
  )

  // Side effect: hydrate all prompt folders before loading prompt records.
  await Promise.all(
    allPromptFolders.map((promptFolder) =>
      data.promptFolder.loadDataFromPersistence(promptFolder.id, {
        workspaceId,
        workspacePath,
        folderName: promptFolder.folderName,
        folderPath: promptFolderPathById.get(promptFolder.id) ?? promptFolder.folderName,
        kind: promptFolder.kind
      })
    )
  )

  const promptLoadTasks = promptFolders.flatMap((promptFolder) => {
    const folderPath = promptFolderPathById.get(promptFolder.id) ?? promptFolder.folderName
    const promptStemByPromptId = readPromptStemByPromptId(workspacePath, folderPath)
    const completedFolderPath = resolveCompletedPromptFolderName(folderPath)
    const completedPromptStemByPromptId = readPromptStemByPromptId(
      workspacePath,
      completedFolderPath
    )

    return [
      ...[
        ...promptFolder.entries.flatMap((entry) =>
          entry.kind === 'prompt' ? [{ promptId: entry.id, isCompleted: false }] : []
        ),
        ...promptFolder.completedPromptIds.map((promptId) => ({ promptId, isCompleted: true }))
      ].flatMap(({ promptId, isCompleted }) => {
        const persistedFolderPath = isCompleted ? completedFolderPath : folderPath
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
    const folderPath = promptFolderPathById.get(promptFolder.id) ?? promptFolder.folderName
    const templateStemById = readPromptTemplateStemById(workspacePath, folderPath)

    return promptFolder.entries.flatMap((entry) => {
      if (entry.kind !== 'template') return []
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
