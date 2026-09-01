---
name: tanstack-db-query
description: |
  Cthulhu Prompt renderer IPC load and authoritative reconciliation patterns. Use when adding or changing functions under data/Queries, loading revision envelopes through preload APIs, normalizing prompt representations, hydrating client state, pruning removed entities, or coordinating startup and folder-level loading state.
---

# IPC Loads and Reconciliation

In this repository, a “query” is a preload-backed renderer-to-main IPC load followed by authoritative collection reconciliation. Do not use QueryCollection, TanStack Query, `queryFn`, query keys, refetch utilities, or REST calls for existing data flows.

## Load Through Preload IPC

Put renderer load functions under `src/renderer/src/data/Queries` and use the shared request/result types:

```ts
export const loadPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadPromptFolderInitialResult, LoadPromptFolderInitialPayload>(
      'load-prompt-folder-initial',
      { workspaceId, promptFolderId }
    )
  )

  // Normalize, reconcile authoritative collections, and hydrate client state.
}
```

Use `ipcInvoke` for channels without a request payload and `ipcInvokeWithPayload` for payloads described by shared TypeScript types. Both go through the preload-backed renderer API. Their caller-supplied generics do not create a central compile-time channel map. For payload-bearing channels, runtime safety comes from the matching parser in `src/main/IpcFramework/IpcValidation.ts`. The current no-payload system-settings and user-persistence startup query handlers do not parse the request/client context; follow their handler pattern unless the task explicitly adds validation for no-payload contexts. Never call Electron or filesystem APIs directly from a query module.

Wrap loads with `runLoad` so unsuccessful `IpcResult` values become thrown errors handled by the owning startup or feature flow.

## Apply Revision Envelopes

Responses contain authoritative revision envelopes. Apply them with revision collection utilities:

```ts
workspaceCollection.utils.upsertAuthoritative(result.workspace)
promptFolderCollection.utils.upsertManyAuthoritative(result.promptFolders)
promptCollection.utils.upsertManyAuthoritative(promptSnapshots)
```

Do not unwrap an envelope and call ordinary collection `insert` or `update`; that would bypass revision ordering and optimistic reconciliation.

The revision adapter ignores stale snapshots. Prompt loads additionally allow a full prompt to replace a summary prompt at the same revision.

## Normalize Representations

Normalize IPC data before authoritative insertion when the shared domain has distinct renderer representations:

- Use `createPromptSummary` for workspace-level prompt lists.
- Use `createPromptFull` for prompt-folder initial loads and mutation responses.
- Use the equivalent prompt-template constructor when loading template summaries.
- Serialize full prompt data with the established persisted conversion before mutation IPC.

Keep normalization in query or mutation boundary code, not in components.

## Hydrate Client State

After applying authoritative snapshots, call the appropriate `data/UiState` upsert functions to hydrate or reconcile renderer client state. Preserve session-only fields according to the closest helper.

Examples include:

- prompt and template edit markers
- prompt-folder load markers
- system-settings form inputs

Do not construct duplicate client-state shapes in query modules or components.

## Prune Removed Entities

For graph or subset reloads:

1. Capture IDs reachable from the previous authoritative state.
2. Apply all newer response snapshots.
3. Compute IDs absent from the reconciled response graph.
4. Delete those IDs through authoritative bulk delete utilities.
5. Delete matching client state.

Reconcile only the entities owned by the load contract. For example, the current prompt-folder initial load prunes removed prompts and prompt client state, while other associated collections have their own lifecycle. Do not infer cross-entity deletes that the response does not establish.

Do not clear whole authoritative singleton collections when switching or reloading a workspace; preserve revision-aware reconciliation and delete only records proven absent. Workspace-scoped client-state collections are cleared through `WorkspaceStoreBridge.ts` after their autosaves flush.

## Main-Process Companion Work

When adding a new loadable entity, inspect and update the applicable main-process pieces:

- persistence and its `RevisionData`/committed-store definition, including a SQLite migration when required
- load code that places persisted data in the committed store before building revision snapshots
- exact-shape query request parsers in `IpcFramework/IpcValidation.ts` for payload-bearing channels
- a query handler that consumes the validated request, or the established direct handler pattern for a no-payload startup query
- handler setup registration in `NormalStartup.ts`

The committed store owns the authoritative in-memory revision used by query snapshots and domain mutations, regardless of whether persistence is file-backed or SQLite-backed. Do not add a parallel entry to `Registries/Revisions.ts`.

For mutation command/parser/planner registration, target/revision conflicts, atomic persistence, and generic snapshots, use the mutation skill rather than adding mutation-specific query reconciliation.

## Loading Boundaries

- Load system settings and user persistence before the first Svelte mount in `main.ts`.
- Load workspaces on explicit select/create/restore flows.
- Load full prompt-folder data on navigation, while workspace loads retain prompt summaries.
- Track active request IDs and feature loading/error state in the owning Svelte component or controller.
- Do not rely on revision collection `isReady()` or live-query `isLoading` for IPC requests made outside collection sync.

## Testing

Test normalization, stale/equal/new revision behavior, pruning, client-state preservation, failed `IpcResult` handling, and overlapping load ordering when those paths change.
