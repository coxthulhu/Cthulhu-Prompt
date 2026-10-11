import type { ConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'

export type PromptCollectionFindItemSection = {
  key: string
  text: string
}

export type PromptCollectionFindItem = {
  entityId: string
  rowId: string
  sections: PromptCollectionFindItemSection[]
}

export type PromptCollectionFindMatch = {
  entityId: string
  sectionKey: string
  sectionMatchIndex: number
}

/** Ordered selection bounds plus the active caret used when editing the find query. */
export type PromptCollectionFindSelection = {
  startOffset: number
  endOffset: number
  cursorOffset: number
}

export type PromptCollectionFindAnchor = PromptCollectionFindSelection & {
  entityId: string
  sectionKey: string
}

export type PromptCollectionFindFocusRequest = {
  entityId: string
  sectionKey: string
  selection: {
    startOffset: number
    endOffset: number
  } | null
}

export type PromptCollectionFindRowHandle = {
  entityId: string
  rowId: string
  isSectionReady: (sectionKey: string) => boolean
  revealSectionMatch: (sectionKey: string, query: string, matchIndex: number) => number | null
  getSectionCenterOffset: (sectionKey: string) => number | null
}

export type PromptCollectionFindState = {
  /** Reuse Monaco's search ranges for title decorations and match counts. */
  findMatchesInText: import('./promptCollectionFindSearchModel').PromptCollectionFindSearchModel['findMatchesInText']
  isFindOpen: boolean
  query: string
  currentMatch: PromptCollectionFindMatch | null
  shouldSelectCurrentMatch: boolean
  focusRequests: ConsumableRequestCoordinator<PromptCollectionFindFocusRequest>
  reportSelection: (anchor: PromptCollectionFindAnchor) => void
  reportSectionTextChange: (
    entityId: string,
    sectionKey: string,
    text: string,
    selection?: PromptCollectionFindSelection | null
  ) => void
  registerRow: (handle: PromptCollectionFindRowHandle) => () => void
}

export type PromptCollectionFindRequest = {
  isOpen: boolean
  query: string
  activeSectionKey: string | null
  activeSectionMatchIndex: number | null
  shouldSelectActiveMatch: boolean
}
