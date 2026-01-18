<script lang="ts">
  import ResizableSidebar from '@renderer/features/sidebar/ResizableSidebar.svelte'
  import AppSidebar from '@renderer/features/sidebar/AppSidebar.svelte'
  import { getRuntimeConfig, isDevOrPlaywrightEnvironment } from './runtimeConfig'
  import TestScreen from '../features/dev-tools/TestScreen.svelte'
  import HomeScreen from '@renderer/features/home/HomeScreen.svelte'
  import { screens, type ScreenId } from './screens'
  import PromptFolderScreen from '../features/prompt-folders/PromptFolderScreen.svelte'
  import SettingsScreen from '../features/settings/SettingsScreen.svelte'
  import {
    useCheckWorkspaceFolderExistsMutation,
    useCreateWorkspaceMutation
  } from '@renderer/api/workspace'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import type { PromptFolder } from '@shared/ipc'
  import { switchWorkspaceStores } from '@renderer/data/switchWorkspaceStores'

  const runtimeConfig = getRuntimeConfig()
  const isDevMode = isDevOrPlaywrightEnvironment()

  const { mutateAsync: checkWorkspaceFolderExists } = useCheckWorkspaceFolderExistsMutation()
  const { mutateAsync: createWorkspaceAtPath } = useCreateWorkspaceMutation()

  let activeScreen = $state<ScreenId>('home')
  let workspacePath = $state<string | null>(null)
  let selectedPromptFolder = $state<PromptFolder | null>(null)
  const isWorkspaceReady = $derived(Boolean(workspacePath))
  let isWorkspaceLoading = $state(false)
  let hasAttemptedAutoSelect = false

  const extractErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const logWorkspaceError = (context: 'select' | 'create', message?: string) => {
    const suffix = message ? `: ${message}` : ''
    console.error(`Workspace ${context} error${suffix}`)
  }

  const setWorkspaceLoading = (value: boolean) => {
    isWorkspaceLoading = value
  }

  const clearPromptFolderSelection = () => {
    selectedPromptFolder = null
  }

  const resetWorkspaceState = async () => {
    await switchWorkspaceStores(null)
    workspacePath = null
    clearPromptFolderSelection()
  }

  const handleWorkspaceSuccess = async (path: string) => {
    await switchWorkspaceStores(path)
    workspacePath = path
  }

  const selectWorkspace = async (path: string): Promise<WorkspaceSelectionResult> => {
    clearPromptFolderSelection()
    setWorkspaceLoading(true)

    try {
      const promptsPath = `${path}/prompts`
      const settingsPath = `${path}/WorkspaceSettings.json`
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
    } finally {
      setWorkspaceLoading(false)
    }
  }

  const createWorkspace = async (path: string): Promise<WorkspaceCreationResult> => {
    clearPromptFolderSelection()
    setWorkspaceLoading(true)

    try {
      const result = await createWorkspaceAtPath(path)

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
    } finally {
      setWorkspaceLoading(false)
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

<ResizableSidebar defaultWidth={200} minWidth={200} maxWidth={400}>
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
