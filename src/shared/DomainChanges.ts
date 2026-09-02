import type { Category } from './Category'
import type { Draft } from 'immer'
import type { PromptPersisted, PromptSummaryData } from './Prompt'
import type { PromptFolder } from './PromptFolder'
import type { PromptTemplatePersisted, PromptTemplateSummaryData } from './PromptTemplate'
import type { SystemSettings } from './SystemSettings'
import type { Workspace } from './Workspace'
import type { MarkdownContentUiState } from './MarkdownContentUiState'
import type { UserPersistence } from './UserPersistence'
import type {
  AccordionUiState,
  CategoryDescriptionEditorUiState,
  WorkspacePromptFolderUiState,
  WorkspaceUiState
} from './UiState'
import type { AuthoritativeSnapshotPayload } from './AuthoritativeSnapshot'

/** Missing-target behavior applied when an authoritative domain entity is deleted. */
export type DomainTargetPolicy = 'requirePresent' | 'deleteIfPresent'

/** Authoritative entity records supported by the shared domain-planning framework. */
export type DomainEntityMap = {
  systemSettings: SystemSettings
  workspace: Workspace
  promptFolder: PromptFolder
  category: Category
  prompt: PromptPersisted
  promptTemplate: PromptTemplatePersisted
  userPersistence: UserPersistence
  markdownContentUiState: MarkdownContentUiState
  workspaceUiState: WorkspaceUiState
  workspacePromptFolderUiState: WorkspacePromptFolderUiState
  accordionUiState: AccordionUiState
  categoryDescriptionEditorUiState: CategoryDescriptionEditorUiState
}
export type DomainEntityType = keyof DomainEntityMap

/** Entity projections that shared planners may read in either process. */
export type DomainPlannerEntityMap = Omit<
  DomainEntityMap,
  'prompt' | 'promptTemplate'
> & {
  prompt: PromptPersisted | PromptSummaryData
  promptTemplate: PromptTemplatePersisted | PromptTemplateSummaryData
}

/** Immer recipe applied to either a renderer projection or a full main-process entity. */
export type DomainUpdateRecipe<TEntityType extends DomainEntityType> = (
  draft: Draft<DomainPlannerEntityMap[TEntityType]>
) => void

/** One insert, recipe-based update, or delete for a specific domain entity type. */
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
      recipe: DomainUpdateRecipe<TEntityType>
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
  ) => DomainPlannerEntityMap[TEntityType] | undefined
  getAll: <TEntityType extends DomainEntityType>(
    entityType: TEntityType
  ) => ReadonlyArray<DomainPlannerEntityMap[TEntityType]>
}

/** Business-invariant conflict found while planning against one authoritative graph. */
export type DomainMutationConflict = {
  status: 'conflict'
  reason: string
  targets: DomainTarget[]
}

/** Shared planner result containing executable changes or authoritative conflict targets. */
export type DomainMutationPlan = DomainChange[] | DomainMutationConflict

/** Mutation-specific shared function run against renderer and main domain state. */
export type DomainPlanner<TCommand> = (
  state: DomainState,
  command: TCommand
) => DomainMutationPlan

/** Runtime parser for one mutation-specific command carried by a domain request. */
export type DomainCommandParser<TCommand> = (value: unknown) => TCommand | null

/** Expected authoritative state for one renderer-computed mutation target. */
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

/** Generic IPC payload sent for one shared domain mutation command. */
export type DomainMutationRequest<TCommand> = {
  command: TCommand
  expectations: DomainRevisionExpectation[]
}

/** Generic success or conflict payload returned by every domain mutation channel. */
export type DomainMutationResponsePayload = AuthoritativeSnapshotPayload

/** Revision-bearing entity targeted by a domain mutation plan. */
export type DomainTarget = Pick<DomainChange, 'entityType' | 'id'>

/** Builds the stable key used to compare domain target sets. */
export const buildDomainTargetKey = (target: DomainTarget): string =>
  `${target.entityType}:${target.id}`

/** Reports whether a planner result represents a business-invariant conflict. */
export const isDomainMutationConflict = (
  plan: DomainMutationPlan
): plan is DomainMutationConflict => !Array.isArray(plan)

/** Rejects ambiguous plans before either process interprets their side effects. */
export const assertValidDomainChanges = (changes: readonly DomainChange[]): void => {
  const targetKeys = new Set<string>()

  for (const change of changes) {
    const targetKey = buildDomainTargetKey(change)
    if (targetKeys.has(targetKey)) {
      throw new Error(`Multiple domain changes target ${targetKey}`)
    }
    targetKeys.add(targetKey)

    if (change.type !== 'insert') continue
    if ('id' in change.data && change.data.id !== change.id) {
      throw new Error(`Domain change ID does not match its data for ${targetKey}`)
    }
  }
}
