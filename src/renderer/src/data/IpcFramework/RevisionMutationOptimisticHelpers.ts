import { buildGlobalElementKey } from './RevisionMutationTransactionRegistry'

export type TouchedElement = {
  collectionId: string
  elementId: string | number
}

export type MutationCapableCollection = {
  id: string
  insert: (...args: any[]) => unknown
  update: (...args: any[]) => unknown
  delete: (...args: any[]) => unknown
  getKeyFromItem?: (...args: any[]) => unknown
}

export type OptimisticCollectionsMap = Record<string, MutationCapableCollection>

export type OptimisticMutationCollectionHelper = {
  id: string
  insert: (...args: any[]) => void
  update: (...args: any[]) => void
  delete: (...args: any[]) => void
}

export type OptimisticMutationHelpers<
  TOptimisticCollections extends OptimisticCollectionsMap
> = {
  collections: {
    [TCollectionKey in keyof TOptimisticCollections]: OptimisticMutationCollectionHelper
  }
}

export type OptimisticMutateFn<
  TOptimisticCollections extends OptimisticCollectionsMap
> = (helpers: OptimisticMutationHelpers<TOptimisticCollections>) => void

const toElementIdList = (value: unknown): Array<string | number> => {
  if (typeof value === 'string' || typeof value === 'number') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  const elementIds: Array<string | number> = []
  for (const entry of value) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      elementIds.push(entry)
    }
  }

  return elementIds
}

const extractInsertElementIds = (
  collection: MutationCapableCollection,
  insertedData: unknown
): Array<string | number> => {
  const insertedItems = Array.isArray(insertedData) ? insertedData : [insertedData]
  const elementIds: Array<string | number> = []

  for (const insertedItem of insertedItems) {
    let elementId: unknown

    if (typeof collection.getKeyFromItem === 'function') {
      try {
        elementId = collection.getKeyFromItem(insertedItem)
      } catch {
        elementId = undefined
      }
    }

    if (
      (typeof elementId !== 'string' && typeof elementId !== 'number') &&
      insertedItem &&
      typeof insertedItem === 'object' &&
      'id' in insertedItem
    ) {
      elementId = (insertedItem as { id?: unknown }).id
    }

    if (typeof elementId === 'string' || typeof elementId === 'number') {
      elementIds.push(elementId)
    }
  }

  return elementIds
}

const createOptimisticMutationHelpers = <
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  optimisticCollections: TOptimisticCollections,
  executeMutation: (
    collection: MutationCapableCollection,
    operation: 'insert' | 'update' | 'delete',
    args: Array<any>
  ) => void
): OptimisticMutationHelpers<TOptimisticCollections> => {
  const helperCollections = {} as OptimisticMutationHelpers<TOptimisticCollections>['collections']

  for (const collectionKey of Object.keys(optimisticCollections) as Array<
    keyof TOptimisticCollections
  >) {
    const collection = optimisticCollections[collectionKey]
    helperCollections[collectionKey] = {
      id: collection.id,
      insert: (...args) => {
        executeMutation(collection, 'insert', args)
      },
      update: (...args) => {
        executeMutation(collection, 'update', args)
      },
      delete: (...args) => {
        executeMutation(collection, 'delete', args)
      }
    }
  }

  return {
    collections: helperCollections
  }
}

export const collectTouchedElementsFromMutation = <
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  optimisticCollections: TOptimisticCollections,
  mutateOptimistically: OptimisticMutateFn<TOptimisticCollections>
): Array<TouchedElement> => {
  const touchedElementsByGlobalKey = new Map<string, TouchedElement>()
  const trackTouchedElements = (
    collectionId: string,
    elementIds: Array<string | number>
  ): void => {
    for (const elementId of elementIds) {
      const globalElementKey = buildGlobalElementKey(collectionId, elementId)
      touchedElementsByGlobalKey.set(globalElementKey, {
        collectionId,
        elementId
      })
    }
  }

  const collectHelpers = createOptimisticMutationHelpers(
    optimisticCollections,
    (collection, operation, args) => {
      if (operation === 'insert') {
        trackTouchedElements(collection.id, extractInsertElementIds(collection, args[0]))
        return
      }

      trackTouchedElements(collection.id, toElementIdList(args[0]))
    }
  )

  mutateOptimistically(collectHelpers)
  return [...touchedElementsByGlobalKey.values()]
}

export const applyOptimisticMutation = <
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  optimisticCollections: TOptimisticCollections,
  mutateOptimistically: OptimisticMutateFn<TOptimisticCollections>
): void => {
  const applyHelpers = createOptimisticMutationHelpers(
    optimisticCollections,
    (collection, operation, args) => {
      if (operation === 'insert') {
        collection.insert(...args)
        return
      }
      if (operation === 'update') {
        collection.update(...args)
        return
      }
      collection.delete(...args)
    }
  )

  mutateOptimistically(applyHelpers)
}
