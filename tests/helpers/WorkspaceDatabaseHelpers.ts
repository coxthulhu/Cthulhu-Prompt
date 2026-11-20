import type { ElectronApplication } from 'playwright'
import type { DomainEntityMap } from '@shared/domain/DomainChanges'
import type { Project } from '@shared/domain/workspace/Project'
import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import { runSqlQuery, toSqlText } from './UserPersistenceHelpers'

/** Workspace entities that can be inspected independently of the renderer cache. */
type Kind = 'prompt' | 'promptTemplate' | 'promptCollection' | 'note' | 'category'

/** Reads committed SQL rows and surfaces database errors immediately. */
export const rows = async (app: ElectronApplication, sql: string) => {
  /** SQL runs in Electron against the same profile as the tested UI. */
  const result = await runSqlQuery(app, sql)
  if (!result.success) throw new Error(result.error)
  return result.rows!
}

/** Reads one serialized domain record by a known SQL predicate. */
const record = async <T>(app: ElectronApplication, sql: string): Promise<T | null> => {
  /** Missing rows distinguish a deleted entity from an empty document. */
  const [row] = await rows(app, sql)
  return row ? JSON.parse(String(row.data)) : null
}

/** Reads an entity by its stable identity, including after title and collection changes. */
export const readRecord = <K extends Kind>(app: ElectronApplication, kind: K, id: string) =>
  record<DomainEntityMap[K]>(app, `SELECT data FROM content.records WHERE kind=${toSqlText(kind)} AND id=${toSqlText(id)}`)

/** Finds freshly created records when their generated IDs are unknown to the test. */
export const findRecord = <K extends Kind>(app: ElectronApplication, kind: K, field: 'title' | 'displayName' | 'folderName', value: string) =>
  record<DomainEntityMap[K]>(app, `SELECT data FROM content.records WHERE kind=${toSqlText(kind)} AND json_extract(data, '$.${field}')=${toSqlText(value)} COLLATE NOCASE`)

/** Resolves a collection in tests that select their library by name. */
export const findCollection = (app: ElectronApplication, folder: string, kind: PromptCollectionKind = 'prompt') =>
  record<DomainEntityMap['promptCollection']>(app, `SELECT data FROM content.records WHERE kind='promptCollection'
    AND json_extract(data, '$.folderName')=${toSqlText(folder)} AND json_extract(data, '$.kind')=${toSqlText(kind)}`)

/** Reads a category layout from the collection that owns the order. */
export const readOrder = async (app: ElectronApplication, collectionId: string, status: 'active' | 'backlog' = 'active') =>
  (await readRecord(app, 'promptCollection', collectionId))!.statusFolders[status].categoryOrder

/** Retrieves public project metadata independently of its private display order. */
export const findProject = (app: ElectronApplication, folder: string) =>
  record<Omit<Project, 'collectionEntries'>>(app, `SELECT data FROM content.projects WHERE json_extract(data, '$.folderName')=${toSqlText(folder)}`)

/** Reads the prompt owned by a named project and task collection after a project rename or swap. */
export const projectPrompt = async (app: ElectronApplication, folder: string, title: string) => {
  /** Read collection records joined to their project through its portable membership. */
  const matches = await rows(app, `SELECT r.data FROM content.project_collections pc JOIN content.projects p ON p.id=pc.project_id
    JOIN content.records r ON r.kind='promptCollection' AND r.id=pc.collection_id
    WHERE json_extract(p.data, '$.folderName')=${toSqlText(folder)}`)
  for (const row of matches) {
    /** The active order identifies precisely which prompts belong to this collection. */
    const collection: DomainEntityMap['promptCollection'] = JSON.parse(String(row.data))
    for (const group of collection.statusFolders.active.categoryOrder.categories) {
      for (const entry of group.entries.filter((ref) => ref.kind === 'prompt')) {
        /** Match against the stored title after resolving the stable prompt ID. */
        const prompt = await readRecord(app, 'prompt', entry.id)
        if (prompt?.title === title) return prompt
      }
    }
  }
  return null
}
