<script lang="ts">
  import {
    BookOpen,
    ExternalLink,
    FileText,
    FolderOpen,
    FolderPlus,
    Import,
    Folders,
    LayoutGrid,
    Plus,
    X
  } from 'lucide-svelte'
  import ErrorDialog from '@renderer/common/cthulhu-ui/dialogs/ErrorDialog.svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import CountDisplay from '@renderer/common/cthulhu-ui/layout/CountDisplay.svelte'
  import CthulhuPromptWordmark from '@renderer/common/cthulhu-ui/layout/CthulhuPromptWordmark.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/buttons/LinkButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import type { WorkspaceListEntry } from '@shared/domain/workspace/Workspace'
  import { ipcInvoke } from '@renderer/data/IpcFramework/IpcInvoke'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import WorkspaceSummary from '@renderer/features/workspace/WorkspaceSummary.svelte'
  import CreateWorkspaceDialog from './CreateWorkspaceDialog.svelte'
  import WelcomeDialog from './WelcomeDialog.svelte'

  const workspaceOpenErrorFallbackText = 'Failed to open workspace. Please try again.'

  let {
    showWelcomeDialog = $bindable(false),
    showWorkspaceOpenErrorDialog = $bindable(false),
    workspaceOpenErrorText = $bindable(workspaceOpenErrorFallbackText),
    workspacePath, workspaceName,
    isWorkspaceReady,
    isWorkspaceLoading,
    promptCount,
    promptCollectionCount,
    hasWorkTabs,
    onAddWorkTab,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear,
    onWorkflowBusy
  } = $props<{
    /** Welcome visibility controlled by startup or the Welcome action. */
    showWelcomeDialog?: boolean
    /** Open-failure dialog visibility, also raised by the shell for double-clicked workspace files. */
    showWorkspaceOpenErrorDialog?: boolean
    /** Failure details shown by the open-failure dialog. */
    workspaceOpenErrorText?: string
    workspaceName?: string
    workspacePath: string | null
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    promptCount: number
    promptCollectionCount: number
    /** Whether any work tab is open, which hides the New Tab callout. */
    hasWorkTabs: boolean
    /** Appends and selects a New Tab, like the title bar's New Tab button. */
    onAddWorkTab: () => void
    onWorkspaceSelect: (workspaceInfoPath: string) => Promise<WorkspaceSelectionResult>
    onWorkspaceCreate: (
      workspaceName: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
    onWorkspaceClear: () => void
    /** Defers update notifications throughout native pickers and their follow-up loading/errors. */
    onWorkflowBusy: (busy: boolean) => void
  }>()

  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'

  /** Available managed workspaces for the current dialog. */
  let workspaces = $state<WorkspaceListEntry[]>([])
  /** Whether the clickable workspace list is visible. */
  let showOpenDialog = $state(false)
  /** Identifies the action responsible for the current failure. */
  let errorTitle = $state('Failed to Open Workspace')
  let showCreateWorkspaceDialog = $state(false)
  /** Covers the native picker through the final workspace-selection result. */
  let isSelectingWorkspace = $state(false)

  // Side effect: keep the shell informed across Welcome-to-picker/dialog transitions.
  $effect(() => {
    onWorkflowBusy(showWelcomeDialog || showCreateWorkspaceDialog ||
      showWorkspaceOpenErrorDialog || showOpenDialog || isSelectingWorkspace || isWorkspaceLoading)
  })

  // Side effect: release the workflow block if navigation unmounts Home.
  $effect(() => () => onWorkflowBusy(false))

  const getErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined

  const showWorkspaceOpenError = (message?: string, title = 'Failed to Open Workspace') => {
    errorTitle = title
    workspaceOpenErrorText = message?.trim() ? message : workspaceOpenErrorFallbackText
    showWorkspaceOpenErrorDialog = true
  }

  /** Refreshes the catalog before opening either workspace dialog. */
  const showCatalogDialog = async (dialog: 'open' | 'create') => {
    isSelectingWorkspace = true
    try {
      workspaces = await ipcInvoke<WorkspaceListEntry[]>('list-workspaces')
      if (dialog === 'open') showOpenDialog = true
      else showCreateWorkspaceDialog = true
    } catch (error) { showWorkspaceOpenError(getErrorMessage(error)) }
    finally { isSelectingWorkspace = false }
  }

  /** Loads a clicked database using the shell's normal workspace-switching workflow. */
  const selectWorkspace = async (workspace: WorkspaceListEntry) => {
    showOpenDialog = false
    /** Surface failures here while the shell restores the selected workspace session. */
    const result = await onWorkspaceSelect(workspace.path)
    if (!result.success) showWorkspaceOpenError(result.message)
  }

  /** Keeps the current session active throughout the single-file import picker. */
  const importWorkspace = async () => {
    isSelectingWorkspace = true
    try { await ipcInvoke('import-workspace') }
    catch (error) { showWorkspaceOpenError(getErrorMessage(error), 'Failed to Import Workspace') }
    finally { isSelectingWorkspace = false }
  }

  /** Prevents concurrent workspace workflows and duplicate picker invocations. */
  const isWorkspaceActionDisabled = $derived(isWorkspaceLoading || isSelectingWorkspace)
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
          variant={workspacePath ? 'neutral' : 'accent'}
          appearance={workspacePath ? 'outline' : 'filled'}
          testId="show-welcome-button"
          onclick={() => (showWelcomeDialog = true)}
        />
        <LinkButton
          href={githubIssuesUrl}
          icon={ExternalLink}
          text="Github"
          appearance="outline"
          testId="get-started-github-issues-link"
          target="_blank"
          rel="noreferrer"
        />
      </div>
    </header>

    <!-- The cards stack closer to each other than to the header. -->
    <div class="flex flex-col gap-3">
      <CardSurface
        class="overflow-hidden"
        role="region"
        aria-label="Workspace"
        data-testid="home-primary-card"
      >
        <WorkspaceSummary {workspaceName} {workspacePath} pathTestId="workspace-ready-path"
          openFolderTestId="home-open-workspace-folder-button" />
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
              count={promptCollectionCount}
              label="Prompt Collections"
              data-testid="home-prompt-collection-count-stat"
            />
          </div>
          <div class="ml-auto flex items-center gap-2">
            <Button
              testId="open-workspace-button"
              icon={FolderOpen}
              text="Open"
              variant={workspacePath ? 'neutral' : 'accent'}
              appearance={workspacePath ? 'outline' : 'filled'}
              onclick={() => showCatalogDialog('open')}
              disabled={isWorkspaceActionDisabled}
            />
            <Button
              testId="create-workspace-button"
              icon={FolderPlus}
              text="Create"
              variant={workspacePath ? 'neutral' : 'accent'}
              appearance={workspacePath ? 'outline' : 'filled'}
              onclick={() => showCatalogDialog('create')}
              disabled={isWorkspaceActionDisabled}
            />
            <Button testId="import-workspace-button" icon={Import} text="Import" appearance="outline"
              onclick={importWorkspace} disabled={isWorkspaceActionDisabled} />
            <Button
              testId="close-workspace-button"
              icon={X}
              text="Close"
              appearance="outline"
              onclick={onWorkspaceClear}
              disabled={!isWorkspaceReady || isWorkspaceActionDisabled}
            />
          </div>
        </div>
      </CardSurface>

      <!-- Points an open workspace without tabs to the tab bar, where its collections open. -->
      {#if isWorkspaceReady && !hasWorkTabs}
        <CardSurface role="region" aria-label="Get started" data-testid="home-new-tab-card">
          <Row
            icon={LayoutGrid}
            label="Open a new tab to get started"
            detail="Your prompt collections open in tabs at the top of the window."
            wrapDetail
            class="p-4"
          >
            {#snippet trailing()}
              <Button
                testId="home-new-tab-button"
                icon={Plus}
                text="New Tab"
                variant="accent"
                onclick={onAddWorkTab}
              />
            {/snippet}
          </Row>
        </CardSurface>
      {/if}
    </div>
  </section>

  {#if showWelcomeDialog}
    <WelcomeDialog
      bind:open={showWelcomeDialog}
      oncreate={() => showCatalogDialog('create')}
      onopen={() => showCatalogDialog('open')}
    />
  {/if}

  <Dialog bind:open={showOpenDialog} icon={FolderOpen} title="Open Workspace" submitText="" showSubmitButton={false}
    scrollBody class="w-full max-w-md">
    <div class="grid gap-2 p-4">
      {#each workspaces as workspace (workspace.id)}
        <Button text={workspace.name} appearance="outline" onclick={() => selectWorkspace(workspace)} />
      {:else}
        <p class="text-sm text-[var(--ui-muted-text)]">No workspaces available.</p>
      {/each}
    </div>
  </Dialog>

  <CreateWorkspaceDialog
    {workspaces}
    bind:open={showCreateWorkspaceDialog}
    {isWorkspaceLoading}
    {onWorkspaceCreate}
  />

  <ErrorDialog
    bind:open={showWorkspaceOpenErrorDialog}
    title={errorTitle}
    description={errorTitle === 'Failed to Import Workspace' ? 'The workspace could not be imported.' : 'The workspace could not be opened.'}
    errorText={workspaceOpenErrorText}
  />
</main>
