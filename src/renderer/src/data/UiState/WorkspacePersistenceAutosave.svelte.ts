import type { PromptFolderSettingsField } from '@shared/PromptFolder'
import type { WorkspacePromptFolderPromptTreeEntry } from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

const DEFAULT_PROMPT_TREE_ENTRY_ID = 'folder-settings'
const DEFAULT_PROMPT_TREE_IS_EXPANDED = true
const DEFAULT_PROMPT_TREE_IS_SHOWING_ALL_PROMPTS = false
type PromptFolderEditorViewStateField =
  | 'folderDescriptionEditorViewStateJson'
  | 'folderPrefixEditorViewStateJson'
  | 'folderSuffixEditorViewStateJson'

const PROMPT_FOLDER_EDITOR_VIEW_STATE_FIELDS: Record<
  PromptFolderSettingsField,
  PromptFolderEditorViewStateField
> = {
  folderDescription: 'folderDescriptionEditorViewStateJson',
  folderPrefix: 'folderPrefixEditorViewStateJson',
  folderSuffix: 'folderSuffixEditorViewStateJson'
}

const createPromptFolderPromptTreeEntry = (
  promptFolderId: string,
  overrides: Partial<WorkspacePromptFolderPromptTreeEntry> = {}
): WorkspacePromptFolderPromptTreeEntry => ({
  promptFolderId,
  promptTreeEntryId: DEFAULT_PROMPT_TREE_ENTRY_ID,
  promptTreeIsExpanded: DEFAULT_PROMPT_TREE_IS_EXPANDED,
  promptTreeIsShowingAllPrompts: DEFAULT_PROMPT_TREE_IS_SHOWING_ALL_PROMPTS,
  folderDescriptionEditorViewStateJson: null,
  folderPrefixEditorViewStateJson: null,
  folderSuffixEditorViewStateJson: null,
  ...overrides
})

const upsertPromptFolderPromptTreeEntry = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  promptTreeEntryId: string
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        promptTreeEntryId
      })
    ]
  }

  if (entries[existingIndex]?.promptTreeEntryId === promptTreeEntryId) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    promptTreeEntryId
  }
  return nextEntries
}

const applyPromptFolderPromptTreeEntry = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  promptTreeEntryId: string
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderPromptTreeEntry(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeEntryId
  )
}

const upsertPromptFolderEditorViewState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  field: PromptFolderEditorViewStateField,
  viewStateJson: string
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        [field]: viewStateJson
      })
    ]
  }

  if (entries[existingIndex]?.[field] === viewStateJson) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    [field]: viewStateJson
  }
  return nextEntries
}

const upsertPromptFolderExpandedState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  promptTreeIsExpanded: boolean
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        promptTreeIsExpanded
      })
    ]
  }

  if (entries[existingIndex]?.promptTreeIsExpanded === promptTreeIsExpanded) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    promptTreeIsExpanded
  }
  return nextEntries
}

const applyPromptFolderExpandedState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  promptTreeIsExpanded: boolean
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderExpandedState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeIsExpanded
  )
}

const upsertPromptFolderShowingAllPromptsState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  promptTreeIsShowingAllPrompts: boolean
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        promptTreeIsShowingAllPrompts
      })
    ]
  }

  if (entries[existingIndex]?.promptTreeIsShowingAllPrompts === promptTreeIsShowingAllPrompts) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    promptTreeIsShowingAllPrompts
  }
  return nextEntries
}

const applyPromptFolderShowingAllPromptsState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  promptTreeIsShowingAllPrompts: boolean
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderShowingAllPromptsState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeIsShowingAllPrompts
  )
}

const applyPromptFolderEditorViewState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  field: PromptFolderEditorViewStateField,
  viewStateJson: string
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderEditorViewState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    field,
    viewStateJson
  )
}

export const lookupWorkspacePersistedPromptFolderPromptTreeEntryId = (
  workspaceId: string,
  promptFolderId: string
): string | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderPromptTreeEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.promptTreeEntryId ?? null
}

export const lookupWorkspacePersistedPromptFolderEditorViewStateJson = (
  workspaceId: string,
  promptFolderId: string,
  field: PromptFolderSettingsField
): string | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderPromptTreeEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.[PROMPT_FOLDER_EDITOR_VIEW_STATE_FIELDS[field]] ?? null
}

export const lookupWorkspacePersistedPromptFolderExpandedState = (
  workspaceId: string,
  promptFolderId: string
): boolean | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderPromptTreeEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.promptTreeIsExpanded ?? null
}

export const lookupWorkspacePersistedPromptFolderShowingAllPromptsState = (
  workspaceId: string,
  promptFolderId: string
): boolean | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderPromptTreeEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.promptTreeIsShowingAllPrompts ?? null
}

export const setPromptFolderPromptTreeEntryIdWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  promptTreeEntryId: string
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderPromptTreeEntry(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeEntryId
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderPromptTreeEntry(draft, promptFolderId, promptTreeEntryId)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderPromptTreeEntry(draft, promptFolderId, promptTreeEntryId)
      })
    }
  })
}

export const setPromptFolderExpandedStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  promptTreeIsExpanded: boolean
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderExpandedState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeIsExpanded
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderExpandedState(draft, promptFolderId, promptTreeIsExpanded)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderExpandedState(draft, promptFolderId, promptTreeIsExpanded)
      })
    }
  })
}

export const setPromptFolderShowingAllPromptsStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  promptTreeIsShowingAllPrompts: boolean
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderShowingAllPromptsState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    promptTreeIsShowingAllPrompts
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderShowingAllPromptsState(
          draft,
          promptFolderId,
          promptTreeIsShowingAllPrompts
        )
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderShowingAllPromptsState(
          draft,
          promptFolderId,
          promptTreeIsShowingAllPrompts
        )
      })
    }
  })
}

export const setPromptFolderEditorViewStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  field: PromptFolderSettingsField,
  viewStateJson: string | null
): void => {
  if (viewStateJson === null) {
    return
  }

  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderEditorViewState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    PROMPT_FOLDER_EDITOR_VIEW_STATE_FIELDS[field],
    viewStateJson
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderEditorViewState(
          draft,
          promptFolderId,
          PROMPT_FOLDER_EDITOR_VIEW_STATE_FIELDS[field],
          viewStateJson
        )
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderEditorViewState(
          draft,
          promptFolderId,
          PROMPT_FOLDER_EDITOR_VIEW_STATE_FIELDS[field],
          viewStateJson
        )
      })
    }
  })
}

export const flushWorkspacePersistenceAutosaves = async (): Promise<void> => {
  const tasks = workspacePersistenceDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(workspacePersistenceCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}
