---
name: tanstack-db-collections
description: |
  Cthulhu Prompt renderer collection patterns. Use when defining or changing revision-backed authoritative collections, local-only draft collections, custom sync utilities, revision acceptance, entity keys, initial hydration, or authoritative deletes.
---

# Renderer Collections

Use one of the repository's two established collection types. Do not substitute QueryCollection or LocalStorageCollection for existing renderer data flows.

## Choose the Collection Role

| Role | Options creator | Examples |
| --- | --- | --- |
| Persisted authoritative entity | `revisionCollectionOptions<T>()` | workspace, prompt folder, prompt, settings, persistence |
| Renderer-session draft or UI state | `localOnlyCollectionOptions<T>()` | prompt drafts, folder drafts, settings inputs, editor view-state drafts |

Create singleton collections in `src/renderer/src/data/Collections`.

## Revision Collections

Define persisted entity collections with the shared revision adapter:

```ts
import { createCollection } from '@tanstack/svelte-db'
import type { PromptFolder } from '@shared/PromptFolder'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptFolderCollection = createCollection(
  revisionCollectionOptions<PromptFolder>({
    id: 'prompt-folders',
    getKey: (promptFolder) => promptFolder.id
  })
)
```

The adapter owns these responsibilities:

- Store the latest authoritative revision separately from entity data.
- Ignore stale snapshots.
- Apply external truth through `begin({ immediate: true })`, `write`, and `commit`.
- Expose bulk and single authoritative upsert/delete utilities.
- Mark the sync bridge ready immediately; feature loading state remains separate from collection readiness.
- Strip sync callbacks on collection cleanup.

Use the utilities for IPC results:

```ts
promptCollection.utils.upsertManyAuthoritative(promptSnapshots)
promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
const expectedRevision = promptCollection.utils.getAuthoritativeRevision(promptId)
```

Do not use ordinary `insert`, `update`, or `delete` to apply server truth. Those methods are for optimistic transaction changes.

### Equal Revisions

Reject equal revisions by default. Add `shouldAcceptEqualRevision` only for a concrete representation upgrade, such as replacing a prompt summary with a full prompt at the same revision. Do not use it as a general last-write-wins escape hatch.

### Bulk Reconciliation

Prefer `upsertManyAuthoritative` and `deleteManyAuthoritative` when applying one IPC response. Compute removed IDs from the previously known graph and the response graph, then delete authoritative records and matching drafts together.

## Local-Only Draft Collections

Use local-only collections for editable copies and renderer-session markers:

```ts
import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
```

Keep draft record shapes specific to UI needs. A draft can flatten persisted data, keep string form inputs, or add session-only flags such as `isEdited` and `hasLoadedInitialData`.

Hydrate drafts through functions under `data/UiState`; do not duplicate draft construction in components. Preserve an edited draft when an authoritative refresh must not discard current renderer-session input.

When a manual transaction changes a local-only collection, call its `utils.acceptMutations(transaction)` only after IPC persistence succeeds.

## Reads

- Use `collection.get`, `has`, and `toArray` for imperative loaders, mutation preparation, flushes, and event handlers.
- Use `useLiveQuery` for state rendered by Svelte components or reactive controllers.
- Do not expect revision collection readiness to describe an active IPC load. Use the feature's explicit loading state.

## Change Checklist

- Keep collection IDs globally unique and stable.
- Keep entity keys aligned with IPC revision envelope IDs.
- Keep renderer keys and envelope IDs stable even when the main revision store uses a composite scope key such as `workspaceId:promptId`.
- Add a revision collection to `RevisionCollections.ts` when it participates in shared mutations.
- Add its local draft collection to the optimistic collection map when one transaction changes both.
- Reconcile authoritative deletes as well as upserts.
- Test stale, equal, newer, bulk, delete, rollback, and summary-to-full cases that apply.
