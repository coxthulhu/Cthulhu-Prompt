import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import { monaco } from '@renderer/common/Monaco'
import {
  getPromptData,
  subscribeToPromptDraftChanges
} from '@renderer/data/PromptDataStore.svelte.ts'

type FindField = 'title' | 'body'

type FindSelection = {
  promptId: string
  field: FindField
  matchIndex: number
  matchOffset: number
}

type FindLocation = {
  promptId: string
  field: FindField
  cursorOffset: number
}

type PromptMatchCounts = {
  title: number
  body: number
  total: number
}

type MatchRange = {
  startOffset: number
  endOffset: number
}

export const promptFolderFindState = $state({
  query: '',
  totalMatches: 0,
  currentSelection: null as FindSelection | null,
  currentMatchOrdinal: 0
})

let activeFolderName = $state<string | null>(null)
const promptMatchesById = new SvelteMap<string, PromptMatchCounts>()
const activePromptIds = new SvelteSet<string>()
let promptOrder: string[] = []
let currentFocusLocation: FindLocation | null = null
let lastFocusLocation: FindLocation | null = null
let searchModel: monaco.editor.ITextModel | null = null

const resetFindState = (): void => {
  promptMatchesById.clear()
  activePromptIds.clear()
  promptOrder = []
  promptFolderFindState.totalMatches = 0
  promptFolderFindState.currentSelection = null
  promptFolderFindState.currentMatchOrdinal = 0
}

const clearSelection = (): void => {
  promptFolderFindState.currentSelection = null
  promptFolderFindState.currentMatchOrdinal = 0
}

const setSelection = (selection: FindSelection | null): void => {
  promptFolderFindState.currentSelection = selection
  promptFolderFindState.currentMatchOrdinal = selection ? computeSelectionOrdinal(selection) : 0
}

const ensureSearchModel = (): monaco.editor.ITextModel => {
  if (searchModel) return searchModel
  searchModel = monaco.editor.createModel('', 'plaintext')
  return searchModel
}

const getMatchRangesInText = (query: string, text: string): MatchRange[] => {
  if (!query.length) return []
  const model = ensureSearchModel()
  model.setValue(text)
  const matches = model.findMatches(query, false, false, false, null, false)
  return matches.map((match) => ({
    startOffset: model.getOffsetAt(match.range.getStartPosition()),
    endOffset: model.getOffsetAt(match.range.getEndPosition())
  }))
}

const countMatchesInText = (query: string, text: string): number => {
  const model = ensureSearchModel()
  model.setValue(text)
  return model.findMatches(query, false, false, false, null, false).length
}

const countMatchesForPrompt = (promptId: string, query: string): PromptMatchCounts => {
  const promptData = getPromptData(promptId)
  const title = countMatchesInText(query, promptData.draft.title)
  const body = countMatchesInText(query, promptData.draft.text)
  return { title, body, total: title + body }
}

const getPromptMatchCounts = (promptId: string): PromptMatchCounts => {
  return promptMatchesById.get(promptId) ?? { title: 0, body: 0, total: 0 }
}

const setPromptMatchCount = (promptId: string, nextCount: PromptMatchCounts): void => {
  const previousCount = getPromptMatchCounts(promptId)
  if (
    previousCount.title === nextCount.title &&
    previousCount.body === nextCount.body &&
    previousCount.total === nextCount.total
  ) {
    return
  }
  promptMatchesById.set(promptId, nextCount)
  promptFolderFindState.totalMatches += nextCount.total - previousCount.total
  if (promptFolderFindState.currentSelection) {
    promptFolderFindState.currentMatchOrdinal = computeSelectionOrdinal(
      promptFolderFindState.currentSelection
    )
  }
}

const removePrompt = (promptId: string): void => {
  const previousCount = getPromptMatchCounts(promptId)
  if (previousCount.total) {
    promptFolderFindState.totalMatches -= previousCount.total
  }
  promptMatchesById.delete(promptId)
  activePromptIds.delete(promptId)
  if (promptFolderFindState.currentSelection?.promptId === promptId) {
    clearSelection()
  }
}

const rebuildPromptMatches = (promptIds: string[], query: string): void => {
  promptMatchesById.clear()
  activePromptIds.clear()
  promptFolderFindState.totalMatches = 0
  const hasQuery = query.length > 0
  promptOrder = [...promptIds]

  for (const promptId of promptIds) {
    activePromptIds.add(promptId)
    if (!hasQuery) continue
    setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
  }
  clearSelection()
}

export const setFindQuery = (query: string): void => {
  if (promptFolderFindState.query === query) return
  promptFolderFindState.query = query
  rebuildPromptMatches(Array.from(activePromptIds), query)
}

export const syncPromptFolderFindScope = (
  folderName: string,
  promptIds: string[]
): void => {
  if (activeFolderName !== folderName) {
    activeFolderName = folderName
    resetFindState()
    rebuildPromptMatches(promptIds, promptFolderFindState.query)
    return
  }

  const query = promptFolderFindState.query
  const hasQuery = query.length > 0
  const nextPromptIds = new SvelteSet<string>(promptIds)
  promptOrder = [...promptIds]
  if (promptFolderFindState.currentSelection) {
    promptFolderFindState.currentMatchOrdinal = computeSelectionOrdinal(
      promptFolderFindState.currentSelection
    )
  }

  for (const promptId of activePromptIds) {
    if (!nextPromptIds.has(promptId)) {
      removePrompt(promptId)
    }
  }

  for (const promptId of nextPromptIds) {
    if (!activePromptIds.has(promptId)) {
      activePromptIds.add(promptId)
      if (!hasQuery) continue
      setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
    }
  }
}

const updatePromptMatchesForPrompt = (promptId: string, query: string): void => {
  if (!activePromptIds.has(promptId)) return
  const nextCounts = countMatchesForPrompt(promptId, query)
  setPromptMatchCount(promptId, nextCounts)
  if (!promptFolderFindState.currentSelection) return
  if (promptFolderFindState.currentSelection.promptId !== promptId) return
  syncSelectionToNextOccurrence(promptId, query, promptFolderFindState.currentSelection)
}

// Side effect: update matches for prompts as their draft content changes.
subscribeToPromptDraftChanges((promptId) => {
  const query = promptFolderFindState.query
  if (!query) return
  updatePromptMatchesForPrompt(promptId, query)
})

const getPromptMatchRanges = (promptId: string, query: string) => {
  const promptData = getPromptData(promptId)
  return {
    title: getMatchRangesInText(query, promptData.draft.title),
    body: getMatchRangesInText(query, promptData.draft.text)
  }
}

const computeSelectionOrdinal = (selection: FindSelection): number => {
  const promptIndex = promptOrder.indexOf(selection.promptId)
  if (promptIndex < 0) return 0
  let ordinal = 0
  for (let index = 0; index < promptIndex; index += 1) {
    ordinal += getPromptMatchCounts(promptOrder[index]).total
  }
  const counts = getPromptMatchCounts(selection.promptId)
  if (selection.field === 'title') {
    ordinal += selection.matchIndex + 1
  } else {
    ordinal += counts.title + selection.matchIndex + 1
  }
  return ordinal
}

const buildSelection = (
  promptId: string,
  field: FindField,
  matchIndex: number,
  query: string
): FindSelection | null => {
  const ranges = getPromptMatchRanges(promptId, query)[field]
  const range = ranges[matchIndex]
  if (!range) return null
  return {
    promptId,
    field,
    matchIndex,
    matchOffset: range.startOffset
  }
}

const findIndexAtOrAfter = (ranges: MatchRange[], cursorOffset: number): number => {
  return ranges.findIndex((range) => range.startOffset >= cursorOffset)
}

const findIndexAtOrBefore = (ranges: MatchRange[], cursorOffset: number): number => {
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    if (ranges[index].startOffset <= cursorOffset) return index
  }
  return -1
}

const getFirstMatchInPrompt = (promptId: string, query: string): FindSelection | null => {
  const counts = getPromptMatchCounts(promptId)
  if (counts.title > 0) return buildSelection(promptId, 'title', 0, query)
  if (counts.body > 0) return buildSelection(promptId, 'body', 0, query)
  return null
}

const getLastMatchInPrompt = (promptId: string, query: string): FindSelection | null => {
  const counts = getPromptMatchCounts(promptId)
  if (counts.body > 0) return buildSelection(promptId, 'body', counts.body - 1, query)
  if (counts.title > 0) return buildSelection(promptId, 'title', counts.title - 1, query)
  return null
}

const findNextMatchFromSelection = (selection: FindSelection, query: string): FindSelection | null => {
  const promptId = selection.promptId
  const counts = getPromptMatchCounts(promptId)
  if (selection.field === 'title') {
    if (selection.matchIndex + 1 < counts.title) {
      return buildSelection(promptId, 'title', selection.matchIndex + 1, query)
    }
    if (counts.body > 0) {
      return buildSelection(promptId, 'body', 0, query)
    }
  } else if (selection.matchIndex + 1 < counts.body) {
    return buildSelection(promptId, 'body', selection.matchIndex + 1, query)
  }

  const startIndex = promptOrder.indexOf(promptId)
  if (startIndex < 0) return null
  for (let offset = 1; offset <= promptOrder.length; offset += 1) {
    const index = (startIndex + offset) % promptOrder.length
    const nextPromptId = promptOrder[index]
    const nextMatch = getFirstMatchInPrompt(nextPromptId, query)
    if (nextMatch) return nextMatch
  }
  return null
}

const findPreviousMatchFromSelection = (
  selection: FindSelection,
  query: string
): FindSelection | null => {
  const promptId = selection.promptId
  const counts = getPromptMatchCounts(promptId)
  if (selection.field === 'body') {
    if (selection.matchIndex - 1 >= 0) {
      return buildSelection(promptId, 'body', selection.matchIndex - 1, query)
    }
    if (counts.title > 0) {
      return buildSelection(promptId, 'title', counts.title - 1, query)
    }
  } else if (selection.matchIndex - 1 >= 0) {
    return buildSelection(promptId, 'title', selection.matchIndex - 1, query)
  }

  const startIndex = promptOrder.indexOf(promptId)
  if (startIndex < 0) return null
  for (let offset = 1; offset <= promptOrder.length; offset += 1) {
    const index = (startIndex - offset + promptOrder.length) % promptOrder.length
    const previousPromptId = promptOrder[index]
    const previousMatch = getLastMatchInPrompt(previousPromptId, query)
    if (previousMatch) return previousMatch
  }
  return null
}

const findMatchFromLocation = (
  location: FindLocation,
  direction: 'next' | 'previous',
  query: string
): FindSelection | null => {
  const promptIndex = promptOrder.indexOf(location.promptId)
  if (promptIndex < 0) return null

  const ranges = getPromptMatchRanges(location.promptId, query)
  const titleRanges = ranges.title
  const bodyRanges = ranges.body

  if (direction === 'next') {
    if (location.field === 'title') {
      const index = findIndexAtOrAfter(titleRanges, location.cursorOffset)
      if (index >= 0) return buildSelection(location.promptId, 'title', index, query)
      if (bodyRanges.length > 0) return buildSelection(location.promptId, 'body', 0, query)
    } else {
      const index = findIndexAtOrAfter(bodyRanges, location.cursorOffset)
      if (index >= 0) return buildSelection(location.promptId, 'body', index, query)
    }
  } else {
    if (location.field === 'body') {
      const index = findIndexAtOrBefore(bodyRanges, location.cursorOffset)
      if (index >= 0) return buildSelection(location.promptId, 'body', index, query)
      if (titleRanges.length > 0) {
        return buildSelection(location.promptId, 'title', titleRanges.length - 1, query)
      }
    } else {
      const index = findIndexAtOrBefore(titleRanges, location.cursorOffset)
      if (index >= 0) return buildSelection(location.promptId, 'title', index, query)
    }
  }

  if (direction === 'next') {
    for (let offset = 1; offset <= promptOrder.length; offset += 1) {
      const index = (promptIndex + offset) % promptOrder.length
      const candidate = getFirstMatchInPrompt(promptOrder[index], query)
      if (candidate) return candidate
    }
  } else {
    for (let offset = 1; offset <= promptOrder.length; offset += 1) {
      const index = (promptIndex - offset + promptOrder.length) % promptOrder.length
      const candidate = getLastMatchInPrompt(promptOrder[index], query)
      if (candidate) return candidate
    }
  }
  return null
}

const resolveNavigationStart = (): FindLocation | null => {
  if (currentFocusLocation) return currentFocusLocation
  if (lastFocusLocation) return lastFocusLocation
  const firstPromptId = promptOrder[0]
  if (!firstPromptId) return null
  return { promptId: firstPromptId, field: 'title', cursorOffset: 0 }
}

const syncSelectionToNextOccurrence = (
  promptId: string,
  query: string,
  selection: FindSelection
): void => {
  const nextSelection = findMatchFromLocation(
    {
      promptId,
      field: selection.field,
      cursorOffset: selection.matchOffset
    },
    'next',
    query
  )
  setSelection(nextSelection)
}

const navigate = (direction: 'next' | 'previous'): void => {
  const query = promptFolderFindState.query
  if (!query.length) return
  if (promptFolderFindState.totalMatches === 0) return

  const currentSelection = promptFolderFindState.currentSelection
  const nextSelection = currentSelection
    ? direction === 'next'
      ? findNextMatchFromSelection(currentSelection, query)
      : findPreviousMatchFromSelection(currentSelection, query)
    : (() => {
        const startLocation = resolveNavigationStart()
        if (!startLocation) return null
        return findMatchFromLocation(startLocation, direction, query)
      })()

  if (nextSelection) {
    setSelection(nextSelection)
  }
}

export const findNextMatch = (): void => {
  navigate('next')
}

export const findPreviousMatch = (): void => {
  navigate('previous')
}

export const updateFindFocusLocation = (location: FindLocation): void => {
  currentFocusLocation = location
  lastFocusLocation = location
}

export const updateFindCursorLocation = (location: FindLocation): void => {
  if (
    currentFocusLocation &&
    currentFocusLocation.promptId === location.promptId &&
    currentFocusLocation.field === location.field
  ) {
    currentFocusLocation = location
  }
  lastFocusLocation = location
}

export const clearFindFocusLocation = (promptId: string, field: FindField): void => {
  if (
    currentFocusLocation &&
    currentFocusLocation.promptId === promptId &&
    currentFocusLocation.field === field
  ) {
    currentFocusLocation = null
  }
}

export type { FindSelection, FindField }
