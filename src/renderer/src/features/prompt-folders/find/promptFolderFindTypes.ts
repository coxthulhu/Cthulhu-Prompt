import type { ConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'

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

/** Ordered selection bounds plus the active caret used when editing the find query. */
export type PromptFolderFindSelection = {
  startOffset: number
  endOffset: number
  cursorOffset: number
}

export type PromptFolderFindAnchor = PromptFolderFindSelection & {
  entityId: string
  sectionKey: string
}

export type PromptFolderFindFocusRequest = {
  entityId: string
  sectionKey: string
  selection: {
    startOffset: number
    endOffset: number
  } | null
}

export type PromptFolderFindRowHandle = {
  entityId: string
  rowId: string
  isSectionReady: (sectionKey: string) => boolean
  revealSectionMatch: (sectionKey: string, query: string, matchIndex: number) => number | null
  getSectionCenterOffset: (sectionKey: string) => number | null
}

export type PromptFolderFindState = {
  /** Reuse Monaco's search ranges for title decorations and match counts. */
  findMatchesInText: import('./promptFolderFindSearchModel').PromptFolderFindSearchModel['findMatchesInText']
  isFindOpen: boolean
  query: string
  currentMatch: PromptFolderFindMatch | null
  shouldSelectCurrentMatch: boolean
  focusRequests: ConsumableRequestCoordinator<PromptFolderFindFocusRequest>
  reportSelection: (anchor: PromptFolderFindAnchor) => void
  reportSectionTextChange: (
    entityId: string,
    sectionKey: string,
    text: string,
    selection?: PromptFolderFindSelection | null
  ) => void
  registerRow: (handle: PromptFolderFindRowHandle) => () => void
}

export type PromptFolderFindRequest = {
  isOpen: boolean
  query: string
  activeSectionKey: string | null
  activeSectionMatchIndex: number | null
  shouldSelectActiveMatch: boolean
}
