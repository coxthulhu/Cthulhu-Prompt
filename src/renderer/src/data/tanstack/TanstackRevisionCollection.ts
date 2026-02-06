import type {
  ChangeMessageOrDeleteKeyMessage,
  Collection,
  CollectionConfig,
  SyncConfig,
  UtilsRecord
} from '@tanstack/svelte-db'

export interface TanstackRevisionCollectionUtils<
  TRecord extends object,
  TKey extends string | number
> extends UtilsRecord {
  upsertAuthoritative: (record: TRecord) => void
  deleteAuthoritative: (key: TKey) => void
}

type TanstackRevisionCollectionConfig<
  TRecord extends object,
  TKey extends string | number
> = {
  id: string
  getKey: (record: TRecord) => TKey
  initialData?: Array<TRecord>
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
        for (const record of initialData) {
          params.write({
            type: 'insert',
            value: record
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
      upsertAuthoritative: (record) => {
        const key = getKey(record)
        const type = collection?.has(key) ? 'update' : 'insert'
        writeAuthoritative({
          type,
          value: record
        })
      },
      deleteAuthoritative: (key) => {
        writeAuthoritative({
          type: 'delete',
          key
        })
      }
    },
    startSync: true,
    gcTime: 0
  }
}
