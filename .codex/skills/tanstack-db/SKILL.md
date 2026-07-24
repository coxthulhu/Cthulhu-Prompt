---
name: tanstack-db
description: |
  Cthulhu Prompt's TanStack DB architecture for the Svelte renderer. Use when changing renderer collections, preload-backed IPC loads, live-query subscriptions, optimistic revision mutations, local draft state, authoritative reconciliation, autosave pacing, or TanStack collection validation boundaries and tests in this repository.
---

# TanStack DB in Cthulhu Prompt

Treat TanStack DB as the renderer's reactive entity cache and optimistic transaction engine. The application does not use TanStack Query, QueryCollection, REST fetching, or collection-level persistence handlers.

## Architecture

Use this data flow:

```text
preload-backed IPC load with shared TypeScript shapes
  -> authoritative revision snapshot
  -> revision collection sync write
  -> local-only draft hydration when needed
  -> useLiveQuery subscription
  -> Svelte 5 derived view state

user intent
  -> shared manual transaction
  -> optimistic changes across revision and draft collections
  -> serialized IPC mutation with expected revisions
  -> authoritative success/conflict snapshots
  -> commit or automatic rollback
```

Keep the two collection roles distinct:

- Use revision collections for persisted main-process entities.
- Use local-only collections for renderer-session drafts, form inputs, and editor UI state.
- Keep revisions in the revision collection's side map, not in entity records.
- Load and persist only through preload-backed IPC helpers and shared request/result types. Require main-process runtime parsers for payload-bearing channels; preserve the established no-payload startup-query exception unless the task changes it.

## Routing

| Work | Skill |
| --- | --- |
| Define or change revision/local-only collections and authoritative sync utilities | `collections/` |
| Subscribe to collections and derive Svelte 5 renderer state | `live-queries/` |
| Add optimistic writes, conflicts, rollback, autosave, or transaction ordering | `mutations/` |
| Add or change IPC load/reconciliation functions under `data/Queries` | `query/` |
| Decide collection types, normalization, or runtime validation boundaries | `schemas/` |

Read the relevant child `SKILL.md` completely before editing that area.

## Canonical Files

- `src/renderer/src/data/Collections/RevisionCollection.ts`
- `src/renderer/src/data/IpcFramework/RevisionCollections.ts`
- `src/renderer/src/data/IpcFramework/RevisionMutation.ts`
- `src/renderer/src/data/IpcFramework/RevisionMutationTransactionRegistry.ts`
- `src/renderer/src/data/UiState/AutosaveFlushes.svelte.ts`
- `src/renderer/src/data/Queries/`
- `src/renderer/src/data/Mutations/`
- `src/renderer/src/data/UiState/`
- `src/main/IpcFramework/IpcValidation.ts`
- `src/main/Registries/Revisions.ts`
- `src/main/NormalStartup.ts`
- `src/main/Queries/` and `src/main/Mutations/`

Inspect the closest existing entity flow and its tests before adding a new pattern.

## Repository Rules

- Import TanStack APIs from `@tanstack/svelte-db` unless an existing local pattern requires a core type.
- Use Svelte 5 runes for renderer state. Do not add Svelte stores.
- Do not introduce QueryCollection, TanStack Query, collection persistence handlers, `createOptimisticAction`, or built-in paced mutation strategies into the existing revision flows.
- Do not call Node APIs or main-process modules from the renderer.
- Preserve optimistic rollback by throwing on failed or conflicting persistence.
- Reconcile server responses through revision collection utilities; do not overwrite authoritative state with ordinary collection mutations.
- Call `acceptMutations(transaction)` for each local-only collection whose transaction changes should survive a successful manual commit.
- Preserve the global mutation queue and per-element paced-update ordering.
- Add or update Vitest tests for collection, reconciliation, or transaction logic. Add Playwright coverage when behavior is visible in the UI.

## Implementation Workflow

1. Identify the authoritative entities and renderer-only draft entities involved.
2. Inspect their collection, query, mutation, UI-state, shared IPC type, applicable main runtime parser, revision owner, handler registration, and persistence files.
3. Load typed revision envelopes and apply them through authoritative utilities.
4. Express user-visible changes in `mutateOptimistically` using the provided collection helpers.
5. Build IPC payload entities from the latest transaction state and authoritative expected revisions.
6. Apply success or conflict snapshots before allowing the transaction result to settle.
7. Accept successful local-only mutations explicitly.
8. Throw persistence errors so TanStack DB rolls optimistic state back.
9. Verify mutation ordering, revision handling, draft synchronization, and user-visible behavior.
