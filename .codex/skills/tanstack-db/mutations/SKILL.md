---
name: tanstack-db-mutations
description: |
  Cthulhu Prompt shared domain mutation patterns. Use when adding or changing mutation commands, shared planners, strict command parsers, optimistic domain changes, renderer-only client state, main atomic transitions, conflicts, rollback, global ordering, or paced autosave.
---

# Shared Domain Mutations

Use the shared domain mutation framework for persisted feature changes. Feature modules dispatch mutation-specific commands through `RendererDomainMutation.ts`; `RevisionMutation.ts` and its manual TanStack transactions are the internal optimistic/ordering substrate, not the ordinary feature API.

Do not add collection-level persistence handlers, `createOptimisticAction`, built-in paced strategies, or feature-specific expected-revision payloads.

## Standard Feature Shape

Colocate a serializable command type, strict runtime parser, and shared `DomainPlanner` under `src/shared/*DomainMutations.ts`. Dispatch the command in the renderer:

```ts
const command = { categoryId, displayName }

await runImmediateRendererDomainMutation({
  mutation: { command, plan: planRenameCategoryDomainMutation },
  ipc: { channel: 'rename-category' },
  renderer: {}
})
```

Register the same parser and planner in the main process:

```ts
handleMainDomainMutation({
  ipc: { channel: 'rename-category' },
  mutation: {
    parseCommand: parseRenameCategoryDomainCommand,
    plan: planRenameCategoryDomainMutation
  }
})
```

Keep a mutation-specific IPC channel. The framework supplies the generic request, target/revision expectations, atomic execution, and authoritative response snapshots; it does not replace explicit command contracts.

## Shared Commands and Planners

Commands contain intent and every input both processes need. Generate stable IDs, timestamps, and other nondeterministic values in renderer feature code and put them in the command. For paced editing, use a set-style command containing the latest complete desired value rather than an incremental delta.

Strict command parsers must reject missing, mistyped, and additional properties. Keep command types serializable and free of TanStack virtual fields, renderer-only client state, functions, and process-specific objects.

The shared planner runs against a `DomainState` backed by renderer collections and again against main committed stores. It should:

- read entities through `state.get` and `state.getAll`
- normalize and enforce business invariants without process-specific APIs
- return all authoritative inserts, Immer-recipe updates, and deletes as `DomainChange[]`
- return a `DomainMutationConflict` with authoritative targets when the command cannot apply
- produce at most one change for each `entityType:id` target
- keep inserted `change.id` and `change.data.id` aligned when the record has an ID

Do not put renderer-only changes, navigation, cache cleanup, filesystem operations, or IPC calls in a planner. Prompt and template planner recipes must work against the summary/full projections allowed by `DomainPlannerEntityMap`.

## Renderer Dispatch

Use `runImmediateRendererDomainMutation` for an operation that should enter the global queue immediately. The renderer bridge runs the shared planner against current optimistic collection state, validates the plan, and applies every domain change through the transaction's collection helpers.

Put transaction-coupled renderer-session changes under `renderer.mutate`:

```ts
renderer: {
  mutate: ({ collections }) => {
    collections.promptClientState.update(promptId, (state) => {
      state.isEdited = true
    })
  }
}
```

Registered client-state collections touched by a successful transaction are detected and accepted automatically by `RevisionMutation.ts`. Do not call `acceptMutations`, pass client-state collection lists, or accept local state before persistence succeeds. A failed or conflicting mutation must roll authoritative and client-state optimism back together.

Direct client-state inserts and updates remain appropriate for query hydration and renderer-session changes that do not participate in a persisted domain mutation.

## Expectations, Main Execution, and Reconciliation

The renderer framework derives expectations from the already-computed domain plan only when persistence reaches the front of the global queue:

- inserts expect the target to be absent
- required updates and deletes expect the latest authoritative revision, or absence when the renderer has no authoritative record
- `deleteIfPresent` deletes omit a concurrency expectation

Feature code must not capture revisions or construct expectations. The main handler parses the complete wire request, reruns the same planner against current committed stores, and requires the renderer expectations to match the main-computed required target set exactly. It then verifies committed revisions, projects immutable before/after domain graphs, and runs the transitions atomically while already holding the main global mutation queue.

Business conflicts, target-set mismatches, revision mismatches, and atomic transition conflicts return current authoritative snapshots. The renderer reconciles success and conflict snapshots before the low-level transaction completes or rejects, so a rejected transaction rolls its optimistic layer back onto current server truth.

Keep persistence rules in `DomainStorageAdapters.ts` and the applicable persistence layer. Do not duplicate filesystem or SQLite behavior in planners or IPC registrations. Lifecycle actions that are not edits to an existing renderer domain graph, such as creating or closing a workspace, may retain their dedicated validated handlers; follow the closest existing operation instead of forcing them through domain planning.

## Creation and Deletion Contracts

For a new keyed entity, generate a stable client ID before dispatch and return an insert from the shared planner. The framework converts that target to an `absent` expectation and the transition layer enforces creation against a missing committed entry. Required singletons such as system settings must already be loaded; absence should produce a planner conflict rather than an implicit create.

`targetPolicy` defaults to `requirePresent`. Use `deleteIfPresent` only for records whose deletion is intentionally idempotent when missing, currently optional persisted UI state. Mirror the policy in the renderer revision collection and main `RevisionData`. The planner still returns the delete, main still includes the target in conflict/success snapshots, and the framework derives the expectation omission from policy rather than a caller-supplied target selector.

Authoritative deleted snapshots are reconciled through revision collection utilities. Entity-specific renderer reconciliation may also remove associated client state or clear caches; extend `RendererDomainMutation.ts` when a new entity needs such behavior.

## Paced Autosave

Use `mutatePacedRendererDomainMutation` for debounced persisted edits. A paced mutation must:

- declare exactly one authoritative `pacing.target`
- return exactly one shared domain change for that target
- use a replacement/set-style command so the latest invocation can supersede earlier commands
- keep its planner, IPC channel, renderer mutation shape, pacing target, and validation behavior stable while that target has a pending transaction

The underlying registry keeps one pending transaction per global collection/element key, restarts debounce after every edit, merges optimism into that transaction, and stores the latest command and plan for eventual persistence. Expectations are derived after earlier global work settles.

Use `validateBeforeEnqueue` when client-state inputs may temporarily be invalid. It receives the current merged transaction, so use the established transaction lookup helper when validation needs the latest client-state record. When an immediate operation supersedes an invalid matching paced transaction, the registry rolls the invalid transaction back, removes it, and replays the immediate optimism.

Before an immediate mutation applies optimism, the framework flushes paced work for every touched collection ID/element ID. All immediate and paced commits then serialize through the same renderer global queue, while the main domain handler also serializes atomic persistence through its global queue.

Use existing flush helpers before workspace changes, navigation that can discard client state, application teardown, or boundaries already covered by `AutosaveFlushes.svelte.ts`.

Current paced setter APIs return `void`. Aggregate flushes use `Promise.allSettled`, and enqueue tracking converts rejection to settled tracking promises. A flush therefore waits for work to settle but does not report that every save succeeded. If a task requires user-visible autosave failures, extend the shared framework with an explicit result/error channel and tests; do not imply callers can catch the current setter or aggregate flush.

Do not catch and swallow errors inside the low-level transaction `mutationFn`; TanStack rollback depends on rejection.

## Adding an Authoritative Entity

Update the complete dispatch surface when a new entity participates in domain mutations:

- `DomainEntityMap`, `DomainPlannerEntityMap` when a renderer projection is needed, and the relevant shared command/parser/planner module
- renderer revision collection plus `RevisionCollections.ts`
- renderer domain `get`, `getAll`, optimistic change, revision collection, and snapshot reconciliation dispatch
- main `data`/`RevisionData`, committed graph capture and entity ID resolution, snapshot construction, transition/persistence adapters, and loading
- matching renderer/main `targetPolicy` when nondefault
- main mutation registration and `NormalStartup.ts` setup when needed

Use the nearest existing entity flow. Missing one of these registrations commonly appears as an exhaustive switch failure or as renderer/main plans that cannot observe the same graph.

## Framework Boundaries

Call `runRevisionMutation` or `mutatePacedRevisionUpdateTransaction` directly only when changing the domain mutation bridge or low-level transaction framework, or when an existing exceptional flow demonstrably cannot be represented as a shared domain command. Do not copy their `persistMutations`, entity-builder, expectation, reconciliation, or manual-acceptance patterns into new feature code.

Preserve the low-level invariants:

- one global renderer commit queue
- matching paced work flushes before immediate optimism
- authoritative responses reconcile before a failed transaction rolls back
- only registered client-state collections actually touched are accepted after success
- errors and conflicts reject the manual transaction

## Testing

Cover the affected layers rather than mocking only the feature wrapper:

- shared planner changes and business conflicts in `domain-mutations.test.ts`
- strict command parsing and main target/revision checks in `main-domain-mutation.test.ts`
- renderer optimism, generic snapshots, rollback, client-state acceptance, and paced replacement in `renderer-domain-mutation.test.ts`
- storage projection and atomicity in `domain-persistence.test.ts` and `atomic-data-transaction.test.ts`
- thin feature wiring where command construction or renderer-only changes are specific to that feature
- low-level registry tests only when queueing, replay, validation, or flush mechanics change

When applicable, verify optimistic state before IPC completion, authoritative success, conflict truth followed by rollback, insert absence, optional deletes, same-target paced merging, matching-target flushes, unrelated target independence before the global queue, and flushes that await pending and already in-flight work.
