<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import ActivityBarButton from '@renderer/common/cthulhu-ui/buttons/ActivityBarButton.svelte'
  import { Download } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import WorkspacePopup from '@renderer/features/workspace/WorkspacePopup.svelte'
  import { getNextAppIconTooltip, INITIAL_APP_ICON_TOOLTIP } from './appIconTooltip'

  let {
    activeScreen,
    isAppSidebarExpanded,
    isWorkspaceReady = false,
    isDevMode = false,
    workspacePath,
    onNavigate,
    updatesOpen,
    updateAvailable,
    onToggleUpdates
  } = $props<{
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
  }>()

  /** Session-only visibility does not affect navigation or sidebar expansion. */
  let workspaceOpen = $state(false)
  /** Live anchor follows the top activity button when the window changes size. */
  let workspaceButton = $state<HTMLButtonElement>()
  /** Preserve the mascot's rotating hover messages on its new button. */
  let workspaceTooltip = $state<string>(INITIAL_APP_ICON_TOOLTIP)

  type ActivityItem = {
    id: ScreenId
    label: string
    icon: ComponentType
    testId: string
  }

  const activityScreenOrder: ScreenId[] = [
    'home',
    'prompt-task-collections',
    'prompt-template-collections',
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
    title={activeScreen === item.id
      ? `${item.label} — ${isAppSidebarExpanded ? 'Hide' : 'Show'} sidebar`
      : item.label}
    testId={item.testId}
    active={activeScreen === item.id}
    compactIndicator={!isAppSidebarExpanded}
    ariaCurrent={activeScreen === item.id ? 'page' : undefined}
    ariaExpanded={activeScreen === item.id ? isAppSidebarExpanded : undefined}
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
  <div class="mt-auto flex w-full flex-col gap-1 relative">
    {#each activityItems.filter((item) => item.id === 'settings') as item (item.id)}
      {@render activityButton(item)}
    {/each}
    <ActivityBarButton label={updateAvailable ? 'App updates — update available' : 'App updates'}
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
