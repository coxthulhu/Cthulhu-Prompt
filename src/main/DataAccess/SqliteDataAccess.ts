import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { isPlaywrightEnvironment } from '../appEnvironment'
import { DEFAULT_USER_PERSISTENCE } from '@shared/UserPersistence'

const SQLITE_FILENAME = 'CthulhuPrompt.sqlite3'
const INITIAL_SCHEMA_VERSION = 1
const LATEST_SCHEMA_VERSION = 6

let database: Database.Database | null = null
let inMemoryDatabase = false

const resolveDatabasePath = (): string => {
  return path.join(app.getPath('userData'), SQLITE_FILENAME)
}

const ensureSchemaVersionTable = (db: Database.Database): void => {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')

  const existingVersion = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined

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
        app_sidebar_width_px INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_ui_state (
        workspace_id TEXT PRIMARY KEY,
        selected_screen TEXT NOT NULL,
        selected_prompt_folder_id TEXT
      );

      CREATE TABLE IF NOT EXISTS prompt_folder_ui_state (
        workspace_id TEXT NOT NULL,
        prompt_folder_id TEXT NOT NULL,
        prompt_tree_entry_id TEXT NOT NULL,
        PRIMARY KEY (workspace_id, prompt_folder_id)
      );
    `)

    db.prepare(
      `
      INSERT INTO app_persistence (
        id,
        last_workspace_path,
        app_sidebar_width_px
      )
      VALUES (
        1,
        ?,
        ?
      )
      ON CONFLICT(id) DO NOTHING
      `
    ).run(DEFAULT_USER_PERSISTENCE.lastWorkspacePath, DEFAULT_USER_PERSISTENCE.appSidebarWidthPx)

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

const migrateSchemaV3ToV4 = (db: Database.Database): void => {
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE app_persistence
      ADD COLUMN window_x_px INTEGER;

      ALTER TABLE app_persistence
      ADD COLUMN window_y_px INTEGER;

      ALTER TABLE app_persistence
      ADD COLUMN window_width_px INTEGER;

      ALTER TABLE app_persistence
      ADD COLUMN window_height_px INTEGER;

      ALTER TABLE app_persistence
      ADD COLUMN window_is_maximized INTEGER;

      ALTER TABLE app_persistence
      ADD COLUMN window_is_fullscreen INTEGER;
    `)

    db.prepare('UPDATE schema_version SET version = ?').run(4)
  })

  migrate()
}

const migrateSchemaV4ToV5 = (db: Database.Database): void => {
  const migrate = db.transaction(() => {
    const tableInfo = db.prepare('PRAGMA table_info(prompt_folder_ui_state)').all() as Array<{
      name: string
    }>
    const hasPromptTreeEntryColumn = tableInfo.some(
      (column) => column.name === 'prompt_tree_entry_id'
    )
    const hasOutlinerEntryColumn = tableInfo.some((column) => column.name === 'outliner_entry_id')
    const hasDescriptionViewStateColumn = tableInfo.some(
      (column) => column.name === 'folder_description_editor_view_state_json'
    )

    // Ensure the source table has prompt_tree_entry_id before rebuilding.
    if (!hasPromptTreeEntryColumn) {
      db.exec(`
        ALTER TABLE prompt_folder_ui_state
        ADD COLUMN prompt_tree_entry_id TEXT;
      `)
    }

    db.exec(`
      CREATE TABLE prompt_folder_ui_state_new (
        workspace_id TEXT NOT NULL,
        prompt_folder_id TEXT NOT NULL,
        prompt_tree_entry_id TEXT NOT NULL,
        folder_description_editor_view_state_json TEXT,
        PRIMARY KEY (workspace_id, prompt_folder_id)
      );
    `)

    const promptTreeEntryExpr = hasOutlinerEntryColumn
      ? "COALESCE(prompt_tree_entry_id, outliner_entry_id, 'folder-settings')"
      : "COALESCE(prompt_tree_entry_id, 'folder-settings')"
    const descriptionViewStateExpr = hasDescriptionViewStateColumn
      ? 'folder_description_editor_view_state_json'
      : 'NULL'

    db.exec(`
      INSERT INTO prompt_folder_ui_state_new (
        workspace_id,
        prompt_folder_id,
        prompt_tree_entry_id,
        folder_description_editor_view_state_json
      )
      SELECT
        workspace_id,
        prompt_folder_id,
        ${promptTreeEntryExpr},
        ${descriptionViewStateExpr}
      FROM prompt_folder_ui_state;
    `)

    db.exec('DROP TABLE prompt_folder_ui_state;')
    db.exec('ALTER TABLE prompt_folder_ui_state_new RENAME TO prompt_folder_ui_state;')

    db.prepare('UPDATE schema_version SET version = ?').run(5)
  })

  migrate()
}

const migrateSchemaV5ToV6 = (db: Database.Database): void => {
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE prompt_folder_ui_state
      ADD COLUMN prompt_tree_is_expanded INTEGER NOT NULL DEFAULT 1;
    `)

    db.prepare('UPDATE schema_version SET version = ?').run(6)
  })

  migrate()
}

const applyStartupMigrations = (db: Database.Database): void => {
  ensureSchemaVersionTable(db)

  let schemaVersion = (
    db.prepare('SELECT version FROM schema_version LIMIT 1').get() as {
      version: number
    }
  ).version

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

    if (schemaVersion === 3) {
      migrateSchemaV3ToV4(db)
      schemaVersion = 4
      continue
    }

    if (schemaVersion === 4) {
      migrateSchemaV4ToV5(db)
      schemaVersion = 5
      continue
    }

    if (schemaVersion === 5) {
      migrateSchemaV5ToV6(db)
      schemaVersion = 6
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
