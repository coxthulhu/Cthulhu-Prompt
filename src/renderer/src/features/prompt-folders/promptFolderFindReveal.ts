import type { PromptFolderFindMatch, PromptFolderFindRowHandle } from './promptFolderFindTypes'
import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
import { promptEditorRowId } from './promptFolderRowIds'

type RowHandleMap = {
  get: (promptId: string) => PromptFolderFindRowHandle | undefined
}

type RevealContext = {
  query: string
  rowHandlesByPromptId: RowHandleMap
  scrollToWithinWindowBand: ScrollToWithinWindowBand
  waitForRows: () => Promise<void>
}

const ensureRowHandle = async (
  match: PromptFolderFindMatch,
  context: RevealContext
): Promise<PromptFolderFindRowHandle | null> => {
  const existing = context.rowHandlesByPromptId.get(match.promptId)
  if (existing) return existing
  const rowId = promptEditorRowId(match.promptId)
  context.scrollToWithinWindowBand(rowId, 0, 'center')
  await context.waitForRows()
  return context.rowHandlesByPromptId.get(match.promptId) ?? null
}

const revealTitleMatch = async (
  match: Extract<PromptFolderFindMatch, { kind: 'title' }>,
  context: RevealContext
) => {
  const rowHandle = await ensureRowHandle(match, context)
  if (!rowHandle) return
  const centerOffsetPx = rowHandle.getTitleCenterOffset()
  if (centerOffsetPx == null) return
  context.scrollToWithinWindowBand(rowHandle.rowId, centerOffsetPx, 'center')
}

const revealBodyMatch = async (
  match: Extract<PromptFolderFindMatch, { kind: 'body' }>,
  context: RevealContext
) => {
  const rowHandle = await ensureRowHandle(match, context)
  if (!rowHandle) return
  if (!rowHandle.isHydrated()) {
    const didHydrate = await rowHandle.ensureHydrated()
    if (!didHydrate) return
  }
  const centerOffsetPx = rowHandle.revealBodyMatch(context.query, match.bodyMatchIndex)
  if (centerOffsetPx == null) return
  context.scrollToWithinWindowBand(rowHandle.rowId, centerOffsetPx, 'center')
}

export const revealPromptFolderMatch = async (
  match: PromptFolderFindMatch,
  context: RevealContext
) => {
  if (match.kind === 'title') {
    await revealTitleMatch(match, context)
  } else {
    await revealBodyMatch(match, context)
  }
}
