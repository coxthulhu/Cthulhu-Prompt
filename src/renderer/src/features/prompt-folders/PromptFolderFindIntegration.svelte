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
  let matchCountsByPrompt = $state<PromptFolderFindCounts[]>([])
  let focusFindRequestId = $state(0)
  let focusMatchRequestId = $state(0)
  let focusMatch = $state<PromptFolderFindMatch | null>(null)
  let focusMatchQuery = $state('')
  let searchRevision = $state(0)
  let lastQueryKey = ''
  let lastScopeKey = ''
  let lastSearchRevision = 0
  // Shared Monaco model for counting matches to avoid per-search model churn.
  let searchModel: monaco.editor.ITextModel | null = null

  const hydratedPromptIds = new SvelteSet<string>()
  const bodyMatchCountsByPromptId = new SvelteMap<string, { query: string; count: number }>()

  // Show the widget and request a fresh scan for the current query.
  const openFindDialog = () => {
    if (!isFindOpen) {
      isFindOpen = true
      searchRevision += 1
    }
    focusFindRequestId += 1
  }

  // Close the widget and return focus to the current match.
  const closeFindDialog = () => {
    isFindOpen = false
    if (currentMatch) {
      focusMatch = currentMatch
      focusMatchQuery = matchText.trim()
      focusMatchRequestId += 1
    }
  }

  type PromptFolderFindCounts = {
    promptId: string
    titleCount: number
    bodyCount: number
  }

  // Snapshot the prompt data used by the current search run.
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

  // Lazily initialize and return the shared search model.
  const getSearchModel = () => {
    if (!searchModel) {
      searchModel = monaco.editor.createModel('', 'plaintext')
    }
    return searchModel
  }

  // Count matches in a string using the shared Monaco model.
  const countMatchesInText = (text: string, query: string): number => {
    if (query.length === 0) return 0
    const model = getSearchModel()
    model.setValue(text)
    return model.findMatches(query, false, false, false, null, false).length
  }

  // Build aggregated match counts per prompt instead of per-match entries.
  const buildMatchCounts = (query: string): PromptFolderFindCounts[] => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return []

    const scope = buildSearchScope()
    return scope.map((entry) => {
      const titleCount = countMatchesInText(entry.title, trimmedQuery)

      let bodyCount = 0
      if (hydratedPromptIds.has(entry.id)) {
        const tracked = bodyMatchCountsByPromptId.get(entry.id)
        if (tracked?.query === trimmedQuery) {
          bodyCount = tracked.count
        } else {
          bodyCount = countMatchesInText(entry.text, trimmedQuery)
        }
      } else {
        bodyCount = countMatchesInText(entry.text, trimmedQuery)
      }

      return {
        promptId: entry.id,
        titleCount,
        bodyCount
      }
    })
  }

  // Run a full search pass and update derived counts/indexes.
  const runSearch = (trimmedQuery: string, resetSelection: boolean) => {
    if (trimmedQuery.length === 0) {
      matchCountsByPrompt = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    const nextCounts = buildMatchCounts(trimmedQuery)
    matchCountsByPrompt = nextCounts
    totalMatches = nextCounts.reduce(
      (sum, entry) => sum + entry.titleCount + entry.bodyCount,
      0
    )

    if (resetSelection) {
      currentMatchIndex = 0
      return
    }

    if (currentMatchIndex > totalMatches) {
      currentMatchIndex = totalMatches
    }
    if (currentMatchIndex < 0) {
      currentMatchIndex = 0
    }
  }

  // Map a 1-based match index into the grouped counts without allocating per-match entries.
  const getMatchForIndex = (
    matchIndex: number,
    groups: PromptFolderFindCounts[]
  ): PromptFolderFindMatch | null => {
    if (matchIndex <= 0) return null
    let remaining = matchIndex
    for (const group of groups) {
      if (remaining <= group.titleCount) {
        return {
          promptId: group.promptId,
          kind: 'title',
          titleMatchIndex: remaining - 1
        }
      }
      remaining -= group.titleCount
      if (remaining <= group.bodyCount) {
        return {
          promptId: group.promptId,
          kind: 'body',
          bodyMatchIndex: remaining - 1
        }
      }
      remaining -= group.bodyCount
    }
    return null
  }

  // Derived current match based on the 1-based index and grouped counts.
  const currentMatch = $derived.by(() => {
    if (currentMatchIndex <= 0) return null
    return getMatchForIndex(currentMatchIndex, matchCountsByPrompt)
  })

  const findMatchStartIndex = (text: string, query: string, matchIndex: number): number | null => {
    if (query.length === 0 || matchIndex < 0) return null
    const normalizedText = text.toLowerCase()
    const normalizedQuery = query.toLowerCase()
    let startIndex = -1
    let fromIndex = 0

    for (let i = 0; i <= matchIndex; i += 1) {
      startIndex = normalizedText.indexOf(normalizedQuery, fromIndex)
      if (startIndex < 0) return null
      fromIndex = startIndex + normalizedQuery.length
    }

    return startIndex
  }

  const getMatchTextForCurrentMatch = (match: PromptFolderFindMatch | null, query: string) => {
    if (!match) return null
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return null

    const promptData = getPromptData(match.promptId)
    const targetText = match.kind === 'title' ? promptData.draft.title : promptData.draft.text
    const matchIndex = match.kind === 'title' ? match.titleMatchIndex : match.bodyMatchIndex

    const startIndex = findMatchStartIndex(targetText, trimmedQuery, matchIndex)
    if (startIndex == null) return null

    return targetText.slice(startIndex, startIndex + trimmedQuery.length)
  }

  // Placeholder for auto-revealing the selected match in the virtual list.
  const revealMatch = (match: PromptFolderFindMatch) => {
    void match
    // TODO: scroll the virtual window so the active match is visible.
  }

  const setCurrentMatchIndex = (nextIndex: number) => {
    currentMatchIndex = nextIndex
    revealMatch(getMatchForIndex(nextIndex, matchCountsByPrompt)!)
  }

  // Move selection to the previous match and reveal it.
  const handlePrevious = () => {
    if (totalMatches === 0 || matchText.trim().length === 0) return
    const nextIndex =
      currentMatchIndex <= 1 ? totalMatches : Math.max(1, currentMatchIndex - 1)
    setCurrentMatchIndex(nextIndex)
  }

  // Move selection to the next match and reveal it.
  const handleNext = () => {
    if (totalMatches === 0 || matchText.trim().length === 0) return
    const nextIndex =
      currentMatchIndex <= 0 || currentMatchIndex >= totalMatches
        ? 1
        : currentMatchIndex + 1
    setCurrentMatchIndex(nextIndex)
  }

  // Side effect: refresh the placeholder search state while the find widget is open.
  $effect(() => {
    if (!isFindOpen) return
    const trimmedQuery = matchText.trim()
    const queryKey = trimmedQuery.toLowerCase()
    // Scope key guards the full rescan against changes in prompt IDs or query.
    const scopeKey = promptIds.join('|')
    const queryChanged = queryKey !== lastQueryKey
    const scopeChanged = scopeKey !== lastScopeKey
    const refreshRequested = searchRevision !== lastSearchRevision

    if (!queryChanged && !scopeChanged && !refreshRequested) return

    runSearch(trimmedQuery, queryChanged || scopeChanged)
    lastQueryKey = queryKey
    lastScopeKey = scopeKey
    lastSearchRevision = searchRevision
  })

  // Track which prompts are hydrated so we can prefer editor-reported counts.
  const reportHydration = (promptId: string, isHydrated: boolean) => {
    if (isHydrated) {
      hydratedPromptIds.add(promptId)
    } else {
      hydratedPromptIds.delete(promptId)
      bodyMatchCountsByPromptId.delete(promptId)
    }
  }

  // Receive match counts from hydrated editors and update totals incrementally.
  const reportBodyMatchCount = (promptId: string, query: string, count: number) => {
    const trimmedQuery = matchText.trim()
    if (query !== trimmedQuery) return
    bodyMatchCountsByPromptId.set(promptId, { query, count })

    if (!isFindOpen) return
    // Update just the affected prompt counts instead of rescanning everything.
    const groupIndex = matchCountsByPrompt.findIndex((group) => group.promptId === promptId)
    if (groupIndex < 0) return

    const group = matchCountsByPrompt[groupIndex]
    if (group.bodyCount === count) return

    const nextGroups = matchCountsByPrompt.slice()
    nextGroups[groupIndex] = { ...group, bodyCount: count }
    matchCountsByPrompt = nextGroups

    totalMatches = Math.max(0, totalMatches + (count - group.bodyCount))
    if (currentMatchIndex > totalMatches) {
      currentMatchIndex = totalMatches
    }
  }

  const findState = $state<PromptFolderFindState>({
    isFindOpen: false,
    query: '',
    currentMatch: null,
    focusMatchRequestId: 0,
    focusMatch: null,
    focusMatchQuery: '',
    reportHydration,
    reportBodyMatchCount
  })

  // Side effect: keep the find context in sync with the local widget state.
  $effect(() => {
    findState.isFindOpen = isFindOpen
    findState.query = matchText
    findState.currentMatch = currentMatch
    findState.focusMatchRequestId = focusMatchRequestId
    findState.focusMatch = focusMatch
    findState.focusMatchQuery = focusMatchQuery
  })

  setPromptFolderFindContext(findState)

  // Side effect: capture global find/escape shortcuts while the prompt folder screen is active.
  onMount(() => {
    // Handle global find/escape shortcuts while the widget is mounted.
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
        const nextMatchText = getMatchTextForCurrentMatch(currentMatch, matchText)
        if (nextMatchText && nextMatchText !== matchText) {
          matchText = nextMatchText
        }
        openFindDialog()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
      // Side effect: dispose the shared Monaco find model on teardown.
      searchModel?.dispose()
      searchModel = null
    }
  })
</script>

{@render children?.()}

{#if isFindOpen}
  <PromptFolderFindWidget
    bind:matchText
    focusRequestId={focusFindRequestId}
    {totalMatches}
    {currentMatchIndex}
    onClose={closeFindDialog}
    onPrevious={handlePrevious}
    onNext={handleNext}
  />
{/if}
