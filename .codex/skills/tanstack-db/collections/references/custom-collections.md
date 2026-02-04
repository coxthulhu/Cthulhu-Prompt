# Custom Collections

Build your own collection type for custom data sources.

## When to Build Custom

- Integrating with unsupported sync engine
- Custom caching requirements
- Specialized data source (WebSocket, IndexedDB, etc.)
- Unique persistence patterns

## Collection Interface

Implement the `Collection` interface from `@tanstack/db`:

```ts
import type {
  CollectionStatus,
  InsertConfig,
  OperationConfig,
  Transaction,
} from '@tanstack/db'

interface Collection<TData, TKey> {
  // Identity
  id: string

  // Read operations
  get(key: TKey): TData | undefined
  has(key: TKey): boolean
  toArray: TData[]
  size: number

  // Write operations
  insert(item: TData | TData[], config?: InsertConfig): Transaction
  update(
    key: TKey | TKey[],
    updater: (draft: TData) => void,
    config?: OperationConfig,
  ): Transaction
  delete(key: TKey | TKey[], config?: OperationConfig): Transaction

  // Status + state
  status: CollectionStatus
  isReady(): boolean
  isLoadingSubset: boolean
  state: Map<TKey, TData>

  // Utilities (collection-specific)
  utils: Record<string, (...args: Array<unknown>) => unknown>
}
```

## Basic Structure

```ts
import { createCollection, type CollectionConfig } from '@tanstack/db'

export function myCollectionOptions<TData, TKey>(
  options: MyCollectionConfig<TData, TKey>,
): CollectionConfig<TData, TKey> {
  return {
    id: options.id,
    getKey: options.getKey,
    schema: options.schema,

    // Sync configuration
    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        let ready = false

        // Set up data sync
        const cleanup = subscribeToDataSource((data) => {
          begin()
          write({
            type: 'insert',
            key: options.getKey(data),
            value: data,
          })
          commit()

          if (!ready) {
            markReady()
            ready = true
          }
        })

        return () => cleanup()
      },
    },

    // Mutation handlers
    onInsert: options.onInsert,
    onUpdate: options.onUpdate,
    onDelete: options.onDelete,
  }
}
```

## Example: WebSocket Collection

```ts
export function websocketCollectionOptions<TData, TKey>(config: {
  id: string
  url: string
  getKey: (item: TData) => TKey
  schema?: StandardSchema
  onInsert?: MutationFn
  onUpdate?: MutationFn
  onDelete?: MutationFn
}): CollectionConfig<TData, TKey> {
  return {
    id: config.id,
    getKey: config.getKey,
    schema: config.schema,

    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        const ws = new WebSocket(config.url)
        let ready = false

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data)

          begin()

          switch (message.type) {
            case 'initial':
              message.data.forEach((item: TData) => {
                write({
                  type: 'insert',
                  key: config.getKey(item),
                  value: item,
                })
              })
              if (!ready) {
                markReady()
                ready = true
              }
              break
            case 'insert':
              write({
                type: 'insert',
                key: config.getKey(message.data),
                value: message.data,
              })
              break
            case 'update':
              write({
                type: 'update',
                key: config.getKey(message.data),
                value: message.data,
              })
              break
            case 'delete':
              write({
                type: 'delete',
                key: message.key,
              })
              break
          }

          commit()
        }

        return () => ws.close()
      },
    },

    onInsert:
      config.onInsert ??
      (async ({ transaction }) => {
        // Default: send via WebSocket
        ws.send(
          JSON.stringify({
            type: 'insert',
            data: transaction.mutations.map((m) => m.modified),
          }),
        )
      }),

    onUpdate: config.onUpdate,
    onDelete: config.onDelete,
  }
}
```

## Example: IndexedDB Collection

```ts
import { openDB, type IDBPDatabase } from 'idb'

export function indexedDBCollectionOptions<TData, TKey>(config: {
  id: string
  dbName: string
  storeName: string
  getKey: (item: TData) => TKey
  schema?: StandardSchema
}): CollectionConfig<TData, TKey> {
  let db: IDBPDatabase

  return {
    id: config.id,
    getKey: config.getKey,
    schema: config.schema,

    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        void (async () => {
          db = await openDB(config.dbName, 1, {
            upgrade(db) {
              db.createObjectStore(config.storeName, {
                keyPath: 'id',
              })
            },
          })

          // Load initial data
          const items = await db.getAll(config.storeName)
          begin()
          items.forEach((item) => {
            write({
              type: 'insert',
              key: config.getKey(item),
              value: item,
            })
          })
          commit()
          markReady()
        })()

        return () => {
          db?.close()
        }
      },
    },

    onInsert: async ({ transaction }) => {
      const tx = db.transaction(config.storeName, 'readwrite')
      await Promise.all(
        transaction.mutations.map((m) => tx.store.add(m.modified)),
      )
      await tx.done
    },

    onUpdate: async ({ transaction }) => {
      const tx = db.transaction(config.storeName, 'readwrite')
      await Promise.all(
        transaction.mutations.map((m) => tx.store.put(m.modified)),
      )
      await tx.done
    },

    onDelete: async ({ transaction }) => {
      const tx = db.transaction(config.storeName, 'readwrite')
      await Promise.all(
        transaction.mutations.map((m) => tx.store.delete(m.key as IDBValidKey)),
      )
      await tx.done
    },
  }
}
```

## Applying External Changes

Use the `sync` callback's `begin`/`write`/`commit` helpers to apply external updates:

```ts
sync: ({ begin, write, commit }) => {
  const applyInsert = (item) => {
    begin()
    write({ type: 'insert', key: getKey(item), value: item })
    commit()
  }

  const applyDelete = (key) => {
    begin()
    write({ type: 'delete', key })
    commit()
  }
}
```

## Collection State

Track collection status:

```ts
const status = myCollection.status
const isReady = myCollection.isReady()
const isLoadingSubset = myCollection.isLoadingSubset

// Svelte template example:
// {#if status === 'loading'}
//   <Loading />
// {:else if status === 'error'}
//   <div>Failed to load collection</div>
// {:else if isReady}
//   <div>Ready</div>
// {/if}
```

## Testing Custom Collections

```ts
import { createCollection } from '@tanstack/db'

describe('MyCustomCollection', () => {
  it('loads initial data', async () => {
    const collection = createCollection(
      myCollectionOptions({
        id: 'test',
        getKey: (item) => item.id,
        // ... test config
      }),
    )

    // Wait for sync
    await waitFor(() => collection.size > 0)

    expect(collection.toArray).toHaveLength(expectedCount)
  })
})
```

## Reference Implementations

Study existing implementations:

- `@tanstack/query-db-collection` - REST API integration
- `@tanstack/electric-db-collection` - Real-time sync
- Built-in `localOnlyCollectionOptions` - Simple in-memory
- Built-in `localStorageCollectionOptions` - Browser persistence
