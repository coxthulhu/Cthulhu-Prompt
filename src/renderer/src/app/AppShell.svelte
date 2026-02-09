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
  import type { PromptFolder } from '@shared/ipc'
  import { tanstackSystemSettingsCollection } from '@renderer/data/tanstack/Queries/TanstackSystemSettingsQuery'
  import { tanstackWorkspaceCollection } from '@renderer/data/tanstack/Collections/TanstackWorkspaceCollection'
  import { syncTanstackSystemSettingsDraft } from '@renderer/data/tanstack/UiState/TanstackSystemSettingsDraftStore.svelte.ts'
  import { switchTanstackWorkspaceStoreBridge } from '@renderer/data/tanstack/UiState/TanstackWorkspaceStoreBridge'
  import { setSystemSettingsContext, type SystemSettingsContext } from './systemSettingsContext'
  import {
    getTanstackSelectedWorkspaceId,
    setTanstackSelectedWorkspaceId
  } from '@renderer/data/tanstack/UiState/TanstackWorkspaceSelection.svelte.ts'
  import { loadTanstackWorkspaceByPath } from '@renderer/data/tanstack/Queries/TanstackWorkspaceQuery'
  import {
    closeTanstackWorkspace,
    createTanstackWorkspace
  } from '@renderer/data/tanstack/Mutations/TanstackWorkspaceMutations'
  import {
    setTanstackWorkspaceSelectionContext,
    type TanstackWorkspaceSelectionContext
  } from './TanstackWorkspaceSelectionContext'
  import { flushPendingSaves } from '@renderer/data/flushPendingSaves'
  import type { TanstackSystemSettings } from '@shared/tanstack/TanstackSystemSettings'
  import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'

  const runtimeConfig = getRuntimeConfig()
  const isDevMode = isDevOrPlaywrightEnvironment()
  const baseWindowTitle = 'Cthulhu Prompt'
  const executionFolderName = runtimeConfig.executionFolderName
  const systemSettingsQuery = useLiveQuery((q) =>
    q.from({ settings: tanstackSystemSettingsCollection }).findOne()
  ) as { data: TanstackSystemSettings }
  const systemSettings: SystemSettingsContext = {
    get promptFontSize() {
      return systemSettingsQuery.data.promptFontSize
    },
    get promptEditorMinLines() {
      return systemSettingsQuery.data.promptEditorMinLines
    }
  }
  const tanstackWorkspaceSelection: TanstackWorkspaceSelectionContext = {
    get selectedWorkspaceId() {
      return getTanstackSelectedWorkspaceId()
    }
  }
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const windowControls = window.windowControls

  const tanstackWorkspaceQuery = useLiveQuery((q) =>
    q.from({ workspace: tanstackWorkspaceCollection })
  ) as { data: TanstackWorkspace[]; isLoading: boolean }

  setSystemSettingsContext(systemSettings)
  setTanstackWorkspaceSelectionContext(tanstackWorkspaceSelection)

  let activeScreen = $state<ScreenId>('home')
  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = getTanstackSelectedWorkspaceId()
    return (
      tanstackWorkspaceQuery.data.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    )
  })
  const workspacePath = $derived(selectedWorkspace?.workspacePath ?? null)
  let selectedPromptFolder = $state<PromptFolder | null>(null)
  const isWorkspaceReady = $derived(Boolean(selectedWorkspace))
  let workspaceActionCount = $state(0)
  const isWorkspaceLoading = $derived(workspaceActionCount > 0 || tanstackWorkspaceQuery.isLoading)
  let hasAttemptedAutoSelect = false
  const windowTitle = $derived(
    isDevMode && executionFolderName
      ? `${baseWindowTitle} — ${executionFolderName}`
      : baseWindowTitle
  )
  const isWindows = window.electron?.process?.platform === 'win32'

  const extractErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const logWorkspaceError = (context: 'select' | 'create' | 'close', message?: string) => {
    const suffix = message ? `: ${message}` : ''
    console.error(`Workspace ${context} error${suffix}`)
  }

  const beginWorkspaceAction = () => {
    workspaceActionCount += 1
  }

  const endWorkspaceAction = () => {
    workspaceActionCount -= 1
  }

  // Side effect: keep the module-level TanStack settings draft synced with query-backed settings.
  $effect(() => {
    syncTanstackSystemSettingsDraft({
      promptFontSize,
      promptEditorMinLines
    })
  })

  const clearPromptFolderSelection = () => {
    selectedPromptFolder = null
  }

  const clearTanstackWorkspaceSelection = () => {
    setTanstackSelectedWorkspaceId(null)
  }

  const resetWorkspaceState = async () => {
    try {
      await closeTanstackWorkspace()
    } catch {
      // Side effect: always continue local workspace reset even when close IPC fails.
    } finally {
      await switchTanstackWorkspaceStoreBridge(null)
      clearPromptFolderSelection()
      clearTanstackWorkspaceSelection()
    }
  }

  const loadWorkspaceSelection = async (path: string): Promise<void> => {
    const workspaceId = await loadTanstackWorkspaceByPath(path)
    setTanstackSelectedWorkspaceId(workspaceId)
    await switchTanstackWorkspaceStoreBridge(path)
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
      if (!workspaceMissing) {
        logWorkspaceError('select', message)
      }
      await resetWorkspaceState()
      if (workspaceMissing) {
        return { success: false, reason: 'workspace-missing' }
      }
      return {
        success: false,
        reason: 'unknown-error',
        message
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
      const result = await createTanstackWorkspace(path, includeExamplePrompts)

      if (result.success) {
        await loadWorkspaceSelection(path)
        return { success: true }
      }

      await resetWorkspaceState()
      return {
        success: false,
        reason: 'creation-failed',
        message: result.error
      }
    } catch (error) {
      const message = extractErrorMessage(error)
      logWorkspaceError('create', message)
      await resetWorkspaceState()
      return {
        success: false,
        reason: 'unknown-error',
        message
      }
    } finally {
      endWorkspaceAction()
    }
  }

  const closeWorkspace = async (): Promise<void> => {
    beginWorkspaceAction()

    try {
      await closeTanstackWorkspace()
    } catch (error) {
      const message = extractErrorMessage(error)
      logWorkspaceError('close', message)
    } finally {
      await switchTanstackWorkspaceStoreBridge(null)
      clearPromptFolderSelection()
      endWorkspaceAction()
    }
  }

  // Auto-select dev workspace in dev/playwright to mirror legacy behavior.
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
      const selectionResult = await selectWorkspace(devWorkspacePath)
      if (
        !selectionResult.success &&
        selectionResult.reason !== 'workspace-missing' &&
        selectionResult.message
      ) {
        logWorkspaceError('select', selectionResult.message)
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
    if (screen === 'prompt-folders' && !selectedPromptFolder) return
    activeScreen = screen
  }

  const navigateToPromptFolder = (folder: PromptFolder): void => {
    if (!isWorkspaceReady) return
    if (
      activeScreen === 'prompt-folders' &&
      selectedPromptFolder?.folderName === folder.folderName
    ) {
      return
    }
    selectedPromptFolder = folder
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
        {selectedPromptFolder}
        onNavigate={navigateToScreen}
        onPromptFolderSelect={(folder) => {
          navigateToPromptFolder(folder)
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
          {#if selectedPromptFolder && workspacePath}
            <PromptFolderScreen folder={selectedPromptFolder} />
          {/if}
        {:else if activeScreen === 'test-screen'}
          <TestScreen />
        {/if}
      </div>
    {/snippet}
  </ResizableSidebar>
</div>
