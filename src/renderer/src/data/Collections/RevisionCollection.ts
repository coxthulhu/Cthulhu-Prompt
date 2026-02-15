import type {
  ChangeMessageOrDeleteKeyMessage,
  Collection,
  CollectionConfig,
  SyncConfig,
  UtilsRecord
} from '@tanstack/svelte-db'
import type { RevisionEnvelope } from '@shared/Revision'

export interface RevisionCollectionUtils<
  TRecord extends object
> extends UtilsRecord {
  upsertAuthoritative: (snapshot: RevisionEnvelope<TRecord>) => void
  upsertManyAuthoritative: (snapshots: Array<RevisionEnvelope<TRecord>>) => void
  deleteAuthoritative: (key: string) => void
  deleteManyAuthoritative: (keys: Array<string>) => void
  getAuthoritativeRevision: (key: string) => number
}

type RevisionCollectionConfig<TRecord extends object> = {
  id: string
  getKey: (record: TRecord) => string
  initialData?: Array<RevisionEnvelope<TRecord>>
}

type RevisionCollectionOptionsResult<TRecord extends object> = CollectionConfig<
  TRecord,
  string,
  never,
  RevisionCollectionUtils<TRecord>
> & {
  utils: RevisionCollectionUtils<TRecord>
}

export const revisionCollectionOptions = <TRecord extends object>(
  config: RevisionCollectionConfig<TRecord>
): RevisionCollectionOptionsResult<TRecord> => {
  const { id, getKey, initialData = [] } = config
  const authoritativeRevisions = new Map<string, number>()

  let syncBegin:
    | ((options?: { immediate?: boolean }) => void)
    | null = null
  let syncWrite: ((message: ChangeMessageOrDeleteKeyMessage<TRecord, string>) => void) | null = null
  let syncCommit: (() => void) | null = null
  let collection: Collection<TRecord, string, RevisionCollectionUtils<TRecord>> | null = null

  const writeManyAuthoritative = (
    messages: Array<ChangeMessageOrDeleteKeyMessage<TRecord, string>>
  ): void => {
    if (!syncBegin || !syncWrite || !syncCommit) {
      return
    }
    if (messages.length === 0) {
      return
    }

    // Side effect: bypass pending optimistic persistence and apply server truth immediately.
    syncBegin({ immediate: true })
    for (const message of messages) {
      syncWrite(message)
    }
    syncCommit()
  }

  const getAuthoritativeRevision = (key: string): number => {
    return authoritativeRevisions.get(key) ?? 0
  }

  const collectUpsertMessages = (
    snapshots: Array<RevisionEnvelope<TRecord>>
  ): Array<ChangeMessageOrDeleteKeyMessage<TRecord, string>> => {
    const messages: Array<ChangeMessageOrDeleteKeyMessage<TRecord, string>> = []
    const queuedInsertKeys = new Set<string>()

    for (const snapshot of snapshots) {
      const key = snapshot.id
      const hasCollectionRecord = (collection?.has(key) ?? false) || queuedInsertKeys.has(key)
      const hasKnownRecord = hasCollectionRecord || authoritativeRevisions.has(key)
      const currentRevision = authoritativeRevisions.get(key) ?? 0

      if (hasKnownRecord && snapshot.revision <= currentRevision) {
        continue
      }

      authoritativeRevisions.set(key, snapshot.revision)
      const type = hasCollectionRecord ? 'update' : 'insert'
      if (type === 'insert') {
        queuedInsertKeys.add(key)
      }

      messages.push({
        type,
        value: snapshot.data
      })
    }

    return messages
  }

  const collectDeleteMessages = (
    keys: Array<string>
  ): Array<ChangeMessageOrDeleteKeyMessage<TRecord, string>> => {
    const messages: Array<ChangeMessageOrDeleteKeyMessage<TRecord, string>> = []

    for (const key of keys) {
      authoritativeRevisions.delete(key)
      messages.push({
        type: 'delete',
        key
      })
    }

    return messages
  }

  const sync: SyncConfig<TRecord, string> = {
    sync: (params) => {
      syncBegin = params.begin
      syncWrite = params.write
      syncCommit = params.commit
      collection = params.collection as Collection<
        TRecord,
        string,
        RevisionCollectionUtils<TRecord>
      >

      if (initialData.length > 0) {
        params.begin()
        for (const snapshot of initialData) {
          authoritativeRevisions.set(snapshot.id, snapshot.revision)
          params.write({
            type: 'insert',
            value: snapshot.data
          })
        }
        params.commit()
      }

      params.markReady()

      return () => {
        syncBegin = null
        syncWrite = null
        syncCommit = null
        collection = null
      }
    },
    getSyncMetadata: () => ({})
  }

  return {
    id,
    getKey,
    sync,
    utils: {
      upsertAuthoritative: (snapshot) => {
        writeManyAuthoritative(collectUpsertMessages([snapshot]))
      },
      upsertManyAuthoritative: (snapshots) => {
        writeManyAuthoritative(collectUpsertMessages(snapshots))
      },
      deleteAuthoritative: (key) => {
        writeManyAuthoritative(collectDeleteMessages([key]))
      },
      deleteManyAuthoritative: (keys) => {
        writeManyAuthoritative(collectDeleteMessages(keys))
      },
      getAuthoritativeRevision
    },
    startSync: true,
    gcTime: 0
  }
}
