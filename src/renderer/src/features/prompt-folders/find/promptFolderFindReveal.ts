import type { PromptFolderFindMatch, PromptFolderFindRowHandle } from './promptFolderFindTypes'
import type { ScrollToWithinWindowBand } from '../../virtualizer/virtualWindowTypes'

type RowHandleMap = {
  get: (entityId: string) => PromptFolderFindRowHandle | undefined
}

type RevealContext = {
  query: string
  rowHandlesByEntityId: RowHandleMap
  getRowIdForEntity: (entityId: string) => string | null
  scrollToWithinWindowBand: ScrollToWithinWindowBand
  waitForRows: () => Promise<void>
}

const ensureRowHandle = async (
  match: PromptFolderFindMatch,
  context: RevealContext
): Promise<PromptFolderFindRowHandle | null> => {
  const existing = context.rowHandlesByEntityId.get(match.entityId)
  if (existing) return existing
  const rowId = context.getRowIdForEntity(match.entityId)
  if (!rowId) return null
  context.scrollToWithinWindowBand(rowId, 0, 'center')
  await context.waitForRows()
  return context.rowHandlesByEntityId.get(match.entityId) ?? null
}

export const revealPromptFolderMatch = async (
  match: PromptFolderFindMatch,
  context: RevealContext
) => {
  const rowHandle = await ensureRowHandle(match, context)
  if (!rowHandle) return

  const sectionCenterOffsetPx = rowHandle.getSectionCenterOffset(match.sectionKey)
  if (sectionCenterOffsetPx != null) {
    context.scrollToWithinWindowBand(rowHandle.rowId, sectionCenterOffsetPx, 'center')
    return
  }

  if (rowHandle.shouldEnsureHydratedForSection(match.sectionKey) && !rowHandle.isHydrated()) {
    const didHydrate = await rowHandle.ensureHydrated()
    if (!didHydrate) return
  }

  const revealOffsetPx = rowHandle.revealSectionMatch(
    match.sectionKey,
    context.query,
    match.sectionMatchIndex
  )
  if (revealOffsetPx == null) return
  context.scrollToWithinWindowBand(rowHandle.rowId, revealOffsetPx, 'center')
}
