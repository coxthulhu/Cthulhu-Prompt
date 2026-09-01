import {
  DEFAULT_USER_PERSISTENCE,
  parseUserPersistence,
  type UserPersistence
} from '@shared/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'

/** Singleton SQLite row ID used by application and window persistence. */
const APP_PERSISTENCE_ID = 1

/** SQLite projection for renderer-owned user persistence. */
type UserPersistenceRow = {
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
}

/** SQLite projection for main-process window persistence. */
type WindowPersistenceRow = {
  windowXPx: number | null
  windowYPx: number | null
  windowWidthPx: number | null
  windowHeightPx: number | null
  windowIsMaximized: number | null
  windowIsFullScreen: number | null
}

/** Main-process window geometry and display-mode persistence. */
export type WindowPersistence = {
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  isMaximized: boolean | null
  isFullScreen: boolean | null
}

/** Default window persistence used before SQLite contains saved bounds. */
const DEFAULT_WINDOW_PERSISTENCE: WindowPersistence = {
  x: null,
  y: null,
  width: null,
  height: null,
  isMaximized: null,
  isFullScreen: null
}

/** SQLite access for renderer user persistence and main window persistence. */
export class UserPersistenceDataAccess {
  /** Reads the renderer-owned user-persistence singleton. */
  static readUserPersistence(): UserPersistence {
    /** SQLite database containing the singleton application row. */
    const db = SqliteDataAccess.getDatabase()
    /** Stored renderer persistence fields when the singleton row exists. */
    const persistenceRow = db
      .prepare(
        `SELECT last_workspace_info_path AS lastWorkspaceInfoPath,
                app_sidebar_width_px AS appSidebarWidthPx
         FROM app_persistence WHERE id = ?`
      )
      .get(APP_PERSISTENCE_ID) as UserPersistenceRow | undefined
    /** Validated persistence or the stable defaults. */
    const parsedPersistence = parseUserPersistence(persistenceRow)
    return parsedPersistence ?? DEFAULT_USER_PERSISTENCE
  }

  /** Writes and returns normalized renderer user persistence. */
  static updateUserPersistence(userPersistence: UserPersistence): UserPersistence {
    /** SQLite database receiving the singleton upsert. */
    const db = SqliteDataAccess.getDatabase()
    /** Normalized values persisted by the domain mutation. */
    const nextUserPersistence = {
      lastWorkspaceInfoPath: userPersistence.lastWorkspaceInfoPath,
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx)
    }
    db.prepare(
      `INSERT INTO app_persistence (id, last_workspace_info_path, app_sidebar_width_px)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_workspace_info_path = excluded.last_workspace_info_path,
         app_sidebar_width_px = excluded.app_sidebar_width_px`
    ).run(
      APP_PERSISTENCE_ID,
      nextUserPersistence.lastWorkspaceInfoPath,
      nextUserPersistence.appSidebarWidthPx
    )
    return nextUserPersistence
  }

  /** Reads persisted window geometry and display modes. */
  static readWindowPersistence(): WindowPersistence {
    /** Stored window fields when the singleton row exists. */
    const row = SqliteDataAccess.getDatabase()
      .prepare(
        `SELECT window_x_px AS windowXPx,
                window_y_px AS windowYPx,
                window_width_px AS windowWidthPx,
                window_height_px AS windowHeightPx,
                window_is_maximized AS windowIsMaximized,
                window_is_fullscreen AS windowIsFullScreen
         FROM app_persistence WHERE id = ?`
      )
      .get(APP_PERSISTENCE_ID) as WindowPersistenceRow | undefined
    if (!row) return DEFAULT_WINDOW_PERSISTENCE
    return {
      x: row.windowXPx === null ? null : Math.round(row.windowXPx),
      y: row.windowYPx === null ? null : Math.round(row.windowYPx),
      width: row.windowWidthPx === null ? null : Math.round(row.windowWidthPx),
      height: row.windowHeightPx === null ? null : Math.round(row.windowHeightPx),
      isMaximized: row.windowIsMaximized === null ? null : Boolean(row.windowIsMaximized),
      isFullScreen: row.windowIsFullScreen === null ? null : Boolean(row.windowIsFullScreen)
    }
  }

  /** Writes normalized window geometry and display modes. */
  static updateWindowPersistence(windowPersistence: WindowPersistence): void {
    /** Normalized SQLite-compatible window values. */
    const next = {
      x: windowPersistence.x === null ? null : Math.round(windowPersistence.x),
      y: windowPersistence.y === null ? null : Math.round(windowPersistence.y),
      width: windowPersistence.width === null ? null : Math.round(windowPersistence.width),
      height: windowPersistence.height === null ? null : Math.round(windowPersistence.height),
      isMaximized:
        windowPersistence.isMaximized === null ? null : windowPersistence.isMaximized ? 1 : 0,
      isFullScreen:
        windowPersistence.isFullScreen === null ? null : windowPersistence.isFullScreen ? 1 : 0
    }
    SqliteDataAccess.getDatabase()
      .prepare(
        `UPDATE app_persistence SET
           window_x_px = ?, window_y_px = ?, window_width_px = ?, window_height_px = ?,
           window_is_maximized = ?, window_is_fullscreen = ?
         WHERE id = ?`
      )
      .run(
        next.x,
        next.y,
        next.width,
        next.height,
        next.isMaximized,
        next.isFullScreen,
        APP_PERSISTENCE_ID
      )
  }
}
