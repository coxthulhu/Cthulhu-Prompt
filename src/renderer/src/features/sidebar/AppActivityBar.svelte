<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import ActivityBarButton from '@renderer/common/cthulhu-ui/ActivityBarButton.svelte'

  let {
    activeScreen,
    isDevMode = false,
    onNavigate
  } = $props<{
    activeScreen: ScreenId
    isDevMode?: boolean
    onNavigate: (screen: ScreenId) => void
  }>()

  type ActivityItem = {
    id: ScreenId
    label: string
    icon: ComponentType
    testId: string
  }

  const activityScreenOrder: ScreenId[] = ['home', 'settings', 'mockups', 'test-screen']
  const activityItems = $derived<ActivityItem[]>(
    activityScreenOrder
      .map((screenId) => {
        const config = screens[screenId]
        if (!config.showInNav || (config.devOnly && !isDevMode) || !config.icon) {
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
      title={item.label}
      testId={item.testId}
      class="appActivityBarButton"
      active={activeScreen === item.id}
      ariaCurrent={activeScreen === item.id ? 'page' : undefined}
      onclick={() => onNavigate(item.id)}
    />
  {/each}
</nav>
