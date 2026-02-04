# Schema Error Handling

Handle validation errors gracefully.

## SchemaValidationError

When validation fails, TanStack DB throws `SchemaValidationError`:

```ts
import { SchemaValidationError } from '@tanstack/db'

try {
  collection.insert({
    id: '1',
    email: 'not-an-email',
    age: -5,
  })
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.log(error.type) // 'insert' or 'update'
    console.log(error.message) // "Validation failed with 2 issues"
    console.log(error.issues) // Array of validation issues
  }
}
```

## Error Structure

```ts
error.issues = [
  {
    path: ['email'],
    message: 'Invalid email address',
  },
  {
    path: ['age'],
    message: 'Number must be greater than 0',
  },
]
```

## Displaying Errors in UI

```ts
const handleSubmit = async (data: unknown) => {
  try {
    collection.insert(data)
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      error.issues.forEach((issue) => {
        const fieldName = issue.path?.join('.') || 'unknown'
        showFieldError(fieldName, issue.message)
      })
    }
  }
}
```

## Svelte Form Example

```svelte
<script lang="ts">
  import { SchemaValidationError } from '@tanstack/db'

  let errors = $state<Record<string, string>>({})

  const handleSubmit = (event: SubmitEvent) => {
    const form = event.currentTarget as HTMLFormElement
    errors = {}

    try {
      const text = (form.elements.namedItem('text') as HTMLInputElement).value
      const priorityValue = (
        form.elements.namedItem('priority') as HTMLInputElement
      ).value

      todoCollection.insert({
        id: crypto.randomUUID(),
        text,
        priority: parseInt(priorityValue),
      })
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach((issue) => {
          const field = issue.path?.[0] || 'form'
          newErrors[field] = issue.message
        })
        errors = newErrors
      }
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input name="text" />
  {#if errors.text}
    <span class="error">{errors.text}</span>
  {/if}

  <input name="priority" type="number" />
  {#if errors.priority}
    <span class="error">{errors.priority}</span>
  {/if}

  <button type="submit">Add Todo</button>
</form>
```

## Custom Error Messages

Provide helpful messages in your schema:

```ts
const userSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username is too long (max 20 characters)')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  age: z
    .number()
    .int('Age must be a whole number')
    .min(13, 'You must be at least 13 years old'),
})
```

## Nested Path Errors

For nested objects, path shows the full path:

```ts
const schema = z.object({
  id: z.string(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
  }),
})

// Error for nested field
error.issues = [
  {
    path: ['address', 'city'], // Nested path
    message: 'String must contain at least 1 character(s)',
  },
]

// Access in UI
const fieldName = issue.path?.join('.') // "address.city"
```

## Array Errors

```ts
const schema = z.object({
  id: z.string(),
  tags: z.array(z.string().min(1)),
})

// Error for array element
error.issues = [
  {
    path: ['tags', 2], // Index in array
    message: 'String must contain at least 1 character(s)',
  },
]
```

## Multiple Errors at Once

Schemas report all validation failures, not just the first:

```ts
collection.insert({
  id: '1',
  email: 'bad',
  age: -5,
  status: 'invalid',
})

// error.issues contains all 3 failures
// Display all to user at once
```

## Preventing Common Issues

### Validate Before Insert

Sometimes you want to check validity without inserting:

```ts
const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
})

function validateTodo(data: unknown): boolean {
  const result = todoSchema.safeParse(data)
  return result.success
}

// Use before insert
if (validateTodo(formData)) {
  collection.insert(formData)
} else {
  showError('Invalid data')
}
```

### Type-Safe Form Data

```ts
type TodoInput = z.input<typeof todoSchema>

function createTodo(data: TodoInput) {
  collection.insert(data) // Type-safe
}
```

## Error Recovery Pattern

```ts
async function saveTodo(data: unknown) {
  try {
    collection.insert(data)
    return { success: true }
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        success: false,
        errors: Object.fromEntries(
          error.issues.map((i) => [i.path?.[0] || 'form', i.message]),
        ),
      }
    }
    throw error // Re-throw unexpected errors
  }
}
```
