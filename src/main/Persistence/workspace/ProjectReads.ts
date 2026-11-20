import * as path from 'path'
import { prepareProjectInfo, type ProjectInfo } from '@shared/domain/workspace/Project'
import { readJsonFile } from '../FilePersistenceHelpers'

/** Identity file marking an immediate workspace directory as a project. */
export const PROJECT_INFO_FILENAME = 'ProjectInfo.json'

/** Validates project metadata before allowing it into the authoritative workspace. */
export const readProjectInfo = (projectPath: string): ProjectInfo => {
  /** Untrusted disk metadata checked independently of mutation commands. */
  const value = readJsonFile<unknown>(path.join(projectPath, PROJECT_INFO_FILENAME))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project metadata')
  /** Only shared metadata belongs in ProjectInfo.json. */
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' ||
    typeof record.abbreviation !== 'string' || Object.keys(record).some((key) =>
      !['id', 'name', 'abbreviation', 'shortDescription', 'description'].includes(key)) ||
    (record.shortDescription !== undefined && typeof record.shortDescription !== 'string') ||
    (record.description !== undefined && typeof record.description !== 'string')) throw new Error('Invalid project metadata')
  return prepareProjectInfo(record as ProjectInfo, [])
}
