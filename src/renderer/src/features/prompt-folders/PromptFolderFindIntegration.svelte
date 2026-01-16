<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import { monaco } from '@renderer/common/Monaco'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import type { PromptFolderFindMatch, PromptFolderFindState } from './promptFolderFindTypes'

  type PromptFolderFindIntegrationProps = {
    promptIds: string[]
    children?: Snippet
  }

  let { promptIds, children }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let lastQuery = $state('')
  let matches = $state<PromptFolderFindMatch[]>([])

  const hydratedPromptIds = new SvelteSet<string>()
  const bodyMatchCountsByPromptId = new SvelteMap<string, { query: string; count: number }>()

  const openFindDialog = () => {
    isFindOpen = true
    currentMatchIndex = 0
  }

  const closeFindDialog = () => {
    isFindOpen = false
    currentMatchIndex = 0
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

  const countMatchesInText = (text: string, query: string): number => {
    if (query.length === 0) return 0
    const model = monaco.editor.createModel(text, 'plaintext')
    try {
      return model.findMatches(query, false, false, false, null, false).length
    } finally {
      model.dispose()
    }
  }

  const buildMatchList = (query: string): PromptFolderFindMatch[] => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return []

    const scope = buildSearchScope()
    const nextMatches: PromptFolderFindMatch[] = []

    scope.forEach((entry) => {
      const titleMatches = countMatchesInText(entry.title, trimmedQuery)
      for (let i = 0; i < titleMatches; i += 1) {
        nextMatches.push({ promptId: entry.id, kind: 'title' })
      }

      let bodyMatchCount = 0
      if (hydratedPromptIds.has(entry.id)) {
        const tracked = bodyMatchCountsByPromptId.get(entry.id)
        if (tracked?.query === trimmedQuery) {
          bodyMatchCount = tracked.count
        }
      } else {
        bodyMatchCount = countMatchesInText(entry.text, trimmedQuery)
      }

      for (let i = 0; i < bodyMatchCount; i += 1) {
        nextMatches.push({
          promptId: entry.id,
          kind: 'body',
          bodyMatchIndex: i
        })
      }
    })

    return nextMatches
  }

  const runSearch = (query: string, resetSelection: boolean) => {
    const trimmedQuery = query.trim()
    const nextMatches = buildMatchList(trimmedQuery)
    matches = nextMatches
    totalMatches = nextMatches.length

    if (trimmedQuery.length === 0) {
      currentMatchIndex = 0
      lastQuery = trimmedQuery
      return
    }

    if (resetSelection) {
      currentMatchIndex = 0
      lastQuery = trimmedQuery
      return
    }

    if (currentMatchIndex > totalMatches) {
      currentMatchIndex = totalMatches
    }
    if (currentMatchIndex < 0) {
      currentMatchIndex = 0
    }

    lastQuery = trimmedQuery
  }

  const currentMatch = $derived.by(() => {
    if (currentMatchIndex <= 0) return null
    return matches[currentMatchIndex - 1] ?? null
  })

  const revealMatch = (match: PromptFolderFindMatch) => {
    void match
    // TODO: scroll the virtual window so the active match is visible.
  }

  const handlePrevious = () => {
    if (totalMatches === 0 || matchText.trim().length === 0) return
    const nextIndex =
      currentMatchIndex <= 1 ? totalMatches : Math.max(1, currentMatchIndex - 1)
    currentMatchIndex = nextIndex
    revealMatch(matches[nextIndex - 1])
  }

  const handleNext = () => {
    if (totalMatches === 0 || matchText.trim().length === 0) return
    const nextIndex =
      currentMatchIndex <= 0 || currentMatchIndex >= totalMatches
        ? 1
        : currentMatchIndex + 1
    currentMatchIndex = nextIndex
    revealMatch(matches[nextIndex - 1])
  }

  // Side effect: refresh the placeholder search state while the find widget is open.
  $effect(() => {
    if (!isFindOpen) return
    const trimmedQuery = matchText.trim()
    const shouldResetSelection = trimmedQuery !== lastQuery
    runSearch(matchText, shouldResetSelection)
    void promptIds
  })

  const reportHydration = (promptId: string, isHydrated: boolean) => {
    if (isHydrated) {
      hydratedPromptIds.add(promptId)
    } else {
      hydratedPromptIds.delete(promptId)
      bodyMatchCountsByPromptId.delete(promptId)
    }

    if (!isFindOpen) return
    runSearch(matchText, false)
  }

  const reportBodyMatchCount = (promptId: string, query: string, count: number) => {
    const trimmedQuery = matchText.trim()
    if (query !== trimmedQuery) return
    bodyMatchCountsByPromptId.set(promptId, { query, count })

    if (!isFindOpen) return
    runSearch(matchText, false)
  }

  const findState = $state<PromptFolderFindState>({
    isFindOpen: false,
    query: '',
    currentMatch: null,
    reportHydration,
    reportBodyMatchCount
  })

  // Side effect: keep the find context in sync with the local widget state.
  $effect(() => {
    findState.isFindOpen = isFindOpen
    findState.query = matchText
    findState.currentMatch = currentMatch
  })

  setPromptFolderFindContext(findState)

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

{@render children?.()}

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
