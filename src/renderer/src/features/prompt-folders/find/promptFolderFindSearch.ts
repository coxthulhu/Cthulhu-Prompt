import { getPromptFolderScreenPromptData } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
import { findMatchRange } from './promptFolderFindText'
import type { PromptFolderFindMatch } from './promptFolderFindTypes'

export type PromptFolderFindCounts = {
  promptId: string
  titleCount: number
  bodyCount: number
}

export type SearchInputs = {
  queryKey: string
  scopeKey: string
  searchRevision: number
}

type BuildMatchCountsArgs = {
  promptIds: string[]
  trimmedQuery: string
  hydratedPromptIds: Set<string>
  bodyMatchCountsByPromptId: Map<string, { query: string; count: number }>
  countMatchesInText: (text: string, query: string) => number
}

export const buildSearchInputs = ({
  normalizedQuery,
  promptIds,
  searchRevision
}: {
  normalizedQuery: string
  promptIds: string[]
  searchRevision: number
}): SearchInputs => ({
  queryKey: normalizedQuery,
  scopeKey: promptIds.join('|'),
  searchRevision
})

export const hasSearchInputsChanged = (next: SearchInputs, prev: SearchInputs) =>
  next.queryKey !== prev.queryKey ||
  next.scopeKey !== prev.scopeKey ||
  next.searchRevision !== prev.searchRevision

export const buildPromptFolderFindCounts = ({
  promptIds,
  trimmedQuery,
  hydratedPromptIds,
  bodyMatchCountsByPromptId,
  countMatchesInText
}: BuildMatchCountsArgs): PromptFolderFindCounts[] => {
  if (trimmedQuery.length === 0) return []

  return promptIds.map((promptId) => {
    const promptData = getPromptFolderScreenPromptData(promptId)
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

export const getPromptFolderFindMatchForIndex = (
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

export const getMatchTextForCurrentMatch = (
  match: PromptFolderFindMatch | null,
  trimmedQuery: string
) => {
  if (!match) return null
  if (trimmedQuery.length === 0) return null

  const promptData = getPromptFolderScreenPromptData(match.promptId)
  const targetText = match.kind === 'title' ? promptData.draft.title : promptData.draft.text
  const matchIndex = match.kind === 'title' ? match.titleMatchIndex : match.bodyMatchIndex

  const matchRange = findMatchRange(targetText, trimmedQuery, matchIndex)
  if (!matchRange) return null

  return targetText.slice(matchRange.start, matchRange.end)
}
