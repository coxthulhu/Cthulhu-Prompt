import { getSelectedWorkspaceId } from '@renderer/app/workspaceSelection.svelte.ts'
import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { setSettingsCollapsedSectionIdsWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
import {
  expandPromptStatusSectionWithAutosave,
  lookupPromptCollectionUiState,
  setPromptCollectionScrollTopWithAutosave,
  setPromptCollectionStatusNavigationWithAutosave
} from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
import { PromptCollectionScreenMode } from '@renderer/features/prompt-collections/promptCollectionScreenMode'
import { PROMPT_STATUS_FOLDER_REGISTRY, type PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'

/** Identifies which overall sidebar mode is displayed, independently of the active screen. */
export enum SidebarModeId {
  /** One collection open in a work tab, with only its title, Show All, and prompt tree. */
  Collection = 'collection',
  Settings = 'settings'
}

/** Collection selection and shared status navigation displayed by one work tab. */
export class CollectionSidebarModeData {
  /** Selected collection of either kind, or null when the project has no collections. */
  collectionId = $state<string | null>(null)
  /** Status group displayed by the collection screen. */
  screenMode = $state<PromptCollectionScreenMode>(PromptCollectionScreenMode.Active)
  /** Selected collection's persisted visibility for toggleable finalized status groups. */
  shownFinalStatusGroups = $state<Partial<Record<PromptStatusFolderId, boolean>>>({})
  /** Most recently visited status groups first, independently for each collection. */
  modeHistoryByCollection = $state<Record<string, PromptStatusFolderId[]>>({})
  /** Prompt or template shown in the single-prompt editor, or null while the collection view is shown. */
  openPromptId = $state<string | null>(null)

  /** Shows one prompt or template of the selected collection in the single-prompt editor. */
  openPrompt = (promptId: string): void => {
    this.openPromptId = promptId
  }

  /** Returns from the single-prompt editor to the collection view. */
  closeOpenPrompt = (): void => {
    this.openPromptId = null
  }

  /** Selects a collection and restores its saved status navigation before its screen mounts. */
  selectCollection(collectionId: string | null, expandSection = true): void {
    this.collectionId = collectionId
    this.openPromptId = null
    const workspaceId = getSelectedWorkspaceId()
    /** Saved navigation defaults to Active with every optional section hidden. */
    const saved = workspaceId && collectionId ? lookupPromptCollectionUiState(workspaceId, collectionId) : null
    this.screenMode = saved?.selectedMode ?? PromptCollectionScreenMode.Active
    this.shownFinalStatusGroups = { ...saved?.shownFinalStatusGroups }
    this.rememberScreenMode()
    if (expandSection && workspaceId && collectionId) {
      expandPromptStatusSectionWithAutosave(workspaceId, this.screenMode)
    }
  }

  /** Returns to New Tab while retaining this tab's collection status history. */
  clear(): void {
    this.selectCollection(null)
  }

  /** Displays a status group, revealing toggleable groups and their sidebar section. */
  setScreenMode = (nextMode: PromptCollectionScreenMode): void => {
    if (promptCollectionsCollection.get(this.collectionId ?? '')?.kind === 'template' && nextMode !== 'active' && nextMode !== 'archived') return
    if (PROMPT_STATUS_FOLDER_REGISTRY[nextMode].ordering === 'finalizedAt') {
      this.shownFinalStatusGroups[nextMode] = true
    }
    this.openPromptId = null
    this.screenMode = nextMode
    this.rememberScreenMode()
    this.persistStatusNavigation()
    /** Every selected destination must be reachable in the sidebar, including restored modes. */
    const workspaceId = getSelectedWorkspaceId()
    if (workspaceId) expandPromptStatusSectionWithAutosave(workspaceId, nextMode)
  }

  /** Follows the open prompt into another category workflow without changing accordion expansion. */
  followOpenPromptGroup = (nextMode: PromptCollectionScreenMode): void => {
    this.screenMode = nextMode
    this.rememberScreenMode()
    this.persistStatusNavigation()
  }

  /** Shows a finalized group, or hides it by returning to the most recently visited visible mode. */
  setFinalStatusGroupShown = (groupId: PromptStatusFolderId, isShown: boolean): void => {
    this.shownFinalStatusGroups[groupId] = isShown
    if (isShown) {
      /** Enabling a sidebar section resets only this collection's destination offset. */
      const workspaceId = getSelectedWorkspaceId()
      if (workspaceId && this.collectionId) {
        setPromptCollectionScrollTopWithAutosave(workspaceId, this.collectionId, groupId, 0)
      }
      this.setScreenMode(groupId)
    } else if (this.screenMode === groupId) {
      /** Hidden finalized groups are skipped; category workflows always remain available. */
      const returnMode = (this.modeHistoryByCollection[this.collectionId ?? ''] ?? []).find(
        (mode) => mode !== groupId &&
          (PROMPT_STATUS_FOLDER_REGISTRY[mode].ordering === 'category' || this.shownFinalStatusGroups[mode])
      ) ?? PromptCollectionScreenMode.Active
      this.setScreenMode(returnMode)
    } else {
      this.persistStatusNavigation()
    }
  }

  /** Records a visit without accumulating duplicate entries in a collection's return history. */
  private rememberScreenMode(): void {
    if (!this.collectionId) return
    this.modeHistoryByCollection[this.collectionId] = [
      this.screenMode,
      ...(this.modeHistoryByCollection[this.collectionId] ?? []).filter((mode) => mode !== this.screenMode)
    ]
  }

  /** Queues the selected mode and shown groups together through the collection autosave. */
  private persistStatusNavigation(): void {
    const workspaceId = getSelectedWorkspaceId()
    if (!workspaceId || !this.collectionId) return
    setPromptCollectionStatusNavigationWithAutosave(
      workspaceId, this.collectionId, this.screenMode, this.shownFinalStatusGroups
    )
  }
}

/** Settings tree highlight, collapse state, and scroll requests shared with the settings screen. */
export class SettingsSidebarModeData {
  /** Highlighted settings tree entry, set by a tree click and cleared by user scrolling. */
  selectedRowId = $state<string | null>(null)
  /** Collapsed sections, seeded from the machine-scoped persistence that this mode autosaves. */
  collapsedSectionIds = $state([...userPersistenceCollection.get(USER_PERSISTENCE_ID)!.settingsCollapsedSectionIds])
  /** Settings screen scroll requests for one tree entry. */
  readonly scrollRequests = createConsumableRequestCoordinator<{ rowId: string }>()

  /** Expands or collapses one section and autosaves the collapsed section list. */
  setSectionExpanded = (sectionId: string, isExpanded: boolean): void => {
    this.collapsedSectionIds = isExpanded
      ? this.collapsedSectionIds.filter((id) => id !== sectionId)
      : [...this.collapsedSectionIds, sectionId]
    setSettingsCollapsedSectionIdsWithAutosave(this.collapsedSectionIds)
  }

  /** Highlights a tree entry and scrolls the settings screen to it. */
  selectRow = (rowId: string): void => {
    this.selectedRowId = rowId
    this.scrollRequests.request({ rowId })
  }
}

/** One sidebar mode: its identity, header title, and the state it shares with its screens. */
export type SidebarMode =
  | { id: SidebarModeId.Collection; title: string; data: CollectionSidebarModeData }
  | { id: SidebarModeId.Settings; title: string; data: SettingsSidebarModeData }

/** Creates the shared sidebar modes once so their data survives screen switches; each work tab owns its collection mode's data. */
export const createSidebarModes = () => ({
  [SidebarModeId.Settings]: { id: SidebarModeId.Settings, title: 'System Settings', data: new SettingsSidebarModeData() }
}) satisfies Record<SidebarModeId.Settings, SidebarMode>
