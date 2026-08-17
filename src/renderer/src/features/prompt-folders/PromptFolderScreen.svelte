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
  import CreateCategoryDialog from './CreateCategoryDialog.svelte'
  import {
    createCategory,
    deleteCategory,
    moveCategory,
    renameCategory
  } from '@renderer/data/Mutations/CategoryMutations'
  import { setCategoryDescriptionWithAutosave } from '@renderer/data/Mutations/CategoryMutations'
  import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
  import {
    clearPromptFolderSettingsFieldRowMeasuredHeight,
    recordPromptFolderSettingsRowMeasuredHeight
  } from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'

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
    controller.persistActivePromptTreeRow()
  })

  let renamePromptFolderDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  let renamePromptFolderId = $state<string | null>(null)
  /** Imperative handle for opening category creation from the root header. */
  let createCategoryDialog = $state<{ openDialog: () => void } | null>(null)
  /** Imperative handle for opening category rename. */
  let renameCategoryDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  /** Category currently selected for rename. */
  let renameCategoryId = $state<string | null>(null)
  /** Category currently awaiting deletion confirmation. */
  let deleteCategoryId = $state<string | null>(null)
  let deletePromptFolderId = $state<string | null>(null)

  const renamePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === renamePromptFolderId) ?? null
  )
  const renameFolderTitle = $derived(
    renamePromptFolderTarget?.kind === 'template'
      ? 'Prompt Template Folder'
      : 'Prompt Folder'
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

  /** Opens category creation for the screen's root folder. */
  const openCreateCategoryDialog = (): void => {
    createCategoryDialog?.openDialog()
  }

  /** Persists one validated root-owned category. */
  const handleCreateCategory = async (displayName: string): Promise<boolean> => {
    if (!controller.screenRootFolder) return false
    return await runIpcBestEffort(
      async () => {
        await createCategory(controller.screenRootFolderId, displayName)
        return true
      },
      () => false
    )
  }

  /** Category currently selected for rename. */
  const renameCategoryTarget = $derived(
    controller.categories.find((category) => category.id === renameCategoryId) ?? null
  )

  /** Opens category rename with its current display name. */
  const openRenameCategoryDialog = (categoryId: string): void => {
    const category = controller.categories.find((candidate) => candidate.id === categoryId)
    if (!category) return
    renameCategoryId = categoryId
    renameCategoryDialog?.openDialog(category.displayName)
  }

  /** Persists a validated category display name. */
  const handleRenameCategory = async (displayName: string): Promise<boolean> => {
    if (!renameCategoryTarget) return false
    return await runIpcBestEffort(
      async () => {
        await renameCategory(renameCategoryTarget.id, displayName)
        return true
      },
      () => false
    )
  }

  /** Deletes the selected category and moves its content to Uncategorized. */
  const performCategoryDelete = async (): Promise<void> => {
    if (!deleteCategoryId) return
    /** Stable category ID retained while the dialog closes. */
    const categoryId = deleteCategoryId
    deleteCategoryId = null
    await runIpcBestEffort(() => deleteCategory(categoryId))
  }

  /** Persists one category-group reorder from the folder screen. */
  const handleMoveCategory = (categoryId: string, previousCategoryId: string | null): void => {
    void runIpcBestEffort(() =>
      moveCategory(controller.screenRootFolderId, categoryId, previousCategoryId)
    )
  }

  /** Updates and measures the sole category setting before its paced autosave. */
  const handleCategoryDescriptionChange = (
    categoryId: string,
    text: string,
    measurement: TextMeasurement
  ): void => {
    const category = controller.categories.find((candidate) => candidate.id === categoryId)
    if (!category) return
    const textChanged = category.description !== text
    recordPromptFolderSettingsRowMeasuredHeight(
      categoryId,
      'folderDescription',
      measurement,
      textChanged
    )
    if (textChanged) setCategoryDescriptionWithAutosave(categoryId, text, AUTOSAVE_MS)
  }

  /** Adds or removes a category description through the same expandable settings UI. */
  const handleCategoryDescriptionPresenceChange = (
    categoryId: string,
    isPresent: boolean
  ): void => {
    const category = controller.categories.find((candidate) => candidate.id === categoryId)
    const description = isPresent ? '' : null
    if (!category || category.description === description) return
    clearPromptFolderSettingsFieldRowMeasuredHeight(categoryId, 'folderDescription')
    setCategoryDescriptionWithAutosave(categoryId, description, AUTOSAVE_MS)
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

  const deletePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === deletePromptFolderId) ?? null
  )
  const deleteFolderTitle = $derived(
    deletePromptFolderTarget?.kind === 'template' ? 'Prompt Template Folder' : 'Prompt Folder'
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
            class="prompt-folder-header-breadcrumb flex min-w-0 items-center text-sm font-medium"
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
              onclick={controller.handleHeaderSegmentClick}
            >
              {controller.activeHeaderSection}
            </button>
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
            folderSettingsByFolderId={controller.folderSettingsByFolderId}
            promptEditorSizingConfig={controller.promptEditorSizingConfig}
            promptDraftById={controller.promptDraftById}
            promptTemplateTextById={controller.promptTemplateTextById}
            promptMetadataByPromptId={controller.promptMetadataByPromptId}
            promptFolders={controller.promptFolders}
            categories={controller.categories}
            activeScreenRows={controller.activePromptFolderScreenRows}
            visiblePromptIds={controller.visiblePromptIds}
            activePromptCount={controller.activePromptCount}
            completedPromptCount={controller.completedPromptCount}
            completedPromptOwnerByPromptId={controller.completedPromptOwnerByPromptId}
            {screenMode}
            isCreatingPrompt={controller.isCreatingPrompt}
            settingsSectionExpandedByFolderId={controller.settingsSectionExpandedByFolderId}
            promptsSectionExpandedByFolderId={controller.promptsSectionExpandedByFolderId}
            initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onAddCategory={openCreateCategoryDialog}
            onDeletePrompt={controller.handleDeletePrompt}
            onDeletePromptFolder={handleDeletePromptFolder}
            onSetPromptStatus={controller.handleSetPromptStatus}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            canMovePrompt={controller.canMovePrompt}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onMoveCategory={handleMoveCategory}
            onCategoryDescriptionChange={handleCategoryDescriptionChange}
            onCategoryDescriptionPresenceChange={handleCategoryDescriptionPresenceChange}
            onScrollToWithinWindowBandChange={controller.setScrollToWithinWindowBand}
            onScrollToAndTrackRowCenteredChange={controller.setScrollToAndTrackRowCentered}
            onScrollApiChange={controller.setScrollApi}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onSettingsSectionToggle={controller.toggleSettingsSectionExpanded}
            onPromptsSectionToggle={controller.togglePromptsSectionExpanded}
            onRenamePromptFolder={openRenamePromptFolderDialog}
            onRenameCategory={openRenameCategoryDialog}
            onDeleteCategory={(categoryId) => {
              deleteCategoryId = categoryId
            }}
            {onScreenModeChange}
          />
        {/if}
      </div>

      {#if controller.loadingOverlay.isVisible()}
        <LoadingOverlay
          testId="prompt-folder-loading-overlay"
          fadeMs={controller.loadingOverlayFadeMs}
          isFading={controller.loadingOverlay.isFading()}
          message={controller.contentKind === 'template'
            ? 'Loading prompt template folder...'
            : 'Loading prompt folder...'}
        />
      {/if}
    </main>
  {/snippet}
</PromptFolderFindIntegration>

<CreateCategoryDialog
  bind:this={createCategoryDialog}
  categories={controller.categories}
  isWorkspaceReady={controller.workspaceId !== null && controller.screenRootFolder !== null}
  onsubmit={handleCreateCategory}
/>

<CreateCategoryDialog
  bind:this={renameCategoryDialog}
  categories={controller.categories}
  excludedCategoryId={renameCategoryId}
  isWorkspaceReady={controller.workspaceId !== null && renameCategoryTarget !== null}
  dialogTitle="Rename Category"
  dialogSubtitle="Choose a new name for this category."
  submitLabel="Rename Category"
  submittingLabel="Renaming..."
  failureMessage="Failed to rename category. Please try again."
  testIdPrefix="rename"
  onsubmit={handleRenameCategory}
/>

<PromptFolderNameDialog
  bind:this={renamePromptFolderDialog}
  isWorkspaceReady={controller.screenRootFolder !== null}
  promptFolders={renamePromptFolderSiblings}
  isPromptFolderListLoading={false}
  icon={Pencil}
  title={`Rename ${renameFolderTitle}`}
  subtitle={`Choose a new name for this ${renameFolderTitle.toLowerCase()}.`}
  submitText={renamePromptFolderTarget?.kind === 'template'
    ? 'Rename Template Folder'
    : 'Rename Prompt Folder'}
  submittingText="Renaming..."
  submitTestId="rename-prompt-folder-button"
  inputTestId="rename-prompt-folder-name-input"
  errorTestId="rename-prompt-folder-name-error"
  rowLabel={`${renameFolderTitle} Name`}
  rowDetail={`Rename this ${renameFolderTitle.toLowerCase()}.`}
  initialDisplayName={renamePromptFolderTarget?.displayName ?? ''}
  unchangedDisplayName={renamePromptFolderTarget?.displayName ?? null}
  unchangedFolderName={renamePromptFolderTarget?.folderName ?? null}
  duplicatePromptFolderId={renamePromptFolderTarget?.id ?? null}
  failureMessage={`Failed to rename ${renameFolderTitle.toLowerCase()}. Please try again.`}
  onsubmit={handleRenamePromptFolder}
/>

<ConfirmationDialog
  open={deletePromptFolderTarget !== null}
  title={`Delete ${deleteFolderTitle}`}
  description={`Are you sure you want to permanently delete “${deletePromptFolderTarget?.displayName ?? ''}” and all of its contents?`}
  confirmText={deletePromptFolderTarget?.kind === 'template'
    ? 'Delete Template Folder'
    : 'Delete Prompt Folder'}
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

<ConfirmationDialog
  open={deleteCategoryId !== null}
  title="Delete Category"
  description={`Are you sure you want to delete “${controller.categories.find((category) => category.id === deleteCategoryId)?.displayName ?? ''}”? Its contents will move to Uncategorized.`}
  confirmText="Delete Category"
  confirmTestId="category-confirm-delete-button"
  oncancel={() => {
    deleteCategoryId = null
  }}
  onconfirm={performCategoryDelete}
/>

<style>
  .prompt-folder-header-bar {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .prompt-folder-header-breadcrumb,
  .prompt-folder-header-folder {
    color: var(--ui-muted-text);
  }

  .prompt-folder-header-folder:hover {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-separator {
    color: var(--ui-neutral-emphasis-border);
  }

  .prompt-folder-header-section {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-section:hover {
    color: var(--ui-normal-text);
  }
</style>
