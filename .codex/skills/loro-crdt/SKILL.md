---
name: loro-crdt
description: Explain and apply the Loro CRDT JavaScript/TypeScript API. Use when requests mention Loro (loro-crdt), LoroDoc/LoroText/LoroMap/LoroList/LoroTree/LoroMovableList/LoroCounter, export/import sync, presence via EphemeralStore, UndoManager, versioning/frontiers/checkout, or general CRDT collaboration patterns in JS/TS apps.
---

# Loro CRDT

## Overview

Answer "how do I..." questions about Loro's JS/TS API with practical guidance, correct container choices, and concise TypeScript examples for collaboration, syncing, presence, and history.

## Quick Start Workflow

1. Identify the data model the user needs (text, list, map, tree, movable list, counter).
2. Provide a minimal TS snippet using `new LoroDoc()` and the right container getter.
3. Add sync guidance (`export({ mode: "update" })` + `import`/`importBatch`) when relevant.
4. Call out any applicable pitfalls (PeerID uniqueness, UTF-16 indices, detached mode after checkout).

## Core Tasks & Guidance

### Create and edit data

- Use `new LoroDoc()` to create a document.
- Use `getText`, `getList`, `getMap`, `getTree`, `getMovableList`, `getCounter` for containers.
- Provide usage for `insert`/`delete`/`mark` (text), `push`/`insert`/`delete` (list), `set`/`get`/`delete` (map), `createNode`/`move` (tree), and `increment` (counter).

### Sync & collaboration

- Use `export({ mode: "update" })` for incremental sync, `import`/`importBatch` to apply updates.
- Use `subscribeLocalUpdates` to stream updates over a transport (WebSocket/WebRTC).
- Ensure each concurrent session uses a unique PeerID (`setPeerId` only when you can guarantee uniqueness).

### Presence & ephemeral state

- Use `EphemeralStore` for cursor/selection/presence data; emphasize it is not persisted.
- Combine `LoroText.getCursor` with `EphemeralStore.set` for live cursors.

### Versioning & history

- Use `version`, `frontiers`, `versionVector` for tracking.
- Use `checkout` for time travel; mention detached mode after checkout.
- Use `fork`/`forkAt` to branch; merge via `import`.
- Use `UndoManager` for local undo/redo of the user’s own edits.

### Events & transactions

- Use `subscribe` for document change events.
- Note events emit synchronously during commit/import/checkout (v1.8+).
- Note import/export/checkout auto-commit and transactions are not ACID.

## Pitfalls to Surface

- Never share PeerIDs across concurrent sessions (tabs/devices); it can cause divergence.
- JS API uses UTF-16 indices; use `insertUtf8`/`deleteUtf8`/`sliceDeltaUtf8` when the user’s offsets are bytes.
- Concurrent child container creation at the same `LoroMap` key can overwrite; initialize upfront.
- After `checkout`, the doc is detached/read-only unless `setDetachedEditing(true)` is called.

## References

- Primary API reference: `references/loro-api-reference.mdx`.
- Use `rg -n "^## " references/loro-api-reference.mdx` to jump to sections.
- Search by method IDs like `LoroDoc.export`, `LoroText.insert`, `EphemeralStore`, `UndoManager`.

## Output Conventions

- Prefer TypeScript examples with minimal boilerplate.
- Include types and parameter names when ambiguous.
- If the user asks about version-specific behavior, read and cite the "Last updated" header from the reference file and mention the exact date/version.
