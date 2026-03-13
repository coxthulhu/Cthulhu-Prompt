import type { WorkspacePromptFolderPromptTreeEntry } from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

const DEFAULT_PROMPT_TREE_ENTRY_ID = 'folder-settings'
const DEFAULT_PROMPT_TREE_IS_EXPANDED = true

const upsertPromptFolderPromptTreeEntry = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  promptTreeEntryId: string
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      {
        promptFolderId,
        promptTreeEntryId,
        promptTreeIsExpanded: DEFAULT_PROMPT_TREE_IS_EXPANDED,
        folderDescriptionEditorViewStateJson: null
      }
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

const upsertPromptFolderDescriptionEditorViewState = (
  entries: WorkspacePromptFolderPromptTreeEntry[],
  promptFolderId: string,
  viewStateJson: string
): WorkspacePromptFolderPromptTreeEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      {
        promptFolderId,
        promptTreeEntryId: DEFAULT_PROMPT_TREE_ENTRY_ID,
        promptTreeIsExpanded: DEFAULT_PROMPT_TREE_IS_EXPANDED,
        folderDescriptionEditorViewStateJson: viewStateJson
      }
    ]
  }

  if (entries[existingIndex]?.folderDescriptionEditorViewStateJson === viewStateJson) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    folderDescriptionEditorViewStateJson: viewStateJson
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
      {
        promptFolderId,
        promptTreeEntryId: DEFAULT_PROMPT_TREE_ENTRY_ID,
        promptTreeIsExpanded,
        folderDescriptionEditorViewStateJson: null
      }
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

const applyPromptFolderDescriptionEditorViewState = (
  record: { promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[] },
  promptFolderId: string,
  viewStateJson: string
): void => {
  record.promptFolderPromptTreeEntries = upsertPromptFolderDescriptionEditorViewState(
    record.promptFolderPromptTreeEntries,
    promptFolderId,
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

export const lookupWorkspacePersistedPromptFolderDescriptionEditorViewStateJson = (
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
  return persistedEntry?.folderDescriptionEditorViewStateJson ?? null
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

export const setPromptFolderDescriptionEditorViewStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  viewStateJson: string | null
): void => {
  if (viewStateJson === null) {
    return
  }

  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderDescriptionEditorViewState(
    draftRecord.promptFolderPromptTreeEntries,
    promptFolderId,
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
        applyPromptFolderDescriptionEditorViewState(draft, promptFolderId, viewStateJson)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderDescriptionEditorViewState(draft, promptFolderId, viewStateJson)
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
