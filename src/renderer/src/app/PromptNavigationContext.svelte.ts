import { getContext, setContext } from 'svelte'
import {
  createConsumableRequestCoordinator,
  type ConsumableRequest,
  type ConsumableRequestCoordinator
} from '@renderer/common/consumableRequestCoordinator.svelte.ts'

const PROMPT_NAVIGATION_CONTEXT = Symbol('prompt-navigation')
/** Full tree-navigation highlight duration: 50ms transition, 500ms hold, and 120ms fade. */
const PROMPT_NAVIGATION_HIGHLIGHT_DURATION_MS = 670

/** Selectable row identities within one root prompt-folder screen. */
export type PromptNavigationRow = 'root-header' | 'category-details' | `prompt:${string}`
export const promptIdToPromptNavigationRow = (promptId: string): PromptNavigationRow =>
  `prompt:${promptId}`

export type PromptNavigationSource =
  | 'tree-click'
  | 'category-open'
  | 'restore'
  | 'restore-hold'
  | 'scroll-follow'
  | 'find'
  | 'header'
  | 'prompt-create'
  | 'prompt-divider-create'
  | 'prompt-move'
  | 'category-move'

type PromptNavigationState = {
  screenRootFolderId: string | null
  contentOwnerId: string | null
  selectedRow: PromptNavigationRow | null
  selectionSource: PromptNavigationSource | null
  /** Latest prompt-tree click that should highlight matching tree and editor status lines. */
  navigationHighlight: PromptNavigationHighlight | null
}

/** Replay identity for one prompt selected directly from the prompt tree. */
export type PromptNavigationHighlight = {
  /** Prompt or template selected by the tree click. */
  promptId: string
  /** Generation changed on every click so an active prompt can replay its highlight. */
  generation: number
}

export type PromptNavigationTarget = {
  screenRootFolderId: string
  contentOwnerId: string
  row: PromptNavigationRow
}

export type PromptContentExpansionRequest = PromptNavigationTarget & {
  expandDetails: boolean
}

// Defines how content navigation positions its target in the prompt-folder viewport.
export type PromptContentRevealScrollType = 'align-top' | 'center' | 'minimal'

export type PromptContentRevealRequest = PromptNavigationTarget & {
  scrollType: PromptContentRevealScrollType
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
  contentOwnerId: string
  row: PromptNavigationRow
  source: PromptNavigationSource
  /** Prompt clicked in the tree when this exact selection should start a highlight. */
  navigationHighlightPromptId?: string
  forceRequest?: boolean
  contentReveal?: {
    scrollType: PromptContentRevealScrollType
    expandDetails?: boolean
  }
  focusPromptId?: string
  treeExpansion?: PromptTreeExpansionRequest['expandPath']
}

type SelectPromptNavigationResult = {
  contentRevealRequest: ConsumableRequest<PromptContentRevealRequest> | null
}

export type PromptNavigationContext = {
  screenRootFolderId: string | null
  contentOwnerId: string | null
  selectedRow: PromptNavigationRow | null
  selectionSource: PromptNavigationSource | null
  /** Latest direct tree-click highlight, or null after another navigation source takes over. */
  navigationHighlight: PromptNavigationHighlight | null
  contentExpansionRequests: ConsumableRequestCoordinator<PromptContentExpansionRequest>
  contentRevealRequests: ConsumableRequestCoordinator<PromptContentRevealRequest>
  promptFocusRequests: ConsumableRequestCoordinator<PromptFocusRequest>
  treeExpansionRequests: ConsumableRequestCoordinator<PromptTreeExpansionRequest>
  treeRevealRequests: ConsumableRequestCoordinator<PromptNavigationTarget>
  select: (options: SelectPromptNavigationOptions) => SelectPromptNavigationResult
}

export const promptNavigationRowToPersistedEntryId = (row: PromptNavigationRow): string => {
  if (row === 'root-header' || row === 'category-details') {
    return row
  }

  return row.slice('prompt:'.length)
}

export const persistedPromptTreeEntryIdToPromptNavigationRow = (
  entryId: string
): PromptNavigationRow => {
  return entryId === 'root-header' || entryId === 'category-details'
    ? entryId
    : `prompt:${entryId}`
}

export const createPromptNavigationContextValue = (): PromptNavigationContext => {
  const state = $state<PromptNavigationState>({
    screenRootFolderId: null,
    contentOwnerId: null,
    selectedRow: null,
    selectionSource: null,
    navigationHighlight: null
  })
  const contentExpansionRequests =
    createConsumableRequestCoordinator<PromptContentExpansionRequest>()
  const contentRevealRequests = createConsumableRequestCoordinator<PromptContentRevealRequest>()
  const promptFocusRequests = createConsumableRequestCoordinator<PromptFocusRequest>()
  const treeExpansionRequests = createConsumableRequestCoordinator<PromptTreeExpansionRequest>()
  const treeRevealRequests = createConsumableRequestCoordinator<PromptNavigationTarget>()
  /** Timeout that clears the completed highlight so remounted virtual rows do not replay it. */
  let navigationHighlightTimeoutId: number | null = null

  const select = ({
    screenRootFolderId,
    contentOwnerId,
    row,
    source,
    navigationHighlightPromptId,
    forceRequest = false,
    contentReveal,
    focusPromptId,
    treeExpansion
  }: SelectPromptNavigationOptions): SelectPromptNavigationResult => {
    const hasChanged =
      state.screenRootFolderId !== screenRootFolderId ||
      state.contentOwnerId !== contentOwnerId ||
      state.selectedRow !== row ||
      state.selectionSource !== source

    if (!hasChanged && !forceRequest) {
      return { contentRevealRequest: null }
    }

    state.screenRootFolderId = screenRootFolderId
    state.contentOwnerId = contentOwnerId
    state.selectedRow = row
    state.selectionSource = source
    if (navigationHighlightPromptId) {
      if (navigationHighlightTimeoutId !== null) {
        window.clearTimeout(navigationHighlightTimeoutId)
      }
      /** Next click generation restarts both matching CSS animations. */
      const navigationHighlightGeneration = (state.navigationHighlight?.generation ?? 0) + 1
      state.navigationHighlight = {
        promptId: navigationHighlightPromptId,
        generation: navigationHighlightGeneration
      }
      navigationHighlightTimeoutId = window.setTimeout(() => {
        if (state.navigationHighlight?.generation === navigationHighlightGeneration) {
          state.navigationHighlight = null
        }
        navigationHighlightTimeoutId = null
      }, PROMPT_NAVIGATION_HIGHLIGHT_DURATION_MS)
    } else if (source !== 'tree-click' || !row.startsWith('prompt:')) {
      state.navigationHighlight = null
      if (navigationHighlightTimeoutId !== null) {
        window.clearTimeout(navigationHighlightTimeoutId)
        navigationHighlightTimeoutId = null
      }
    }

    const target: PromptNavigationTarget = {
      screenRootFolderId,
      contentOwnerId,
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
        expandDetails: contentReveal.expandDetails ?? true
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
    get contentOwnerId() {
      return state.contentOwnerId
    },
    get selectedRow() {
      return state.selectedRow
    },
    get selectionSource() {
      return state.selectionSource
    },
    get navigationHighlight() {
      return state.navigationHighlight
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
