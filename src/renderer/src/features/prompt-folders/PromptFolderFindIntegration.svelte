<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import { monaco } from '@renderer/common/Monaco'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import { findMatchRange } from './promptFolderFindText'
  import type {
    PromptFolderFindFocusRequest,
    PromptFolderFindMatch,
    PromptFolderFindState
  } from './promptFolderFindTypes'

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
  let focusRequest = $state<PromptFolderFindFocusRequest | null>(null)
  let searchRevision = $state(0)
  let lastSearchInputs: SearchInputs = { queryKey: '', scopeKey: '', searchRevision: 0 }
  // Shared Monaco model for counting matches to avoid per-search model churn.
  let searchModel: monaco.editor.ITextModel | null = null
  const trimmedQuery = $derived(matchText.trim())
  const normalizedQuery = $derived(trimmedQuery.toLowerCase())

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
      focusRequest = {
        requestId: (focusRequest?.requestId ?? 0) + 1,
        match: currentMatch,
        query: trimmedQuery
      }
    }
  }

  type PromptFolderFindCounts = {
    promptId: string
    titleCount: number
    bodyCount: number
  }

  type SearchInputs = {
    queryKey: string
    scopeKey: string
    searchRevision: number
  }

  const buildSearchInputs = (): SearchInputs => ({
    queryKey: normalizedQuery,
    scopeKey: promptIds.join('|'),
    searchRevision
  })

  const hasSearchInputsChanged = (next: SearchInputs, prev: SearchInputs) =>
    next.queryKey !== prev.queryKey ||
    next.scopeKey !== prev.scopeKey ||
    next.searchRevision !== prev.searchRevision

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
  const buildMatchCounts = (): PromptFolderFindCounts[] => {
    if (trimmedQuery.length === 0) return []

    return promptIds.map((promptId) => {
      const promptData = getPromptData(promptId)
      const title = promptData.draft.title
      const text = promptData.draft.text
      const titleCount = countMatchesInText(title, trimmedQuery)

      let bodyCount = 0
      if (hydratedPromptIds.has(promptId)) {
        const tracked = bodyMatchCountsByPromptId.get(promptId)
        if (tracked?.query === trimmedQuery) {
          bodyCount = tracked.count
        } else {
          bodyCount = countMatchesInText(text, trimmedQuery)
        }
      } else {
        bodyCount = countMatchesInText(text, trimmedQuery)
      }

      return {
        promptId,
        titleCount,
        bodyCount
      }
    })
  }

  // Run a full search pass and update derived counts/indexes.
  const runSearch = (resetSelection: boolean) => {
    if (trimmedQuery.length === 0) {
      matchCountsByPrompt = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    const nextCounts = buildMatchCounts()
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
  ): PromptFolderFindMatch => {
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
    throw new Error('Match index out of range')
  }

  // Derived current match based on the 1-based index and grouped counts.
  const currentMatch = $derived.by(() =>
    currentMatchIndex <= 0 ? null : getMatchForIndex(currentMatchIndex, matchCountsByPrompt)
  )

  const getMatchTextForCurrentMatch = (match: PromptFolderFindMatch | null) => {
    if (!match) return null
    if (trimmedQuery.length === 0) return null

    const promptData = getPromptData(match.promptId)
    const targetText = match.kind === 'title' ? promptData.draft.title : promptData.draft.text
    const matchIndex = match.kind === 'title' ? match.titleMatchIndex : match.bodyMatchIndex

    const matchRange = findMatchRange(targetText, trimmedQuery, matchIndex)
    if (!matchRange) return null

    return targetText.slice(matchRange.start, matchRange.end)
  }

  // Placeholder for auto-revealing the selected match in the virtual list.
  const revealMatch = (match: PromptFolderFindMatch) => {
    void match
    // TODO: scroll the virtual window so the active match is visible.
  }

  const setCurrentMatchIndex = (nextIndex: number) => {
    currentMatchIndex = nextIndex
    revealMatch(getMatchForIndex(nextIndex, matchCountsByPrompt))
  }

  // Move selection to the previous match and reveal it.
  const handlePrevious = () => {
    if (totalMatches === 0) return
    const nextIndex =
      currentMatchIndex <= 1 ? totalMatches : Math.max(1, currentMatchIndex - 1)
    setCurrentMatchIndex(nextIndex)
  }

  // Move selection to the next match and reveal it.
  const handleNext = () => {
    if (totalMatches === 0) return
    const nextIndex =
      currentMatchIndex <= 0 || currentMatchIndex >= totalMatches
        ? 1
        : currentMatchIndex + 1
    setCurrentMatchIndex(nextIndex)
  }

  // Side effect: refresh the placeholder search state while the find widget is open.
  $effect(() => {
    if (!isFindOpen) return
    // Scope key guards the full rescan against changes in prompt IDs or query.
    const nextInputs = buildSearchInputs()
    if (!hasSearchInputsChanged(nextInputs, lastSearchInputs)) return

    const shouldResetSelection =
      nextInputs.queryKey !== lastSearchInputs.queryKey ||
      nextInputs.scopeKey !== lastSearchInputs.scopeKey
    runSearch(shouldResetSelection)
    lastSearchInputs = nextInputs
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

    totalMatches = totalMatches + (count - group.bodyCount)
    if (currentMatchIndex > totalMatches) {
      currentMatchIndex = totalMatches
    }
  }

  const findState = $state<PromptFolderFindState>({
    isFindOpen: false,
    query: '',
    currentMatch: null,
    focusRequest: null,
    reportHydration,
    reportBodyMatchCount
  })

  // Side effect: keep the find context in sync with the local widget state.
  $effect(() => {
    findState.isFindOpen = isFindOpen
    findState.query = matchText
    findState.currentMatch = currentMatch
    findState.focusRequest = focusRequest
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
        const nextMatchText = getMatchTextForCurrentMatch(currentMatch)
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
