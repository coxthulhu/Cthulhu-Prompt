import { createCollection } from '@tanstack/svelte-db'
import type { Category } from '@shared/Category'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative renderer collection for root-owned categories. */
export const categoryCollection = createCollection(
  revisionCollectionOptions<Category>({
    id: 'categories',
    getKey: (category) => category.id
  })
)
