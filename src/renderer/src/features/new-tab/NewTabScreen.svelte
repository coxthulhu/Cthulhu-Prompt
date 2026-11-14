<script lang="ts">
  import { onMount } from 'svelte'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { FileText, Layers, Move, Plus, Search, Settings2 } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupSimple.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import DraggableTitle from '@renderer/common/cthulhu-ui/layout/DraggableTitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import CreatePromptCollectionDialog from '@renderer/features/prompt-collections/CreatePromptCollectionDialog.svelte'
  import { getPromptCollectionDetails } from '@renderer/features/prompt-collections/promptCollectionDetails'
  import type { Prompt } from '@shared/domain/prompt/Prompt'
  import type { PromptCollection, PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import type { Workspace } from '@shared/domain/workspace/Workspace'

  let { workspace, onCreateProject, onEditProject } = $props<{
    /** Open workspace whose projects and collections are listed. */
    workspace: Workspace
    /** Opens Manage Projects to a new draft without leaving this screen. */
    onCreateProject: () => void
    /** Opens Manage Projects to one project. */
    onEditProject: (projectId: string) => void
  }>()

  const promptCollectionQuery = useLiveQuery(promptCollectionsCollection) as { data: PromptCollection[] }
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as { data: PromptTemplate[] }

  /** Creation actions in each project's New Collection menu, named like the dialogs they open; ids are the kinds. */
  const createCollectionItems: DropdownPopupItem[] = [
    { id: 'prompt', label: 'Create Task Collection', icon: FileText, testId: 'new-tab-create-task-collection-item' },
    { id: 'template', label: 'Create Template Collection', icon: Layers, testId: 'new-tab-create-template-collection-item' }
  ]

  /** Text typed into the search bar. */
  let searchQuery = $state('')
  /** Clock for the tiles' relative modification times. */
  let nowMs = $state(Date.now())
  /** Project that receives the collection created from its New Collection menu. */
  let createCollectionProjectId = $state<string | null>(null)
  /** Shared creation dialog, opened for one project and kind at a time. */
  let createPromptCollectionDialog = $state<{ openDialog: (kind: PromptCollectionKind) => void } | null>(null)

  // Side effect: keep the tiles' relative modification times fresh while the screen is open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  })

  /** Projects in activity bar order, each with its collections in Show All order and their tile details. */
  const projectGroups = $derived.by(() => {
    const collectionById = new Map(promptCollectionQuery.data.map((collection) => [collection.id, collection]))
    const promptById = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt]))
    const templateById = new Map(promptTemplateQuery.data.map((template) => [template.id, template]))

    return workspace.projects.map((project) => ({
      project,
      collections: project.collectionEntries.flatMap((entry) => {
        const collection = collectionById.get(entry.id)
        return collection
          ? [{ collection, details: getPromptCollectionDetails(collection, promptById, templateById, nowMs) }]
          : []
      })
    }))
  })

  /** Case-insensitive search text; empty matches everything. */
  const normalizedQuery = $derived(searchQuery.trim().toLowerCase())
  /** Projects whose names match keep every collection; others keep only matching collections and hide without any. */
  const visibleProjectGroups = $derived(
    projectGroups.flatMap((group) => {
      if (group.project.name.toLowerCase().includes(normalizedQuery)) return [group]
      const collections = group.collections.filter(({ collection }) =>
        collection.displayName.toLowerCase().includes(normalizedQuery)
      )
      return collections.length > 0 ? [{ ...group, collections }] : []
    })
  )

  /** Opens collection creation for one project and kind. */
  const openCreateCollectionDialog = (projectId: string, kind: PromptCollectionKind): void => {
    createCollectionProjectId = projectId
    createPromptCollectionDialog!.openDialog(kind)
  }
</script>

<!-- Content is top aligned and the scrollbar's space is always reserved, so search results changing its height never
     move the search bar or shift the content sideways. -->
<main class="newTabScreen flex min-w-0 flex-1 flex-col overflow-y-auto" data-testid="new-tab-screen">
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
        bind:value={searchQuery}
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

    {#each visibleProjectGroups as { project, collections } (project.id)}
      <section class="mt-[22px]" aria-label={project.name} data-testid={`new-tab-project-${project.id}`}>
        <!-- The row's 18px font matches the dialog title, so the text-baseline edit button centers on the title's capitals. -->
        <div class="mb-2 flex h-10 items-center gap-1 text-lg leading-7">
          <div class="flex min-w-0 items-baseline">
            <!-- The -9px margin keeps the grip glyph 5px outside the content edge inside its 26px cell. Dragging does
                 nothing until projects can be reordered here. -->
            <DraggableTitle
              title={project.name}
              class="-ml-[9px]"
              testId={`new-tab-project-title-${project.id}`}
            />
            <!-- The 28px compact button matches the title's 28px line. -->
            <IconButton
              icon={Settings2}
              label="Edit Project"
              title="Edit Project"
              size="compact"
              baseVariant="muted"
              hoverVariant="glyph"
              textBaseline
              testId={`new-tab-edit-project-${project.id}`}
              onclick={() => onEditProject(project.id)}
            />
          </div>
          <DropdownPopupSimple
            label="New Collection"
            items={createCollectionItems}
            menuWidth="260px"
            placement="below-trigger"
            menuAlignment="right"
            testId="new-tab-new-collection-menu"
            onselect={(item) => openCreateCollectionDialog(project.id, item.id as PromptCollectionKind)}
          >
            {#snippet trigger(dropdown)}
              <Button
                icon={Plus}
                text="New Collection"
                appearance="outline"
                class="ml-auto"
                buttonAction={dropdown.triggerAction}
                aria-haspopup={dropdown.ariaHaspopup}
                aria-expanded={dropdown.ariaExpanded}
                testId={`new-tab-new-collection-${project.id}`}
                onclick={dropdown.toggle}
              />
            {/snippet}
          </DropdownPopupSimple>
        </div>

        <div class="grid grid-cols-3 gap-2">
          {#each collections as { collection, details } (collection.id)}
            <!-- Opening a collection in this tab comes with full tab management. -->
            <SelectorButton
              variant="tile"
              icon={collection.kind === 'template' ? Layers : FileText}
              text={collection.displayName}
              detailParts={details.modifiedText ? [details.countText, details.modifiedText] : [details.countText]}
              showChevron={false}
              testId={`new-tab-collection-${collection.id}`}
            />
          {/each}
        </div>
      </section>
    {/each}

    {#if normalizedQuery && visibleProjectGroups.length === 0}
      <p class="newTabNoResults mt-[22px] text-sm leading-5" data-testid="new-tab-no-results">
        No projects or collections match your search.
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
  .newTabNoResults {
    color: var(--ui-muted-text);
  }

  .newTabHint :global(svg) {
    flex: none;
    color: var(--ui-muted-icon-glyph);
  }
</style>
