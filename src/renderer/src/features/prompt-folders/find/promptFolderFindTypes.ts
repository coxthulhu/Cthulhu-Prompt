export type PromptFolderFindItemSection = {
  key: string
  text: string
}

export type PromptFolderFindItem = {
  entityId: string
  rowId: string
  sections: PromptFolderFindItemSection[]
}

export type PromptFolderFindMatch = {
  entityId: string
  sectionKey: string
  sectionMatchIndex: number
}

export type PromptFolderFindAnchor = {
  entityId: string
  sectionKey: string
  startOffset: number
  endOffset: number
}

export type PromptFolderFindFocusRequest = {
  requestId: number
  match: PromptFolderFindMatch
  query: string
}

export type PromptFolderFindRowHandle = {
  entityId: string
  rowId: string
  isHydrated: () => boolean
  ensureHydrated: () => Promise<boolean>
  shouldEnsureHydratedForSection: (sectionKey: string) => boolean
  revealSectionMatch: (sectionKey: string, query: string, matchIndex: number) => number | null
  getSectionCenterOffset: (sectionKey: string) => number | null
}

export type PromptFolderFindState = {
  isFindOpen: boolean
  query: string
  currentMatch: PromptFolderFindMatch | null
  focusRequest: PromptFolderFindFocusRequest | null
  reportSelection: (anchor: PromptFolderFindAnchor) => void
  reportHydration: (entityId: string, isHydrated: boolean) => void
  reportSectionMatchCount: (
    entityId: string,
    sectionKey: string,
    query: string,
    count: number
  ) => void
  registerRow: (handle: PromptFolderFindRowHandle) => () => void
}

export type PromptFolderFindRequest = {
  isOpen: boolean
  query: string
  activeSectionKey: string | null
  activeSectionMatchIndex: number | null
}
