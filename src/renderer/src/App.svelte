<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query'

  import { queryClient } from './api/queryClient'
  import AppShell from './app/AppShell.svelte'
</script>

<svelte:head>
  <title>Cthulhu Prompt</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
  <AppShell />
</QueryClientProvider>
