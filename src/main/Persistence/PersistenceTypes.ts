import type { FilePersistenceStagedChange } from './FilePersistenceHelpers'
import type { CategoryPersistenceFields } from './CategoryPersistence'
import type { PromptFolderPersistenceFields } from './PromptFolderPersistence'
import type { PromptPersistenceFields } from './PromptPersistence'
import type { PromptTemplatePersistenceFields } from './PromptTemplatePersistence'
import type { SystemSettingsPersistenceFields } from './SystemSettingsPersistence'
import type { WorkspacePersistenceFields } from './WorkspacePersistence'

/** One present persisted record on either side of a storage transition. */
export type PersistenceRecord<TData, TPersistenceFields> = {
  data: TData
  persistenceFields: TPersistenceFields
}

/** Explicit current and desired records supplied to an entity persistence layer. */
export type PersistenceTransition<TData, TPersistenceFields> = {
  before: PersistenceRecord<TData, TPersistenceFields> | null
  after: PersistenceRecord<TData, TPersistenceFields> | null
}

/** Persistence metadata associated with each authoritative domain entity type. */
export type DomainPersistenceFieldsMap = {
  systemSettings: SystemSettingsPersistenceFields
  workspace: WorkspacePersistenceFields
  promptFolder: PromptFolderPersistenceFields
  category: CategoryPersistenceFields
  prompt: PromptPersistenceFields
  promptTemplate: PromptTemplatePersistenceFields
  userPersistence: Record<string, never>
  markdownContentUiState: Record<string, never>
  workspaceUiState: Record<string, never>
  workspacePromptFolderUiState: Record<string, never>
  accordionUiState: Record<string, never>
  categoryDescriptionEditorUiState: Record<string, never>
}

export type PersistenceStageResult<TPersistenceFields> = {
  stagedChange: FilePersistenceStagedChange[]
  nextPersistenceFields?: TPersistenceFields
}

/** Filesystem persistence staged before its synchronous logical commit. */
export type FilePersistenceLayer<TData, TPersistenceFields> = {
  kind: 'filesystem'
  stageChanges: (
    transition: PersistenceTransition<TData, TPersistenceFields>
  ) => Promise<PersistenceStageResult<TPersistenceFields>>
  commitChanges: (stagedChange: FilePersistenceStagedChange[]) => void
  revertChanges: (stagedChange: FilePersistenceStagedChange[]) => void
  loadData: (persistenceFields: TPersistenceFields) => Promise<TData | null>
}

/** SQLite persistence queried by authoritative ID and changed through one database command. */
export type SqlitePersistenceLayer<TData, TPersistenceFields> = {
  kind: 'sqlite'
  query: (id: string, persistenceFields: TPersistenceFields) => TData | null
  command: (
    id: string,
    transition: PersistenceTransition<TData, TPersistenceFields>
  ) => void
}

/** Persistence implementation used by one authoritative revision collection. */
export type PersistenceLayer<TData, TPersistenceFields> =
  | FilePersistenceLayer<TData, TPersistenceFields>
  | SqlitePersistenceLayer<TData, TPersistenceFields>

export const createPersistenceStageResult = <TPersistenceFields>(
  stagedChange: FilePersistenceStagedChange[],
  nextPersistenceFields?: TPersistenceFields
): PersistenceStageResult<TPersistenceFields> => {
  if (nextPersistenceFields === undefined) {
    return { stagedChange }
  }

  return {
    stagedChange,
    nextPersistenceFields
  }
}
