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
  <button bind:this={workspaceButton} type="button" class="workspaceButton mb-1"
    aria-label="Workspace" aria-expanded={workspaceOpen} aria-haspopup="dialog"
    title={workspaceTooltip} data-testid="workspace-button"
    onmouseenter={() => { workspaceTooltip = getNextAppIconTooltip(workspaceTooltip) }}
    onclick={() => { workspaceOpen = !workspaceOpen }}>
    <img class="h-8 w-8 object-contain" src={appIcon} alt="Cthulhu Prompt icon" draggable="false" />
  </button>
  {#each activityItems.filter((item) => item.id !== 'settings') as item (item.id)}
    {@render activityButton(item)}
  {/each}
  <div class="mt-auto flex w-full flex-col gap-1 relative">
    {#each activityItems.filter((item) => item.id === 'settings') as item (item.id)}
      {@render activityButton(item)}
    {/each}
    <button type="button" class="updatesButton" aria-label={updateAvailable ? 'App updates — update available' : 'App updates'}
      aria-expanded={updatesOpen} title="App updates" data-testid="app-updates-button" onclick={onToggleUpdates}>
      <Download size={24} strokeWidth={1.5} aria-hidden="true" />
      {#if updateAvailable}<span class="updateDot" data-testid="update-available-dot"></span>{/if}
    </button>
  </div>
</nav>

<!-- The activity rail stays mounted while screens and the sidebar change. -->
<WorkspacePopup bind:open={workspaceOpen} anchor={workspaceButton} {workspacePath} />

<style>
  .updatesButton,
  .workspaceButton {
    display: flex;
    position: relative;
    width: 100%;
    height: 44px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: var(--ui-ghost-surface);
    color: var(--ui-muted-icon-glyph);
    cursor: pointer;
  }
  .updatesButton:hover,
  .updatesButton:focus-visible,
  .updatesButton[aria-expanded='true'] { color: var(--ui-normal-text); }
  /* Brighten the mascot alongside the rail's other ghost controls on interaction. */
  .workspaceButton img { opacity: 0.8; transform: translateX(1px); }
  .workspaceButton:hover img,
  .workspaceButton:focus-visible img,
  .workspaceButton[aria-expanded='true'] img { opacity: 1; }
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
