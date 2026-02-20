import { findMatchRange } from './promptFolderFindText'
import type { PromptFolderFindItem, PromptFolderFindMatch } from './promptFolderFindTypes'

export type PromptFolderFindSectionCount = {
  sectionKey: string
  count: number
}

export type PromptFolderFindCounts = {
  entityId: string
  sectionCounts: PromptFolderFindSectionCount[]
}

export type SearchInputs = {
  queryKey: string
  scopeKey: string
  searchRevision: number
}

type BuildMatchCountsArgs = {
  items: PromptFolderFindItem[]
  trimmedQuery: string
  hydratedEntityIds: Set<string>
  sectionMatchCountsByEntitySectionKey: Map<string, { query: string; count: number }>
  countMatchesInText: (text: string, query: string) => number
}

export const getPromptFolderFindSectionCountKey = (
  entityId: string,
  sectionKey: string
): string => `${entityId}\u0000${sectionKey}`

export const buildSearchInputs = ({
  normalizedQuery,
  entityIds,
  searchRevision
}: {
  normalizedQuery: string
  entityIds: string[]
  searchRevision: number
}): SearchInputs => ({
  queryKey: normalizedQuery,
  scopeKey: entityIds.join('|'),
  searchRevision
})

export const hasSearchInputsChanged = (next: SearchInputs, prev: SearchInputs) =>
  next.queryKey !== prev.queryKey ||
  next.scopeKey !== prev.scopeKey ||
  next.searchRevision !== prev.searchRevision

export const buildPromptFolderFindCounts = ({
  items,
  trimmedQuery,
  hydratedEntityIds,
  sectionMatchCountsByEntitySectionKey,
  countMatchesInText
}: BuildMatchCountsArgs): PromptFolderFindCounts[] => {
  if (trimmedQuery.length === 0) return []

  return items.map((item) => {
    const sectionCounts = item.sections.map((section) => {
      const key = getPromptFolderFindSectionCountKey(item.entityId, section.key)
      const tracked = sectionMatchCountsByEntitySectionKey.get(key)
      const useTrackedCount = hydratedEntityIds.has(item.entityId) && tracked?.query === trimmedQuery
      const count = useTrackedCount ? tracked.count : countMatchesInText(section.text, trimmedQuery)
      return {
        sectionKey: section.key,
        count
      }
    })

    return {
      entityId: item.entityId,
      sectionCounts
    }
  })
}

export const getPromptFolderFindMatchForIndex = (
  matchIndex: number,
  groups: PromptFolderFindCounts[]
): PromptFolderFindMatch => {
  let remaining = matchIndex
  for (const group of groups) {
    for (const section of group.sectionCounts) {
      if (remaining <= section.count) {
        return {
          entityId: group.entityId,
          sectionKey: section.sectionKey,
          sectionMatchIndex: remaining - 1
        }
      }
      remaining -= section.count
    }
  }
  throw new Error('Match index out of range')
}

export const getMatchTextForCurrentMatch = (
  match: PromptFolderFindMatch | null,
  trimmedQuery: string,
  getSectionText: (entityId: string, sectionKey: string) => string
) => {
  if (!match) return null
  if (trimmedQuery.length === 0) return null

  const targetText = getSectionText(match.entityId, match.sectionKey)

  const matchRange = findMatchRange(targetText, trimmedQuery, match.sectionMatchIndex)
  if (!matchRange) return null

  return targetText.slice(matchRange.start, matchRange.end)
}
