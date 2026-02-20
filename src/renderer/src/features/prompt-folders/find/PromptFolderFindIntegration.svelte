<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import {
    buildPromptFolderFindCounts,
    buildSearchInputs,
    getPromptFolderFindSectionCountKey,
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
    PromptFolderFindItem,
    PromptFolderFindMatch,
    PromptFolderFindRowHandle,
    PromptFolderFindState
  } from './promptFolderFindTypes'

  type PromptFolderFindIntegrationProps = {
    items: PromptFolderFindItem[]
    children?: Snippet
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
  }

  let { items, children, scrollToWithinWindowBand }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let matchCountsByEntity = $state<PromptFolderFindCounts[]>([])
  let focusFindRequestId = $state(0)
  let focusRequest = $state<PromptFolderFindFocusRequest | null>(null)
  let searchRevision = $state(0)
  let lastSelectionAnchor = $state<PromptFolderFindAnchor | null>(null)
  let lastSearchInputs: SearchInputs = { queryKey: '', scopeKey: '', searchRevision: 0 }
  const trimmedQuery = $derived(matchText.trim())
  const normalizedQuery = $derived(trimmedQuery.toLowerCase())

  const hydratedEntityIds = new SvelteSet<string>()
  const sectionMatchCountsByEntitySectionKey = new SvelteMap<string, { query: string; count: number }>()
  const rowHandlesByEntityId = new SvelteMap<string, PromptFolderFindRowHandle>()
  const searchModel = createPromptFolderFindSearchModel()
  const itemByEntityId = $derived.by(() => {
    const lookup = new SvelteMap<string, PromptFolderFindItem>()
    for (const item of items) {
      lookup.set(item.entityId, item)
    }
    return lookup
  })
  const entityIds = $derived.by(() => items.map((item) => item.entityId))

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
      matchCountsByEntity = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    const nextCounts = buildPromptFolderFindCounts({
      items,
      trimmedQuery,
      hydratedEntityIds,
      sectionMatchCountsByEntitySectionKey,
      countMatchesInText: searchModel.countMatchesInText
    })
    matchCountsByEntity = nextCounts
    totalMatches = nextCounts.reduce(
      (sum, entry) => sum + entry.sectionCounts.reduce((sectionSum, section) => sectionSum + section.count, 0),
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
      : getPromptFolderFindMatchForIndex(currentMatchIndex, matchCountsByEntity)
  )

  const getItem = (entityId: string): PromptFolderFindItem | null => itemByEntityId.get(entityId) ?? null
  const getSectionText = (entityId: string, sectionKey: string): string => {
    const item = getItem(entityId)
    if (!item) return ''
    return item.sections.find((section) => section.key === sectionKey)?.text ?? ''
  }

  const revealMatch = async (match: PromptFolderFindMatch) => {
    if (!scrollToWithinWindowBand) return
    await revealPromptFolderMatch(match, {
      query: trimmedQuery,
      rowHandlesByEntityId,
      getRowIdForEntity: (entityId) => getItem(entityId)?.rowId ?? null,
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
    const targetText = getSectionText(match.entityId, match.sectionKey)
    const matchRange = findMatchRange(targetText, trimmedQuery, match.sectionMatchIndex)
    if (!matchRange) return
    recordSelectionAnchor({
      entityId: match.entityId,
      sectionKey: match.sectionKey,
      startOffset: matchRange.start,
      endOffset: matchRange.end
    })
  }

  const setCurrentMatchIndex = (nextIndex: number) => {
    currentMatchIndex = nextIndex
    const match = getPromptFolderFindMatchForIndex(nextIndex, matchCountsByEntity)
    recordSelectionFromMatch(match)
    void revealMatch(match)
  }

  const getGlobalMatchIndex = (entityId: string, sectionKey: string, matchIndex: number) => {
    let runningIndex = 0
    for (const group of matchCountsByEntity) {
      for (const section of group.sectionCounts) {
        if (group.entityId === entityId && section.sectionKey === sectionKey) {
          return runningIndex + matchIndex + 1
        }
        runningIndex += section.count
      }
    }
    return null
  }

  const findFirstMatchInItem = (item: PromptFolderFindItem) => {
    for (const section of item.sections) {
      const sectionMatchIndex = findMatchIndexAtOrAfter(section.text, trimmedQuery, 0)
      if (sectionMatchIndex == null) continue
      return { sectionKey: section.key, sectionMatchIndex }
    }
    return null
  }

  const getNextMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) => {
    if (trimmedQuery.length === 0 || totalMatches === 0) return null
    const startIndex = items.findIndex((item) => item.entityId === anchor.entityId)
    if (startIndex < 0) return null

    const startItem = items[startIndex]
    const startSectionIndex = startItem.sections.findIndex(
      (section) => section.key === anchor.sectionKey
    )
    if (startSectionIndex >= 0) {
      const startSection = startItem.sections[startSectionIndex]
      const sectionMatchIndex = findMatchIndexAtOrAfter(
        startSection.text,
        trimmedQuery,
        anchor.endOffset
      )
      if (sectionMatchIndex != null) {
        return getGlobalMatchIndex(startItem.entityId, startSection.key, sectionMatchIndex)
      }

      for (let sectionIndex = startSectionIndex + 1; sectionIndex < startItem.sections.length; sectionIndex += 1) {
        const nextSection = startItem.sections[sectionIndex]
        const nextSectionMatchIndex = findMatchIndexAtOrAfter(nextSection.text, trimmedQuery, 0)
        if (nextSectionMatchIndex == null) continue
        return getGlobalMatchIndex(startItem.entityId, nextSection.key, nextSectionMatchIndex)
      }
    }

    for (let i = startIndex + 1; i < items.length; i += 1) {
      const match = findFirstMatchInItem(items[i])
      if (!match) continue
      return getGlobalMatchIndex(items[i].entityId, match.sectionKey, match.sectionMatchIndex)
    }

    for (let i = 0; i <= startIndex; i += 1) {
      const match = findFirstMatchInItem(items[i])
      if (!match) continue
      return getGlobalMatchIndex(items[i].entityId, match.sectionKey, match.sectionMatchIndex)
    }

    return null
  }

  const findLastMatchInItem = (item: PromptFolderFindItem) => {
    for (let sectionIndex = item.sections.length - 1; sectionIndex >= 0; sectionIndex -= 1) {
      const section = item.sections[sectionIndex]
      const sectionMatchIndex = findMatchIndexBefore(
        section.text,
        trimmedQuery,
        Number.POSITIVE_INFINITY
      )
      if (sectionMatchIndex == null) continue
      return { sectionKey: section.key, sectionMatchIndex }
    }
    return null
  }

  const getPreviousMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) => {
    if (trimmedQuery.length === 0 || totalMatches === 0) return null
    const startIndex = items.findIndex((item) => item.entityId === anchor.entityId)
    if (startIndex < 0) return null

    const startItem = items[startIndex]
    const startSectionIndex = startItem.sections.findIndex(
      (section) => section.key === anchor.sectionKey
    )
    if (startSectionIndex >= 0) {
      const startSection = startItem.sections[startSectionIndex]
      const sectionMatchIndex = findMatchIndexBefore(
        startSection.text,
        trimmedQuery,
        anchor.startOffset
      )
      if (sectionMatchIndex != null) {
        return getGlobalMatchIndex(startItem.entityId, startSection.key, sectionMatchIndex)
      }

      for (let sectionIndex = startSectionIndex - 1; sectionIndex >= 0; sectionIndex -= 1) {
        const previousSection = startItem.sections[sectionIndex]
        const previousSectionMatchIndex = findMatchIndexBefore(
          previousSection.text,
          trimmedQuery,
          Number.POSITIVE_INFINITY
        )
        if (previousSectionMatchIndex == null) continue
        return getGlobalMatchIndex(
          startItem.entityId,
          previousSection.key,
          previousSectionMatchIndex
        )
      }
    }

    for (let i = startIndex - 1; i >= 0; i -= 1) {
      const match = findLastMatchInItem(items[i])
      if (!match) continue
      return getGlobalMatchIndex(items[i].entityId, match.sectionKey, match.sectionMatchIndex)
    }

    for (let i = items.length - 1; i >= startIndex; i -= 1) {
      const match = findLastMatchInItem(items[i])
      if (!match) continue
      return getGlobalMatchIndex(items[i].entityId, match.sectionKey, match.sectionMatchIndex)
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
    // Scope key guards the full rescan against changes in findable entity IDs or query.
    const nextInputs = buildSearchInputs({
      normalizedQuery,
      entityIds,
      searchRevision
    })
    if (!hasSearchInputsChanged(nextInputs, lastSearchInputs)) return

    const shouldResetSelection =
      nextInputs.queryKey !== lastSearchInputs.queryKey ||
      nextInputs.scopeKey !== lastSearchInputs.scopeKey
    runSearch(shouldResetSelection)
    lastSearchInputs = nextInputs
  })

  const clearSectionMatchCounts = (entityId: string) => {
    const keyPrefix = `${entityId}\u0000`
    for (const key of sectionMatchCountsByEntitySectionKey.keys()) {
      if (key.startsWith(keyPrefix)) {
        sectionMatchCountsByEntitySectionKey.delete(key)
      }
    }
  }

  // Track which entities are hydrated so we can prefer editor-reported counts.
  const reportHydration = (entityId: string, isHydrated: boolean) => {
    if (isHydrated) {
      hydratedEntityIds.add(entityId)
    } else {
      hydratedEntityIds.delete(entityId)
      clearSectionMatchCounts(entityId)
    }
  }

  // Receive match counts from hydrated editors and update totals incrementally.
  const reportSectionMatchCount = (
    entityId: string,
    sectionKey: string,
    query: string,
    count: number
  ) => {
    if (query !== trimmedQuery) return
    const sectionCountKey = getPromptFolderFindSectionCountKey(entityId, sectionKey)
    sectionMatchCountsByEntitySectionKey.set(sectionCountKey, { query, count })

    if (!isFindOpen) return
    // Update just the affected entity section count instead of rescanning everything.
    const groupIndex = matchCountsByEntity.findIndex((group) => group.entityId === entityId)
    if (groupIndex < 0) return

    const group = matchCountsByEntity[groupIndex]
    const sectionIndex = group.sectionCounts.findIndex((section) => section.sectionKey === sectionKey)
    if (sectionIndex < 0) return
    const section = group.sectionCounts[sectionIndex]
    if (section.count === count) return

    const nextSectionCounts = group.sectionCounts.slice()
    nextSectionCounts[sectionIndex] = { ...section, count }
    const nextGroups = matchCountsByEntity.slice()
    nextGroups[groupIndex] = { ...group, sectionCounts: nextSectionCounts }
    matchCountsByEntity = nextGroups

    totalMatches = totalMatches + (count - section.count)
    if (currentMatchIndex > totalMatches) {
      currentMatchIndex = totalMatches
    }
  }

  const registerRow = (handle: PromptFolderFindRowHandle) => {
    rowHandlesByEntityId.set(handle.entityId, handle)
    return () => {
      const current = rowHandlesByEntityId.get(handle.entityId)
      if (current === handle) {
        rowHandlesByEntityId.delete(handle.entityId)
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
    reportSectionMatchCount,
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
      getMatchTextForCurrentMatch: (match) =>
        getMatchTextForCurrentMatch(match, trimmedQuery, getSectionText),
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
