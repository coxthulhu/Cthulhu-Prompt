import type { Workspace } from '@shared/Workspace'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { readPromptFolders, readWorkspaceId } from '../DataAccess/WorkspaceReads'
import type { PersistenceLayer } from './PersistenceTypes'

export type WorkspacePersistenceFields = {
  workspacePath: string
}

type WorkspaceStagedChange =
  | {
      type: 'upsert'
      targetPath: string
      tempPath: string
    }
  | {
      type: 'remove'
      targetPath: string
    }

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'

const resolveTargetPath = (workspacePath: string): string => {
  return path.join(workspacePath, WORKSPACE_INFO_FILENAME)
}

const resolveTempPath = (targetPath: string): string => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${targetPath}.${uniqueSuffix}.tmp`
}

const writeWorkspaceInfoFile = (workspaceInfoPath: string, workspaceId: string): void => {
  const fs = getFs()
  fs.writeFileSync(workspaceInfoPath, JSON.stringify({ workspaceId }, null, 2), 'utf8')
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  stageChanges: async (change) => {
    const targetPath = resolveTargetPath(change.persistenceFields.workspacePath)

    if (change.type === 'remove') {
      return {
        type: 'remove',
        targetPath
      }
    }

    const tempPath = resolveTempPath(targetPath)
    writeWorkspaceInfoFile(tempPath, change.data.id)

    return {
      type: 'upsert',
      targetPath,
      tempPath
    }
  },
  commitChanges: async (stagedChange) => {
    const typedStagedChange = stagedChange as WorkspaceStagedChange
    const fs = getFs()

    if (typedStagedChange.type === 'remove') {
      if (fs.existsSync(typedStagedChange.targetPath)) {
        fs.rmSync(typedStagedChange.targetPath)
      }
      return
    }

    // Side effect: replace the workspace info file atomically using delete + rename.
    if (fs.existsSync(typedStagedChange.targetPath)) {
      fs.rmSync(typedStagedChange.targetPath)
    }
    fs.renameSync(typedStagedChange.tempPath, typedStagedChange.targetPath)
  },
  revertChanges: async (stagedChange) => {
    const typedStagedChange = stagedChange as WorkspaceStagedChange

    if (typedStagedChange.type !== 'upsert') {
      return
    }

    const fs = getFs()
    if (fs.existsSync(typedStagedChange.tempPath)) {
      fs.rmSync(typedStagedChange.tempPath)
    }
  },
  loadData: async (persistenceFields) => {
    const { workspacePath } = persistenceFields
    const workspaceId = readWorkspaceId(workspacePath)
    const promptFolders = readPromptFolders(workspacePath)

    return {
      id: workspaceId,
      workspacePath,
      promptFolderIds: promptFolders.map((promptFolder) => promptFolder.id)
    }
  }
}
