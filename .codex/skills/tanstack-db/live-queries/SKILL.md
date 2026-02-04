---
name: tanstack-db-live-queries
description: |
  Live query patterns in TanStack DB.
  Use for filtering, joins, aggregations, sorting, and reactive data binding.
---

# Live Queries

TanStack DB live queries are reactive, type-safe queries that automatically update when underlying data changes. Built on differential dataflow, they update incrementally rather than re-running—achieving sub-millisecond performance even on 100k+ item collections.

## Common Patterns

### Basic Query with useLiveQuery

```svelte
<script>
  import { useLiveQuery, eq } from '@tanstack/svelte-db'

  const query = useLiveQuery((q) =>
    q
      .from({ todo: todoCollection })
      .where(({ todo }) => eq(todo.completed, false))
      .orderBy(({ todo }) => todo.createdAt, 'desc'),
  )
</script>

{#if query.isLoading}
  <div>Loading...</div>
{:else}
  <ul>
    {#each query.data as todo (todo.id)}
      <li>{todo.text}</li>
    {/each}
  </ul>
{/if}
```

**Note:** In Svelte 5, `useLiveQuery` returns reactive getters. Access `query.data` and `query.isLoading` directly (no `$` prefix).

### Filtering with Where Clauses

```ts
import { eq, gt, and, or, inArray, like } from '@tanstack/db'

// Simple equality
.where(({ user }) => eq(user.active, true))

// Multiple conditions (chained = AND)
.where(({ user }) => eq(user.active, true))
.where(({ user }) => gt(user.age, 18))

// Complex conditions
.where(({ user }) =>
  and(
    eq(user.active, true),
    or(gt(user.age, 25), eq(user.role, 'admin')),
  ),
)

// Array membership
.where(({ user }) => inArray(user.id, [1, 2, 3]))

// Pattern matching
.where(({ user }) => like(user.email, '%@company.com'))
```

### Select and Transform

```ts
import { concat, upper, gt } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/svelte-db'

const query = useLiveQuery((q) =>
  q.from({ user: usersCollection }).select(({ user }) => ({
    id: user.id,
    displayName: concat(user.firstName, ' ', user.lastName),
    isAdult: gt(user.age, 18),
    ...user, // Spread to include all fields
  })),
)
```

### Joins Across Collections

```ts
const query = useLiveQuery((q) =>
  q
    .from({ user: usersCollection })
    .join(
      { post: postsCollection },
      ({ user, post }) => eq(user.id, post.userId),
      'inner', // 'left' | 'right' | 'inner' | 'full'
    )
    .select(({ user, post }) => ({
      userName: user.name,
      postTitle: post.title,
    })),
)

// Convenience methods
query.leftJoin({ post: postsCollection }, ({ user, post }) =>
  eq(user.id, post.userId),
)
query.innerJoin({ post: postsCollection }, ({ user, post }) =>
  eq(user.id, post.userId),
)
```

### Aggregations with groupBy

```ts
import { count, sum, avg, min, max } from '@tanstack/db'

const query = useLiveQuery((q) =>
  q
    .from({ order: ordersCollection })
    .groupBy(({ order }) => order.customerId)
    .select(({ order }) => ({
      customerId: order.customerId,
      totalOrders: count(order.id),
      totalSpent: sum(order.amount),
      avgOrder: avg(order.amount),
      minOrder: min(order.amount),
      maxOrder: max(order.amount),
    }))
    .having(({ $selected }) => gt($selected.totalSpent, 1000))
    .orderBy(({ $selected }) => $selected.totalSpent, 'desc'),
)
```

### Pagination with Limit and Offset

```ts
const query = useLiveQuery((q) =>
  q
    .from({ user: usersCollection })
    .orderBy(({ user }) => user.name, 'asc')
    .limit(20)
    .offset(page * 20),
)
```

### Find Single Record

```ts
const query = useLiveQuery(
  (q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.id, userId))
      .findOne(), // Returns single object | undefined instead of array
  [() => userId],
)
```

### Conditional Queries

```ts
const query = useLiveQuery(
  (q) => {
    if (!userId) return undefined // Disable query

    return q
      .from({ todo: todosCollection })
      .where(({ todo }) => eq(todo.userId, userId))
  },
  [() => userId],
)
```

```svelte
{#if !query.isEnabled}
  <div>Select a user</div>
{:else}
  <div>{query.data.length} todos</div>
{/if}
```

### Subqueries

```ts
const query = useLiveQuery((q) => {
  // Build subquery
  const activeUsers = q
    .from({ user: usersCollection })
    .where(({ user }) => eq(user.active, true))

  // Use in main query
  return q
    .from({ activeUser: activeUsers })
    .join({ post: postsCollection }, ({ activeUser, post }) =>
      eq(activeUser.id, post.userId),
    )
})
```

### Dependency Arrays

```ts
// Re-run query when minAge changes
const query = useLiveQuery(
  (q) =>
    q.from({ user: usersCollection }).where(({ user }) => gt(user.age, minAge)),
  [() => minAge],
)
```

## Expression Functions

| Function      | Usage                            | Example                              |
| ------------- | -------------------------------- | ------------------------------------ |
| `eq`          | Equality                         | `eq(user.id, 1)`                     |
| `gt/gte`      | Greater than (or equal)          | `gt(user.age, 18)`                   |
| `lt/lte`      | Less than (or equal)             | `lt(user.price, 100)`                |
| `and`         | Logical AND                      | `and(cond1, cond2)`                  |
| `or`          | Logical OR                       | `or(cond1, cond2)`                   |
| `not`         | Logical NOT                      | `not(eq(user.active, false))`        |
| `inArray`     | Value in array                   | `inArray(user.id, [1, 2, 3])`        |
| `like`        | Pattern match (case-sensitive)   | `like(user.name, 'John%')`           |
| `ilike`       | Pattern match (case-insensitive) | `ilike(user.email, '%@gmail.com')`   |
| `isNull`      | Check for null                   | `isNull(user.deletedAt)`             |
| `isUndefined` | Check for undefined              | `isUndefined(profile)`               |
| `concat`      | String concatenation             | `concat(user.first, ' ', user.last)` |
| `upper`       | Uppercase                        | `upper(user.name)`                   |
| `lower`       | Lowercase                        | `lower(user.email)`                  |
| `length`      | String/array length              | `length(user.tags)`                  |
| `count`       | Count (aggregate)                | `count(order.id)`                    |
| `sum`         | Sum (aggregate)                  | `sum(order.amount)`                  |
| `avg`         | Average (aggregate)              | `avg(order.amount)`                  |
| `min`         | Minimum (aggregate)              | `min(order.amount)`                  |
| `max`         | Maximum (aggregate)              | `max(order.amount)`                  |

## Detailed References

| Reference                           | When to Use                                         |
| ----------------------------------- | --------------------------------------------------- |
| `references/query-builder.md`       | Full query builder API, method signatures, chaining |
| `references/joins.md`               | Join types, multi-table queries, join optimization  |
| `references/aggregations.md`        | groupBy, having, aggregate functions, multi-column  |
| `references/subqueries.md`          | Nested queries, query composition, deduplication    |
| `references/functional-variants.md` | fn.where, fn.select for complex JavaScript logic    |
| `references/performance.md`         | Incremental updates, caching, derived collections   |
| `references/svelte-adapter.md`      | Svelte adapter usage, dependency arrays, runes      |
