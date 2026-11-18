<script lang="ts">
  import { findCollectionProject } from '@shared/domain/workspace/Project'
  import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
  import { getPromptStatusFolderDefinition } from '@shared/domain/prompt/Prompt'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import type {
    DroppableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createDroppableStateRegistry } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload,
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    ArrowUpToLine,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    FolderCog,
    Layers,
    LayoutGrid,
    MoreHorizontal,
    Pencil,
    Trash2
  } from 'lucide-svelte'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    PROMPT_STATUS_ACCORDION_PERSISTENCE_ID
  } from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
  import { PROMPT_COLLECTION_VERTICAL_BIAS_PX } from '../prompt-collections/promptCollectionScrollOffsets'
  import {
    PROMPT_STATUS_FOLDER_REGISTRY,
    PromptStatusFolderId,
    type Prompt
  } from '@shared/domain/prompt/Prompt'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import { getMarkdownContentCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'
  import type { Category } from '@shared/domain/category/Category'
  import type { Workspace } from '@shared/domain/workspace/Workspace'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupSimple.svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import Accordion from '@renderer/features/sidebar/accordion/Accordion.svelte'
  import AccordionSection from '@renderer/features/sidebar/accordion/AccordionSection.svelte'
  import { promptEntryDragState } from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
  import { resolvePromptTreePromptMove } from '@renderer/features/prompt-tree/promptTreeDrag'
  import { getPromptStatusGroupCounts, promptStatusGroups, sidebarPromptStatusGroups } from '../prompt-collections/promptStatusGroups'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { PromptCollectionScreenMode } from '@renderer/features/prompt-collections/promptCollectionScreenMode'
  import { saveCategories } from '@renderer/data/Mutations/CategoryMutations'
  import ManageCategoriesDialog, {
    type ManagedCategoryInput,
    type ManageCategoriesDialogOpenOptions
  } from '../prompt-collections/ManageCategoriesDialog.svelte'
  import RenamePromptCollectionDialog from '../prompt-collections/RenamePromptCollectionDialog.svelte'
  import PromptTree from '@renderer/features/prompt-tree/PromptTree.svelte'
  import SidebarHeader from './SidebarHeader.svelte'
  import type { CollectionSidebarModeData } from './sidebarModes.svelte.ts'

  type ManageCategoriesDialogHandle = {
    /** Opens category management with an optional category-specific target. */
    openDialog: (options?: ManageCategoriesDialogOpenOptions) => void
  }

  type RenamePromptCollectionDialogHandle = {
    /** Opens collection rename prefilled with one collection's current name. */
    openDialog: (promptCollectionId: string) => void
  }

  type PromptTreeBulkExpansionRequest = {
    /** Category workflow that owns this toolbar request. */
    statusFolderId: PromptStatusFolderId
    screenCollectionId: string
    isExpanded: boolean
  }

  let {
    title,
    modeData,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    onScreenCollectionSelect,
    onDeleteSelectedPromptCollection,
    onShowAll
  } = $props<{
    /** Mode title shown in the shared sidebar header. */
    title: string
    /** Project mode state shared with the collection screen. */
    modeData: CollectionSidebarModeData
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    onScreenCollectionSelect: (screenCollectionId: string) => void
    onDeleteSelectedPromptCollection: (screenCollectionId: string) => void
    /** Returns a work tab to its New Tab screen; when set, the header holds only the title and this Show All button. */
    onShowAll: () => void
  }>()

  /** Selected collection owned by this mode. */
  const screenCollectionId = $derived(modeData.collectionId)
  /** Status group displayed by this mode's collection screen. */
  const promptCollectionScreenMode = $derived(modeData.screenMode)
  /** Visibility for each toggleable finalized group. */
  const shownFinalStatusGroups = $derived(modeData.shownFinalStatusGroups)
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptNavigation = getPromptNavigationContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptCollectionQuery = useLiveQuery((q) =>
    q.from({ promptCollection: promptCollectionsCollection })
  ) as { data: PromptCollection[] }
  const categoryQuery = useLiveQuery(categoryCollection) as { data: Category[] }
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as {
    data: PromptTemplate[]
  }

  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })

  /** Collections in the owning project remain available to rename validation. */
  const promptCollections = $derived(promptCollectionQuery.data.filter((collection) =>
    (selectedWorkspace && findCollectionProject(selectedWorkspace, screenCollectionId))
      ?.collectionEntries.some((entry) => entry.id === collection.id)))
  /** The tab sidebar only mounts while its collection is available. */
  const screenCollection = $derived(promptCollectionQuery.data.find((collection) => collection.id === screenCollectionId) ?? null)
  /** Tree loading state follows the selected collection. */
  const collectionListState = $derived<'loading' | 'ready'>(isWorkspaceLoading ? 'loading' : 'ready')
  /** Dialog handles owned by the tab sidebar. */
  let manageCategoriesDialog = $state<ManageCategoriesDialogHandle | null>(null)
  /** Collection rename dialog retained while the sidebar is mounted. */
  let renamePromptCollectionDialog = $state<RenamePromptCollectionDialogHandle | null>(null)

  const selectedCollectionCategories = $derived.by((): Category[] => {
    if (!screenCollection) return []

    const categoryById = new Map(categoryQuery.data.map((category) => [category.id, category]))
    return getMarkdownContentCategoryOrder(
      screenCollection,
      PromptStatusFolderId.Active
    ).categories.flatMap(({ categoryId }) => {
      if (categoryId === null) return []
      const category = categoryById.get(categoryId)
      return category ? [category] : []
    })
  })
  const canToggleCategories = $derived(
    collectionListState === 'ready' &&
      screenCollection !== null
  )
  /** Category toolbar acts on the selected workflow, or the default while viewing final prompts. */
  const categoryToolbarGroupId = $derived(
    PROMPT_STATUS_FOLDER_REGISTRY[promptCollectionScreenMode].ordering === 'category'
      ? promptCollectionScreenMode
      : PromptCollectionScreenMode.Active
  )
  const promptTreeExpansionRequests =
    createConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>()
  let areAllCategoriesCollapsed = $state(false)
  /** Icon for expanding or collapsing every category in the active collection. */
  const categoryExpansionActionIcon = $derived(
    areAllCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp
  )
  /** Accessible label for the category expansion action. */
  const categoryExpansionActionLabel = $derived(
    areAllCategoriesCollapsed
      ? 'Expand All Categories'
      : 'Collapse All Categories'
  )
  const isTemplateCollection = $derived(screenCollection?.kind === 'template')
  /** Exact group counts shown in the accordion headers. */
  const selectedPromptStatusCounts = $derived(getPromptStatusGroupCounts(screenCollection, isTemplateCollection ? promptTemplateQuery.data.map((template) => ({ ...template, status: template.status ?? PromptTemplateStatus.Active })) : promptQuery.data))
  /** Category workflows are always present; finalized groups follow their toggles. */
  const visibleStatusGroups = $derived(
    sidebarPromptStatusGroups.filter((group) =>
      (!isTemplateCollection || group.id === 'active' || group.id === 'archived') && (group.ordering === 'category' || shownFinalStatusGroups[group.id])
    )
  )
  // Keep selected-collection overflow actions together as the toolbar gets tighter.
  const selectedPromptCollectionActionsItems = $derived.by((): DropdownPopupItem[] => [
    {
      id: 'rename-collection',
      label: 'Rename Collection',
      icon: Pencil,
      testId: 'rename-selected-prompt-collection-menu-item'
    },
    {
      id: 'manage-categories',
      label: 'Manage Categories',
      icon: FolderCog,
      testId: 'manage-categories-selected-prompt-collection-menu-item'
    },
    {
      id: 'delete-collection',
      label: 'Delete Collection',
      icon: Trash2,
      testId: 'delete-selected-prompt-collection-menu-item',
      variant: 'danger'
    }
  ])

  /** Toggles this collection's finalized section through the shared navigation handler. */
  const toggleFinalStatusGroup = (groupId: PromptStatusFolderId): void => {
    /** Visibility requested by this toolbar click. */
    const isShown = !shownFinalStatusGroups[groupId]
    modeData.setFinalStatusGroupShown(groupId, isShown)
  }

  /** Expands or collapses every category under the selected collection. */
  const handleCategoryExpansionAction = () => {
    const selectedCollectionId = screenCollection?.id
    if (!selectedCollectionId) return

    if (areAllCategoriesCollapsed) {
      promptTreeExpansionRequests.request({
        screenCollectionId: selectedCollectionId,
        statusFolderId: categoryToolbarGroupId,
        isExpanded: true
      })
      return
    }

    promptTreeExpansionRequests.request({
      screenCollectionId: selectedCollectionId,
      statusFolderId: categoryToolbarGroupId,
      isExpanded: false
    })
  }

  const handleSelectedPromptCollectionActionsSelect = (item: DropdownPopupItem) => {
    if (!screenCollection) return

    if (item.id === 'rename-collection') {
      renamePromptCollectionDialog?.openDialog(screenCollection.id)
    } else if (item.id === 'manage-categories') {
      openManageCategoriesDialog()
    } else if (item.id === 'delete-collection') {
      onDeleteSelectedPromptCollection(screenCollection.id)
    }
  }

  // Selects and reveals the collection overview formerly represented by the first tree row.
  const selectCollectionOverview = () => {
    // The selected collection owns both the toolbar state and the overview navigation target.
    const collectionId = screenCollection?.id
    if (!collectionId) return

    promptNavigation.select({
      screenCollectionId: collectionId,
      contentOwnerId: collectionId,
      row: 'collection-header',
      source: 'tree-click',
      forceRequest: true,
      contentReveal: {
        scrollType: 'vertical-bias',
        verticalBiasPx: PROMPT_COLLECTION_VERTICAL_BIAS_PX
      }
    })
  }

  /** Opens category management for the currently selected collection. */
  const openManageCategoriesDialog = (): void => {
    manageCategoriesDialog?.openDialog()
  }

  /** Opens category management to one category selected from the prompt tree. */
  const openManageCategoryDialog = (categoryId: string): void => {
    manageCategoriesDialog?.openDialog({ categoryId })
  }

  // Side effect: let this tab's collection screens open the dialogs hosted here; unregisters on unmount.
  $effect(() =>
    modeData.registerCollectionDialogs({
      openRenamePromptCollection: (promptCollectionId) =>
        renamePromptCollectionDialog?.openDialog(promptCollectionId),
      openManageCategories: (options) => manageCategoriesDialog?.openDialog(options)
    })
  )

  /** Persists every retained category draft through one atomic mutation. */
  const handleSaveCategories = async (
    categories: ManagedCategoryInput[]
  ): Promise<boolean> => {
    const promptCollection = screenCollection
    const workspaceId = selectedWorkspace?.id
    if (!promptCollection || !workspaceId) return false

    return await runIpcBestEffort(
      async () => {
        await saveCategories(
          workspaceId,
          promptCollection.id,
          categories
        )
        return true
      },
      () => false
    )
  }

  /** Independent hover and rejection indicators for the workflow headers. */
  const statusHeaderDroppableState = createDroppableStateRegistry<PromptStatusFolderId>()

  /** Keeps a header transfer in the dragged prompt's retained category. */
  const getStatusHeaderDropPayload = (statusSection: PromptStatusFolderId): PromptHandleDropPayload => {
    /** Current prompt identity shared by editor and tree drag sources. */
    const draggedEntry = promptEntryDragState.draggedEntry
    return {
      collectionId: screenCollectionId,
      // The drag location already resolves prompt and template categories, including retained final ones.
      categoryId: draggedEntry?.kind === 'content' ? draggedEntry.location.categoryId : null,
      targetEntryId: null,
      position: 'before',
      statusSection
    }
  }

  /** Accepts cross-section prompt transfers only while the pointer is inside the header. */
  const getStatusHeaderDroppableOptions = (statusSection: PromptStatusFolderId): DroppableOptions => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    snapDimensions: { x: 0, y: 0 },
    payload: () => getStatusHeaderDropPayload(statusSection),
    canDrop: (payload) => {
      /** Typed prompt source supplied by the shared prompt drag type. */
      const source = payload as PromptHandleDragPayload
      return getPromptStatusFolderDefinition(source.location.status).id !== statusSection &&
        resolvePromptTreePromptMove(promptCollectionQuery.data, source, getStatusHeaderDropPayload(statusSection)) !== null
    },
    indicator: statusHeaderDroppableState.getState(statusSection)
  })

</script>

<div class="collectionSidebar flex min-h-0 flex-1 flex-col">
  <div class="shrink-0">
    <SidebarHeader {title} icon={isTemplateCollection ? Layers : FileText} screenHeader>
      <Button text="Show All" appearance="outline" borderless icon={LayoutGrid}
        class="sidebarCollectionShowAll" onclick={onShowAll} testId="sidebar-show-all-button" />
    </SidebarHeader>
  </div>
  <Separator data-testid="sidebar-header-separator" />

  <div class="cthulhuSidebarPromptSectionHeader">
    {#if isWorkspaceReady}
      <div class="cthulhuSidebarPromptSectionActions">
        <IconButton
          icon={ArrowUpToLine}
          label="Go to Top"
          title="Go to Top"
          borderless
          baseVariant="dim"
          disabled={!screenCollection}
          testId="sidebar-collection-overview-button"
          onclick={selectCollectionOverview}
        />
        {#if screenCollection}
          {#each promptStatusGroups.filter((group) => group.ordering === 'finalizedAt' && (!isTemplateCollection || group.id === 'archived')) as group (group.id)}
            <IconButton
              icon={group.toggleIcon}
              label={`Show ${group.label} ${isTemplateCollection ? 'Templates' : 'Prompts'}`}
              title={`Show ${group.label} ${isTemplateCollection ? 'Templates' : 'Prompts'}`}
              borderless
              baseVariant="dim"
              disabled={!screenCollection}
              active={shownFinalStatusGroups[group.id] ?? false}
              testId={`toggle-${group.id}-prompts-button`}
              onclick={() => toggleFinalStatusGroup(group.id)}
            />
          {/each}
        {/if}
        <IconButton
          icon={categoryExpansionActionIcon}
          label={categoryExpansionActionLabel}
          title={categoryExpansionActionLabel}
          borderless
          baseVariant="dim"
          disabled={!canToggleCategories}
          testId="toggle-all-categories-button"
          onclick={handleCategoryExpansionAction}
        />
        <DropdownPopupSimple
          label="Selected Collection Actions"
          items={selectedPromptCollectionActionsItems}
          menuWidth="204px"
          testId="selected-prompt-collection-actions-menu"
          onselect={handleSelectedPromptCollectionActionsSelect}
        >
          {#snippet trigger(dropdown)}
            <IconButton
              icon={MoreHorizontal}
              label="Selected Collection Actions"
              title="Selected Collection Actions"
              borderless
              baseVariant="dim"
              disabled={!screenCollection}
              active={dropdown.open}
              ariaHaspopup={dropdown.ariaHaspopup}
              ariaExpanded={dropdown.ariaExpanded}
              buttonAction={dropdown.triggerAction}
              onclick={dropdown.toggle}
              testId="selected-prompt-collection-actions-button"
            />
          {/snippet}
        </DropdownPopupSimple>

      </div>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-visible">
    {#if !screenCollection}
      <PromptTree
        promptCollections={promptCollections}
        {collectionListState}
        {screenCollectionId}
        screenMode={PromptCollectionScreenMode.Active}
        expansionRequests={promptTreeExpansionRequests}
        isPromptCollectionsScreenActive
        onAllCategoriesCollapsedChange={(isCollapsed) => {
          areAllCategoriesCollapsed = isCollapsed
        }}
        onScreenModeSelect={modeData.setScreenMode}
        onManageCategory={openManageCategoryDialog}
        {onScreenCollectionSelect}
      />
    {:else}
      <!-- Recreate the owner so conditionally visible sections register in rendered order. -->
      {#key visibleStatusGroups.map((group) => group.id).join(':')}
        <Accordion
          persistenceId={PROMPT_STATUS_ACCORDION_PERSISTENCE_ID}
          testId="sidebar-prompt-status-accordion"
          class="sidebarPromptStatusAccordion flex-1"
        >
          {#each visibleStatusGroups as group (group.id)}
            <AccordionSection
              id={group.id}
              label={group.label}
              icon={group.icon}
              count={selectedPromptStatusCounts[group.id]}
              initialExpandedHeightPx={group.id === PromptStatusFolderId.Active ? 400 : 200}
              headerDroppableOptions={getStatusHeaderDroppableOptions(group.id)}
            >
              <PromptTree
                promptCollections={promptCollections}
                {collectionListState}
                {screenCollectionId}
                screenMode={group.id}
                expansionRequests={promptTreeExpansionRequests}
                isPromptCollectionsScreenActive={promptCollectionScreenMode === group.id}
                onAllCategoriesCollapsedChange={(isCollapsed) => {
                  if (group.id === categoryToolbarGroupId) areAllCategoriesCollapsed = isCollapsed
                }}
                onScreenModeSelect={modeData.setScreenMode}
                onManageCategory={openManageCategoryDialog}
                {onScreenCollectionSelect}
              />
            </AccordionSection>
          {/each}
        </Accordion>
      {/key}
    {/if}
  </div>
</div>

<ManageCategoriesDialog
  bind:this={manageCategoriesDialog}
  categories={selectedCollectionCategories}
  collectionDisplayName={screenCollection?.displayName ?? ''}
  contentKind={screenCollection?.kind ?? 'prompt'}
  isWorkspaceReady={screenCollection !== null}
  onsubmit={handleSaveCategories}
/>

<RenamePromptCollectionDialog
  bind:this={renamePromptCollectionDialog}
  isWorkspaceReady={screenCollection !== null}
  {promptCollections}
/>

<style>
  .collectionSidebar :global(.sidebarCollectionShowAll) {
    height: 32px;
    padding: 0 8px;
  }

  .cthulhuSidebarPromptSectionHeader {
    display: flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
  }

  .cthulhuSidebarPromptSectionActions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
  }

  /* Allow tree-edge drop indicators to overlap adjacent status headers slightly. */
  .collectionSidebar :global(.sidebarPromptStatusAccordion.cthulhuUiAccordion),
  .collectionSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionSection),
  .collectionSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionContent) {
    overflow: visible;
  }

  .collectionSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionContent) {
    position: relative;
    z-index: var(--z-chrome);
  }

</style>
