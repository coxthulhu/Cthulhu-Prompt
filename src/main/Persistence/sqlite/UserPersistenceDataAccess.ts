import {
  DEFAULT_USER_PERSISTENCE,
  parseUserPersistence,
  type UserPersistence
} from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

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

/** Adapts independently stored user and machine state to the application's existing records. */
export class UserPersistenceDataAccess {
  /** Reads the last native workspace-picker directory on this machine. */
  static readWorkspaceDialogDirectory(): string | null {
    return WorkspaceStateDataAccess.read(null, 'workspace-dialog', null)?.directory ?? null
  }

  /** Saves the picker directory without replacing renderer or window preferences. */
  static updateWorkspaceDialogDirectory(directory: string): void {
    WorkspaceStateDataAccess.write(null, 'workspace-dialog', null, { directory })
  }

  /** Reassembles renderer persistence with independent defaults for each storage scope. */
  static readUserPersistence(): UserPersistence {
    return parseUserPersistence({
      ...DEFAULT_USER_PERSISTENCE,
      ...WorkspaceStateDataAccess.read(null, 'application-machine', null),
      ...WorkspaceStateDataAccess.read(null, 'application-user', null)
    })!
  }

  /** Atomically splits renderer preferences into their user and machine state types. */
  static updateUserPersistence(userPersistence: UserPersistence): UserPersistence {
    /** Pixel sizes retain the existing integer normalization. */
    const next = {
      ...userPersistence,
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx),
      settingsScrollTopPx: Math.round(userPersistence.settingsScrollTopPx)
    }
    SqliteDataAccess.runTransaction(() => {
      WorkspaceStateDataAccess.write(null, 'application-user', null, { hasShownWelcome: next.hasShownWelcome })
      WorkspaceStateDataAccess.write(null, 'application-machine', null, {
        lastWorkspaceInfoPath: next.lastWorkspaceInfoPath,
        appSidebarWidthPx: next.appSidebarWidthPx,
        settingsCollapsedSectionIds: next.settingsCollapsedSectionIds,
        settingsScrollTopPx: next.settingsScrollTopPx
      })
    })
    return next
  }

  /** Reads the saved geometry and display modes for this machine. */
  static readWindowPersistence(): WindowPersistence {
    return WorkspaceStateDataAccess.read(null, 'window', null) ?? DEFAULT_WINDOW_PERSISTENCE
  }

  /** Saves integer geometry together with its associated display modes. */
  static updateWindowPersistence(windowPersistence: WindowPersistence): void {
    WorkspaceStateDataAccess.write(null, 'window', null, {
      ...windowPersistence,
      x: windowPersistence.x === null ? null : Math.round(windowPersistence.x),
      y: windowPersistence.y === null ? null : Math.round(windowPersistence.y),
      width: windowPersistence.width === null ? null : Math.round(windowPersistence.width),
      height: windowPersistence.height === null ? null : Math.round(windowPersistence.height)
    })
  }
}
