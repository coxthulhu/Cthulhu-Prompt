# createDraggable

Source: `node_modules/@dnd-kit/svelte/dist/core/draggable/createDraggable.svelte.*`

## Import

```ts
import {createDraggable} from '@dnd-kit/svelte';
```

## Input Type

`CreateDraggableInput = Omit<DraggableInput, 'handle' | 'element' | 'register'>`

Common reactive fields synced by the adapter:

- `id`
- `disabled` (default `false`)
- `feedback` (default `'default'`)
- `alignment`
- `modifiers`
- `sensors`
- `data`

## Return Shape

- `draggable`
- `isDragging`
- `isDropping`
- `isDragSource`
- `attach(node)`
- `attachHandle(node)`

## Reactive Input Pattern

```ts
const draggable = createDraggable({
  get id() {
    return item.id;
  },
  get disabled() {
    return item.locked;
  }
});
```

Use property getters for values that can change over time.
