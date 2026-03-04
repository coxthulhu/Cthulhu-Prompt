import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { isPlaywrightEnvironment } from '../appEnvironment'
import { DEFAULT_USER_PERSISTENCE } from '@shared/UserPersistence'

const SQLITE_FILENAME = 'CthulhuPrompt.sqlite3'
const INITIAL_SCHEMA_VERSION = 1
const LATEST_SCHEMA_VERSION = 3

let database: Database.Database | null = null
let inMemoryDatabase = false

const resolveDatabasePath = (): string => {
  return path.join(app.getPath('userData'), SQLITE_FILENAME)
}

const ensureSchemaVersionTable = (db: Database.Database): void => {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')

  const existingVersion = db
    .prepare('SELECT version FROM schema_version LIMIT 1')
    .get() as { version: number } | undefined

  if (existingVersion) {
    return
  }

  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(INITIAL_SCHEMA_VERSION)
}

const migrateSchemaV1ToV2 = (db: Database.Database): void => {
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_persistence (
        id INTEGER PRIMARY KEY,
        last_workspace_path TEXT,
        app_sidebar_width_px INTEGER NOT NULL,
        prompt_outliner_width_px INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_ui_state (
        workspace_id TEXT PRIMARY KEY,
        selected_screen TEXT NOT NULL,
        selected_prompt_folder_id TEXT
      );

      CREATE TABLE IF NOT EXISTS prompt_folder_ui_state (
        workspace_id TEXT NOT NULL,
        prompt_folder_id TEXT NOT NULL,
        outliner_entry_id TEXT NOT NULL,
        PRIMARY KEY (workspace_id, prompt_folder_id)
      );
    `)

    db.prepare(
      `
      INSERT INTO app_persistence (
        id,
        last_workspace_path,
        app_sidebar_width_px,
        prompt_outliner_width_px
      )
      VALUES (
        1,
        ?,
        ?,
        ?
      )
      ON CONFLICT(id) DO NOTHING
      `
    ).run(
      DEFAULT_USER_PERSISTENCE.lastWorkspacePath,
      DEFAULT_USER_PERSISTENCE.appSidebarWidthPx,
      DEFAULT_USER_PERSISTENCE.promptOutlinerWidthPx
    )

    db.prepare('UPDATE schema_version SET version = ?').run(2)
  })

  migrate()
}

const migrateSchemaV2ToV3 = (db: Database.Database): void => {
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE prompt_folder_ui_state
      ADD COLUMN folder_description_editor_view_state_json TEXT;

      CREATE TABLE IF NOT EXISTS prompt_ui_state (
        workspace_id TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        editor_view_state_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, prompt_id)
      );
    `)

    db.prepare('UPDATE schema_version SET version = ?').run(3)
  })

  migrate()
}

const applyStartupMigrations = (db: Database.Database): void => {
  ensureSchemaVersionTable(db)

  let schemaVersion = (db.prepare('SELECT version FROM schema_version LIMIT 1').get() as {
    version: number
  }).version

  if (schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${schemaVersion}. Latest supported version is ${LATEST_SCHEMA_VERSION}.`
    )
  }

  while (schemaVersion < LATEST_SCHEMA_VERSION) {
    if (schemaVersion === 1) {
      migrateSchemaV1ToV2(db)
      schemaVersion = 2
      continue
    }

    if (schemaVersion === 2) {
      migrateSchemaV2ToV3(db)
      schemaVersion = 3
      continue
    }

    throw new Error(`No SQLite migration found for schema version ${schemaVersion}.`)
  }
}

export class SqliteDataAccess {
  static initializeDatabase(): void {
    if (database) {
      return
    }

    if (isPlaywrightEnvironment()) {
      const memoryDb = new Database(':memory:')
      applyStartupMigrations(memoryDb)
      database = memoryDb
      inMemoryDatabase = true
      return
    }

    const fs = getFs()
    const userDataPath = app.getPath('userData')
    fs.mkdirSync(userDataPath, { recursive: true })

    const sqlitePath = resolveDatabasePath()
    const fileDb = new Database(sqlitePath)
    fileDb.pragma('journal_mode = WAL')
    applyStartupMigrations(fileDb)

    database = fileDb
    inMemoryDatabase = false
  }

  static runSqlForTests(sql: string): { rows?: Array<Record<string, unknown>> } {
    const trimmedSql = sql.trim()
    const db = this.getDatabase()
    const statement = db.prepare(trimmedSql)

    if (statement.reader) {
      return { rows: statement.all() as Array<Record<string, unknown>> }
    }

    statement.run()
    return {}
  }

  static isUsingInMemoryDatabase(): boolean {
    return inMemoryDatabase
  }

  static getDatabase(): Database.Database {
    if (!database) {
      throw new Error('Database has not been initialized')
    }

    return database
  }
}
