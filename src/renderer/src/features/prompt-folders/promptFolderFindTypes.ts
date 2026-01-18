export type PromptFolderFindMatch =
  | {
      promptId: string
      kind: 'title'
      titleMatchIndex: number
    }
  | {
      promptId: string
      kind: 'body'
      bodyMatchIndex: number
    }

export type PromptFolderFindFocusRequest = {
  requestId: number
  match: PromptFolderFindMatch
  query: string
}

export type PromptFolderFindRowHandle = {
  promptId: string
  rowId: string
  isHydrated: () => boolean
  ensureHydrated: () => Promise<boolean>
  revealBodyMatch: (query: string, matchIndex: number) => number | null
  getTitleCenterOffset: () => number | null
}

export type PromptFolderFindState = {
  isFindOpen: boolean
  query: string
  currentMatch: PromptFolderFindMatch | null
  focusRequest: PromptFolderFindFocusRequest | null
  reportHydration: (promptId: string, isHydrated: boolean) => void
  reportBodyMatchCount: (promptId: string, query: string, count: number) => void
  registerRow: (handle: PromptFolderFindRowHandle) => () => void
}

export type PromptFolderFindRequest = {
  isOpen: boolean
  query: string
  activeBodyMatchIndex: number | null
}
