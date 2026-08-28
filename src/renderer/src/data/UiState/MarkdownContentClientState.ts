import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'

/** Shared shape for prompt and template client-state records. */
type ClientStateRecord = { id: string; isEdited: boolean }
type ContentRecord = { id: string }

/** Collection adapters shared by prompt and template client-state helpers. */
type MarkdownContentClientStateConfig<TClientState extends ClientStateRecord> = {
  authoritativeCollectionId: string
  getClientState: (contentId: string) => TClientState | undefined
  getClientStates: () => TClientState[]
  getClientStateIds: () => string[]
  insertClientStates: (clientStates: TClientState[]) => void
  deleteClientStates: (contentIds: string[]) => void
  createClientState: (contentId: string) => TClientState
  beforeDelete?: (contentIds: string[]) => void
}

/** Creates shared lifecycle helpers for local prompt and template client state. */
export const createMarkdownContentClientState = <TClientState extends ClientStateRecord>(
  config: MarkdownContentClientStateConfig<TClientState>
) => {
  /** Inserts client-state records that do not already exist. */
  const upsertClientStates = (contents: ContentRecord[]): void => {
    /** Missing renderer-session records created by this upsert. */
    const inserts = contents.flatMap((content) =>
      config.getClientState(content.id) ? [] : [config.createClientState(content.id)]
    )
    if (inserts.length > 0) config.insertClientStates(inserts)
  }

  /** Deletes client state and associated renderer-only UI caches. */
  const deleteClientStates = (contentIds: string[]): void => {
    if (contentIds.length === 0) return
    config.beforeDelete?.(contentIds)
    config.deleteClientStates(contentIds)
  }

  /** Deletes one client-state record. */
  const removeClientState = (contentId: string): void => deleteClientStates([contentId])

  /** Waits for all autosaves represented by the current client state to settle. */
  const flushAutosaves = async (): Promise<void> => {
    await Promise.allSettled(
      config
        .getClientStates()
        .map((clientState) =>
          submitPacedUpdateTransactionAndWait(config.authoritativeCollectionId, clientState.id)
        )
    )
  }

  /** Clears every record from this renderer-session collection. */
  const clearClientStateCollection = (): void =>
    deleteClientStates(config.getClientStateIds())

  return {
    upsertClientStates,
    deleteClientStates,
    removeClientState,
    flushAutosaves,
    clearClientStateCollection
  }
}
