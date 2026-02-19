import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import {
  DEFAULT_WORKSPACE_PERSISTENCE,
  DEFAULT_USER_PERSISTENCE,
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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

const normalizeUserPersistence = (payload: unknown): UserPersistence => {
  if (!isRecord(payload)) {
    return { ...DEFAULT_USER_PERSISTENCE }
  }

  return {
    lastWorkspacePath:
      typeof payload.lastWorkspacePath === 'string' ? payload.lastWorkspacePath : null
  }
}

const normalizeWorkspacePersistence = (payload: unknown): WorkspacePersistence => {
  if (!isRecord(payload)) {
    return { ...DEFAULT_WORKSPACE_PERSISTENCE }
  }

  if (payload.schemaVersion === 1) {
    return { schemaVersion: 1 }
  }

  return { ...DEFAULT_WORKSPACE_PERSISTENCE }
}

const writeUserPersistence = (payload: UserPersistence): UserPersistence => {
  return writeJsonFile(resolveUserPersistencePath(), payload)
}

const writeWorkspacePersistence = (
  workspaceId: string,
  payload: WorkspacePersistence
): WorkspacePersistence => {
  return writeJsonFile(resolveWorkspacePersistencePath(workspaceId), payload)
}

const ensureBasePersistenceArtifacts = (): void => {
  const fs = getFs()
  fs.mkdirSync(resolveUserDataPath(), { recursive: true })
  fs.mkdirSync(resolveWorkspacePersistenceDirectoryPath(), { recursive: true })

  const userPersistencePath = resolveUserPersistencePath()
  if (!fs.existsSync(userPersistencePath)) {
    writeJsonFile(userPersistencePath, DEFAULT_USER_PERSISTENCE)
  }
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
      writeWorkspacePersistence(workspaceId, DEFAULT_WORKSPACE_PERSISTENCE)
    }
  }

  static readUserPersistence(): UserPersistence {
    ensureBasePersistenceArtifacts()
    const userPersistencePath = resolveUserPersistencePath()
    const normalizedPersistence = normalizeUserPersistence(readJsonFile(userPersistencePath))
    return writeUserPersistence(normalizedPersistence)
  }

  static updateLastWorkspacePath(workspacePath: string | null): UserPersistence {
    ensureBasePersistenceArtifacts()
    const currentPersistence = this.readUserPersistence()
    return writeUserPersistence({
      ...currentPersistence,
      lastWorkspacePath: workspacePath
    })
  }

  static clearLastWorkspacePath(): UserPersistence {
    return this.updateLastWorkspacePath(null)
  }

  static readWorkspacePersistence(workspaceId: string): WorkspacePersistence {
    this.ensureWorkspacePersistenceFile(workspaceId)
    const workspacePersistencePath = resolveWorkspacePersistencePath(workspaceId)
    const normalizedPersistence = normalizeWorkspacePersistence(
      readJsonFile(workspacePersistencePath)
    )
    return writeWorkspacePersistence(workspaceId, normalizedPersistence)
  }
}
