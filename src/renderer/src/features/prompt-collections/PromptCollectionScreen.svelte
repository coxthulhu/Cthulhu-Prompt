<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Pencil, Search } from 'lucide-svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { isPromptCollectionEmpty } from '@renderer/data/Collections/PromptCollectionEntries'
  import { renamePromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
  import { deletePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'
  import PromptCollectionVirtualContent from './PromptCollectionVirtualContent.svelte'
  import PromptCollectionFindIntegration from './find/PromptCollectionFindIntegration.svelte'
  import { createPromptCollectionScreenController } from './promptCollectionScreenController.svelte.ts'
  import { PromptCollectionScreenMode } from './promptCollectionScreenMode'
  import PromptCollectionNameDialog from './PromptCollectionNameDialog.svelte'
  import ManageCategoriesDialog, {
    type ManagedCategoryInput,
    type ManageCategoriesDialogOpenOptions
  } from './ManageCategoriesDialog.svelte'
  import {
    moveCategory,
    saveCategories
  } from '@renderer/data/Mutations/CategoryMutations'

  let {
    screenCollectionId,
    screenMode = PromptCollectionScreenMode.Active,
    onScreenModeChange,
    onPromptCollectionDeleted
  } = $props<{
    screenCollectionId: string
    screenMode?: PromptCollectionScreenMode
    onScreenModeChange: (screenMode: PromptCollectionScreenMode) => void
    onPromptCollectionDeleted: () => void
  }>()

  const controller = createPromptCollectionScreenController({
    getScreenCollectionId: () => screenCollectionId,
    getScreenMode: () => screenMode
  })

  let didDeleteScreenCollection = $state(false)

  /** Keeps the collection header at its current offset when selecting a different status tab. */
  const handleScreenModeChange = (nextMode: PromptCollectionScreenMode): void => {
    controller.preserveScrollForScreenMode(nextMode)
    onScreenModeChange(nextMode)
  }

  // Side effect: persist the last selected row for this collection when the screen unmounts.
  onDestroy(() => {
    if (didDeleteScreenCollection) return
    controller.persistActivePromptScreenRow()
  })

  let renamePromptCollectionDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  let renamePromptCollectionId = $state<string | null>(null)
  /** Imperative handle for opening collection category management. */
  let manageCategoriesDialog = $state<{
    openDialog: (options?: ManageCategoriesDialogOpenOptions) => void
  } | null>(null)
  let deletePromptCollectionId = $state<string | null>(null)

  const renamePromptCollectionTarget = $derived(
    controller.promptCollections.find((collection) => collection.id === renamePromptCollectionId) ?? null
  )
  // collection names conflict with same-kind collection siblings.
  const renamePromptCollectionSiblings = $derived.by(() => {
    if (!renamePromptCollectionTarget) return []
    return controller.promptCollections.filter(
      (collection) =>
        (collection.kind === 'template') === (renamePromptCollectionTarget.kind === 'template')
    )
  })

  const openRenamePromptCollectionDialog = (promptCollectionId: string) => {
    const promptCollection = controller.promptCollections.find((collection) => collection.id === promptCollectionId)
    if (!promptCollection) return

    renamePromptCollectionId = promptCollectionId
    renamePromptCollectionDialog?.openDialog(promptCollection.displayName)
  }

  const handleRenamePromptCollection = async (displayName: string): Promise<boolean> => {
    if (!renamePromptCollectionTarget) return false

    return await runIpcBestEffort(
      async () => {
        await renamePromptCollection(renamePromptCollectionTarget.id, displayName)
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
    if (!controller.workspaceId || !controller.screenCollection) return false
    /** Validated workspace identity retained across the asynchronous save callback. */
    const workspaceId = controller.workspaceId
    /** Validated collection identity retained across the asynchronous save callback. */
    const promptCollectionId = controller.screenCollection.id
    return await runIpcBestEffort(
      async () => {
        await saveCategories(
          workspaceId,
          promptCollectionId,
          categories
        )
        return true
      },
      () => false
    )
  }

  /** Persists one category-group reorder from the collection screen. */
  const handleMoveCategory = (categoryId: string, previousCategoryId: string | null): void => {
    void runIpcBestEffort(() =>
      moveCategory(controller.screenCollectionId, categoryId, previousCategoryId, screenMode)
    )
  }

  const isEmptyPromptCollection = (promptCollectionId: string): boolean => {
    const promptCollection = controller.promptCollections.find((collection) => collection.id === promptCollectionId)
    if (!promptCollection) return false
    return isPromptCollectionEmpty(promptCollection)
  }

  const performPromptCollectionDelete = async (promptCollectionId: string): Promise<void> => {
    const workspaceId = controller.workspaceId
    if (!workspaceId) return

    const isScreenPromptCollection = promptCollectionId === controller.screenCollectionId
    deletePromptCollectionId = null
    const didDelete = await runIpcBestEffort(
      async () => {
        await deletePromptCollection(workspaceId, promptCollectionId)
        return true
      },
      () => false
    )

    if (didDelete && isScreenPromptCollection) {
      didDeleteScreenCollection = true
      onPromptCollectionDeleted()
    }
  }

  const handleDeletePromptCollection = (promptCollectionId: string): void => {
    if (isEmptyPromptCollection(promptCollectionId)) {
      void performPromptCollectionDelete(promptCollectionId)
      return
    }

    deletePromptCollectionId = promptCollectionId
  }

  /** Opens deletion through the collection header's existing handler for a matching mounted collection. */
  export const openDeletePromptCollectionDialog = (promptCollectionId: string): void => {
    if (promptCollectionId !== screenCollectionId) return
    handleDeletePromptCollection(promptCollectionId)
  }

  const deletePromptCollectionTarget = $derived(
    controller.promptCollections.find((collection) => collection.id === deletePromptCollectionId) ?? null
  )
</script>

<PromptCollectionFindIntegration
  items={controller.findItems}
  scrollToWithinWindowBand={controller.scrollToWithinWindowBandWithManualClear}
  onRevealMatch={controller.handleFindMatchReveal}
>
  {#snippet children(findControls)}
    <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-collection-screen">
      <div
        class="prompt-collection-header-bar flex h-9 shrink-0 items-center justify-between gap-3 px-6"
      >
        {#if controller.isVirtualContentReady}
          <div
            class="prompt-collection-header-breadcrumb flex min-w-0 items-center text-sm font-semibold"
          >
            <button
              type="button"
              data-testid="prompt-collection-header-collection"
              class="prompt-collection-header-collection min-w-0 cursor-pointer truncate transition-colors duration-[var(--ui-animation-duration-standard)]"
              onclick={controller.handleHeaderCollectionClick}
            >
              {controller.collectionDisplayName}
            </button>
            <span class="prompt-collection-header-separator mx-1 px-2">/</span>
            <button
              type="button"
              data-testid="prompt-collection-header-section"
              class="prompt-collection-header-section cursor-pointer whitespace-nowrap transition-colors duration-[var(--ui-animation-duration-standard)]"
              onclick={controller.handleHeaderCollectionClick}
            >
              {controller.headerGroupLabel}
            </button>
            {#if controller.headerCategoryLabel !== null}
              <span class="prompt-collection-header-separator mx-1 px-2">/</span>
              <button
                type="button"
                data-testid="prompt-collection-header-category"
                class="prompt-collection-header-section cursor-pointer whitespace-nowrap transition-colors duration-[var(--ui-animation-duration-standard)]"
                onclick={controller.handleHeaderCategoryClick}
              >
                {controller.headerCategoryLabel}
              </button>
            {/if}
          </div>

          <IconButton
            icon={Search}
            label="Find in Collection (Control + F)"
            title="Find in Collection (Control + F)"
            size="compact"
            borderless
            testId="prompt-collection-find-button"
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
          <PromptCollectionVirtualContent
            workspaceId={controller.workspaceId}
            contentKind={controller.contentKind}
            screenCollectionId={controller.screenCollectionId}
            promptEditorSizingConfig={controller.promptEditorSizingConfig}
            promptDraftById={controller.promptDraftById}
            promptTemplateTextById={controller.promptTemplateTextById}
            promptMetadataByPromptId={controller.promptMetadataByPromptId}
            promptCollections={controller.promptCollections}
            categories={controller.categories}
            orderedScreenRows={controller.orderedPromptCollectionScreenRows}
            visiblePromptIds={controller.visiblePromptIds}
            orderedPromptCount={controller.orderedPromptCount}
            statusGroupCounts={controller.statusGroupCounts}
            finalizedPromptContentOwnerByPromptId={controller.finalizedPromptContentOwnerByPromptId}
            {screenMode}
            isCreatingPrompt={controller.isCreatingPrompt}
            contentSectionExpandedByOwnerId={controller.contentSectionExpandedByOwnerId}
            initialScrollTopPx={controller.initialPromptCollectionScrollTopPx}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onPromptInteraction={controller.handlePromptInteraction}
            onManageCategories={openManageCategoriesDialog}
            onDeletePrompt={controller.handleDeletePrompt}
            onDeletePromptCollection={handleDeletePromptCollection}
            onSetPromptStatus={controller.handleSetPromptStatus}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            canMovePrompt={controller.canMovePrompt}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onMoveCategory={handleMoveCategory}
            onScrollApiChange={controller.setScrollApi}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            breadcrumbSampleOffsetPx={controller.breadcrumbSampleOffsetPx}
            onBreadcrumbCategoryChange={controller.handleBreadcrumbCategoryChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onContentSectionToggle={controller.toggleContentSectionExpanded}
            onRenamePromptCollection={openRenamePromptCollectionDialog}
            onManageCategory={openManageCategoryDialog}
            onScreenModeChange={handleScreenModeChange}
          />
        {/if}
      </div>

      {#if controller.loadingOverlay.isVisible()}
        <LoadingOverlay
          testId="prompt-collection-loading-overlay"
          fadeMs={controller.loadingOverlayFadeMs}
          isFading={controller.loadingOverlay.isFading()}
          message="Loading collection..."
        />
      {/if}
    </main>
  {/snippet}
</PromptCollectionFindIntegration>

<ManageCategoriesDialog
  bind:this={manageCategoriesDialog}
  categories={controller.managedCategories}
  collectionDisplayName={controller.collectionDisplayName}
  contentKind={controller.contentKind}
  isWorkspaceReady={controller.workspaceId !== null && controller.screenCollection !== null}
  onsubmit={handleSaveCategories}
/>

<PromptCollectionNameDialog
  bind:this={renamePromptCollectionDialog}
  isWorkspaceReady={controller.screenCollection !== null}
  promptCollections={renamePromptCollectionSiblings}
  isPromptCollectionListLoading={false}
  icon={Pencil}
  title="Rename Collection"
  subtitle="Change the name shown in the app and on disk."
  submitText="Rename Collection"
  submittingText="Renaming..."
  submitTestId="rename-prompt-collection-button"
  inputTestId="rename-prompt-collection-name-input"
  errorTestId="rename-prompt-collection-name-error"
  rowLabel="Collection Name"
  rowDetail="Required. Names must be unique among collections of the same type."
  initialDisplayName={renamePromptCollectionTarget?.displayName ?? ''}
  unchangedDisplayName={renamePromptCollectionTarget?.displayName ?? null}
  duplicatePromptCollectionId={renamePromptCollectionTarget?.id ?? null}
  failureMessage="Failed to rename collection. Please try again."
  onsubmit={handleRenamePromptCollection}
/>

<ConfirmationDialog
  open={deletePromptCollectionTarget !== null}
  title="Delete Collection"
  description="This collection and everything inside it will be permanently deleted, including completed and archived prompts."
  confirmationText="Yes, I want to delete this collection and all of its contents."
  confirmText="Delete collection"
  confirmTestId="prompt-collection-confirm-delete-button"
  oncancel={() => {
    deletePromptCollectionId = null
  }}
  onconfirm={() => {
    if (deletePromptCollectionTarget) {
      void performPromptCollectionDelete(deletePromptCollectionTarget.id)
    }
  }}
/>

<style>
  .prompt-collection-header-bar {
    /* Keep the fixed breadcrumb controls alongside Find and below editor popups. */
    position: relative;
    z-index: var(--z-chrome);
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .prompt-collection-header-breadcrumb,
  .prompt-collection-header-collection,
  .prompt-collection-header-section {
    color: var(--ui-muted-text);
  }

  .prompt-collection-header-collection:hover,
  .prompt-collection-header-section:hover {
    color: var(--ui-hoverable-text);
  }

  .prompt-collection-header-separator {
    color: var(--ui-neutral-emphasis-border);
  }

  .prompt-collection-header-section:last-child {
    color: var(--ui-hoverable-text);
  }

  .prompt-collection-header-section:last-child:hover {
    color: var(--ui-normal-text);
  }
</style>
