import { getFs } from '../fs-provider'
import * as path from 'path'

export type FilePersistenceStagedChange =
  | {
      type: 'upsert'
      targetPath: string
      tempPath: string
    }
  | {
      type: 'remove'
      targetPath: string
    }
  | {
      type: 'removeDirectory'
      targetPath: string
    }
  | {
      type: 'ensureDirectory'
      targetPath: string
      createdDuringStage: boolean
    }
  | {
      type: 'renameDirectory'
      sourcePath: string
      targetPath: string
    }

/** Captures affected destinations so a partial multi-file commit can restore original bytes and times. */
export const captureFileRollback = (changes: readonly FilePersistenceStagedChange[]): (() => void) => {
  /** Filesystem shared by staging and synchronous commit. */
  const fs = getFs()
  /** Existing files and directories, including descendants of removed or renamed collections. */
  const originals = new Map<string, { content: Buffer | null; atime: Date; mtime: Date }>()
  /** Paths the commit may replace, create, remove, or relocate. */
  const roots = new Set(changes.flatMap((change) => change.type === 'ensureDirectory' ? []
    : change.type === 'renameDirectory' ? [change.sourcePath, change.targetPath] : [change.targetPath]))
  /** Copies each original path once before any committed file changes occur. */
  const capture = (filePath: string): void => {
    if (originals.has(filePath) || !fs.existsSync(filePath)) return
    /** Original metadata distinguishes directories and preserves file modification times. */
    const stat = fs.statSync(filePath)
    originals.set(filePath, { content: stat.isDirectory() ? null : fs.readFileSync(filePath), atime: stat.atime, mtime: stat.mtime })
    if (stat.isDirectory()) for (const name of fs.readdirSync(filePath)) capture(path.join(filePath, name))
  }
  for (const root of roots) capture(root)
  return () => {
    for (const root of roots) if (fs.existsSync(root)) fs.rmSync(root, { recursive: true })
    for (const [filePath, original] of [...originals].sort(([left], [right]) => left.length - right.length)) {
      if (original.content === null) fs.mkdirSync(filePath, { recursive: true })
      else {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, original.content)
        fs.utimesSync(filePath, original.atime, original.mtime)
      }
    }
  }
}

export const createStagedFileUpsert = (
  targetPath: string,
  tempPath: string
): FilePersistenceStagedChange => {
  return {
    type: 'upsert',
    targetPath,
    tempPath
  }
}

export const createStagedFileRemove = (targetPath: string): FilePersistenceStagedChange => {
  return {
    type: 'remove',
    targetPath
  }
}

export const createStagedDirectoryRemove = (targetPath: string): FilePersistenceStagedChange => {
  return {
    type: 'removeDirectory',
    targetPath
  }
}

export const createStagedEnsureDirectory = (
  targetPath: string,
  createdDuringStage: boolean
): FilePersistenceStagedChange => {
  return {
    type: 'ensureDirectory',
    targetPath,
    createdDuringStage
  }
}

export const createStagedDirectoryRename = (
  sourcePath: string,
  targetPath: string
): FilePersistenceStagedChange => {
  return {
    type: 'renameDirectory',
    sourcePath,
    targetPath
  }
}

export const resolveTempPath = (targetPath: string): string => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${targetPath}.${uniqueSuffix}.tmp`
}

export const writeJsonFile = (filePath: string, data: unknown): void => {
  const fs = getFs()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export const readJsonFile = <T = unknown>(filePath: string): T => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export const commitStagedFileChange = (stagedChange: FilePersistenceStagedChange): void => {
  const fs = getFs()

  if (stagedChange.type === 'ensureDirectory') {
    return
  }

  if (stagedChange.type === 'renameDirectory') {
    if (fs.existsSync(stagedChange.sourcePath)) {
      fs.renameSync(stagedChange.sourcePath, stagedChange.targetPath)
    }
    return
  }

  if (stagedChange.type === 'remove') {
    if (fs.existsSync(stagedChange.targetPath)) {
      fs.rmSync(stagedChange.targetPath)
    }
    return
  }

  if (stagedChange.type === 'removeDirectory') {
    if (fs.existsSync(stagedChange.targetPath)) {
      fs.rmSync(stagedChange.targetPath, { recursive: true })
    }
    return
  }

  // Side effect: replace target file atomically using delete + rename.
  if (fs.existsSync(stagedChange.targetPath)) {
    fs.rmSync(stagedChange.targetPath)
  }
  fs.renameSync(stagedChange.tempPath, stagedChange.targetPath)
}

export const revertStagedFileChange = (stagedChange: FilePersistenceStagedChange): void => {
  if (stagedChange.type === 'ensureDirectory') {
    if (!stagedChange.createdDuringStage) {
      return
    }

    const fs = getFs()
    if (!fs.existsSync(stagedChange.targetPath)) {
      return
    }
    if (fs.readdirSync(stagedChange.targetPath).length > 0) {
      return
    }

    // The staged directory is empty, but rm still requires directory removal mode.
    fs.rmSync(stagedChange.targetPath, { recursive: true })
    return
  }

  if (stagedChange.type === 'renameDirectory') {
    const fs = getFs()
    if (fs.existsSync(stagedChange.targetPath) && !fs.existsSync(stagedChange.sourcePath)) {
      fs.renameSync(stagedChange.targetPath, stagedChange.sourcePath)
    }
    return
  }

  if (stagedChange.type !== 'upsert') {
    return
  }

  const fs = getFs()
  if (fs.existsSync(stagedChange.tempPath)) {
    fs.rmSync(stagedChange.tempPath)
  }
}

export const commitStagedFileChanges = (stagedChanges: FilePersistenceStagedChange[]): void => {
  for (const fileChange of stagedChanges) {
    commitStagedFileChange(fileChange)
  }
}

export const revertStagedFileChanges = (stagedChanges: FilePersistenceStagedChange[]): void => {
  for (const fileChange of stagedChanges) {
    revertStagedFileChange(fileChange)
  }
}
