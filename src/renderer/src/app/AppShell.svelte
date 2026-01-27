<script lang="ts">
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import WindowsTitleBar from '@renderer/features/window/WindowsTitleBar.svelte'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import { screens, type ScreenId } from './screens'
  import PromptFolderScreen from '../features/prompt-folders/PromptFolderScreen.svelte'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'
  import { ipcInvoke } from '@renderer/api/ipcInvoke'
  import type { CreateWorkspaceRequest, WorkspaceResult } from '@shared/ipc'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import type { PromptFolder } from '@shared/ipc'
  import { switchWorkspaceStores } from '@renderer/data/switchWorkspaceStores'
  import { setSystemSettingsContext } from './systemSettingsContext'
  import { flushPendingSaves } from '@renderer/data/flushPendingSaves'
  import { getSystemSettingsState } from '@renderer/data/system-settings/SystemSettingsStore.svelte.ts'
  import {
    getActiveWorkspaceLoadingState,
    getActiveWorkspacePath
  } from '@renderer/data/workspace/WorkspaceStore.svelte.ts'

  const runtimeConfig = getRuntimeConfig()
  const isDevMode = isDevOrPlaywrightEnvironment()
  const baseWindowTitle = 'Cthulhu Prompt'
  const executionFolderName = runtimeConfig.executionFolderName
  const systemSettingsState = getSystemSettingsState()
  const promptFontSize = $derived(
    systemSettingsState.baseSnapshot.data.promptFontSize ??
      DEFAULT_SYSTEM_SETTINGS.promptFontSize
  )
  const systemSettings = $state({
    promptFontSize: DEFAULT_SYSTEM_SETTINGS.promptFontSize
  })
  const windowControls = window.windowControls

  const checkWorkspaceFolderExists = async (folderPath: string): Promise<boolean> => {
    return await ipcInvoke<boolean, string>('check-folder-exists', folderPath)
  }

  const createWorkspaceAtPath = async (
    request: CreateWorkspaceRequest
  ): Promise<WorkspaceResult> => {
    return await ipcInvoke<WorkspaceResult, CreateWorkspaceRequest>('create-workspace', request)
  }

  setSystemSettingsContext(systemSettings)

  let activeScreen = $state<ScreenId>('home')
  const workspacePath = $derived(getActiveWorkspacePath())
  let selectedPromptFolder = $state<PromptFolder | null>(null)
  const isWorkspaceReady = $derived(Boolean(workspacePath))
  const isWorkspaceLoading = $derived(getActiveWorkspaceLoadingState())
  let hasAttemptedAutoSelect = false
  const windowTitle = $derived(
    isDevMode && executionFolderName
      ? `${baseWindowTitle} — ${executionFolderName}`
      : baseWindowTitle
  )
  const isWindows = window.electron?.process?.platform === 'win32'

  const extractErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const logWorkspaceError = (context: 'select' | 'create', message?: string) => {
    const suffix = message ? `: ${message}` : ''
    console.error(`Workspace ${context} error${suffix}`)
  }

  // Side effect: keep the settings context aligned with the latest persisted values.
  $effect(() => {
    systemSettings.promptFontSize = promptFontSize
  })

  const clearPromptFolderSelection = () => {
    selectedPromptFolder = null
  }

  const resetWorkspaceState = async () => {
    await switchWorkspaceStores(null)
    clearPromptFolderSelection()
  }

  const handleWorkspaceSuccess = async (path: string) => {
    await switchWorkspaceStores(path)
  }

  const selectWorkspace = async (path: string): Promise<WorkspaceSelectionResult> => {
    clearPromptFolderSelection()

    try {
      const promptsPath = `${path}/Prompts`
      const settingsPath = `${path}/WorkspaceInfo.json`
      const promptsExists = await checkWorkspaceFolderExists(promptsPath)
      const settingsExists = await checkWorkspaceFolderExists(settingsPath)

      if (!promptsExists || !settingsExists) {
        await resetWorkspaceState()
        return { success: false, reason: 'workspace-missing' }
      }

      await handleWorkspaceSuccess(path)
      return { success: true }
    } catch (error) {
      const message = extractErrorMessage(error)
      logWorkspaceError('select', message)
      await resetWorkspaceState()
      return {
        success: false,
        reason: 'unknown-error',
        message
      }
    }
  }

  const createWorkspace = async (
    path: string,
    includeExamplePrompts: boolean
  ): Promise<WorkspaceCreationResult> => {
    clearPromptFolderSelection()

    try {
      const result = await createWorkspaceAtPath({ workspacePath: path, includeExamplePrompts })

      if (result?.success) {
        await handleWorkspaceSuccess(path)
        return { success: true }
      }

      await resetWorkspaceState()
      return {
        success: false,
        reason: 'creation-failed',
        message: result?.error
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
            onWorkspaceClear={() => void resetWorkspaceState()}
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
