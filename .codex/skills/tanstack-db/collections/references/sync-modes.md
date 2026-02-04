# Sync Modes

Control how data loads into QueryCollections.

## Overview

| Mode          | Load Behavior                         | Best For                   |
| ------------- | ------------------------------------- | -------------------------- |
| `eager`       | Load all upfront                      | Small datasets (<10k rows) |
| `on-demand`   | Load only what queries request        | Large datasets (>50k rows) |

## Eager Mode (Default)

Loads entire dataset on first access:

```ts
const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
    syncMode: 'eager', // Default
  }),
)
```

**Pros:**

- Simplest mental model
- All data available immediately for queries
- No network requests when filtering/sorting

**Cons:**

- Slow initial load for large datasets
- Memory usage for full dataset

**Best for:**

- User preferences
- Small reference tables
- Data that's mostly accessed

## On-Demand Mode

Loads only what queries request:

```ts
const productsCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['products'],
    queryFn: async (ctx) => {
      const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
      return api.products.search(params)
    },
    getKey: (item) => item.id,
    syncMode: 'on-demand',
  }),
)

// Only loads electronics products
const query = useLiveQuery((q) =>
  q
    .from({ product: productsCollection })
    .where(({ product }) => eq(product.category, 'electronics'))
    .limit(50),
)

query.data
```

**Pros:**

- Fast initial load
- Low memory usage
- Scales to any dataset size

**Cons:**

- Network request on each new query pattern
- Can't query data that isn't loaded

**Best for:**

- Product catalogs
- Search interfaces
- Large datasets where most data isn't accessed

## Predicate Push-Down

With `on-demand`, query predicates are passed to queryFn:

```ts
queryFn: async (ctx) => {
  const options = ctx.meta?.loadSubsetOptions
  // options contains:
  // - where: query conditions
  // - limit: row limit
  // - offset: pagination offset
  // - orderBy: sort specification

  const params = parseLoadSubsetOptions(options)
  return api.fetch(params)
}
```

### parseLoadSubsetOptions

Helper to convert predicates to API params:

```ts
import { parseLoadSubsetOptions } from '@tanstack/query-db-collection'

const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
// {
//   where: { category: 'electronics', price_lt: 100 },
//   limit: 50,
//   offset: 0,
//   orderBy: [{ field: 'price', direction: 'asc' }]
// }
```

## Delta Loading

TanStack DB automatically optimizes loading:

```ts
// First query loads category=electronics
const q1 = q.where(({ p }) => eq(p.category, 'electronics'))

// Second query expands to include clothing
const q2 = q.where(({ p }) =>
  or(eq(p.category, 'electronics'), eq(p.category, 'clothing')),
)
// Only loads clothing, keeps electronics from cache
```

## Choosing a Mode

```
┌──────────────────────────────────────────────┐
│                   How much data?             │
└──────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
       < 10k rows           >= 10k rows
          │                     │
          ▼                     ▼
        EAGER               ON-DEMAND
```

**Additional considerations:**

- Need instant filtering on all data? → eager
- Search/filter is primary use case? → on-demand
- Memory-constrained environment? → on-demand

## Combining Modes

Different collections can use different modes:

```ts
// Small reference data: eager
const categoriesCollection = createCollection(
  queryCollectionOptions({
    syncMode: 'eager',
    ...
  })
)

// Large catalog: on-demand
const productsCollection = createCollection(
  queryCollectionOptions({
    syncMode: 'on-demand',
    ...
  })
)

// Large or sparse data: on-demand
const issuesCollection = createCollection(
  queryCollectionOptions({
    syncMode: 'on-demand',
    ...
  })
)
```
