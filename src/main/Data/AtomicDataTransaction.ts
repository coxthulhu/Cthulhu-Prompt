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

type AtomicDataCreateOperation = {
  type: 'create'
  store: DataStoreKey
  id: string
  data: unknown
  persistenceFields: unknown
}

type AtomicDataUpdateOperation = {
  type: 'update'
  store: DataStoreKey
  id: string
  recipe: DataRecipe<any>
  expectedRevision?: number
}

type AtomicDataDeleteOperation = {
  type: 'delete'
  store: DataStoreKey
  id: string
  expectedRevision?: number
}

type AtomicDataOperation =
  | AtomicDataCreateOperation
  | AtomicDataUpdateOperation
  | AtomicDataDeleteOperation

export type AtomicDataCommittedResult<
  TStoreKey extends DataStoreKey = DataStoreKey,
  TData = StoreData<TStoreKey> | null,
  TRevision extends number | null = number | null
> = {
  store: TStoreKey
  id: string
  revision: TRevision
  data: TData
}

type AtomicDataTransactionHandle<
  TStoreKey extends DataStoreKey,
  TData,
  TRevision extends number | null
> = {
  operationIndex: number
  store: TStoreKey
  id: string
  _result?: {
    store: TStoreKey
    id: string
    data: TData
    revision: TRevision
  }
}

type AtomicDataBuilder = {
  create: <TStoreKey extends DataStoreKey>(params: {
    store: TStoreKey
    id: string
    data: StoreData<TStoreKey>
    persistenceFields: StorePersistenceFields<TStoreKey>
  }) => AtomicDataTransactionHandle<TStoreKey, StoreData<TStoreKey>, number>
  update: <TStoreKey extends DataStoreKey>(params: {
    store: TStoreKey
    id: string
    recipe: DataRecipe<StoreData<TStoreKey>>
    expectedRevision?: number
  }) => AtomicDataTransactionHandle<TStoreKey, StoreData<TStoreKey>, number>
  delete: <TStoreKey extends DataStoreKey>(params: {
    store: TStoreKey
    id: string
    expectedRevision?: number
  }) => AtomicDataTransactionHandle<TStoreKey, null, null>
}

type AtomicDataTransactionHandles = Record<
  string,
  AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>
>

type AtomicDataResultFromHandle<THandle> = THandle extends AtomicDataTransactionHandle<
  infer TStoreKey,
  infer TData,
  infer TRevision
>
  ? AtomicDataCommittedResult<TStoreKey, TData, TRevision>
  : never

type AtomicDataTransactionResultMap<THandles extends AtomicDataTransactionHandles> = {
  [TKey in keyof THandles]: AtomicDataResultFromHandle<THandles[TKey]>
}

type AtomicDataConflictFromHandle<THandle> = THandle extends AtomicDataTransactionHandle<
  infer TStoreKey,
  any,
  any
>
  ? {
      store: TStoreKey
      id: string
      expectedRevision: number
      actualRevision: number
      data: StoreData<TStoreKey>
    }
  : never

type AtomicDataTransactionConflictsForLabel<
  THandles extends AtomicDataTransactionHandles,
  TLabel extends keyof THandles
> = {
  [TKey in TLabel]: AtomicDataConflictFromHandle<THandles[TKey]>
} & Partial<{
  [TKey in Exclude<keyof THandles, TLabel>]: AtomicDataConflictFromHandle<THandles[TKey]>
}>

type AtomicDataTransactionConflictOutcome<THandles extends AtomicDataTransactionHandles> = {
  [TLabel in keyof THandles]: {
    status: 'conflict'
    conflictLabel: TLabel
    conflicts: AtomicDataTransactionConflictsForLabel<THandles, TLabel>
  }
}[keyof THandles]

export type AtomicDataTransactionOutcome<THandles extends AtomicDataTransactionHandles> =
  | {
      status: 'success'
      results: AtomicDataTransactionResultMap<THandles>
    }
  | AtomicDataTransactionConflictOutcome<THandles>

type StageConflict = {
  operationIndex: number
  store: DataStoreKey
  id: string
  expectedRevision: number
  actualRevision: number
  data: unknown
}

type StagedOperationEntry = {
  operation: AtomicDataOperation
  revisionData: RevisionData<any, any>
  nextData: unknown
  persistenceFields: unknown
  stagedChange: unknown
}

type StageAtomicDataOperationsResult =
  | {
      status: 'success'
      stagedOperations: StagedOperationEntry[]
    }
  | {
      status: 'conflict'
      stagedOperations: StagedOperationEntry[]
      conflict: StageConflict
    }

type AtomicDataImmediateTransactionOutcome =
  | {
      status: 'success'
      results: AtomicDataCommittedResultInternal[]
    }
  | {
      status: 'conflict'
      conflict: StageConflict
    }

type AtomicDataCommittedResultInternal = {
  store: DataStoreKey
  id: string
  revision: number | null
  data: unknown
}

const createAtomicDataBuilder = (): {
  tx: AtomicDataBuilder
  operations: AtomicDataOperation[]
} => {
  const operations: AtomicDataOperation[] = []

  const registerOperationHandle = <
    TStoreKey extends DataStoreKey,
    TData,
    TRevision extends number | null
  >(
    operation: AtomicDataOperation,
    store: TStoreKey,
    id: string
  ): AtomicDataTransactionHandle<TStoreKey, TData, TRevision> => {
    operations.push(operation)
    return {
      operationIndex: operations.length - 1,
      store,
      id
    }
  }

  return {
    operations,
    tx: {
      create: ({ store, id, data: nextData, persistenceFields }) => {
        const operation: AtomicDataCreateOperation = {
          type: 'create',
          store,
          id,
          data: nextData,
          persistenceFields
        }
        return registerOperationHandle(operation, store, id)
      },
      update: ({ store, id, recipe, expectedRevision }) => {
        const operation: AtomicDataUpdateOperation = {
          type: 'update',
          store,
          id,
          recipe: recipe as DataRecipe<any>,
          expectedRevision
        }
        return registerOperationHandle(operation, store, id)
      },
      delete: ({ store, id, expectedRevision }) => {
        const operation: AtomicDataDeleteOperation = {
          type: 'delete',
          store,
          id,
          expectedRevision
        }
        return registerOperationHandle(operation, store, id)
      }
    }
  }
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
): Promise<StageAtomicDataOperationsResult> => {
  const stagedOperations: StagedOperationEntry[] = []

  for (const [operationIndex, operation] of operations.entries()) {
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

      // Side effect: run CAS checks while this transaction is already serialized in the mutation queue.
      if (
        operation.expectedRevision != null &&
        operation.expectedRevision !== committedEntry.revision
      ) {
        return {
          status: 'conflict',
          stagedOperations,
          conflict: {
            operationIndex,
            store: operation.store,
            id: operation.id,
            expectedRevision: operation.expectedRevision,
            actualRevision: committedEntry.revision,
            data: committedEntry.committed
          }
        }
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

  return {
    status: 'success',
    stagedOperations
  }
}

const applyCommittedInMemoryChanges = (
  stagedOperations: StagedOperationEntry[]
): AtomicDataCommittedResultInternal[] => {
  const results: AtomicDataCommittedResultInternal[] = []

  for (const stagedOperation of stagedOperations) {
    const { operation, revisionData } = stagedOperation

    if (operation.type === 'delete') {
      revisionData.committedStore.remove(operation.id)
      revisionData.emitCommittedRevisionChanged(operation.id)
      results.push({
        store: operation.store,
        id: operation.id,
        revision: null,
        data: null
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
      revision,
      data: nextData
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
): Promise<AtomicDataImmediateTransactionOutcome> => {
  assertNoDuplicateOperationTargets(operations)

  const stageResult = await stageAtomicDataOperations(operations)

  if (stageResult.status === 'conflict') {
    await revertStagedChanges(stageResult.stagedOperations)
    return {
      status: 'conflict',
      conflict: stageResult.conflict
    }
  }

  const stagedOperations = stageResult.stagedOperations

  try {
    for (const stagedOperation of stagedOperations) {
      await stagedOperation.revisionData.persistence.commitChanges(stagedOperation.stagedChange)
    }
  } catch (error) {
    await revertStagedChanges(stagedOperations)
    throw error
  }

  return {
    status: 'success',
    results: applyCommittedInMemoryChanges(stagedOperations)
  }
}

const assertBuilderResultShape: (
  result: unknown
) => asserts result is AtomicDataTransactionHandles = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Atomic transaction builder must return a labeled object of transaction handles')
  }
}

const mapResultHandlesToCommittedResults = <THandles extends AtomicDataTransactionHandles>(
  handles: THandles,
  committedResults: AtomicDataCommittedResultInternal[]
): AtomicDataTransactionResultMap<THandles> => {
  const mappedResults = {} as AtomicDataTransactionResultMap<THandles>

  for (const [label, handle] of Object.entries(handles) as Array<[
    keyof THandles,
    THandles[keyof THandles]
  ]>) {
    const committedResult = committedResults[handle.operationIndex]

    if (!committedResult) {
      throw new Error(`Atomic transaction result handle "${String(label)}" is out of range`)
    }

    mappedResults[label] = committedResult as AtomicDataTransactionResultMap<THandles>[typeof label]
  }

  return mappedResults
}

const mapStageConflictToConflictOutcome = <THandles extends AtomicDataTransactionHandles>(
  handles: THandles,
  conflict: StageConflict
): AtomicDataTransactionConflictOutcome<THandles> => {
  const conflictEntry = Object.entries(handles).find(([, handle]) => {
    return handle.operationIndex === conflict.operationIndex
  })

  if (!conflictEntry) {
    throw new Error('Atomic transaction conflict did not map to a known handle')
  }

  const [rawLabel, handle] = conflictEntry
  const label = rawLabel as keyof THandles

  const conflicts = {
    [label]: {
      store: handle.store,
      id: handle.id,
      expectedRevision: conflict.expectedRevision,
      actualRevision: conflict.actualRevision,
      data: conflict.data as StoreData<typeof handle.store>
    }
  } as AtomicDataTransactionConflictsForLabel<THandles, typeof label>

  return {
    status: 'conflict',
    conflictLabel: label,
    conflicts
  }
}

export const runAtomicDataTransaction = async <THandles extends AtomicDataTransactionHandles>(
  buildTransaction: (tx: AtomicDataBuilder) => THandles
): Promise<AtomicDataTransactionOutcome<THandles>> => {
  const { tx, operations } = createAtomicDataBuilder()
  const handles: THandles = buildTransaction(tx)
  assertBuilderResultShape(handles)

  // Side effect: serialize all main-process mutation transactions through one queue.
  const outcome = await enqueueGlobalMutation(async () => {
    return await runAtomicDataTransactionImmediately(operations)
  })

  if (outcome.status === 'conflict') {
    return mapStageConflictToConflictOutcome(handles, outcome.conflict)
  }

  return {
    status: 'success',
    results: mapResultHandlesToCommittedResults(handles, outcome.results)
  }
}
