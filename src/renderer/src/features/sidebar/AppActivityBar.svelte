<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { flip } from 'svelte/animate'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createListReorder } from '@renderer/common/drag-drop/listReorder.svelte.ts'
  import ActivityBarButton from '@renderer/common/cthulhu-ui/buttons/ActivityBarButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { Download, Plus } from 'lucide-svelte'
  import type { Project } from '@shared/domain/workspace/Project'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import WorkspacePopup from '@renderer/features/workspace/WorkspacePopup.svelte'
  import { getNextAppIconTooltip, INITIAL_APP_ICON_TOOLTIP } from './appIconTooltip'

  let {
    activeScreen,
    projects,
    selectedProjectId,
    onProjectSelect,
    onProjectsReorder,
    onCreateProject,
    isAppSidebarExpanded,
    isWorkspaceReady = false,
    isDevMode = false,
    workspacePath,
    onNavigate,
    updatesOpen,
    updateAvailable,
    onToggleUpdates,
    updatesButton = $bindable()
  } = $props<{
    /** Persisted project records in the user's display order. */
    projects: Project[]
    /** Selected project is independent of non-project screens. */
    selectedProjectId: string | null
    /** Opens a project or toggles its already-active sidebar. */
    onProjectSelect: (projectId: string) => void
    /** Saves a dragged project order; the preview stays until the save settles. */
    onProjectsReorder: (projectIds: string[]) => Promise<void>
    /** Opens project settings to a new project draft. */
    onCreateProject: () => void
    activeScreen: ScreenId
    isAppSidebarExpanded: boolean
    isWorkspaceReady?: boolean
    isDevMode?: boolean
    /** Current workspace shown independently of the selected activity. */
    workspacePath: string | null
    onNavigate: (screen: ScreenId) => void
    /** Reflects the updater popup independently of screen navigation. */
    updatesOpen: boolean
    /** Shows a notification dot while a newer public release exists. */
    updateAvailable: boolean
    /** Toggles the shell-owned updater surface. */
    onToggleUpdates: () => void
    /** Bound updater toggle, identified to the shell-owned popup as its trigger. */
    updatesButton?: HTMLButtonElement
  }>()

  /** Session-only visibility does not affect navigation or sidebar expansion. */
  let workspaceOpen = $state(false)
  /** Live anchor follows the top activity button when the window changes size. */
  let workspaceButton = $state<HTMLButtonElement>()
  /** Preserve the mascot's rotating hover messages on its new button. */
  let workspaceTooltip = $state<string>(INITIAL_APP_ICON_TOOLTIP)
  /** Stationary project button list that owns pointer capture while buttons reorder. */
  let projectListElement = $state<HTMLElement>()
  /** Live drag reordering of project buttons, saved on drop without selecting the dragged project. */
  const projectReorder = createListReorder({
    dragType: 'activity-bar-project',
    getIds: () => projects.map((project: Project) => project.id),
    getListElement: () => projectListElement,
    onReorder: (projectIds) => onProjectsReorder(projectIds)
  })

  type ActivityItem = {
    id: ScreenId
    label: string
    icon: ComponentType
    testId: string
  }

  const activityScreenOrder: ScreenId[] = [
    'home',
    'settings',
    'mockups',
    'test-screen'
  ]
  const activityItems = $derived<ActivityItem[]>(
    activityScreenOrder
      .map((screenId) => {
        const config = screens[screenId]
        if (
          !config.showInNav ||
          (config.devOnly && !isDevMode) ||
          (config.requiresWorkspace && !isWorkspaceReady) ||
          !config.icon
        ) {
          return null
        }

        return {
          id: screenId,
          label: config.label,
          icon: config.icon,
          testId: config.testId
        }
      })
      .filter((item): item is ActivityItem => item !== null)
  )
</script>

{#snippet activityButton(item: ActivityItem)}
  <ActivityBarButton
    icon={item.icon}
    label={item.label}
    title={activeScreen === item.id && screens[item.id].sidebarMode !== null
      ? `${item.label} — ${isAppSidebarExpanded ? 'Hide' : 'Show'} sidebar`
      : item.label}
    testId={item.testId}
    active={activeScreen === item.id}
    compactIndicator={!isAppSidebarExpanded}
    ariaCurrent={activeScreen === item.id ? 'page' : undefined}
    ariaExpanded={activeScreen === item.id && screens[item.id].sidebarMode !== null ? isAppSidebarExpanded : undefined}
    onclick={() => onNavigate(item.id)}
  />
{/snippet}

<nav class="appActivityBar" aria-label="Primary navigation" data-testid="app-activity-bar">
  <ActivityBarButton bind:buttonElement={workspaceButton} class="mb-1" label="Workspace"
    ariaExpanded={workspaceOpen} ariaHaspopup="dialog" title={workspaceTooltip} testId="workspace-button"
    onmouseenter={() => { workspaceTooltip = getNextAppIconTooltip(workspaceTooltip) }}
    onclick={() => { workspaceOpen = !workspaceOpen }}>
    <img class="workspaceIcon h-8 w-8 object-contain" src={appIcon} alt="Cthulhu Prompt icon" draggable="false" />
  </ActivityBarButton>
  {#each activityItems.filter((item) => item.id !== 'settings') as item (item.id)}
    {@render activityButton(item)}
  {/each}
  {#if isWorkspaceReady}
    <!-- Project buttons form their own top-aligned group below the screen activities. -->
    <Separator class="my-1 w-7" />
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
              title={isActive ? `${project.name} — ${isAppSidebarExpanded ? 'Hide' : 'Show'} sidebar` : project.name}
              testId={screens.project.testId}
              active={isActive}
              dragging={projectReorder.draggedId === project.id}
              compactIndicator={!isAppSidebarExpanded}
              ariaCurrent={isActive ? 'page' : undefined}
              ariaExpanded={isActive ? isAppSidebarExpanded : undefined}
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
  <div class="mt-auto flex w-full flex-col gap-1 relative">
    {#each activityItems.filter((item) => item.id === 'settings') as item (item.id)}
      {@render activityButton(item)}
    {/each}
    <ActivityBarButton bind:buttonElement={updatesButton} label={updateAvailable ? 'App updates — update available' : 'App updates'}
      ariaExpanded={updatesOpen} title="App updates" testId="app-updates-button" onclick={onToggleUpdates}>
      <Download size={24} strokeWidth={1.5} aria-hidden="true" />
      {#if updateAvailable}<span class="updateDot" data-testid="update-available-dot"></span>{/if}
    </ActivityBarButton>
  </div>
</nav>

<!-- The activity rail stays mounted while screens and the sidebar change. -->
<WorkspacePopup bind:open={workspaceOpen} anchor={workspaceButton} {workspacePath} />

<style>
  /* Brighten the mascot alongside the rail's other ghost controls on interaction. */
  .workspaceIcon { opacity: 0.8; transform: translateX(1px); }
  :global(.cthulhuUiActivityBarButton:is(:hover, :focus-visible, [aria-expanded='true'])) .workspaceIcon {
    opacity: 1;
  }
  .updateDot {
    position: absolute;
    right: 7px;
    top: 7px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ui-success-normal-text);
    border: 2px solid var(--ui-chrome-normal-surface);
    box-sizing: content-box;
  }
</style>
