<script lang="ts">
  import { onMount } from 'svelte'
  import { QueryClientProvider } from '@tanstack/svelte-query'

  import { queryClient } from './api/queryClient'
  import AppShell from './app/AppShell.svelte'

  let resizeTimeoutId: number | null = null

  const scheduleTransitionRestore = () => {
    if (resizeTimeoutId !== null) {
      window.clearTimeout(resizeTimeoutId)
    }
    resizeTimeoutId = window.setTimeout(() => {
      resizeTimeoutId = null
      if (document.body.style.cursor === 'ew-resize') {
        scheduleTransitionRestore()
        return
      }
      document.documentElement.style.removeProperty('--disable-transitions')
    }, 150)
  }

  // Side effect: temporarily disable transitions during window resizes to avoid animation lag.
  onMount(() => {
    const handleWindowResize = () => {
      document.documentElement.style.setProperty('--disable-transitions', '0s')
      scheduleTransitionRestore()
    }

    window.addEventListener('resize', handleWindowResize)
    return () => {
      window.removeEventListener('resize', handleWindowResize)
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId)
        resizeTimeoutId = null
      }
    }
  })
</script>

<svelte:head>
  <title>Cthulhu Prompt</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
  <AppShell />
</QueryClientProvider>
