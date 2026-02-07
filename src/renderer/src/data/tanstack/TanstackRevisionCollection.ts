import type {
  ChangeMessageOrDeleteKeyMessage,
  Collection,
  CollectionConfig,
  SyncConfig,
  UtilsRecord
} from '@tanstack/svelte-db'
import type { TanstackRevisionEnvelope } from '@shared/tanstack/TanstackRevision'

export interface TanstackRevisionCollectionUtils<
  TRecord extends object
> extends UtilsRecord {
  upsertAuthoritative: (snapshot: TanstackRevisionEnvelope<TRecord>) => void
  deleteAuthoritative: (key: string) => void
  getAuthoritativeRevision: (key: string) => number
}

type TanstackRevisionCollectionConfig<TRecord extends object> = {
  id: string
  getKey: (record: TRecord) => string
  initialData?: Array<TanstackRevisionEnvelope<TRecord>>
}

type TanstackRevisionCollectionOptionsResult<TRecord extends object> = CollectionConfig<
  TRecord,
  string,
  never,
  TanstackRevisionCollectionUtils<TRecord>
> & {
  utils: TanstackRevisionCollectionUtils<TRecord>
}

export const tanstackRevisionCollectionOptions = <TRecord extends object>(
  config: TanstackRevisionCollectionConfig<TRecord>
): TanstackRevisionCollectionOptionsResult<TRecord> => {
  const { id, getKey, initialData = [] } = config
  const authoritativeRevisions = new Map<string, number>()

  let syncBegin:
    | ((options?: { immediate?: boolean }) => void)
    | null = null
  let syncWrite: ((message: ChangeMessageOrDeleteKeyMessage<TRecord, string>) => void) | null = null
  let syncCommit: (() => void) | null = null
  let collection: Collection<TRecord, string, TanstackRevisionCollectionUtils<TRecord>> | null = null

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
        TanstackRevisionCollectionUtils<TRecord>
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
