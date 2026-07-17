import { getContext, setContext } from 'svelte'
import {
  createConsumableRequestCoordinator,
  type ConsumableRequest,
  type ConsumableRequestCoordinator
} from '@renderer/common/consumableRequestCoordinator.svelte.ts'

const PROMPT_NAVIGATION_CONTEXT = Symbol('prompt-navigation')

export type PromptNavigationRow = 'folder-root' | 'folder-settings' | `prompt:${string}`
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
  | 'folder-move'

type PromptNavigationState = {
  screenRootFolderId: string | null
  rowOwnerFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionSource: PromptNavigationSource | null
}

export type PromptNavigationTarget = {
  screenRootFolderId: string
  rowOwnerFolderId: string
  row: PromptNavigationRow
}

export type PromptContentExpansionRequest = PromptNavigationTarget & {
  expandFolderSettings: boolean
}

export type PromptContentRevealRequest = PromptNavigationTarget & {
  scrollType: 'center' | 'minimal'
}

export type PromptFocusRequest = {
  screenRootFolderId: string
  promptId: string
}

export type PromptTreeExpansionRequest = PromptNavigationTarget & {
  expandPath: 'owner' | 'ancestors'
}

type SelectPromptNavigationOptions = {
  screenRootFolderId: string
  rowOwnerFolderId: string
  row: PromptNavigationRow
  source: PromptNavigationSource
  forceRequest?: boolean
  contentReveal?: {
    scrollType: 'center' | 'minimal'
    expandFolderSettings?: boolean
  }
  focusPromptId?: string
  treeExpansion?: PromptTreeExpansionRequest['expandPath']
}

type SelectPromptNavigationResult = {
  contentRevealRequest: ConsumableRequest<PromptContentRevealRequest> | null
}

export type PromptNavigationContext = {
  screenRootFolderId: string | null
  rowOwnerFolderId: string | null
  selectedRow: PromptNavigationRow | null
  selectionSource: PromptNavigationSource | null
  contentExpansionRequests: ConsumableRequestCoordinator<PromptContentExpansionRequest>
  contentRevealRequests: ConsumableRequestCoordinator<PromptContentRevealRequest>
  promptFocusRequests: ConsumableRequestCoordinator<PromptFocusRequest>
  treeExpansionRequests: ConsumableRequestCoordinator<PromptTreeExpansionRequest>
  treeRevealRequests: ConsumableRequestCoordinator<PromptNavigationTarget>
  select: (options: SelectPromptNavigationOptions) => SelectPromptNavigationResult
}

export const promptNavigationRowToPersistedEntryId = (row: PromptNavigationRow): string => {
  if (row === 'folder-root' || row === 'folder-settings') {
    return row
  }

  return row.slice('prompt:'.length)
}

export const persistedPromptTreeEntryIdToPromptNavigationRow = (
  entryId: string
): PromptNavigationRow => {
  return entryId === 'folder-root' || entryId === 'folder-settings' ? entryId : `prompt:${entryId}`
}

export const createPromptNavigationContextValue = (): PromptNavigationContext => {
  const state = $state<PromptNavigationState>({
    screenRootFolderId: null,
    rowOwnerFolderId: null,
    selectedRow: null,
    selectionSource: null
  })
  const contentExpansionRequests =
    createConsumableRequestCoordinator<PromptContentExpansionRequest>()
  const contentRevealRequests = createConsumableRequestCoordinator<PromptContentRevealRequest>()
  const promptFocusRequests = createConsumableRequestCoordinator<PromptFocusRequest>()
  const treeExpansionRequests = createConsumableRequestCoordinator<PromptTreeExpansionRequest>()
  const treeRevealRequests = createConsumableRequestCoordinator<PromptNavigationTarget>()

  const select = ({
    screenRootFolderId,
    rowOwnerFolderId,
    row,
    source,
    forceRequest = false,
    contentReveal,
    focusPromptId,
    treeExpansion
  }: SelectPromptNavigationOptions): SelectPromptNavigationResult => {
    const hasChanged =
      state.screenRootFolderId !== screenRootFolderId ||
      state.rowOwnerFolderId !== rowOwnerFolderId ||
      state.selectedRow !== row ||
      state.selectionSource !== source

    if (!hasChanged && !forceRequest) {
      return { contentRevealRequest: null }
    }

    state.screenRootFolderId = screenRootFolderId
    state.rowOwnerFolderId = rowOwnerFolderId
    state.selectedRow = row
    state.selectionSource = source

    const target: PromptNavigationTarget = {
      screenRootFolderId,
      rowOwnerFolderId,
      row
    }

    if (treeExpansion) {
      treeExpansionRequests.request({ ...target, expandPath: treeExpansion })
    } else {
      treeExpansionRequests.clear()
    }
    treeRevealRequests.request(target)

    if (contentReveal) {
      contentExpansionRequests.request({
        ...target,
        expandFolderSettings: contentReveal.expandFolderSettings ?? true
      })
    } else {
      contentExpansionRequests.clear()
      contentRevealRequests.clear()
    }
    const contentRevealRequest = contentReveal
      ? contentRevealRequests.request({
          ...target,
          scrollType: contentReveal.scrollType
        })
      : null

    if (focusPromptId) {
      promptFocusRequests.request({ screenRootFolderId, promptId: focusPromptId })
    } else {
      promptFocusRequests.clear()
    }

    return { contentRevealRequest }
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
    get selectionSource() {
      return state.selectionSource
    },
    contentExpansionRequests,
    contentRevealRequests,
    promptFocusRequests,
    treeExpansionRequests,
    treeRevealRequests,
    select
  }
}

export const setPromptNavigationContext = (value: PromptNavigationContext): void => {
  setContext(PROMPT_NAVIGATION_CONTEXT, value)
}

export const getPromptNavigationContext = (): PromptNavigationContext => {
  return getContext<PromptNavigationContext>(PROMPT_NAVIGATION_CONTEXT)
}
