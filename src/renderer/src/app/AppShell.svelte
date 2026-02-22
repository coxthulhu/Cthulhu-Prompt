<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
  import { createLoadingOverlayState } from '@renderer/common/ui/loading/loadingOverlayState.svelte.ts'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import { screens, type ScreenId } from './screens'
  import PromptFolderScreen from '../features/prompt-folders/PromptFolderScreen.svelte'
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
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { switchWorkspaceStoreBridge } from '@renderer/data/UiState/WorkspaceStoreBridge'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/data/UiState/WorkspaceSelection.svelte.ts'
  import { syncLastWorkspacePath } from '@renderer/data/Mutations/UserPersistenceMutations'
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
  import { flushPendingSaves } from '@renderer/data/flushPendingSaves'
  import type { SystemSettings } from '@shared/SystemSettings'
  import type { Workspace } from '@shared/Workspace'

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
    }
  }
  const workspaceSelection: WorkspaceSelectionContext = {
    get selectedWorkspaceId() {
      return getSelectedWorkspaceId()
    }
  }
  const windowControls = window.windowControls

  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
    isLoading: boolean
  }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)

  let activeScreen = $state<ScreenId>('home')
  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = getSelectedWorkspaceId()
    return workspaceQuery.data.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  })
  const workspacePath = $derived(selectedWorkspace?.workspacePath ?? null)
  let selectedPromptFolderId = $state<string | null>(null)
  const isWorkspaceReady = $derived(Boolean(selectedWorkspace))
  let workspaceActionCount = $state(0)
  const isWorkspaceLoading = $derived(workspaceActionCount > 0 || workspaceQuery.isLoading)
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
  }

  const resetWorkspaceState = async () => {
    await runIpcBestEffort(closeWorkspaceMutation)
    await switchWorkspaceStoreBridge(null)
    clearPromptFolderSelection()
  }

  const loadWorkspaceSelection = async (workspacePath: string): Promise<void> => {
    const workspaceId = await loadWorkspaceByPath(workspacePath)
    setSelectedWorkspaceId(workspaceId)
    await switchWorkspaceStoreBridge(workspacePath)
    await syncLastWorkspacePath(workspacePath)
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const restoreWorkspaceFromPersistence = async (): Promise<void> => {
    const lastWorkspacePath =
      userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)!.lastWorkspacePath

    if (!lastWorkspacePath) {
      return
    }

    const selectionResult = await selectWorkspace(lastWorkspacePath)
    if (selectionResult.success) {
      return
    }

    if (selectionResult.reason === 'workspace-missing') {
      await syncLastWorkspacePath(null)
      console.error('Failed to restore last workspace. Cleared persisted path.', {
        workspacePath: lastWorkspacePath,
        reason: selectionResult.reason
      })
      return
    }

    console.error('Failed to restore last workspace.', {
      workspacePath: lastWorkspacePath,
      reason: selectionResult.reason
    })
  }

  const selectWorkspace = async (workspacePath: string): Promise<WorkspaceSelectionResult> => {
    clearPromptFolderSelection()
    beginWorkspaceAction()

    try {
      await loadWorkspaceSelection(workspacePath)
      return { success: true }
    } catch (error) {
      const message = extractErrorMessage(error)
      const workspaceMissing = isWorkspaceMissingError(message)
      await resetWorkspaceState()
      if (workspaceMissing) {
        return { success: false, reason: 'workspace-missing' }
      }
      return {
        success: false,
        reason: 'unknown-error'
      }
    } finally {
      endWorkspaceAction()
    }
  }

  const createWorkspace = async (
    workspacePath: string,
    includeExamplePrompts: boolean
  ): Promise<WorkspaceCreationResult> => {
    clearPromptFolderSelection()
    beginWorkspaceAction()

    try {
      return await runIpcBestEffort<WorkspaceCreationResult>(
        async () => {
          const result = await createWorkspaceMutation(workspacePath, includeExamplePrompts)

          if (result.success) {
            await loadWorkspaceSelection(workspacePath)
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
      await runIpcBestEffort(() => syncLastWorkspacePath(null))
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

  // Side effect: flush pending autosaves before allowing the main process to close the window.
  $effect(() => {
    const unsubscribe = windowControls.onCloseRequested(() => {
      void (async () => {
        await flushPendingSaves()
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
    if (screen === 'prompt-folders' && !selectedPromptFolderId) return
    activeScreen = screen
  }

  const navigateToPromptFolder = (promptFolderId: string): void => {
    if (!isWorkspaceReady) return
    if (activeScreen === 'prompt-folders' && selectedPromptFolderId === promptFolderId) {
      return
    }
    selectedPromptFolderId = promptFolderId
    navigateToScreen('prompt-folders')
  }
</script>

<div class="flex h-screen w-full flex-col">
  {#if isWindows}
    <WindowsTitleBar title={windowTitle} />
  {/if}

  <ResizableSidebar
    defaultWidth={200}
    minWidth={180}
    maxWidth={400}
    handleTestId="app-sidebar-resize-handle"
    containerClass="flex-1 min-h-0"
  >
    {#snippet sidebar()}
      <AppSidebar
        {activeScreen}
        {isWorkspaceReady}
        {isDevMode}
        {workspacePath}
        {selectedPromptFolderId}
        onNavigate={navigateToScreen}
        onPromptFolderSelect={(promptFolderId) => {
          navigateToPromptFolder(promptFolderId)
        }}
      />
    {/snippet}

    {#snippet content()}
      <div
        data-slot="sidebar-inset"
        class="bg-background relative flex w-full flex-1 flex-col min-h-0"
      >
        {#if activeScreen === 'home'}
          <HomeScreen
            {workspacePath}
            {isWorkspaceReady}
            {isWorkspaceLoading}
            onWorkspaceSelect={selectWorkspace}
            onWorkspaceCreate={createWorkspace}
            onWorkspaceClear={() => void closeWorkspace()}
          />
        {:else if activeScreen === 'settings'}
          <SettingsScreen />
        {:else if activeScreen === 'prompt-folders'}
          {#if selectedPromptFolderId && workspacePath}
            <PromptFolderScreen promptFolderId={selectedPromptFolderId} />
          {/if}
        {:else if activeScreen === 'test-screen'}
          <TestScreen />
        {/if}
      </div>
    {/snippet}
  </ResizableSidebar>
</div>

{#if startupRestoreOverlay.isVisible()}
  <LoadingOverlay
    testId="startup-loading-overlay"
    fadeMs={STARTUP_LOADING_OVERLAY_FADE_MS}
    isFading={startupRestoreOverlay.isFading()}
    message="Loading workspace..."
    fullscreen
  />
{/if}
