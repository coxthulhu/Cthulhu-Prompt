---
name: dnd-kit-svelte
description: Implement and troubleshoot drag-and-drop features built with @dnd-kit/svelte in this repository. Use when work touches DragDropProvider, DragOverlay, createDraggable, createDroppable, createSortable, sensors, modifiers, plugin configuration, collision handling, drag lifecycle callbacks, or sortable reorder behavior.
---

# DND Kit Svelte

Use this skill for drag-and-drop work powered by `@dnd-kit/svelte`.

## Source Of Truth

- Installed package: `node_modules/@dnd-kit/svelte` (version `0.3.2`).
- Validate API behavior against:
  - `node_modules/@dnd-kit/svelte/dist/core/*.d.ts`
  - `node_modules/@dnd-kit/svelte/dist/sortable/*.d.ts`
  - `node_modules/@dnd-kit/svelte/dist/core/**/*.svelte*`
  - `node_modules/@dnd-kit/dom/index.d.ts`
  - `node_modules/@dnd-kit/dom/sortable.d.ts`

## Workflow

1. Start with `references/quickstart.md`.
2. Load only the focused reference file for your task:
   - Provider/events/config: `references/components/drag-drop-provider.md`
   - Overlay behavior: `references/components/drag-overlay.md`
   - Draggable: `references/primitives/create-draggable.md`
   - Droppable: `references/primitives/create-droppable.md`
   - Sortable: `references/primitives/create-sortable.md`
3. Implement with Svelte 5 runes and `{@attach ...}` attachments.
4. Validate with lint/typecheck/tests when the task changes behavior.

## Implementation Rules

- Keep primitives and hooks inside the same `<DragDropProvider>` subtree.
- Use stable unique ids for draggable/droppable/sortable entities.
- Apply attachments to the intended elements.
- For reactive primitive inputs (`id`, `disabled`, `index`, `group`, `accept`, etc.), use object property getters (for example `get index() { return index; }`). Do not pass callback values like `index: () => index`.
- Import `createSortable` from `@dnd-kit/svelte/sortable`.
- Use `event.canceled` guards in drag-end handlers before persisting changes.

## Pitfalls To Check First

- `getDragDropManager was called outside of a DragDropProvider`: primitive/hook created outside provider.
- Drag callbacks not firing: wrong provider boundary or missing `{@attach ...}` directive.
- Overlay not visible: no active source, overlay disabled, or no overlay snippet content.
- Sortable reorder glitches: stale `index`/`group` values, incorrect source/target attachment, or missing reorder commit on drag end.

## Common Task Map

- Make item draggable: `references/primitives/create-draggable.md`
- Build a drop zone: `references/primitives/create-droppable.md`
- Reorder list/grid: `references/primitives/create-sortable.md`
- Configure sensors/plugins/events: `references/components/drag-drop-provider.md`
- Customize drag preview/drop animation: `references/components/drag-overlay.md`
