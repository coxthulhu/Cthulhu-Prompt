<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Pencil, Search } from 'lucide-svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { isPromptFolderEmpty } from '@renderer/data/Collections/PromptFolderEntries'
  import { renamePromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { deletePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { createPromptFolderScreenController } from './promptFolderScreenController.svelte.ts'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'
  import ManageCategoriesDialog, {
    type ManagedCategoryInput,
    type ManageCategoriesDialogOpenOptions
  } from './ManageCategoriesDialog.svelte'
  import {
    moveCategory,
    saveCategories
  } from '@renderer/data/Mutations/CategoryMutations'

  let {
    screenRootFolderId,
    screenMode = PromptFolderScreenMode.Active,
    onScreenModeChange,
    onScreenRootFolderSelect,
    onRootPromptFolderDeleted
  } = $props<{
    screenRootFolderId: string
    screenMode?: PromptFolderScreenMode
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
    onScreenRootFolderSelect: (screenRootFolderId: string) => void
    onRootPromptFolderDeleted: () => void
  }>()

  const controller = createPromptFolderScreenController({
    getScreenRootFolderId: () => screenRootFolderId,
    getScreenMode: () => screenMode,
    onScreenRootFolderSelect: (nextScreenRootFolderId) =>
      onScreenRootFolderSelect(nextScreenRootFolderId)
  })

  let didDeleteScreenRootFolder = $state(false)

  // Side effect: persist the last selected row for this folder when the screen unmounts.
  onDestroy(() => {
    if (didDeleteScreenRootFolder) return
    controller.persistActivePromptScreenRow()
  })

  let renamePromptFolderDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  let renamePromptFolderId = $state<string | null>(null)
  /** Imperative handle for opening root-folder category management. */
  let manageCategoriesDialog = $state<{
    openDialog: (options?: ManageCategoriesDialogOpenOptions) => void
  } | null>(null)
  let deletePromptFolderId = $state<string | null>(null)

  const renamePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === renamePromptFolderId) ?? null
  )
  // Root folder names conflict with same-kind root siblings.
  const renamePromptFolderSiblings = $derived.by(() => {
    if (!renamePromptFolderTarget) return []
    return controller.promptFolders.filter(
      (folder) =>
        (folder.kind === 'template') === (renamePromptFolderTarget.kind === 'template')
    )
  })

  const openRenamePromptFolderDialog = (promptFolderId: string) => {
    const promptFolder = controller.promptFolders.find((folder) => folder.id === promptFolderId)
    if (!promptFolder) return

    renamePromptFolderId = promptFolderId
    renamePromptFolderDialog?.openDialog(promptFolder.displayName)
  }

  const handleRenamePromptFolder = async (displayName: string): Promise<boolean> => {
    if (!renamePromptFolderTarget) return false

    return await runIpcBestEffort(
      async () => {
        await renamePromptFolder(renamePromptFolderTarget.id, displayName)
        return true
      },
      () => false
    )
  }

  /** Opens category management to the first retained category, if present. */
  const openManageCategoriesDialog = (): void => {
    manageCategoriesDialog?.openDialog()
  }

  /** Opens category management to one row and optionally selects its complete name. */
  const openManageCategoryDialog = (
    categoryId: string,
    focusName: boolean
  ): void => {
    manageCategoriesDialog?.openDialog({ categoryId, focusName })
  }

  /** Persists every retained category draft through one atomic mutation. */
  const handleSaveCategories = async (
    categories: ManagedCategoryInput[]
  ): Promise<boolean> => {
    if (!controller.workspaceId || !controller.screenRootFolder) return false
    /** Validated workspace identity retained across the asynchronous save callback. */
    const workspaceId = controller.workspaceId
    /** Validated root identity retained across the asynchronous save callback. */
    const promptFolderId = controller.screenRootFolder.id
    return await runIpcBestEffort(
      async () => {
        await saveCategories(
          workspaceId,
          promptFolderId,
          categories
        )
        return true
      },
      () => false
    )
  }

  /** Persists one category-group reorder from the folder screen. */
  const handleMoveCategory = (categoryId: string, previousCategoryId: string | null): void => {
    void runIpcBestEffort(() =>
      moveCategory(controller.screenRootFolderId, categoryId, previousCategoryId, screenMode)
    )
  }

  const isEmptyPromptFolder = (promptFolderId: string): boolean => {
    const promptFolder = controller.promptFolders.find((folder) => folder.id === promptFolderId)
    if (!promptFolder) return false
    return isPromptFolderEmpty(promptFolder)
  }

  const performPromptFolderDelete = async (promptFolderId: string): Promise<void> => {
    const workspaceId = controller.workspaceId
    if (!workspaceId) return

    const isRootPromptFolder = promptFolderId === controller.screenRootFolderId
    deletePromptFolderId = null
    const didDelete = await runIpcBestEffort(
      async () => {
        await deletePromptFolder(workspaceId, promptFolderId)
        return true
      },
      () => false
    )

    if (didDelete && isRootPromptFolder) {
      didDeleteScreenRootFolder = true
      onRootPromptFolderDeleted()
    }
  }

  const handleDeletePromptFolder = (promptFolderId: string): void => {
    if (isEmptyPromptFolder(promptFolderId)) {
      void performPromptFolderDelete(promptFolderId)
      return
    }

    deletePromptFolderId = promptFolderId
  }

  /** Opens deletion through the root header's existing handler for a matching mounted folder. */
  export const openDeletePromptFolderDialog = (promptFolderId: string): void => {
    if (promptFolderId !== screenRootFolderId) return
    handleDeletePromptFolder(promptFolderId)
  }

  const deletePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === deletePromptFolderId) ?? null
  )
</script>

<PromptFolderFindIntegration
  items={controller.findItems}
  scrollToWithinWindowBand={controller.scrollToWithinWindowBandWithManualClear}
  onRevealMatch={controller.handleFindMatchReveal}
>
  {#snippet children(findControls)}
    <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
      <div
        class="prompt-folder-header-bar flex h-9 shrink-0 items-center justify-between gap-3 px-6"
      >
        {#if controller.isVirtualContentReady}
          <div
            class="prompt-folder-header-breadcrumb flex min-w-0 items-center text-sm font-semibold"
          >
            <button
              type="button"
              data-testid="prompt-folder-header-folder"
              class="prompt-folder-header-folder min-w-0 cursor-pointer truncate transition-colors duration-[var(--ui-animation-duration-standard)]"
              onclick={controller.handleHeaderFolderClick}
            >
              {controller.folderDisplayName}
            </button>
            <span class="prompt-folder-header-separator mx-1 px-2">/</span>
            <button
              type="button"
              data-testid="prompt-folder-header-section"
              class="prompt-folder-header-section cursor-pointer whitespace-nowrap transition-colors duration-[var(--ui-animation-duration-standard)]"
              onclick={controller.handleHeaderFolderClick}
            >
              {controller.headerGroupLabel}
            </button>
            {#if controller.headerCategoryLabel !== null}
              <span class="prompt-folder-header-separator mx-1 px-2">/</span>
              <button
                type="button"
                data-testid="prompt-folder-header-category"
                class="prompt-folder-header-section cursor-pointer whitespace-nowrap transition-colors duration-[var(--ui-animation-duration-standard)]"
                onclick={controller.handleHeaderCategoryClick}
              >
                {controller.headerCategoryLabel}
              </button>
            {/if}
          </div>

          <IconButton
            icon={Search}
            label="Find in Folder (Control + F)"
            title="Find in Folder (Control + F)"
            size="compact"
            borderless
            testId="prompt-folder-find-button"
            onclick={findControls.toggleFindDialog}
          />
        {/if}
      </div>

      <div class="flex-1 min-h-0">
        {#if controller.errorMessage}
          <div class="h-full min-h-0 overflow-y-auto pt-6 pl-6">
            <h2 class="text-lg font-semibold mb-4">
              {controller.contentKind === 'template' ? 'Templates' : 'Prompts'} ({controller.visiblePromptIds.length})
            </h2>
            <p class="mt-6 text-red-500">
              Error loading {controller.contentKind === 'template' ? 'templates' : 'prompts'}:
              {controller.errorMessage}
            </p>
          </div>
        {:else if controller.isVirtualContentReady}
          <PromptFolderVirtualContent
            workspaceId={controller.workspaceId}
            contentKind={controller.contentKind}
            screenRootFolderId={controller.screenRootFolderId}
            promptEditorSizingConfig={controller.promptEditorSizingConfig}
            promptDraftById={controller.promptDraftById}
            promptTemplateTextById={controller.promptTemplateTextById}
            promptMetadataByPromptId={controller.promptMetadataByPromptId}
            promptFolders={controller.promptFolders}
            categories={controller.categories}
            orderedScreenRows={controller.orderedPromptFolderScreenRows}
            visiblePromptIds={controller.visiblePromptIds}
            orderedPromptCount={controller.orderedPromptCount}
            statusGroupCounts={controller.statusGroupCounts}
            finalizedPromptContentOwnerByPromptId={controller.finalizedPromptContentOwnerByPromptId}
            {screenMode}
            isCreatingPrompt={controller.isCreatingPrompt}
            contentSectionExpandedByOwnerId={controller.contentSectionExpandedByOwnerId}
            initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onManageCategories={openManageCategoriesDialog}
            onDeletePrompt={controller.handleDeletePrompt}
            onDeletePromptFolder={handleDeletePromptFolder}
            onSetPromptStatus={controller.handleSetPromptStatus}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            canMovePrompt={controller.canMovePrompt}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onMoveCategory={handleMoveCategory}
            onScrollToWithinWindowBandChange={controller.setScrollToWithinWindowBand}
            onScrollToAndTrackRowChange={controller.setScrollToAndTrackRow}
            onScrollApiChange={controller.setScrollApi}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            breadcrumbSampleOffsetPx={controller.breadcrumbSampleOffsetPx}
            onBreadcrumbCategoryChange={controller.handleBreadcrumbCategoryChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onContentSectionToggle={controller.toggleContentSectionExpanded}
            onRenamePromptFolder={openRenamePromptFolderDialog}
            onManageCategory={openManageCategoryDialog}
            {onScreenModeChange}
          />
        {/if}
      </div>

      {#if controller.loadingOverlay.isVisible()}
        <LoadingOverlay
          testId="prompt-folder-loading-overlay"
          fadeMs={controller.loadingOverlayFadeMs}
          isFading={controller.loadingOverlay.isFading()}
          message="Loading folder..."
        />
      {/if}
    </main>
  {/snippet}
</PromptFolderFindIntegration>

<ManageCategoriesDialog
  bind:this={manageCategoriesDialog}
  categories={controller.managedCategories}
  folderDisplayName={controller.folderDisplayName}
  contentKind={controller.contentKind}
  isWorkspaceReady={controller.workspaceId !== null && controller.screenRootFolder !== null}
  onsubmit={handleSaveCategories}
/>

<PromptFolderNameDialog
  bind:this={renamePromptFolderDialog}
  isWorkspaceReady={controller.screenRootFolder !== null}
  promptFolders={renamePromptFolderSiblings}
  isPromptFolderListLoading={false}
  icon={Pencil}
  title="Rename Folder"
  subtitle="Choose a new name for this folder."
  submitText="Rename Folder"
  submittingText="Renaming..."
  submitTestId="rename-prompt-folder-button"
  inputTestId="rename-prompt-folder-name-input"
  errorTestId="rename-prompt-folder-name-error"
  rowLabel="Folder Name"
  rowDetail="Rename this folder."
  initialDisplayName={renamePromptFolderTarget?.displayName ?? ''}
  unchangedDisplayName={renamePromptFolderTarget?.displayName ?? null}
  unchangedFolderName={renamePromptFolderTarget?.folderName ?? null}
  duplicatePromptFolderId={renamePromptFolderTarget?.id ?? null}
  failureMessage="Failed to rename folder. Please try again."
  onsubmit={handleRenamePromptFolder}
/>

<ConfirmationDialog
  open={deletePromptFolderTarget !== null}
  title="Delete Folder"
  description={`Are you sure you want to permanently delete “${deletePromptFolderTarget?.displayName ?? ''}” and all of its contents?`}
  confirmText="Delete Folder"
  confirmTestId="prompt-folder-confirm-delete-button"
  oncancel={() => {
    deletePromptFolderId = null
  }}
  onconfirm={() => {
    if (deletePromptFolderTarget) {
      void performPromptFolderDelete(deletePromptFolderTarget.id)
    }
  }}
/>

<style>
  .prompt-folder-header-bar {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .prompt-folder-header-breadcrumb,
  .prompt-folder-header-folder,
  .prompt-folder-header-section {
    color: var(--ui-muted-text);
  }

  .prompt-folder-header-folder:hover,
  .prompt-folder-header-section:hover {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-separator {
    color: var(--ui-neutral-emphasis-border);
  }

  .prompt-folder-header-section:last-child {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-section:last-child:hover {
    color: var(--ui-normal-text);
  }
</style>
