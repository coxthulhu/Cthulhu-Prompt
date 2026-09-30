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
  query: string
  countMatchesInText: (text: string, query: string) => number
}

export const buildSearchInputs = ({
  query,
  entityIds,
  searchRevision
}: {
  query: string
  entityIds: string[]
  searchRevision: number
}): SearchInputs => ({
  queryKey: query,
  scopeKey: entityIds.join('|'),
  searchRevision
})

export const hasSearchInputsChanged = (next: SearchInputs, prev: SearchInputs) =>
  next.queryKey !== prev.queryKey ||
  next.scopeKey !== prev.scopeKey ||
  next.searchRevision !== prev.searchRevision

export const buildPromptFolderFindCounts = ({
  items,
  query,
  countMatchesInText
}: BuildMatchCountsArgs): PromptFolderFindCounts[] => {
  if (query.length === 0) return []

  return items.map((item) => {
    const sectionCounts = item.sections.map((section) => ({
      sectionKey: section.key,
      count: countMatchesInText(section.text, query)
    }))

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
