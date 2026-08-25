<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import PromptFolderFindWidget from './PromptFolderFindWidget.svelte'
  import { setPromptFolderFindContext } from './promptFolderFindContext'
  import {
    buildPromptFolderFindCounts,
    buildSearchInputs,
    getPromptFolderFindMatchForIndex,
    hasSearchInputsChanged,
    type PromptFolderFindCounts,
    type SearchInputs
  } from './promptFolderFindSearch'
  import { createPromptFolderFindSearchModel } from './promptFolderFindSearchModel'
  import { registerPromptFolderFindShortcuts } from './promptFolderFindShortcuts'
  import type { ScrollToWithinWindowBand } from '../../virtualizer/virtualWindowTypes'
  import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
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
    PromptFolderFindRevealRequest,
    PromptFolderFindRowHandle,
    PromptFolderFindState
  } from './promptFolderFindTypes'

  type PromptFolderFindIntegrationProps = {
    items: PromptFolderFindItem[]
    children?: Snippet<[PromptFolderFindControls]>
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
    onRevealMatch?: (match: PromptFolderFindMatch) => void
  }

  type PromptFolderFindControls = {
    toggleFindDialog: () => void
  }

  let {
    items,
    children,
    scrollToWithinWindowBand,
    onRevealMatch
  }: PromptFolderFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let matchCountsByEntity = $state<PromptFolderFindCounts[]>([])
  const findInputFocusRequests = createConsumableRequestCoordinator<void>()
  const focusRequests = createConsumableRequestCoordinator<PromptFolderFindFocusRequest>()
  const revealRequests = createConsumableRequestCoordinator<PromptFolderFindRevealRequest>()
  let searchRevision = $state(0)
  let lastSelectionAnchor = $state<PromptFolderFindAnchor | null>(null)
  let returnFocusTarget = $state<PromptFolderFindFocusRequest | null>(null)
  let shouldSelectCurrentMatch = $state(true)
  let preserveSelectionOnNextSearch = false
  let lastSearchInputs: SearchInputs = { queryKey: '', scopeKey: '', searchRevision: 0 }
  const query = $derived(matchText)
  const normalizedQuery = $derived(query.toLowerCase())

  const rowHandlesByEntityId = new SvelteMap<string, PromptFolderFindRowHandle>()
  const searchModel = createPromptFolderFindSearchModel()
  const itemByEntityId = $derived.by(() => {
    const lookup = new SvelteMap<string, PromptFolderFindItem>()
    for (const item of items) {
      lookup.set(item.entityId, item)
    }
    return lookup
  })
  const itemIndexByEntityId = $derived.by(() => {
    const lookup = new SvelteMap<string, number>()
    items.forEach((item, index) => {
      lookup.set(item.entityId, index)
    })
    return lookup
  })
  const entityIds = $derived.by(() => items.map((item) => item.entityId))

  // Show the widget and request a fresh scan for the current query.
  const openFindDialog = () => {
    focusRequests.clear()
    revealRequests.clear()
    if (!isFindOpen) {
      isFindOpen = true
      searchRevision += 1
    }
    findInputFocusRequests.request(undefined)
  }

  // Close the widget and return focus to the last editor target independently of match state.
  const closeFindDialog = () => {
    isFindOpen = false
    findInputFocusRequests.clear()
    revealRequests.clear()
    if (returnFocusTarget) {
      focusRequests.request(returnFocusTarget)
    }
  }

  // Run a full search pass and update derived counts/indexes.
  const runSearch = (resetSelection: boolean) => {
    if (query.length === 0) {
      shouldSelectCurrentMatch = true
      revealRequests.clear()
      matchCountsByEntity = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    const nextCounts = buildPromptFolderFindCounts({
      items,
      query,
      countMatchesInText: searchModel.countMatchesInText
    })
    matchCountsByEntity = nextCounts
    totalMatches = nextCounts.reduce(
      (sum, entry) =>
        sum + entry.sectionCounts.reduce((sectionSum, section) => sectionSum + section.count, 0),
      0
    )
    if (totalMatches === 0) revealRequests.clear()
    if (resetSelection) {
      const preserveSelection = preserveSelectionOnNextSearch
      preserveSelectionOnNextSearch = false
      if (totalMatches <= 0) {
        shouldSelectCurrentMatch = true
        currentMatchIndex = 0
        return
      }
      const effectiveSelectionAnchor = lastSelectionAnchor
        ? getEffectiveSelectionAnchor(lastSelectionAnchor)
        : null
      const selectedAnchorIndex = effectiveSelectionAnchor
        ? getSelectedMatchIndexFromAnchor(effectiveSelectionAnchor)
        : null
      if (selectedAnchorIndex != null) {
        setCurrentMatchIndex(selectedAnchorIndex, !preserveSelection)
        return
      }
      const navigationAnchor = effectiveSelectionAnchor ?? lastSelectionAnchor
      const anchorIndex = navigationAnchor ? getNextMatchIndexFromAnchor(navigationAnchor) : null
      setCurrentMatchIndex(anchorIndex ?? 1)
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

  const getItem = (entityId: string): PromptFolderFindItem | null =>
    itemByEntityId.get(entityId) ?? null
  const getSectionText = (entityId: string, sectionKey: string): string => {
    const item = getItem(entityId)
    if (!item) return ''
    return item.sections.find((section) => section.key === sectionKey)?.text ?? ''
  }

  const requestMatchReveal = (match: PromptFolderFindMatch) => {
    onRevealMatch?.(match)
    revealRequests.request({ match, query })
  }

  const recordSelectionAnchor = (anchor: PromptFolderFindAnchor) => {
    const startOffset = Math.min(anchor.startOffset, anchor.endOffset)
    const endOffset = Math.max(anchor.startOffset, anchor.endOffset)
    lastSelectionAnchor = { ...anchor, startOffset, endOffset }
    returnFocusTarget = {
      entityId: anchor.entityId,
      sectionKey: anchor.sectionKey,
      selection: null
    }
  }

  const getEffectiveSelectionAnchor = (
    anchor: PromptFolderFindAnchor
  ): PromptFolderFindAnchor | null => {
    const sectionText = getSectionText(anchor.entityId, anchor.sectionKey)
    if (sectionText.length === 0) return null

    const startOffset = Math.min(Math.max(anchor.startOffset, 0), sectionText.length)
    const endOffset = Math.min(Math.max(anchor.endOffset, 0), sectionText.length)
    if (endOffset > startOffset) {
      return {
        entityId: anchor.entityId,
        sectionKey: anchor.sectionKey,
        startOffset,
        endOffset
      }
    }

    const wordAtOffset = searchModel.getWordAtOffset(sectionText, startOffset)
    if (!wordAtOffset) return null
    return {
      entityId: anchor.entityId,
      sectionKey: anchor.sectionKey,
      startOffset: wordAtOffset.start,
      endOffset: wordAtOffset.end
    }
  }

  const getSelectionMatchText = (): string | null => {
    const anchor = lastSelectionAnchor
    if (!anchor) return null

    const effectiveSelectionAnchor = getEffectiveSelectionAnchor(anchor)
    if (!effectiveSelectionAnchor) return null

    const sectionText = getSectionText(anchor.entityId, anchor.sectionKey)
    const selectedText = sectionText.slice(
      effectiveSelectionAnchor.startOffset,
      effectiveSelectionAnchor.endOffset
    )
    // Monaco StartFindAction only seeds from same-line selections.
    if (selectedText.includes('\n') || selectedText.includes('\r')) return null
    return selectedText
  }

  const openFindDialogFromSelection = () => {
    const nextMatchText = getSelectionMatchText()
    const selectionAnchor = lastSelectionAnchor
    preserveSelectionOnNextSearch = Boolean(!isFindOpen && nextMatchText && selectionAnchor)
    if (nextMatchText && nextMatchText !== matchText) {
      matchText = nextMatchText
    }
    openFindDialog()
  }

  const toggleFindDialog = () => {
    if (isFindOpen) {
      closeFindDialog()
      return
    }
    openFindDialogFromSelection()
  }

  const findControls: PromptFolderFindControls = {
    toggleFindDialog
  }

  const setCurrentMatchIndex = (nextIndex: number, selectMatch = true) => {
    currentMatchIndex = nextIndex
    shouldSelectCurrentMatch = selectMatch
    const match = getPromptFolderFindMatchForIndex(nextIndex, matchCountsByEntity)
    if (!selectMatch) return
    const matchRange = findMatchRange(
      getSectionText(match.entityId, match.sectionKey),
      query,
      match.sectionMatchIndex
    )
    returnFocusTarget = {
      entityId: match.entityId,
      sectionKey: match.sectionKey,
      selection: matchRange
        ? { startOffset: matchRange.start, endOffset: matchRange.end }
        : null
    }
    requestMatchReveal(match)
  }

  type PromptFolderFindSectionRange = {
    entityId: string
    sectionKey: string
    count: number
    startMatchIndex: number
  }

  type PromptFolderFindSectionMatch = {
    sectionKey: string
    sectionMatchIndex: number
  }

  type TraversalDirection = 1 | -1

  const sectionRangesByMatchOrder = $derived.by((): PromptFolderFindSectionRange[] => {
    const ranges: PromptFolderFindSectionRange[] = []
    let nextStartMatchIndex = 1
    for (const group of matchCountsByEntity) {
      for (const section of group.sectionCounts) {
        if (section.count <= 0) continue
        ranges.push({
          entityId: group.entityId,
          sectionKey: section.sectionKey,
          count: section.count,
          startMatchIndex: nextStartMatchIndex
        })
        nextStartMatchIndex += section.count
      }
    }
    return ranges
  })

  const sectionRangeByEntitySection = $derived.by(() => {
    const lookup = new SvelteMap<string, SvelteMap<string, PromptFolderFindSectionRange>>()
    for (const range of sectionRangesByMatchOrder) {
      let bySectionKey = lookup.get(range.entityId)
      if (!bySectionKey) {
        bySectionKey = new SvelteMap<string, PromptFolderFindSectionRange>()
        lookup.set(range.entityId, bySectionKey)
      }
      bySectionKey.set(range.sectionKey, range)
    }
    return lookup
  })

  const getGlobalMatchIndex = (entityId: string, sectionKey: string, matchIndex: number) => {
    const sectionRange = sectionRangeByEntitySection.get(entityId)?.get(sectionKey)
    if (!sectionRange) return null
    if (matchIndex < 0 || matchIndex >= sectionRange.count) return null
    return sectionRange.startMatchIndex + matchIndex
  }

  const findSectionMatchIndex = (
    sectionText: string,
    offset: number,
    direction: TraversalDirection
  ) =>
    direction === 1
      ? findMatchIndexAtOrAfter(sectionText, query, offset)
      : findMatchIndexBefore(sectionText, query, offset)

  const findMatchInItemFromSection = (
    item: PromptFolderFindItem,
    startSectionIndex: number,
    direction: TraversalDirection,
    initialOffset: number
  ): PromptFolderFindSectionMatch | null => {
    if (startSectionIndex < 0 || startSectionIndex >= item.sections.length) return null
    for (
      let sectionIndex = startSectionIndex;
      sectionIndex >= 0 && sectionIndex < item.sections.length;
      sectionIndex += direction
    ) {
      const section = item.sections[sectionIndex]
      const sectionOffset =
        sectionIndex === startSectionIndex
          ? initialOffset
          : direction === 1
            ? 0
            : Number.POSITIVE_INFINITY
      const sectionMatchIndex = findSectionMatchIndex(section.text, sectionOffset, direction)
      if (sectionMatchIndex == null) continue
      return { sectionKey: section.key, sectionMatchIndex }
    }
    return null
  }

  const findBoundaryMatchInItem = (
    item: PromptFolderFindItem,
    direction: TraversalDirection
  ): PromptFolderFindSectionMatch | null => {
    if (item.sections.length === 0) return null
    const startSectionIndex = direction === 1 ? 0 : item.sections.length - 1
    const boundaryOffset = direction === 1 ? 0 : Number.POSITIVE_INFINITY
    return findMatchInItemFromSection(item, startSectionIndex, direction, boundaryOffset)
  }

  const getSelectedMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) => {
    if (query.length === 0 || totalMatches <= 0) return null
    const startOffset = Math.min(anchor.startOffset, anchor.endOffset)
    const endOffset = Math.max(anchor.startOffset, anchor.endOffset)
    if (endOffset <= startOffset) return null

    const sectionText = getSectionText(anchor.entityId, anchor.sectionKey)
    if (sectionText.length === 0) return null

    const selectedText = sectionText.slice(startOffset, endOffset)
    if (selectedText.toLowerCase() !== query.toLowerCase()) return null

    const sectionMatchIndex = findMatchIndexAtOrAfter(sectionText, query, startOffset)
    if (sectionMatchIndex == null) return null

    const matchRange = findMatchRange(sectionText, query, sectionMatchIndex)
    if (!matchRange) return null
    if (matchRange.start !== startOffset || matchRange.end !== endOffset) return null

    return getGlobalMatchIndex(anchor.entityId, anchor.sectionKey, sectionMatchIndex)
  }

  const getMatchIndexFromAnchor = (
    anchor: PromptFolderFindAnchor,
    direction: TraversalDirection
  ) => {
    if (query.length === 0 || totalMatches === 0) return null
    const startIndex = itemIndexByEntityId.get(anchor.entityId)
    if (startIndex == null) return null

    const startItem = items[startIndex]
    const startSectionIndex = startItem.sections.findIndex(
      (section) => section.key === anchor.sectionKey
    )
    if (startSectionIndex >= 0) {
      const anchorOffset = direction === 1 ? anchor.endOffset : anchor.startOffset
      const anchoredMatch = findMatchInItemFromSection(
        startItem,
        startSectionIndex,
        direction,
        anchorOffset
      )
      if (anchoredMatch) {
        return getGlobalMatchIndex(
          startItem.entityId,
          anchoredMatch.sectionKey,
          anchoredMatch.sectionMatchIndex
        )
      }
    }

    for (let step = 1; step <= items.length; step += 1) {
      const nextIndex = (startIndex + step * direction + items.length) % items.length
      const match = findBoundaryMatchInItem(items[nextIndex], direction)
      if (!match) continue
      return getGlobalMatchIndex(
        items[nextIndex].entityId,
        match.sectionKey,
        match.sectionMatchIndex
      )
    }

    return null
  }

  const getNextMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) =>
    getMatchIndexFromAnchor(anchor, 1)

  const getPreviousMatchIndexFromAnchor = (anchor: PromptFolderFindAnchor) =>
    getMatchIndexFromAnchor(anchor, -1)

  // Move selection to the previous match and reveal it.
  const handlePrevious = () => {
    if (totalMatches === 0) return
    const anchorIndex =
      currentMatchIndex <= 0 && lastSelectionAnchor
        ? getPreviousMatchIndexFromAnchor(lastSelectionAnchor)
        : null
    const nextIndex =
      anchorIndex ?? (currentMatchIndex <= 1 ? totalMatches : Math.max(1, currentMatchIndex - 1))
    setCurrentMatchIndex(nextIndex)
  }

  // Move selection to the next match and reveal it.
  const handleNext = () => {
    if (totalMatches === 0) return
    const anchorIndex =
      currentMatchIndex <= 0 && lastSelectionAnchor
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
      nextInputs.searchRevision !== lastSearchInputs.searchRevision
    runSearch(shouldResetSelection)
    lastSearchInputs = nextInputs
  })

  // Side effect: reveal and acknowledge the requested match once its row section is ready.
  $effect(() => {
    const request = revealRequests.pending
    if (!request || !scrollToWithinWindowBand) return

    const { match, query } = request.payload
    const rowHandle = rowHandlesByEntityId.get(match.entityId)
    if (!rowHandle) return

    if (rowHandle.shouldEnsureHydratedForSection(match.sectionKey) && !rowHandle.isHydrated()) {
      rowHandle.requestHydration()
      return
    }
    if (!rowHandle.isSectionReady(match.sectionKey)) return

    revealRequests.consume(request, () => {
      const sectionCenterOffsetPx = rowHandle.getSectionCenterOffset(match.sectionKey)
      const revealOffsetPx =
        sectionCenterOffsetPx ??
        rowHandle.revealSectionMatch(match.sectionKey, query, match.sectionMatchIndex)
      if (revealOffsetPx == null) return
      scrollToWithinWindowBand(rowHandle.rowId, revealOffsetPx, 'center')
    })
  })

  const getMatchIndexAtSelection = (
    groups: PromptFolderFindCounts[],
    entityId: string,
    sectionKey: string,
    ranges: Array<{ startOffset: number; endOffset: number }>,
    selection: { startOffset: number; endOffset: number }
  ) => {
    let precedingMatches = 0
    for (const group of groups) {
      for (const section of group.sectionCounts) {
        if (group.entityId === entityId && section.sectionKey === sectionKey) {
          const selectionStart = Math.min(selection.startOffset, selection.endOffset)
          const selectionEnd = Math.max(selection.startOffset, selection.endOffset)
          const intersectingIndex = ranges.findIndex((range) =>
            selectionStart === selectionEnd
              ? range.startOffset <= selectionStart && range.endOffset >= selectionStart
              : range.startOffset < selectionEnd && range.endOffset > selectionStart
          )
          const localPosition =
            intersectingIndex >= 0
              ? intersectingIndex + 1
              : ranges.filter((range) => range.startOffset < selectionStart).length
          return precedingMatches + localPosition
        }
        precedingMatches += section.count
      }
    }
    return null
  }

  // Recount one changed section and anchor the current position to the post-edit cursor.
  const reportSectionTextChange = (
    entityId: string,
    sectionKey: string,
    text: string,
    selection: { startOffset: number; endOffset: number } | null = null
  ) => {
    if (!isFindOpen || query.length === 0) return
    const groupIndex = matchCountsByEntity.findIndex((group) => group.entityId === entityId)
    if (groupIndex < 0) return

    const group = matchCountsByEntity[groupIndex]
    const sectionIndex = group.sectionCounts.findIndex(
      (section) => section.sectionKey === sectionKey
    )
    if (sectionIndex < 0) return
    const section = group.sectionCounts[sectionIndex]
    const ranges = searchModel.findMatchesInText(text, query)
    const count = ranges.length
    let nextGroups = matchCountsByEntity
    if (section.count !== count) {
      const nextSectionCounts = group.sectionCounts.slice()
      nextSectionCounts[sectionIndex] = { ...section, count }
      nextGroups = matchCountsByEntity.slice()
      nextGroups[groupIndex] = { ...group, sectionCounts: nextSectionCounts }
      matchCountsByEntity = nextGroups
      totalMatches += count - section.count
    }

    if (selection) {
      recordSelectionAnchor({ entityId, sectionKey, ...selection })
      currentMatchIndex = getMatchIndexAtSelection(
        nextGroups,
        entityId,
        sectionKey,
        ranges,
        selection
      ) ?? currentMatchIndex
      shouldSelectCurrentMatch = false
      return
    }

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
    shouldSelectCurrentMatch: true,
    focusRequests,
    reportSelection: recordSelectionAnchor,
    reportSectionTextChange,
    registerRow
  })

  // Side effect: keep the find context in sync with the local widget state.
  $effect(() => {
    findState.isFindOpen = isFindOpen
    findState.query = matchText
    findState.currentMatch = currentMatch
    findState.shouldSelectCurrentMatch = shouldSelectCurrentMatch
  })

  setPromptFolderFindContext(findState)

  // Side effect: capture global find/escape shortcuts while the prompt folder screen is active.
  onMount(() => {
    const unregisterShortcuts = registerPromptFolderFindShortcuts({
      getIsFindOpen: () => isFindOpen,
      openFindDialog: openFindDialogFromSelection,
      closeFindDialog
    })

    return () => {
      unregisterShortcuts()
      // Side effect: dispose the shared Monaco find model on teardown.
      searchModel.dispose()
    }
  })
</script>

<div class="prompt-folder-find-integration">
  {@render children?.(findControls)}

  {#if isFindOpen}
    <PromptFolderFindWidget
      bind:matchText
      focusRequests={findInputFocusRequests}
      {totalMatches}
      {currentMatchIndex}
      onClose={closeFindDialog}
      onPrevious={handlePrevious}
      onNext={handleNext}
    />
  {/if}
</div>

<style>
  .prompt-folder-find-integration {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    --prompt-folder-find-widget-top: 36px;
  }
</style>
