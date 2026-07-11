import { getContext, setContext } from 'svelte'

const PROMPT_NAVIGATION_CONTEXT = Symbol('prompt-navigation')

export type PromptNavigationRow = 'folder-settings' | `prompt:${string}`
export const promptIdToPromptNavigationRow = (promptId: string): PromptNavigationRow =>
  `prompt:${promptId}`

export type PromptNavigationSource =
  | 'tree-click'
  | 'folder-open'
  | 'restore'
  | 'restore-hold'
  | 'scroll-follow'
  | 'find'
  | 'header'
  | 'prompt-create'
  | 'prompt-divider-create'
  | 'subfolder-create'
  | 'prompt-move'

type PromptNavigationState = {
  screenRootFolderId: string | null
  rowOwnerFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionVersion: number
  selectionSource: PromptNavigationSource | null
}

type SelectPromptNavigationOptions = {
  screenRootFolderId: string
  rowOwnerFolderId: string
  row: PromptNavigationRow
  source: PromptNavigationSource
  forceVersionBump?: boolean
}

export type PromptNavigationContext = {
  screenRootFolderId: string | null
  rowOwnerFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionVersion: number
  selectionSource: PromptNavigationSource | null
  select: (options: SelectPromptNavigationOptions) => void
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
  const state = $state<PromptNavigationState>({
    screenRootFolderId: null,
    rowOwnerFolderId: null,
    selectedRow: null,
    selectionVersion: 0,
    selectionSource: null
  })

  const select = ({
    screenRootFolderId,
    rowOwnerFolderId,
    row,
    source,
    forceVersionBump = false
  }: SelectPromptNavigationOptions): void => {
    const hasChanged =
      state.screenRootFolderId !== screenRootFolderId ||
      state.rowOwnerFolderId !== rowOwnerFolderId ||
      state.selectedRow !== row ||
      state.selectionSource !== source

    if (!hasChanged && !forceVersionBump) {
      return
    }

    state.screenRootFolderId = screenRootFolderId
    state.rowOwnerFolderId = rowOwnerFolderId
    state.selectedRow = row
    state.selectionSource = source
    state.selectionVersion += 1
  }

  return {
    get screenRootFolderId() {
      return state.screenRootFolderId
    },
    get rowOwnerFolderId() {
      return state.rowOwnerFolderId
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
    select
  }
}

export const setPromptNavigationContext = (value: PromptNavigationContext): void => {
  setContext(PROMPT_NAVIGATION_CONTEXT, value)
}

export const getPromptNavigationContext = (): PromptNavigationContext => {
  return getContext<PromptNavigationContext>(PROMPT_NAVIGATION_CONTEXT)
}
