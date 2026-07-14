import type { PromptFolderSettingsField } from '@shared/PromptFolder'
import {
  copyPromptFolderSettingsEditorViewStates,
  createEmptyPromptFolderSettingsEditorViewStates,
  type WorkspacePromptFolderPromptTreeEntry
} from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

const DEFAULT_PROMPT_TREE_ENTRY_ID = 'folder-root'
const DEFAULT_PROMPT_TREE_IS_EXPANDED = true
// New prompt-folder screens start with settings collapsed until the user expands them.
const DEFAULT_FOLDER_SETTINGS_SECTION_IS_EXPANDED = false
const DEFAULT_PROMPTS_SECTION_IS_EXPANDED = true

const createPromptFolderPromptTreeEntry = (
  promptFolderId: string,
  overrides: Partial<WorkspacePromptFolderPromptTreeEntry> = {}
): WorkspacePromptFolderPromptTreeEntry => ({
  promptFolderId,
  promptTreeEntryId: DEFAULT_PROMPT_TREE_ENTRY_ID,
  promptTreeIsExpanded: DEFAULT_PROMPT_TREE_IS_EXPANDED,
  folderSettingsSectionIsExpanded: DEFAULT_FOLDER_SETTINGS_SECTION_IS_EXPANDED,
  promptsSectionIsExpanded: DEFAULT_PROMPTS_SECTION_IS_EXPANDED,
  settingsEditorViewStates: createEmptyPromptFolderSettingsEditorViewStates(),
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

const upsertPromptFolderPromptTreeExpandedState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  isExpanded: boolean
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        promptTreeIsExpanded: isExpanded
      })
    ]
  }

  if (entries[existingIndex]?.promptTreeIsExpanded === isExpanded) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    promptTreeIsExpanded: isExpanded
  }
  return nextEntries
}

const applyPromptFolderPromptTreeExpandedState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  isExpanded: boolean
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderPromptTreeExpandedState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    isExpanded
  )
}

const upsertPromptFolderEditorViewState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  field: PromptFolderSettingsField,
  viewStateJson: string
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        settingsEditorViewStates: {
          ...createEmptyPromptFolderSettingsEditorViewStates(),
          [field]: viewStateJson
        }
      })
    ]
  }

  if (entries[existingIndex]?.settingsEditorViewStates[field] === viewStateJson) {
    return entries
  }

  const existingEntry = entries[existingIndex]
  if (!existingEntry) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...existingEntry,
    promptFolderId,
    settingsEditorViewStates: {
      ...copyPromptFolderSettingsEditorViewStates(existingEntry.settingsEditorViewStates),
      [field]: viewStateJson
    }
  }
  return nextEntries
}

const upsertPromptFolderScreenSectionExpandedState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  key: 'folderSettingsSectionIsExpanded' | 'promptsSectionIsExpanded',
  isExpanded: boolean
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      createPromptFolderPromptTreeEntry(promptFolderId, {
        [key]: isExpanded
      })
    ]
  }

  if (entries[existingIndex]?.[key] === isExpanded) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    [key]: isExpanded
  }
  return nextEntries
}

const applyPromptFolderScreenSectionExpandedState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  key: 'folderSettingsSectionIsExpanded' | 'promptsSectionIsExpanded',
  isExpanded: boolean
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderScreenSectionExpandedState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
    key,
    isExpanded
  )
}

const applyPromptFolderEditorViewState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  field: PromptFolderSettingsField,
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

export const lookupWorkspacePersistedPromptFolderPromptTreeExpandedState = (
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
  return persistedEntry?.settingsEditorViewStates[field] ?? null
}

export const lookupWorkspacePersistedPromptFolderSettingsSectionExpandedState = (
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
  return persistedEntry?.folderSettingsSectionIsExpanded ?? null
}

export const lookupWorkspacePersistedPromptFolderPromptsSectionExpandedState = (
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
  return persistedEntry?.promptsSectionIsExpanded ?? null
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

export const setPromptFolderPromptTreeExpandedStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  isExpanded: boolean
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderPromptTreeExpandedState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    isExpanded
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderPromptTreeExpandedState(draft, promptFolderId, isExpanded)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderPromptTreeExpandedState(draft, promptFolderId, isExpanded)
      })
    }
  })
}

const setPromptFolderScreenSectionExpandedStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  key: 'folderSettingsSectionIsExpanded' | 'promptsSectionIsExpanded',
  isExpanded: boolean
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderScreenSectionExpandedState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
    key,
    isExpanded
  )
  if (nextEntries === draftRecord.promptFolderPromptTreeEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderScreenSectionExpandedState(draft, promptFolderId, key, isExpanded)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderScreenSectionExpandedState(draft, promptFolderId, key, isExpanded)
      })
    }
  })
}

export const setPromptFolderSettingsSectionExpandedStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  isExpanded: boolean
): void => {
  setPromptFolderScreenSectionExpandedStateWithAutosave(
    workspaceId,
    promptFolderId,
    'folderSettingsSectionIsExpanded',
    isExpanded
  )
}

export const setPromptFolderPromptsSectionExpandedStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  isExpanded: boolean
): void => {
  setPromptFolderScreenSectionExpandedStateWithAutosave(
    workspaceId,
    promptFolderId,
    'promptsSectionIsExpanded',
    isExpanded
  )
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
    field,
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
        applyPromptFolderEditorViewState(draft, promptFolderId, field, viewStateJson)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderEditorViewState(draft, promptFolderId, field, viewStateJson)
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
