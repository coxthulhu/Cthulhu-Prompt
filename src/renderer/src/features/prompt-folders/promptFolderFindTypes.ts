export type PromptFolderFindMatch = {
  promptId: string
  kind: 'title' | 'body'
  bodyMatchIndex?: number
  titleMatchIndex?: number
}

export type PromptFolderFindState = {
  isFindOpen: boolean
  query: string
  currentMatch: PromptFolderFindMatch | null
  focusMatchRequestId: number
  focusMatch: PromptFolderFindMatch | null
  focusMatchQuery: string
  reportHydration: (promptId: string, isHydrated: boolean) => void
  reportBodyMatchCount: (promptId: string, query: string, count: number) => void
}

export type PromptFolderFindRequest = {
  isOpen: boolean
  query: string
  activeBodyMatchIndex: number | null
}
