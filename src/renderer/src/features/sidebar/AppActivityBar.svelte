<script lang="ts">
  import { flip } from 'svelte/animate'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createListReorder } from '@renderer/common/drag-drop/listReorder.svelte.ts'
  import ActivityBarButton from '@renderer/common/cthulhu-ui/buttons/ActivityBarButton.svelte'
  import { Plus } from 'lucide-svelte'
  import type { Project } from '@shared/domain/workspace/Project'

  let {
    activeScreen,
    projects,
    selectedProjectId,
    onProjectSelect,
    onProjectsReorder,
    onCreateProject,
    isAppSidebarExpanded,
    isWorkspaceReady = false
  } = $props<{
    /** Persisted project records in the user's display order. */
    projects: Project[]
    /** Selected project is independent of non-project screens. */
    selectedProjectId: string | null
    /** Opens a project; the already-active project stays as it is. */
    onProjectSelect: (projectId: string) => void
    /** Saves a dragged project order; the preview stays until the save settles. */
    onProjectsReorder: (projectIds: string[]) => Promise<void>
    /** Opens project management to a new project draft. */
    onCreateProject: () => void
    activeScreen: ScreenId
    isAppSidebarExpanded: boolean
    isWorkspaceReady?: boolean
  }>()

  /** Stationary project button list that owns pointer capture while buttons reorder. */
  let projectListElement = $state<HTMLElement>()
  /** Live drag reordering of project buttons, saved on drop without selecting the dragged project. */
  const projectReorder = createListReorder({
    dragType: 'activity-bar-project',
    getIds: () => projects.map((project: Project) => project.id),
    getListElement: () => projectListElement,
    onReorder: (projectIds) => onProjectsReorder(projectIds)
  })
</script>

<nav class="appActivityBar" aria-label="Projects" data-testid="app-activity-bar">
  {#if isWorkspaceReady}
    {#if projects.length > 0}
      <div bind:this={projectListElement} class="flex w-full flex-col gap-1" data-pointer-drag-owner
        data-testid="activity-bar-project-list">
        {#each projectReorder.sort<Project>(projects) as project (project.id)}
          {@const isActive = activeScreen === 'project' && selectedProjectId === project.id}
          <!-- Buttons only slide while a drag previews a reorder; other list changes apply instantly. -->
          <div
            class="w-full"
            use:draggable={projectReorder.getDraggableOptions(project.id)}
            animate:flip={{ duration: projectReorder.draggedId ? uiAnimationDurationMs.standard : 0 }}
          >
            <ActivityBarButton
              label={project.name}
              title={project.name}
              testId={screens.project.testId}
              active={isActive}
              dragging={projectReorder.draggedId === project.id}
              compactIndicator={!isAppSidebarExpanded}
              ariaCurrent={isActive ? 'page' : undefined}
              onclick={() => onProjectSelect(project.id)}
            >
              <span class="text-xl leading-7 font-semibold" aria-hidden="true">{project.abbreviation}</span>
            </ActivityBarButton>
          </div>
        {/each}
      </div>
    {/if}
    <ActivityBarButton icon={Plus} label="New Project" title="New Project" testId="new-project-button" onclick={onCreateProject} />
  {/if}
</nav>
