<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
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
  import type { ScrollToWithinWindowBand } from '../../virtualizer/virtualWindowTypes'
  import { revealPromptFolderMatch } from './promptFolderFindReveal'
  import {
    findMatchIndexAtOrAfter,
    findMatchIndexBefore,
    findMatchRange
  } from './promptFolderFindText'
  import type {
    PromptFolderFindAnchor,
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

  let { promptIds, children, scrollToWithinWindowBand }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let matchCountsByPrompt = $state<PromptFolderFindCounts[]>([])
  let focusFindRequestId = $state(0)
  let focusRequest = $state<PromptFolderFindFocusRequest | null>(null)
  let searchRevision = $state(0)
  let lastSelectionAnchor = $state<PromptFolderFindAnchor | null>(null)
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
    totalMatches = nextCounts.reduce((sum, entry) => sum + entry.titleCount + entry.bodyCount, 0)

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

  const recordSelectionAnchor = (anchor: PromptFolderFindAnchor) => {
    const startOffset = Math.min(anchor.startOffset, anchor.endOffset)
    const endOffset = Math.max(anchor.startOffset, anchor.endOffset)
    lastSelectionAnchor = { ...anchor, startOffset, endOffset }
  }

  const recordSelectionFromMatch = (match: PromptFolderFindMatch) => {
    if (trimmedQuery.length === 0) return
    const promptData = getPromptData(match.promptId)
    const targetText = match.kind === 'title' ? promptData.draft.title : promptData.draft.text
    const matchIndex = match.kind === 'title' ? match.titleMatchIndex : match.bodyMatchIndex
    const matchRange = findMatchRange(targetText, trimmedQuery, matchIndex)
    if (!matchRange) return
    recordSelectionAnchor({
      promptId: match.promptId,
      kind: match.kind,
      startOffset: matchRange.start,
      endOffset: matchRange.end
    })
  }

  const setCurrentMatchIndex = (nextIndex: number) => {
    currentMatchIndex = nextIndex
    const match = getPromptFolderFindMatchForIndex(nextIndex, matchCountsByPrompt)
    recordSelectionFromMatch(match)
    void revealMatch(match)
  }

  const getGlobalMatchIndex = (promptId: string, kind: 'title' | 'body', matchIndex: number) => {
    let runningIndex = 0
    for (const group of matchCountsByPrompt) {
      if (group.promptId === promptId) {
        if (kind === 'title') {
          return runningIndex + matchIndex + 1
        }
        runningIndex += group.titleCount
        if (kind === 'body') {
          return runningIndex + matchIndex + 1
        }
      }
      runningIndex += group.titleCount + group.bodyCount
    }
    return null
  }

  const findFirstMatchInPrompt = (promptId: string) => {
    const promptData = getPromptData(promptId)
    const titleIndex = findMatchIndexAtOrAfter(promptData.draft.title, trimmedQuery, 0)
    if (titleIndex != null) {
      return { kind: 'title' as const, matchIndex: titleIndex }
    }
    const bodyIndex = findMatchIndexAtOrAfter(promptData.draft.text, trimmedQuery, 0)
    if (bodyIndex != null) {
      return { kind: 'body' as const, matchIndex: bodyIndex }
    }
    return null
  }

  const getNextMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) => {
    if (trimmedQuery.length === 0 || totalMatches === 0) return null
    const startIndex = promptIds.indexOf(anchor.promptId)
    if (startIndex < 0) return null

    const promptData = getPromptData(anchor.promptId)
    if (anchor.kind === 'title') {
      const titleIndex = findMatchIndexAtOrAfter(
        promptData.draft.title,
        trimmedQuery,
        anchor.endOffset
      )
      if (titleIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'title', titleIndex)
      }
      const bodyIndex = findMatchIndexAtOrAfter(promptData.draft.text, trimmedQuery, 0)
      if (bodyIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'body', bodyIndex)
      }
    } else {
      const bodyIndex = findMatchIndexAtOrAfter(
        promptData.draft.text,
        trimmedQuery,
        anchor.endOffset
      )
      if (bodyIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'body', bodyIndex)
      }
    }

    for (let i = startIndex + 1; i < promptIds.length; i += 1) {
      const match = findFirstMatchInPrompt(promptIds[i])
      if (!match) continue
      return getGlobalMatchIndex(promptIds[i], match.kind, match.matchIndex)
    }

    for (let i = 0; i <= startIndex; i += 1) {
      const match = findFirstMatchInPrompt(promptIds[i])
      if (!match) continue
      return getGlobalMatchIndex(promptIds[i], match.kind, match.matchIndex)
    }

    return null
  }

  const findLastMatchInPrompt = (promptId: string) => {
    const promptData = getPromptData(promptId)
    const bodyIndex = findMatchIndexBefore(
      promptData.draft.text,
      trimmedQuery,
      Number.POSITIVE_INFINITY
    )
    if (bodyIndex != null) {
      return { kind: 'body' as const, matchIndex: bodyIndex }
    }
    const titleIndex = findMatchIndexBefore(
      promptData.draft.title,
      trimmedQuery,
      Number.POSITIVE_INFINITY
    )
    if (titleIndex != null) {
      return { kind: 'title' as const, matchIndex: titleIndex }
    }
    return null
  }

  const getPreviousMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) => {
    if (trimmedQuery.length === 0 || totalMatches === 0) return null
    const startIndex = promptIds.indexOf(anchor.promptId)
    if (startIndex < 0) return null

    const promptData = getPromptData(anchor.promptId)
    if (anchor.kind === 'body') {
      const bodyIndex = findMatchIndexBefore(
        promptData.draft.text,
        trimmedQuery,
        anchor.startOffset
      )
      if (bodyIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'body', bodyIndex)
      }
      const titleIndex = findMatchIndexBefore(
        promptData.draft.title,
        trimmedQuery,
        Number.POSITIVE_INFINITY
      )
      if (titleIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'title', titleIndex)
      }
    } else {
      const titleIndex = findMatchIndexBefore(
        promptData.draft.title,
        trimmedQuery,
        anchor.startOffset
      )
      if (titleIndex != null) {
        return getGlobalMatchIndex(anchor.promptId, 'title', titleIndex)
      }
    }

    for (let i = startIndex - 1; i >= 0; i -= 1) {
      const match = findLastMatchInPrompt(promptIds[i])
      if (!match) continue
      return getGlobalMatchIndex(promptIds[i], match.kind, match.matchIndex)
    }

    for (let i = promptIds.length - 1; i >= startIndex; i -= 1) {
      const match = findLastMatchInPrompt(promptIds[i])
      if (!match) continue
      return getGlobalMatchIndex(promptIds[i], match.kind, match.matchIndex)
    }

    return null
  }

  // Move selection to the previous match and reveal it.
  const handlePrevious = () => {
    if (totalMatches === 0) return
    const anchorIndex = lastSelectionAnchor
      ? getPreviousMatchIndexFromAnchor(lastSelectionAnchor)
      : null
    const nextIndex =
      anchorIndex ?? (currentMatchIndex <= 1 ? totalMatches : Math.max(1, currentMatchIndex - 1))
    setCurrentMatchIndex(nextIndex)
  }

  // Move selection to the next match and reveal it.
  const handleNext = () => {
    if (totalMatches === 0) return
    const anchorIndex = lastSelectionAnchor
      ? getNextMatchIndexFromAnchor(lastSelectionAnchor)
      : null
    const nextIndex =
      anchorIndex ??
      (currentMatchIndex <= 0 || currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1)
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
    reportSelection: recordSelectionAnchor,
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
