# Temporary IDs

Handle the transition from client-generated temporary IDs to server-generated real IDs.

## The Problem

When inserting items where the server generates the ID:

1. **UI Flicker**: Svelte may recreate keyed list items when the key changes from temp → real
2. **Operation Failures**: Delete/update may use temp ID before real ID syncs

```ts
const tempId = -Date.now() // Temporary

todoCollection.insert({
  id: tempId,
  text: 'New todo',
})

// Later, server returns real ID (e.g., 12345)
// Collection now has real ID, but component still has tempId reference
todoCollection.delete(tempId) // May fail: item now has different key
```

## Solution 1: Client-Generated UUIDs (Recommended)

Eliminate the problem by using stable client-generated IDs:

```ts
const id = crypto.randomUUID()

todoCollection.insert({
  id, // Stable forever
  text: 'New todo',
})

// Works immediately, no ID change
todoCollection.delete(id)
```

**Requirements:**

- Backend must accept client-generated IDs
- Use UUID format to avoid collisions

## Solution 2: Wait for Persistence

Don't allow operations until real ID is available:

```ts
const tempId = `temp-${Date.now()}`

const tx = todoCollection.insert({
  id: tempId,
  text: 'New todo',
})

// Wait for server to assign real ID
await tx.isPersisted.promise

// Now safe to operate on the item
// (though you need to find it by other means, e.g., query)
```

### Disable Actions Until Persisted

```svelte
<script>
  export let todo
  export let isPending
</script>

<div>
  {todo.text}
  <button
    type="button"
    on:click={() => todoCollection.delete(todo.id)}
    disabled={isPending}
  >
    Delete
  </button>
</div>
```

## Solution 3: Non-Optimistic Insert

Don't show item until server confirms:

```ts
const tx = todoCollection.insert(
  { id: tempId, text: 'New todo' },
  { optimistic: false }, // Don't show until persisted
)

await tx.isPersisted.promise
// Item now visible with real ID
```

## Solution 4: View Key Mapping

Maintain stable Svelte keys separate from data IDs:

```ts
// Mapping from any ID (temp or real) to stable view key
const idToViewKey = new Map<string | number, string>()

function getViewKey(id: string | number): string {
  if (!idToViewKey.has(id)) {
    idToViewKey.set(id, crypto.randomUUID())
  }
  return idToViewKey.get(id)!
}

function linkIds(tempId: string, realId: number) {
  const viewKey = getViewKey(tempId)
  idToViewKey.set(realId, viewKey) // Same view key for both
}

// In collection handler
onInsert: async ({ transaction }) => {
  const tempId = transaction.mutations[0].modified.id
  const response = await api.create(...)
  const realId = response.id

  linkIds(tempId, realId) // Link before sync completes

  await todoCollection.utils.refetch()
}

```

```svelte
<script>
  const query = useLiveQuery(...)
</script>

<ul>
  {#each query.data as todo (getViewKey(todo.id))}
    <li>{todo.text}</li>
  {/each}
</ul>
```

## Temporary ID Patterns

### Negative Numbers

```ts
// Easily distinguishable from server IDs
const tempId = -(Math.floor(Math.random() * 1000000) + 1)
```

### Prefixed Strings

```ts
const tempId = `temp-${crypto.randomUUID()}`

// Check if temporary
const isTemp = (id: string) => id.startsWith('temp-')
```

### UUID v4

```ts
const tempId = crypto.randomUUID()
// Works as permanent ID if server accepts it
```

## Tracking Pending Inserts

```svelte
<script lang="ts">
  let pending = $state(new Set())

  const insert = async (item) => {
    pending = new Set(pending).add(item.id)

    const tx = todoCollection.insert(item)

    try {
      await tx.isPersisted.promise
    } finally {
      const next = new Set(pending)
      next.delete(item.id)
      pending = next
    }
  }

  const isPending = (id) => pending.has(id)
  const query = useLiveQuery(...)
</script>

<button type="button" on:click={() => insert({ id: tempId, text: 'New' })}>
  Add
</button>

{#each query.data as todo (todo.id)}
  <TodoItem todo={todo} isPending={isPending(todo.id)} />
{/each}
```

## Summary

| Approach             | Complexity | Best For                          |
| -------------------- | ---------- | --------------------------------- |
| Client UUIDs         | Low        | New projects, flexible backends   |
| Wait for persistence | Low        | Critical operations               |
| Non-optimistic       | Low        | Server-validated data             |
| View key mapping     | Medium     | Existing backends with server IDs |

**Recommendation:** Use client-generated UUIDs when possible. It's the simplest solution that eliminates the entire problem.
