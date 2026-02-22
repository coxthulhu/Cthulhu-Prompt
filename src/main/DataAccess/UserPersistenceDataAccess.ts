import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import {
  DEFAULT_WORKSPACE_PERSISTENCE,
  DEFAULT_USER_PERSISTENCE,
  parseUserPersistence,
  parseWorkspacePersistence,
  type UserPersistence,
  type WorkspacePersistence
} from '@shared/UserPersistence'

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

const writeJsonFile = <TPayload extends object>(
  filePath: string,
  payload: TPayload
): TPayload => {
  const fs = getFs()
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

const readJsonFile = (filePath: string): unknown | null => {
  const fs = getFs()

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

const ensureJsonFile = <TPayload extends object>(filePath: string, initialValue: TPayload): void => {
  const fs = getFs()
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, initialValue)
  }
}

const ensureBasePersistenceArtifacts = (): void => {
  const fs = getFs()
  fs.mkdirSync(resolveUserDataPath(), { recursive: true })
  fs.mkdirSync(resolveWorkspacePersistenceDirectoryPath(), { recursive: true })

  ensureJsonFile(resolveUserPersistencePath(), DEFAULT_USER_PERSISTENCE)
}

export class UserPersistenceDataAccess {
  static initializePersistenceArtifacts(): void {
    ensureBasePersistenceArtifacts()
  }

  static ensureWorkspacePersistenceFile(workspaceId: string): void {
    ensureBasePersistenceArtifacts()
    ensureJsonFile(resolveWorkspacePersistencePath(workspaceId), DEFAULT_WORKSPACE_PERSISTENCE)
  }

  static readUserPersistence(): UserPersistence {
    ensureBasePersistenceArtifacts()
    const parsedPersistence = parseUserPersistence(readJsonFile(resolveUserPersistencePath()))
    return parsedPersistence ?? DEFAULT_USER_PERSISTENCE
  }

  static updateUserPersistence(userPersistence: UserPersistence): UserPersistence {
    ensureBasePersistenceArtifacts()
    return writeJsonFile(resolveUserPersistencePath(), {
      lastWorkspacePath: userPersistence.lastWorkspacePath,
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx),
      promptOutlinerWidthPx: Math.round(userPersistence.promptOutlinerWidthPx)
    })
  }

  static updateLastWorkspacePath(workspacePath: string | null): UserPersistence {
    const currentPersistence = this.readUserPersistence()
    return this.updateUserPersistence({
      ...currentPersistence,
      lastWorkspacePath: workspacePath
    })
  }

  static clearLastWorkspacePath(): UserPersistence {
    return this.updateLastWorkspacePath(null)
  }

  static readWorkspacePersistence(workspaceId: string): WorkspacePersistence {
    this.ensureWorkspacePersistenceFile(workspaceId)
    const parsedPersistence = parseWorkspacePersistence(
      readJsonFile(resolveWorkspacePersistencePath(workspaceId))
    )
    return parsedPersistence ?? DEFAULT_WORKSPACE_PERSISTENCE
  }
}
