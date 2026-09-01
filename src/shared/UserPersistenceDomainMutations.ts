import type { DomainPlanner, DomainTarget } from './DomainChanges'
import {
  USER_PERSISTENCE_ID,
  type UserPersistence
} from './UserPersistence'

/** Strict runtime parser for complete user-persistence replacement commands. */
export const parseSetUserPersistenceDomainCommand = (
  value: unknown
): UserPersistence | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    (record.lastWorkspaceInfoPath !== null &&
      typeof record.lastWorkspaceInfoPath !== 'string') ||
    typeof record.appSidebarWidthPx !== 'number'
  ) {
    return null
  }
  return {
    lastWorkspaceInfoPath: record.lastWorkspaceInfoPath,
    appSidebarWidthPx: Math.round(record.appSidebarWidthPx)
  }
}

/** Plans one complete update of the required user-persistence singleton. */
export const planSetUserPersistenceDomainMutation: DomainPlanner<UserPersistence> = (
  state,
  command
) => {
  /** Required singleton selected from the shared authoritative graph. */
  const userPersistence = state.get('userPersistence', USER_PERSISTENCE_ID)
  /** Stable singleton target returned when startup hydration is missing. */
  const targets: DomainTarget[] = [
    { entityType: 'userPersistence', id: USER_PERSISTENCE_ID }
  ]
  if (!userPersistence) {
    return { status: 'conflict', reason: 'User persistence not loaded', targets }
  }
  return [
    {
      type: 'update',
      entityType: 'userPersistence',
      id: USER_PERSISTENCE_ID,
      recipe: (draft) => {
        Object.assign(draft, command)
      }
    }
  ]
}
