# createSortable

Source: `node_modules/@dnd-kit/svelte/dist/sortable/createSortable.svelte.*`

## Import

```ts
import {createSortable, isSortableOperation} from '@dnd-kit/svelte/sortable';
```

## Input Type

`CreateSortableInput = Omit<SortableInput, 'handle' | 'element' | 'source' | 'target' | 'register'>`

Important fields:

- `id`
- `index` (required)
- `group`
- `accept`
- `type`
- `disabled`
- `feedback`
- `alignment`
- `modifiers`
- `sensors`
- `collisionPriority`
- `transition`
- `plugins`
- `data`

Adapter behavior details:

- Transition is merged with `defaultSortableTransition`.
- `group` and `index` updates are batched atomically.
- If `transition.idle` is true and manager is idle, shape is refreshed when index changes.

## Return Shape

- `sortable`
- `isDragging`
- `isDropping`
- `isDragSource`
- `isDropTarget`
- `attach(node)`
- `attachHandle(node)`
- `attachSource(node)`
- `attachTarget(node)`

## Default Sortable Plugins

From `@dnd-kit/dom/sortable`:

- `SortableKeyboardPlugin`
- `OptimisticSortingPlugin`

## Reorder Commit Guard

```ts
if (event.canceled || !isSortableOperation(event.operation)) return;
```

Use `isSortableOperation` before reading sortable-specific fields like `source.index`.
