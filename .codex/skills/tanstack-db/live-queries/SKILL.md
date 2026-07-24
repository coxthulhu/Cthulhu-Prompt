---
name: tanstack-db-live-queries
description: |
  Cthulhu Prompt Svelte 5 live-query patterns. Use when subscribing renderer components or .svelte.ts controllers to TanStack collections, building reactive lookup maps, deriving hierarchical prompt-folder views, choosing between live queries and imperative collection reads, or handling reactive query inputs.
---

# Live Queries and Svelte-Derived Views

Use `useLiveQuery` as the reactive bridge from singleton collections into Svelte 5 components and `.svelte.ts` controllers. Build screen-specific maps, ordering, tree traversal, and display projections with runes.

## Subscribe to a Collection

Follow the nearest existing style:

```ts
import { useLiveQuery } from '@tanstack/svelte-db'
import type { Prompt } from '@shared/Prompt'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'

const promptQuery = useLiveQuery(promptCollection) as { data: Prompt[] }
```

The query result is reactive through Svelte 5 getters. Access `query.data` directly; never use a `$` store prefix.

Use builder syntax when it improves the local read:

```ts
const settingsQuery = useLiveQuery((query) =>
  query.from({ settings: systemSettingsCollection }).findOne()
) as { data: SystemSettings }
```

Startup loads settings before mounting the application, so this established singleton assertion is valid there. Do not copy a non-null result cast to data that can genuinely be absent during rendering.

## Derive Renderer Views with Runes

Build keyed lookup objects and hierarchical views with `$derived.by`:

```ts
const promptById = $derived.by(() => {
  const records: Record<string, Prompt> = {}

  for (const prompt of promptQuery.data) {
    records[prompt.id] = prompt
  }

  return records
})
```

Keep these operations in Svelte-derived code when they depend on application structure rather than relational filtering:

- Preserve workspace and prompt-folder entry order.
- Traverse nested prompt-folder entries recursively.
- Merge authoritative entities with local draft records.
- Build status, title, completion, and owner lookup objects.
- Combine TanStack data with component props, navigation context, or local preview state.

Do not introduce a Svelte store for derived collection data.

## Dynamic Inputs

The established renderer pattern subscribes to stable collections and applies changing screen IDs or modes in `$derived` logic. This avoids recreating queries while navigation changes.

If a query callback itself captures a rune or prop, pass every captured reactive value as a dependency getter:

```ts
import { eq } from '@tanstack/svelte-db'

const selectedQuery = useLiveQuery(
  (query) =>
    query
      .from({ promptFolder: promptFolderCollection })
      .where(({ promptFolder }) => eq(promptFolder.id, promptFolderId))
      .findOne(),
  [() => promptFolderId]
)
```

Prefer the established full-collection-plus-derived pattern for hierarchical screens unless measurement shows query recreation or full scans are a problem.

## Imperative Reads

Use `collection.get`, `has`, or `toArray` instead of `useLiveQuery` inside:

- IPC load reconciliation
- mutation precondition checks
- optimistic payload preparation
- autosave flushes
- event handlers that only need a current snapshot

An imperative collection read is not reactive. Do not use it as the sole source for template-rendered state.

## Loading and Errors

Revision collections install their sync bridge before feature data loads. Track workspace and prompt-folder loading/error state in the owning Svelte controller or component, as the current renderer does. Do not assume `query.isLoading` represents an IPC request made outside the collection sync callback.

## Performance Guidance

- Reuse one live-query result within a component/controller instead of subscribing repeatedly.
- Build a lookup map once per derived recalculation rather than calling repeated array searches.
- Keep large text out of derived projections that only need status or IDs when a focused representation already exists.
- Preserve virtualization for long prompt lists; a live query does not replace DOM virtualization.
- Introduce TanStack query-builder filtering, selection, joins, or derived collections only for a measured benefit and keep hierarchical ordering semantics intact.
