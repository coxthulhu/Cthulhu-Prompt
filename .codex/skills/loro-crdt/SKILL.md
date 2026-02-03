---
name: loro-crdt
description: Explain and apply the Loro CRDT JavaScript/TypeScript API. Use when requests mention Loro (loro-crdt), LoroDoc/LoroText/LoroMap/LoroList/LoroTree/LoroMovableList/LoroCounter, export/import sync, presence via EphemeralStore, UndoManager, versioning/frontiers/checkout, or general CRDT collaboration patterns in JS/TS apps.
---

## Overview

Loro is a powerful Conflict-free Replicated Data Type (CRDT) library that enables real-time collaboration. This API reference provides comprehensive documentation for all classes, methods, and types available in the JavaScript/TypeScript binding.

Note: Under the hood, Loro combines a Fugue-based CRDT core with Eg-walker-inspired techniques that use simple index operations and replay only the divergent history when merging. This yields fast local edits, efficient merges, and low overhead without permanent tombstones. 

## Pitfalls & Best Practices

**Peer ID Management**

- **Never share PeerIDs** between concurrent sessions (tabs/devices) - causes document divergence
- Use random PeerIDs (default) unless you have strict single-ownership locking
- Don't assign fixed PeerIDs to users or devices

**UTF-16 Text Encoding**

- All text operations use UTF-16 indices by default in JS API
- Slicing in the middle of multi-unit codepoints corrupts them
- Use `insertUtf8()`/`deleteUtf8()` for UTF-8 systems

**Container Creation**

- Concurrent child container creation inside the same LoroMap at same key causes overwrites
- Initialize all child containers for a LoroMap upfront when possible
- Operations on the root containers will not override each other

- Events emit synchronously during commit/import/checkout in JS API (v1.8+). Stay on `<=1.7.x`? Await a microtask before reading batched events.
- Import/export/checkout trigger automatic commits
- Loro transactions are NOT ACID - no rollback/isolation

**Version Control**

- After `checkout()`, document enters read-only "detached" mode, unless `setDetachedEditing(true)` is called
- Frontiers can't determine complete operation sets without history

**Data Structure Choice**

- Use strings in Map for URLs/IDs (LWW), LoroText for collaborative editing

## Common Tasks & Examples

**Getting Started**

- **Create a document**: `new LoroDoc()` - Initialize a new collaborative document
- **Add containers**: `getText`, `getList`, `getMap`, `getTree`
- **Listen to changes**: `subscribe` - React to document modifications
- **Export/Import state**: `export` and `import` - Save and load documents

**Real-time Collaboration**

- **Sync between peers**: `export` with `mode: "update"` + `import`/`importBatch` - Exchange incremental updates
- **Stream updates**: `subscribeLocalUpdates` - Send changes over WebSocket/WebRTC
- **Set unique peer ID**: `setPeerId` - Ensure each client has a unique identifier
- **Handle conflicts**: Automatic - All Loro data types are CRDTs that merge concurrent edits

**Rich Text Editing**

- **Create rich text**: `getText` - Initialize a collaborative text container
- **Edit text**: `insert`, `delete`, `applyDelta`
- **Apply formatting**: `mark` - Add bold, italic, links, custom styles
- **Copy styled snippets**: `sliceDelta` - Get a Delta for a range (UTF-16; use `sliceDeltaUtf8` for byte offsets)
- **Track cursor positions**: `getCursor` + `getCursorPos` - Stable positions across edits
- **Configure styles**: `configTextStyle` - Define expand behavior for marks

**Data Structures**

- **Ordered lists**: `getList` - Arrays with `push`, `insert`, `delete`
- **Key-value maps**: `getMap` - Objects with `set`, `get`, `delete`
- **Hierarchical trees**: `getTree` - File systems, nested comments with `createNode`, `move`
- **Reorderable lists**: `getMovableList` - Drag-and-drop with `move`, `set`
- **Counters**: `getCounter` - Distributed counters with `increment`

**Ephemeral State & Presence**

- **User presence**: `EphemeralStore` - Share cursor positions, selections, user status (not persisted)
- **Cursor syncing**: Use `EphemeralStore.set` with cursor data from `getCursor`
- **Live indicators**: Track who's online, typing indicators, mouse positions
- **Important**: EphemeralStore is a separate CRDT without history - perfect for temporary state that shouldn't persist

**Version Control & History**

- **Undo/redo**: `UndoManager` - Local undo of user's own edits
- **Time travel**: `checkout` to any `frontiers` - Debug or review history
- **Version tracking**: `version`, `frontiers`, `versionVector`
- **Fork documents**: `fork` or `forkAt` - Create branches for experimentation
- **Merge branches**: `import` - Combine changes from forked documents

**Performance & Storage**

- **Incremental updates**: `export` from specific `version` - Send only changes
- **Compact history**: `export` with `mode: "snapshot"` - Full state with compressed history
- **Shallow snapshots**: `export` with `mode: "shallow-snapshot"` - State without partial history (see Shallow Snapshots)

## Basic Usage

```typescript twoslash
import { LoroDoc } from "loro-crdt";

const doc = new LoroDoc();
const text = doc.getText("text");
text.insert(0, "Hello World");

// Subscribe to changes
const unsubscribe = doc.subscribe((event) => {
 console.log("Document changed:", event);
});

// Export updates for synchronization
const updates = doc.export({ mode: "update" });
```
