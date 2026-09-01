import type { IpcResult } from './IpcResult'
import type { RevisionEnvelope } from './Revision'

export type UserPersistence = {
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspaceInfoPath: null,
  appSidebarWidthPx: 275
}

export const USER_PERSISTENCE_ID = 'user-persistence'

export type PersistedWorkspaceScreen =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'prompt-folders'

export type WorkspaceScreenSelection =
  | {
      selectedScreen: 'home'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'settings'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'test-screen'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'mockups'
      selectedScreenData: {
        mockupId: string | null
      }
    }
  | {
      selectedScreen: 'prompt-folders'
      selectedScreenData: {
        promptFolderId: string | null
        /** Root-folder or category owner containing the selected prompt-folder screen row. */
        contentOwnerId: string | null
      }
    }

/** Persisted collapse and configured sizing state for one accordion section. */
export type WorkspaceAccordionSectionViewEntry = {
  id: string
  isExpanded: boolean
  configuredExpandedHeightPx: number
}

export const isWorkspaceScreenSelectionSame = (
  left: WorkspaceScreenSelection,
  right: WorkspaceScreenSelection
): boolean => {
  if (left.selectedScreen !== right.selectedScreen) {
    return false
  }

  if (left.selectedScreen === 'prompt-folders' && right.selectedScreen === 'prompt-folders') {
    return (
      left.selectedScreenData.promptFolderId === right.selectedScreenData.promptFolderId &&
      left.selectedScreenData.contentOwnerId === right.selectedScreenData.contentOwnerId
    )
  }

  if (left.selectedScreen === 'mockups' && right.selectedScreen === 'mockups') {
    return left.selectedScreenData.mockupId === right.selectedScreenData.mockupId
  }

  return true
}

export const LOAD_USER_PERSISTENCE_CHANNEL = 'load-user-persistence'
export const UPDATE_USER_PERSISTENCE_CHANNEL = 'update-user-persistence'

export type LoadUserPersistenceResult = IpcResult<{
  userPersistence: RevisionEnvelope<UserPersistence>
}>


const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const parseUserPersistence = (value: unknown): UserPersistence | null => {
  if (!isRecord(value)) {
    return null
  }

  const lastWorkspaceInfoPath = value.lastWorkspaceInfoPath
  if (lastWorkspaceInfoPath !== null && typeof lastWorkspaceInfoPath !== 'string') {
    return null
  }

  const appSidebarWidthPx =
    typeof value.appSidebarWidthPx === 'number'
      ? Math.round(value.appSidebarWidthPx)
      : DEFAULT_USER_PERSISTENCE.appSidebarWidthPx

  return {
    lastWorkspaceInfoPath,
    appSidebarWidthPx
  }
}

const parsePersistedWorkspaceScreen = (value: unknown): PersistedWorkspaceScreen | null => {
  if (
    value === 'home' ||
    value === 'settings' ||
    value === 'mockups' ||
    value === 'test-screen' ||
    value === 'prompt-folders'
  ) {
    return value
  }

  return null
}

export const parseWorkspaceScreenSelection = (
  selectedScreenValue: unknown,
  selectedScreenData: unknown
): WorkspaceScreenSelection | null => {
  const selectedScreen = parsePersistedWorkspaceScreen(selectedScreenValue)
  if (!selectedScreen) {
    return null
  }

  if (
    selectedScreen === 'home' ||
    selectedScreen === 'settings' ||
    selectedScreen === 'test-screen'
  ) {
    return selectedScreenData === null ? { selectedScreen, selectedScreenData } : null
  }

  if (selectedScreen === 'mockups') {
    if (!isRecord(selectedScreenData)) {
      return null
    }

    const mockupId = selectedScreenData.mockupId
    if (mockupId !== null && typeof mockupId !== 'string') {
      return null
    }

    return {
      selectedScreen,
      selectedScreenData: {
        mockupId
      }
    }
  }

  if (!isRecord(selectedScreenData)) {
    return null
  }

  const promptFolderId = selectedScreenData.promptFolderId
  if (promptFolderId !== null && typeof promptFolderId !== 'string') {
    return null
  }

  /** Selected content owner, defaulting old persisted data to the root prompt folder. */
  const contentOwnerId = selectedScreenData.contentOwnerId ?? promptFolderId
  if (contentOwnerId !== null && typeof contentOwnerId !== 'string') {
    return null
  }

  return {
    selectedScreen,
    selectedScreenData: {
      promptFolderId,
      contentOwnerId
    }
  }
}

/** Parses one persisted accordion section entry. */
const parseWorkspaceAccordionSectionViewEntry = (
  value: unknown
): WorkspaceAccordionSectionViewEntry | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.isExpanded !== 'boolean' ||
    typeof value.configuredExpandedHeightPx !== 'number'
  ) {
    return null
  }

  return {
    id: value.id,
    isExpanded: value.isExpanded,
    configuredExpandedHeightPx: value.configuredExpandedHeightPx
  }
}

/** Parses one persisted accordion section array. */
export const parseWorkspaceAccordionSections = (
  value: unknown
): WorkspaceAccordionSectionViewEntry[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  /** Validated section entries retained in their configured order. */
  const sections: WorkspaceAccordionSectionViewEntry[] = []
  for (const section of value) {
    /** Validated collapse and sizing state for the current section. */
    const parsedSection = parseWorkspaceAccordionSectionViewEntry(section)
    if (!parsedSection) return null
    sections.push(parsedSection)
  }

  return sections
}
