import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'

type DraftRecord = { id: string; isEdited: boolean }
type ContentRecord = { id: string }

type MarkdownContentDraftConfig<
  TSummary extends ContentRecord,
  TFull extends ContentRecord,
  TDraft extends DraftRecord
> = {
  authoritativeCollectionId: string
  getDraft: (contentId: string) => TDraft | undefined
  getDrafts: () => TDraft[]
  getDraftIds: () => string[]
  insertDrafts: (drafts: TDraft[]) => void
  updateDrafts: (contentIds: string[], update: (draft: TDraft) => void) => void
  deleteDrafts: (contentIds: string[]) => void
  toSummaryDraft: (content: TSummary) => TDraft
  applySummary: (draft: TDraft, content: TSummary) => void
  hasSameSummary: (draft: TDraft, content: TSummary) => boolean
  toFullDraft: (content: TFull, isEdited: boolean) => TDraft
  haveSameDraft: (left: TDraft, right: TDraft) => boolean
  beforeFullUpsert?: (existing: TDraft | undefined, next: TDraft) => void
  beforeDelete?: (contentIds: string[]) => void
}

export const createMarkdownContentDraftMutations = <
  TSummary extends ContentRecord,
  TFull extends ContentRecord,
  TDraft extends DraftRecord
>(
  config: MarkdownContentDraftConfig<TSummary, TFull, TDraft>
) => {
  const upsertSummaryDrafts = (contents: TSummary[]): void => {
    const inserts: TDraft[] = []
    const updates = new Map<string, TSummary>()
    for (const content of contents) {
      const existing = config.getDraft(content.id)
      if (!existing) {
        inserts.push(config.toSummaryDraft(content))
      } else if (!config.hasSameSummary(existing, content)) {
        updates.set(content.id, content)
      }
    }
    if (inserts.length > 0) config.insertDrafts(inserts)
    const updateIds = [...updates.keys()]
    if (updateIds.length > 0) {
      config.updateDrafts(updateIds, (draft) => config.applySummary(draft, updates.get(draft.id)!))
    }
  }

  const upsertDrafts = (contents: TFull[]): void => {
    const inserts: TDraft[] = []
    const updates = new Map<string, TDraft>()
    for (const content of contents) {
      const existing = config.getDraft(content.id)
      const next = config.toFullDraft(content, existing?.isEdited ?? false)
      config.beforeFullUpsert?.(existing, next)
      if (!existing) {
        inserts.push(next)
      } else if (!config.haveSameDraft(existing, next)) {
        updates.set(content.id, next)
      }
    }
    if (inserts.length > 0) config.insertDrafts(inserts)
    const updateIds = [...updates.keys()]
    if (updateIds.length > 0) {
      config.updateDrafts(updateIds, (draft) => Object.assign(draft, updates.get(draft.id)!))
    }
  }

  const deleteDrafts = (contentIds: string[]): void => {
    if (contentIds.length === 0) return
    config.beforeDelete?.(contentIds)
    config.deleteDrafts(contentIds)
  }

  const removeDraft = (contentId: string): void => deleteDrafts([contentId])

  const flushAutosaves = async (): Promise<void> => {
    await Promise.allSettled(
      config
        .getDrafts()
        .map((draft) =>
          submitPacedUpdateTransactionAndWait(config.authoritativeCollectionId, draft.id)
        )
    )
  }

  const clearDraftStore = (): void => deleteDrafts(config.getDraftIds())

  return {
    upsertSummaryDrafts,
    upsertDrafts,
    deleteDrafts,
    removeDraft,
    flushAutosaves,
    clearDraftStore
  }
}
