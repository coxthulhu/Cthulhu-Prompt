import { getContext, setContext } from 'svelte'

const PROMPT_NAVIGATION_CONTEXT = Symbol('prompt-navigation')

export type PromptNavigationRow = 'folder-settings' | `prompt:${string}`
export const promptIdToPromptNavigationRow = (promptId: string): PromptNavigationRow =>
  `prompt:${promptId}`

export type PromptNavigationSource =
  | 'tree-click'
  | 'restore'
  | 'restore-hold'
  | 'scroll-follow'
  | 'find'
  | 'header'

type PromptNavigationState = {
  selectedFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionVersion: number
  selectionSource: PromptNavigationSource | null
  highlightedFolderIdOverride: string | null
  highlightedRowOverride: PromptNavigationRow | null
}

type SelectPromptNavigationOptions = {
  folderId: string
  row: PromptNavigationRow
  source: PromptNavigationSource
  forceVersionBump?: boolean
}

export type PromptNavigationContext = {
  selectedFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionVersion: number
  selectionSource: PromptNavigationSource | null
  highlightedFolderId: string | null
  highlightedRow: PromptNavigationRow | null
  hasHighlightedRowOverride: boolean
  select: (options: SelectPromptNavigationOptions) => void
  setHighlightedRowOverride: (options: { folderId: string; row: PromptNavigationRow }) => void
  clearHighlightedRowOverride: () => void
}

export const promptNavigationRowToPersistedEntryId = (row: PromptNavigationRow): string => {
  if (row === 'folder-settings') {
    return 'folder-settings'
  }

  return row.slice('prompt:'.length)
}

export const persistedPromptTreeEntryIdToPromptNavigationRow = (
  entryId: string
): PromptNavigationRow => {
  return entryId === 'folder-settings' ? 'folder-settings' : `prompt:${entryId}`
}

export const createPromptNavigationContextValue = (): PromptNavigationContext => {
  // Keep drag-only tree highlighting separate from canonical navigation state.
  const state = $state<PromptNavigationState>({
    selectedFolderId: null,
    selectedRow: null,
    selectionVersion: 0,
    selectionSource: null,
    highlightedFolderIdOverride: null,
    highlightedRowOverride: null
  })

  const select = ({
    folderId,
    row,
    source,
    forceVersionBump = false
  }: SelectPromptNavigationOptions): void => {
    const hasChanged =
      state.selectedFolderId !== folderId ||
      state.selectedRow !== row ||
      state.selectionSource !== source

    if (!hasChanged && !forceVersionBump) {
      return
    }

    state.selectedFolderId = folderId
    state.selectedRow = row
    state.selectionSource = source
    state.selectionVersion += 1
  }

  const setHighlightedRowOverride = (options: {
    folderId: string
    row: PromptNavigationRow
  }): void => {
    state.highlightedFolderIdOverride = options.folderId
    state.highlightedRowOverride = options.row
  }

  const clearHighlightedRowOverride = (): void => {
    state.highlightedFolderIdOverride = null
    state.highlightedRowOverride = null
  }

  return {
    get selectedFolderId() {
      return state.selectedFolderId
    },
    get selectedRow() {
      return state.selectedRow
    },
    get selectionVersion() {
      return state.selectionVersion
    },
    get selectionSource() {
      return state.selectionSource
    },
    get highlightedFolderId() {
      return state.highlightedFolderIdOverride ?? state.selectedFolderId
    },
    get highlightedRow() {
      return state.highlightedRowOverride ?? state.selectedRow
    },
    get hasHighlightedRowOverride() {
      return state.highlightedRowOverride !== null
    },
    select,
    setHighlightedRowOverride,
    clearHighlightedRowOverride
  }
}

export const setPromptNavigationContext = (value: PromptNavigationContext): void => {
  setContext(PROMPT_NAVIGATION_CONTEXT, value)
}

export const getPromptNavigationContext = (): PromptNavigationContext => {
  return getContext<PromptNavigationContext>(PROMPT_NAVIGATION_CONTEXT)
}
