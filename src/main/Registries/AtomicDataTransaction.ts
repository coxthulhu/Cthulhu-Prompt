import { produce } from 'immer'
import type { PersistenceChange } from '../Persistence/PersistenceTypes'
import { data, type DataRecipe, type RevisionData } from './Data'
import { enqueueGlobalMutation } from './GlobalMutationQueue'

type DataStoreKey = keyof typeof data

type StoreData<TStoreKey extends DataStoreKey> = (typeof data)[TStoreKey] extends RevisionData<
  infer TData,
  any
>
  ? TData
  : never

type StorePersistenceFields<TStoreKey extends DataStoreKey> = (typeof data)[TStoreKey] extends RevisionData<
  any,
  infer TPersistenceFields
>
  ? TPersistenceFields
  : never

type AtomicDataCreateOperation<TStoreKey extends DataStoreKey = DataStoreKey> = {
  type: 'create'
  store: TStoreKey
  id: string
  data: StoreData<TStoreKey>
  persistenceFields: StorePersistenceFields<TStoreKey>
}

type AtomicDataUpdateOperation<TStoreKey extends DataStoreKey = DataStoreKey> = {
  type: 'update'
  store: TStoreKey
  id: string
  recipe: DataRecipe<StoreData<TStoreKey>>
}

type AtomicDataDeleteOperation<TStoreKey extends DataStoreKey = DataStoreKey> = {
  type: 'delete'
  store: TStoreKey
  id: string
}

export type AtomicDataOperation =
  | AtomicDataCreateOperation
  | AtomicDataUpdateOperation
  | AtomicDataDeleteOperation

export type AtomicDataTransactionResult = {
  store: DataStoreKey
  id: string
  revision: number | null
}

type StagedOperationEntry = {
  operation: AtomicDataOperation
  revisionData: RevisionData<any, any>
  nextData: unknown
  persistenceFields: unknown
  stagedChange: unknown
}

const revertStagedChanges = async (stagedOperations: StagedOperationEntry[]): Promise<void> => {
  await Promise.allSettled(
    stagedOperations.map((stagedOperation) =>
      stagedOperation.revisionData.persistence.revertChanges(stagedOperation.stagedChange)
    )
  )
}

const stageAtomicDataOperations = async (
  operations: AtomicDataOperation[]
): Promise<StagedOperationEntry[]> => {
  const stagedOperations: StagedOperationEntry[] = []

  for (const operation of operations) {
    const revisionData = data[operation.store] as RevisionData<any, any>

    let nextData: unknown
    let persistenceFields: unknown

    if (operation.type === 'create') {
      if (revisionData.committedStore.getEntry(operation.id)) {
        throw new Error(`Cannot create ${operation.store}:${operation.id}; entry already exists`)
      }

      nextData = operation.data
      persistenceFields = operation.persistenceFields
    } else {
      const committedEntry = revisionData.committedStore.getEntry(operation.id)

      if (!committedEntry) {
        throw new Error(`Cannot ${operation.type} ${operation.store}:${operation.id}; missing entry`)
      }

      persistenceFields = committedEntry.persistenceFields
      nextData =
        operation.type === 'update'
          ? produce(committedEntry.committed, operation.recipe as DataRecipe<any>)
          : null
    }

    const change: PersistenceChange<any, any> =
      operation.type === 'delete'
        ? { type: 'remove', persistenceFields }
        : { type: 'upsert', persistenceFields, data: nextData }

    const stagedChange = await revisionData.persistence.stageChanges(change)

    stagedOperations.push({
      operation,
      revisionData,
      nextData,
      persistenceFields,
      stagedChange
    })
  }

  return stagedOperations
}

const applyCommittedInMemoryChanges = (
  stagedOperations: StagedOperationEntry[]
): AtomicDataTransactionResult[] => {
  const results: AtomicDataTransactionResult[] = []

  for (const stagedOperation of stagedOperations) {
    const { operation, revisionData } = stagedOperation

    if (operation.type === 'delete') {
      revisionData.committedStore.remove(operation.id)
      revisionData.emitCommittedRevisionChanged(operation.id)
      results.push({
        store: operation.store,
        id: operation.id,
        revision: null
      })
      continue
    }

    const nextData = stagedOperation.nextData
    let revision: number

    if (operation.type === 'create') {
      revisionData.committedStore.setFromDisk(
        operation.id,
        nextData,
        stagedOperation.persistenceFields
      )
      revision = revisionData.committedStore.commitAfterWrite(operation.id, nextData)
    } else {
      revision = revisionData.committedStore.commitAfterWrite(operation.id, nextData)
    }

    revisionData.emitCommittedRevisionChanged(operation.id)
    results.push({
      store: operation.store,
      id: operation.id,
      revision
    })
  }

  return results
}

const assertNoDuplicateOperationTargets = (operations: AtomicDataOperation[]): void => {
  const operationTargetKeys = new Set<string>()

  for (const operation of operations) {
    const operationTargetKey = `${operation.store}:${operation.id}`

    if (operationTargetKeys.has(operationTargetKey)) {
      throw new Error(`Multiple operations target the same entry: ${operationTargetKey}`)
    }

    operationTargetKeys.add(operationTargetKey)
  }
}

const runAtomicDataTransactionImmediately = async (
  operations: AtomicDataOperation[]
): Promise<AtomicDataTransactionResult[]> => {
  assertNoDuplicateOperationTargets(operations)

  let stagedOperations: StagedOperationEntry[] = []

  try {
    stagedOperations = await stageAtomicDataOperations(operations)
  } catch (error) {
    await revertStagedChanges(stagedOperations)
    throw error
  }

  try {
    for (const stagedOperation of stagedOperations) {
      await stagedOperation.revisionData.persistence.commitChanges(stagedOperation.stagedChange)
    }
  } catch (error) {
    await revertStagedChanges(stagedOperations)
    throw error
  }

  return applyCommittedInMemoryChanges(stagedOperations)
}

export const runAtomicDataTransaction = async (
  operations: AtomicDataOperation[]
): Promise<AtomicDataTransactionResult[]> => {
  // Side effect: serialize all main-process mutation transactions through one queue.
  return await enqueueGlobalMutation(async () => {
    return await runAtomicDataTransactionImmediately(operations)
  })
}
