import { SvelteMap } from 'svelte/reactivity'
import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updateTanstackPrompt } from '../Mutations/TanstackPromptMutations'

export type TanstackPromptDraftState = {
  draftSnapshot: TanstackPrompt
  saveError: string | null
}

type TanstackPromptDraftEntry = {
  state: TanstackPromptDraftState
  autosaveDraft: AutosaveDraft
  saveNow: () => Promise<void>
  markDirtyAndScheduleAutosave: () => void
}

const draftEntriesByPromptId = new SvelteMap<string, TanstackPromptDraftEntry>()
const lastSyncedPromptsById = new SvelteMap<string, TanstackPrompt>()

const toPromptSnapshot = (prompt: TanstackPrompt): TanstackPrompt => ({
  id: prompt.id,
  title: prompt.title,
  creationDate: prompt.creationDate,
  lastModifiedDate: prompt.lastModifiedDate,
  promptText: prompt.promptText,
  promptFolderCount: prompt.promptFolderCount
})

const applyPromptSnapshot = (target: TanstackPrompt, prompt: TanstackPrompt): void => {
  target.id = prompt.id
  target.title = prompt.title
  target.creationDate = prompt.creationDate
  target.lastModifiedDate = prompt.lastModifiedDate
  target.promptText = prompt.promptText
  target.promptFolderCount = prompt.promptFolderCount
}

const haveSamePrompt = (left: TanstackPrompt, right: TanstackPrompt): boolean => {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.creationDate === right.creationDate &&
    left.lastModifiedDate === right.lastModifiedDate &&
    left.promptText === right.promptText &&
    left.promptFolderCount === right.promptFolderCount
  )
}

const createDraftEntry = (prompt: TanstackPrompt): TanstackPromptDraftEntry => {
  const state = $state<TanstackPromptDraftState>({
    draftSnapshot: toPromptSnapshot(prompt),
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
      const promptToSave = toPromptSnapshot(state.draftSnapshot)
      state.saveError = null
      await updateTanstackPrompt(promptToSave)
      autosaveDraft.dirty = false
    }
  })

  const saveNow = async (): Promise<void> => {
    try {
      await autosave.saveNow()
    } catch (error) {
      state.saveError = error instanceof Error ? error.message : 'Failed to update prompt.'
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

export const syncTanstackPromptDraft = (prompt: TanstackPrompt): void => {
  const existingEntry = draftEntriesByPromptId.get(prompt.id)

  if (!existingEntry) {
    draftEntriesByPromptId.set(prompt.id, createDraftEntry(prompt))
    lastSyncedPromptsById.set(prompt.id, toPromptSnapshot(prompt))
    return
  }

  const lastSyncedPrompt = lastSyncedPromptsById.get(prompt.id)
  if (lastSyncedPrompt && haveSamePrompt(lastSyncedPrompt, prompt)) {
    return
  }

  lastSyncedPromptsById.set(prompt.id, toPromptSnapshot(prompt))
  clearAutosaveTimeout(existingEntry.autosaveDraft)
  applyPromptSnapshot(existingEntry.state.draftSnapshot, prompt)
  existingEntry.state.saveError = null
  existingEntry.autosaveDraft.dirty = false
}

export const getTanstackPromptDraftState = (promptId: string): TanstackPromptDraftState | null => {
  return draftEntriesByPromptId.get(promptId)?.state ?? null
}

export const getTanstackPromptAutosaveDraft = (promptId: string): AutosaveDraft | null => {
  return draftEntriesByPromptId.get(promptId)?.autosaveDraft ?? null
}

export const setTanstackPromptDraftTitle = (promptId: string, title: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  if (entry.state.draftSnapshot.title === title) return
  entry.state.draftSnapshot.title = title
  entry.state.saveError = null
  entry.markDirtyAndScheduleAutosave()
}

export const setTanstackPromptDraftText = (promptId: string, promptText: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  if (entry.state.draftSnapshot.promptText === promptText) return
  entry.state.draftSnapshot.promptText = promptText
  entry.state.saveError = null
  entry.markDirtyAndScheduleAutosave()
}

export const saveTanstackPromptDraftNow = async (promptId: string): Promise<void> => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  await entry.saveNow()
}

export const flushTanstackPromptAutosave = async (promptId: string): Promise<void> => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  clearAutosaveTimeout(entry.autosaveDraft)
  await entry.saveNow()
}

export const flushTanstackPromptDraftAutosaves = async (): Promise<void> => {
  const tasks = Array.from(draftEntriesByPromptId.values(), (entry) => {
    clearAutosaveTimeout(entry.autosaveDraft)
    return entry.saveNow()
  })

  await Promise.allSettled(tasks)
}

export const removeTanstackPromptDraft = (promptId: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)

  if (entry) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptId.delete(promptId)
  lastSyncedPromptsById.delete(promptId)
}

export const clearTanstackPromptDraftStore = (): void => {
  for (const entry of draftEntriesByPromptId.values()) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptId.clear()
  lastSyncedPromptsById.clear()
}
