---
name: tanstack-db-collections
description: |
  Cthulhu Prompt renderer collection patterns. Use when defining or changing revision-backed authoritative collections, local-only client-state collections, custom sync utilities, revision acceptance, entity keys, initial hydration, or authoritative deletes.
---

# Renderer Collections

Use one of the repository's two established collection types. Do not substitute QueryCollection or LocalStorageCollection for existing renderer data flows.

## Choose the Collection Role

| Role | Options creator | Examples |
| --- | --- | --- |
| Persisted authoritative entity | `revisionCollectionOptions<T>()` | workspace, prompt folder, prompt, settings, persistence |
| Renderer-session client state | `localOnlyCollectionOptions<T>()` | prompt edit markers, folder load markers, settings inputs |

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
- Expose whether authoritative state contains a key and the collection's domain deletion `targetPolicy`.
- Ignore stale snapshots.
- Apply external truth through `begin({ immediate: true })`, `write`, and `commit`.
- Expose bulk and single authoritative upsert/delete utilities.
- Mark the sync bridge ready immediately; feature loading state remains separate from collection readiness.
- Strip sync callbacks on collection cleanup.

Use the utilities for IPC results:

```ts
promptCollection.utils.upsertManyAuthoritative(promptSnapshots)
promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
const hasAuthoritativePrompt = promptCollection.utils.hasAuthoritative(promptId)
```

Do not use ordinary `insert`, `update`, or `delete` to apply server truth. Those methods are for optimistic transaction changes.

Feature mutations do not read revisions or build expectations themselves. `RendererDomainMutation.ts` derives required `revision` or `absent` expectations from the shared plan after earlier queued work settles.

### Equal Revisions

Reject equal revisions by default. Add `shouldAcceptEqualRevision` only for a concrete representation upgrade, such as replacing a prompt summary with a full prompt at the same revision. Do not use it as a general last-write-wins escape hatch.

### Bulk Reconciliation

Prefer `upsertManyAuthoritative` and `deleteManyAuthoritative` when applying one IPC response. Compute removed IDs from the previously known graph and the response graph, then delete authoritative records and matching client state together.

### Domain Delete Policy

`targetPolicy` defaults to `requirePresent`. Set `deleteIfPresent` only when deleting a missing record is an intentional successful no-op, as with optional persisted UI-state cleanup. Mirror the same policy in the corresponding main `RevisionData`; the domain framework omits renderer concurrency expectations for those deletes and the main transition layer still includes their authoritative target/snapshot. Do not use this policy to weaken update, insert, or required-delete conflicts.

## Client-State Collections

Use local-only collections for renderer-session client state:

```ts
import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const promptClientStateCollection = createCollection(
  localOnlyCollectionOptions<PromptClientStateRecord>({
    id: 'prompt-client-state',
    getKey: (clientState) => clientState.id
  })
)
```

Keep client-state record shapes specific to renderer needs. Client state can keep string form inputs or session-only flags such as `isEdited` and `hasLoadedInitialData`.

Hydrate client state through functions under `data/UiState`; do not duplicate record construction in components. Preserve existing session-only state when authoritative refreshes should not reset it.

Register client-state collections in `RevisionCollections.ts`. After IPC success, the low-level revision runner detects which registered client-state collections the transaction actually touched and accepts them automatically. Feature mutation code must not call `acceptMutations` or list client-state collections manually.

## Reads

- Use `collection.get`, `has`, and `toArray` for imperative loaders, mutation preparation, flushes, and event handlers.
- Use `useLiveQuery` for state rendered by Svelte components or reactive controllers.
- Do not expect revision collection readiness to describe an active IPC load. Use the feature's explicit loading state.

## Change Checklist

- Keep collection IDs globally unique and stable.
- Keep entity keys aligned with IPC revision envelope IDs.
- Keep renderer keys and envelope IDs stable even when the main revision store uses a composite scope key such as `workspaceId:promptId`.
- Add a revision collection to `RevisionCollections.ts` when it participates in shared mutations.
- Add a client-state collection to both the optimistic and client-state maps when a domain transaction may change it.
- For a new authoritative domain entity, also update `DomainChanges.ts`, renderer domain state/change/reconciliation dispatch, main `data`, domain graph/snapshot dispatch, and persistence adapters.
- Mirror a nondefault `targetPolicy` in renderer collection and main revision data definitions.
- Reconcile authoritative deletes as well as upserts.
- Test stale, equal, newer, bulk, delete, rollback, and summary-to-full cases that apply.
