<script lang="ts">
  import {
    Bug,
    ExternalLink,
    FileText,
    FolderOpen,
    FolderPlus,
    FolderSymlink,
    Folders,
    X
  } from 'lucide-svelte'
  import CthulhuErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import FlatButton from '@renderer/common/cthulhu-ui/FlatButton.svelte'
  import FlatCard from '@renderer/common/cthulhu-ui/FlatCard.svelte'
  import FlatCopyButton from '@renderer/common/cthulhu-ui/FlatCopyButton.svelte'
  import FlatDisplayRow from '@renderer/common/cthulhu-ui/FlatDisplayRow.svelte'
  import FlatIconButton from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
  import FlatLinkButton from '@renderer/common/cthulhu-ui/FlatLinkButton.svelte'
  import FlatSeparator from '@renderer/common/cthulhu-ui/FlatSeparator.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type {
    WorkspaceCreationResult,
    WorkspaceSelectionResult
  } from '@renderer/features/workspace/types'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import CreateWorkspaceDialog from './CreateWorkspaceDialog.svelte'

  let {
    workspacePath,
    isWorkspaceReady,
    isWorkspaceLoading,
    promptCount,
    promptFolderCount,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceClear
  } = $props<{
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

  const secondaryTitleText = 'CTHULHU PROMPT'
  const SECONDARY_TITLE_MEASURE_FONT_SIZE_PX = 100
  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const workspaceOpenErrorFallbackText = 'Failed to open workspace. Please try again.'

  let isOpeningWorkspaceDialog = $state(false)
  let showCreateWorkspaceDialog = $state(false)
  let showWorkspaceOpenErrorDialog = $state(false)
  let workspaceOpenErrorText = $state(workspaceOpenErrorFallbackText)
  let secondaryTitleContainerElement: HTMLDivElement | null = $state(null)
  let secondaryTitleMeasureElement: HTMLSpanElement | null = $state(null)
  let secondaryTitleContainerWidth = $state(0)
  let secondaryTitleMeasureWidth = $state(0)

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
  const displayedPromptCount = $derived(String(promptCount))
  const displayedPromptFolderCount = $derived(String(promptFolderCount))
  const homeCardClass = 'w-full max-w-[632px] min-w-0 xl:max-w-none'
  const secondaryTitleFontSizePx = $derived.by(() => {
    if (!secondaryTitleContainerWidth || !secondaryTitleMeasureWidth) {
      return null
    }

    return (
      (secondaryTitleContainerWidth / secondaryTitleMeasureWidth) *
      SECONDARY_TITLE_MEASURE_FONT_SIZE_PX
    )
  })

  // Side effect: keep the home title scaled to the shared card/title container width.
  $effect(() => {
    const titleContainerElement = secondaryTitleContainerElement
    const measureElement = secondaryTitleMeasureElement
    if (!titleContainerElement || !measureElement) {
      return
    }

    const updateSecondaryTitleSize = () => {
      secondaryTitleContainerWidth = titleContainerElement.getBoundingClientRect().width
      secondaryTitleMeasureWidth = measureElement.getBoundingClientRect().width
    }

    updateSecondaryTitleSize()

    const resizeObserver = new ResizeObserver(() => {
      updateSecondaryTitleSize()
    })

    resizeObserver.observe(titleContainerElement)
    resizeObserver.observe(measureElement)

    return () => {
      resizeObserver.disconnect()
    }
  })
</script>

<main class="flex min-w-0 flex-1 overflow-y-auto p-6" data-testid="home-screen">
  <div class="flex min-h-full w-full min-w-0 items-center justify-center">
    <section class="relative w-full max-w-5xl min-w-0">
      <header>
        <div
          bind:this={secondaryTitleContainerElement}
          class="mx-auto w-full max-w-[632px] space-y-6 xl:max-w-none"
        >
          <h2
            class="cthulhuHomeSecondaryTitle"
            data-testid="home-title"
            style:font-size={secondaryTitleFontSizePx ? `${secondaryTitleFontSizePx}px` : undefined}
          >
            {secondaryTitleText}
          </h2>
          <div class="cthulhuHomeTitleSeparator" data-testid="home-title-separator"></div>
        </div>
      </header>
      <span
        bind:this={secondaryTitleMeasureElement}
        aria-hidden="true"
        class="cthulhuHomeSecondaryTitle cthulhuHomeSecondaryTitleMeasure"
      >
        {secondaryTitleText}
      </span>

      <div
        class="mt-7 grid grid-cols-1 items-start justify-items-center gap-4 xl:grid-cols-2 xl:justify-items-stretch"
      >
        {#if !currentWorkspaceDetails}
          <FlatCard label="Get Started" class={homeCardClass}>
            <div class="flex flex-col">
              <FlatDisplayRow
                icon={FileText}
                label="Markdown Prompt Files"
                detail="Store and manage prompts as Markdown files in a workspace folder."
              />

              <FlatSeparator />

              <FlatDisplayRow
                icon={FolderPlus}
                label="Choose a Workspace"
                detail="Create a new workspace folder, or open an existing one to continue."
              />

              <FlatSeparator />

              <FlatDisplayRow
                icon={Bug}
                label="Report an Issue"
                detail="Report bugs or request improvements!"
              >
                {#snippet trailing()}
                  <FlatLinkButton
                    href={githubIssuesUrl}
                    text="Open Github"
                    endIcon={ExternalLink}
                    variant="accent"
                    testId="get-started-github-bug-link"
                    target="_blank"
                    rel="noreferrer"
                  />
                {/snippet}
              </FlatDisplayRow>
            </div>
          </FlatCard>
        {:else}
          <FlatCard label="Current Workspace" class={homeCardClass}>
            <div class="flex flex-col">
              <FlatDisplayRow
                icon={FolderOpen}
                label={currentWorkspaceDetails.name}
                detail="Workspace Name"
                labelTitle={currentWorkspaceDetails.name}
              >
                {#snippet trailing()}
                  <FlatIconButton
                    icon={ExternalLink}
                    label="Open Workspace Folder"
                    title="Open Workspace Folder"
                    testId="home-open-workspace-folder-button"
                    onclick={openWorkspaceFolder}
                  />
                {/snippet}
              </FlatDisplayRow>

              <FlatSeparator />

              <FlatDisplayRow
                icon={FolderSymlink}
                label={currentWorkspaceDetails.path}
                detail="Workspace Path"
                labelTitle={currentWorkspaceDetails.path}
                labelTestId="workspace-ready-path"
              >
                {#snippet trailing()}
                  <FlatCopyButton
                    text={currentWorkspaceDetails.path}
                    label="Copy workspace path"
                    title="Copy workspace path"
                    testId="copy-workspace-path-button"
                  />
                {/snippet}
              </FlatDisplayRow>

              <FlatSeparator />

              <div class="cthulhuHomeWorkspaceStats">
                <FlatDisplayRow icon={FileText} label={displayedPromptCount} detail="Prompts" />
                <Separator
                  orientation="vertical"
                  class="h-auto self-stretch bg-[var(--ui-card-nested-border)]"
                />
                <FlatDisplayRow
                  icon={Folders}
                  label={displayedPromptFolderCount}
                  detail="Prompt Folders"
                />
              </div>
            </div>
          </FlatCard>
        {/if}

        <FlatCard label="Workspace Actions" class={homeCardClass}>
          <div class="flex flex-col">
            <FlatDisplayRow
              icon={FolderOpen}
              iconClass="translate-y-px"
              label="Open Workspace"
              detail="Open an existing workspace folder."
            >
              {#snippet trailing()}
                <FlatButton
                  testId="open-workspace-button"
                  class="cthulhuHomeWorkspaceActionButton"
                  text="Open"
                  variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                  onclick={handleSelectFolder}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                />
              {/snippet}
            </FlatDisplayRow>

            <FlatSeparator />

            <FlatDisplayRow
              icon={FolderPlus}
              iconClass="translate-y-px"
              label="Create Workspace"
              detail="Choose a folder to set up a new workspace."
            >
              {#snippet trailing()}
                <FlatButton
                  testId="create-workspace-button"
                  class="cthulhuHomeWorkspaceActionButton"
                  text="Create"
                  variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                  onclick={handleCreateFolder}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                />
              {/snippet}
            </FlatDisplayRow>

            {#if isWorkspaceReady}
              <FlatSeparator />

              <FlatDisplayRow
                icon={X}
                iconClass="translate-y-px"
                label="Close Workspace"
                detail="Unload the current workspace folder."
              >
                {#snippet trailing()}
                  <FlatButton
                    testId="close-workspace-button"
                    class="cthulhuHomeWorkspaceActionButton"
                    text="Close"
                    variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                    onclick={onWorkspaceClear}
                    state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                  />
                {/snippet}
              </FlatDisplayRow>
            {/if}
          </div>
        </FlatCard>
      </div>
    </section>
  </div>

  <CreateWorkspaceDialog
    bind:open={showCreateWorkspaceDialog}
    {isWorkspaceLoading}
    {onWorkspaceCreate}
  />

  <CthulhuErrorDialog
    bind:open={showWorkspaceOpenErrorDialog}
    title="Failed to Open Workspace"
    description="The workspace could not be opened."
    errorText={workspaceOpenErrorText}
  />
</main>

<style>
  .cthulhuHomeSecondaryTitle {
    color: var(--ui-normal-text);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: clamp(64px, 9vw, 88px);
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .cthulhuHomeSecondaryTitleMeasure {
    left: -9999px;
    pointer-events: none;
    position: fixed;
    top: -9999px;
    visibility: hidden;
    width: max-content;
    font-size: 100px;
  }

  .cthulhuHomeTitleSeparator {
    background: var(--ui-neutral-muted-border);
    height: 3px;
    width: 100%;
  }

  .cthulhuHomeWorkspaceStats {
    align-items: stretch;
    display: flex;
    min-width: 0;
  }

  .cthulhuHomeWorkspaceStats :global(.cthulhuUiFlatRow) {
    flex: 1 1 0;
  }

  :global(.cthulhuHomeWorkspaceActionButton) {
    justify-content: center;
    width: 82px;
  }
</style>
