import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'

type DraftRecord = { id: string; isEdited: boolean }
type ContentRecord = { id: string }

/** Collection adapters shared by prompt and template edit-marker helpers. */
type MarkdownContentDraftConfig<TDraft extends DraftRecord> = {
  authoritativeCollectionId: string
  getDraft: (contentId: string) => TDraft | undefined
  getDrafts: () => TDraft[]
  getDraftIds: () => string[]
  insertDrafts: (drafts: TDraft[]) => void
  deleteDrafts: (contentIds: string[]) => void
  createDraft: (contentId: string) => TDraft
  beforeDelete?: (contentIds: string[]) => void
}

/** Creates shared lifecycle helpers for local prompt and template edit markers. */
export const createMarkdownContentDraftMutations = <TDraft extends DraftRecord>(
  config: MarkdownContentDraftConfig<TDraft>
) => {
  /** Inserts edit markers that do not already exist. */
  const upsertMarkers = (contents: ContentRecord[]): void => {
    /** Missing renderer-session markers created by this upsert. */
    const inserts = contents.flatMap((content) =>
      config.getDraft(content.id) ? [] : [config.createDraft(content.id)]
    )
    if (inserts.length > 0) config.insertDrafts(inserts)
  }

  /** Inserts missing markers for full content loads. */
  const upsertDrafts = (contents: ContentRecord[]): void => {
    upsertMarkers(contents)
  }

  /** Deletes edit markers and associated renderer-only UI caches. */
  const deleteDrafts = (contentIds: string[]): void => {
    if (contentIds.length === 0) return
    config.beforeDelete?.(contentIds)
    config.deleteDrafts(contentIds)
  }

  /** Deletes one edit marker. */
  const removeDraft = (contentId: string): void => deleteDrafts([contentId])

  /** Waits for all autosaves represented by the current edit markers to settle. */
  const flushAutosaves = async (): Promise<void> => {
    await Promise.allSettled(
      config
        .getDrafts()
        .map((draft) =>
          submitPacedUpdateTransactionAndWait(config.authoritativeCollectionId, draft.id)
        )
    )
  }

  /** Clears every edit marker from this renderer-session collection. */
  const clearDraftStore = (): void => deleteDrafts(config.getDraftIds())

  return {
    upsertSummaryDrafts: upsertMarkers,
    upsertDrafts,
    deleteDrafts,
    removeDraft,
    flushAutosaves,
    clearDraftStore
  }
}
