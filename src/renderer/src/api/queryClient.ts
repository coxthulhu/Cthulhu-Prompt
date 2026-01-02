import { QueryClient } from '@tanstack/svelte-query'

// Shared query client mirrors the legacy React defaults so behavior stays consistent.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    },
    mutations: {
      networkMode: 'always',
      retry: 0
    }
  }
})
