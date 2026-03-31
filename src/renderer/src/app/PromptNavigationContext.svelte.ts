import { getContext, setContext } from 'svelte'

const PROMPT_NAVIGATION_CONTEXT = Symbol('prompt-navigation')

export type PromptNavigationRow = 'folder-settings' | `prompt:${string}`

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
  viewedFolderIdOverride: string | null
  viewedRowOverride: PromptNavigationRow | null
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
  viewedFolderId: string | null
  viewedRow: PromptNavigationRow | null
  hasViewedRowOverride: boolean
  select: (options: SelectPromptNavigationOptions) => void
  setViewedRowOverride: (options: { folderId: string; row: PromptNavigationRow }) => void
  clearViewedRowOverride: () => void
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
    viewedFolderIdOverride: null,
    viewedRowOverride: null
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

  const setViewedRowOverride = (options: { folderId: string; row: PromptNavigationRow }): void => {
    state.viewedFolderIdOverride = options.folderId
    state.viewedRowOverride = options.row
  }

  const clearViewedRowOverride = (): void => {
    state.viewedFolderIdOverride = null
    state.viewedRowOverride = null
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
    get viewedFolderId() {
      return state.viewedFolderIdOverride ?? state.selectedFolderId
    },
    get viewedRow() {
      return state.viewedRowOverride ?? state.selectedRow
    },
    get hasViewedRowOverride() {
      return state.viewedRowOverride !== null
    },
    select,
    setViewedRowOverride,
    clearViewedRowOverride
  }
}

export const setPromptNavigationContext = (value: PromptNavigationContext): void => {
  setContext(PROMPT_NAVIGATION_CONTEXT, value)
}

export const getPromptNavigationContext = (): PromptNavigationContext => {
  return getContext<PromptNavigationContext>(PROMPT_NAVIGATION_CONTEXT)
}
