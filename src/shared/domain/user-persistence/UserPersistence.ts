import type { AuthoritativeSnapshotQueryResult } from '@shared/ipc/AuthoritativeSnapshot'

export type UserPersistence = {
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
  /** Application-wide sidebar expansion preference for this user. */
  appSidebarExpanded: boolean
  /** Whether Welcome has been displayed for this user. */
  hasShownWelcome: boolean
  /** Settings sidebar sections collapsed on this machine; all others are expanded. */
  settingsCollapsedSectionIds: string[]
  /** Last scroll offset of the settings screen on this machine. */
  settingsScrollTopPx: number
  /** Share of the single-prompt editor area given to a visible attached note on this machine. */
  singlePromptNoteFraction: number
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspaceInfoPath: null,
  appSidebarWidthPx: 275,
  appSidebarExpanded: true,
  hasShownWelcome: false,
  settingsCollapsedSectionIds: [],
  settingsScrollTopPx: 0,
  singlePromptNoteFraction: 0.3
}

export const USER_PERSISTENCE_ID = 'user-persistence'

export type PersistedWorkspaceScreen =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'project'

/** Persisted selection data for the project screen's selected collection. */
export type ProjectWorkspaceScreenSelection = {
  selectedScreen: 'project'
  selectedScreenData: {
    promptCollectionId: string | null
    /** collection or category owner containing the selected prompt-collection screen row. */
    contentOwnerId: string | null
    /** Prompt or template shown in the single-prompt editor, or null for the collection view. */
    openPromptId: string | null
  }
}

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
  | ProjectWorkspaceScreenSelection

/** Narrows a complete screen selection to the project screen. */
export const isProjectScreenSelection = (
  selection: WorkspaceScreenSelection
): selection is ProjectWorkspaceScreenSelection =>
  selection.selectedScreen === 'project'

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

  if (isProjectScreenSelection(left) && isProjectScreenSelection(right)) {
    return (
      left.selectedScreenData.promptCollectionId === right.selectedScreenData.promptCollectionId &&
      left.selectedScreenData.contentOwnerId === right.selectedScreenData.contentOwnerId &&
      left.selectedScreenData.openPromptId === right.selectedScreenData.openPromptId
    )
  }

  if (left.selectedScreen === 'mockups' && right.selectedScreen === 'mockups') {
    return left.selectedScreenData.mockupId === right.selectedScreenData.mockupId
  }

  return true
}

export const LOAD_USER_PERSISTENCE_CHANNEL = 'load-user-persistence'
export const UPDATE_USER_PERSISTENCE_CHANNEL = 'update-user-persistence'

/** Startup query result containing authoritative snapshots for user persistence. */
export type LoadUserPersistenceResult = AuthoritativeSnapshotQueryResult


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
    appSidebarWidthPx,
    appSidebarExpanded:
      typeof value.appSidebarExpanded === 'boolean'
        ? value.appSidebarExpanded
        : DEFAULT_USER_PERSISTENCE.appSidebarExpanded,
    hasShownWelcome: value.hasShownWelcome === true,
    settingsCollapsedSectionIds: Array.isArray(value.settingsCollapsedSectionIds)
      ? value.settingsCollapsedSectionIds.filter((id): id is string => typeof id === 'string')
      : DEFAULT_USER_PERSISTENCE.settingsCollapsedSectionIds,
    settingsScrollTopPx:
      typeof value.settingsScrollTopPx === 'number'
        ? Math.round(value.settingsScrollTopPx)
        : DEFAULT_USER_PERSISTENCE.settingsScrollTopPx,
    singlePromptNoteFraction:
      typeof value.singlePromptNoteFraction === 'number'
        ? value.singlePromptNoteFraction
        : DEFAULT_USER_PERSISTENCE.singlePromptNoteFraction
  }
}

const parsePersistedWorkspaceScreen = (value: unknown): PersistedWorkspaceScreen | null => {
  if (
    value === 'home' ||
    value === 'settings' ||
    value === 'mockups' ||
    value === 'test-screen' ||
    value === 'project'
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

  const promptCollectionId = selectedScreenData.promptCollectionId
  if (promptCollectionId !== null && typeof promptCollectionId !== 'string') {
    return null
  }

  /** Selected content owner, defaulting old persisted data to the prompt collection. */
  const contentOwnerId = selectedScreenData.contentOwnerId ?? promptCollectionId
  if (contentOwnerId !== null && typeof contentOwnerId !== 'string') {
    return null
  }

  /** Open single-prompt editor target, absent from data saved before the editor existed. */
  const openPromptId = selectedScreenData.openPromptId ?? null
  if (openPromptId !== null && typeof openPromptId !== 'string') {
    return null
  }

  return {
    selectedScreen,
    selectedScreenData: {
      promptCollectionId,
      contentOwnerId,
      openPromptId
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
