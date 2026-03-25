# Quickstart (@dnd-kit/svelte 0.3.2)

## Minimal Drag + Drop

```svelte
<script lang="ts">
  import {DragDropProvider, createDraggable, createDroppable} from '@dnd-kit/svelte';

  let droppedIn = $state(false);

  const draggable = createDraggable({id: 'draggable'});
  const droppable = createDroppable({id: 'droppable'});

  function onDragEnd(event) {
    if (event.canceled) return;
    droppedIn = event.operation.target?.id === 'droppable';
  }
</script>

<DragDropProvider {onDragEnd}>
  {#if !droppedIn}
    <button {@attach draggable.attach}>Drag me</button>
  {/if}

  <div {@attach droppable.attach}>
    {#if droppedIn}
      <button {@attach draggable.attach}>Dropped!</button>
    {/if}
  </div>
</DragDropProvider>
```

## Sortable Baseline

```svelte
<script lang="ts">
  import {DragDropProvider} from '@dnd-kit/svelte';
  import {createSortable, isSortableOperation} from '@dnd-kit/svelte/sortable';

  let items = $state([{id: 'a'}, {id: 'b'}, {id: 'c'}]);

  function onDragEnd(event) {
    if (event.canceled || !isSortableOperation(event.operation)) return;

    const sourceIndex = event.operation.source.index;
    const targetIndex = event.operation.target.index;
    if (sourceIndex === targetIndex) return;

    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    items = next;
  }
</script>

<DragDropProvider {onDragEnd}>
  {#each items as item, index (item.id)}
    {@const sortable = createSortable({
      get id() {
        return item.id;
      },
      get index() {
        return index;
      }
    })}

    <div {@attach sortable.attach}>
      <button {@attach sortable.attachHandle}>Handle</button>
      {item.id}
    </div>
  {/each}
</DragDropProvider>
```

## Imports

- Core: `@dnd-kit/svelte`
- Sortable: `@dnd-kit/svelte/sortable`
- Utilities (advanced): `@dnd-kit/svelte/utilities`
