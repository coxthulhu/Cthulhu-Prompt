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
  deleteAuthoritative: (key: string) => void
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

  const writeAuthoritative = (message: ChangeMessageOrDeleteKeyMessage<TRecord, string>): void => {
    if (!syncBegin || !syncWrite || !syncCommit) {
      return
    }

    // Side effect: bypass pending optimistic persistence and apply server truth immediately.
    syncBegin({ immediate: true })
    syncWrite(message)
    syncCommit()
  }

  const getAuthoritativeRevision = (key: string): number => {
    return authoritativeRevisions.get(key) ?? 0
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
        const key = snapshot.id
        const hasCollectionRecord = collection?.has(key) ?? false
        const hasKnownRecord = hasCollectionRecord || authoritativeRevisions.has(key)
        const currentRevision = authoritativeRevisions.get(key) ?? 0

        if (hasKnownRecord && snapshot.revision <= currentRevision) {
          return
        }

        authoritativeRevisions.set(key, snapshot.revision)
        const type = hasCollectionRecord ? 'update' : 'insert'
        writeAuthoritative({
          type,
          value: snapshot.data
        })
      },
      deleteAuthoritative: (key) => {
        authoritativeRevisions.delete(key)
        writeAuthoritative({
          type: 'delete',
          key
        })
      },
      getAuthoritativeRevision
    },
    startSync: true,
    gcTime: 0
  }
}
