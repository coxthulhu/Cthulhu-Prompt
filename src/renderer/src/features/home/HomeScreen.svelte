<script lang="ts">
  import {
    Bug,
    ExternalLink,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    FolderSymlink,
    Folders,
    SlidersHorizontal,
    X
  } from 'lucide-svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import CthulhuErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import IconDescriptionButton from '@renderer/common/cthulhu-ui/IconDescriptionButton.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import LabeledDisplayField from '@renderer/common/cthulhu-ui/LabeledDisplayField.svelte'
  import NumericStatCard from '@renderer/common/cthulhu-ui/NumericStatCard.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
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
  const workspaceNotFoundErrorText =
    'Workspace Not Found.\nUse Create Workspace to set up a new workspace in this location.'

  let isOpeningWorkspaceDialog = $state(false)
  let showCreateWorkspaceDialog = $state(false)
  let showWorkspaceNotFoundDialog = $state(false)
  let activeWorkspaceAction = $state<'select' | 'create' | null>(null)
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

  const handleSelectFolder = async () => {
    activeWorkspaceAction = 'select'
    try {
      const result = await runIpcBestEffort(openWorkspaceInfoFileDialog, () => ({
        dialogCancelled: true,
        filePaths: []
      }))

      if (!result.dialogCancelled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        const selectionResult = await onWorkspaceSelect(selectedPath)

        if (!selectionResult.success) {
          if (selectionResult.reason === 'workspace-missing') {
            // Open Workspace only selects existing workspace info files.
            showWorkspaceNotFoundDialog = true
          }
        }
      }
    } finally {
      if (activeWorkspaceAction === 'select') {
        activeWorkspaceAction = null
      }
    }
  }

  const handleCreateFolder = async () => {
    showCreateWorkspaceDialog = true
  }

  const getSelectButtonLabel = () => {
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'select' ? 'Setting up...' : 'Loading...'
    }
    if (isOpeningWorkspaceDialog && activeWorkspaceAction === 'select') {
      return 'Selecting...'
    }
    return 'Open Workspace'
  }

  const getCreateButtonLabel = () => {
    if (isWorkspaceLoading) {
      return activeWorkspaceAction === 'create' ? 'Creating...' : 'Loading...'
    }
    if (isOpeningWorkspaceDialog && activeWorkspaceAction === 'create') {
      return 'Choosing...'
    }
    return 'Create Workspace'
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
  const workspaceActionsDescription = $derived(
    currentWorkspaceDetails ? 'Change your current workspace.' : 'Create or open a workspace.'
  )
  const workspaceActionsCardClass = 'w-full max-w-[632px] min-w-0 xl:max-w-none'
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
          class="mx-auto w-full max-w-[632px] space-y-4 xl:max-w-none"
        >
          <h2
            class="cthulhuHomeSecondaryTitle"
            data-testid="home-title"
            style:font-size={secondaryTitleFontSizePx
              ? `${secondaryTitleFontSizePx}px`
              : undefined}
          >
            {secondaryTitleText}
          </h2>
          <Separator
            class="bg-[var(--ui-neutral-muted-border)]"
            data-testid="home-title-separator"
          />
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
        class="mt-5 grid grid-cols-1 items-start justify-items-center gap-4 xl:grid-cols-2 xl:justify-items-stretch"
      >
        {#if !currentWorkspaceDetails}
          <CardSurface class="w-full max-w-[632px] min-w-0 xl:max-w-none">
            <div class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <TitleBlock
                    title="Get Started"
                    size="large"
                    description="Choose where your prompt files live."
                    icon={FolderPlus}
                  />
                </div>
              </div>

              <div class="cthulhuHomeGetStartedText">
                <p>
                  Cthulhu Prompt is a prompt editor and manager that stores your prompts as a
                  series of Markdown files in a workspace folder.
                </p>
                <p>
                  To get started, you can create a new workspace folder, or open an existing workspace to continue where you left off.
                </p>
              </div>

              <div class="cthulhuHomeBugLink">
                <IconTextButton
                  class="self-start"
                  href={githubIssuesUrl}
                  icon={Bug}
                  endIcon={ExternalLink}
                  text="Found a bug? Add it on GitHub!"
                  variant="accent"
                  testId="get-started-github-bug-link"
                  target="_blank"
                  rel="noreferrer"
                />
              </div>
            </div>
          </CardSurface>
        {:else}
          <CardSurface class="w-full max-w-[632px] min-w-0 xl:max-w-none">
            <div class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <TitleBlock
                    title="Current Workspace"
                    size="large"
                    description="Information about your current workspace."
                    icon={Folder}
                  />
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <LabeledDisplayField
                  label="Workspace Name"
                  text={currentWorkspaceDetails.name}
                  icon={FolderOpen}
                  valueTitle={currentWorkspaceDetails.name}
                />

                <LabeledDisplayField
                  label="Workspace Path"
                  text={currentWorkspaceDetails.path}
                  icon={FolderSymlink}
                  valueTitle={currentWorkspaceDetails.path}
                  valueTestId="workspace-ready-path"
                />

                <div class="grid grid-cols-2 gap-3">
                  <NumericStatCard label="Prompts" text={displayedPromptCount} icon={FileText} />
                  <NumericStatCard
                    label="Prompt Folders"
                    text={displayedPromptFolderCount}
                    icon={Folders}
                  />
                </div>
              </div>
            </div>
          </CardSurface>
        {/if}

        <CardSurface class={workspaceActionsCardClass}>
          <div class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <TitleBlock
                  title="Workspace Actions"
                  size="large"
                  description={workspaceActionsDescription}
                  icon={SlidersHorizontal}
                />
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <IconDescriptionButton
                testId="open-workspace-button"
                icon={FolderOpen}
                iconClass="translate-y-px"
                text={getSelectButtonLabel()}
                description="Open an existing workspace folder."
                variant="neutral"
                onclick={handleSelectFolder}
                state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
              />

              <IconDescriptionButton
                testId="create-workspace-button"
                icon={FolderPlus}
                iconClass="translate-y-px"
                text={getCreateButtonLabel()}
                description="Choose a folder to set up a new workspace."
                variant="accent"
                onclick={handleCreateFolder}
                state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
              />

              {#if isWorkspaceReady}
                <IconDescriptionButton
                  testId="close-workspace-button"
                  icon={X}
                  iconClass="translate-y-px"
                  text="Close Workspace"
                  description="Unload the current workspace folder."
                  variant="danger"
                  onclick={onWorkspaceClear}
                  state={isWorkspaceActionDisabled ? 'disabled' : 'enabled'}
                />
              {/if}
            </div>
          </div>
        </CardSurface>
      </div>
    </section>
  </div>

  <CreateWorkspaceDialog
    bind:open={showCreateWorkspaceDialog}
    {isWorkspaceLoading}
    {onWorkspaceCreate}
  />

  <CthulhuErrorDialog
    bind:open={showWorkspaceNotFoundDialog}
    title="Workspace Not Found"
    description="The selected file is not a Cthulhu Prompt workspace."
    errorText={workspaceNotFoundErrorText}
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

  .cthulhuHomeGetStartedText {
    border-left: 3px solid var(--ui-accent-normal-border);
    color: var(--ui-secondary-text);
    display: flex;
    flex-direction: column;
    font-size: 15px;
    gap: 12px;
    line-height: 1.55;
    padding-left: 16px;
  }

  .cthulhuHomeGetStartedText p {
    margin: 0;
  }

  .cthulhuHomeBugLink {
    border-left: 3px solid var(--ui-accent-normal-border);
    display: flex;
    padding-left: 16px;
  }
</style>
