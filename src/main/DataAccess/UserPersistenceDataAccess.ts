import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import type { UserPersistence, WorkspacePersistence } from '@shared/UserPersistence'

const USER_PERSISTENCE_FILENAME = 'UserPersistence.json'
const WORKSPACE_PERSISTENCE_DIRECTORY_NAME = 'WorkspacePersistence'

const resolveUserDataPath = (): string => {
  return app.getPath('userData')
}

const resolveUserPersistencePath = (): string => {
  return path.join(resolveUserDataPath(), USER_PERSISTENCE_FILENAME)
}

const resolveWorkspacePersistenceDirectoryPath = (): string => {
  return path.join(resolveUserDataPath(), WORKSPACE_PERSISTENCE_DIRECTORY_NAME)
}

const resolveWorkspacePersistencePath = (workspaceId: string): string => {
  return path.join(resolveWorkspacePersistenceDirectoryPath(), `${workspaceId}.json`)
}

const writeEmptyPersistencePayload = (filePath: string): Record<string, unknown> => {
  const fs = getFs()
  const payload: Record<string, unknown> = {}
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

const ensureBasePersistenceArtifacts = (): void => {
  const fs = getFs()
  fs.mkdirSync(resolveUserDataPath(), { recursive: true })
  fs.mkdirSync(resolveWorkspacePersistenceDirectoryPath(), { recursive: true })

  const userPersistencePath = resolveUserPersistencePath()
  if (!fs.existsSync(userPersistencePath)) {
    writeEmptyPersistencePayload(userPersistencePath)
  }
}

const readPersistencePayload = (filePath: string): Record<string, unknown> => {
  const fs = getFs()

  if (!fs.existsSync(filePath)) {
    return writeEmptyPersistencePayload(filePath)
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Side effect: invalid JSON is auto-healed to an empty object.
  }

  return writeEmptyPersistencePayload(filePath)
}

export class UserPersistenceDataAccess {
  static initializePersistenceArtifacts(): void {
    ensureBasePersistenceArtifacts()
  }

  static ensureWorkspacePersistenceFile(workspaceId: string): void {
    ensureBasePersistenceArtifacts()

    const fs = getFs()
    const workspacePersistencePath = resolveWorkspacePersistencePath(workspaceId)
    if (!fs.existsSync(workspacePersistencePath)) {
      writeEmptyPersistencePayload(workspacePersistencePath)
    }
  }

  static readUserPersistence(): UserPersistence {
    ensureBasePersistenceArtifacts()
    return readPersistencePayload(resolveUserPersistencePath())
  }

  static readWorkspacePersistence(workspaceId: string): WorkspacePersistence {
    this.ensureWorkspacePersistenceFile(workspaceId)
    return readPersistencePayload(resolveWorkspacePersistencePath(workspaceId))
  }
}
