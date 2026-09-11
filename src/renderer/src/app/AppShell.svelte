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
  import PromptFolderScreen from '../features/prompt-folders/PromptFolderScreen.svelte'
  import { PROMPT_STATUS_FOLDER_REGISTRY, type PromptStatusFolderId } from '@shared/Prompt'
  import { PromptFolderScreenMode } from '../features/prompt-folders/promptFolderScreenMode'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { getMarkdownContentIds } from '@shared/MarkdownContent'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/data/UiState/WorkspaceSelection.svelte.ts'
  import { syncLastWorkspaceInfoPath } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { syncWorkspaceScreenSelection } from '@renderer/data/Mutations/WorkspaceUiStateMutations'
  import { setAppSidebarWidthWithAutosave } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'
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
  import { flushAllAutosaves } from '@renderer/data/UiState/AutosaveFlushes.svelte.ts'
  import { captureRegisteredMonacoViewStates } from '@renderer/features/prompt-editor/MonacoViewStateRegistry'
  import { setPromptFolderSelectedEntryIdWithAutosave } from '@renderer/data/UiState/WorkspaceUiStateAutosave.svelte.ts'
  import {
    USER_PERSISTENCE_ID,
    isPromptFolderScreen,
    isPromptFolderScreenSelection,
    isWorkspaceScreenSelectionSame,
    type PromptFolderScreenId,
    type WorkspaceScreenSelection
  } from '@shared/UserPersistence'
  import type { PromptFolder, PromptFolderKind } from '@shared/PromptFolder'
  import type { SystemSettings } from '@shared/SystemSettings'
  import { getAllWorkspaceFolderEntries, type Workspace } from '@shared/Workspace'
  import { preparePromptFolderName } from '@shared/promptFolderName'

  type PromptFolderScreenHandle = {
    openDeletePromptFolderDialog: (promptFolderId: string) => void
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
    get showLineNumbers() {
      return systemSettingsQuery.data.showLineNumbers
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
  // Session-only visibility starts expanded whenever the application launches.
  let isAppSidebarExpanded = $state(true)
  // Toggles only the resizable sidebar while leaving primary navigation visible.
  const toggleAppSidebar = (): void => {
    isAppSidebarExpanded = !isAppSidebarExpanded
  }

  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptFolderQuery = useLiveQuery((q) =>
    q.from({ promptFolder: promptFolderCollection })
  ) as { data: PromptFolder[] }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)
  setPromptNavigationContext(promptNavigation)

  let activeScreen = $state<ScreenId>('home')
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
  const selectedWorkspacePromptFolders = $derived.by(() => {
    if (!selectedWorkspace) {
      return []
    }

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of promptFolderQuery.data) {
      if (promptFolder) {
        promptFolderById.set(promptFolder.id, promptFolder)
      }
    }

    return getAllWorkspaceFolderEntries(selectedWorkspace)
      .map((entry) => entry.id)
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })
  const workspacePromptCount = $derived.by(() => {
    const promptIds = new SvelteSet<string>()
    for (const promptFolder of selectedWorkspacePromptFolders) {
      for (const promptId of getMarkdownContentIds(promptFolder, promptFolder.kind)) {
        promptIds.add(promptId)
      }
    }

    return promptIds.size
  })
  const workspacePromptFolderCount = $derived(selectedWorkspacePromptFolders.length)
  let screenRootFolderId = $state<string | null>(null)
  /** Mounted prompt-folder screen used for sidebar actions owned by that screen. */
  let promptFolderScreen = $state<PromptFolderScreenHandle | null>(null)
  let promptFolderScreenMode = $state(PromptFolderScreenMode.Active)
  /** Session visibility for toggleable finalized status groups. */
  let shownFinalStatusGroups = $state<Partial<Record<PromptStatusFolderId, boolean>>>({})
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

  const clearPromptFolderSelection = () => {
    screenRootFolderId = null
    promptFolderScreenMode = PromptFolderScreenMode.Active
  }

  /** Maps a folder activity to its authoritative root kind. */
  const getPromptFolderScreenKind = (screen: PromptFolderScreenId): PromptFolderKind =>
    screen === 'prompt-template-folders' ? 'template' : 'prompt'

  /** Resolves the persisted screen used to display one root-folder kind. */
  const getPromptFolderKindScreen = (kind: PromptFolderKind): PromptFolderScreenId =>
    kind === 'template' ? 'prompt-template-folders' : 'prompt-task-folders'

  /** Resolves the selected or fallback root for one folder activity. */
  const resolvePromptFolderNavigationId = (screen: PromptFolderScreenId): string | null => {
    const workspaceId = getSelectedWorkspaceId()
    const workspaceUiState = workspaceId
      ? workspaceUiStateCollection.get(workspaceId)
      : null
    /** Folder kind displayed by the requested activity. */
    const kind = getPromptFolderScreenKind(screen)
    /** Roots eligible for selection within this activity. */
    const matchingFolders = selectedWorkspacePromptFolders.filter((folder) => folder.kind === kind)
    /** First root in the repaired type-specific order. */
    const firstPromptFolderId = matchingFolders[0]?.id ?? null
    /** Last root persisted independently for the requested activity. */
    const persistedLastPromptFolderId =
      kind === 'template'
        ? (workspaceUiState?.lastPromptTemplateFolderId ?? null)
        : (workspaceUiState?.lastPromptTaskFolderId ?? null)
    /** Current root retained only when it belongs to the requested activity. */
    const currentPromptFolderId = matchingFolders.some(
      (folder) => folder.id === screenRootFolderId
    )
      ? screenRootFolderId
      : null

    return currentPromptFolderId
      ? currentPromptFolderId
      : matchingFolders.some((folder) => folder.id === persistedLastPromptFolderId)
        ? persistedLastPromptFolderId
        : firstPromptFolderId
  }

  /** Selects the remembered task root used by every non-folder activity sidebar. */
  const selectPromptTaskSidebarRoot = (): void => {
    screenRootFolderId = resolvePromptFolderNavigationId('prompt-task-folders')
    promptFolderScreenMode = PromptFolderScreenMode.Active
  }

  const buildWorkspaceScreenSelection = (screen: ScreenId): WorkspaceScreenSelection => {
    if (isPromptFolderScreen(screen)) {
      /** Current owner retained when rebuilding persistence for the already-selected root. */
      const contentOwnerId =
        promptNavigation.screenRootFolderId === screenRootFolderId
          ? (promptNavigation.contentOwnerId ?? screenRootFolderId)
          : screenRootFolderId
      return {
        selectedScreen: screen,
        selectedScreenData: {
          promptFolderId: screenRootFolderId,
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
    clearPromptFolderSelection()
    promptNavigation.clear()
    shownFinalStatusGroups = {}
    // Side effect: let workspace editors unmount before releasing their Monaco models.
    await tick()
    await clearWorkspaceMonacoModels()
  }

  const resetWorkspaceState = async () => {
    await runIpcBestEffort(closeSelectedWorkspace)
  }

  const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
    const workspaceFileName = preparePromptFolderName(workspaceName).folderName
    return `${workspacePath.replace(/[\\/]+$/, '')}\\${workspaceFileName}.cthulhuprompt.json`
  }

  const loadWorkspaceSelection = async (workspaceInfoPath: string): Promise<void> => {
    await closeSelectedWorkspace()
    const workspaceId = await loadWorkspaceByPath(workspaceInfoPath)
    await loadWorkspaceUiState(workspaceId)
    setSelectedWorkspaceId(workspaceId)
    await syncLastWorkspaceInfoPath(workspaceInfoPath)
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
    selectPromptTaskSidebarRoot()
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

    if (isPromptFolderScreenSelection(workspaceUiState)) {
      const workspaceRecord = workspaceCollection.get(workspaceId)
      const persistedPromptFolderId = workspaceUiState.selectedScreenData.promptFolderId
      /** Root kind required by the persisted split activity. */
      const persistedFolderKind = getPromptFolderScreenKind(workspaceUiState.selectedScreen)
      /** Type-specific workspace order used to validate the persisted root. */
      const persistedFolderEntries =
        persistedFolderKind === 'template'
          ? workspaceRecord?.templateFolderEntries
          : workspaceRecord?.promptFolderEntries
      /** Last type-specific root retained when the selected screen root is unavailable. */
      const persistedLastPromptFolderId =
        persistedFolderKind === 'template'
          ? workspaceUiState.lastPromptTemplateFolderId
          : workspaceUiState.lastPromptTaskFolderId
      /** Root selected from screen data, remembered state, or type-specific order. */
      const restoredPromptFolderId =
        persistedFolderEntries?.find((entry) => entry.id === persistedPromptFolderId)?.id ??
        persistedFolderEntries?.find((entry) => entry.id === persistedLastPromptFolderId)?.id ??
        persistedFolderEntries?.[0]?.id ??
        null

      if (restoredPromptFolderId) {
        screenRootFolderId = restoredPromptFolderId
        activeScreen = workspaceUiState.selectedScreen
        if (
          persistedPromptFolderId !== restoredPromptFolderId ||
          persistedLastPromptFolderId !== restoredPromptFolderId
        ) {
          await syncWorkspaceScreenSelection(workspaceId, {
            selectedScreen: workspaceUiState.selectedScreen,
            selectedScreenData: {
              promptFolderId: restoredPromptFolderId,
              contentOwnerId:
                persistedPromptFolderId === restoredPromptFolderId
                  ? workspaceUiState.selectedScreenData.contentOwnerId
                  : restoredPromptFolderId
            }
          })
        }
        return
      }

      clearPromptFolderSelection()
      activeScreen = workspaceUiState.selectedScreen
      return
    }

    if (workspaceUiState.selectedScreen === 'mockups') {
      const persistedMockupId = workspaceUiState.selectedScreenData.mockupId
      if (persistedMockupId === null || hasMockup(persistedMockupId)) {
        selectPromptTaskSidebarRoot()
        selectedMockupId = persistedMockupId
        activeScreen = 'mockups'
        return
      }

      await restoreWorkspaceHomeScreen(workspaceId)
      return
    }

    selectPromptTaskSidebarRoot()
    activeScreen = workspaceUiState.selectedScreen
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const persistPromptNavigationSelection = () => {
    const workspaceId = getSelectedWorkspaceId()
    /** Root prompt folder containing the current navigation selection. */
    const promptFolderId = promptNavigation.screenRootFolderId
    const contentOwnerId = promptNavigation.contentOwnerId
    const selectedRow = promptNavigation.selectedRow
    if (!workspaceId || !promptFolderId || !contentOwnerId || !selectedRow) {
      return
    }

    setPromptFolderSelectedEntryIdWithAutosave(
      workspaceId,
      promptFolderId,
      contentOwnerId,
      promptNavigationRowToPersistedEntryId(selectedRow)
    )
  }

  const restoreWorkspaceFromPersistence = async (): Promise<void> => {
    const lastWorkspaceInfoPath = getUserPersistence().lastWorkspaceInfoPath

    if (!lastWorkspaceInfoPath) {
      return
    }

    const selectionResult = await selectWorkspace(lastWorkspaceInfoPath)
    if (selectionResult.success) {
      await restoreWorkspaceScreenFromPersistence()
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

  const navigateToScreen = (screen: ScreenId) => {
    const config = screens[screen]
    if (!config) return
    if (config.devOnly && !isDevMode) {
      return
    }
    if (config.requiresWorkspace && !isWorkspaceReady) return
    if (isPromptFolderScreen(screen)) {
      const promptFolderId = resolvePromptFolderNavigationId(screen)
      screenRootFolderId = promptFolderId
    } else {
      selectPromptTaskSidebarRoot()
    }
    activeScreen = screen
    void runIpcBestEffort(() => syncCurrentWorkspaceScreenSelection(screen))
  }

  const navigateToScreenRootFolder = (promptFolderId: string): void => {
    if (!isWorkspaceReady) return
    /** Loaded root used to choose the matching split activity. */
    const promptFolder = selectedWorkspacePromptFolders.find(
      (folder) => folder.id === promptFolderId
    )
    if (!promptFolder) return
    /** Activity dedicated to the selected root's kind. */
    const targetScreen = getPromptFolderKindScreen(promptFolder.kind)
    if (activeScreen === targetScreen && screenRootFolderId === promptFolderId) {
      return
    }
    screenRootFolderId = promptFolderId
    if (promptFolder.kind === 'template') {
      promptFolderScreenMode = PromptFolderScreenMode.Active
    }
    navigateToScreen(targetScreen)
  }

  const setPromptFolderMode = (nextMode: PromptFolderScreenMode): void => {
    if (screenRootFolderId) {
      const folder = selectedWorkspacePromptFolders.find(
        (candidate) => candidate.id === screenRootFolderId
      )
      if (folder?.kind === 'template') return
    }
    if (PROMPT_STATUS_FOLDER_REGISTRY[nextMode].ordering === 'finalizedAt') {
      shownFinalStatusGroups[nextMode] = true
    }
    promptFolderScreenMode = nextMode
  }

  /** Toggles a finalized group and restores the default view when hiding the selected group. */
  const setFinalStatusGroupShown = (groupId: PromptStatusFolderId, isShown: boolean): void => {
    shownFinalStatusGroups[groupId] = isShown
    if (isShown) setPromptFolderMode(groupId)
    else if (promptFolderScreenMode === groupId) setPromptFolderMode(PromptFolderScreenMode.Active)
  }

  /** Selects the first remaining same-kind root or retains the empty folder activity. */
  const navigateAfterRootPromptFolderDelete = (): void => {
    /** Kind retained from the activity that owned the deleted root. */
    const kind = activeScreen === 'prompt-template-folders' ? 'template' : 'prompt'
    /** First remaining folder in the activity's type-specific order. */
    const nextPromptFolderId = selectedWorkspacePromptFolders.find(
      (folder) => folder.kind === kind
    )?.id ?? null
    if (!nextPromptFolderId) {
      clearPromptFolderSelection()
      return
    }

    navigateToScreenRootFolder(nextPromptFolderId)
  }

  /** Navigates to the selected folder and opens its screen-owned deletion flow after it mounts. */
  const requestSelectedPromptFolderDelete = (promptFolderId: string): void => {
    if (!selectedWorkspacePromptFolders.some((folder) => folder.id === promptFolderId)) return
    navigateToScreenRootFolder(promptFolderId)
    // Side effect: wait for navigation to mount the selected folder screen before opening its dialog.
    void (async () => {
      await tick()
      promptFolderScreen?.openDeletePromptFolderDialog(promptFolderId)
    })()
  }
</script>

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar
      title={windowTitle}
      {isDevBuild}
      {isAppSidebarExpanded}
      onAppSidebarToggle={toggleAppSidebar}
    />
  {/if}

  <div class="sidebarSurface flex min-h-0 flex-1">
    <AppActivityBar {activeScreen} {isWorkspaceReady} {isDevMode} onNavigate={navigateToScreen} />

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
          {activeScreen}
          {isWorkspaceReady}
          {isWorkspaceLoading}
          {workspacePath}
          {screenRootFolderId}
          {promptFolderScreenMode}
          {shownFinalStatusGroups}
          folderKind={activeScreen === 'prompt-template-folders' ? 'template' : 'prompt'}
          onPromptFolderModeChange={setPromptFolderMode}
          onFinalStatusGroupShownChange={setFinalStatusGroupShown}
          onScreenRootFolderSelect={(promptFolderId) => {
            navigateToScreenRootFolder(promptFolderId)
          }}
          onDeleteSelectedPromptFolder={requestSelectedPromptFolderDelete}
        />
      {/snippet}

      {#snippet content()}
        <div
          class="mainScreenSurface sidebarFrameBorder bg-background relative flex w-full min-h-0 flex-1 flex-col border-t"
        >
          {#if activeScreen === 'home'}
            <HomeScreen
              {workspacePath}
              {isWorkspaceReady}
              {isWorkspaceLoading}
              promptCount={workspacePromptCount}
              promptFolderCount={workspacePromptFolderCount}
              onWorkspaceSelect={selectWorkspace}
              onWorkspaceCreate={createWorkspace}
              onWorkspaceClear={() => void closeWorkspace()}
            />
          {:else if activeScreen === 'settings'}
            <SettingsScreen />
          {:else if activeScreen === 'mockups'}
            <MockupsScreen bind:activeMockupId={selectedMockupId} />
          {:else if isPromptFolderScreen(activeScreen)}
            {#if screenRootFolderId && workspacePath}
              {#key `${screenRootFolderId}:${promptFolderScreenMode}`}
                <PromptFolderScreen
                  bind:this={promptFolderScreen}
                  {screenRootFolderId}
                  screenMode={promptFolderScreenMode}
                  onScreenModeChange={setPromptFolderMode}
                  onScreenRootFolderSelect={navigateToScreenRootFolder}
                  onRootPromptFolderDeleted={navigateAfterRootPromptFolderDelete}
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
