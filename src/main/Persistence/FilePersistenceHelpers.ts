import { getFs } from '../fs-provider'

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

export const resolveTempPath = (targetPath: string): string => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${targetPath}.${uniqueSuffix}.tmp`
}

export const writeJsonFile = (filePath: string, data: unknown): void => {
  const fs = getFs()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export const commitStagedFileChange = (stagedChange: FilePersistenceStagedChange): void => {
  const fs = getFs()

  if (stagedChange.type === 'remove') {
    if (fs.existsSync(stagedChange.targetPath)) {
      fs.rmSync(stagedChange.targetPath)
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
  if (stagedChange.type !== 'upsert') {
    return
  }

  const fs = getFs()
  if (fs.existsSync(stagedChange.tempPath)) {
    fs.rmSync(stagedChange.tempPath)
  }
}
