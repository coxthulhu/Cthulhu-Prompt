---
name: tanstack-db-mutations
description: |
  Cthulhu Prompt revision mutation patterns. Use when adding or changing optimistic insert/update/delete behavior, multi-collection manual transactions, expected revisions, IPC persistence, authoritative success/conflict reconciliation, rollback, local draft acceptance, global ordering, or debounced autosave.
---

# Revision Mutations

Persist renderer changes through the shared revision mutation framework. Do not add collection-level persistence handlers, `createOptimisticAction`, or `createPacedMutations` to existing authoritative entity flows.

## Standard Mutation Flow

Use `runRevisionMutation` from `data/IpcFramework/RevisionCollections`:

```ts
await runRevisionMutation<PromptRevisionResponsePayload>({
  mutateOptimistically: ({ collections }) => {
    collections.prompt.update(promptId, (draft) => {
      draft.title = nextTitle
    })
    collections.promptDraft.update(promptId, (draft) => {
      draft.title = nextTitle
    })
  },
  persistMutations: async ({ entities, invoke, transaction }) => {
    const latestPrompt = getLatestMutationModifiedRecord(
      transaction,
      promptCollection.id,
      promptId,
      () => promptCollection.get(promptId)!
    )

    const result = await invoke('update-prompt', {
      payload: {
        prompt: entities.prompt({ id: promptId, data: latestPrompt })
      }
    })

    if (result.success) {
      promptDraftCollection.utils.acceptMutations(transaction)
    }

    return result
  },
  handleSuccessOrConflictResponse: (payload) => {
    promptCollection.utils.upsertAuthoritative(payload.prompt)
  },
  conflictMessage: 'Prompt update conflict'
})
```

Adapt the payload to the existing shared IPC contract; do not invent a generic mutation endpoint.

## Optimistic Changes

Put every user-visible immediate change in `mutateOptimistically`. Use only the collection helpers passed into the callback so the framework can collect touched entity keys before replaying the changes into the transaction.

Update every affected authoritative relationship in the same transaction. For example, creating, moving, deleting, or completing a prompt can change the prompt, its draft, and one or two prompt folders.

Do not apply authoritative snapshots in `mutateOptimistically`.

## Persistence Payloads

Use the `entities` builders supplied to `persistMutations`. They add the collection's current authoritative `expectedRevision` and remove TanStack virtual properties before IPC serialization.

When paced transactions can merge multiple edits, read the most recent `mutation.modified` record with `getLatestMutationModifiedRecord`; do not persist a stale value captured before the transaction changed.

Use `invoke` for the normal typed payload path. Follow the nearest mutation when a channel uses a specialized shared request type.

## Success, Conflict, and Rollback

Apply response payloads in `handleSuccessOrConflictResponse` through authoritative collection utilities. The framework invokes this handler for both success and conflict payloads so server truth is available before a failed transaction rolls its optimistic layer back.

Return success only after persistence completes. Throw or return a failed/conflict result so `RevisionMutation.ts` throws and TanStack DB rolls back optimistic state.

Run destructive authoritative cleanup, navigation, or cache removal in `onSuccess` when it must occur only after the transaction reaches `completed`.

## Local-Only Collections

Manual transactions do not automatically retain local-only mutations. After IPC success, explicitly accept each local-only collection changed by the transaction:

```ts
if (mutationResult.success) {
  promptDraftCollection.utils.acceptMutations(transaction)
}
```

Do not accept draft mutations before server success. Failed persistence must roll them back with the authoritative optimistic changes.

Direct local-only inserts and updates remain appropriate for initial draft hydration and renderer-session state that does not participate in an authoritative transaction.

Choose draft reconciliation policy per entity by following its closest existing helper:

- Prompt hydration replaces authoritative fields while preserving the session `isEdited` latch.
- System settings hydration replaces the form inputs from authoritative settings.
- Prompt UI-state success or conflict responses overwrite the matching draft with response truth.

Do not assume one policy fits every draft. Define and test what happens when authoritative truth arrives while a paced edit is pending.

## Creation Contracts

For a new keyed entity, use a client-generated stable ID and an `expectedRevision` of `0` through the normal entity builder. Follow prompt UI state for optimistic insert-or-update behavior. For required singleton entities such as system settings, load the existing record before allowing updates rather than treating absence as an implicit create.

## Global Ordering

Preserve the single global mutation queue in `RevisionMutation.ts`. It ensures expected revisions and authoritative responses settle in renderer intent order across entity types.

Before an immediate mutation touches an entity with a pending paced update, flush the matching paced transaction. Do not allow an immediate operation to overtake unsaved edits to the same collection ID and element ID.

## Paced Autosave

Use `mutatePacedRevisionUpdateTransaction` for prompt, settings, persistence, and UI-state autosave. The custom registry provides behavior the generic TanStack pacing helpers do not encode for this application:

- one pending transaction per global collection/element key
- debounce restart after each edit
- mutation merging within that transaction
- optional validation before enqueue
- explicit per-element and global flush-and-wait operations
- matching paced-update flush before immediate mutations
- commit through the same global queue as immediate mutations

Use `validateBeforeEnqueue` for draft inputs that may temporarily be invalid. When an immediate operation supersedes an invalid paced update, the registry performs a secondary rollback and removes the pending transaction.

Use the existing flush helpers before workspace changes, navigation that can discard drafts, application teardown, or other boundaries already covered by `AutosaveFlushes.svelte.ts`.

Current aggregate flushes use `Promise.allSettled`. “Flush and wait” therefore means all save tasks settled, not that every save succeeded; workspace switching can continue and clear workspace-scoped drafts after a failed save. Preserve this behavior unless the task explicitly changes failure UX, blocking, retry, or recovery semantics.

The current paced setter APIs return `void`, enqueue tracking converts rejection into a settled tracking promise, and aggregate flushes use `allSettled`. Callers therefore cannot currently surface a paced persistence failure by catching a setter or flush. If a task requires user-visible autosave errors, extend the shared mutation framework with an explicit error callback or result channel and test it; do not imply the existing controller can observe the rejection.

Do not catch and swallow errors inside the transaction `mutationFn`, because TanStack rollback depends on rejection.

## Testing

Cover these behaviors when affected:

- optimistic state appears before IPC completion
- success commits authoritative and draft state
- failure rolls both back
- conflict applies response truth and rejects the transaction
- same-entity paced edits merge
- immediate mutations flush matching paced edits first
- unrelated entity keys remain independent until the global commit queue
- flush helpers await active and already in-flight work
