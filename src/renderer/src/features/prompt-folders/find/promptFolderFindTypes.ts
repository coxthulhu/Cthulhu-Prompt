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

export type PromptFolderFindAnchor = {
  entityId: string
  sectionKey: string
  startOffset: number
  endOffset: number
}

export type PromptFolderFindFocusRequest = {
  match: PromptFolderFindMatch
  query: string
  selectMatch: boolean
}

export type PromptFolderFindRevealRequest = {
  match: PromptFolderFindMatch
  query: string
}

export type PromptFolderFindRowHandle = {
  entityId: string
  rowId: string
  isHydrated: () => boolean
  requestHydration: () => void
  shouldEnsureHydratedForSection: (sectionKey: string) => boolean
  isSectionReady: (sectionKey: string) => boolean
  revealSectionMatch: (sectionKey: string, query: string, matchIndex: number) => number | null
  getSectionCenterOffset: (sectionKey: string) => number | null
}

export type PromptFolderFindState = {
  isFindOpen: boolean
  query: string
  currentMatch: PromptFolderFindMatch | null
  shouldSelectCurrentMatch: boolean
  focusRequests: ConsumableRequestCoordinator<PromptFolderFindFocusRequest>
  reportSelection: (anchor: PromptFolderFindAnchor) => void
  reportSectionTextChange: (entityId: string, sectionKey: string, text: string) => void
  registerRow: (handle: PromptFolderFindRowHandle) => () => void
}

export type PromptFolderFindRequest = {
  isOpen: boolean
  query: string
  activeSectionKey: string | null
  activeSectionMatchIndex: number | null
  shouldSelectActiveMatch: boolean
}
