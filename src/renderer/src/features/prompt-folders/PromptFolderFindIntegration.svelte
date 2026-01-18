<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import {
    buildPromptFolderFindCounts,
    buildSearchInputs,
    getMatchTextForCurrentMatch,
    getPromptFolderFindMatchForIndex,
    hasSearchInputsChanged,
    type PromptFolderFindCounts,
    type SearchInputs
  } from './promptFolderFindSearch'
  import { createPromptFolderFindSearchModel } from './promptFolderFindSearchModel'
  import { registerPromptFolderFindShortcuts } from './promptFolderFindShortcuts'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { revealPromptFolderMatch } from './promptFolderFindReveal'
  import type {
    PromptFolderFindFocusRequest,
    PromptFolderFindMatch,
    PromptFolderFindRowHandle,
    PromptFolderFindState
  } from './promptFolderFindTypes'

  type PromptFolderFindIntegrationProps = {
    promptIds: string[]
    children?: Snippet
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
  }

  let {
    promptIds,
    children,
    scrollToWithinWindowBand
  }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let matchCountsByPrompt = $state<PromptFolderFindCounts[]>([])
  let focusFindRequestId = $state(0)
  let focusRequest = $state<PromptFolderFindFocusRequest | null>(null)
  let searchRevision = $state(0)
  let lastSearchInputs: SearchInputs = { queryKey: '', scopeKey: '', searchRevision: 0 }
  const trimmedQuery = $derived(matchText.trim())
  const normalizedQuery = $derived(trimmedQuery.toLowerCase())

  const hydratedPromptIds = new SvelteSet<string>()
  const bodyMatchCountsByPromptId = new SvelteMap<string, { query: string; count: number }>()
  const rowHandlesByPromptId = new SvelteMap<string, PromptFolderFindRowHandle>()
  const searchModel = createPromptFolderFindSearchModel()

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

  // Run a full search pass and update derived counts/indexes.
  const runSearch = (resetSelection: boolean) => {
    if (trimmedQuery.length === 0) {
      matchCountsByPrompt = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    const nextCounts = buildPromptFolderFindCounts({
      promptIds,
      trimmedQuery,
      hydratedPromptIds,
      bodyMatchCountsByPromptId,
      countMatchesInText: searchModel.countMatchesInText
    })
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

  // Derived current match based on the 1-based index and grouped counts.
  const currentMatch = $derived.by(() =>
    currentMatchIndex <= 0
      ? null
      : getPromptFolderFindMatchForIndex(currentMatchIndex, matchCountsByPrompt)
  )

  const revealMatch = async (match: PromptFolderFindMatch) => {
    if (!scrollToWithinWindowBand) return
    await revealPromptFolderMatch(match, {
      query: trimmedQuery,
      rowHandlesByPromptId,
      scrollToWithinWindowBand,
      waitForRows: () => tick()
    })
  }

  const setCurrentMatchIndex = (nextIndex: number) => {
    currentMatchIndex = nextIndex
    void revealMatch(getPromptFolderFindMatchForIndex(nextIndex, matchCountsByPrompt))
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
    const nextInputs = buildSearchInputs({
      normalizedQuery,
      promptIds,
      searchRevision
    })
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

  const registerRow = (handle: PromptFolderFindRowHandle) => {
    rowHandlesByPromptId.set(handle.promptId, handle)
    return () => {
      const current = rowHandlesByPromptId.get(handle.promptId)
      if (current === handle) {
        rowHandlesByPromptId.delete(handle.promptId)
      }
    }
  }

  const findState = $state<PromptFolderFindState>({
    isFindOpen: false,
    query: '',
    currentMatch: null,
    focusRequest: null,
    reportHydration,
    reportBodyMatchCount,
    registerRow
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
    const unregisterShortcuts = registerPromptFolderFindShortcuts({
      getIsFindOpen: () => isFindOpen,
      getCurrentMatch: () => currentMatch,
      getMatchText: () => matchText,
      setMatchText: (value) => {
        matchText = value
      },
      getMatchTextForCurrentMatch: (match) => getMatchTextForCurrentMatch(match, trimmedQuery),
      openFindDialog,
      closeFindDialog
    })

    return () => {
      unregisterShortcuts()
      // Side effect: dispose the shared Monaco find model on teardown.
      searchModel.dispose()
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
