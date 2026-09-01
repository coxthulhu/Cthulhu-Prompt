import type { Transaction } from '@tanstack/svelte-db'
import {
  assertValidDomainChanges,
  buildDomainTargetKey,
  isDomainMutationConflict,
  type DomainChange,
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
import {
  createPromptFull,
  isPromptFull,
  type Prompt,
  type PromptSummaryData
} from '@shared/Prompt'
import {
  createPromptTemplateFull,
  isPromptTemplateFull,
  type PromptTemplate,
  type PromptTemplateSummaryData
} from '@shared/PromptTemplate'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptClientStateCollection } from '../Collections/PromptClientStateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptTemplateClientStateCollection } from '../Collections/PromptTemplateClientStateCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { categoryDescriptionEditorUiStateCollection } from '../Collections/CategoryDescriptionEditorUiStateCollection'
import { clearPromptEditorMeasuredHeight } from '../UiState/PromptEditorUiCache.svelte.ts'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from './RevisionCollections'

/** Revision mutation options used to expose the existing optimistic helper map. */
type DomainRevisionMutationOptions = Parameters<
  typeof runRevisionMutation<DomainMutationResponsePayload>
>[0]

/** Renderer-only optimistic changes applied alongside shared domain changes. */
type RendererOnlyMutation = DomainRevisionMutationOptions['mutateOptimistically']

/** Local-only collection whose transaction changes are accepted after IPC success. */
type RendererClientStateCollection = {
  utils: { acceptMutations: (transaction: Transaction<any>) => void }
}

/** Grouped shared command and planner inputs for an immediate renderer mutation. */
type RendererDomainMutationDefinition<TCommand> = {
  command: TCommand
  plan: DomainPlanner<TCommand>
  /** Optional registration policy narrowing which planned targets require expectations. */
  selectExpectedTargets?: DomainExpectedTargetSelector
}

/** Grouped IPC routing inputs for an immediate renderer mutation. */
type RendererDomainMutationIpc = {
  channel: string
}

/** Grouped renderer-only changes and client-state acceptance configuration. */
type RendererDomainMutationState = {
  mutate?: RendererOnlyMutation
  clientStateCollections?: RendererClientStateCollection[]
}

/** Inputs accepted by the immediate renderer domain mutation framework. */
export type ImmediateRendererDomainMutationOptions<TCommand> = {
  mutation: RendererDomainMutationDefinition<TCommand>
  ipc: RendererDomainMutationIpc
  renderer: RendererDomainMutationState
}

/** Dispatch configuration for one single-target paced domain mutation. */
type RendererDomainMutationPacing = {
  /** Authoritative entity that exclusively owns the pending paced transaction. */
  target: DomainTarget
  /** Inactivity window restarted after every same-target mutation call. */
  debounceMs: number
  /** Optional input validation performed immediately before queueing persistence. */
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

/** Inputs accepted by the paced renderer domain mutation framework. */
export type PacedRendererDomainMutationOptions<TCommand> = {
  mutation: RendererDomainMutationDefinition<TCommand>
  ipc: RendererDomainMutationIpc
  renderer: RendererDomainMutationState
  pacing: RendererDomainMutationPacing
}

/** Latest replacement command and plan owned by one pending paced transaction. */
type LatestPacedRendererDomainMutation = {
  command: unknown
  plan: DomainChange[]
  selectExpectedTargets?: DomainExpectedTargetSelector
  ipcChannel: string
  clientStateCollections?: RendererClientStateCollection[]
}

/** Weak transaction metadata used to replace the command persisted by merged edits. */
const latestPacedRendererDomainMutationByTransaction = new WeakMap<
  Transaction<any>,
  LatestPacedRendererDomainMutation
>()

/** Removes enumerable TanStack virtual fields before strict command IPC validation. */
const stripRendererDomainCommandVirtualProps = <TCommand>(command: TCommand): TCommand => {
  if (typeof command !== 'object' || command === null || Array.isArray(command)) return command
  /** Exact command entries excluding renderer-only collection metadata. */
  const entries = Object.entries(command).filter(([key]) => !key.startsWith('$'))
  return Object.fromEntries(entries) as TCommand
}

/** Removes the renderer-only loading discriminator from a prompt projection. */
const toPromptDomainProjection = (prompt: Prompt): DomainPlannerEntityMap['prompt'] => {
  /** Loading discriminator excluded from shared domain planning. */
  const { loadingState: _loadingState, ...projection } = prompt
  return projection as PromptSummaryData | DomainPlannerEntityMap['prompt']
}

/** Removes the renderer-only loading discriminator from a template projection. */
const toPromptTemplateDomainProjection = (
  promptTemplate: PromptTemplate
): DomainPlannerEntityMap['promptTemplate'] => {
  /** Loading discriminator excluded from shared domain planning. */
  const { loadingState: _loadingState, ...projection } = promptTemplate
  return projection as PromptTemplateSummaryData | DomainPlannerEntityMap['promptTemplate']
}

/** Reads one entity from the renderer's authoritative revision collections. */
const getRendererDomainEntity = <TEntityType extends DomainEntityType>(
  entityType: TEntityType,
  id: string
): DomainPlannerEntityMap[TEntityType] | undefined => {
  switch (entityType) {
    case 'systemSettings':
      return systemSettingsCollection.get(id) as DomainPlannerEntityMap[TEntityType] | undefined
    case 'workspace':
      return workspaceCollection.get(id) as DomainPlannerEntityMap[TEntityType] | undefined
    case 'promptFolder':
      return promptFolderCollection.get(id) as DomainPlannerEntityMap[TEntityType] | undefined
    case 'category':
      return categoryCollection.get(id) as DomainPlannerEntityMap[TEntityType] | undefined
    case 'prompt': {
      /** Renderer prompt projected into its shared domain representation. */
      const prompt = promptCollection.get(id)
      return (prompt ? toPromptDomainProjection(prompt) : undefined) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    }
    case 'promptTemplate': {
      /** Renderer template projected into its shared domain representation. */
      const promptTemplate = promptTemplateCollection.get(id)
      return (promptTemplate ? toPromptTemplateDomainProjection(promptTemplate) : undefined) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    }
    case 'userPersistence':
      return userPersistenceCollection.get(id) as DomainPlannerEntityMap[TEntityType] | undefined
    case 'markdownContentUiState':
      return markdownContentUiStateCollection.get(id) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    case 'workspaceUiState':
      return workspaceUiStateCollection.get(id) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    case 'workspacePromptFolderUiState':
      return workspacePromptFolderUiStateCollection.get(id) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    case 'accordionUiState':
      return accordionUiStateCollection.get(id) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
    case 'categoryDescriptionEditorUiState':
      return categoryDescriptionEditorUiStateCollection.get(id) as
        | DomainPlannerEntityMap[TEntityType]
        | undefined
  }
}

/** Reads every loaded entity of one type from renderer revision collections. */
const getAllRendererDomainEntities = <TEntityType extends DomainEntityType>(
  entityType: TEntityType
): ReadonlyArray<DomainPlannerEntityMap[TEntityType]> => {
  switch (entityType) {
    case 'systemSettings':
      return systemSettingsCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'workspace':
      return workspaceCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'promptFolder':
      return promptFolderCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'category':
      return categoryCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'prompt':
      return promptCollection.toArray.map(toPromptDomainProjection) as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'promptTemplate':
      return promptTemplateCollection.toArray.map(toPromptTemplateDomainProjection) as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'userPersistence':
      return userPersistenceCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'markdownContentUiState':
      return markdownContentUiStateCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'workspaceUiState':
      return workspaceUiStateCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'workspacePromptFolderUiState':
      return workspacePromptFolderUiStateCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'accordionUiState':
      return accordionUiStateCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
    case 'categoryDescriptionEditorUiState':
      return categoryDescriptionEditorUiStateCollection.toArray as unknown as Array<
        DomainPlannerEntityMap[TEntityType]
      >
  }
}

/** Shared domain state backed by current renderer revision collections. */
const rendererDomainState: DomainState = {
  get: getRendererDomainEntity,
  getAll: getAllRendererDomainEntities
}

/** Applies one shared domain change through optimistic collection helpers. */
const applyRendererDomainChange = (
  collections: Parameters<RendererOnlyMutation>[0]['collections'],
  change: DomainChange
): void => {
  if (change.type === 'delete') {
    /** Revision collection whose optimistic record may be absent for an optional delete. */
    const collection = getRendererRevisionCollection(change.entityType)
    if (!collection.has(change.id)) return
    collections[change.entityType].delete(change.id)
    return
  }

  if (change.type === 'update') {
    collections[change.entityType].update(change.id, change.recipe)
    return
  }

  switch (change.entityType) {
    case 'prompt':
      collections.prompt.insert(createPromptFull(change.data))
      return
    case 'promptTemplate':
      collections.promptTemplate.insert(createPromptTemplateFull(change.data))
      return
    default:
      collections[change.entityType].insert(change.data)
  }
}

/** Returns the renderer collection owning one domain entity's authoritative revision. */
const getRendererRevisionCollection = (entityType: DomainEntityType) => {
  switch (entityType) {
    case 'systemSettings':
      return systemSettingsCollection
    case 'workspace':
      return workspaceCollection
    case 'promptFolder':
      return promptFolderCollection
    case 'category':
      return categoryCollection
    case 'prompt':
      return promptCollection
    case 'promptTemplate':
      return promptTemplateCollection
    case 'userPersistence':
      return userPersistenceCollection
    case 'markdownContentUiState':
      return markdownContentUiStateCollection
    case 'workspaceUiState':
      return workspaceUiStateCollection
    case 'workspacePromptFolderUiState':
      return workspacePromptFolderUiStateCollection
    case 'accordionUiState':
      return accordionUiStateCollection
    case 'categoryDescriptionEditorUiState':
      return categoryDescriptionEditorUiStateCollection
  }
}

/** Captures authoritative revision expectations for renderer-computed domain targets. */
const buildRendererDomainExpectations = (
  changes: readonly DomainChange[],
  selectExpectedTargets?: DomainExpectedTargetSelector
): DomainRevisionExpectation[] =>
  (selectExpectedTargets?.(changes) ?? changes).map((target) => {
    /** Planned operation selected for one expected entity target. */
    const change = changes.find(
      (candidate) =>
        candidate.entityType === target.entityType && candidate.id === target.id
    )!
    /** Renderer revision collection for the planned target. */
    const collection = getRendererRevisionCollection(change.entityType)
    if (change.type === 'insert') {
      return {
        entityType: change.entityType,
        id: change.id,
        expected: 'absent' as const
      }
    }
    return collection.utils.hasAuthoritative(change.id)
      ? {
          entityType: change.entityType,
          id: change.id,
          expected: 'revision' as const,
          revision: collection.utils.getAuthoritativeRevision(change.id)
        }
      : {
          entityType: change.entityType,
          id: change.id,
          expected: 'absent' as const
        }
  })

/** Enforces the documented single-target replacement contract for paced domain plans. */
const assertPacedDomainPlanTargetsOnly = (
  changes: readonly DomainChange[],
  target: DomainTarget
): void => {
  if (
    changes.length !== 1 ||
    buildDomainTargetKey(changes[0]!) !== buildDomainTargetKey(target)
  ) {
    throw new Error(
      `Paced domain mutation must modify exactly its declared target ${buildDomainTargetKey(target)}`
    )
  }
}

/** Reconciles one generic authoritative snapshot into renderer revision state. */
const reconcileRendererDomainSnapshot = (snapshot: DomainSnapshot): void => {
  if ('deleted' in snapshot) {
    getRendererRevisionCollection(snapshot.entityType).utils.deleteAuthoritative(snapshot.id)
    if (snapshot.entityType === 'prompt' && promptClientStateCollection.has(snapshot.id)) {
      promptClientStateCollection.delete(snapshot.id)
    }
    if (
      snapshot.entityType === 'promptTemplate' &&
      promptTemplateClientStateCollection.has(snapshot.id)
    ) {
      promptTemplateClientStateCollection.delete(snapshot.id)
    }
    return
  }

  switch (snapshot.entityType) {
    case 'systemSettings':
      systemSettingsCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspace':
      workspaceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'promptFolder':
      promptFolderCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'category':
      categoryCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'prompt': {
      /** Current renderer prompt inspected before authoritative text reconciliation. */
      const currentPrompt = promptCollection.get(snapshot.id)
      if (
        !currentPrompt ||
        !isPromptFull(currentPrompt) ||
        currentPrompt.promptText !== snapshot.data.promptText
      ) {
        clearPromptEditorMeasuredHeight(snapshot.id)
      }
      /** Full prompt snapshot normalized for the renderer collection and client state. */
      const promptSnapshot = { ...snapshot, data: createPromptFull(snapshot.data) }
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      if (!promptClientStateCollection.has(snapshot.id)) {
        promptClientStateCollection.insert({ id: snapshot.id, isEdited: false })
      }
      return
    }
    case 'promptTemplate': {
      /** Current renderer template inspected before authoritative text reconciliation. */
      const currentTemplate = promptTemplateCollection.get(snapshot.id)
      if (
        !currentTemplate ||
        !isPromptTemplateFull(currentTemplate) ||
        currentTemplate.templateText !== snapshot.data.templateText
      ) {
        clearPromptEditorMeasuredHeight(snapshot.id)
      }
      /** Full template snapshot normalized for the renderer collection and client state. */
      const promptTemplateSnapshot = {
        ...snapshot,
        data: createPromptTemplateFull(snapshot.data)
      }
      promptTemplateCollection.utils.upsertAuthoritative(promptTemplateSnapshot)
      if (!promptTemplateClientStateCollection.has(snapshot.id)) {
        promptTemplateClientStateCollection.insert({ id: snapshot.id, isEdited: false })
      }
      return
    }
    case 'userPersistence':
      userPersistenceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'markdownContentUiState':
      markdownContentUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspaceUiState':
      workspaceUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspacePromptFolderUiState':
      workspacePromptFolderUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'accordionUiState':
      accordionUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'categoryDescriptionEditorUiState':
      categoryDescriptionEditorUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
  }
}

/** Runs one optimistic shared domain plan through the existing immediate mutation queue. */
export const runImmediateRendererDomainMutation = async <TCommand>(
  options: ImmediateRendererDomainMutationOptions<TCommand>
): Promise<void> => {
  /** Shared mutation plan computed before applying renderer optimism. */
  const plan = options.mutation.plan(rendererDomainState, options.mutation.command)
  if (isDomainMutationConflict(plan)) throw new Error(plan.reason)
  assertValidDomainChanges(plan)

  await runRevisionMutation<DomainMutationResponsePayload>({
    mutateOptimistically: (helpers) => {
      for (const change of plan) applyRendererDomainChange(helpers.collections, change)
      options.renderer.mutate?.(helpers)
    },
    persistMutations: async ({ invoke, transaction }) => {
      /** Latest authoritative expectations captured after earlier queued mutations settle. */
      const expectations = buildRendererDomainExpectations(
        plan,
        options.mutation.selectExpectedTargets
      )
      /** Generic domain IPC response for success or authoritative conflict. */
      const result = await invoke<{
        payload: DomainMutationRequest<TCommand>
      }>(options.ipc.channel, {
        payload: {
          command: stripRendererDomainCommandVirtualProps(options.mutation.command),
          expectations
        }
      }) as IpcMutationPayloadResult<DomainMutationResponsePayload>
      if (result.success) {
        for (const collection of options.renderer.clientStateCollections ?? []) {
          collection.utils.acceptMutations(transaction)
        }
      }
      return result
    },
    handleSuccessOrConflictResponse: (payload) => {
      for (const snapshot of payload.snapshots) reconcileRendererDomainSnapshot(snapshot)
    },
    conflictMessage: `Domain mutation conflict on ${options.ipc.channel}`
  })
}

/**
 * Applies one optimistic single-entity replacement plan and debounces its latest command.
 * Paced callers must use set-style commands, declare the plan's only authoritative target,
 * and keep the planner, IPC channel, renderer configuration, and validation stable while that
 * target has a pending transaction.
 */
export const mutatePacedRendererDomainMutation = <TCommand>(
  options: PacedRendererDomainMutationOptions<TCommand>
): void => {
  /** Shared single-target plan computed against the latest optimistic renderer state. */
  const plan = options.mutation.plan(rendererDomainState, options.mutation.command)
  if (isDomainMutationConflict(plan)) throw new Error(plan.reason)
  assertValidDomainChanges(plan)
  assertPacedDomainPlanTargetsOnly(plan, options.pacing.target)

  /** Existing paced revision transaction used to merge optimism and serialize persistence. */
  const transaction = mutatePacedRevisionUpdateTransaction<DomainMutationResponsePayload>({
    collectionId: getRendererRevisionCollection(options.pacing.target.entityType).id,
    elementId: options.pacing.target.id,
    debounceMs: options.pacing.debounceMs,
    validateBeforeEnqueue: options.pacing.validateBeforeEnqueue,
    mutateOptimistically: (helpers) => {
      applyRendererDomainChange(helpers.collections, plan[0]!)
      options.renderer.mutate?.(helpers)
    },
    persistMutations: async ({ invoke, transaction }) => {
      /** Latest same-target invocation replacing earlier commands in this transaction. */
      const latestMutation = latestPacedRendererDomainMutationByTransaction.get(transaction)!
      /** Authoritative expectations captured after earlier globally queued mutations settle. */
      const expectations = buildRendererDomainExpectations(
        latestMutation.plan,
        latestMutation.selectExpectedTargets
      )
      /** Generic response produced by persisting only the latest replacement command. */
      const result = (await invoke<{ payload: DomainMutationRequest<TCommand> }>(
        latestMutation.ipcChannel,
        {
          payload: {
            command: stripRendererDomainCommandVirtualProps(
              latestMutation.command as TCommand
            ),
            expectations
          }
        }
      )) as IpcMutationPayloadResult<DomainMutationResponsePayload>
      if (result.success) {
        for (const collection of latestMutation.clientStateCollections ?? []) {
          collection.utils.acceptMutations(transaction)
        }
      }
      return result
    },
    handleSuccessOrConflictResponse: (payload) => {
      for (const snapshot of payload.snapshots) reconcileRendererDomainSnapshot(snapshot)
    },
    conflictMessage: `Domain mutation conflict on ${options.ipc.channel}`
  })

  latestPacedRendererDomainMutationByTransaction.set(transaction, {
    command: options.mutation.command,
    plan,
    selectExpectedTargets: options.mutation.selectExpectedTargets,
    ipcChannel: options.ipc.channel,
    clientStateCollections: options.renderer.clientStateCollections
  })
}
