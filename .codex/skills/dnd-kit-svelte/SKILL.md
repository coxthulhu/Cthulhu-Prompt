---
name: dnd-kit-svelte
description: Implement and troubleshoot drag-and-drop features built with @dnd-kit/svelte in this repository. Use when work touches DragDropProvider, DragOverlay, createDraggable, createDroppable, createSortable, sensors, modifiers, plugin configuration, collision handling, drag lifecycle callbacks, or sortable reorder behavior.
---

# DND Kit Svelte

Use this skill whenever modifying drag-and-drop behavior or reviewing regressions in dnd-kit flows.

## Load References

- Start with `references/quickstart.mdx` for baseline setup and API shape.
- Load component references for provider-level behavior:
  - `references/components/drag-drop-provider.mdx`
  - `references/components/drag-overlay.mdx`
- Load primitive references for entity behavior:
  - `references/primitives/create-draggable.mdx`
  - `references/primitives/create-droppable.mdx`
  - `references/primitives/create-sortable.mdx`

## Implement

1. Wrap drag surfaces with `<DragDropProvider>` and wire only needed lifecycle handlers.
2. Keep IDs unique and stable across renders.
3. Set explicit draggable `type` values and matching droppable `accept` rules when drop targets should be restricted.
4. Prefer getter inputs for reactive primitive options inside `{#each}` (for example `index: () => index` for sortable).
5. Check `event.canceled` before persisting state changes in drag-end handlers.
6. Use one `<DragOverlay>` per provider and render with `{#snippet children(source)}` when custom preview is needed.

## Debug Checklist

- Verify attach directives are bound to expected elements (`attach`, `attachHandle`, `attachSource`, `attachTarget`).
- Verify drop acceptance/type config (`accept`, `type`) and collision configuration.
- If sortable behavior is unexpected, compare optimistic plugin behavior versus manual reorder logic.
- If drag preview is wrong, validate overlay snippet branching on `source.id`.
- If drag callbacks do not fire, verify component nesting under the same provider.

## Common Task Map

- "Make item draggable" -> `references/primitives/create-draggable.mdx`
- "Create drop zone / restrict drops" -> `references/primitives/create-droppable.mdx`
- "Reorder list/grid" -> `references/primitives/create-sortable.mdx`
- "Customize drag lifecycle behavior" -> `references/components/drag-drop-provider.mdx`
- "Customize drag preview animation/UI" -> `references/components/drag-overlay.mdx`
