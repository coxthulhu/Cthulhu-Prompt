import { buildGlobalElementKey } from './RevisionMutationTransactionRegistry'

type ElementId = string | number
type MutationOperation = 'insert' | 'update' | 'delete'
type InsertMutationArgs = [data: unknown | unknown[], config?: unknown]
type UpdateMutationArgs =
  | [keys: ElementId | ElementId[], mutateDraft: (...args: any[]) => void]
  | [
      keys: ElementId | ElementId[],
      config: unknown,
      mutateDraft: (...args: any[]) => void
    ]
type DeleteMutationArgs = [keys: ElementId | ElementId[], config?: unknown]
type MutationOperationArgs = {
  insert: InsertMutationArgs
  update: UpdateMutationArgs
  delete: DeleteMutationArgs
}

export type TouchedElement = {
  collectionId: string
  elementId: ElementId
}

export type MutationCapableCollection = {
  id: string
  insert: (...args: any[]) => unknown
  update: (...args: any[]) => unknown
  delete: (...args: any[]) => unknown
  getKeyFromItem: (...args: any[]) => ElementId
}

export type OptimisticCollectionsMap = Record<string, MutationCapableCollection>

export type OptimisticMutationCollectionHelper = {
  id: string
  insert: (...args: InsertMutationArgs) => void
  update: (...args: UpdateMutationArgs) => void
  delete: (...args: DeleteMutationArgs) => void
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

const toElementIdList = (value: ElementId | ElementId[]): ElementId[] => {
  return Array.isArray(value) ? value : [value]
}

const extractInsertElementIds = (
  collection: MutationCapableCollection,
  insertedData: InsertMutationArgs[0]
): ElementId[] => {
  const insertedItems = Array.isArray(insertedData) ? insertedData : [insertedData]
  const elementIds: ElementId[] = []

  for (const insertedItem of insertedItems) {
    elementIds.push(collection.getKeyFromItem(insertedItem))
  }

  return elementIds
}

const createOptimisticMutationHelpers = <
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  optimisticCollections: TOptimisticCollections,
  executeMutation: <TOperation extends MutationOperation>(
    collection: MutationCapableCollection,
    operation: TOperation,
    args: MutationOperationArgs[TOperation]
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
    elementIds: ElementId[]
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

      trackTouchedElements(collection.id, toElementIdList(args[0] as ElementId | ElementId[]))
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
