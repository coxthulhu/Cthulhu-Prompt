import { SvelteMap } from 'svelte/reactivity'
import type { Prompt } from '@shared/Prompt'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updatePrompt } from '../Mutations/PromptMutations'

type PromptDraftState = {
  draftSnapshot: Prompt
  saveError: string | null
}

type PromptDraftEntry = {
  state: PromptDraftState
  autosaveDraft: AutosaveDraft
  saveNow: () => Promise<void>
  markDirtyAndScheduleAutosave: () => void
}

const draftEntriesByPromptId = new SvelteMap<string, PromptDraftEntry>()
const lastSyncedPromptsById = new SvelteMap<string, Prompt>()

const toPromptSnapshot = (prompt: Prompt): Prompt => ({
  id: prompt.id,
  title: prompt.title,
  creationDate: prompt.creationDate,
  lastModifiedDate: prompt.lastModifiedDate,
  promptText: prompt.promptText,
  promptFolderCount: prompt.promptFolderCount
})

const applyPromptSnapshot = (target: Prompt, prompt: Prompt): void => {
  target.id = prompt.id
  target.title = prompt.title
  target.creationDate = prompt.creationDate
  target.lastModifiedDate = prompt.lastModifiedDate
  target.promptText = prompt.promptText
  target.promptFolderCount = prompt.promptFolderCount
}

const haveSamePrompt = (left: Prompt, right: Prompt): boolean => {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.creationDate === right.creationDate &&
    left.lastModifiedDate === right.lastModifiedDate &&
    left.promptText === right.promptText &&
    left.promptFolderCount === right.promptFolderCount
  )
}

const createDraftEntry = (prompt: Prompt): PromptDraftEntry => {
  const state = $state<PromptDraftState>({
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
      await updatePrompt(promptToSave)
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

export const syncPromptDraft = (prompt: Prompt): void => {
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

export const getPromptDraftState = (promptId: string): PromptDraftState | null => {
  return draftEntriesByPromptId.get(promptId)?.state ?? null
}

export const setPromptDraftTitle = (promptId: string, title: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  if (entry.state.draftSnapshot.title === title) return
  entry.state.draftSnapshot.title = title
  entry.state.saveError = null
  entry.markDirtyAndScheduleAutosave()
}

export const setPromptDraftText = (promptId: string, promptText: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)
  if (!entry) return
  if (entry.state.draftSnapshot.promptText === promptText) return
  entry.state.draftSnapshot.promptText = promptText
  entry.state.saveError = null
  entry.markDirtyAndScheduleAutosave()
}

export const flushPromptDraftAutosaves = async (): Promise<void> => {
  const tasks = Array.from(draftEntriesByPromptId.values(), (entry) => {
    clearAutosaveTimeout(entry.autosaveDraft)
    return entry.saveNow()
  })

  await Promise.allSettled(tasks)
}

export const removePromptDraft = (promptId: string): void => {
  const entry = draftEntriesByPromptId.get(promptId)

  if (entry) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptId.delete(promptId)
  lastSyncedPromptsById.delete(promptId)
}

export const clearPromptDraftStore = (): void => {
  for (const entry of draftEntriesByPromptId.values()) {
    clearAutosaveTimeout(entry.autosaveDraft)
  }

  draftEntriesByPromptId.clear()
  lastSyncedPromptsById.clear()
}
