import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { isPlaywrightEnvironment } from '../appEnvironment'

const SQLITE_FILENAME = 'CthulhuPrompt.sqlite3'

let database: Database.Database | null = null
let inMemoryDatabase = false

const resolveDatabasePath = (): string => {
  return path.join(app.getPath('userData'), SQLITE_FILENAME)
}

const initializeSchemaVersionTable = (db: Database.Database): void => {
  db.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)')
  db.exec('INSERT INTO schema_version (version) VALUES (1)')
}

export class SqliteDataAccess {
  static initializeDatabase(): void {
    if (database) {
      return
    }

    if (isPlaywrightEnvironment()) {
      const memoryDb = new Database(':memory:')
      initializeSchemaVersionTable(memoryDb)
      database = memoryDb
      inMemoryDatabase = true
      return
    }

    const fs = getFs()
    const userDataPath = app.getPath('userData')
    fs.mkdirSync(userDataPath, { recursive: true })

    const sqlitePath = resolveDatabasePath()
    const databaseExists = fs.existsSync(sqlitePath)
    const fileDb = new Database(sqlitePath)
    fileDb.pragma('journal_mode = WAL')

    if (!databaseExists) {
      initializeSchemaVersionTable(fileDb)
    }

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
