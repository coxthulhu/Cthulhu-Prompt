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
  import ErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import Button from '@renderer/common/cthulhu-ui/Button.svelte'
  import Card from '@renderer/common/cthulhu-ui/Card.svelte'
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import DisplayRow from '@renderer/common/cthulhu-ui/DisplayRow.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/LinkButton.svelte'
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
  const secondaryTitleWords = ['CTHULHU', 'PROMPT'] as const
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
  const homeCardClass = 'w-full min-w-0'
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
  <div class="flex min-h-full w-full min-w-0 items-start justify-center">
    <section
      class="cthulhuHomeLayout relative my-auto w-full max-w-5xl min-w-0"
      data-testid="home-layout"
    >
      <header>
        <div
          bind:this={secondaryTitleContainerElement}
          class="cthulhuHomeTitleContainer mx-auto w-full space-y-6"
        >
          <h2
            class="cthulhuHomeSecondaryTitle"
            data-testid="home-title"
            aria-label={secondaryTitleText}
            style:font-size={secondaryTitleFontSizePx ? `${secondaryTitleFontSizePx}px` : undefined}
          >
            {#each secondaryTitleWords as word (word)}
              <span aria-hidden="true" data-testid={`home-title-word-${word.toLowerCase()}`}>
                {word}
              </span>
            {/each}
          </h2>
          <div class="cthulhuHomeTitleSeparator" data-testid="home-title-separator"></div>
        </div>
      </header>
      <span
        bind:this={secondaryTitleMeasureElement}
        aria-hidden="true"
        class="cthulhuHomeSecondaryTitle cthulhuHomeSecondaryTitleMeasure"
      >
        {#each secondaryTitleWords as word (word)}
          <span>{word}</span>
        {/each}
      </span>

      <div
        class="cthulhuHomeCardGrid mt-7 grid w-full grid-cols-1 items-start gap-4"
      >
        {#if !currentWorkspaceDetails}
          <Card label="Get Started" class={homeCardClass} data-testid="home-primary-card">
            <div class="flex flex-col">
              <DisplayRow
                icon={FolderPlus}
                label="Choose a Workspace"
                detail="Create a new workspace folder, or open an existing one to continue."
              />

              <Separator />

              <DisplayRow
                icon={FileText}
                label="Markdown Prompt Files"
                detail="Stores and manages prompts as Markdown files in a workspace folder."
              />

              <Separator />

              <DisplayRow
                icon={Bug}
                label="Report an Issue"
                detail="Report bugs or request improvements!"
              >
                {#snippet trailing()}
                  <LinkButton
                    href={githubIssuesUrl}
                    text="Open Github"
                    endIcon={ExternalLink}
                    variant="accent"
                    testId="get-started-github-issues-link"
                    target="_blank"
                    rel="noreferrer"
                  />
                {/snippet}
              </DisplayRow>
            </div>
          </Card>
        {:else}
          <Card label="Current Workspace" class={homeCardClass} data-testid="home-primary-card">
            <div class="flex flex-col">
              <DisplayRow
                icon={FolderOpen}
                label={currentWorkspaceDetails.name}
                detail="Workspace Name"
                labelTitle={currentWorkspaceDetails.name}
              >
                {#snippet trailing()}
                  <IconButton
                    icon={ExternalLink}
                    label="Open Workspace Folder"
                    title="Open Workspace Folder"
                    testId="home-open-workspace-folder-button"
                    onclick={openWorkspaceFolder}
                  />
                {/snippet}
              </DisplayRow>

              <Separator />

              <DisplayRow
                icon={FolderSymlink}
                label={currentWorkspaceDetails.path}
                detail="Workspace Path"
                labelTitle={currentWorkspaceDetails.path}
                labelTestId="workspace-ready-path"
              >
                {#snippet trailing()}
                  <CopyButton
                    text={currentWorkspaceDetails.path}
                    label="Copy workspace path"
                    title="Copy workspace path"
                    testId="copy-workspace-path-button"
                  />
                {/snippet}
              </DisplayRow>

              <Separator />

              <div class="cthulhuHomeWorkspaceStats">
                <DisplayRow icon={FileText} label={displayedPromptCount} detail="Prompts" />
                <Separator orientation="vertical" class="h-auto self-stretch" />
                <DisplayRow
                  icon={Folders}
                  label={displayedPromptFolderCount}
                  detail="Prompt Folders"
                />
              </div>
            </div>
          </Card>
        {/if}

        <Card
          label="Workspace Actions"
          class={homeCardClass}
          data-testid="home-workspace-actions-card"
        >
          <div class="flex flex-col">
            <DisplayRow
              icon={FolderOpen}
              iconClass="translate-y-px"
              label="Open Workspace"
              detail="Open an existing workspace."
            >
              {#snippet trailing()}
                <Button
                  testId="open-workspace-button"
                  class="cthulhuHomeWorkspaceActionButton"
                  icon={FolderOpen}
                  text="Open"
                  variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                  appearance={currentWorkspaceDetails ? 'outline' : 'filled'}
                  onclick={handleSelectFolder}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                />
              {/snippet}
            </DisplayRow>

            <Separator />

            <DisplayRow
              icon={FolderPlus}
              iconClass="translate-y-px"
              label="Create Workspace"
              detail="Choose a folder to set up a new workspace."
            >
              {#snippet trailing()}
                <Button
                  testId="create-workspace-button"
                  class="cthulhuHomeWorkspaceActionButton"
                  icon={FolderPlus}
                  text="Create"
                  variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                  appearance={currentWorkspaceDetails ? 'outline' : 'filled'}
                  onclick={handleCreateFolder}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                />
              {/snippet}
            </DisplayRow>

            {#if isWorkspaceReady}
              <Separator />

              <DisplayRow
                icon={X}
                iconClass="translate-y-px"
                label="Close Workspace"
                detail="Unload the current workspace folder."
              >
                {#snippet trailing()}
                  <Button
                    testId="close-workspace-button"
                    class="cthulhuHomeWorkspaceActionButton"
                    icon={X}
                    text="Close"
                    variant={currentWorkspaceDetails ? 'neutral' : 'accent'}
                    appearance={currentWorkspaceDetails ? 'outline' : 'filled'}
                    onclick={onWorkspaceClear}
                    state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                  />
                {/snippet}
              </DisplayRow>
            {/if}
          </div>
        </Card>
      </div>
    </section>
  </div>

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

<style>
  .cthulhuHomeLayout {
    container-name: cthulhu-home-layout;
    container-type: inline-size;
  }

  .cthulhuHomeTitleContainer,
  .cthulhuHomeCardGrid {
    max-width: 31.5rem;
  }

  .cthulhuHomeCardGrid {
    margin-inline: auto;
  }

  .cthulhuHomeSecondaryTitle {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    flex-direction: column;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: clamp(64px, 9vw, 88px);
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  @container cthulhu-home-layout (min-width: 64rem) {
    .cthulhuHomeTitleContainer,
    .cthulhuHomeCardGrid {
      max-width: none;
    }

    .cthulhuHomeCardGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .cthulhuHomeSecondaryTitle {
      column-gap: 1.14em;
      flex-direction: row;
      justify-content: center;
    }
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

  .cthulhuHomeWorkspaceStats :global(.cthulhuUiRow) {
    flex: 1 1 0;
  }

  :global(.cthulhuHomeWorkspaceActionButton) {
    justify-content: center;
    width: 108px;
  }
</style>
