<script lang="ts">
  import { onMount } from 'svelte'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'

  type PromptFolderFindIntegrationProps = {
    promptIds: string[]
  }

  let { promptIds }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)

  const openFindDialog = () => {
    isFindOpen = true
  }

  const closeFindDialog = () => {
    isFindOpen = false
  }

  const buildSearchScope = () => {
    return promptIds.map((promptId) => {
      const promptData = getPromptData(promptId)
      return {
        id: promptId,
        title: promptData.draft.title,
        text: promptData.draft.text
      }
    })
  }

  const runSearch = (query: string) => {
    // TODO: implement prompt title/text search + match bookkeeping.
    const trimmedQuery = query.trim()
    buildSearchScope()
    totalMatches = 0
    currentMatchIndex = trimmedQuery.length > 0 ? 0 : 0
  }

  const handlePrevious = () => {
    // TODO: step to the previous match and reveal/highlight it.
  }

  const handleNext = () => {
    // TODO: step to the next match and reveal/highlight it.
  }

  // Side effect: refresh the placeholder search state while the find widget is open.
  $effect(() => {
    if (!isFindOpen) return
    runSearch(matchText)
  })

  // Side effect: capture global find/escape shortcuts while the prompt folder screen is active.
  onMount(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isFindOpen) return
        event.preventDefault()
        event.stopPropagation()
        closeFindDialog()
        return
      }

      if (
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault()
        event.stopPropagation()
        openFindDialog()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
    }
  })
</script>

{#if isFindOpen}
  <PromptFolderFindWidget
    bind:matchText
    {totalMatches}
    {currentMatchIndex}
    onClose={closeFindDialog}
    onPrevious={handlePrevious}
    onNext={handleNext}
  />
{/if}
