import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import type { Prompt, PromptResult } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'

type PromptContent = {
  title: string
  text: string
}

type PromptDraft = PromptContent & AutosaveDraft

type PromptPersisted = PromptContent & {
  lastModifiedDate: string
}

export type PromptData = {
  draft: PromptDraft
  persisted: PromptPersisted
  promptFolderCount: number
  setTitle: (title: string) => void
  setTitleWithoutAutosave: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
  setTextWithoutAutosave: (text: string) => void
  saveNow: () => Promise<void>
}

type PromptDraftChangeListener = (promptId: string) => void

type UpdatePromptRequestPayload = {
  workspacePath: string
  folderName: string
  id: string
  title: string
  promptText: string
}

let currentWorkspacePath: string | null = null
const promptDataById = new SvelteMap<string, PromptData>()
const promptDraftChangeListeners = new SvelteSet<PromptDraftChangeListener>()
const promptEditorMeasuredHeights = createMeasuredHeightCache()

export const lookupPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptEditorMeasuredHeights.lookup(promptId, widthPx, devicePixelRatio)
}

export const clearPromptEditorMeasuredHeights = (promptId: string): void => {
  promptEditorMeasuredHeights.clear(promptId)
}

export const clearAllPromptEditorMeasuredHeights = (): void => {
  promptEditorMeasuredHeights.clearAll()
}

const applyPromptContent = (target: PromptContent, prompt: Prompt) => {
  target.title = prompt.title
  target.text = prompt.promptText
}

const notifyPromptDraftChange = (promptId: string) => {
  for (const listener of promptDraftChangeListeners) {
    listener(promptId)
  }
}

export const subscribeToPromptDraftChanges = (
  listener: PromptDraftChangeListener
): (() => void) => {
  promptDraftChangeListeners.add(listener)
  return () => {
    promptDraftChangeListeners.delete(listener)
  }
}

export const removePromptData = (promptId: string): void => {
  const promptData = promptDataById.get(promptId)!
  clearAutosaveTimeout(promptData.draft)
  promptDataById.delete(promptId)
  promptEditorMeasuredHeights.clear(promptId)
}

const getOrCreatePromptData = (folderName: string, prompt: Prompt): PromptData => {
  const existing = promptDataById.get(prompt.id)
  if (existing) {
    existing.promptFolderCount = prompt.promptFolderCount
    return existing
  }

  // Deep reactive prompt state so UI can react to nested draft/persisted changes without re-setting the map entry.
  const draft = $state<PromptDraft>({
    title: prompt.title,
    text: prompt.promptText,
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const persisted = $state<PromptPersisted>({
    title: prompt.title,
    text: prompt.promptText,
    lastModifiedDate: prompt.lastModifiedDate
  })

  const autosave = createAutosaveController({
    draft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const contentToSave: PromptContent = { title: draft.title, text: draft.text }

      const result = await ipcInvoke<PromptResult, UpdatePromptRequestPayload>('update-prompt', {
        workspacePath: currentWorkspacePath!,
        folderName,
        id: prompt.id,
        title: contentToSave.title,
        promptText: contentToSave.text
      })

      const updated = result.prompt!

      applyPromptContent(persisted, updated)
      persisted.lastModifiedDate = updated.lastModifiedDate

      if (draft.title === contentToSave.title && draft.text === contentToSave.text) {
        draft.dirty = false
      }
    }
  })

  const applyDraftTitle = (title: string): boolean => {
    if (draft.title === title) return false
    draft.title = title
    notifyPromptDraftChange(prompt.id)
    return true
  }

  const setTitle = (title: string) => {
    if (!applyDraftTitle(title)) return
    autosave.markDirtyAndScheduleAutosave()
  }

  const setTitleWithoutAutosave = (title: string) => {
    applyDraftTitle(title)
  }

  const setTextWithoutAutosave = (text: string) => {
    if (draft.text === text) return
    draft.text = text
    clearPromptEditorMeasuredHeights(prompt.id)
    notifyPromptDraftChange(prompt.id)
  }

  const setText = (text: string, measurement: TextMeasurement) => {
    const textChanged = draft.text !== text
    if (textChanged) {
      draft.text = text
    }
    promptEditorMeasuredHeights.record(prompt.id, measurement, textChanged)
    if (textChanged) {
      autosave.markDirtyAndScheduleAutosave()
      notifyPromptDraftChange(prompt.id)
    }
  }

  const promptData: PromptData = {
    draft,
    persisted,
    promptFolderCount: prompt.promptFolderCount,
    setTitle,
    setTitleWithoutAutosave,
    setText,
    setTextWithoutAutosave,
    saveNow: autosave.saveNow
  }

  promptDataById.set(prompt.id, promptData)
  return promptData
}

export const flushPromptWorkspaceAutosaves = async (): Promise<void> => {
  const tasks = Array.from(promptDataById.values(), (promptData) => {
    clearAutosaveTimeout(promptData.draft)
    return promptData.saveNow()
  })

  await Promise.allSettled(tasks)
}

export const resetPromptDataStoreForWorkspace = (nextWorkspacePath: string | null): void => {
  currentWorkspacePath = nextWorkspacePath
  promptDataById.clear()
  promptEditorMeasuredHeights.clearAll()
}

export const ingestPromptFolderPrompts = (folderName: string, prompts: Prompt[]): string[] => {
  prompts.forEach((prompt) => {
    const promptData = getOrCreatePromptData(folderName, prompt)

    if (prompt.lastModifiedDate <= promptData.persisted.lastModifiedDate) {
      return
    }

    if (promptData.draft.dirty) {
      return
    }

    clearAutosaveTimeout(promptData.draft)

    applyPromptContent(promptData.persisted, prompt)
    promptData.persisted.lastModifiedDate = prompt.lastModifiedDate

    promptData.setTitleWithoutAutosave(prompt.title)
    promptData.setTextWithoutAutosave(prompt.promptText)
    promptData.draft.dirty = false
  })

  return prompts.map((prompt) => prompt.id)
}

export const getPromptData = (promptId: string): PromptData => promptDataById.get(promptId)!
