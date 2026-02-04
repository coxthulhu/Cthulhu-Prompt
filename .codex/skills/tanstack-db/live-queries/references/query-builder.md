# Query Builder API

Complete reference for the TanStack DB query builder.

## Query Methods

### from

Start a query by specifying collections:

```ts
q.from({ user: usersCollection })
q.from({ user: usersCollection, post: postsCollection })
```

### where

Filter results with conditions:

```ts
.where(({ user }) => eq(user.active, true))

// Multiple where clauses are ANDed
.where(({ user }) => eq(user.active, true))
.where(({ user }) => gt(user.age, 18))

// Complex conditions
.where(({ user }) =>
  and(
    eq(user.active, true),
    or(gt(user.age, 25), eq(user.role, 'admin'))
  )
)
```

### select

Transform and pick fields:

```ts
// Pick specific fields
.select(({ user }) => ({
  id: user.id,
  name: user.name,
}))

// Computed fields
.select(({ user }) => ({
  ...user,
  fullName: concat(user.firstName, ' ', user.lastName),
  isAdult: gt(user.age, 18),
}))
```

### join / leftJoin / innerJoin

Combine data from multiple collections:

```ts
.join(
  { post: postsCollection },
  ({ user, post }) => eq(user.id, post.userId),
  'left' // 'left' | 'right' | 'inner' | 'full'
)

// Convenience methods
.leftJoin({ post: postsCollection }, ({ user, post }) => eq(user.id, post.userId))
.innerJoin({ post: postsCollection }, ({ user, post }) => eq(user.id, post.userId))
```

### groupBy

Group results for aggregation:

```ts
.groupBy(({ order }) => order.customerId)
.groupBy(({ order }) => [order.customerId, order.year]) // Multiple columns
```

### having

Filter groups after aggregation:

```ts
.groupBy(({ order }) => order.customerId)
.select(({ order }) => ({
  customerId: order.customerId,
  total: sum(order.amount),
}))
.having(({ $selected }) => gt($selected.total, 1000))
```

### orderBy

Sort results:

```ts
.orderBy(({ user }) => user.name, 'asc')
.orderBy(({ user }) => user.createdAt, 'desc')

// Multiple columns
.orderBy(({ user }) => user.lastName, 'asc')
.orderBy(({ user }) => user.firstName, 'asc')
```

### limit / offset

Paginate results:

```ts
.limit(20)
.offset(40) // Skip first 40, return next 20
```

### distinct

Remove duplicates:

```ts
.distinct()
```

### findOne

Return single item instead of array:

```ts
.findOne() // Returns T | undefined instead of T[]
```

## Hook API

### useLiveQuery

```ts
const query = useLiveQuery(
  (q) => q.from({ user: usersCollection }),
  [() => dep1, () => dep2], // Optional dependency array
)

query.data // Query results (T[] or T | undefined for findOne)
query.isLoading // True during initial load
query.isEnabled // False when query returns undefined
query.error // Any error that occurred
```

## Type Inference

Query results are fully typed based on your select:

```ts
const query = useLiveQuery((q) =>
  q.from({ user: usersCollection }).select(({ user }) => ({
    id: user.id,
    name: user.name,
  })),
)

// query.data is typed as { id: string; name: string }[]
```
