# Paced Mutations

Control when and how mutations persist to your backend using timing strategies.

## Strategies

### debounceStrategy

Wait for inactivity before persisting. Only final state is saved.

```ts
import { createPacedMutations, debounceStrategy } from '@tanstack/svelte-db'

const mutate = createPacedMutations<{ field: string; value: string }>({
  onMutate: ({ field, value }) => {
    formCollection.update(formId, (draft) => {
      draft[field] = value
    })
  },
  mutationFn: async ({ transaction }) => {
    await api.forms.save(transaction.mutations)
  },
  strategy: debounceStrategy({ wait: 500 }),
})
```

**Use for:** Auto-save forms, search-as-you-type, settings panels

### throttleStrategy

Ensure minimum spacing between executions. Mutations between executions merge.

```ts
import { createPacedMutations, throttleStrategy } from '@tanstack/svelte-db'

const mutate = createPacedMutations<number>({
  onMutate: (volume) => {
    settingsCollection.update('volume', (d) => {
      d.value = volume
    })
  },
  mutationFn: async ({ transaction }) => {
    await api.settings.updateVolume(transaction.mutations)
  },
  strategy: throttleStrategy({
    wait: 200,
    leading: true, // Execute immediately on first call
    trailing: true, // Execute after wait if there were mutations
  }),
})
```

**Use for:** Sliders, progress bars, analytics, live cursor position

### queueStrategy

Each mutation creates a separate transaction, processed sequentially.

```ts
import { createPacedMutations, queueStrategy } from '@tanstack/svelte-db'

const mutate = createPacedMutations<File>({
  onMutate: (file) => {
    uploadCollection.insert({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
    })
  },
  mutationFn: async ({ transaction }) => {
    await api.files.upload(transaction.mutations[0].modified)
  },
  strategy: queueStrategy({
    wait: 500,
    addItemsTo: 'back', // FIFO: add to back
    getItemsFrom: 'front', // FIFO: process from front
  }),
})
```

**Use for:** File uploads, batch operations, audit trails, rate-limited APIs

## Choosing a Strategy

| Scenario         | Strategy | Reason                          |
| ---------------- | -------- | ------------------------------- |
| Auto-save form   | debounce | Wait for user to stop typing    |
| Volume slider    | throttle | Smooth updates without flooding |
| File uploads     | queue    | Every file must upload in order |
| Search input     | debounce | Only search after user pauses   |
| Real-time cursor | throttle | Consistent update rate          |
| Chat messages    | queue    | Order matters, all must send    |

## Shared Queues

Each createPacedMutations instance creates its own queue. To share across components:

```svelte
<script>
  import { createPacedMutations, debounceStrategy } from '@tanstack/svelte-db'

  // Create single shared instance
  const mutateDraft = createPacedMutations<{ id: string; text: string }>({
    onMutate: ({ id, text }) => {
      draftCollection.update(id, (d) => {
        d.text = text
      })
    },
    mutationFn: async ({ transaction }) => {
      await api.saveDraft(transaction.mutations)
    },
    strategy: debounceStrategy({ wait: 500 }),
  })
</script>

<textarea
  on:input={(event) =>
    mutateDraft({ id: '1', text: event.currentTarget.value })}
/>

<textarea
  on:input={(event) =>
    mutateDraft({ id: '2', text: event.currentTarget.value })}
/>
```

## Error Handling

Queue strategy continues processing after failures:

```ts
import { createPacedMutations, queueStrategy } from '@tanstack/svelte-db'

const mutate = createPacedMutations({
  onMutate: (data) => {
    /* ... */
  },
  mutationFn: async ({ transaction }) => {
    // If this throws, transaction fails but queue continues
    await api.save(transaction.mutations)
  },
  strategy: queueStrategy({ wait: 200 }),
})

// Track individual transaction results
const tx = mutate(data)
try {
  await tx.isPersisted.promise
  console.log('Saved!')
} catch (error) {
  console.log('Failed:', error)
}
```

## API Reference

### createPacedMutations

Use in Svelte components or shared modules:

```ts
const mutate = createPacedMutations<T>({
  onMutate: (input) => {
    /* ... */
  },
  mutationFn: async ({ transaction }) => {
    /* ... */
  },
  strategy: debounceStrategy({ wait: 500 }),
})
```

### Strategy Options

```ts
debounceStrategy({ wait: number })

throttleStrategy({
  wait: number,
  leading?: boolean,  // default: true
  trailing?: boolean, // default: true
})

queueStrategy({
  wait?: number,      // delay between items
  addItemsTo?: 'front' | 'back',    // default: 'back'
  getItemsFrom?: 'front' | 'back',  // default: 'front'
})
```
