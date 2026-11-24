import { createCollectionViewState, createWorkspaceTab, type CollectionViewState, type WorkspaceTab } from '@shared/domain/ui-state/TabSession'
import { createDefaultWorkspaceUiState, type WorkspaceUiState } from '@shared/domain/ui-state/UiState'
import { parseWorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { getPromptCollectionCategoryIds, type PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Machine-local parts of a collection location. */
type ViewMachineState = Pick<CollectionViewState, 'scrollTopByMode' | 'treeScrollTopByMode' | 'editorViewStates'> & {
  heights: Record<string, number>
}
/** Portable choices in a collection location. */
type ViewUserState = Omit<CollectionViewState, keyof ViewMachineState | 'accordionSections'> & {
  accordionSections: Array<{ id: string; isExpanded: boolean }>
}
/** Portable session navigation and tab contents. */
export type TabSessionUserState = {
  selectedTabId: string
  tabs: Array<Pick<WorkspaceTab, 'id' | 'collectionId' | 'openPromptId' | 'lastAccessed'> & { search: string; view: ViewUserState }>
  lastClosedCollections: Record<string, ViewUserState>
}
/** Geometry and editor locations, keyed by their tab or collection owner. */
export type TabSessionMachineState = {
  tabs: Record<string, { scrollTop: number; view: ViewMachineState; singlePromptEditorViewStates: Record<string, string> }>
  lastClosedCollections: Record<string, ViewMachineState>
}

/** Separates portable choices from viewport and editor geometry. */
const splitView = (view: CollectionViewState): { user: ViewUserState; machine: ViewMachineState } => {
  /** Pixel geometry is kept out of the portable navigation choices. */
  const { scrollTopByMode, treeScrollTopByMode, editorViewStates, accordionSections, ...choices } = view
  return {
    user: { ...choices, accordionSections: accordionSections.map(({ id, isExpanded }) => ({ id, isExpanded })) },
    machine: { scrollTopByMode, treeScrollTopByMode, editorViewStates,
      heights: Object.fromEntries(accordionSections.map((section) => [section.id, section.configuredExpandedHeightPx])) }
  }
}

/** Reassembles a view, supplying local defaults on a different machine. */
const joinView = (user: ViewUserState, machine?: ViewMachineState): CollectionViewState => ({
  ...createCollectionViewState(), ...user,
  scrollTopByMode: machine?.scrollTopByMode ?? {}, treeScrollTopByMode: machine?.treeScrollTopByMode ?? {},
  editorViewStates: machine?.editorViewStates ?? {},
  accordionSections: user.accordionSections.map((section) => ({ ...section, configuredExpandedHeightPx: machine?.heights[section.id] ?? 1 }))
})

/** Atomically saves both storage scopes of a workspace session. */
export const writeTabSession = (state: WorkspaceUiState): void => {
  /** Portable tab identities and navigation choices. */
  const user: TabSessionUserState = { selectedTabId: state.selectedTabId, tabs: [], lastClosedCollections: {} }
  /** Local geometry for those same identities. */
  const machine: TabSessionMachineState = { tabs: {}, lastClosedCollections: {} }
  for (const tab of state.tabs) {
    /** Both halves belong to this tab, even when another tab shows the same collection. */
    const view = splitView(tab.view)
    user.tabs.push({ id: tab.id, collectionId: tab.collectionId, openPromptId: tab.openPromptId, lastAccessed: tab.lastAccessed, search: tab.newTab.search, view: view.user })
    machine.tabs[tab.id] = { scrollTop: tab.newTab.scrollTop, view: view.machine, singlePromptEditorViewStates: tab.singlePromptEditorViewStates }
  }
  for (const [id, snapshot] of Object.entries(state.lastClosedCollections)) {
    /** Last-closed views have collection ownership rather than tab ownership. */
    const view = splitView(snapshot)
    user.lastClosedCollections[id] = view.user
    machine.lastClosedCollections[id] = view.machine
  }
  SqliteDataAccess.runTransaction(() => {
    WorkspaceStateDataAccess.write(state.workspaceId, 'tab-session-user', null, user)
    WorkspaceStateDataAccess.write(state.workspaceId, 'tab-session-machine', null, machine)
  })
}

/** Loads independently owned portable and local session records. */
export const readTabSession = (workspaceId: string): WorkspaceUiState | null => {
  /** Portable session is required; local geometry can be absent on another machine. */
  const user = WorkspaceStateDataAccess.read(workspaceId, 'tab-session-user', null)
  if (!user) return null
  /** Local geometry is matched by stable tab identity. */
  const machine = WorkspaceStateDataAccess.read(workspaceId, 'tab-session-machine', null)
  return {
    workspaceId, selectedTabId: user.selectedTabId,
    tabs: user.tabs.map((tab) => {
      /** Geometry for this tab only. */
      const local = machine?.tabs[tab.id]
      return { ...createWorkspaceTab(tab.id), collectionId: tab.collectionId, openPromptId: tab.openPromptId,
        lastAccessed: tab.lastAccessed, newTab: { search: tab.search, scrollTop: local?.scrollTop ?? 0 },
        view: joinView(tab.view, local?.view), singlePromptEditorViewStates: local?.singlePromptEditorViewStates ?? {} }
    }),
    lastClosedCollections: Object.fromEntries(Object.entries(user.lastClosedCollections).map(([id, view]) => [id, joinView(view, machine?.lastClosedCollections[id])]))
  }
}

/** Imports the old collection state once; source rows survive any failed transaction for a later retry. */
export const migrateTabSession = (workspaceId: string, collections: PromptCollection[], workspaceInfoPath: string): void => {
  if (readTabSession(workspaceId)) return
  try {
    SqliteDataAccess.runTransaction(() => {
      /** Destination stays unpublished until both storage scopes commit. */
      const state = createDefaultWorkspaceUiState(workspaceId)
      /** Former workspace-wide screen selection. */
      const navigation = WorkspaceStateDataAccess.read(workspaceId, 'workspace-navigation', null)
      /** Parsed legacy selection supplies the initial collection tab. */
      const selection = navigation && parseWorkspaceScreenSelection(navigation.selectedScreen, navigation.selectedScreenData)
      /** Legacy blank tabs belonged to the last open workspace. */
      const application = WorkspaceStateDataAccess.read(null, 'application-machine', null) as (ReturnType<typeof WorkspaceStateDataAccess.read<'application-machine'>> & { workTabs?: Array<{ id: string }> })
      /** Former shared accordion expansion becomes each collection's starting configuration. */
      const accordion = WorkspaceStateDataAccess.read(workspaceId, 'accordion-user', 'sidebar-prompt-statuses')
      /** Legacy accordion heights remain machine-local. */
      const heights = WorkspaceStateDataAccess.read(workspaceId, 'accordion-machine', 'sidebar-prompt-statuses')?.heights ?? {}
      for (const collection of collections) {
        /** Imported collection location becomes its last-closed snapshot. */
        const view = createCollectionViewState()
        /** Portable mode and expansion preferences for this collection. */
        const saved = WorkspaceStateDataAccess.read(workspaceId, 'collection-user', collection.id)
        view.selectedMode = saved?.selectedMode ?? view.selectedMode
        view.shownFinalStatusGroups = saved?.shownFinalStatusGroups ?? {}
        view.scrollTopByMode = WorkspaceStateDataAccess.read(workspaceId, 'collection-machine', collection.id)?.scrollTopByMode ?? {}
        view.accordionSections = (accordion?.sections ?? []).map((section) => ({ ...section, configuredExpandedHeightPx: heights[section.id] ?? 1 }))
        for (const ownerId of [collection.id, ...getPromptCollectionCategoryIds(collection)]) {
          /** Collection and category expansion were previously independent records. */
          const owner = WorkspaceStateDataAccess.read(workspaceId, 'collection-user', ownerId)
          if (owner) view.owners[ownerId] = { treeIsExpanded: owner.treeIsExpanded, contentSectionIsExpanded: owner.contentSectionIsExpanded }
        }
        view.contentOwnerId = selection?.selectedScreen === 'project' && selection.selectedScreenData.promptCollectionId === collection.id
          ? selection.selectedScreenData.contentOwnerId : collection.id
        view.selectedEntryId = WorkspaceStateDataAccess.read(workspaceId, 'collection-user', view.contentOwnerId ?? collection.id)?.selectedEntryId ?? 'collection-header'
        for (const contentId of getMarkdownContentIds(collection)) {
          /** Cursor and internal editor viewport retained from the old persistence system. */
          const editor = WorkspaceStateDataAccess.read(workspaceId, 'markdown-editor', contentId)
          if (editor) view.editorViewStates[contentId] = editor.editorViewStateJson
        }
        state.lastClosedCollections[collection.id] = view
      }
      if (application?.lastWorkspaceInfoPath === workspaceInfoPath) {
        state.tabs = (application.workTabs ?? []).map((tab) => createWorkspaceTab(tab.id))
        state.selectedTabId = application.selectedTabId ?? selection?.selectedScreen ?? 'home'
      } else state.selectedTabId = selection?.selectedScreen ?? 'home'
      if (selection?.selectedScreen === 'project' && selection.selectedScreenData.promptCollectionId) {
        /** Collection formerly displayed outside the tab strip. */
        const collectionId = selection.selectedScreenData.promptCollectionId
        if (state.lastClosedCollections[collectionId]) {
          /** New tab restores the former collection or single-prompt screen. */
          const tab = createWorkspaceTab(`migrated-${collectionId}`)
          tab.collectionId = collectionId
          tab.openPromptId = selection.selectedScreenData.openPromptId
          tab.view = structuredClone(state.lastClosedCollections[collectionId])
          tab.singlePromptEditorViewStates = { ...tab.view.editorViewStates }
          state.tabs.push(tab)
          if (!state.tabs.some((candidate) => candidate.id === state.selectedTabId)) state.selectedTabId = tab.id
        }
      }
      if (!navigation && state.tabs.length === 0) {
        /** A workspace without previous navigation starts with one empty tab. */
        const tab = createWorkspaceTab(`initial-${workspaceId}`)
        state.tabs.push(tab)
        state.selectedTabId = tab.id
      }
      if (!['home', 'settings', 'mockups', 'test-screen', ...state.tabs.map((tab) => tab.id)].includes(state.selectedTabId)) state.selectedTabId = 'home'
      writeTabSession(state)
      for (const type of ['workspace-navigation', 'collection-user', 'collection-machine', 'accordion-user', 'accordion-machine', 'markdown-editor'] as const) {
        WorkspaceStateDataAccess.delete(workspaceId, type, null)
        for (const id of WorkspaceStateDataAccess.listEntityIds(workspaceId, type)) WorkspaceStateDataAccess.delete(workspaceId, type, id)
      }
    })
  } catch (error) {
    console.error('Failed to migrate workspace tab session; retained source state for retry.', error)
  }
}
