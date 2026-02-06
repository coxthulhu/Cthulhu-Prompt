import type {
  ChangeMessageOrDeleteKeyMessage,
  Collection,
  CollectionConfig,
  SyncConfig,
  UtilsRecord
} from '@tanstack/svelte-db'
import type { TanstackRevisionEnvelope } from '@shared/tanstack/TanstackRevision'

export interface TanstackRevisionCollectionUtils<
  TRecord extends object,
  TKey extends string | number
> extends UtilsRecord {
  upsertAuthoritative: (snapshot: TanstackRevisionEnvelope<TKey, TRecord>) => void
  deleteAuthoritative: (key: TKey) => void
  getAuthoritativeRevision: (key: TKey) => number
}

type TanstackRevisionCollectionConfig<
  TRecord extends object,
  TKey extends string | number
> = {
  id: string
  getKey: (record: TRecord) => TKey
  initialData?: Array<TanstackRevisionEnvelope<TKey, TRecord>>
}

type TanstackRevisionCollectionOptionsResult<
  TRecord extends object,
  TKey extends string | number
> = CollectionConfig<TRecord, TKey, never, TanstackRevisionCollectionUtils<TRecord, TKey>> & {
  utils: TanstackRevisionCollectionUtils<TRecord, TKey>
}

export const tanstackRevisionCollectionOptions = <
  TRecord extends object,
  TKey extends string | number
>(
  config: TanstackRevisionCollectionConfig<TRecord, TKey>
): TanstackRevisionCollectionOptionsResult<TRecord, TKey> => {
  const { id, getKey, initialData = [] } = config
  const authoritativeRevisions = new Map<TKey, number>()

  let syncBegin:
    | ((options?: { immediate?: boolean }) => void)
    | null = null
  let syncWrite: ((message: ChangeMessageOrDeleteKeyMessage<TRecord, TKey>) => void) | null = null
  let syncCommit: (() => void) | null = null
  let collection:
    | Collection<TRecord, TKey, TanstackRevisionCollectionUtils<TRecord, TKey>>
    | null = null

  const writeAuthoritative = (message: ChangeMessageOrDeleteKeyMessage<TRecord, TKey>): void => {
    if (!syncBegin || !syncWrite || !syncCommit) {
      return
    }

    // Side effect: bypass pending optimistic persistence and apply server truth immediately.
    syncBegin({ immediate: true })
    syncWrite(message)
    syncCommit()
  }

  const getAuthoritativeRevision = (key: TKey): number => {
    if (!collection?.has(key) && !authoritativeRevisions.has(key)) {
      return 0
    }

    return authoritativeRevisions.get(key) ?? 0
  }

  const sync: SyncConfig<TRecord, TKey> = {
    sync: (params) => {
      syncBegin = params.begin
      syncWrite = params.write
      syncCommit = params.commit
      collection =
        params.collection as Collection<
          TRecord,
          TKey,
          TanstackRevisionCollectionUtils<TRecord, TKey>
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
