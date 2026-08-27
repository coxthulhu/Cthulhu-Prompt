import type { Category } from './Category'
import type { PromptPersisted } from './Prompt'
import type { PromptFolder } from './PromptFolder'
import type { PromptTemplatePersisted } from './PromptTemplate'
import type { SystemSettings } from './SystemSettings'
import type { Workspace } from './Workspace'

/** Authoritative entity records supported by the shared domain-planning framework. */
export type DomainEntityMap = {
  systemSettings: SystemSettings
  workspace: Workspace
  promptFolder: PromptFolder
  category: Category
  prompt: PromptPersisted
  promptTemplate: PromptTemplatePersisted
}
export type DomainEntityType = keyof DomainEntityMap

export type DomainChangeFor<TEntityType extends DomainEntityType> =
  | {
      type: 'insert'
      entityType: TEntityType
      id: string
      data: DomainEntityMap[TEntityType]
    }
  | {
      type: 'update'
      entityType: TEntityType
      id: string
      data: DomainEntityMap[TEntityType]
    }
  | {
      type: 'delete'
      entityType: TEntityType
      id: string
    }

export type DomainChange = {
  [TEntityType in DomainEntityType]: DomainChangeFor<TEntityType>
}[DomainEntityType]

/** Read-only entity graph supplied by either renderer collections or main committed stores. */
export type DomainState = {
  get: <TEntityType extends DomainEntityType>(
    entityType: TEntityType,
    id: string
  ) => DomainEntityMap[TEntityType] | undefined
  getAll: <TEntityType extends DomainEntityType>(
    entityType: TEntityType
  ) => ReadonlyArray<DomainEntityMap[TEntityType]>
}

export type DomainPlanner<TCommand> = (
  state: DomainState,
  command: TCommand
) => DomainChange[]

export type DomainRevisionExpectation =
  | {
      entityType: DomainEntityType
      id: string
      expected: 'absent'
    }
  | {
      entityType: DomainEntityType
      id: string
      expected: 'revision'
      revision: number
    }

export type DomainMutationRequest<TCommand> = {
  command: TCommand
  expectations: DomainRevisionExpectation[]
}

export type DomainSnapshotFor<TEntityType extends DomainEntityType> =
  | {
      entityType: TEntityType
      id: string
      revision: number
      data: DomainEntityMap[TEntityType]
    }
  | {
      entityType: TEntityType
      id: string
      deleted: true
    }

export type DomainSnapshot = {
  [TEntityType in DomainEntityType]: DomainSnapshotFor<TEntityType>
}[DomainEntityType]

export type DomainMutationResponsePayload = {
  snapshots: DomainSnapshot[]
}

export type DomainTarget = Pick<DomainChange, 'entityType' | 'id'>

export const buildDomainTargetKey = (target: DomainTarget): string =>
  `${target.entityType}:${target.id}`

/** Rejects ambiguous plans before either process interprets their side effects. */
export const assertValidDomainChanges = (changes: readonly DomainChange[]): void => {
  const targetKeys = new Set<string>()

  for (const change of changes) {
    const targetKey = buildDomainTargetKey(change)
    if (targetKeys.has(targetKey)) {
      throw new Error(`Multiple domain changes target ${targetKey}`)
    }
    targetKeys.add(targetKey)

    if (change.type === 'delete') continue
    if ('id' in change.data && change.data.id !== change.id) {
      throw new Error(`Domain change ID does not match its data for ${targetKey}`)
    }
  }
}
