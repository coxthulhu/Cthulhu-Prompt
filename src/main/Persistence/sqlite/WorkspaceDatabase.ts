import Database from 'better-sqlite3'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { DomainEntityMap } from '@shared/domain/DomainChanges'
import { prepareWorkspaceName, type Workspace, type WorkspaceListEntry } from '@shared/domain/workspace/Workspace'
import type { Project } from '@shared/domain/workspace/Project'
import { collectionEntryRef } from '@shared/domain/OrderContainer'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'
import { UserPersistenceDataAccess } from './UserPersistenceDataAccess'
import type { SqlitePersistenceLayer } from '../PersistenceTypes'

/** Domain entities with independently editable records in a workspace file. */
export type ContentKind = 'promptCollection' | 'category' | 'prompt' | 'promptTemplate' | 'note'

/** Parsed workspace content ready for a single database transaction. */
export interface WorkspaceContents {
  id: string
  name: string
  projects: Project[]
  promptCollection: DomainEntityMap['promptCollection'][]
  category: DomainEntityMap['category'][]
  prompt: DomainEntityMap['prompt'][]
  promptTemplate: DomainEntityMap['promptTemplate'][]
  note: DomainEntityMap['note'][]
}

/** Kinds stored independently from the project membership and identity tables. */
export const contentKinds: readonly ContentKind[] = ['promptCollection', 'category', 'prompt', 'promptTemplate', 'note']

/** Creates an empty import or creation batch. */
export const emptyContents = (id: string, name: string): WorkspaceContents => ({
  id, name, projects: [], promptCollection: [], category: [], prompt: [], promptTemplate: [], note: []
})

/** Workspace files share only the current build profile's managed directory. */
export const workspacesDirectory = (): string => join(app.getPath('userData'), 'Workspaces')

/** The native database lives on the real filesystem, including in isolated Playwright profiles. */
export const isManagedWorkspacePath = (path: string): boolean =>
  dirname(resolve(path)).toLowerCase() === resolve(workspacesDirectory()).toLowerCase() && path.toLowerCase().endsWith('.cthulhuprompt')

/** Lists managed files without opening their databases during first-launch detection. */
export const listWorkspacePaths = (): string[] => {
  /** Only the active profile contributes entries to the catalog. */
  const directory = workspacesDirectory()
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.cthulhuprompt'))
    .map((entry) => join(directory, entry.name))
}

/** Reads display names and IDs directly from managed databases. */
export const listWorkspaces = (): WorkspaceListEntry[] =>
  listWorkspacePaths()
    .map((path) => {
      /** A read-only catalog lookup leaves the active attachment alone. */
      const db = new Database(path, { readonly: true, fileMustExist: true })
      try {
        /** Identity is read from the file so discovery needs no separate registry. */
        const identity = db.prepare('SELECT id, name FROM workspace').get() as { id: string; name: string }
        return { ...identity, path }
      } finally {
        db.close()
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

/** Persists public metadata and membership. Display ordering is owned by the main database. */
const writeProjects = (db: Database.Database, schema: 'main' | 'content', projects: Project[]): void => {
  db.exec(`DELETE FROM ${schema}.project_collections; DELETE FROM ${schema}.projects`)
  /** Project metadata excludes the machine-local collection order. */
  const insertProject = db.prepare(`INSERT INTO ${schema}.projects VALUES (?, ?)`)
  /** Membership is keyed by collection so each collection has one project. */
  const insertMember = db.prepare(`INSERT INTO ${schema}.project_collections VALUES (?, ?)`)
  for (const { collectionEntries, ...metadata } of projects) {
    insertProject.run(metadata.id, JSON.stringify(metadata))
    for (const ref of collectionEntries) insertMember.run(ref.id, metadata.id)
  }
}

/** Publishes a fully committed file. Validation and failed writes leave the catalog intact. */
export const publishWorkspace = (source: WorkspaceContents): string => {
  /** Check identities even when filenames differ. */
  const catalog = listWorkspaces()
  /** Apply the same rules used for interactive creation to imported names. */
  const name = prepareWorkspaceName(source.name, catalog)
  if (name.error) throw new Error(name.error)
  /** The existing workspace naming rules determine the final filename. */
  const path = join(workspacesDirectory(), name.folderName + '.cthulhuprompt')
  if (existsSync(path)) {
    throw new Error('A workspace with this name already exists')
  }
  if (catalog.some((entry) => entry.id === source.id)) throw new Error('A workspace with this ID already exists')
  mkdirSync(workspacesDirectory(), { recursive: true })
  /** Keep the unfinished file beside the destination for atomic publication. */
  const temporary = join(workspacesDirectory(), randomUUID() + '.tmp')
  try {
    /** All initial rows are committed before the filename becomes visible. */
    const db = new Database(temporary)
    try {
      db.transaction(() => {
        db.exec(`PRAGMA user_version = 1;
          CREATE TABLE workspace (id TEXT PRIMARY KEY, name TEXT NOT NULL);
          CREATE TABLE projects (id TEXT PRIMARY KEY, data TEXT NOT NULL);
          CREATE TABLE project_collections (collection_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id));
          CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id));`)
        db.prepare('INSERT INTO workspace VALUES (?, ?)').run(source.id, name.displayName)
        writeProjects(db, 'main', source.projects)
        /** One prepared statement writes all independent records. */
        const insert = db.prepare('INSERT INTO records VALUES (?, ?, ?)')
        for (const kind of contentKinds) {
          for (const entity of source[kind]) insert.run(kind, entity.id, JSON.stringify(entity))
        }
      })()
    } finally {
      db.close()
    }
    renameSync(temporary, path)
    return path
  } finally {
    rmSync(temporary, { force: true })
  }
}

/** The attached workspace participates in the same transaction as its machine-local state. */
let activeDatabasePath: string | null = null

/** Releases the active file after pending edits have flushed. */
export const detachWorkspace = (): void => {
  if (!activeDatabasePath) return
  SqliteDataAccess.getDatabase().exec('DETACH DATABASE content')
  activeDatabasePath = null
}

/** Opens an existing managed file and exposes its identity to the loader. */
export const attachWorkspace = (path: string): { id: string; name: string } => {
  detachWorkspace()
  if (!isManagedWorkspacePath(path) || !existsSync(path)) throw new Error('Invalid workspace path')
  /** Attach to the same connection that owns the private state tables. */
  const db = SqliteDataAccess.getDatabase()
  db.prepare('ATTACH DATABASE ? AS content').run(path)
  activeDatabasePath = path
  if (db.pragma('content.user_version', { simple: true }) !== 1) throw new Error('Unsupported workspace database version')
  return db.prepare('SELECT id, name FROM content.workspace').get() as { id: string; name: string }
}

/** Moves the open database and commits its new label and remembered path together. */
export const renameWorkspace = (workspaceId: string, workspaceName: string): string => {
  /** Look up the source by identity so the caller cannot supply a filesystem path. */
  const catalog = listWorkspaces()
  /** The active workspace is the only file Home can rename. */
  const current = catalog.find((entry) => entry.id === workspaceId)
  if (!current || current.path !== activeDatabasePath) throw new Error('Workspace is not open')
  /** Apply the creation rules while allowing a change in spacing or capitalization. */
  const name = prepareWorkspaceName(workspaceName, catalog.filter((entry) => entry.id !== workspaceId))
  if (name.error) throw new Error(name.error)
  /** Destination follows the same filename convention as workspace creation. */
  const destination = join(workspacesDirectory(), name.folderName + '.cthulhuprompt')
  if (destination.toLowerCase() !== current.path.toLowerCase() && existsSync(destination)) {
    throw new Error('A workspace with this name already exists')
  }

  // Release SQLite's Windows file handle before moving the database.
  detachWorkspace()
  /** Tracks which filename to restore if the move or SQLite transaction fails. */
  let moved = false
  try {
    if (current.path !== destination) {
      renameSync(current.path, destination)
      moved = true
    }
    attachWorkspace(destination)
    SqliteDataAccess.runTransaction(() => {
      SqliteDataAccess.getDatabase().prepare('UPDATE content.workspace SET name = ? WHERE id = ?').run(name.displayName, workspaceId)
      UserPersistenceDataAccess.updateUserPersistence({ ...UserPersistenceDataAccess.readUserPersistence(), lastWorkspaceInfoPath: destination })
    })
    return destination
  } catch (error) {
    detachWorkspace()
    if (moved) renameSync(destination, current.path)
    attachWorkspace(current.path)
    throw error
  }
}

/** Orders live identities using the user's saved positions and then their display directory names. */
const userOrder = <T extends { id: string; folderName: string }>(items: T[], saved: string[] = []): T[] => {
  /** Missing saved IDs disappear and newly discovered IDs retain alphabetical order. */
  const remaining = new Map(items.sort((a, b) => a.folderName.localeCompare(b.folderName)).map((item) => [item.id, item]))
  /** Existing IDs with an explicit saved position. */
  const ordered: T[] = []
  for (const id of saved) {
    /** A saved position applies only to a current member. */
    const item = remaining.get(id)
    if (item) {
      ordered.push(item)
      remaining.delete(id)
    }
  }
  return [...ordered, ...remaining.values()]
}

/** Merges project membership with the private order rows using preserved IDs. */
export const readWorkspaceProjects = (workspaceId: string): Project[] => {
  /** Read membership and display order from the active connection. */
  const db = SqliteDataAccess.getDatabase()
  /** Project rows contain portable metadata only. */
  const projects = db.prepare('SELECT data FROM content.projects').all() as { data: string }[]
  /** Lookup for a project’s portable collection membership. */
  const members = db.prepare(`SELECT r.id, json_extract(r.data, '$.folderName') AS folderName
    FROM content.project_collections pc JOIN content.records r ON r.kind = 'promptCollection' AND r.id = pc.collection_id
    WHERE pc.project_id = ?`)
  return userOrder(projects.map((row) => {
    /** Restore this project’s private order after parsing its shared metadata. */
    const project: Project = JSON.parse(row.data)
    /** The names provide a deterministic initial ordering. */
    const owned = members.all(project.id) as { id: string; folderName: string }[]
    /** Older workspaces may have one unscoped collection order. */
    const saved = WorkspaceStateDataAccess.read(workspaceId, 'collection-order', project.id)
      ?? WorkspaceStateDataAccess.read(workspaceId, 'collection-order', null)
    /** Only collections belonging to this project receive an ordering entry. */
    const collectionEntries = userOrder(owned, saved?.entries.map((entry) => entry.id)).map((item) => collectionEntryRef(item.id))
    return { ...project, collectionEntries }
  }), WorkspaceStateDataAccess.read(workspaceId, 'project-order', null)?.ids)
}

/** Separately saves each project's private order and removes preferences of deleted projects. */
export const saveWorkspaceOrder = (workspace: Workspace, previous: Project[] = []): void => {
  WorkspaceStateDataAccess.write(workspace.id, 'project-order', null, { ids: workspace.projects.map((project) => project.id) })
  for (const project of workspace.projects) WorkspaceStateDataAccess.write(workspace.id, 'collection-order', project.id, { entries: project.collectionEntries })
  WorkspaceStateDataAccess.delete(workspace.id, 'collection-order', null)
  for (const old of previous) {
    if (!workspace.projects.some((project) => project.id === old.id)) WorkspaceStateDataAccess.delete(workspace.id, 'collection-order', old.id)
  }
}

/** Workspace metadata and private preferences commit together on the attached connection. */
export const workspaceDatabasePersistence: SqlitePersistenceLayer<Workspace, Record<string, never>> = {
  kind: 'sqlite',
  query: (id) => {
    /** The workspace row is independent of its path and project preferences. */
    const identity = SqliteDataAccess.getDatabase().prepare('SELECT name FROM content.workspace WHERE id = ?').get(id) as { name: string } | undefined
    return identity ? { id, workspaceName: identity.name, workspacePath: activeDatabasePath!, projects: readWorkspaceProjects(id) } : null
  },
  command: (_, { before, after }) => {
    if (!after) throw new Error('Workspace deletion is unsupported')
    writeProjects(SqliteDataAccess.getDatabase(), 'content', after.data.projects)
    saveWorkspaceOrder(after.data, before?.data.projects)
  }
}

/** Reads and writes one stable domain entity through the current workspace connection. */
export const contentPersistence = <K extends ContentKind>(kind: K): SqlitePersistenceLayer<DomainEntityMap[K], Record<string, never>> => ({
  kind: 'sqlite',
  query: (id) => {
    /** Read the committed JSON representation by kind and ID. */
    const row = SqliteDataAccess.getDatabase().prepare('SELECT data FROM content.records WHERE kind = ? AND id = ?').get(kind, id) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  },
  command: (id, { after }) => {
    /** Mutation commands run inside the caller’s transaction. */
    const db = SqliteDataAccess.getDatabase()
    if (after) db.prepare('INSERT INTO content.records VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data').run(kind, id, JSON.stringify(after.data))
    else db.prepare('DELETE FROM content.records WHERE kind = ? AND id = ?').run(kind, id)
  }
})
