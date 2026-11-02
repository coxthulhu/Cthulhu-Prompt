<script lang="ts">
  import { tick } from 'svelte'
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
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import { createSidebarModes, SidebarModeId } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/app/workspaceSelection.svelte.ts'
  import { syncLastWorkspaceInfoPath } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { syncWorkspaceScreenSelection } from '@renderer/data/Mutations/WorkspaceUiStateMutations'
  import { setAppSidebarWidthWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
  import { loadWorkspaceUiState } from '@renderer/data/Queries/WorkspaceUiStateQuery'
  import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
  import {
    closeWorkspace as closeWorkspaceMutation,
    createWorkspace as createWorkspaceMutation
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
  import { setPromptCollectionSelectedEntryIdWithAutosave } from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
  import {
    USER_PERSISTENCE_ID,
    isPromptCollectionScreen,
    isPromptCollectionScreenSelection,
    isWorkspaceScreenSelectionSame,
    type PromptCollectionScreenId,
    type WorkspaceScreenSelection
  } from '@shared/domain/user-persistence/UserPersistence'
  import type { PromptCollection, PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
  import type { CollectionSidebarModeData } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import type { SystemSettings } from '@shared/domain/settings/SystemSettings'
  import { getAllWorkspaceCollectionEntries, type Workspace } from '@shared/domain/workspace/Workspace'
  import { preparePromptCollectionName } from '@shared/domain/prompt-collection/promptCollectionName'
  import AppUpdatesPopup from '@renderer/features/updates/AppUpdatesPopup.svelte'
  import { createAppUpdates } from '@renderer/features/updates/appUpdates.svelte'

  type PromptCollectionScreenHandle = {
    openDeletePromptCollectionDialog: (promptCollectionId: string) => void
  }

  const runtimeConfig = getRuntimeConfig()
  const isDevMode = isDevOrPlaywrightEnvironment()
  const isDevBuild = runtimeConfig.environment === 'DEV'
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
    /** Shares the persisted note viewport limit with every editor. */
    get attachedNoteMaxLines() {
      return systemSettingsQuery.data.attachedNoteMaxLines
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
  // Session-only visibility starts expanded whenever the application launches.
  let isAppSidebarExpanded = $state(true)

  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptCollectionQuery = useLiveQuery((q) =>
    q.from({ promptCollection: promptCollectionsCollection })
  ) as { data: PromptCollection[] }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)
  setPromptNavigationContext(promptNavigation)

  let activeScreen = $state<ScreenId>('home')
  /** Every sidebar mode, created once so each mode's data survives screen switches. */
  const sidebarModes = createSidebarModes()
  /** Collection mode state for each collection kind, shared by its sidebar and screen. */
  const collectionModes: Record<PromptCollectionKind, CollectionSidebarModeData> = {
    prompt: sidebarModes[SidebarModeId.TaskCollections].data,
    template: sidebarModes[SidebarModeId.TemplateCollections].data
  }
  /** Sidebar mode displayed beside the active screen. */
  const activeSidebarMode = $derived(sidebarModes[screens[activeScreen].sidebarMode])
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

    return getAllWorkspaceCollectionEntries(selectedWorkspace)
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

  /** Maps a collection activity to its authoritative collection kind. */
  const getPromptCollectionScreenKind = (screen: PromptCollectionScreenId): PromptCollectionKind =>
    screen === 'prompt-template-collections' ? 'template' : 'prompt'

  /** Resolves the persisted screen used to display one collection kind. */
  const getPromptCollectionKindScreen = (kind: PromptCollectionKind): PromptCollectionScreenId =>
    kind === 'template' ? 'prompt-template-collections' : 'prompt-task-collections'

  const buildWorkspaceScreenSelection = (screen: ScreenId): WorkspaceScreenSelection => {
    if (isPromptCollectionScreen(screen)) {
      /** Collection selected by the screen's collection mode. */
      const screenCollectionId = collectionModes[getPromptCollectionScreenKind(screen)].collectionId
      /** Current owner retained when rebuilding persistence for the already-selected collection. */
      const contentOwnerId =
        promptNavigation.screenCollectionId === screenCollectionId
          ? (promptNavigation.contentOwnerId ?? screenCollectionId)
          : screenCollectionId
      return {
        selectedScreen: screen,
        selectedScreenData: {
          promptCollectionId: screenCollectionId,
          contentOwnerId
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

    return {
      selectedScreen: screen,
      selectedScreenData: null
    }
  }

  /** Saves the current workspace before releasing its data and navigation caches. */
  const closeSelectedWorkspace = async (): Promise<void> => {
    persistPromptNavigationSelection()
    captureRegisteredMonacoViewStates()
    await closeWorkspaceMutation()
    collectionModes.prompt.clear()
    collectionModes.template.clear()
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

    if (isPromptCollectionScreenSelection(workspaceUiState)) {
      const persistedPromptCollectionId = workspaceUiState.selectedScreenData.promptCollectionId
      /** Collection mode displayed by the persisted split activity. */
      const collectionMode = collectionModes[getPromptCollectionScreenKind(workspaceUiState.selectedScreen)]
      /** Collection selected from screen data, remembered state, or type-specific order. */
      const restoredPromptCollectionId = collectionMode.resolveCollectionId(persistedPromptCollectionId)
      collectionMode.selectCollection(restoredPromptCollectionId)
      activeScreen = workspaceUiState.selectedScreen
      /** Last type-specific collection, re-synced when it differs from the restored collection. */
      const persistedLastPromptCollectionId = collectionMode.kind === 'template'
        ? workspaceUiState.lastPromptTemplateCollectionId
        : workspaceUiState.lastPromptTaskCollectionId
      if (
        restoredPromptCollectionId &&
        (persistedPromptCollectionId !== restoredPromptCollectionId ||
          persistedLastPromptCollectionId !== restoredPromptCollectionId)
      ) {
        await syncWorkspaceScreenSelection(workspaceId, {
          selectedScreen: workspaceUiState.selectedScreen,
          selectedScreenData: {
            promptCollectionId: restoredPromptCollectionId,
            contentOwnerId:
              persistedPromptCollectionId === restoredPromptCollectionId
                ? workspaceUiState.selectedScreenData.contentOwnerId
                : restoredPromptCollectionId
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
            navigateToScreen('prompt-task-collections')
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
      } catch (error) {
        console.error('Failed to restore workspace from user persistence.', error)
      } finally {
        startupRestorePhase = 'ready'
        showWelcomeDialog = needsWelcome
      }
    })()
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
    if (isPromptCollectionScreen(screen)) {
      const collectionMode = collectionModes[getPromptCollectionScreenKind(screen)]
      collectionMode.selectCollection(collectionMode.resolveCollectionId(collectionId))
    }
    activeScreen = screen
    void runIpcBestEffort(() => syncCurrentWorkspaceScreenSelection(screen))
  }

  /** Re-clicking an activity changes visibility without resetting its screen selection. */
  const activateActivity = (screen: ScreenId): void => {
    if (screen === activeScreen) {
      isAppSidebarExpanded = !isAppSidebarExpanded
      return
    }

    navigateToScreen(screen)
    isAppSidebarExpanded = true
  }

  const navigateToScreenCollection = (promptCollectionId: string): void => {
    if (!isWorkspaceReady) return
    /** Loaded collection used to choose the matching split activity. */
    const promptCollection = selectedWorkspacePromptCollections.find(
      (collection) => collection.id === promptCollectionId
    )
    if (!promptCollection) return
    /** Activity dedicated to the selected collection's kind. */
    const targetScreen = getPromptCollectionKindScreen(promptCollection.kind)
    if (activeScreen === targetScreen && collectionModes[promptCollection.kind].collectionId === promptCollectionId) {
      return
    }
    navigateToScreen(targetScreen, promptCollectionId)
  }

  /** Selects the first remaining same-kind collection or retains the empty collection activity. */
  const navigateAfterPromptCollectionDelete = (): void => {
    /** Kind retained from the activity that owned the deleted collection. */
    const kind = activeScreen === 'prompt-template-collections' ? 'template' : 'prompt'
    /** First remaining collection in the activity's type-specific order. */
    const nextPromptCollectionId = selectedWorkspacePromptCollections.find(
      (collection) => collection.kind === kind
    )?.id ?? null
    if (!nextPromptCollectionId) {
      collectionModes[kind].selectCollection(null)
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

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar
      title={windowTitle}
      {isDevBuild}
    />
  {/if}

  <div class="sidebarSurface flex min-h-0 flex-1">
    <AppActivityBar {activeScreen} {isAppSidebarExpanded} {isWorkspaceReady} {isDevMode} {workspacePath} onNavigate={activateActivity}
      updatesOpen={updater.updates.open} updateAvailable={updater.updates.snapshot?.hasUpdate ?? false}
      onToggleUpdates={() => {
        if (updater.updates.snapshot?.status === 'restarting') return
        if (updater.updates.open) updater.dismiss()
        updater.updates.open = !updater.updates.open
      }} />

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
        <AppSidebar
          mode={activeSidebarMode}
          {isWorkspaceReady}
          {isWorkspaceLoading}
          onScreenCollectionSelect={navigateToScreenCollection}
          onDeleteSelectedPromptCollection={requestSelectedPromptCollectionDelete}
        />
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
          {:else if isPromptCollectionScreen(activeScreen)}
            {@const collectionMode = collectionModes[getPromptCollectionScreenKind(activeScreen)]}
            {#if collectionMode.collectionId && workspacePath}
              {#key `${collectionMode.collectionId}:${collectionMode.screenMode}`}
                <PromptCollectionScreen
                  bind:this={promptCollectionScreen}
                  sidebarModeData={collectionMode}
                  onPromptCollectionDeleted={navigateAfterPromptCollectionDelete}
                />
              {/key}
            {/if}
          {:else if activeScreen === 'test-screen'}
            <TestScreen />
          {/if}
        </div>
      {/snippet}
    </ResizableSidebar>
  </div>
</div>

<AppOverlays
  {startupRestoreOverlay}
  startupLoadingOverlayFadeMs={STARTUP_LOADING_OVERLAY_FADE_MS}
/>

{#if updater.updates.snapshot}
  <AppUpdatesPopup bind:open={updater.updates.open} state={updater.updates.snapshot}
    onclose={updater.dismiss} ondownload={updater.download} oninstall={updater.install} />
{/if}
