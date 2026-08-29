import { produce } from 'immer'
import type { FilePersistenceStagedChange } from '../Persistence/FilePersistenceHelpers'
import {
  planDomainStorageTransitions
} from '../Persistence/DomainStorageAdapters'
import type { DomainTransitionProjection } from './DomainTransitions'
import { data, type DataRecipe, type RevisionData } from './Data'
import { enqueueGlobalMutation } from './GlobalMutationQueue'

export type DataStoreKey = keyof typeof data

type StoreData<TStoreKey extends DataStoreKey> =
  (typeof data)[TStoreKey] extends RevisionData<infer TData, any> ? TData : never

type StorePersistenceFields<TStoreKey extends DataStoreKey> =
  (typeof data)[TStoreKey] extends RevisionData<any, infer TPersistenceFields>
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
  persistenceFields?: unknown
}

type AtomicDataUpdatePersistenceFieldsOperation = {
  type: 'updatePersistenceFields'
  store: DataStoreKey
  id: string
  persistenceFields: unknown
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
  | AtomicDataUpdatePersistenceFieldsOperation
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

export type AtomicDataTransactionHandle<
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

export type AtomicDataStoreBuilder<TStoreKey extends DataStoreKey> = {
  create: (params: {
    id: string
    data: StoreData<TStoreKey>
    persistenceFields: StorePersistenceFields<TStoreKey>
  }) => AtomicDataTransactionHandle<TStoreKey, StoreData<TStoreKey>, number>
  update: (params: {
    id: string
    recipe: DataRecipe<StoreData<TStoreKey>>
    expectedRevision?: number
    persistenceFields?: StorePersistenceFields<TStoreKey>
  }) => AtomicDataTransactionHandle<TStoreKey, StoreData<TStoreKey>, number>
  updatePersistenceFields: (params: {
    id: string
    persistenceFields: StorePersistenceFields<TStoreKey>
  }) => AtomicDataTransactionHandle<TStoreKey, StoreData<TStoreKey>, number>
  delete: (params: {
    id: string
    expectedRevision?: number
  }) => AtomicDataTransactionHandle<TStoreKey, null, null>
}

export type AtomicDataBuilder = {
  [TStoreKey in DataStoreKey]: AtomicDataStoreBuilder<TStoreKey>
}

type AtomicDataTransactionHandles = Record<
  string,
  AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>
>

type AtomicDataResultFromHandle<THandle> =
  THandle extends AtomicDataTransactionHandle<infer TStoreKey, infer TData, infer TRevision>
    ? AtomicDataCommittedResult<TStoreKey, TData, TRevision>
    : never

type AtomicDataTransactionResultMap<THandles extends AtomicDataTransactionHandles> = {
  [TKey in keyof THandles]: AtomicDataResultFromHandle<THandles[TKey]>
}

type AtomicDataConflictFromHandle<THandle> =
  THandle extends AtomicDataTransactionHandle<infer TStoreKey, any, any>
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

/** One projected atomic transition consumed directly by the staging core. */
type AtomicDataTransition = {
  operationIndex: number
  store: DataStoreKey
  id: string
  before: { revision: number; data: unknown; persistenceFields: unknown } | null
  after: { data: unknown; persistenceFields: unknown } | null
  expectedRevision?: number
  incrementsRevision: boolean
}

/** One transition whose filesystem changes have been staged successfully. */
type StagedTransitionEntry = {
  transition: AtomicDataTransition
  revisionData: RevisionData<any, any>
  nextPersistenceFields: unknown
  stagedChange: FilePersistenceStagedChange[]
}

/** Result of projecting legacy builder operations against current stores. */
type ProjectAtomicDataOperationsResult =
  | {
      status: 'success'
      transitions: AtomicDataTransition[]
    }
  | {
      status: 'conflict'
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

  const createStoreBuilder = <TStoreKey extends DataStoreKey>(
    store: TStoreKey
  ): AtomicDataStoreBuilder<TStoreKey> => {
    return {
      create: ({ id, data: nextData, persistenceFields }) => {
        const operation: AtomicDataCreateOperation = {
          type: 'create',
          store,
          id,
          data: nextData,
          persistenceFields
        }
        return registerOperationHandle(operation, store, id)
      },
      update: ({ id, recipe, expectedRevision, persistenceFields }) => {
        const operation: AtomicDataUpdateOperation = {
          type: 'update',
          store,
          id,
          recipe: recipe as DataRecipe<any>,
          expectedRevision,
          persistenceFields
        }
        return registerOperationHandle(operation, store, id)
      },
      updatePersistenceFields: ({ id, persistenceFields }) => {
        const operation: AtomicDataUpdatePersistenceFieldsOperation = {
          type: 'updatePersistenceFields',
          store,
          id,
          persistenceFields
        }
        return registerOperationHandle(operation, store, id)
      },
      delete: ({ id, expectedRevision }) => {
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

  return {
    operations,
    tx: {
      systemSettings: createStoreBuilder('systemSettings'),
      workspace: createStoreBuilder('workspace'),
      promptFolder: createStoreBuilder('promptFolder'),
      category: createStoreBuilder('category'),
      prompt: createStoreBuilder('prompt'),
      promptTemplate: createStoreBuilder('promptTemplate')
    }
  }
}

/** Reverts every filesystem transition that reached the staged state. */
const revertStagedChanges = async (stagedTransitions: StagedTransitionEntry[]): Promise<void> => {
  await Promise.allSettled(
    stagedTransitions.map((stagedTransition) =>
      stagedTransition.revisionData.persistence.revertChanges(stagedTransition.stagedChange)
    )
  )
}

/** Projects compatibility-builder recipes once into explicit before/after transitions. */
const projectAtomicDataOperations = (
  operations: AtomicDataOperation[]
): ProjectAtomicDataOperationsResult => {
  /** Projected transitions preserving builder registration order. */
  const transitions: AtomicDataTransition[] = []

  for (const [operationIndex, operation] of operations.entries()) {
    /** Authoritative store selected by the compatibility operation. */
    const revisionData = data[operation.store] as RevisionData<any, any>
    /** Current committed entry used as the transition's before side. */
    const committedEntry = revisionData.committedStore.getEntry(operation.id)

    if (operation.type === 'create') {
      if (committedEntry) {
        throw new Error(`Cannot create ${operation.store}:${operation.id}; entry already exists`)
      }
      transitions.push({
        operationIndex,
        store: operation.store,
        id: operation.id,
        before: null,
        after: { data: operation.data, persistenceFields: operation.persistenceFields },
        expectedRevision: 0,
        incrementsRevision: true
      })
      continue
    }

    if (!committedEntry) {
      throw new Error(`Cannot ${operation.type} ${operation.store}:${operation.id}; missing entry`)
    }
    if (
      'expectedRevision' in operation &&
      operation.expectedRevision != null &&
      operation.expectedRevision !== committedEntry.revision
    ) {
      return {
        status: 'conflict',
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

    /** Desired persistence metadata supplied by the operation or retained from before. */
    const persistenceFields =
      operation.type === 'updatePersistenceFields'
        ? operation.persistenceFields
        : operation.type === 'update' && operation.persistenceFields !== undefined
          ? operation.persistenceFields
          : committedEntry.persistenceFields
    /** Desired data after applying a compatibility recipe exactly once. */
    const nextData =
      operation.type === 'update'
        ? produce(committedEntry.committed, operation.recipe as DataRecipe<any>)
        : operation.type === 'delete'
          ? null
          : committedEntry.committed
    transitions.push({
      operationIndex,
      store: operation.store,
      id: operation.id,
      before: {
        revision: committedEntry.revision,
        data: committedEntry.committed,
        persistenceFields: committedEntry.persistenceFields
      },
      after: nextData === null ? null : { data: nextData, persistenceFields },
      expectedRevision: 'expectedRevision' in operation ? operation.expectedRevision : undefined,
      incrementsRevision: operation.type !== 'updatePersistenceFields'
    })
  }

  return { status: 'success', transitions }
}

/** Stages each projected transition through its entity persistence layer. */
const stageAtomicDataTransitions = async (
  transitions: AtomicDataTransition[]
): Promise<StagedTransitionEntry[]> => {
  /** Successfully staged transitions accumulated for commit or rollback. */
  const stagedTransitions: StagedTransitionEntry[] = []
  try {
    for (const transition of transitions) {
      /** Revision data and persistence adapter selected by entity type. */
      const revisionData = data[transition.store] as RevisionData<any, any>
      /** Filesystem staging result for the explicit before/after records. */
      const stageResult = await revisionData.persistence.stageChanges({
        before: transition.before
          ? {
              data: transition.before.data,
              persistenceFields: transition.before.persistenceFields
            }
          : null,
        after: transition.after
      })
      stagedTransitions.push({
        transition,
        revisionData,
        nextPersistenceFields:
          stageResult.nextPersistenceFields ?? transition.after?.persistenceFields,
        stagedChange: stageResult.stagedChange
      })
    }
    return stagedTransitions
  } catch (error) {
    await revertStagedChanges(stagedTransitions)
    throw error
  }
}

/** Applies committed transition data and storage metadata to authoritative stores. */
const applyCommittedInMemoryChanges = (
  stagedTransitions: StagedTransitionEntry[]
): AtomicDataCommittedResultInternal[] => {
  /** Committed results aligned with transition operation indexes. */
  const results: AtomicDataCommittedResultInternal[] = []

  for (const stagedTransition of stagedTransitions) {
    const { transition, revisionData } = stagedTransition

    if (!transition.after) {
      revisionData.committedStore.remove(transition.id)
      if (transition.incrementsRevision) revisionData.emitCommittedRevisionChanged(transition.id)
      results.push({
        store: transition.store,
        id: transition.id,
        revision: null,
        data: null
      })
      continue
    }

    /** Desired committed data for this transition. */
    const nextData = transition.after.data
    if (!transition.incrementsRevision) {
      revisionData.committedStore.updatePersistenceFields(
        transition.id,
        stagedTransition.nextPersistenceFields
      )
      results.push({
        store: transition.store,
        id: transition.id,
        revision: revisionData.committedStore.getRevision(transition.id),
        data: nextData
      })
      continue
    }

    if (!transition.before) {
      revisionData.committedStore.setFromDisk(
        transition.id,
        nextData,
        stagedTransition.nextPersistenceFields
      )
    }

    const revision = revisionData.committedStore.commitAfterWrite(
      transition.id,
      nextData,
      stagedTransition.nextPersistenceFields
    )

    revisionData.emitCommittedRevisionChanged(transition.id)
    results.push({
      store: transition.store,
      id: transition.id,
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

/** Converts domain and storage transitions into the atomic core's uniform representation. */
const buildAtomicTransitionsFromDomainProjection = (
  projection: DomainTransitionProjection
): AtomicDataTransition[] => {
  /** Desired domain writes and filename-only storage moves derived from both graphs. */
  const storageTransitions = planDomainStorageTransitions(
    projection.beforeGraph,
    projection.afterGraph,
    projection.transitions
  )
  /** Domain transitions keyed for expected revisions and revision increment policy. */
  const domainTransitionsByKey = new Map(
    projection.transitions.map((transition, operationIndex) => [
      `${transition.entityType}:${transition.id}`,
      { transition, operationIndex }
    ])
  )
  /** Next synthetic index assigned only to storage-location sibling transitions. */
  let nextStorageOperationIndex = projection.transitions.length

  return storageTransitions.map((storageTransition) => {
    /** Optional domain transition sharing this storage target. */
    const domainTarget = domainTransitionsByKey.get(
      `${storageTransition.entityType}:${storageTransition.id}`
    )
    /** Domain before node supplying the authoritative revision when data changes. */
    const domainBefore = domainTarget?.transition.before
    /** Current revision retained for a location-only storage transition. */
    const currentRevision =
      domainBefore?.revision ??
      data[storageTransition.entityType].committedStore.getRevision(storageTransition.id)
    return {
      operationIndex: domainTarget?.operationIndex ?? nextStorageOperationIndex++,
      store: storageTransition.entityType,
      id: storageTransition.id,
      before: storageTransition.before
        ? {
            revision: currentRevision,
            data: storageTransition.before.data,
            persistenceFields: storageTransition.before.persistenceFields
          }
        : null,
      after: storageTransition.after,
      expectedRevision: domainTarget?.transition.expectedRevision,
      incrementsRevision: domainTarget !== undefined
    }
  })
}

/** Checks transition preconditions against stores while the global mutation queue is held. */
const validateAtomicDataTransitions = (
  transitions: AtomicDataTransition[]
): StageConflict | null => {
  for (const transition of transitions) {
    /** Latest authoritative entry for one projected transition. */
    const committedEntry = data[transition.store].committedStore.getEntry(transition.id)
    if (!transition.before) {
      if (committedEntry) {
        throw new Error(`Cannot create ${transition.store}:${transition.id}; entry already exists`)
      }
      continue
    }
    if (!committedEntry) {
      throw new Error(`Cannot update ${transition.store}:${transition.id}; missing entry`)
    }
    if (
      transition.expectedRevision !== undefined &&
      transition.expectedRevision !== committedEntry.revision
    ) {
      return {
        operationIndex: transition.operationIndex,
        store: transition.store,
        id: transition.id,
        expectedRevision: transition.expectedRevision,
        actualRevision: committedEntry.revision,
        data: committedEntry.committed
      }
    }
  }
  return null
}

/** Stages, commits, and applies explicit transitions as one atomic data transaction. */
const runAtomicDataTransitionsImmediately = async (
  transitions: AtomicDataTransition[]
): Promise<AtomicDataImmediateTransactionOutcome> => {
  /** CAS conflict found before any filesystem work is staged. */
  const conflict = validateAtomicDataTransitions(transitions)
  if (conflict) return { status: 'conflict', conflict }
  /** Filesystem work staged by each entity persistence layer. */
  const stagedTransitions = await stageAtomicDataTransitions(transitions)

  try {
    for (const stagedTransition of stagedTransitions) {
      await stagedTransition.revisionData.persistence.commitChanges(
        stagedTransition.stagedChange
      )
    }
  } catch (error) {
    await revertStagedChanges(stagedTransitions)
    throw error
  }

  return {
    status: 'success',
    results: applyCommittedInMemoryChanges(stagedTransitions)
  }
}

const runAtomicDataTransactionImmediately = async (
  operations: AtomicDataOperation[]
): Promise<AtomicDataImmediateTransactionOutcome> => {
  assertNoDuplicateOperationTargets(operations)
  /** Explicit transitions projected from the legacy builder operations. */
  const projection = projectAtomicDataOperations(operations)
  return projection.status === 'conflict'
    ? { status: 'conflict', conflict: projection.conflict }
    : await runAtomicDataTransitionsImmediately(projection.transitions)
}

const assertBuilderResultShape: (
  result: unknown
) => asserts result is AtomicDataTransactionHandles = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(
      'Atomic transaction builder must return a labeled object of transaction handles'
    )
  }
}

const mapResultHandlesToCommittedResults = <THandles extends AtomicDataTransactionHandles>(
  handles: THandles,
  committedResults: AtomicDataCommittedResultInternal[]
): AtomicDataTransactionResultMap<THandles> => {
  const mappedResults = {} as AtomicDataTransactionResultMap<THandles>

  for (const [label, handle] of Object.entries(handles) as Array<
    [keyof THandles, THandles[keyof THandles]]
  >) {
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

/** Queue behavior selected for one atomic data transaction. */
export type AtomicDataTransactionMode = 'queued' | 'immediate'

/** Optional execution mode for callers already running inside the global mutation queue. */
export type AtomicDataTransactionOptions = {
  mode?: AtomicDataTransactionMode
}

/** Minimal outcome returned by the transition-native domain transaction path. */
export type AtomicDomainTransitionOutcome =
  | { status: 'success' }
  | { status: 'conflict' }

/** Executes a projected domain transaction directly through the transition atomic core. */
export const runAtomicDomainTransitionTransaction = async (
  projection: DomainTransitionProjection,
  options: AtomicDataTransactionOptions = {}
): Promise<AtomicDomainTransitionOutcome> => {
  /** Atomic transitions combining revision changes with storage-location sibling moves. */
  const transitions = buildAtomicTransitionsFromDomainProjection(projection)
  /** Immediate or globally queued transition execution result. */
  const outcome =
    options.mode === 'immediate'
      ? await runAtomicDataTransitionsImmediately(transitions)
      : await enqueueGlobalMutation(async () => {
          // Side effect: serialize ordinary main-process transactions through one queue.
          return await runAtomicDataTransitionsImmediately(transitions)
        })
  return outcome.status === 'conflict' ? { status: 'conflict' } : { status: 'success' }
}

/** Compatibility wrapper that projects legacy builder operations into the transition core. */
export const runAtomicDataTransaction = async <THandles extends AtomicDataTransactionHandles>(
  buildTransaction: (tx: AtomicDataBuilder) => THandles,
  options: AtomicDataTransactionOptions = {}
): Promise<AtomicDataTransactionOutcome<THandles>> => {
  const { tx, operations } = createAtomicDataBuilder()
  const handles: THandles = buildTransaction(tx)
  assertBuilderResultShape(handles)

  /** Immediate or queued staging and commit result. */
  const outcome =
    options.mode === 'immediate'
      ? await runAtomicDataTransactionImmediately(operations)
      : await enqueueGlobalMutation(async () => {
          // Side effect: serialize ordinary main-process transactions through one queue.
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
