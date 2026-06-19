<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import AppActivityBar from '@renderer/features/sidebar/AppActivityBar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import AppOverlays from './AppOverlays.svelte'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import MockupsScreen from '@renderer/features/mockups/MockupsScreen.svelte'
  import { hasMockup } from '@renderer/features/mockups/mockupCatalog'
  import { screens, type ScreenId } from './screens'
  import PromptFolderScreen from '../features/prompt-folders/PromptFolderScreen.svelte'
  import { PromptFolderScreenMode } from '../features/prompt-folders/promptFolderScreenMode'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
  import {
    USER_PERSISTENCE_DRAFT_ID,
    userPersistenceDraftCollection
  } from '@renderer/data/Collections/UserPersistenceDraftCollection'
  import { workspacePersistenceDraftCollection } from '@renderer/data/Collections/WorkspacePersistenceDraftCollection'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { switchWorkspaceStoreBridge } from '@renderer/data/UiState/WorkspaceStoreBridge'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/data/UiState/WorkspaceSelection.svelte.ts'
  import { syncLastWorkspaceInfoPath } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { syncWorkspaceScreenSelection } from '@renderer/data/Mutations/WorkspacePersistenceMutations'
  import { setAppSidebarWidthWithAutosave } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'
  import { loadWorkspacePersistence } from '@renderer/data/Queries/UserPersistenceQuery'
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
  import { setPromptFolderPromptTreeEntryIdWithAutosave } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import {
    isWorkspaceScreenSelectionSame,
    type WorkspaceScreenSelection
  } from '@shared/UserPersistence'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { SystemSettings } from '@shared/SystemSettings'
  import type { Workspace } from '@shared/Workspace'
  import { preparePromptFolderName } from '@shared/promptFolderName'

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
  const getUserPersistenceDraft = () =>
    userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)!
  const appSidebarDefaultWidthPx = getUserPersistenceDraft().appSidebarWidthPx

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

    return selectedWorkspace.promptFolderIds
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })
  const workspacePromptCount = $derived.by(() => {
    const promptIds = new SvelteSet<string>()
    for (const promptFolder of selectedWorkspacePromptFolders) {
      for (const promptId of promptFolder.promptIds) {
        promptIds.add(promptId)
      }
    }

    return promptIds.size
  })
  const workspacePromptFolderCount = $derived(selectedWorkspace?.promptFolderIds.length ?? 0)
  let selectedPromptFolderId = $state<string | null>(null)
  let promptFolderScreenMode = $state(PromptFolderScreenMode.Active)
  const isWorkspaceReady = $derived(Boolean(selectedWorkspace))
  let workspaceActionCount = $state(0)
  const isWorkspaceLoading = $derived(workspaceActionCount > 0)
  const STARTUP_LOADING_OVERLAY_FADE_MS = 200
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
    selectedPromptFolderId = null
    promptFolderScreenMode = PromptFolderScreenMode.Active
  }

  const hasWorkspacePromptFolder = (promptFolderId: string | null): promptFolderId is string => {
    if (!selectedWorkspace || !promptFolderId) {
      return false
    }

    return selectedWorkspace.promptFolderIds.includes(promptFolderId)
  }

  const resolvePromptFolderNavigationId = (): string | null => {
    const workspaceId = getSelectedWorkspaceId()
    const workspacePersistence = workspaceId
      ? workspacePersistenceDraftCollection.get(workspaceId)
      : null
    const firstPromptFolderId = selectedWorkspace?.promptFolderIds[0] ?? null
    const persistedLastPromptFolderId = workspacePersistence?.lastPromptFolderId ?? null

    return hasWorkspacePromptFolder(selectedPromptFolderId)
      ? selectedPromptFolderId
      : hasWorkspacePromptFolder(persistedLastPromptFolderId)
        ? persistedLastPromptFolderId
        : firstPromptFolderId
  }

  const buildWorkspaceScreenSelection = (screen: ScreenId): WorkspaceScreenSelection => {
    if (screen === 'prompt-folders') {
      return {
        selectedScreen: screen,
        selectedScreenData: {
          promptFolderId: selectedPromptFolderId
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

  const resetWorkspaceState = async () => {
    await runIpcBestEffort(closeWorkspaceMutation)
    await switchWorkspaceStoreBridge(null)
    clearPromptFolderSelection()
  }

  const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
    const workspaceFileName = preparePromptFolderName(workspaceName).folderName
    return `${workspacePath.replace(/[\\/]+$/, '')}\\${workspaceFileName}.cthulhuprompt.json`
  }

  const loadWorkspaceSelection = async (workspaceInfoPath: string): Promise<void> => {
    await switchWorkspaceStoreBridge(workspaceInfoPath)
    const workspaceId = await loadWorkspaceByPath(workspaceInfoPath)
    await loadWorkspacePersistence(workspaceId)
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

    const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)

    if (draftRecord && isWorkspaceScreenSelectionSame(draftRecord, workspaceScreenSelection)) {
      return
    }

    await syncWorkspaceScreenSelection(workspaceId, workspaceScreenSelection)
  }

  const restoreWorkspaceHomeScreen = async (workspaceId: string): Promise<void> => {
    clearPromptFolderSelection()
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

    const workspacePersistence = workspacePersistenceDraftCollection.get(workspaceId)
    if (!workspacePersistence) {
      return
    }

    const persistedScreenConfig = screens[workspacePersistence.selectedScreen]
    if (persistedScreenConfig.devOnly && !isDevMode) {
      await restoreWorkspaceHomeScreen(workspaceId)
      return
    }

    if (workspacePersistence.selectedScreen === 'prompt-folders') {
      const workspaceRecord = workspaceCollection.get(workspaceId)
      const persistedPromptFolderId = workspacePersistence.selectedScreenData.promptFolderId
      const hasPromptFolder =
        persistedPromptFolderId !== null &&
        Boolean(workspaceRecord?.promptFolderIds.includes(persistedPromptFolderId))

      if (hasPromptFolder && persistedPromptFolderId) {
        selectedPromptFolderId = persistedPromptFolderId
        activeScreen = 'prompt-folders'
        if (workspacePersistence.lastPromptFolderId !== persistedPromptFolderId) {
          await syncWorkspaceScreenSelection(workspaceId, {
            selectedScreen: 'prompt-folders',
            selectedScreenData: {
              promptFolderId: persistedPromptFolderId
            }
          })
        }
        return
      }

      await restoreWorkspaceHomeScreen(workspaceId)
      return
    }

    if (workspacePersistence.selectedScreen === 'mockups') {
      const persistedMockupId = workspacePersistence.selectedScreenData.mockupId
      if (persistedMockupId === null || hasMockup(persistedMockupId)) {
        clearPromptFolderSelection()
        selectedMockupId = persistedMockupId
        activeScreen = 'mockups'
        return
      }

      await restoreWorkspaceHomeScreen(workspaceId)
      return
    }

    clearPromptFolderSelection()
    activeScreen = workspacePersistence.selectedScreen
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const persistPromptNavigationSelection = () => {
    const workspaceId = getSelectedWorkspaceId()
    const selectedFolderId = promptNavigation.selectedFolderId
    const selectedRow = promptNavigation.selectedRow
    if (!workspaceId || !selectedFolderId || !selectedRow) {
      return
    }

    setPromptFolderPromptTreeEntryIdWithAutosave(
      workspaceId,
      selectedFolderId,
      promptNavigationRowToPersistedEntryId(selectedRow)
    )
  }

  const restoreWorkspaceFromPersistence = async (): Promise<void> => {
    const lastWorkspaceInfoPath =
      userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)!.lastWorkspaceInfoPath

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
    clearPromptFolderSelection()
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
    clearPromptFolderSelection()
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
      await runIpcBestEffort(closeWorkspaceMutation)
      await runIpcBestEffort(() => syncLastWorkspaceInfoPath(null))
    } finally {
      await switchWorkspaceStoreBridge(null)
      clearPromptFolderSelection()
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
    if (screen === 'prompt-folders') {
      const promptFolderId = resolvePromptFolderNavigationId()
      if (!promptFolderId) return
      selectedPromptFolderId = promptFolderId
    } else {
      promptFolderScreenMode = PromptFolderScreenMode.Active
    }
    activeScreen = screen
    void runIpcBestEffort(() => syncCurrentWorkspaceScreenSelection(screen))
  }

  const navigateToPromptFolder = (promptFolderId: string): void => {
    if (!isWorkspaceReady) return
    if (activeScreen === 'prompt-folders' && selectedPromptFolderId === promptFolderId) {
      return
    }
    selectedPromptFolderId = promptFolderId
    navigateToScreen('prompt-folders')
  }

  const setPromptFolderMode = (nextMode: PromptFolderScreenMode): void => {
    promptFolderScreenMode = nextMode
  }
</script>

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar title={windowTitle} />
  {/if}

  <div class="sidebarSurface flex min-h-0 flex-1">
    <AppActivityBar {activeScreen} {isWorkspaceReady} {isDevMode} onNavigate={navigateToScreen} />

    <ResizableSidebar
      defaultWidth={appSidebarDefaultWidthPx}
      minWidth={240}
      maxWidth={400}
      handleTestId="app-sidebar-resize-handle"
      containerClass="min-w-0 flex-1 min-h-0"
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
          {selectedPromptFolderId}
          promptFolderScreenMode={promptFolderScreenMode}
          onPromptFolderModeChange={setPromptFolderMode}
          onPromptFolderSelect={(promptFolderId) => {
            navigateToPromptFolder(promptFolderId)
          }}
        />
      {/snippet}

      {#snippet content()}
        <div
          class="mainScreenSurface sidebarFrameBorder bg-background relative flex w-full min-h-0 flex-1 flex-col border-l border-t"
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
          {:else if activeScreen === 'prompt-folders'}
            {#if selectedPromptFolderId && workspacePath}
              {#key `${selectedPromptFolderId}:${promptFolderScreenMode}`}
                <PromptFolderScreen
                  promptFolderId={selectedPromptFolderId}
                  screenMode={promptFolderScreenMode}
                  onPromptFolderSelect={navigateToPromptFolder}
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
