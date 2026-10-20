<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import PromptCollectionFindWidget from './PromptCollectionFindWidget.svelte'
  import { setPromptCollectionFindContext } from './promptCollectionFindContext'
  import {
    buildPromptCollectionFindCounts,
    buildSearchInputs,
    getPromptCollectionFindMatchForIndex,
    hasSearchInputsChanged,
    type PromptCollectionFindCounts,
    type SearchInputs
  } from './promptCollectionFindSearch'
  import { createPromptCollectionFindSearchModel } from './promptCollectionFindSearchModel'
  import { registerPromptCollectionFindShortcuts } from './promptCollectionFindShortcuts'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import type { ScrollToWithinWindowBand } from '@renderer/common/virtual-window/virtualWindowTypes'
  import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
  import {
    findMatchIndexAtOrAfter,
    findMatchIndexEndingAtOrBefore
  } from './promptCollectionFindText'
  import type {
    PromptCollectionFindAnchor,
    PromptCollectionFindFocusRequest,
    PromptCollectionFindItem,
    PromptCollectionFindMatch,
    PromptCollectionFindRowHandle,
    PromptCollectionFindSelection,
    PromptCollectionFindState
  } from './promptCollectionFindTypes'

  type PromptCollectionFindIntegrationProps = {
    items: PromptCollectionFindItem[]
    children?: Snippet<[PromptCollectionFindControls]>
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
    onRevealMatch?: (match: PromptCollectionFindMatch) => void
  }

  type PromptCollectionFindControls = {
    toggleFindDialog: () => void
  }

  let {
    items,
    children,
    scrollToWithinWindowBand,
    onRevealMatch
  }: PromptCollectionFindIntegrationProps = $props()

  let isFindOpen = $state(false)
  let matchText = $state('')
  let totalMatches = $state(0)
  let currentMatchIndex = $state(0)
  let matchCountsByEntity = $state<PromptCollectionFindCounts[]>([])
  const findInputFocusRequests = createConsumableRequestCoordinator<void>()
  const focusRequests = createConsumableRequestCoordinator<PromptCollectionFindFocusRequest>()
  /** Scoped cancellation returned by the virtual window for this find reveal. */
  let cancelReveal: (() => void) | null = null
  /** Navigation notifications invalidate pending measurements before selection changes. */
  const promptNavigation = getPromptNavigationContext()

  /** Releases a pending exact scroll without affecting newer navigation. */
  const cancelMatchReveal = (): void => {
    cancelReveal?.()
    cancelReveal = null
    focusRequests.clear()
  }
  let searchRevision = $state(0)
  let lastSelectionAnchor = $state<PromptCollectionFindAnchor | null>(null)
  let returnFocusTarget = $state<PromptCollectionFindFocusRequest | null>(null)
  let shouldSelectCurrentMatch = $state(true)
  // Preserve the editor anchor whenever Ctrl+F requests a fresh search.
  let preserveSelectionOnNextSearch = false
  let lastSearchInputs: SearchInputs = { queryKey: '', scopeKey: '', searchRevision: 0 }
  const query = $derived(matchText)

  const rowHandlesByEntityId = new SvelteMap<string, PromptCollectionFindRowHandle>()
  const searchModel = createPromptCollectionFindSearchModel()
  const itemByEntityId = $derived.by(() => {
    const lookup = new SvelteMap<string, PromptCollectionFindItem>()
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
    cancelMatchReveal()
    isFindOpen = true
    searchRevision += 1
    findInputFocusRequests.request(undefined)
  }

  // Close the widget and return focus only while the last editor target remains mounted.
  const closeFindDialog = () => {
    isFindOpen = false
    findInputFocusRequests.clear()
    cancelMatchReveal()
    focusRequests.clear()
    if (!returnFocusTarget) return
    /** Mounted row whose target section must already be ready to receive focus. */
    const rowHandle = rowHandlesByEntityId.get(returnFocusTarget.entityId)
    if (!rowHandle?.isSectionReady(returnFocusTarget.sectionKey)) return
    focusRequests.request(returnFocusTarget)
  }

  // Run a full search pass and update derived counts/indexes.
  const runSearch = (resetSelection: boolean) => {
    if (query.length === 0) {
      preserveSelectionOnNextSearch = false
      shouldSelectCurrentMatch = true
      cancelMatchReveal()
      matchCountsByEntity = []
      totalMatches = 0
      currentMatchIndex = 0
      return
    }

    /** Stable result identity before a scope change replaces the grouped counts. */
    const retainedMatch = resetSelection ? null : currentMatch
    const nextCounts = buildPromptCollectionFindCounts({
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
    if (totalMatches === 0) cancelMatchReveal()
    if (resetSelection) {
      const preserveSelection = preserveSelectionOnNextSearch
      preserveSelectionOnNextSearch = false
      if (totalMatches <= 0) {
        shouldSelectCurrentMatch = true
        currentMatchIndex = 0
        return
      }
      if (preserveSelection) {
        // Passive match position mirrors Monaco without selecting or revealing a result.
        const anchoredMatchIndex = lastSelectionAnchor
          ? getMatchIndexAtAnchor(lastSelectionAnchor, nextCounts)
          : null
        currentMatchIndex = anchoredMatchIndex ?? Math.min(currentMatchIndex, totalMatches)
        shouldSelectCurrentMatch = false
        return
      }
      // Query edits start at the stored cursor; word expansion only supplies the initial query.
      const anchorIndex = lastSelectionAnchor
        ? getMatchIndexFromAnchor(lastSelectionAnchor, 1, lastSelectionAnchor.cursorOffset)
        : null
      setCurrentMatchIndex(anchorIndex ?? 1)
      return
    }

    if (totalMatches === 0) {
      currentMatchIndex = 0
      return
    }

    if (!shouldSelectCurrentMatch && lastSelectionAnchor) {
      /** Passive numbering follows the editor position after prompts move around it. */
      const anchoredIndex = getMatchIndexAtAnchor(lastSelectionAnchor, nextCounts)
      if (anchoredIndex != null) {
        currentMatchIndex = anchoredIndex
        return
      }
    }

    /** A surviving result keeps its selection and focus target without another reveal. */
    const retainedIndex = retainedMatch
      ? getGlobalMatchIndex(
          retainedMatch.entityId,
          retainedMatch.sectionKey,
          retainedMatch.sectionMatchIndex
        )
      : null
    if (retainedIndex != null) {
      currentMatchIndex = retainedIndex
      return
    }

    // A removed result selects its successor, or the final remaining result at the end.
    setCurrentMatchIndex(Math.min(Math.max(currentMatchIndex, 1), totalMatches))
  }

  // Derived current match based on the 1-based index and grouped counts.
  const currentMatch = $derived.by(() =>
    currentMatchIndex <= 0
      ? null
      : getPromptCollectionFindMatchForIndex(currentMatchIndex, matchCountsByEntity)
  )

  /** Searches input edits immediately so hydrated targets measure within the same input event. */
  const handleQueryChange = (nextQuery: string): void => {
    cancelMatchReveal()
    matchText = nextQuery
    runSearch(true)
    lastSearchInputs = buildSearchInputs({ query, entityIds, searchRevision })
  }

  const getItem = (entityId: string): PromptCollectionFindItem | null =>
    itemByEntityId.get(entityId) ?? null
  const getSectionText = (entityId: string, sectionKey: string): string => {
    const item = getItem(entityId)
    if (!item) return ''
    return item.sections.find((section) => section.key === sectionKey)?.text ?? ''
  }

  /** Prepares one target, then measures its match synchronously when the row is ready. */
  const requestMatchReveal = (match: PromptCollectionFindMatch) => {
    cancelMatchReveal()
    onRevealMatch?.(match)
    /** Row identity is available even while its editor is unmounted. */
    const item = getItem(match.entityId)
    if (!item || !scrollToWithinWindowBand) return
    /** Retained query prevents a changed input from completing an obsolete reveal. */
    const requestedQuery = query
    cancelReveal = scrollToWithinWindowBand(item.rowId, () => {
      if (!isFindOpen || query !== requestedQuery) return null
      /** Mounted section supplies a title midpoint or Monaco's exact selected-match position. */
      const rowHandle = rowHandlesByEntityId.get(match.entityId)
      if (!rowHandle?.isSectionReady(match.sectionKey)) return null
      return rowHandle.getSectionCenterOffset(match.sectionKey)
        ?? rowHandle.revealSectionMatch(match.sectionKey, requestedQuery, match.sectionMatchIndex)
    }, 'center')
  }

  // Resume navigation from the user's cursor and cancel any older pending reveal.
  const recordSelectionAnchor = (anchor: PromptCollectionFindAnchor) => {
    // Find-driven focus and title selection events must retain the active result and reveal.
    if (
      isFindOpen &&
      returnFocusTarget?.entityId === anchor.entityId &&
      returnFocusTarget.sectionKey === anchor.sectionKey &&
      (focusRequests.pending || (
        shouldSelectCurrentMatch &&
        returnFocusTarget.selection?.startOffset === anchor.startOffset &&
        returnFocusTarget.selection.endOffset === anchor.endOffset
      ))
    ) return
    const startOffset = Math.min(anchor.startOffset, anchor.endOffset)
    const endOffset = Math.max(anchor.startOffset, anchor.endOffset)
    lastSelectionAnchor = { ...anchor, startOffset, endOffset }
    shouldSelectCurrentMatch = false
    cancelMatchReveal()
    returnFocusTarget = {
      entityId: anchor.entityId,
      sectionKey: anchor.sectionKey,
      selection: null
    }
  }

  /** Expands a collapsed cursor to its word only when seeding a fresh search. */
  const getFindSeedAnchor = (
    anchor: PromptCollectionFindAnchor
  ): PromptCollectionFindAnchor | null => {
    const sectionText = getSectionText(anchor.entityId, anchor.sectionKey)
    if (sectionText.length === 0) return null

    const startOffset = Math.min(Math.max(anchor.startOffset, 0), sectionText.length)
    const endOffset = Math.min(Math.max(anchor.endOffset, 0), sectionText.length)
    if (endOffset > startOffset) {
      return {
        ...anchor,
        startOffset,
        endOffset
      }
    }

    const wordAtOffset = searchModel.getWordAtOffset(sectionText, startOffset)
    if (!wordAtOffset) return null
    return {
      ...anchor,
      startOffset: wordAtOffset.start,
      endOffset: wordAtOffset.end
    }
  }

  const getSelectionMatchText = (): string | null => {
    const anchor = lastSelectionAnchor
    if (!anchor) return null

    /** Selected text or cursor word used to populate the Find input. */
    const seedAnchor = getFindSeedAnchor(anchor)
    if (!seedAnchor) return null

    const sectionText = getSectionText(anchor.entityId, anchor.sectionKey)
    const selectedText = sectionText.slice(
      seedAnchor.startOffset,
      seedAnchor.endOffset
    )
    // Monaco StartFindAction only seeds from same-line selections.
    if (selectedText.includes('\n') || selectedText.includes('\r')) return null
    return selectedText
  }

  /** Resumes from the last navigated result even when focusing it emitted no cursor change. */
  const retainMatchSelectionAnchor = (): void => {
    if (returnFocusTarget?.selection) {
      lastSelectionAnchor = {
        entityId: returnFocusTarget.entityId,
        sectionKey: returnFocusTarget.sectionKey,
        ...returnFocusTarget.selection,
        cursorOffset: returnFocusTarget.selection.endOffset
      }
    }
  }

  const openFindDialogFromSelection = () => {
    // Ctrl+F starts from the retained result; ordinary query edits keep their original anchor.
    retainMatchSelectionAnchor()
    const nextMatchText = getSelectionMatchText()
    preserveSelectionOnNextSearch = true
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

  const findControls: PromptCollectionFindControls = {
    toggleFindDialog
  }

  const setCurrentMatchIndex = (nextIndex: number, selectMatch = true) => {
    currentMatchIndex = nextIndex
    shouldSelectCurrentMatch = selectMatch
    const match = getPromptCollectionFindMatchForIndex(nextIndex, matchCountsByEntity)
    if (!selectMatch) return
    const matchRange = searchModel.findMatchesInText(
      getSectionText(match.entityId, match.sectionKey),
      query
    )[match.sectionMatchIndex]
    returnFocusTarget = {
      entityId: match.entityId,
      sectionKey: match.sectionKey,
      selection: matchRange ?? null
    }
    requestMatchReveal(match)
  }

  type PromptCollectionFindSectionRange = {
    entityId: string
    sectionKey: string
    count: number
    startMatchIndex: number
  }

  type PromptCollectionFindSectionMatch = {
    sectionKey: string
    sectionMatchIndex: number
  }

  type TraversalDirection = 1 | -1

  const sectionRangesByMatchOrder = $derived.by((): PromptCollectionFindSectionRange[] => {
    const ranges: PromptCollectionFindSectionRange[] = []
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
    const lookup = new SvelteMap<string, SvelteMap<string, PromptCollectionFindSectionRange>>()
    for (const range of sectionRangesByMatchOrder) {
      let bySectionKey = lookup.get(range.entityId)
      if (!bySectionKey) {
        bySectionKey = new SvelteMap<string, PromptCollectionFindSectionRange>()
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

  /** Uses Monaco's original-text ranges for cursor-based navigation in either direction. */
  const findSectionMatchIndex = (
    sectionText: string,
    offset: number,
    direction: TraversalDirection
  ) => {
    /** Shared match ordering for counts, reveals, and restored selections. */
    const ranges = searchModel.findMatchesInText(sectionText, query)
    return direction === 1
      ? findMatchIndexAtOrAfter(ranges, offset)
      : findMatchIndexEndingAtOrBefore(ranges, offset)
  }

  const findMatchInItemFromSection = (
    item: PromptCollectionFindItem,
    startSectionIndex: number,
    direction: TraversalDirection,
    initialOffset: number
  ): PromptCollectionFindSectionMatch | null => {
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
    item: PromptCollectionFindItem,
    direction: TraversalDirection
  ): PromptCollectionFindSectionMatch | null => {
    if (item.sections.length === 0) return null
    const startSectionIndex = direction === 1 ? 0 : item.sections.length - 1
    const boundaryOffset = direction === 1 ? 0 : Number.POSITIVE_INFINITY
    return findMatchInItemFromSection(item, startSectionIndex, direction, boundaryOffset)
  }

  /** Traverses from the query caret or an explicit next/previous selection boundary. */
  const getMatchIndexFromAnchor = (
    anchor: PromptCollectionFindAnchor,
    direction: TraversalDirection,
    initialOffset: number
  ) => {
    if (query.length === 0 || totalMatches === 0) return null
    const startIndex = itemIndexByEntityId.get(anchor.entityId)
    if (startIndex == null) return null

    const startItem = items[startIndex]
    const startSectionIndex = startItem.sections.findIndex(
      (section) => section.key === anchor.sectionKey
    )
    if (startSectionIndex >= 0) {
      const anchoredMatch = findMatchInItemFromSection(
        startItem,
        startSectionIndex,
        direction,
        initialOffset
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

  const getNextMatchIndexFromAnchor = (anchor: PromptCollectionFindAnchor) =>
    getMatchIndexFromAnchor(anchor, 1, anchor.endOffset)

  const getPreviousMatchIndexFromAnchor = (anchor: PromptCollectionFindAnchor) =>
    getMatchIndexFromAnchor(anchor, -1, anchor.startOffset)

  // Move selection to the previous match and reveal it.
  const handlePrevious = () => {
    if (totalMatches === 0) return
    const anchorIndex =
      !shouldSelectCurrentMatch && lastSelectionAnchor
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
      !shouldSelectCurrentMatch && lastSelectionAnchor
        ? getNextMatchIndexFromAnchor(lastSelectionAnchor)
        : null
    const nextIndex =
      anchorIndex ??
      (currentMatchIndex <= 0 || currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1)
    setCurrentMatchIndex(nextIndex)
  }

  /** Seeds an empty query or reopens the retained query while preserving keyboard navigation focus. */
  const navigateFind = (event: KeyboardEvent): void => {
    /** Pending focus preserves editor-origin navigation while a virtualized result hydrates. */
    const moveEditorFocus = focusRequests.pending !== null ||
      (event.target instanceof Element &&
        event.target.closest('.monaco-editor, .prompt-editor-title-input') !== null)
    if (!isFindOpen || query.length === 0) {
      retainMatchSelectionAnchor()
      // F3 adopts the selection or cursor word only when there is no retained search text.
      if (query.length === 0) matchText = getSelectionMatchText() ?? ''
      isFindOpen = true
      preserveSelectionOnNextSearch = true
      runSearch(true)
      lastSearchInputs = buildSearchInputs({ query, entityIds, searchRevision })
    }
    if (event.shiftKey) handlePrevious()
    else handleNext()
    if (moveEditorFocus && totalMatches > 0 && returnFocusTarget) {
      focusRequests.request(returnFocusTarget)
    }
  }

  // Side effect: refresh the placeholder search state while the find widget is open.
  $effect(() => {
    if (!isFindOpen) return
    // Scope key guards the full rescan against changes in findable entity IDs or query.
    const nextInputs = buildSearchInputs({
      query,
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

  const getMatchIndexAtSelection = (
    groups: PromptCollectionFindCounts[],
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

  // Report Monaco's passive current position for an unchanged editor anchor.
  const getMatchIndexAtAnchor = (
    anchor: PromptCollectionFindAnchor,
    groups: PromptCollectionFindCounts[]
  ): number | null => {
    return getMatchIndexAtSelection(
      groups,
      anchor.entityId,
      anchor.sectionKey,
      searchModel.findMatchesInText(getSectionText(anchor.entityId, anchor.sectionKey), query),
      anchor
    )
  }

  // Recount one changed section and anchor the current position to the post-edit cursor.
  const reportSectionTextChange = (
    entityId: string,
    sectionKey: string,
    text: string,
    selection: PromptCollectionFindSelection | null = null
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

  const registerRow = (handle: PromptCollectionFindRowHandle) => {
    rowHandlesByEntityId.set(handle.entityId, handle)
    return () => {
      const current = rowHandlesByEntityId.get(handle.entityId)
      if (current === handle) {
        rowHandlesByEntityId.delete(handle.entityId)
      }
    }
  }

  const findState = $state<PromptCollectionFindState>({
    findMatchesInText: searchModel.findMatchesInText,
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

  setPromptCollectionFindContext(findState)

  // Side effect: capture global find/escape shortcuts while the prompt collection screen is active.
  onMount(() => {
    /** Subscription cancels pending find work at the start of newer explicit navigation. */
    const unregisterNavigation = promptNavigation.onNavigate(cancelMatchReveal)
    const unregisterShortcuts = registerPromptCollectionFindShortcuts({
      getIsFindOpen: () => isFindOpen,
      openFindDialog: openFindDialogFromSelection,
      closeFindDialog,
      navigateFind
    })

    return () => {
      unregisterNavigation()
      cancelMatchReveal()
      unregisterShortcuts()
      // Side effect: dispose the shared Monaco find model on teardown.
      searchModel.dispose()
    }
  })
</script>

<div class="prompt-collection-find-integration">
  {@render children?.(findControls)}

  {#if isFindOpen}
    <PromptCollectionFindWidget
      bind:matchText
      focusRequests={findInputFocusRequests}
      {totalMatches}
      {currentMatchIndex}
      onClose={closeFindDialog}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onQueryChange={handleQueryChange}
    />
  {/if}
</div>

<style>
  .prompt-collection-find-integration {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
  }
</style>
