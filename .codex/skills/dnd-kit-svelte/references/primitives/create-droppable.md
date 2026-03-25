# createDroppable

Source: `node_modules/@dnd-kit/svelte/dist/core/droppable/createDroppable.svelte.*`

## Import

```ts
import {createDroppable} from '@dnd-kit/svelte';
```

## Input Type

`CreateDroppableInput = Omit<DroppableInput, 'element' | 'register'>`

Common reactive fields synced by the adapter:

- `id`
- `accept`
- `type`
- `disabled` (default `false`)
- `collisionDetector`
- `data`

## Return Shape

- `droppable`
- `isDropTarget`
- `attach(node)`

## Usage Note

Use `accept`/`type` consistently when restricting drop targets.
