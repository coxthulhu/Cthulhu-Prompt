import { SvelteMap } from 'svelte/reactivity'
import type { PromptFolder } from '@shared/PromptFolder'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updatePromptFolderDescription } from '../Mutations/PromptFolderMutations'

type PromptFolderDraftSnapshot = {
  folderDescription: string
}

type PromptFolderDraftState = {
  draftSnapshot: PromptFolderDraftSnapshot
  saveError: string | null
}

type PromptFolderDraftEntry = {
  state: PromptFolderDraftState
  autosaveDraft: AutosaveDraft
  saveNow: () => Promise<void>
  markDirtyAndScheduleAutosave: () => void
}

const draftEntriesByPromptFolderId = new SvelteMap<string, PromptFolderDraftEntry>()
const lastSyncedDescriptionsByPromptFolderId = new SvelteMap<string, string>()

const createDraftEntry = (promptFolder: PromptFolder): PromptFolderDraftEntry => {
  const state = $state<PromptFolderDraftState>({
    draftSnapshot: {
      folderDescription: promptFolder.folderDescription
    },
    saveError: null
  })

  const autosaveDraft = $state<AutosaveDraft>({
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const autosave = createAutosaveController({
    draft: autosaveDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const descriptionToSave = state.draftSnapshot.folderDescription
      state.saveError = null
      await updatePromptFolderDescription(promptFolder.id, descriptionToSave)
      autosaveDraft.dirty = false
    }
  })

  const saveNow = async (): Promise<void> => {
    try {
      await autosave.saveNow()
    } catch (error) {
      state.saveError = error instanceof Error ? error.message : 'Failed to update prompt folder.'
      throw error
    }
  }

  return {
    state,
    autosaveDraft,
    saveNow,
    markDirtyAndScheduleAutosave: autosave.markDirtyAndScheduleAutosave
  }
}

export const syncPromptFolderDescriptionDraft = (promptFolder: PromptFolder): void => {
  const existingEntry = draftEntriesByPromptFolderId.get(promptFolder.id)

  if (!existingEntry) {
    draftEntriesByPromptFolderId.set(promptFolder.id, createDraftEntry(promptFolder))
    lastSyncedDescriptionsByPromptFolderId.set(promptFolder.id, promptFolder.folderDescription)
    return
  }

  const lastSyncedDescription = lastSyncedDescriptionsByPromptFolderId.get(promptFolder.id)

  if (lastSyncedDescription === promptFolder.folderDescription) {
    return
  }

  lastSyncedDescriptionsByPromptFolderId.set(promptFolder.id, promptFolder.folderDescription)
  clearAutosaveTimeout(existingEntry.autosaveDraft)
  existingEntry.state.draftSnapshot.folderDescription = promptFolder.folderDescription
  existingEntry.state.saveError = null
  existingEntry.autosaveDraft.dirty = false
}

export const getPromptFolderDraftState = (
  promptFolderId: string
): PromptFolderDraftState | null => {
  return draftEntriesByPromptFolderId.get(promptFolderId)?.state ?? null
}

export const setPromptFolderDraftDescription = (
  promptFolderId: string,
  folderDescription: string
): void => {
  const entry = draftEntriesByPromptFolderId.get(promptFolderId)

  if (!entry || entry.state.draftSnapshot.folderDescription === folderDescription) {
    return
  }

  entry.state.draftSnapshot.folderDescription = folderDescription
  entry.state.saveError = null
  entry.markDirtyAndScheduleAutosave()
}

export const flushPromptFolderDraftAutosaves = async (): Promise<void> => {
  const tasks = Array.from(draftEntriesByPromptFolderId.values(), (entry) => {
    clearAutosaveTimeout(entry.autosaveDraft)
    return entry.saveNow()
  })
  await Promise.allSettled(tasks)
}

export const clearPromptFolderDraftStore = (): void => {
  for (const entry of draftEntriesByPromptFolderId.values()) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptFolderId.clear()
  lastSyncedDescriptionsByPromptFolderId.clear()
}
