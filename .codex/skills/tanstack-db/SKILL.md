---
name: tanstack-db
description: |
  Cthulhu Prompt's TanStack DB architecture for the Svelte renderer. Use when changing renderer collections, preload-backed IPC loads, live-query subscriptions, shared domain mutations, local client state, authoritative reconciliation, autosave pacing, or TanStack collection validation boundaries and tests in this repository.
---

# TanStack DB in Cthulhu Prompt

Treat TanStack DB as the renderer's reactive entity cache and optimistic transaction engine. The application does not use TanStack Query, QueryCollection, REST fetching, or collection-level persistence handlers.

## Architecture

Use this data flow:

```text
preload-backed IPC load with shared TypeScript shapes
  -> authoritative revision snapshot
  -> revision collection sync write
  -> local-only client-state hydration when needed
  -> useLiveQuery subscription
  -> Svelte 5 derived view state

user intent
  -> mutation-specific serializable command
  -> shared domain planner against renderer revision collections
  -> optimistic domain changes plus optional renderer-only client-state changes
  -> generic renderer mutation bridge and serialized IPC command
  -> same planner against main committed stores
  -> exact target/revision verification and atomic domain transitions
  -> authoritative success/conflict snapshots
  -> reconciliation followed by commit or automatic rollback
```

Keep the two collection roles distinct:

- Use revision collections for persisted main-process entities.
- Use client-state collections for renderer-session state such as edit markers, load markers, and form inputs.
- Keep revisions in the revision collection's side map, not in entity records.
- Express persisted feature mutations as shared commands, strict command parsers, and `DomainPlanner` functions used by both processes. Treat the manual TanStack transaction runner as framework infrastructure, not the feature API.
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
- `src/shared/DomainChanges.ts`
- `src/shared/*DomainMutations.ts`
- `src/renderer/src/data/IpcFramework/RendererDomainMutation.ts`
- `src/renderer/src/data/IpcFramework/RevisionMutation.ts` and `RevisionMutationTransactionRegistry.ts`
- `src/renderer/src/data/UiState/AutosaveFlushes.svelte.ts`
- `src/renderer/src/data/Queries/`
- `src/renderer/src/data/Mutations/`
- `src/renderer/src/data/UiState/`
- `src/main/Mutations/DomainMutation.ts`
- `src/main/Data/DomainTransitions.ts`
- `src/main/Data/AtomicDataTransaction.ts`
- `src/main/Persistence/DomainStorageAdapters.ts`
- `src/main/IpcFramework/IpcValidation.ts` for query and non-domain request parsers
- `src/main/NormalStartup.ts`
- `src/main/Queries/` and `src/main/Mutations/`

Inspect the closest existing entity flow and its tests before adding a new pattern.

## Repository Rules

- Import TanStack APIs from `@tanstack/svelte-db` unless an existing local pattern requires a core type.
- Use Svelte 5 runes for renderer state. Do not add Svelte stores.
- Use `runImmediateRendererDomainMutation`, `mutatePacedRendererDomainMutation`, and `handleMainDomainMutation` for persisted domain changes. Do not call `runRevisionMutation` directly from ordinary feature mutation modules.
- Do not introduce QueryCollection, TanStack Query, collection persistence handlers, `createOptimisticAction`, or built-in paced mutation strategies into the existing revision flows.
- Do not call Node APIs or main-process modules from the renderer.
- Preserve optimistic rollback by throwing on failed or conflicting persistence.
- Reconcile server responses through revision collection utilities; do not overwrite authoritative state with ordinary collection mutations.
- Put renderer-only optimistic changes in `renderer.mutate`. The low-level runner automatically accepts every touched registered client-state collection after success; do not call or configure `acceptMutations` in feature code.
- Keep each authoritative entity registered consistently in the shared domain types, renderer collection adapters, main `data` stores, snapshot reconciliation, and persistence adapters.
- Mirror `targetPolicy` between a renderer revision collection and its main revision data. Use `deleteIfPresent` only for domain deletes that are intentionally idempotent when the record is missing.
- Preserve the global mutation queue and per-element paced-update ordering.
- Add or update Vitest tests for collection, reconciliation, or transaction logic. Add Playwright coverage when behavior is visible in the UI.

## Implementation Workflow

1. Identify the authoritative entities and renderer-only client-state records involved.
2. Inspect the closest shared command/parser/planner, renderer wrapper, main registration, collections, main data stores, storage adapters, and tests.
3. Put deterministic business rules and all authoritative inserts, updates, and deletes in one shared planner. Include generated IDs, timestamps, and other nondeterministic inputs in the command.
4. Dispatch the command through the immediate or paced renderer domain API. Add only renderer-session changes under `renderer.mutate`.
5. Register the same strict command parser and planner with `handleMainDomainMutation`.
6. Let the framework derive expectations, verify the main-computed target set, persist atomic domain transitions, reconcile snapshots, and accept touched client state.
7. Verify planner conflicts, target/revision conflicts, atomic persistence, rollback, paced ordering, and user-visible behavior.
