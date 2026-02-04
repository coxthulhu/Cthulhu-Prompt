---
name: tanstack-db-collections
description: |
  Collection types and configuration in TanStack DB.
  Use for QueryCollection, local collections, and sync modes.
---

# Collections

Collections are typed data stores that decouple data loading from data binding. They can be populated from REST APIs, sync engines, or local storage, then queried uniformly with live queries.

## Collection Types

| Type                       | Package                             | Use Case                             |
| -------------------------- | ----------------------------------- | ------------------------------------ |
| **QueryCollection**        | `@tanstack/query-db-collection`     | REST APIs via TanStack Query         |
| **LocalStorageCollection** | `@tanstack/db`                      | Browser localStorage persistence     |
| **LocalOnlyCollection**    | `@tanstack/db`                      | In-memory state (no persistence)     |

## Common Patterns

### QueryCollection (REST APIs)

```ts
import { createCollection } from '@tanstack/svelte-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos')
      return response.json()
    },
    getKey: (item) => item.id,
    schema: todoSchema, // Optional: Zod, Valibot, etc.

    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((m) =>
          fetch('/api/todos', {
            method: 'POST',
            body: JSON.stringify(m.modified),
          }),
        ),
      )
    },

    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((m) =>
          fetch(`/api/todos/${m.original.id}`, {
            method: 'PUT',
            body: JSON.stringify(m.modified),
          }),
        ),
      )
    },

    onDelete: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((m) =>
          fetch(`/api/todos/${m.original.id}`, { method: 'DELETE' }),
        ),
      )
    },
  }),
)
```

### Sync Modes

Control how data loads into collections:

```ts
const productsCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['products'],
    queryFn: async (ctx) => {
      // Query predicates available in ctx.meta for on-demand mode
      const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
      return api.getProducts(params)
    },
    getKey: (item) => item.id,

    // Choose sync mode:
    syncMode: 'eager', // Default: Load all upfront (<10k rows)
    // syncMode: 'on-demand', // Load only what queries request (>50k rows)
  }),
)
```

| Mode          | Behavior                                   | Best For                                |
| ------------- | ------------------------------------------ | --------------------------------------- |
| `eager`       | Load entire collection upfront             | <10k rows, mostly static data           |
| `on-demand`   | Load only what queries request             | >50k rows, search interfaces, catalogs  |


### LocalStorageCollection

```ts
import {
  createCollection,
  localStorageCollectionOptions,
} from '@tanstack/svelte-db'

const settingsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'user-settings',
    storageKey: 'app-settings',
    getKey: (item) => item.id,
    schema: settingsSchema,
  }),
)

// Data persists across sessions and syncs across tabs
settingsCollection.insert({ id: 'theme', value: 'dark' })
```

### LocalOnlyCollection

```ts
import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/svelte-db'

const uiStateCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'ui-state',
    getKey: (item) => item.id,
  }),
)

// In-memory only, lost on refresh
uiStateCollection.insert({ id: 'sidebar', expanded: true })
```

### Collection with Schema

```ts
import { z } from 'zod'

const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  completed: z.boolean().default(false),
  created_at: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .default(() => new Date()),
})

const todoCollection = createCollection(
  queryCollectionOptions({
    schema: todoSchema, // Validates inserts/updates, transforms types
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
  }),
)
```

### Using TanStack Query Client

```ts
import { QueryClient } from '@tanstack/svelte-query'

const queryClient = new QueryClient()

const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
    queryClient, // Use your existing query client
  }),
)
```

## Collection API

```ts
// Read operations
collection.get(key) // Get item by key
collection.has(key) // Check if key exists
collection.toArray // Get all items as array
collection.size // Number of items

// Write operations (trigger handlers)
collection.insert(item) // Insert item(s)
collection.update(key, fn) // Update item(s) with draft function
collection.delete(key) // Delete item(s)

// Utilities (collection-specific)
collection.utils.refetch() // QueryCollection: refetch from API
collection.utils.acceptMutations(transaction) // LocalCollection: accept in manual tx
```

## Configuration Options

```ts
// Base CollectionConfig (for custom sync implementations)
interface CollectionConfig {
  id?: string // Unique identifier
  getKey: (item) => Key // Extract unique key from item
  schema?: StandardSchema // Validation schema (Zod, Valibot, etc.)
  sync: SyncConfig // Required when using createCollection directly

  // Persistence handlers
  onInsert?: InsertMutationFn
  onUpdate?: UpdateMutationFn
  onDelete?: DeleteMutationFn
}

// QueryCollection options (from @tanstack/query-db-collection)
queryCollectionOptions({
  queryKey: QueryKey,
  queryFn: QueryFn,
  queryClient?: QueryClient,
  syncMode?: 'eager' | 'on-demand',
})
```

## Collection-Specific Skills

For detailed patterns on each collection type, see the dedicated skill directories:

| Skill                   | Directory       | When to Use                                     |
| ----------------------- | --------------- | ----------------------------------------------- |
| **QueryCollection**     | `../query/`     | REST API integration, TanStack Query, refetch   |
| **TrailBaseCollection** | `../trailbase/` | TrailBase events, type conversions              |

## Detailed References

| Reference                          | When to Use                                 |
| ---------------------------------- | ------------------------------------------- |
| `references/local-collections.md`  | LocalStorage, LocalOnly, cross-tab sync     |
| `references/sync-modes.md`         | Eager vs on-demand tradeoffs                 |
| `references/custom-collections.md` | Building your own collection type           |
