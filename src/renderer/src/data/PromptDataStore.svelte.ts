import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import type { Prompt, PromptResult } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

type PromptContent = {
  title: string
  text: string
}

type PromptDraft = PromptContent & {
  dirty: boolean
  saving: boolean
  autosaveTimeoutId: number | null
}

type PromptPersisted = PromptContent & {
  lastModifiedDate: string
}

export type PromptData = {
  draft: PromptDraft
  persisted: PromptPersisted
  setTitle: (title: string) => void
  setText: (text: string, measurement: PromptEditorTextMeasurement) => void
  setTextWithoutAutosave: (text: string) => void
  saveNow: () => Promise<void>
}

type PromptDraftChangeListener = (promptId: string) => void

export type PromptEditorTextMeasurement = {
  measuredHeightPx: number | null
  widthPx: number
  devicePixelRatio: number
}

type UpdatePromptRequestPayload = {
  workspacePath: string
  folderName: string
  id: string
  title: string
  promptText: string
}

const AUTOSAVE_MS = 2000

let currentWorkspacePath: string | null = null
const promptDataById = new SvelteMap<string, PromptData>()
const promptDraftChangeListeners = new SvelteSet<PromptDraftChangeListener>()

type PromptEditorMeasuredHeightsByKey = SvelteMap<string, number>
const promptEditorMeasuredHeightsByPromptId = new SvelteMap<
  string,
  PromptEditorMeasuredHeightsByKey
>()

const clampToTwoDecimalPlaces = (value: number): number => {
  return Math.round(value * 100) / 100
}

export const roundDevicePixelRatio = (value: number): number => {
  return clampToTwoDecimalPlaces(value)
}

const measurementKey = (widthPx: number, devicePixelRatio: number): string => {
  return `${widthPx}:${roundDevicePixelRatio(devicePixelRatio)}`
}

export const lookupPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  const measurements = promptEditorMeasuredHeightsByPromptId.get(promptId)
  if (!measurements) return null
  const height = measurements.get(measurementKey(widthPx, devicePixelRatio))
  return typeof height === 'number' ? height : null
}

export const clearPromptEditorMeasuredHeights = (promptId: string): void => {
  promptEditorMeasuredHeightsByPromptId.delete(promptId)
}

export const clearAllPromptEditorMeasuredHeights = (): void => {
  promptEditorMeasuredHeightsByPromptId.clear()
}


const applyPromptContent = (target: PromptContent, prompt: Prompt) => {
  target.title = prompt.title
  target.text = prompt.promptText
}

const clearAutosaveTimeout = (draft: PromptDraft) => {
  if (draft.autosaveTimeoutId == null) return
  window.clearTimeout(draft.autosaveTimeoutId)
  draft.autosaveTimeoutId = null
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
  promptEditorMeasuredHeightsByPromptId.delete(promptId)
}

const getOrCreatePromptData = (folderName: string, prompt: Prompt): PromptData => {
  const existing = promptDataById.get(prompt.id)
  if (existing) {
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

  let saveInFlight: Promise<void> | null = null

  const saveNow = async (): Promise<void> => {
    if (!draft.dirty) return
    if (saveInFlight) {
      await saveInFlight
      if (draft.dirty) {
        await saveNow()
      }
      return
    }

    clearAutosaveTimeout(draft)

    const contentToSave: PromptContent = { title: draft.title, text: draft.text }

    draft.saving = true

    saveInFlight = (async () => {
      try {
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
      } finally {
        draft.saving = false
        saveInFlight = null
      }
    })()

    await saveInFlight
  }

  const scheduleAutosave = () => {
    clearAutosaveTimeout(draft)

    draft.autosaveTimeoutId = window.setTimeout(() => {
      draft.autosaveTimeoutId = null
      void saveNow()
    }, AUTOSAVE_MS)
  }

  const markDirtyAndScheduleAutosave = () => {
    draft.dirty = true
    scheduleAutosave()
  }

  const setTitle = (title: string) => {
    if (draft.title === title) return
    draft.title = title
    markDirtyAndScheduleAutosave()
    notifyPromptDraftChange(prompt.id)
  }

  const setTextWithoutAutosave = (text: string) => {
    if (draft.text === text) return
    draft.text = text
    clearPromptEditorMeasuredHeights(prompt.id)
    notifyPromptDraftChange(prompt.id)
  }

  const setText = (text: string, measurement: PromptEditorTextMeasurement) => {
    const textChanged = draft.text !== text
    if (textChanged) {
      draft.text = text
    }

    const key = measurementKey(measurement.widthPx, measurement.devicePixelRatio)
    let measurements = promptEditorMeasuredHeightsByPromptId.get(prompt.id)
    if (!measurements && measurement.measuredHeightPx != null) {
      measurements = new SvelteMap()
      promptEditorMeasuredHeightsByPromptId.set(prompt.id, measurements)
    }

    if (measurements) {
      if (textChanged) {
        // Side effect: when prompt text changes, keep only the current width:DPR measurement and drop the rest.
        for (const existingKey of measurements.keys()) {
          if (existingKey !== key) {
            measurements.delete(existingKey)
          }
        }
      }

      if (measurement.measuredHeightPx != null) {
        measurements.set(key, measurement.measuredHeightPx)
      }
    }

    if (textChanged) {
      markDirtyAndScheduleAutosave()
      notifyPromptDraftChange(prompt.id)
    }
  }

  const promptData: PromptData = {
    draft,
    persisted,
    setTitle,
    setText,
    setTextWithoutAutosave,
    saveNow
  }

  promptDataById.set(prompt.id, promptData)
  return promptData
}

export const flushPromptWorkspaceAutosaves = async (): Promise<void> => {
  const tasks = Array.from(promptDataById.values(), (promptData) => {
    clearAutosaveTimeout(promptData.draft)
    return promptData.saveNow()
  })

  await Promise.all(tasks)
}

export const resetPromptDataStoreForWorkspace = (nextWorkspacePath: string | null): void => {
  currentWorkspacePath = nextWorkspacePath
  promptDataById.clear()
  promptEditorMeasuredHeightsByPromptId.clear()
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

    if (promptData.draft.title !== prompt.title) {
      promptData.draft.title = prompt.title
      notifyPromptDraftChange(prompt.id)
    }
    promptData.setTextWithoutAutosave(prompt.promptText)
    promptData.draft.dirty = false
  })

  return prompts.map((prompt) => prompt.id)
}

export const getPromptData = (promptId: string): PromptData => promptDataById.get(promptId)!
