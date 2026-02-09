import { SvelteMap } from 'svelte/reactivity'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updateTanstackPromptFolderDescription } from '../Mutations/TanstackPromptFolderMutations'

export type TanstackPromptFolderDraftSnapshot = {
  folderDescription: string
}

export type TanstackPromptFolderDraftState = {
  draftSnapshot: TanstackPromptFolderDraftSnapshot
  saveError: string | null
}

type TanstackPromptFolderDraftEntry = {
  state: TanstackPromptFolderDraftState
  autosaveDraft: AutosaveDraft
  saveNow: () => Promise<void>
  markDirtyAndScheduleAutosave: () => void
}

const draftEntriesByPromptFolderId = new SvelteMap<string, TanstackPromptFolderDraftEntry>()
const lastSyncedDescriptionsByPromptFolderId = new SvelteMap<string, string>()

const createDraftEntry = (promptFolder: TanstackPromptFolder): TanstackPromptFolderDraftEntry => {
  const state = $state<TanstackPromptFolderDraftState>({
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
      await updateTanstackPromptFolderDescription(promptFolder.id, descriptionToSave)
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

export const syncTanstackPromptFolderDescriptionDraft = (promptFolder: TanstackPromptFolder): void => {
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

export const getTanstackPromptFolderDraftState = (
  promptFolderId: string
): TanstackPromptFolderDraftState | null => {
  return draftEntriesByPromptFolderId.get(promptFolderId)?.state ?? null
}

export const getTanstackPromptFolderAutosaveDraft = (promptFolderId: string): AutosaveDraft | null => {
  return draftEntriesByPromptFolderId.get(promptFolderId)?.autosaveDraft ?? null
}

export const setTanstackPromptFolderDraftDescription = (
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

export const saveTanstackPromptFolderDraftNow = async (promptFolderId: string): Promise<void> => {
  const entry = draftEntriesByPromptFolderId.get(promptFolderId)
  if (!entry) return
  await entry.saveNow()
}

export const flushTanstackPromptFolderAutosave = async (promptFolderId: string): Promise<void> => {
  const entry = draftEntriesByPromptFolderId.get(promptFolderId)
  if (!entry) return
  clearAutosaveTimeout(entry.autosaveDraft)
  await entry.saveNow()
}

export const flushTanstackPromptFolderDraftAutosaves = async (): Promise<void> => {
  const tasks = Array.from(draftEntriesByPromptFolderId.values(), (entry) => {
    clearAutosaveTimeout(entry.autosaveDraft)
    return entry.saveNow()
  })
  await Promise.allSettled(tasks)
}

export const removeTanstackPromptFolderDraft = (promptFolderId: string): void => {
  const entry = draftEntriesByPromptFolderId.get(promptFolderId)

  if (entry) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptFolderId.delete(promptFolderId)
  lastSyncedDescriptionsByPromptFolderId.delete(promptFolderId)
}

export const clearTanstackPromptFolderDraftStore = (): void => {
  for (const entry of draftEntriesByPromptFolderId.values()) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptFolderId.clear()
  lastSyncedDescriptionsByPromptFolderId.clear()
}
