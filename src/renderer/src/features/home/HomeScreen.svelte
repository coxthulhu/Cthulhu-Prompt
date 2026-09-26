<script lang="ts">
  import {
    Bug,
    BookOpen,
    ExternalLink,
    FileText,
    FolderOpen,
    FolderPlus,
    Folders,
    X
  } from 'lucide-svelte'
  import ErrorDialog from '@renderer/common/cthulhu-ui/dialogs/ErrorDialog.svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import CountDisplay from '@renderer/common/cthulhu-ui/layout/CountDisplay.svelte'
  import CthulhuPromptWordmark from '@renderer/common/cthulhu-ui/layout/CthulhuPromptWordmark.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/buttons/LinkButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import CreateWorkspaceDialog from './CreateWorkspaceDialog.svelte'
  import WelcomeDialog from './WelcomeDialog.svelte'

  let {
    showWelcomeDialog = $bindable(false),
    workspacePath,
    isWorkspaceReady,
    isWorkspaceLoading,
    promptCount,
    promptFolderCount,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  } = $props<{
    /** Welcome visibility controlled by startup or the Welcome action. */
    showWelcomeDialog?: boolean
    workspacePath: string | null
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    promptCount: number
    promptFolderCount: number
    onWorkspaceSelect: (workspaceInfoPath: string) => Promise<WorkspaceSelectionResult>
    onWorkspaceCreate: (
      path: string,
      workspaceName: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
    onWorkspaceClear: () => void
  }>()

  type OpenWorkspaceInfoFileDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const workspaceOpenErrorFallbackText = 'Failed to open workspace. Please try again.'

  let isOpeningWorkspaceDialog = $state(false)
  let showCreateWorkspaceDialog = $state(false)
  let showWorkspaceOpenErrorDialog = $state(false)
  let workspaceOpenErrorText = $state(workspaceOpenErrorFallbackText)

  const openWorkspaceInfoFileDialog = async (): Promise<OpenWorkspaceInfoFileDialogResult> => {
    isOpeningWorkspaceDialog = true
    try {
      return await ipcInvoke<OpenWorkspaceInfoFileDialogResult>('select-workspace-info-file')
    } finally {
      isOpeningWorkspaceDialog = false
    }
  }

  const getErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const showWorkspaceOpenError = (message?: string) => {
    workspaceOpenErrorText = message?.trim() ? message : workspaceOpenErrorFallbackText
    showWorkspaceOpenErrorDialog = true
  }

  const handleSelectFolder = async () => {
    let result: OpenWorkspaceInfoFileDialogResult
    try {
      result = await openWorkspaceInfoFileDialog()
    } catch (error) {
      showWorkspaceOpenError(getErrorMessage(error))
      return
    }

    if (!result.dialogCancelled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      const selectionResult = await onWorkspaceSelect(selectedPath)

      if (!selectionResult.success) {
        showWorkspaceOpenError(selectionResult.message)
      }
    }
  }

  const handleCreateFolder = async () => {
    showCreateWorkspaceDialog = true
  }

  const openWorkspaceFolder = () => {
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return

    // Hand off to the main process so Windows opens the folder in Explorer.
    void runIpcBestEffort(() =>
      ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath)
    )
  }

  const isWorkspaceActionDisabled = $derived(isWorkspaceLoading || isOpeningWorkspaceDialog)
  const currentWorkspaceDetails = $derived.by(() => {
    if (!workspacePath) {
      return null
    }

    return {
      name: getWorkspaceFolderName(workspacePath),
      path: workspacePath
    }
  })
</script>

<main class="flex min-w-0 flex-1 overflow-y-auto px-8 py-12" data-testid="home-screen">
  <section
    class="m-auto flex w-full max-w-[780px] min-w-0 flex-col gap-[30px]"
    data-testid="home-layout"
  >
    <header class="flex flex-wrap items-end justify-between gap-5">
      <CthulhuPromptWordmark data-testid="home-title" />
      <div class="flex items-center gap-2">
        <Button
          icon={BookOpen}
          text="Welcome"
          variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
          appearance={currentWorkspaceDetails ? 'outline' : 'filled'}
          testId="show-welcome-button"
          onclick={() => (showWelcomeDialog = true)}
        />
        <LinkButton
          href={githubIssuesUrl}
          icon={Bug}
          text="Github"
          endIcon={ExternalLink}
          appearance="outline"
          testId="get-started-github-issues-link"
          target="_blank"
          rel="noreferrer"
        />
      </div>
    </header>

    <CardSurface
      class="overflow-hidden"
      role="region"
      aria-label="Workspace"
      data-testid="home-primary-card"
    >
      <Row
        variant="workspace"
        icon={FolderOpen}
        label={currentWorkspaceDetails?.name ?? 'No workspace open'}
        labelTitle={currentWorkspaceDetails?.name}
        detail={currentWorkspaceDetails?.path ?? 'Open a workspace or create one to get started.'}
        detailTitle={currentWorkspaceDetails?.path}
        detailTestId={currentWorkspaceDetails ? 'workspace-ready-path' : undefined}
        class="p-4"
      >
        {#snippet trailing()}
          <IconButton
            icon={ExternalLink}
            label="Open Workspace Folder"
            title="Open Workspace Folder"
            testId="home-open-workspace-folder-button"
            disabled={!currentWorkspaceDetails}
            onclick={openWorkspaceFolder}
          />
        {/snippet}
      </Row>
      <Separator />
      <div class="flex flex-wrap items-center justify-between gap-5 p-4">
        <div class="flex flex-wrap items-center gap-[22px]">
          <CountDisplay
            icon={FileText}
            count={promptCount}
            label="Prompts"
            data-testid="home-prompt-count-stat"
          />
          <CountDisplay
            icon={Folders}
            count={promptFolderCount}
            label="Prompt Folders"
            data-testid="home-prompt-folder-count-stat"
          />
        </div>
        <div class="ml-auto flex items-center gap-2">
          <Button
            testId="open-workspace-button"
            icon={FolderOpen}
            text="Open"
            variant="accent"
            onclick={handleSelectFolder}
            state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
          />
          <Button
            testId="create-workspace-button"
            icon={FolderPlus}
            text="Create"
            variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
            appearance={currentWorkspaceDetails ? 'outline' : 'filled'}
            onclick={handleCreateFolder}
            state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
          />
          <Button
            testId="close-workspace-button"
            icon={X}
            text="Close"
            appearance="outline"
            onclick={onWorkspaceClear}
            state={!isWorkspaceReady || isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
          />
        </div>
      </div>
    </CardSurface>
  </section>

  {#if showWelcomeDialog}
    <WelcomeDialog
      bind:open={showWelcomeDialog}
      oncreate={handleCreateFolder}
      onopen={handleSelectFolder}
    />
  {/if}

  <CreateWorkspaceDialog
    bind:open={showCreateWorkspaceDialog}
    {isWorkspaceLoading}
    {onWorkspaceCreate}
  />

  <ErrorDialog
    bind:open={showWorkspaceOpenErrorDialog}
    title="Failed to Open Workspace"
    description="The workspace could not be opened."
    errorText={workspaceOpenErrorText}
  />
</main>
