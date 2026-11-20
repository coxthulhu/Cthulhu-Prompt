<script lang="ts">
  import { onMount } from 'svelte'
  import type { Action } from 'svelte/action'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Folder, Move, Plus, Search, Settings } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import DraggableTitle from '@renderer/common/cthulhu-ui/layout/DraggableTitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createDropIndicatorReorder } from '@renderer/common/drag-drop/dropIndicatorReorder.svelte.ts'
  import MoveHereIndicator from '@renderer/common/drag-drop/MoveHereIndicator.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { moveProject } from '@renderer/data/Mutations/ProjectMutations'
  import { movePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import CreatePromptCollectionDialog from '@renderer/features/prompt-collections/CreatePromptCollectionDialog.svelte'
  import { getPromptCollectionDetails } from '@renderer/features/prompt-collections/promptCollectionDetails'
  import { createPromptDragGhost } from '@renderer/features/prompt-drag-drop/promptDragGhost'
  import NewTabCollectionGrid, { type NewTabCollectionTile } from './NewTabCollectionGrid.svelte'
  import type { Prompt } from '@shared/domain/prompt/Prompt'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import type { Project } from '@shared/domain/workspace/Project'
  import type { Workspace } from '@shared/domain/workspace/Workspace'

  /** One project section, keyed by its project's ID. */
  type ProjectGroup = {
    id: string
    project: Project
    /** The project's collection tiles in Show All order. */
    collections: NewTabCollectionTile[]
  }

  /** One project section shown for the current search. */
  type VisibleProjectGroup = ProjectGroup & {
    /** The project's collections the search hides from its grid. */
    hiddenCollectionCount: number
  }

  let { viewState, workspace, openCollectionIds, onOpenCollection, onCreateProject, onEditProject } = $props<{
    /** This tab's retained search and viewport. */
    viewState: { search: string; scrollTop: number }
    /** Open workspace whose projects and collections are listed. */
    workspace: Workspace
    /** Collections shown by other work tabs, whose tiles are marked open. */
    openCollectionIds: string[]
    /** Opens a collection in this tab, including collections already shown elsewhere. */
    onOpenCollection: (collectionId: string) => void
    /** Opens Manage Projects to a new draft without leaving this screen. */
    onCreateProject: () => void
    /** Opens Manage Projects to one project. */
    onEditProject: (projectId: string) => void
  }>()

  const promptCollectionQuery = useLiveQuery(promptCollectionsCollection) as { data: PromptCollection[] }
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as { data: PromptTemplate[] }

  /** Scroll host restored once after the tab's filtered content mounts. */
  let scrollHost: HTMLElement
  // Side effect: restore the retained New Tab viewport after applying its saved search.
  onMount(() => { scrollHost.scrollTop = viewState.scrollTop })
  /** Clock for the tiles' relative modification times. */
  let nowMs = $state(Date.now())
  /** Project that receives the collection created from its New Collection button. */
  let createCollectionProjectId = $state<string | null>(null)
  /** Shared creation dialog, opened for one project at a time. */
  let createPromptCollectionDialog = $state<{ openDialog: () => void } | null>(null)

  // Side effect: keep the tiles' relative modification times fresh while the screen is open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  })

  /** Projects in saved order, each with its collections in Show All order and their tile details. */
  const projectGroups = $derived.by((): ProjectGroup[] => {
    const collectionById = new Map(promptCollectionQuery.data.map((collection) => [collection.id, collection]))
    const promptById = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt]))
    const templateById = new Map(promptTemplateQuery.data.map((template) => [template.id, template]))

    return workspace.projects.map((project) => ({
      id: project.id,
      project,
      collections: project.collectionEntries.flatMap((entry) => {
        const collection = collectionById.get(entry.id)
        return collection
          ? [{ id: collection.id, collection, details: getPromptCollectionDetails(collection, promptById, templateById, nowMs) }]
          : []
      })
    }))
  })

  /** Case-insensitive search text; empty matches everything. */
  const normalizedQuery = $derived(viewState.search.trim().toLowerCase())
  /** Projects whose names match keep every collection; others keep only matching collections, counting the rest as
   *  hidden, and hide without any. */
  const visibleProjectGroups = $derived(
    projectGroups.flatMap((group): VisibleProjectGroup[] => {
      if (group.project.name.toLowerCase().includes(normalizedQuery)) return [{ ...group, hiddenCollectionCount: 0 }]
      const collections = group.collections.filter(({ collection }) =>
        collection.displayName.toLowerCase().includes(normalizedQuery)
      )
      return collections.length > 0
        ? [{ ...group, collections, hiddenCollectionCount: group.collections.length - collections.length }]
        : []
    })
  )
  /** Projects the search hides entirely, counted after the last visible project. */
  const hiddenProjectCount = $derived(projectGroups.length - visibleProjectGroups.length)

  /** Project title handle action typed for DraggableTitle's generic button action slot. */
  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>
  /** Project section list that owns pointer capture and is measured to place a dragged project. */
  let projectListElement = $state<HTMLElement>()
  /** Drag reordering of the visible projects, saved right after the visible project before the drop boundary. */
  const projectReorder = createDropIndicatorReorder({
    dragType: 'new-tab-project',
    getIds: () => visibleProjectGroups.map((group) => group.id),
    // Sections differ in height, so a dragged project goes before the first section whose middle is below the
    // pointer. Only the pointer's vertical position matters: above the list is first and below it is last.
    getDropTarget: (_, clientY) => {
      /** Project sections in display order. */
      const sections = [...projectListElement!.children] as HTMLElement[]
      /** First section whose middle is below the pointer, absent below every section's middle. */
      const nextSection = sections.find((section) => {
        const rect = section.getBoundingClientRect()
        return rect.top + rect.height / 2 > clientY
      })
      return nextSection
        ? { id: nextSection.dataset.projectId!, after: false }
        : { id: sections[sections.length - 1].dataset.projectId!, after: true }
    },
    createGhost: (projectId) =>
      createPromptDragGhost(workspace.projects.find((project) => project.id === projectId)!.name, 'project', Folder),
    onReorder: (projectId, previousProjectId) =>
      runIpcBestEffort(() => moveProject(workspace.id, projectId, previousProjectId))
  })

  /** Opens collection creation for one project. */
  const openCreateCollectionDialog = (projectId: string): void => {
    createCollectionProjectId = projectId
    createPromptCollectionDialog!.openDialog()
  }
</script>

<!-- Content is top aligned and the scrollbar's space is always reserved, so search results changing its height never
     move the search bar or shift the content sideways. -->
<main bind:this={scrollHost} onscroll={() => { viewState.scrollTop = scrollHost.scrollTop }} class="newTabScreen flex min-w-0 flex-1 flex-col overflow-y-auto" data-testid="new-tab-screen">
  <div class="mx-auto flex w-full max-w-[880px] flex-col px-6 py-8">
    <Title
      title={workspace.workspaceName}
      tooltip={workspace.workspaceName}
      variant="workspace"
      class="mb-4"
      data-testid="new-tab-workspace-title"
    />

    <div class="flex items-center gap-2.5">
      <TextInput
        icon={Search}
        class="flex-1"
        bind:value={viewState.search}
        aria-label="Search projects and collections"
        placeholder="Search projects and collections"
        spellcheck="false"
        data-testid="new-tab-search-input"
      />
      <Button
        icon={Plus}
        text="New Project"
        appearance="outline"
        testId="new-tab-new-project-button"
        onclick={onCreateProject}
      />
    </div>

    <p class="newTabHint mt-2.5 flex items-center gap-1 pl-1 text-xs leading-4">
      <Move size={14} aria-hidden="true" />
      Drag to reorder projects and collections
    </p>

    <div bind:this={projectListElement} data-pointer-drag-owner>
      {#each visibleProjectGroups as { project, collections, hiddenCollectionCount } (project.id)}
        <section
          class="relative mt-[22px]"
          aria-label={project.name}
          data-project-id={project.id}
          data-testid={`new-tab-project-${project.id}`}
        >
          {#if projectReorder.dropTarget?.id === project.id}
            <!-- The indicator overlays the middle of the 22px gap above the section, or the same spot below the last one. -->
            <div
              class={`absolute inset-x-0 ${projectReorder.dropTarget.after ? 'bottom-[-11px] translate-y-1/2' : 'top-[-11px] -translate-y-1/2'}`}
              aria-hidden="true"
              data-testid="new-tab-project-drop-indicator"
            >
              <MoveHereIndicator isBlocked={projectReorder.isBlocked} />
            </div>
          {/if}
          <div class="mb-2 flex h-10 items-center gap-2.5 text-lg leading-7">
            <!-- The -9px margin keeps the grip glyph 5px outside the content edge inside its 26px cell. -->
            <DraggableTitle
              title={project.name}
              class="-ml-[9px]"
              dragging={projectReorder.draggedId === project.id}
              buttonAction={draggableButtonAction}
              buttonActionParameter={projectReorder.getDraggableOptions(project.id)}
              testId={`new-tab-project-title-${project.id}`}
            />
            <!-- The large size matches the 40px New Collection button beside it. -->
            <IconButton
              icon={Settings}
              label="Edit Project"
              title="Edit Project"
              size="large"
              appearance="outline"
              class="ml-auto"
              testId={`new-tab-edit-project-${project.id}`}
              onclick={() => onEditProject(project.id)}
            />
            <Button
              icon={Plus}
              text="New Collection"
              appearance="outline"
              testId={`new-tab-new-collection-${project.id}`}
              onclick={() => openCreateCollectionDialog(project.id)}
            />
          </div>

          <NewTabCollectionGrid
            {collections}
            {hiddenCollectionCount}
            {openCollectionIds}
            {onOpenCollection}
            onMoveCollection={(collectionId, previousCollectionId) =>
              runIpcBestEffort(() => movePromptCollection(workspace.id, collectionId, previousCollectionId))}
          />
        </section>
      {/each}
    </div>

    {#if normalizedQuery && visibleProjectGroups.length === 0}
      <p class="newTabNoResults mt-[22px] text-sm leading-5" data-testid="new-tab-no-results">
        No projects or collections match your search.
      </p>
    {:else if hiddenProjectCount > 0}
      <p class="newTabHiddenProjects mt-[22px] text-sm leading-5" data-testid="new-tab-hidden-projects">
        {hiddenProjectCount} {hiddenProjectCount === 1 ? 'Project' : 'Projects'} Hidden
      </p>
    {/if}
  </div>
</main>

<CreatePromptCollectionDialog
  bind:this={createPromptCollectionDialog}
  projectId={createCollectionProjectId}
  isWorkspaceReady
  promptCollections={projectGroups
    .find((group) => group.project.id === createCollectionProjectId)
    ?.collections.map(({ collection }) => collection) ?? []}
  isPromptCollectionListLoading={false}
/>

<style>
  .newTabScreen {
    scrollbar-gutter: stable;
  }

  .newTabHint,
  .newTabNoResults,
  .newTabHiddenProjects {
    color: var(--ui-muted-text);
  }

  .newTabHint :global(svg) {
    flex: none;
    color: var(--ui-muted-icon-glyph);
  }
</style>
