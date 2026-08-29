import { ipcMain } from 'electron'
import {
  assertValidDomainChanges,
  buildDomainTargetKey,
  isDomainMutationConflict,
  type DomainCommandParser,
  type DomainEntityType,
  type DomainExpectedTargetSelector,
  type DomainMutationRequest,
  type DomainMutationResponsePayload,
  type DomainPlanner,
  type DomainPlannerEntityMap,
  type DomainRevisionExpectation,
  type DomainSnapshot,
  type DomainState,
  type DomainTarget
} from '@shared/DomainChanges'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { runAtomicDomainTransitionTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { projectDomainTransitions } from '../Data/DomainTransitions'
import {
  buildCategorySnapshot,
  buildPromptFolderSnapshot,
  buildPromptSnapshot,
  buildPromptTemplateSnapshot,
  buildWorkspaceSnapshot
} from '../Data/DataSnapshotHelpers'
import { enqueueGlobalMutation } from '../Data/GlobalMutationQueue'
import {
  createRequestParser,
  parseArray,
  parseNumber,
  parseObject,
  parseString,
  parseWireRequestWithPayload,
  type ParsedRequest,
  type Parser
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'

/** IPC channel registered for one main domain mutation. */
type MainDomainMutationIpc = {
  channel: string
}

/** Colocated command behavior used by one main domain mutation channel. */
type MainDomainMutationDefinition<TCommand> = {
  parseCommand: DomainCommandParser<TCommand>
  plan: DomainPlanner<TCommand>
  /** Optional registration policy narrowing which planned targets require expectations. */
  selectExpectedTargets?: DomainExpectedTargetSelector
}

/** Inputs used to register one generic main-process domain mutation handler. */
export type MainDomainMutationOptions<TCommand> = {
  ipc: MainDomainMutationIpc
  mutation: MainDomainMutationDefinition<TCommand>
}

/** Complete parsed IPC request contract for one domain mutation command. */
type MainDomainMutationRequestParser<TCommand> = (
  request: unknown
) => ParsedRequest<IpcRequestWithPayload<DomainMutationRequest<TCommand>>>

/** Parses one present or absent revision expectation from a domain mutation request. */
const parseDomainRevisionExpectation: Parser<DomainRevisionExpectation> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw expectation fields inspected according to their discriminant. */
  const record = value as Record<string, unknown>
  /** Runtime-validated domain entity type. */
  const entityType =
    record.entityType === 'systemSettings' ||
    record.entityType === 'workspace' ||
    record.entityType === 'promptFolder' ||
    record.entityType === 'category' ||
    record.entityType === 'prompt' ||
    record.entityType === 'promptTemplate'
      ? record.entityType
      : null
  /** Runtime-validated target ID. */
  const id = parseString(record.id)
  if (!entityType || id === null) return null
  if (record.expected === 'absent' && Object.keys(record).length === 3) {
    return { entityType, id, expected: 'absent' }
  }
  /** Runtime-validated expected revision for a present target. */
  const revision = parseNumber(record.revision)
  return record.expected === 'revision' && revision !== null && Object.keys(record).length === 4
    ? { entityType, id, expected: 'revision', revision }
    : null
}

/** Constructs the complete IPC request parser around one mutation-specific command parser. */
const createDomainMutationRequestParser = <TCommand>(
  commandParser: DomainCommandParser<TCommand>
): MainDomainMutationRequestParser<TCommand> =>
  createRequestParser(
    parseWireRequestWithPayload(
      parseObject<DomainMutationRequest<TCommand>>({
        command: commandParser,
        expectations: parseArray(parseDomainRevisionExpectation)
      })
    )
  )

/** Reads one main-process committed entity through the shared domain-state contract. */
const getMainDomainEntity = <TEntityType extends DomainEntityType>(
  entityType: TEntityType,
  id: string
): DomainPlannerEntityMap[TEntityType] | undefined =>
  data[entityType].committedStore.getEntry(id)?.committed as
    | DomainPlannerEntityMap[TEntityType]
    | undefined

/** Reads all main-process committed entities of one shared domain type. */
const getAllMainDomainEntities = <TEntityType extends DomainEntityType>(
  entityType: TEntityType
): ReadonlyArray<DomainPlannerEntityMap[TEntityType]> =>
  data[entityType].committedStore
    .getAllEntries()
    .map((entry) => entry.committed) as Array<DomainPlannerEntityMap[TEntityType]>

/** Shared domain state backed by authoritative main-process committed stores. */
const mainDomainState: DomainState = {
  get: getMainDomainEntity,
  getAll: getAllMainDomainEntities
}

/** Builds a present or deleted generic snapshot for one authoritative target. */
const buildMainDomainSnapshot = (target: DomainTarget): DomainSnapshot => {
  switch (target.entityType) {
    case 'systemSettings': {
      /** Current system-settings entry selected by its singleton target ID. */
      const entry = data.systemSettings.committedStore.getEntry(target.id)
      return entry
        ? {
            entityType: 'systemSettings',
            id: target.id,
            revision: entry.revision,
            data: entry.committed
          }
        : { entityType: 'systemSettings', id: target.id, deleted: true }
    }
    case 'workspace': {
      /** Current workspace entry used by the established snapshot normalizer. */
      const entry = data.workspace.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'workspace', ...buildWorkspaceSnapshot(entry) }
        : { entityType: 'workspace', id: target.id, deleted: true }
    }
    case 'promptFolder': {
      /** Current prompt-folder entry used by the established graph filter. */
      const entry = data.promptFolder.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'promptFolder', ...buildPromptFolderSnapshot(entry) }
        : { entityType: 'promptFolder', id: target.id, deleted: true }
    }
    case 'category': {
      /** Current category entry selected for generic reconciliation. */
      const entry = data.category.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'category', ...buildCategorySnapshot(entry) }
        : { entityType: 'category', id: target.id, deleted: true }
    }
    case 'prompt': {
      /** Current prompt entry used by the established modified-time snapshot adapter. */
      const entry = data.prompt.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'prompt', ...buildPromptSnapshot(entry) }
        : { entityType: 'prompt', id: target.id, deleted: true }
    }
    case 'promptTemplate': {
      /** Current template entry used by the established modified-time snapshot adapter. */
      const entry = data.promptTemplate.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'promptTemplate', ...buildPromptTemplateSnapshot(entry) }
        : { entityType: 'promptTemplate', id: target.id, deleted: true }
    }
  }
}

/** Builds generic authoritative snapshots for a complete unique target set. */
const buildMainDomainSnapshots = (targets: readonly DomainTarget[]): DomainSnapshot[] =>
  targets.map(buildMainDomainSnapshot)

/** Reports whether renderer expectations exactly match main-computed target keys. */
const hasMatchingDomainTargetSet = (
  expectations: readonly DomainRevisionExpectation[],
  targets: readonly DomainTarget[]
): boolean => {
  /** Unique renderer expectation keys used to reject duplicates and omissions. */
  const expectationKeys = new Set(expectations.map(buildDomainTargetKey))
  /** Unique main-computed target keys used to reject planner duplicates. */
  const targetKeys = new Set(targets.map(buildDomainTargetKey))
  return (
    expectationKeys.size === expectations.length &&
    targetKeys.size === targets.length &&
    expectationKeys.size === targetKeys.size &&
    [...targetKeys].every((targetKey) => expectationKeys.has(targetKey))
  )
}

/** Reports whether all renderer revisions match current committed target state. */
const hasMatchingDomainRevisions = (
  expectations: readonly DomainRevisionExpectation[]
): boolean =>
  expectations.every((expectation) => {
    /** Current committed entry for one renderer expectation. */
    const entry = data[expectation.entityType].committedStore.getEntry(expectation.id)
    return expectation.expected === 'absent'
      ? entry === null
      : entry !== null && entry.revision === expectation.revision
  })

/** Creates the generic conflict response used by target, revision, and invariant failures. */
const createDomainConflictResponse = (
  targets: readonly DomainTarget[]
): IpcMutationPayloadResult<DomainMutationResponsePayload> => ({
  success: false,
  conflict: true,
  payload: { snapshots: buildMainDomainSnapshots(targets) }
})

/** Runs a validated command inside the main global queue and immediate atomic transaction. */
const runMainDomainMutation = async <TCommand>(
  mutation: MainDomainMutationDefinition<TCommand>,
  request: DomainMutationRequest<TCommand>
): Promise<IpcMutationPayloadResult<DomainMutationResponsePayload>> =>
  await enqueueGlobalMutation(async () => {
    /** Main-computed shared mutation plan based on latest committed state. */
    const plan = mutation.plan(mainDomainState, request.command)
    if (isDomainMutationConflict(plan)) {
      return createDomainConflictResponse(plan.targets)
    }
    assertValidDomainChanges(plan)
    /** Correct target set derived exclusively from main-computed domain changes. */
    const targets: DomainTarget[] = plan.map(({ entityType, id }) => ({ entityType, id }))
    /** Registration-selected targets that require renderer concurrency expectations. */
    const expectedTargets = mutation.selectExpectedTargets?.(plan) ?? targets
    if (
      !hasMatchingDomainTargetSet(request.expectations, expectedTargets) ||
      !hasMatchingDomainRevisions(request.expectations)
    ) {
      return createDomainConflictResponse(targets)
    }

    /** Immutable graphs and transitions produced by applying main domain recipes once. */
    const projection = projectDomainTransitions(plan, request.expectations)
    /** Immediate atomic result because the main global queue is already held. */
    const outcome = await runAtomicDomainTransitionTransaction(projection, {
      mode: 'immediate'
    })
    if (outcome.status === 'conflict') return createDomainConflictResponse(targets)
    return { success: true, payload: { snapshots: buildMainDomainSnapshots(targets) } }
  })

/** Registers one mutation-specific shared planner behind a generic main IPC handler. */
export const handleMainDomainMutation = <TCommand>(
  options: MainDomainMutationOptions<TCommand>
): void => {
  /** Complete request parser constructed from the channel's colocated command parser. */
  const parseRequest = createDomainMutationRequestParser(options.mutation.parseCommand)
  ipcMain.handle(options.ipc.channel, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, parseRequest, async (validated) => {
      try {
        return await runMainDomainMutation(options.mutation, validated.payload)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })
  })
}
