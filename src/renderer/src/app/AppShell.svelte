<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
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
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { switchWorkspaceStoreBridge } from '@renderer/data/UiState/WorkspaceStoreBridge'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getSelectedWorkspaceId,
    setSelectedWorkspaceId
  } from '@renderer/data/UiState/WorkspaceSelection.svelte.ts'
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

  const workspaceQuery = useLiveQuery((q) =>
    q.from({ workspace: workspaceCollection })
  ) as { data: Workspace[]; isLoading: boolean }

  setSystemSettingsContext(systemSettings)
  setWorkspaceSelectionContext(workspaceSelection)

  let activeScreen = $state<ScreenId>('home')
  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = getSelectedWorkspaceId()
    return (
      workspaceQuery.data.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    )
  })
  const workspacePath = $derived(selectedWorkspace?.workspacePath ?? null)
  let selectedPromptFolderId = $state<string | null>(null)
  const isWorkspaceReady = $derived(Boolean(selectedWorkspace))
  let workspaceActionCount = $state(0)
  const isWorkspaceLoading = $derived(workspaceActionCount > 0 || workspaceQuery.isLoading)
  let hasAttemptedAutoSelect = false
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

  const loadWorkspaceSelection = async (path: string): Promise<void> => {
    const workspaceId = await loadWorkspaceByPath(path)
    setSelectedWorkspaceId(workspaceId)
    await switchWorkspaceStoreBridge(path)
  }

  const isWorkspaceMissingError = (message?: string): boolean => {
    return message === 'Invalid workspace path'
  }

  const selectWorkspace = async (path: string): Promise<WorkspaceSelectionResult> => {
    clearPromptFolderSelection()
    beginWorkspaceAction()

    try {
      await loadWorkspaceSelection(path)
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
    path: string,
    includeExamplePrompts: boolean
  ): Promise<WorkspaceCreationResult> => {
    clearPromptFolderSelection()
    beginWorkspaceAction()

    try {
      return await runIpcBestEffort<WorkspaceCreationResult>(
        async () => {
          const result = await createWorkspaceMutation(path, includeExamplePrompts)

          if (result.success) {
            await loadWorkspaceSelection(path)
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
    } finally {
      await switchWorkspaceStoreBridge(null)
      clearPromptFolderSelection()
      endWorkspaceAction()
    }
  }

  // Side effect: auto-select the configured dev workspace once in dev/playwright environments.
  $effect(() => {
    if (hasAttemptedAutoSelect || !isDevMode) {
      return
    }

    const devWorkspacePath = runtimeConfig.devWorkspacePath

    if (!devWorkspacePath) {
      hasAttemptedAutoSelect = true
      return
    }

    hasAttemptedAutoSelect = true
    ;(async () => {
      await selectWorkspace(devWorkspacePath)
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
