<script lang="ts">
  import { projectNavigation } from '@renderer/features/projects/projectNavigation.svelte.ts'
  import ManageProjectsDialog from '@renderer/features/projects/ManageProjectsDialog.svelte'
  import { findCollectionProject, getWorkspaceCollectionEntries } from '@shared/domain/workspace/Project'
  import { tick, untrack } from 'svelte'
  import { clearWorkspaceMonacoModels } from '@renderer/common/Monaco'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import AppActivityBar from '@renderer/features/sidebar/AppActivityBar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import AppOverlays from './AppOverlays.svelte'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import MockupsScreen from '@renderer/features/mockups/MockupsScreen.svelte'
  import { hasMockup } from '@renderer/features/mockups/mockupCatalog'
  import { screens, type ScreenId } from './screens'
  import PromptCollectionScreen from '../features/prompt-collections/PromptCollectionScreen.svelte'
  import SinglePromptScreen from '../features/prompt-collections/SinglePromptScreen.svelte'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import NewTabScreen from '@renderer/features/new-tab/NewTabScreen.svelte'
  import {
    CollectionSidebarModeData,
    createSidebarModes,
    SidebarModeId,
    type SidebarMode
  } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
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
  import { syncLastWorkspaceInfoPath, syncTabState } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { syncWorkspaceScreenSelection } from '@renderer/data/Mutations/WorkspaceUiStateMutations'
  import {
    setAppSidebarExpandedWithAutosave,
    setAppSidebarWidthWithAutosave
  } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
  import { loadWorkspaceUiState } from '@renderer/data/Queries/WorkspaceUiStateQuery'
  import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
  import {
    closeWorkspace as closeWorkspaceMutation,
    createWorkspace as createWorkspaceMutation
  } from '@renderer/data/Mutations/WorkspaceMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { moveProject } from '@renderer/data/Mutations/ProjectMutations'
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
  import { setPromptCollectionSelectedEntryIdWithAutosave } from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
  import {
    USER_PERSISTENCE_ID,
    isProjectScreenSelection,
    isWorkspaceScreenSelectionSame,
    type WorkTab,
    type WorkspaceScreenSelection
  } from '@shared/domain/user-persistence/UserPersistence'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import type { Prompt } from '@shared/domain/prompt/Prompt'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
  import type { SystemSettings } from '@shared/domain/settings/SystemSettings'
  import type { Workspace } from '@shared/domain/workspace/Workspace'
  import { preparePromptCollectionName } from '@shared/domain/prompt-collection/promptCollectionName'
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
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as { data: PromptTemplate[] }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)
  setPromptNavigationContext(promptNavigation)

  let activeScreen = $state<ScreenId>('home')
  /** One open work tab and the collection state it shows; it shows its New Tab screen while no collection is selected. */
  type OpenWorkTab = { id: string; mode: CollectionSidebarModeData }
  /** Builds a work tab showing its New Tab screen. */
  const createWorkTab = (id: string): OpenWorkTab => ({ id, mode: new CollectionSidebarModeData() })
  /** Describes a work tab on its New Tab screen to the title bar and to persistence. */
  const toNewTab = (id: string): WorkTab => ({ id, title: 'New Tab', screen: 'new-tab' })
  /** Open work tabs in display order, restored from this machine's persistence as New Tabs. */
  let workTabs = $state<OpenWorkTab[]>(getUserPersistence().workTabs.map((tab) => createWorkTab(tab.id)))
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
  /** Selected tab saved by the previous session, applied once startup restores the workspace. */
  const startupSelectedTabId = getUserPersistence().selectedTabId
  /** Selected title bar tab: the shown work tab, the active screen, or null while a project is shown. */
  const selectedTabId = $derived(
    activeScreen === 'project' ? null : activeScreen === 'work-tab' ? selectedWorkTabId : activeScreen
  )
  /** Shared sidebar modes, created once so each mode's data survives screen switches. */
  const sidebarModes = createSidebarModes()
  /** Default project's collection state, shared by its sidebar and screen. */
  const projectMode = sidebarModes[SidebarModeId.Project].data
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
    return modeId === null ? null : modeId === SidebarModeId.Project
      ? { ...sidebarModes[modeId], title: selectedProject?.name ?? '' } : sidebarModes[modeId]
  })
  /** Screens without a sidebar always use the collapsed layout, including programmatic navigation. */
  const isAppSidebarExpanded = $derived(activeSidebarMode !== null && sidebarExpanded)
  let selectedMockupId = $state<string | null>(null)
  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = getSelectedWorkspaceId()

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })
  /** Selected project metadata is reactive to successful edits and renames. */
  const selectedProject = $derived(selectedWorkspace?.projects.find((project) => project.id === projectMode.projectId))
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
  /** Mounted prompt-collection screen used for sidebar actions owned by that screen. */
  let promptCollectionScreen = $state<PromptCollectionScreenHandle | null>(null)
  /** Shell-owned project management opened by the sidebar gear, the activity bar's + button, and the New Tab screen. */
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
      persistPromptNavigationSelection()
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

  const buildWorkspaceScreenSelection = (screen: ScreenId): WorkspaceScreenSelection => {
    if (screen === 'project') {
      /** Collection selected by the project mode. */
      const screenCollectionId = projectMode.collectionId
      /** Current owner retained when rebuilding persistence for the already-selected collection. */
      const contentOwnerId =
        promptNavigation.screenCollectionId === screenCollectionId
          ? (promptNavigation.contentOwnerId ?? screenCollectionId)
          : screenCollectionId
      return {
        selectedScreen: screen,
        selectedScreenData: {
          projectId: projectMode.projectId!,
          promptCollectionId: screenCollectionId,
          contentOwnerId,
          openPromptId: projectMode.openPromptId
        }
      }
    }

    if (screen === 'mockups') {
      return {
        selectedScreen: screen,
        selectedScreenData: {
          mockupId: selectedMockupId
        }
      }
    }

    // Work tabs restore from the app-wide selected tab, so the workspace itself keeps Home.
    if (screen === 'work-tab') {
      return {
        selectedScreen: 'home',
        selectedScreenData: null
      }
    }

    return {
      selectedScreen: screen,
      selectedScreenData: null
    }
  }

  /** Saves the current workspace before releasing its data and navigation caches. */
  const closeSelectedWorkspace = async (): Promise<void> => {
    // Work tabs belong to the open workspace, so closing or replacing it closes them all.
    if (getSelectedWorkspaceId()) workTabs = []
    persistPromptNavigationSelection()
    captureRegisteredMonacoViewStates()
    await closeWorkspaceMutation()
    projectMode.clear()
    promptNavigation.clear()
    // Side effect: let workspace editors unmount before releasing their Monaco models.
    await tick()
    await clearWorkspaceMonacoModels()
  }

  const resetWorkspaceState = async () => {
    await runIpcBestEffort(closeSelectedWorkspace)
  }

  const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
    const workspaceFileName = preparePromptCollectionName(workspaceName).folderName
    return `${workspacePath.replace(/[\\/]+$/, '')}\\${workspaceFileName}.cthulhuprompt`
  }

  const loadWorkspaceSelection = async (workspaceInfoPath: string): Promise<void> => {
    await closeSelectedWorkspace()
    const loadedWorkspace = await loadWorkspaceByPath(workspaceInfoPath)
    await loadWorkspaceUiState(loadedWorkspace.workspaceId)
    setSelectedWorkspaceId(loadedWorkspace.workspaceId)
    await syncLastWorkspaceInfoPath(loadedWorkspace.workspaceInfoPath)
  }

  const syncCurrentWorkspaceScreenSelection = async (
    screen: ScreenId,
    workspaceScreenSelection = buildWorkspaceScreenSelection(screen)
  ): Promise<void> => {
    const workspaceId = getSelectedWorkspaceId()
    if (!workspaceId) {
      return
    }

    /** Current persistence used to skip an unchanged screen selection write. */
    const workspaceUiState = workspaceUiStateCollection.get(workspaceId)

    if (
      workspaceUiState &&
      isWorkspaceScreenSelectionSame(workspaceUiState, workspaceScreenSelection)
    ) {
      return
    }

    await syncWorkspaceScreenSelection(workspaceId, workspaceScreenSelection)
  }

  const restoreWorkspaceHomeScreen = async (workspaceId: string): Promise<void> => {
    activeScreen = 'home'
    await syncWorkspaceScreenSelection(workspaceId, {
      selectedScreen: 'home',
      selectedScreenData: null
    })
  }

  const restoreWorkspaceScreenFromPersistence = async (): Promise<void> => {
    const workspaceId = getSelectedWorkspaceId()
    if (!workspaceId) {
      return
    }

    const workspaceUiState = workspaceUiStateCollection.get(workspaceId)
    if (!workspaceUiState) {
      return
    }

    const persistedScreenConfig = screens[workspaceUiState.selectedScreen]
    if (persistedScreenConfig.devOnly && !isDevMode) {
      await restoreWorkspaceHomeScreen(workspaceId)
      return
    }

    if (isProjectScreenSelection(workspaceUiState)) {
      projectMode.projectId = workspaceUiState.selectedScreenData.projectId
      const persistedPromptCollectionId = workspaceUiState.selectedScreenData.promptCollectionId
      /** Collection selected from screen data, remembered state, or project order. */
      const restoredPromptCollectionId = projectMode.resolveCollectionId(persistedPromptCollectionId)
      projectMode.selectCollection(restoredPromptCollectionId)
      /** Single-prompt editor restored only within its own collection; it closes itself if the prompt is gone. */
      const restoredOpenPromptId =
        persistedPromptCollectionId === restoredPromptCollectionId
          ? workspaceUiState.selectedScreenData.openPromptId
          : null
      projectMode.openPromptId = restoredOpenPromptId
      activeScreen = workspaceUiState.selectedScreen
      /** Last project collection, re-synced when it differs from the restored collection. */
      const persistedLastPromptCollectionId = workspaceUiState.lastCollectionIdByProject[projectMode.projectId!]
      if (
        restoredPromptCollectionId &&
        (persistedPromptCollectionId !== restoredPromptCollectionId ||
          persistedLastPromptCollectionId !== restoredPromptCollectionId)
      ) {
        await syncWorkspaceScreenSelection(workspaceId, {
          selectedScreen: workspaceUiState.selectedScreen,
          selectedScreenData: {
            projectId: projectMode.projectId!,
            promptCollectionId: restoredPromptCollectionId,
            contentOwnerId:
              persistedPromptCollectionId === restoredPromptCollectionId
                ? workspaceUiState.selectedScreenData.contentOwnerId
                : restoredPromptCollectionId,
            openPromptId: restoredOpenPromptId
          }
        })
      }
      return
    }

    if (workspaceUiState.selectedScreen === 'mockups') {
      const persistedMockupId = workspaceUiState.selectedScreenData.mockupId
      // Let the mockups screen select its first entry when the saved mockup was deleted.
      selectedMockupId =
        persistedMockupId !== null && hasMockup(persistedMockupId) ? persistedMockupId : null
      activeScreen = 'mockups'
      return
    }

    activeScreen = workspaceUiState.selectedScreen
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const persistPromptNavigationSelection = () => {
    const workspaceId = getSelectedWorkspaceId()
    /** prompt collection containing the current navigation selection. */
    const promptCollectionId = promptNavigation.screenCollectionId
    const contentOwnerId = promptNavigation.contentOwnerId
    const selectedRow = promptNavigation.selectedRow
    if (!workspaceId || !promptCollectionId || !contentOwnerId || !selectedRow) {
      return
    }

    setPromptCollectionSelectedEntryIdWithAutosave(
      workspaceId,
      promptCollectionId,
      contentOwnerId,
      promptNavigationRowToPersistedEntryId(selectedRow)
    )
  }

  /** Shows the opened workspace's saved screen, or Home while the first-launch Welcome is pending. */
  const restoreSelectedWorkspaceScreen = async (): Promise<void> => {
    if (needsWelcome && startupRestorePhase !== 'ready') {
      await restoreWorkspaceHomeScreen(getSelectedWorkspaceId()!)
    } else {
      await restoreWorkspaceScreenFromPersistence()
    }
  }

  /** Replaces the open workspace with a double-clicked workspace file, reporting failures on Home. */
  const openWorkspaceFile = async (workspaceInfoPath: string): Promise<void> => {
    if (isWorkspaceLoading) return

    const selectionResult = await selectWorkspace(workspaceInfoPath)
    if (selectionResult.success) {
      await restoreSelectedWorkspaceScreen()
      return
    }

    activeScreen = 'home'
    workspaceOpenErrorText = selectionResult.message
    showWorkspaceOpenErrorDialog = true
  }

  const restoreWorkspaceFromPersistence = async (): Promise<void> => {
    if (runtimeConfig.startupWorkspaceInfoPath) {
      await openWorkspaceFile(runtimeConfig.startupWorkspaceInfoPath)
      return
    }

    const lastWorkspaceInfoPath = getUserPersistence().lastWorkspaceInfoPath

    if (!lastWorkspaceInfoPath) {
      return
    }

    const selectionResult = await selectWorkspace(lastWorkspaceInfoPath)
    if (selectionResult.success) {
      await restoreSelectedWorkspaceScreen()
      return
    }

    if (isWorkspaceMissingError(selectionResult.message)) {
      await syncLastWorkspaceInfoPath(null)
      console.error('Failed to restore last workspace. Cleared persisted path.', {
        workspaceInfoPath: lastWorkspaceInfoPath,
        error: selectionResult.message
      })
      return
    }

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

  const createWorkspace = async (
    workspacePath: string,
    workspaceName: string,
    includeExamplePrompts: boolean
  ): Promise<WorkspaceCreationResult> => {
    beginWorkspaceAction()

    try {
      return await runIpcBestEffort<WorkspaceCreationResult>(
        async () => {
          const result = await createWorkspaceMutation(
            workspacePath,
            workspaceName,
            includeExamplePrompts
          )

          if (result.success) {
            await loadWorkspaceSelection(resolveWorkspaceInfoPath(workspacePath, workspaceName))
            navigateToScreen('project')
            return { success: true }
          }

          await resetWorkspaceState()
          return {
            success: false,
            reason: 'creation-failed'
          }
        },
        async () => {
          await resetWorkspaceState()
          return {
            success: false,
            reason: 'unknown-error'
          }
        }
      )
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
        // Work tabs belong to the open workspace, so they close when startup restores none.
        if (!getSelectedWorkspaceId()) workTabs = []
        // The saved tab overrides the workspace's own screen; null leaves a restored project shown.
        if (startupSelectedTabId && startupSelectedTabId in screens) {
          navigateToScreen(startupSelectedTabId as ScreenId)
        } else if (startupSelectedTabId) {
          selectWorkTab(startupSelectedTabId)
        }
      } catch (error) {
        console.error('Failed to restore workspace from user persistence.', error)
      } finally {
        startupRestorePhase = 'ready'
        showWelcomeDialog = needsWelcome
      }
    })()
  })

  // Side effect: save the open work tabs as New Tabs, which is how they restore, and the selected tab after startup
  // has applied the saved ones. Reading only tab IDs keeps navigation inside a tab from saving.
  $effect(() => {
    const tabs = workTabs.map((tab) => toNewTab(tab.id))
    const tabId = selectedTabId
    if (startupRestorePhase !== 'ready') return
    void runIpcBestEffort(() => syncTabState(tabs, tabId))
  })

  // Side effect: return work tabs to their New Tab screen once their collection is deleted, including with its project.
  $effect(() => {
    for (const tab of workTabs) {
      if (tab.mode.collectionId && !selectedWorkspacePromptCollections.some((collection) => collection.id === tab.mode.collectionId)) {
        untrack(() => tab.mode.clear())
      }
    }
  })

  // Side effect: keep the browser window title in sync with dev mode state.
  $effect(() => {
    document.title = windowTitle
  })

  // Side effect: persist mockup tab changes while the mockups screen is active.
  $effect(() => {
    const workspaceScreenSelection: WorkspaceScreenSelection = {
      selectedScreen: 'mockups',
      selectedScreenData: {
        mockupId: selectedMockupId
      }
    }

    if (activeScreen !== 'mockups') {
      return
    }

    void runIpcBestEffort(() =>
      syncCurrentWorkspaceScreenSelection('mockups', workspaceScreenSelection)
    )
  })

  // Side effect: persist opening and closing the single-prompt editor while the project screen is shown.
  $effect(() => {
    void projectMode.openPromptId
    untrack(() => {
      if (activeScreen !== 'project') return
      void runIpcBestEffort(() => syncCurrentWorkspaceScreenSelection('project'))
    })
  })

  // Side effect: flush pending autosaves before allowing the main process to close the window.
  $effect(() => {
    const unsubscribe = windowControls.onCloseRequested(() => {
      void (async () => {
        persistPromptNavigationSelection()
        captureRegisteredMonacoViewStates()
        await flushAllAutosaves()
        await windowControls.confirmClose()
      })()
    })

    return () => {
      unsubscribe()
    }
  })

  // Side effect: open workspace files double-clicked while this window is already running.
  $effect(() => windowControls.onOpenWorkspaceFile((workspaceInfoPath) => {
    void openWorkspaceFile(workspaceInfoPath)
  }))

  /** Shows a screen, selecting the given or remembered collection when it is a collection activity. */
  const navigateToScreen = (screen: ScreenId, collectionId?: string) => {
    const config = screens[screen]
    if (!config) return
    if (config.devOnly && !isDevMode) {
      return
    }
    if (config.requiresWorkspace && !isWorkspaceReady) return
    if (screen === 'project') {
      if (!projectMode.projectId) projectMode.projectId = selectedWorkspace?.projects[0]?.id ?? null
      if (!projectMode.projectId) return
      projectMode.selectCollection(projectMode.resolveCollectionId(collectionId))
    }
    selectedWorkTabId = null
    activeScreen = screen
    void runIpcBestEffort(() => syncCurrentWorkspaceScreenSelection(screen))
  }

  /** Opens another project with its own last collection; re-clicking the active project does nothing. */
  const activateProject = (projectId: string): void => {
    if (activeScreen === 'project' && projectMode.projectId === projectId) return
    persistPromptNavigationSelection()
    captureRegisteredMonacoViewStates()
    projectMode.projectId = projectId
    projectMode.selectCollection(null)
    navigateToScreen('project')
    sidebarExpanded = true
    setAppSidebarExpandedWithAutosave(true)
  }

  // Consume successful project lifecycle requests in the shell that owns navigation.
  $effect(() => {
    /** Only requests belonging to the currently open workspace can change its screen. */
    const request = projectNavigation.pending
    if (!request) return
    untrack(() => projectNavigation.consume(request, ({ workspaceId, projectId }) => {
      if (workspaceId !== getSelectedWorkspaceId()) return
      if (projectId) activateProject(projectId)
      else {
        projectMode.clear()
        promptNavigation.clear()
        navigateToScreen('home')
      }
    }))
  })

  /** Switches screens and opens the sidebar; re-clicking the selected screen does nothing. */
  const activateActivity = (screen: ScreenId): void => {
    if (screen === selectedTabId) return

    navigateToScreen(screen)
    sidebarExpanded = true
    setAppSidebarExpandedWithAutosave(sidebarExpanded)
  }

  /** Selects a work tab, which shows its New Tab, collection, or single-prompt screen. */
  const selectWorkTab = (tabId: string): void => {
    navigateToScreen('work-tab')
    selectedWorkTabId = tabId
  }

  /** Appends a New Tab after every open tab and selects it. */
  const addWorkTab = (): void => {
    const tab = createWorkTab(compactGuid(globalThis.crypto.randomUUID()))
    workTabs = [...workTabs, tab]
    selectWorkTab(tab.id)
  }

  /** Opens a collection in the selected work tab and shows the sidebar, or selects the work tab already showing it. */
  const openCollectionInWorkTab = (collectionId: string): void => {
    /** Work tab already showing the collection. */
    const openTab = workTabs.find((tab) => tab.mode.collectionId === collectionId)
    if (openTab) {
      selectWorkTab(openTab.id)
      return
    }
    selectedWorkTab!.mode.projectId = findCollectionProject(selectedWorkspace!, collectionId)!.id
    selectedWorkTab!.mode.selectCollection(collectionId)
    sidebarExpanded = true
    setAppSidebarExpandedWithAutosave(true)
  }

  /** Closes a work tab; closing the selected tab selects its right neighbour, else its left, else Home. */
  const closeWorkTab = (tabId: string): void => {
    /** Selection is read before removal, which would otherwise fall back to Home. */
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

  const navigateToScreenCollection = (promptCollectionId: string): void => {
    if (!isWorkspaceReady) return
    if (!selectedWorkspacePromptCollections.some((collection) => collection.id === promptCollectionId)) return
    /** Collection state behind the shown screen: the selected work tab's, else the project's. */
    const shownMode = selectedWorkTab?.mode ?? (activeScreen === 'project' ? projectMode : null)
    if (shownMode?.collectionId === promptCollectionId) {
      // Reselecting the shown collection returns from the single-prompt editor to its collection view.
      shownMode.closeOpenPrompt()
      return
    }
    projectMode.projectId = findCollectionProject(selectedWorkspace!, promptCollectionId)!.id
    navigateToScreen('project', promptCollectionId)
  }

  /** Selects the first remaining collection of either kind or retains the empty project screen. */
  const navigateAfterPromptCollectionDelete = (): void => {
    /** First remaining collection in project order. */
    const nextPromptCollectionId = selectedProject?.collectionEntries[0]?.id ?? null
    if (!nextPromptCollectionId) {
      projectMode.selectCollection(null)
      return
    }

    navigateToScreenCollection(nextPromptCollectionId)
  }

  /** Navigates to the selected collection and opens its screen-owned deletion flow after it mounts. */
  const requestSelectedPromptCollectionDelete = (promptCollectionId: string): void => {
    if (!selectedWorkspacePromptCollections.some((collection) => collection.id === promptCollectionId)) return
    navigateToScreenCollection(promptCollectionId)
    // Side effect: wait for navigation to mount the selected collection screen before opening its dialog.
    void (async () => {
      await tick()
      promptCollectionScreen?.openDeletePromptCollectionDialog(promptCollectionId)
    })()
  }
</script>

<!-- Single-prompt or collection screen for the project's or a work tab's collection state, which must have a
     collection selected; deleting that collection calls onPromptCollectionDeleted. -->
{#snippet collectionScreen(modeData: CollectionSidebarModeData, onPromptCollectionDeleted: () => void)}
  {#if modeData.openPromptId}
    {#key `${modeData.collectionId}:${modeData.openPromptId}`}
      <SinglePromptScreen sidebarModeData={modeData} />
    {/key}
  {:else}
    {#key `${modeData.collectionId}:${modeData.screenMode}`}
      <PromptCollectionScreen bind:this={promptCollectionScreen} sidebarModeData={modeData} {onPromptCollectionDeleted} />
    {/key}
  {/if}
{/snippet}

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar {selectedTabId} workTabs={titleBarWorkTabs} canAddWorkTab={isWorkspaceReady} {isDevMode} {executionFolderName} onNavigate={activateActivity}
      onSelectWorkTab={selectWorkTab} onAddWorkTab={addWorkTab} onCloseWorkTab={closeWorkTab} onMoveWorkTab={moveWorkTab}
      bind:updatesButton updatesOpen={updater.updates.open} updateAvailable={updater.updates.snapshot?.hasUpdate ?? false}
      onToggleUpdates={() => {
        if (updater.updates.snapshot?.status === 'restarting') return
        if (updater.updates.open) updater.dismiss()
        updater.updates.open = !updater.updates.open
      }} />
  {/if}

  <div class="sidebarSurface flex min-h-0 flex-1">
    <AppActivityBar projects={selectedWorkspace?.projects ?? []} selectedProjectId={projectMode.projectId} onProjectSelect={activateProject}
      onProjectMove={(projectId, previousProjectId) => runIpcBestEffort(() => moveProject(selectedWorkspace!.id, projectId, previousProjectId))}
      onCreateProject={() => manageProjectsDialog?.openDialog({ createProject: true, openCreatedProject: true })} {activeScreen} {isAppSidebarExpanded} {isWorkspaceReady} />

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
          <AppSidebar
            mode={activeSidebarMode}
            {isWorkspaceReady}
            {isWorkspaceLoading}
            onScreenCollectionSelect={navigateToScreenCollection}
            onDeleteSelectedPromptCollection={requestSelectedPromptCollectionDelete}
            onManageProjects={() => manageProjectsDialog?.openDialog({ projectId: projectMode.projectId! })}
            onShowAll={() => selectedWorkTab!.mode.clear()}
          />
        {/if}
      {/snippet}

      {#snippet content()}
        <div
          class="mainScreenSurface sidebarFrameBorder bg-background relative flex w-full min-h-0 flex-1 flex-col border-t"
        >
          {#if activeScreen === 'home'}
            <HomeScreen
              bind:showWelcomeDialog
              bind:showWorkspaceOpenErrorDialog
              bind:workspaceOpenErrorText
              {workspacePath}
              {isWorkspaceReady}
              {isWorkspaceLoading}
              promptCount={workspacePromptCount}
              promptCollectionCount={workspacePromptCollectionCount}
              onWorkspaceSelect={selectWorkspace}
              onWorkspaceCreate={createWorkspace}
              onWorkspaceClear={() => void closeWorkspace()}
              onWorkflowBusy={(busy) => { homeWorkflowBusy = busy }}
            />
          {:else if activeScreen === 'settings'}
            <SettingsScreen sidebarModeData={sidebarModes[SidebarModeId.Settings].data} />
          {:else if activeScreen === 'mockups'}
            <MockupsScreen bind:activeMockupId={selectedMockupId} />
          {:else if activeScreen === 'project'}
            {#if projectMode.collectionId && workspacePath}
              {@render collectionScreen(projectMode, navigateAfterPromptCollectionDelete)}
            {/if}
          {:else if activeScreen === 'work-tab' && selectedWorkspace && selectedWorkTab}
            {#if selectedWorkTab.mode.collectionId}
              {@render collectionScreen(selectedWorkTab.mode, () => selectedWorkTab!.mode.clear())}
            {:else}
              <NewTabScreen
                workspace={selectedWorkspace}
                openCollectionIds={workTabs.flatMap((tab) => tab.mode.collectionId ?? [])}
                onOpenCollection={openCollectionInWorkTab}
                onCreateProject={() => manageProjectsDialog?.openDialog({ createProject: true })}
                onEditProject={(projectId) => manageProjectsDialog?.openDialog({ projectId })}
              />
            {/if}
          {:else if activeScreen === 'test-screen'}
            <TestScreen />
          {/if}
        </div>
      {/snippet}
    </ResizableSidebar>
  </div>
</div>

<ManageProjectsDialog bind:this={manageProjectsDialog} workspace={selectedWorkspace} />

<AppOverlays
  {startupRestoreOverlay}
  startupLoadingOverlayFadeMs={STARTUP_LOADING_OVERLAY_FADE_MS}
/>

{#if updater.updates.snapshot}
  <AppUpdatesPopup bind:open={updater.updates.open} state={updater.updates.snapshot} trigger={updatesButton}
    onclose={updater.dismiss} ondownload={updater.download} oninstall={updater.install} />
{/if}
