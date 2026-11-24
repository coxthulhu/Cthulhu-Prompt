import { getContext, setContext } from 'svelte'
import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { setSettingsCollapsedSectionIdsWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
import { PromptCollectionScreenMode } from '@renderer/features/prompt-collections/promptCollectionScreenMode'
import { PROMPT_STATUS_FOLDER_REGISTRY, type PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
import { createCollectionViewState, createWorkspaceTab, type WorkspaceTab } from '@shared/domain/ui-state/TabSession'
import { createPromptNavigationContextValue } from '@renderer/app/PromptNavigationContext.svelte.ts'
import { captureRegisteredMonacoViewStates } from '@renderer/features/prompt-editor/MonacoViewStateRegistry'
import type { ManageCategoriesDialogOpenOptions } from '@renderer/features/prompt-collections/ManageCategoriesDialog.svelte'

/** Sidebar modes available beside fixed screens and workspace tabs. */
export enum SidebarModeId {
  Collection = 'collection',
  Settings = 'settings'
}

/** Collection dialog openers registered by the tab's collection sidebar. */
type CollectionDialogOpeners = {
  openRenamePromptCollection: (promptCollectionId: string) => void
  openManageCategories: (options?: ManageCategoriesDialogOpenOptions) => void
}

/** Mounted components capture their owning tab rather than looking up the active tab during teardown. */
const TAB_CONTEXT = Symbol('tab-state')
/** Supplies the active tab to separately rendered sidebar and content subtrees. */
export const setTabStateContext = (getTab: () => CollectionSidebarModeData | undefined): void => { setContext(TAB_CONTEXT, getTab) }
/** Captures the tab owning a component at mount time; component galleries have no tab. */
export const getTabStateContext = (): CollectionSidebarModeData | undefined => getContext<(() => CollectionSidebarModeData | undefined) | undefined>(TAB_CONTEXT)?.()

/** One tab's navigation and independently persisted view state. */
export class CollectionSidebarModeData {
  /** Serializable location observed by the workspace session autosave. */
  record = $state<WorkspaceTab>(createWorkspaceTab(''))
  /** Transient reveal requests and selection belong to this tab alone. */
  readonly navigation = createPromptNavigationContextValue()
  /** Called before a collection view is closed, including entry into single-prompt mode. */
  private readonly onCloseCollection: () => void
  /** Rename and category dialogs hosted once by the sidebar, which stays mounted beside both collection screens. */
  private collectionDialogs: CollectionDialogOpeners | null = null

  /** Seeds the tab from its saved record and installs the session-owned close rule. */
  constructor(record = createWorkspaceTab(''), onCloseCollection = () => {}) {
    this.record = record
    this.onCloseCollection = onCloseCollection
  }

  /** Selected collection, absent on the New Tab screen. */
  get collectionId(): string | null { return this.record.collectionId }
  /** Prompt currently occupying the full editor. */
  get openPromptId(): string | null { return this.record.openPromptId }
  /** Status group retained by the collection view. */
  get screenMode(): PromptCollectionScreenMode { return this.record.view.selectedMode as PromptCollectionScreenMode }
  /** Optional finalized status groups visible in this tab. */
  get shownFinalStatusGroups() { return this.record.view.shownFinalStatusGroups }
  /** The tab's collection snapshot, also retained while a single prompt is open. */
  get view() { return this.record.view }
  /** Editor locations for the currently mounted screen. */
  get editorViewStates() { return this.openPromptId ? this.record.singlePromptEditorViewStates : this.view.editorViewStates }

  /** Registers the sidebar's dialog openers and returns the cleanup for its unmount. */
  registerCollectionDialogs = (openers: CollectionDialogOpeners): (() => void) => {
    this.collectionDialogs = openers
    return () => {
      if (this.collectionDialogs === openers) this.collectionDialogs = null
    }
  }

  /** Opens collection rename in the sidebar-hosted dialog. */
  openRenamePromptCollectionDialog = (promptCollectionId: string): void => {
    this.collectionDialogs?.openRenamePromptCollection(promptCollectionId)
  }

  /** Opens category management in the sidebar-hosted dialog, optionally targeting one category. */
  openManageCategoriesDialog = (options?: ManageCategoriesDialogOpenOptions): void => {
    this.collectionDialogs?.openManageCategories(options)
  }

  /** Opens a single prompt after recording the collection's last-closed position if eligible. */
  openPrompt = (promptId: string): void => {
    captureRegisteredMonacoViewStates()
    if (!this.openPromptId) this.onCloseCollection()
    this.record.openPromptId = promptId
  }

  /** Returns to this tab's retained collection location. */
  closeOpenPrompt = (): void => {
    captureRegisteredMonacoViewStates()
    this.record.openPromptId = null
    if (!this.navigation.contentRevealRequests.pending) this.navigation.clear()
  }

  /** Releases the collection while preserving the New Tab screen's search and scroll position. */
  clear = (): void => {
    captureRegisteredMonacoViewStates()
    if (this.collectionId && !this.openPromptId) this.onCloseCollection()
    this.record.collectionId = null
    this.record.openPromptId = null
    this.record.view = createCollectionViewState()
    this.record.singlePromptEditorViewStates = {}
    this.navigation.clear()
  }

  /** Displays a status destination and expands its sidebar section without disturbing its saved height. */
  setScreenMode = (nextMode: PromptCollectionScreenMode): void => {
    if (promptCollectionsCollection.get(this.collectionId ?? '')?.kind !== 'prompt' && nextMode !== 'active' && nextMode !== 'archived') return
    if (this.openPromptId) this.closeOpenPrompt()
    if (PROMPT_STATUS_FOLDER_REGISTRY[nextMode].ordering === 'finalizedAt') this.shownFinalStatusGroups[nextMode] = true
    this.view.selectedMode = nextMode
    this.rememberScreenMode()
    /** Existing section retains its configured height when reopened. */
    const section = this.view.accordionSections.find((entry) => entry.id === nextMode)
    if (section) section.isExpanded = true
  }

  /** Follows an open prompt's workflow without resizing the accordion. */
  followOpenPromptGroup = (nextMode: PromptCollectionScreenMode): void => {
    this.view.selectedMode = nextMode
    this.rememberScreenMode()
  }

  /** Shows a finalized group at the top, or returns from a hidden group to the latest visible one. */
  setFinalStatusGroupShown = (groupId: PromptStatusFolderId, isShown: boolean): void => {
    this.shownFinalStatusGroups[groupId] = isShown
    if (isShown) {
      this.view.scrollTopByMode[groupId] = 0
      this.setScreenMode(groupId as PromptCollectionScreenMode)
    } else if (this.screenMode === groupId) {
      /** Most recent visible destination replaces the hidden status group. */
      const returnMode = this.view.modeHistory.find((mode) => mode !== groupId &&
        (PROMPT_STATUS_FOLDER_REGISTRY[mode].ordering === 'category' || this.shownFinalStatusGroups[mode])) ?? PromptCollectionScreenMode.Active
      this.setScreenMode(returnMode as PromptCollectionScreenMode)
    }
  }

  /** Keeps visit order without duplicate status entries. */
  private rememberScreenMode(): void {
    this.view.modeHistory = [this.screenMode, ...this.view.modeHistory.filter((mode) => mode !== this.screenMode)]
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

/** Sidebar identity and its owning navigation state. */
export type SidebarMode =
  | { id: SidebarModeId.Collection; title: string; data: CollectionSidebarModeData }
  | { id: SidebarModeId.Settings; title: string; data: SettingsSidebarModeData }

/** Creates the fixed settings mode; collection modes belong to individual tabs. */
export const createSidebarModes = () => ({
  [SidebarModeId.Settings]: { id: SidebarModeId.Settings, title: 'System Settings', data: new SettingsSidebarModeData() }
}) satisfies Record<SidebarModeId.Settings, SidebarMode>
