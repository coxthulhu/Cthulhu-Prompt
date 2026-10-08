<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import ActivityBarButton from '@renderer/common/cthulhu-ui/buttons/ActivityBarButton.svelte'
  import { Download } from 'lucide-svelte'

  let {
    activeScreen,
    isAppSidebarExpanded,
    isWorkspaceReady = false,
    isDevMode = false,
    onNavigate,
    updatesOpen,
    updateAvailable,
    onToggleUpdates
  } = $props<{
    activeScreen: ScreenId
    isAppSidebarExpanded: boolean
    isWorkspaceReady?: boolean
    isDevMode?: boolean
    onNavigate: (screen: ScreenId) => void
    /** Reflects the updater popup independently of screen navigation. */
    updatesOpen: boolean
    /** Shows a notification dot while a newer public release exists. */
    updateAvailable: boolean
    /** Toggles the shell-owned updater surface. */
    onToggleUpdates: () => void
  }>()

  type ActivityItem = {
    id: ScreenId
    label: string
    icon: ComponentType
    testId: string
  }

  const activityScreenOrder: ScreenId[] = [
    'home',
    'prompt-task-folders',
    'prompt-template-folders',
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

<nav class="appActivityBar" aria-label="Primary navigation" data-testid="app-activity-bar">
  {#each activityItems as item (item.id)}
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
  {/each}
  <div class="mt-auto w-full relative">
    <button type="button" class="updatesButton" aria-label={updateAvailable ? 'App updates — update available' : 'App updates'}
      aria-expanded={updatesOpen} title="App updates" data-testid="app-updates-button" onclick={onToggleUpdates}>
      <Download size={24} strokeWidth={1.5} aria-hidden="true" />
      {#if updateAvailable}<span class="updateDot" data-testid="update-available-dot"></span>{/if}
    </button>
  </div>
</nav>

<style>
  .updatesButton {
    display: flex;
    position: relative;
    width: 100%;
    height: 44px;
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
