<script lang="ts">
  import ManageProjectsDialog from '@renderer/features/projects/ManageProjectsDialog.svelte'
  import { getWorkspaceCollectionEntries } from '@shared/domain/workspace/Project'
  import { tick, untrack } from 'svelte'
  import { clearWorkspaceMonacoModels } from '@renderer/common/Monaco'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import AppOverlays from './AppOverlays.svelte'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import WelcomeDialog from '@renderer/features/home/WelcomeDialog.svelte'
  import MockupsScreen from '@renderer/features/mockups/MockupsScreen.svelte'
  import { hasMockup } from '@renderer/features/mockups/mockupCatalog'
  import { screens, type ScreenId } from './screens'
  import PromptCollectionScreen from '../features/prompt-collections/PromptCollectionScreen.svelte'
  import SinglePromptScreen from '../features/prompt-collections/SinglePromptScreen.svelte'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import NewTabScreen from '@renderer/features/new-tab/NewTabScreen.svelte'
  import {
    CollectionSidebarModeData,
    setTabStateContext,
    createSidebarModes,
    SidebarModeId,
    type SidebarMode
  } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import type { WorkspaceSelectionResult } from '@renderer/features/workspace/types'
  import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/app/workspaceSelection.svelte.ts'
  import { syncLastWorkspaceInfoPath } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { setWorkspaceUiStateWithAutosave } from '@renderer/data/Mutations/WorkspaceUiStateMutations'
  import {
    setAppSidebarExpandedWithAutosave,
    setApplicationNavigationWithAutosave,
    setAppSidebarWidthWithAutosave
  } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
  import { loadWorkspaceUiState } from '@renderer/data/Queries/WorkspaceUiStateQuery'
  import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
  import {
    closeWorkspace as closeWorkspaceMutation,
    createWorkspace,
    renameWorkspace
  } from '@renderer/data/Mutations/WorkspaceMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setWorkspaceSelectionContext,
    type WorkspaceSelectionContext
  } from './WorkspaceSelectionContext'
  import {
    createPromptNavigationContextValue,
    promptNavigationRowToPersistedEntryId,
    setPromptNavigationContext
  } from './PromptNavigationContext.svelte.ts'
  import { flushAllAutosaves } from '@renderer/data/UiState/autosave/AutosaveFlushes.svelte.ts'
  import { captureRegisteredMonacoViewStates } from '@renderer/features/prompt-editor/MonacoViewStateRegistry'
  import { createCollectionViewState, createWorkspaceTab, pruneCollectionTabViews, type CollectionViewState, type WorkspaceTab } from '@shared/domain/ui-state/TabSession'
  import { getPromptCollectionCategoryIds } from '@shared/domain/prompt-collection/PromptCollection'
  import { notesCollection } from '@renderer/data/Collections/NotesCollection'
  import { AUTOSAVE_MS } from '@renderer/data/UiState/autosave/draftAutosave'
  import {
    USER_PERSISTENCE_ID,
    type WorkTab
  } from '@shared/domain/user-persistence/UserPersistence'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import type { Prompt } from '@shared/domain/prompt/Prompt'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
  import type { SystemSettings } from '@shared/domain/settings/SystemSettings'
  import type { Workspace } from '@shared/domain/workspace/Workspace'
  import { compactGuid } from '@shared/utilities/compactGuid'
  import AppUpdatesPopup from '@renderer/features/updates/AppUpdatesPopup.svelte'
  import { createAppUpdates } from '@renderer/features/updates/appUpdates.svelte'

  type PromptCollectionScreenHandle = {
    openDeletePromptCollectionDialog: (promptCollectionId: string) => void
  }

  const runtimeConfig = getRuntimeConfig()
  const isDevMode = isDevOrPlaywrightEnvironment()
  const baseWindowTitle = 'Cthulhu Prompt'
  const executionFolderName = runtimeConfig.executionFolderName
  const systemSettingsQuery = useLiveQuery((q) =>
    q.from({ settings: systemSettingsCollection }).findOne()
  ) as { data: SystemSettings }
  const systemSettings: SystemSettingsContext = {
    get promptFontSize() {
      return systemSettingsQuery.data.promptFontSize
    },
    get promptEditorMinLines() {
      return systemSettingsQuery.data.promptEditorMinLines
    },
    get promptEditorMaxLines() {
      return systemSettingsQuery.data.promptEditorMaxLines
    },
    /** Shares the persisted note line reservation with every editor. */
    get attachedNoteReservedLines() {
      return systemSettingsQuery.data.attachedNoteReservedLines
    },
    get showLineNumbers() {
      return systemSettingsQuery.data.showLineNumbers
    },
    /** Exposes the current creation focus preference to prompt and template editors. */
    get newPromptFocus() {
      return systemSettingsQuery.data.newPromptFocus
    },
    /** Keeps the shared settings context consistent with the persisted settings shape. */
    get automaticUpdates() {
      return systemSettingsQuery.data.automaticUpdates
    },
    /** Keeps the shared settings context consistent with the persisted settings shape. */
    get updateChannel() {
      return systemSettingsQuery.data.updateChannel
    }
  }
  const workspaceSelection: WorkspaceSelectionContext = {
    get selectedWorkspaceId() {
      return getSelectedWorkspaceId()
    }
  }
  const promptNavigation = createPromptNavigationContextValue()
  const windowControls = window.windowControls
  /** Returns the startup-loaded user persistence singleton. */
  const getUserPersistence = () => userPersistenceCollection.get(USER_PERSISTENCE_ID)!
  const appSidebarDefaultWidthPx = getUserPersistence().appSidebarWidthPx
  /** Startup decision retained while workspace restoration updates preferences. */
  const needsWelcome = !getUserPersistence().hasShownWelcome
  /** Welcome visibility shared with Home after startup restoration completes. */
  let showWelcomeDialog = $state(false)
  /** Home's open-failure dialog visibility, raised here when a double-clicked workspace fails. */
  let showWorkspaceOpenErrorDialog = $state(false)
  /** Failure details shown by Home's open-failure dialog. */
  let workspaceOpenErrorText = $state('')
  /** Restores the user's expansion preference for screens that provide a sidebar. */
  let sidebarExpanded = $state(getUserPersistence().appSidebarExpanded)

  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptCollectionQuery = useLiveQuery((q) =>
    q.from({ promptCollection: promptCollectionsCollection })
  ) as { data: PromptCollection[] }
  /** Prompts and templates whose titles name work tabs with a prompt open. */
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  /** Loaded note identities preserve valid attached-editor locations during deletion cleanup. */
  const noteQuery = useLiveQuery(notesCollection)
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as { data: PromptTemplate[] }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)
  setPromptNavigationContext(() => selectedWorkTab?.mode.navigation ?? promptNavigation)
  setTabStateContext(() => selectedWorkTab?.mode)

  let activeScreen = $state<ScreenId>('home')
  /** One open work tab and the collection state it shows; it shows its New Tab screen while no collection is selected. */
  type OpenWorkTab = { id: string; mode: CollectionSidebarModeData }
  /** Builds a work tab showing its New Tab screen. */
  const createWorkTab = (record: WorkspaceTab): OpenWorkTab => {
    /** The callback closes this specific tab even when it is in the background. */
    const tab: OpenWorkTab = { id: record.id, mode: new CollectionSidebarModeData(record, () => rememberClosedCollection(tab)) }
    return tab
  }
  /** Describes a work tab on its New Tab screen to the title bar and to persistence. */
  const toNewTab = (id: string): WorkTab => ({ id, title: 'New Tab', screen: 'new-tab' })
  /** Open work tabs in display order, restored from the workspace session. */
  let workTabs = $state<OpenWorkTab[]>([])
  /** Last collection views closed by the user, independent of open tab locations. */
  let lastClosedCollections = $state<Record<string, CollectionViewState>>({})
  /** Workspace replacement must not autosave the intermediate empty tab list. */
  let restoringSession = $state(false)
  /** Work tab whose screen is shown while the work tab screen is active. */
  let selectedWorkTabId = $state<string | null>(null)
  /** Selected work tab, or undefined while another screen is active. */
  const selectedWorkTab = $derived(
    activeScreen === 'work-tab' ? workTabs.find((tab) => tab.id === selectedWorkTabId) : undefined
  )
  /** Work tabs as the title bar shows them: a collection tab is named after its open prompt, else its collection. */
  const titleBarWorkTabs = $derived(workTabs.map((tab): WorkTab => {
    /** Collection the tab shows, absent on its New Tab screen. */
    const collection = selectedWorkspacePromptCollections.find((candidate) => candidate.id === tab.mode.collectionId)
    if (!collection) return toNewTab(tab.id)
    /** Prompt or template open in the tab's single-prompt editor, if any. */
    const openPrompt = tab.mode.openPromptId
      ? [...promptQuery.data, ...promptTemplateQuery.data].find((content) => content.id === tab.mode.openPromptId)
      : undefined
    return {
      id: tab.id,
      title: openPrompt ? getPromptDisplayTitle(openPrompt) : collection.displayName,
      screen: collection.kind === 'template' ? 'template-collection' : 'prompt-collection'
    }
  }))
  /** Selected title bar tab: the shown work tab or fixed screen. */
  const selectedTabId = $derived(
    activeScreen === 'work-tab' ? selectedWorkTabId : activeScreen
  )
  /** Shared sidebar modes, created once so each mode's data survives screen switches. */
  const sidebarModes = createSidebarModes()
  /** Sidebar mode displayed beside the active screen; a work tab shows its collection mode only while a collection is open. */
  const activeSidebarMode = $derived.by((): SidebarMode | null => {
    const modeId = screens[activeScreen].sidebarMode
    if (modeId === SidebarModeId.Collection) {
      /** Collection shown by the selected work tab, absent on its New Tab screen. */
      const collection = selectedWorkspacePromptCollections.find(
        (candidate) => candidate.id === selectedWorkTab?.mode.collectionId
      )
      return collection ? { id: modeId, title: collection.displayName, data: selectedWorkTab!.mode } : null
    }
    return modeId === null ? null : sidebarModes[modeId]
  })
  /** Screens without a sidebar always use the collapsed layout, including programmatic navigation. */
  const isAppSidebarExpanded = $derived(activeSidebarMode !== null && sidebarExpanded)
  let selectedMockupId = $state<string | null>(getUserPersistence().selectedMockupId)
  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = getSelectedWorkspaceId()

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })
  const workspacePath = $derived(selectedWorkspace?.workspacePath ?? null)
  const selectedWorkspacePromptCollections = $derived.by(() => {
    if (!selectedWorkspace) {
      return []
    }

    const promptCollectionById = new SvelteMap<string, PromptCollection>()
    for (const promptCollection of promptCollectionQuery.data) {
      if (promptCollection) {
        promptCollectionById.set(promptCollection.id, promptCollection)
      }
    }

    return getWorkspaceCollectionEntries(selectedWorkspace)
      .map((entry) => entry.id)
      .map((promptCollectionId) => promptCollectionById.get(promptCollectionId))
      .filter((promptCollection): promptCollection is PromptCollection => promptCollection !== undefined)
  })
  const workspacePromptCount = $derived.by(() => {
    const promptIds = new SvelteSet<string>()
    for (const promptCollection of selectedWorkspacePromptCollections) {
      for (const promptId of getMarkdownContentIds(promptCollection, promptCollection.kind)) {
        promptIds.add(promptId)
      }
    }

    return promptIds.size
  })
  const workspacePromptCollectionCount = $derived(selectedWorkspacePromptCollections.length)
  /** Welcome targets the first task collection named My Prompts in workspace order. */
  const myPrompts = $derived(selectedWorkspacePromptCollections.find(
    (collection) => collection.kind === 'prompt' && collection.displayName === 'My Prompts'
  ))
  /** Mounted prompt-collection screen used for sidebar actions owned by that screen. */
  let promptCollectionScreen = $state<PromptCollectionScreenHandle | null>(null)
  /** Shell-owned project management opened from the New Tab screen. */
  let manageProjectsDialog = $state<ManageProjectsDialog | null>(null)
  const isWorkspaceReady = $derived(Boolean(selectedWorkspace))
  let workspaceActionCount = $state(0)
  const isWorkspaceLoading = $derived(workspaceActionCount > 0)
  const STARTUP_LOADING_OVERLAY_FADE_MS = uiAnimationDurationMs.standard
  type StartupRestorePhase = 'pending' | 'restoring' | 'ready'
  let startupRestorePhase = $state<StartupRestorePhase>('pending')
  const startupRestoreOverlay = createLoadingOverlayState({
    fadeMs: STARTUP_LOADING_OVERLAY_FADE_MS,
    startsVisible: true,
    isLoading: () => startupRestorePhase !== 'ready'
  })
  /** Native pickers and Welcome follow-up actions defer unsolicited update notifications. */
  let homeWorkflowBusy = $state(false)
  /** Shell-owned updater survives screen changes and shares close-time save preparation. */
  const updater = createAppUpdates(
    () => !startupRestoreOverlay.isVisible() && !showWelcomeDialog && !homeWorkflowBusy && !isWorkspaceLoading,
    async () => {
      captureTabState()
      saveTabSession()
      captureRegisteredMonacoViewStates()
      await flushAllAutosaves()
    }
  )
  /** Title bar toggle that anchors the updater popup and is never treated as an outside press. */
  let updatesButton = $state<HTMLButtonElement>()
  const windowTitle = $derived(
    isDevMode && executionFolderName
      ? `${baseWindowTitle} — ${executionFolderName}`
      : baseWindowTitle
  )
  const isWindows = window.electron?.process?.platform === 'win32'

  const extractErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const beginWorkspaceAction = () => {
    workspaceActionCount += 1
  }

  const endWorkspaceAction = () => {
    workspaceActionCount -= 1
  }

  /** Captures the visible row and Monaco positions before a tab leaves its mounted screen. */
  const captureTabState = (tab = selectedWorkTab): void => {
    captureRegisteredMonacoViewStates()
    if (!tab || tab.mode.openPromptId) return
    /** Selection coordinator belongs to the departing tab. */
    const navigation = tab.mode.navigation
    if (navigation.contentOwnerId && navigation.selectedRow) {
      tab.mode.view.contentOwnerId = navigation.contentOwnerId
      tab.mode.view.selectedEntryId = promptNavigationRowToPersistedEntryId(navigation.selectedRow)
    }
  }

  /** Saves only the last closing collection view; single-prompt tabs are not open collection views. */
  const rememberClosedCollection = (tab: OpenWorkTab): void => {
    captureTabState(tab)
    /** Only the final nonsingle view updates this collection's remembered position. */
    const collectionId = tab.mode.collectionId
    if (!collectionId || tab.mode.openPromptId || workTabs.some((other) => other.id !== tab.id && other.mode.collectionId === collectionId && !other.mode.openPromptId)) return
    lastClosedCollections[collectionId] = globalThis.structuredClone($state.snapshot(tab.mode.view))
  }

  /** Queues the complete workspace session through the existing authoritative autosave flow. */
  const saveTabSession = (): void => {
    /** Session writes always belong to the currently loaded workspace. */
    const workspaceId = getSelectedWorkspaceId()
    if (!workspaceId || restoringSession) return
    /** Snapshot is read reactively; writing it must not subscribe this effect to the mutation queue. */
    const session = {
      workspaceId, tabs: workTabs.map((tab) => $state.snapshot(tab.mode.record)),
      selectedTabId: selectedTabId ?? 'home', lastClosedCollections: $state.snapshot(lastClosedCollections)
    }
    untrack(() => setWorkspaceUiStateWithAutosave(session, AUTOSAVE_MS))
  }

  /** Saves the current workspace before releasing its data and navigation caches. */
  const closeSelectedWorkspace = async (): Promise<void> => {
    captureTabState()
    saveTabSession()
    restoringSession = true
    await closeWorkspaceMutation()
    workTabs = []
    lastClosedCollections = {}
    selectedWorkTabId = null
    activeScreen = 'home'
    promptNavigation.clear()
    restoringSession = false
    // Side effect: let workspace editors unmount before releasing their Monaco models.
    await tick()
    await clearWorkspaceMonacoModels()
  }

  const resetWorkspaceState = async () => {
    await runIpcBestEffort(closeSelectedWorkspace)
  }

  const loadWorkspaceSelection = async (workspaceInfoPath: string): Promise<void> => {
    await closeSelectedWorkspace()
    const loadedWorkspace = await loadWorkspaceByPath(workspaceInfoPath)
    await loadWorkspaceUiState(loadedWorkspace.workspaceId)
    setSelectedWorkspaceId(loadedWorkspace.workspaceId)
    await restoreWorkspaceScreenFromPersistence()
    await syncLastWorkspaceInfoPath(loadedWorkspace.workspaceInfoPath)
  }

  /** Restores this workspace's tabs and selected screen for every workspace-opening route. */
  const restoreWorkspaceScreenFromPersistence = async (): Promise<void> => {
    /** Workspace state has already loaded before its tabs are created. */
    const workspaceId = getSelectedWorkspaceId()!
    /** Authoritative session is cloned into independent reactive tab records. */
    const session = workspaceUiStateCollection.get(workspaceId)!
    restoringSession = true
    workTabs = session.tabs.map((record) => createWorkTab(globalThis.structuredClone(record)))
    lastClosedCollections = globalThis.structuredClone(session.lastClosedCollections)
    /** A saved fixed-screen selection has no matching work tab. */
    const tab = workTabs.find((candidate) => candidate.id === session.selectedTabId)
    selectedWorkTabId = tab?.id ?? null
    activeScreen = tab ? 'work-tab' : session.selectedTabId in screens ? session.selectedTabId as ScreenId : 'home'
    if (screens[activeScreen].devOnly && !isDevMode) activeScreen = 'home'
    if (selectedMockupId && !hasMockup(selectedMockupId)) selectedMockupId = null
    // Let restored components mount before autosaving their locations.
    await tick()
    restoringSession = false
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const restoreWorkspaceFromPersistence = async (): Promise<void> => {
    const lastWorkspaceInfoPath = getUserPersistence().lastWorkspaceInfoPath

    if (!lastWorkspaceInfoPath) {
      return
    }

    const selectionResult = await selectWorkspace(lastWorkspaceInfoPath)
    if (selectionResult.success) return

    if (isWorkspaceMissingError(selectionResult.message)) {
      await syncLastWorkspaceInfoPath(null)
      console.error('Failed to restore last workspace. Cleared persisted path.', {
        workspaceInfoPath: lastWorkspaceInfoPath,
        error: selectionResult.message
      })
      return
    }

    activeScreen = 'home'
    workspaceOpenErrorText = selectionResult.message
    showWorkspaceOpenErrorDialog = true
    console.error('Failed to restore last workspace.', {
      workspaceInfoPath: lastWorkspaceInfoPath,
      error: selectionResult.message
    })
  }

  const selectWorkspace = async (workspaceInfoPath: string): Promise<WorkspaceSelectionResult> => {
    beginWorkspaceAction()

    try {
      await loadWorkspaceSelection(workspaceInfoPath)
      return { success: true }
    } catch (error) {
      const message = extractErrorMessage(error)
      const workspaceMissing = isWorkspaceMissingError(message)
      await resetWorkspaceState()
      return {
        success: false,
        message: workspaceMissing
          ? 'Invalid workspace path'
          : (message ?? 'Failed to open workspace')
      }
    } finally {
      endWorkspaceAction()
    }
  }

  /** Loads the managed file returned by Create or Rename with its saved tabs and screen. */
  const saveAndOpenWorkspace = async (
    save: () => Promise<{ path: string }>
  ): Promise<WorkspaceSelectionResult> => {
    beginWorkspaceAction()

    try {
      /** The main process returns the final filename after committing the change. */
      const { path } = await save()
      await loadWorkspaceSelection(path)
      return { success: true }
    } catch (error) {
      return { success: false, message: extractErrorMessage(error) ?? 'Failed to save workspace' }
    } finally {
      endWorkspaceAction()
    }
  }

  const closeWorkspace = async (): Promise<void> => {
    beginWorkspaceAction()

    try {
      await runIpcBestEffort(closeSelectedWorkspace)
      await runIpcBestEffort(() => syncLastWorkspaceInfoPath(null))
    } finally {
      endWorkspaceAction()
    }
  }

  // Side effect: restore the previous workspace once from the bootstrap-loaded user persistence.
  $effect(() => {
    if (startupRestorePhase !== 'pending') {
      return
    }

    startupRestorePhase = 'restoring'
    void (async () => {
      try {
        await restoreWorkspaceFromPersistence()
        if (!getSelectedWorkspaceId()) {
          /** Fixed screens can also restore without an open workspace. */
          const savedScreen = getUserPersistence().selectedTabId
          activeScreen = savedScreen && savedScreen in screens && savedScreen !== 'work-tab' ? savedScreen as ScreenId : 'home'
        }
      } catch (error) {
        console.error('Failed to restore workspace from user persistence.', error)
      } finally {
        startupRestorePhase = 'ready'
        showWelcomeDialog = needsWelcome
      }
    })()
  })

  // Side effect: persist each tab's location, search, and access order once restoration completes.
  $effect(() => {
    if (startupRestorePhase !== 'ready' || restoringSession) return
    saveTabSession()
  })

  // Side effect: deleted collections release all their tab views and last-closed snapshots.
  $effect(() => {
    /** Current collection identities exclude deleted or externally removed collections. */
    const ids = new Set(selectedWorkspacePromptCollections.map((collection) => collection.id))
    for (const tab of workTabs) {
      if (tab.mode.collectionId && !ids.has(tab.mode.collectionId)) untrack(() => {
        delete lastClosedCollections[tab.mode.collectionId!]
        tab.mode.record.collectionId = null
        tab.mode.clear()
      })
    }
    for (const id of Object.keys(lastClosedCollections)) if (!ids.has(id)) untrack(() => { delete lastClosedCollections[id] })
    for (const collection of selectedWorkspacePromptCollections) {
      /** Ownership is available in collection summaries even when no editor has been loaded. */
      const categoryIds = getPromptCollectionCategoryIds(collection)
      /** Current content IDs repair single-prompt tabs and retained row selections after deletion. */
      const contentIds = getMarkdownContentIds(collection, collection.kind)
      /** Notes are loaded with the workspace before its tab session is restored. */
      const noteIds = noteQuery.data.map((note) => note.id)
      untrack(() => pruneCollectionTabViews({ tabs: workTabs.map((tab) => tab.mode.record), lastClosedCollections }, collection.id, categoryIds, contentIds, noteIds))
    }
  })

  // Side effect: keep the browser window title in sync with dev mode state.
  $effect(() => {
    document.title = windowTitle
  })

  // Side effect: fixed-screen selection and mockup selection also work without a workspace.
  $effect(() => {
    if (startupRestorePhase !== 'ready') return
    /** Without a workspace, the application falls back to Home instead of a work tab. */
    const screen = activeScreen === 'work-tab' ? 'home' : activeScreen
    /** Mockup selection is application-wide. */
    const mockupId = selectedMockupId
    untrack(() => setApplicationNavigationWithAutosave(screen, mockupId))
  })

  // Side effect: flush pending autosaves before allowing the main process to close the window.
  $effect(() => {
    const unsubscribe = windowControls.onCloseRequested(() => {
      void (async () => {
        captureTabState()
        saveTabSession()
        captureRegisteredMonacoViewStates()
        await flushAllAutosaves()
        await windowControls.confirmClose()
      })()
    })

    return () => {
      unsubscribe()
    }
  })

  /** Selects a fixed screen after capturing the departing tab. */
  const navigateToScreen = (screen: ScreenId): void => {
    if (screens[screen].devOnly && !isDevMode) return
    if (screens[screen].requiresWorkspace && !isWorkspaceReady) return
    captureTabState()
    selectedWorkTabId = null
    activeScreen = screen
  }

  /** Applies and saves the sidebar expansion preference shared by Settings and collection tabs. */
  const setSidebarExpanded = (expanded: boolean): void => {
    sidebarExpanded = expanded
    setAppSidebarExpandedWithAutosave(expanded)
  }

  /** Switches screens and opens the sidebar; re-clicking the selected screen does nothing. */
  const activateFixedScreen = (screen: ScreenId): void => {
    if (screen === selectedTabId) return

    navigateToScreen(screen)
    setSidebarExpanded(true)
  }

  /** Selects a work tab, which shows its New Tab, collection, or single-prompt screen. */
  const selectWorkTab = (tabId: string): void => {
    /** Switching to a collection exposes its sidebar; repeated selection preserves the preference. */
    const changedTab = selectedTabId !== tabId
    navigateToScreen('work-tab')
    selectedWorkTabId = tabId
    /** Selected tab receives the next access-order value. */
    const tab = workTabs.find((candidate) => candidate.id === tabId)!
    if (changedTab && tab.mode.collectionId) {
      setSidebarExpanded(true)
    }
    tab.mode.record.lastAccessed = Math.max(0, ...workTabs.map((candidate) => candidate.mode.record.lastAccessed)) + 1
  }

  /** Appends a New Tab after every open tab and selects it. */
  const addWorkTab = (): void => {
    /** Fresh tabs intentionally inherit no search or viewport state. */
    const tab = createWorkTab(createWorkspaceTab(compactGuid(globalThis.crypto.randomUUID())))
    workTabs = [...workTabs, tab]
    selectWorkTab(tab.id)
  }

  /** Opens an independent collection view, seeded from the latest eligible tab or last closed location. */
  const openCollectionInWorkTab = (collectionId: string): void => {
    /** The selected New Tab becomes this independent collection view. */
    const tab = selectedWorkTab!
    /** Most recently accessed collection view supplies the starting location; single prompts are excluded. */
    const source = workTabs.filter((other) => other.id !== tab.id && other.mode.collectionId === collectionId && !other.mode.openPromptId)
      .sort((left, right) => right.mode.record.lastAccessed - left.mode.record.lastAccessed)[0]
    tab.mode.record.view = globalThis.structuredClone($state.snapshot(source?.mode.view ?? lastClosedCollections[collectionId] ?? createCollectionViewState()))
    tab.mode.record.collectionId = collectionId
    tab.mode.record.openPromptId = null
    tab.mode.record.lastAccessed = Math.max(0, ...workTabs.map((other) => other.mode.record.lastAccessed)) + 1
    setSidebarExpanded(true)
  }

  /** Reuses a My Prompts collection tab, opens the collection, or leaves a new tab ready to pick one. */
  const openWelcomeTab = (): void => {
    /** A full-screen prompt tab keeps its independent editor location. */
    const existing = myPrompts && workTabs.find((tab) => tab.mode.collectionId === myPrompts.id && !tab.mode.openPromptId)
    if (existing) {
      selectWorkTab(existing.id)
      return
    }
    addWorkTab()
    if (myPrompts) openCollectionInWorkTab(myPrompts.id)
  }

  /** Closes a work tab; closing the selected tab selects its right neighbour, else its left, else Home. */
  const closeWorkTab = (tabId: string): void => {
    /** Selection is read before removal, which would otherwise fall back to Home. */
    const closingTab = workTabs.find((tab) => tab.id === tabId)!
    rememberClosedCollection(closingTab)
    const wasSelected = selectedTabId === tabId
    /** Position the right neighbour moves into once the tab is removed. */
    const index = workTabs.findIndex((tab) => tab.id === tabId)
    workTabs = workTabs.filter((tab) => tab.id !== tabId)
    /** Right neighbour, or the left one when the closed tab was rightmost; Home is selected without either. */
    const nextTab = workTabs[index] ?? workTabs[index - 1]
    if (!wasSelected) return
    if (nextTab) selectWorkTab(nextTab.id)
    else navigateToScreen('home')
  }

  /** Moves a dragged work tab into the given display slot; the tab state effect saves the new order. */
  const moveWorkTab = (tabId: string, index: number): void => {
    /** Tabs other than the dragged one, in display order. */
    const otherTabs = workTabs.filter((tab) => tab.id !== tabId)
    workTabs = [...otherTabs.slice(0, index), workTabs.find((tab) => tab.id === tabId)!, ...otherTabs.slice(index)]
  }

  /** Returns the selected tab from a single prompt to its collection. */
  const navigateToScreenCollection = (): void => { selectedWorkTab?.mode.closeOpenPrompt() }

  /** Navigates to the selected collection and opens its screen-owned deletion flow after it mounts. */
  const requestSelectedPromptCollectionDelete = (promptCollectionId: string): void => {
    if (!selectedWorkspacePromptCollections.some((collection) => collection.id === promptCollectionId)) return
    navigateToScreenCollection()
    // Side effect: wait for navigation to mount the selected collection screen before opening its dialog.
    void (async () => {
      await tick()
      promptCollectionScreen?.openDeletePromptCollectionDialog(promptCollectionId)
    })()
  }
</script>

<!-- Single-prompt or collection screen for a work tab's collection state, which must have a
     collection selected; deleting that collection calls onPromptCollectionDeleted. -->
{#snippet collectionScreen(modeData: CollectionSidebarModeData, onPromptCollectionDeleted: () => void)}
  {#if modeData.openPromptId}
    {#key `${modeData.record.id}:${modeData.collectionId}:${modeData.openPromptId}`}
      <SinglePromptScreen sidebarModeData={modeData} />
    {/key}
  {:else}
    {#key `${modeData.record.id}:${modeData.collectionId}:${modeData.screenMode}`}
      <PromptCollectionScreen bind:this={promptCollectionScreen} sidebarModeData={modeData} {onPromptCollectionDeleted} />
    {/key}
  {/if}
{/snippet}

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar {selectedTabId} workTabs={titleBarWorkTabs} canAddWorkTab={isWorkspaceReady} {isDevMode} {executionFolderName} onNavigate={activateFixedScreen}
      hasSidebar={activeSidebarMode !== null} {isAppSidebarExpanded} onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
      onSelectWorkTab={selectWorkTab} onAddWorkTab={addWorkTab} onCloseWorkTab={closeWorkTab} onMoveWorkTab={moveWorkTab}
      bind:updatesButton updatesOpen={updater.updates.open} updateAvailable={updater.updates.snapshot?.hasUpdate ?? false}
      onToggleUpdates={() => {
        if (updater.updates.snapshot?.status === 'restarting') return
        if (updater.updates.open) updater.dismiss()
        updater.updates.open = !updater.updates.open
      }} />
  {/if}

  <div class="sidebarSurface flex min-h-0 flex-1">
    <ResizableSidebar
      isSidebarVisible={isAppSidebarExpanded}
      defaultWidth={appSidebarDefaultWidthPx}
      minWidth={240}
      maxWidth={400}
      handleTestId="app-sidebar-resize-handle"
      containerClass="min-w-0 flex-1 min-h-0"
      sidebarBorderClass="sidebarFrameBorder border-r"
      onDesiredWidthChange={(nextDesiredWidth) => {
        setAppSidebarWidthWithAutosave(nextDesiredWidth)
      }}
    >
      {#snippet sidebar()}
        {#if activeSidebarMode}
          {#key selectedTabId}
          <AppSidebar
            mode={activeSidebarMode}
            {isWorkspaceReady}
            {isWorkspaceLoading}
            onScreenCollectionSelect={navigateToScreenCollection}
            onDeleteSelectedPromptCollection={requestSelectedPromptCollectionDelete}
            onShowAll={() => selectedWorkTab!.mode.clear()}
          />
          {/key}
        {/if}
      {/snippet}

      {#snippet content()}
        <div
          class="mainScreenSurface sidebarFrameBorder bg-background relative flex w-full min-h-0 flex-1 flex-col border-t"
        >
          {#if activeScreen === 'home'}
            <HomeScreen
              onShowWelcome={() => { showWelcomeDialog = true }}
              bind:showWorkspaceOpenErrorDialog
              bind:workspaceOpenErrorText
              {workspacePath}
              workspaceName={selectedWorkspace?.workspaceName}
              {isWorkspaceReady}
              {isWorkspaceLoading}
              promptCount={workspacePromptCount}
              promptCollectionCount={workspacePromptCollectionCount}
              hasWorkTabs={workTabs.length > 0}
              onAddWorkTab={addWorkTab}
              onWorkspaceSelect={selectWorkspace}
              onWorkspaceCreate={(name, examples) => saveAndOpenWorkspace(() => createWorkspace(name, examples))}
              onWorkspaceRename={(name) => saveAndOpenWorkspace(() => renameWorkspace(selectedWorkspace!.id, name))}
              onWorkspaceClear={() => void closeWorkspace()}
              onWorkflowBusy={(busy) => { homeWorkflowBusy = busy }}
            />
          {:else if activeScreen === 'settings'}
            <SettingsScreen sidebarModeData={sidebarModes[SidebarModeId.Settings].data} />
          {:else if activeScreen === 'mockups'}
            <MockupsScreen bind:activeMockupId={selectedMockupId} />
          {:else if activeScreen === 'work-tab' && selectedWorkspace && selectedWorkTab}
            <!-- The keyed item retains its owning tab through teardown after selection or removal. -->
            {#each [selectedWorkTab] as tab (tab.id)}
            {#if tab.mode.collectionId}
              {@render collectionScreen(tab.mode, tab.mode.clear)}
            {:else}
              <NewTabScreen
                viewState={tab.mode.record.newTab}
                workspace={selectedWorkspace}
                openCollectionIds={workTabs.flatMap((tab) => tab.mode.collectionId ?? [])}
                onOpenCollection={openCollectionInWorkTab}
                onCreateProject={() => manageProjectsDialog?.openDialog({ createProject: true })}
                onEditProject={(projectId) => manageProjectsDialog?.openDialog({ projectId })}
              />
            {/if}
            {/each}
          {:else if activeScreen === 'test-screen'}
            <TestScreen />
          {/if}
        </div>
      {/snippet}
    </ResizableSidebar>
  </div>
</div>

<ManageProjectsDialog bind:this={manageProjectsDialog} workspace={selectedWorkspace} />

{#if showWelcomeDialog}
  <WelcomeDialog bind:open={showWelcomeDialog}
    action={isWorkspaceReady ? myPrompts ? 'Open My Prompts' : 'Open New Tab' : null}
    onopen={openWelcomeTab} />
{/if}

<AppOverlays
  {startupRestoreOverlay}
  startupLoadingOverlayFadeMs={STARTUP_LOADING_OVERLAY_FADE_MS}
/>

{#if updater.updates.snapshot}
  <AppUpdatesPopup bind:open={updater.updates.open} state={updater.updates.snapshot} trigger={updatesButton}
    onclose={updater.dismiss} ondownload={updater.download} oninstall={updater.install} />
{/if}
