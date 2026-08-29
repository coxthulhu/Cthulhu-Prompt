import { produce, type Draft } from 'immer'
import type {
  DomainChange,
  DomainEntityMap,
  DomainEntityType,
  DomainRevisionExpectation
} from '@shared/DomainChanges'
import { SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { data } from './Data'
import type { DomainPersistenceFieldsMap } from '../Persistence/PersistenceTypes'

/** One immutable entity node in a projected main-process domain graph. */
export type DomainGraphEntryFor<TEntityType extends DomainEntityType> = {
  revision: number
  data: DomainEntityMap[TEntityType]
  persistenceFields: DomainPersistenceFieldsMap[TEntityType] | null
}

/** Entity maps forming one complete before or after domain graph. */
type DomainGraphEntries = {
  [TEntityType in DomainEntityType]: Map<string, DomainGraphEntryFor<TEntityType>>
}

/** Immutable projected graph read by storage adapters. */
export type DomainGraph = {
  entries: DomainGraphEntries
  get: <TEntityType extends DomainEntityType>(
    entityType: TEntityType,
    id: string
  ) => DomainGraphEntryFor<TEntityType> | undefined
  getAll: <TEntityType extends DomainEntityType>(
    entityType: TEntityType
  ) => ReadonlyArray<DomainGraphEntryFor<TEntityType>>
}

/** One typed domain transition after a shared recipe has been applied exactly once. */
export type DomainTransitionFor<TEntityType extends DomainEntityType> = {
  entityType: TEntityType
  id: string
  before: DomainGraphEntryFor<TEntityType> | null
  after: DomainGraphEntryFor<TEntityType> | null
  expectedRevision: number | undefined
}

/** Strongly typed union of transitions supported by authoritative domain stores. */
export type DomainTransition = {
  [TEntityType in DomainEntityType]: DomainTransitionFor<TEntityType>
}[DomainEntityType]

/** Before/after graphs and their changed entity transitions for one domain mutation. */
export type DomainTransitionProjection = {
  beforeGraph: DomainGraph
  afterGraph: DomainGraph
  transitions: DomainTransition[]
}

/** Creates an empty typed graph-entry registry. */
const createEmptyGraphEntries = (): DomainGraphEntries => ({
  systemSettings: new Map(),
  workspace: new Map(),
  promptFolder: new Map(),
  category: new Map(),
  prompt: new Map(),
  promptTemplate: new Map()
})

/** Wraps typed entity maps with uniform graph lookup helpers. */
const createDomainGraph = (entries: DomainGraphEntries): DomainGraph => ({
  entries,
  get: (entityType, id) => entries[entityType].get(id) as
    | DomainGraphEntryFor<typeof entityType>
    | undefined,
  getAll: (entityType) => [...entries[entityType].values()] as Array<
    DomainGraphEntryFor<typeof entityType>
  >
})

/** Captures every current committed store entry as the immutable before graph. */
const captureCommittedDomainGraph = (): DomainGraph => {
  /** Typed maps populated from the six authoritative committed stores. */
  const entries = createEmptyGraphEntries()
  /** Domain entity types copied into the projected graph. */
  const entityTypes: DomainEntityType[] = [
    'systemSettings',
    'workspace',
    'promptFolder',
    'category',
    'prompt',
    'promptTemplate'
  ]

  for (const entityType of entityTypes) {
    for (const entry of data[entityType].committedStore.getAllEntries()) {
      /** Domain ID read from the authoritative record. */
      const id =
        entityType === 'systemSettings'
          ? SYSTEM_SETTINGS_ID
          : (
              entry.committed as Exclude<
                DomainEntityMap[typeof entityType],
                DomainEntityMap['systemSettings']
              >
            ).id
      /** Dynamically selected graph map hidden behind this entity-type dispatch boundary. */
      const targetEntries = entries[entityType] as Map<
        string,
        DomainGraphEntryFor<DomainEntityType>
      >
      targetEntries.set(id, {
        revision: entry.revision,
        data: entry.committed,
        persistenceFields: entry.persistenceFields
      } as DomainGraphEntryFor<typeof entityType>)
    }
  }

  return createDomainGraph(entries)
}

/** Copies graph maps while sharing immutable entry objects until a target changes. */
const copyDomainGraph = (graph: DomainGraph): DomainGraph =>
  createDomainGraph({
    systemSettings: new Map(graph.entries.systemSettings),
    workspace: new Map(graph.entries.workspace),
    promptFolder: new Map(graph.entries.promptFolder),
    category: new Map(graph.entries.category),
    prompt: new Map(graph.entries.prompt),
    promptTemplate: new Map(graph.entries.promptTemplate)
  })

/** Finds the optional renderer expectation associated with one planned target. */
const findExpectation = (
  expectations: readonly DomainRevisionExpectation[],
  entityType: DomainEntityType,
  id: string
): DomainRevisionExpectation | undefined =>
  expectations.find(
    (expectation) => expectation.entityType === entityType && expectation.id === id
  )

/** Projects validated domain changes into before/after graphs and executable transitions. */
export const projectDomainTransitions = (
  changes: readonly DomainChange[],
  expectations: readonly DomainRevisionExpectation[]
): DomainTransitionProjection => {
  /** Authoritative graph captured before any recipe is evaluated. */
  const beforeGraph = captureCommittedDomainGraph()
  /** Projected graph receiving each domain change exactly once. */
  const afterGraph = copyDomainGraph(beforeGraph)
  /** Typed transitions produced in the planner's meaningful order. */
  const transitions: DomainTransition[] = []

  for (const change of changes) {
    /** Current graph entry for the planned target. */
    const before = beforeGraph.get(change.entityType, change.id) ?? null
    /** Renderer expectation selected for this transition, when required. */
    const expectation = findExpectation(expectations, change.entityType, change.id)
    /** Atomic CAS revision; inserts use zero together with a null before node. */
    const expectedRevision =
      change.type === 'insert'
        ? 0
        : expectation?.expected === 'revision'
          ? expectation.revision
          : undefined

    if (change.type === 'insert') {
      if (before) throw new Error(`Cannot insert existing ${change.entityType}:${change.id}`)
      /** Newly projected entry without placeholder persistence metadata. */
      const after = {
        revision: 1,
        data: change.data,
        persistenceFields: null
      } as DomainGraphEntryFor<typeof change.entityType>
      afterGraph.entries[change.entityType].set(change.id, after as never)
      transitions.push({
        entityType: change.entityType,
        id: change.id,
        before: null,
        after,
        expectedRevision
      } as DomainTransition)
      continue
    }

    if (!before) throw new Error(`Domain transition target not loaded: ${change.entityType}:${change.id}`)
    if (change.type === 'delete') {
      afterGraph.entries[change.entityType].delete(change.id)
      transitions.push({
        entityType: change.entityType,
        id: change.id,
        before,
        after: null,
        expectedRevision
      } as DomainTransition)
      continue
    }

    /** Updated entity produced by applying the shared Immer recipe once. */
    const nextData = produce(
      before.data as DomainEntityMap[DomainEntityType],
      change.recipe as unknown as (draft: Draft<DomainEntityMap[DomainEntityType]>) => void
    ) as DomainEntityMap[typeof change.entityType]
    /** Projected updated entry retaining its current physical location until adapters run. */
    const after = {
      revision: before.revision + 1,
      data: nextData,
      persistenceFields: before.persistenceFields
    } as DomainGraphEntryFor<typeof change.entityType>
    afterGraph.entries[change.entityType].set(change.id, after as never)
    transitions.push({
      entityType: change.entityType,
      id: change.id,
      before,
      after,
      expectedRevision
    } as DomainTransition)
  }

  return { beforeGraph, afterGraph, transitions }
}
