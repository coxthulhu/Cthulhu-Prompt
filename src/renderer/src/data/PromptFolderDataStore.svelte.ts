import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import type { LoadPromptsResult, PromptResult, WorkspaceResult } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  ingestPromptFolderPrompts,
  removePromptData
} from '@renderer/data/PromptDataStore.svelte.ts'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  resetAutosaveDraft,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'

type CreatePromptRequestPayload = {
  workspacePath: string
  folderName: string
  title: string
  promptText: string
  previousPromptId: string | null
}

type DeletePromptRequestPayload = {
  workspacePath: string
  folderName: string
  id: string
}

type ReorderPromptRequestPayload = {
  workspacePath: string
  folderName: string
  promptId: string
  previousPromptId: string | null
}

type UpdatePromptFolderDescriptionRequestPayload = {
  workspacePath: string
  folderName: string
  folderDescription: string
}

type PromptFolderDescriptionDraft = AutosaveDraft & {
  text: string
}

export type PromptFolderData = {
  promptIds: string[]
  isLoading: boolean
  isCreatingPrompt: boolean
  errorMessage: string | null
  requestId: number
  descriptionDraft: PromptFolderDescriptionDraft
  setDescriptionText: (text: string, measurement: TextMeasurement) => void
  setDescriptionTextWithoutAutosave: (text: string) => void
  saveDescriptionNow: () => Promise<void>
}

let currentWorkspacePath: string | null = null
let nextRequestId = 0
const promptFolderDataByFolderName = new SvelteMap<string, PromptFolderData>()
const promptFolderDescriptionMeasuredHeights = createMeasuredHeightCache()
const inFlightRequests = new SvelteSet<Promise<void>>()

export const lookupPromptFolderDescriptionMeasuredHeight = (
  folderName: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDescriptionMeasuredHeights.lookup(folderName, widthPx, devicePixelRatio)
}

const clearPromptFolderDescriptionMeasuredHeights = (folderName: string): void => {
  promptFolderDescriptionMeasuredHeights.clear(folderName)
}

const resetDescriptionDraft = (folderName: string, draft: PromptFolderDescriptionDraft): void => {
  resetAutosaveDraft(draft)
  draft.text = ''
  clearPromptFolderDescriptionMeasuredHeights(folderName)
}

export const flushPromptFolderRequests = async (): Promise<void> => {
  await Promise.all(Array.from(inFlightRequests))
}

export const flushPromptFolderAutosaves = async (): Promise<void> => {
  const tasks = Array.from(promptFolderDataByFolderName.values(), (folderData) => {
    clearAutosaveTimeout(folderData.descriptionDraft)
    return folderData.saveDescriptionNow()
  })

  await Promise.allSettled(tasks)
}

export const resetPromptFolderDataStoreForWorkspace = (nextWorkspacePath: string | null): void => {
  currentWorkspacePath = nextWorkspacePath
  promptFolderDataByFolderName.clear()
  promptFolderDescriptionMeasuredHeights.clearAll()
}

export const getPromptFolderData = (folderName: string): PromptFolderData => {
  const existing = promptFolderDataByFolderName.get(folderName)
  if (existing) return existing

  const descriptionDraft = $state<PromptFolderDescriptionDraft>({
    text: '',
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const autosave = createAutosaveController({
    draft: descriptionDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const descriptionToSave = descriptionDraft.text

      await ipcInvoke<WorkspaceResult, UpdatePromptFolderDescriptionRequestPayload>(
        'update-prompt-folder-description',
        {
          workspacePath: currentWorkspacePath!,
          folderName,
          folderDescription: descriptionToSave
        }
      )

      if (descriptionDraft.text === descriptionToSave) {
        descriptionDraft.dirty = false
      }
    }
  })

  const setDescriptionText = (text: string, measurement: TextMeasurement) => {
    const textChanged = descriptionDraft.text !== text
    if (textChanged) {
      descriptionDraft.text = text
    }
    promptFolderDescriptionMeasuredHeights.record(folderName, measurement, textChanged)
    if (textChanged) {
      autosave.markDirtyAndScheduleAutosave()
    }
  }

  const setDescriptionTextWithoutAutosave = (text: string) => {
    if (descriptionDraft.text === text) return
    descriptionDraft.text = text
    clearPromptFolderDescriptionMeasuredHeights(folderName)
  }

  const created = $state<PromptFolderData>({
    promptIds: [],
    isLoading: true,
    isCreatingPrompt: false,
    errorMessage: null,
    requestId: 0,
    descriptionDraft,
    setDescriptionText,
    setDescriptionTextWithoutAutosave,
    saveDescriptionNow: autosave.saveNow
  })
  promptFolderDataByFolderName.set(folderName, created)
  return created
}

export const loadPromptFolder = async (folderName: string): Promise<void> => {
  const task = (async () => {
    const workspacePath = currentWorkspacePath!
    const requestId = (nextRequestId += 1)

    // Clear prior folder data on selection change so the UI never shows stale prompt ids.
    const folderData = getPromptFolderData(folderName)

    folderData.promptIds = []
    folderData.isLoading = true
    folderData.isCreatingPrompt = false
    folderData.errorMessage = null
    folderData.requestId = requestId
    resetDescriptionDraft(folderName, folderData.descriptionDraft)

    const isLatestRequest = () =>
      promptFolderDataByFolderName.get(folderName)?.requestId === requestId

    try {
      const result = await ipcInvoke<
        LoadPromptsResult,
        { workspacePath: string; folderName: string }
      >('load-prompts', {
        workspacePath,
        folderName
      })

      if (!isLatestRequest()) return

      const nextDescription = result.folderDescription ?? ''
      folderData.promptIds = ingestPromptFolderPrompts(folderName, result.prompts ?? [])
      folderData.setDescriptionTextWithoutAutosave(nextDescription)
      folderData.isLoading = false
    } catch (error) {
      if (!isLatestRequest()) return

      folderData.errorMessage = error instanceof Error ? error.message : String(error)
      folderData.isLoading = false
    }
  })()

  inFlightRequests.add(task)
  try {
    await task
  } finally {
    inFlightRequests.delete(task)
  }
}

export const createPromptInFolder = async (
  folderName: string,
  previousPromptId: string | null
): Promise<void> => {
  const folderData = promptFolderDataByFolderName.get(folderName)!

  if (folderData.isCreatingPrompt) return

  folderData.isCreatingPrompt = true

  try {
    const result = await ipcInvoke<PromptResult, CreatePromptRequestPayload>('create-prompt', {
      workspacePath: currentWorkspacePath!,
      folderName,
      title: '',
      promptText: '',
      previousPromptId
    })

    const prompt = result.prompt!

    ingestPromptFolderPrompts(folderName, [prompt])

    const insertIndex = previousPromptId ? folderData.promptIds.indexOf(previousPromptId) + 1 : 0
    const nextPromptIds = [...folderData.promptIds]
    nextPromptIds.splice(insertIndex, 0, prompt.id)
    folderData.promptIds = nextPromptIds
  } catch {
    // Intentionally ignore create errors to keep the UI quiet.
  } finally {
    folderData.isCreatingPrompt = false
  }
}

const reorderPromptIds = (
  promptIds: string[],
  promptId: string,
  previousPromptId: string | null
): string[] | null => {
  const currentIndex = promptIds.indexOf(promptId)
  if (currentIndex === -1) return null

  const nextPromptIds = [...promptIds]
  nextPromptIds.splice(currentIndex, 1)

  if (previousPromptId == null) {
    nextPromptIds.unshift(promptId)
    return nextPromptIds
  }

  const previousIndex = nextPromptIds.indexOf(previousPromptId)
  if (previousIndex === -1) return null

  nextPromptIds.splice(previousIndex + 1, 0, promptId)
  return nextPromptIds
}

const reorderPromptInFolder = async (
  folderName: string,
  promptId: string,
  previousPromptId: string | null
): Promise<boolean> => {
  const folderData = promptFolderDataByFolderName.get(folderName)
  if (!folderData) return false

  const nextPromptIds = reorderPromptIds(folderData.promptIds, promptId, previousPromptId)
  if (!nextPromptIds) return false

  try {
    await ipcInvoke<WorkspaceResult, ReorderPromptRequestPayload>('reorder-prompt', {
      workspacePath: currentWorkspacePath!,
      folderName,
      promptId,
      previousPromptId
    })

    folderData.promptIds = nextPromptIds
    return true
  } catch {
    // Intentionally ignore reorder errors to keep the UI quiet.
    return false
  }
}

export const movePromptUpInFolder = async (
  folderName: string,
  promptId: string
): Promise<boolean> => {
  const folderData = promptFolderDataByFolderName.get(folderName)
  if (!folderData) return false

  const { promptIds } = folderData
  const currentIndex = promptIds.indexOf(promptId)
  if (currentIndex <= 0) return false

  const previousPromptId = currentIndex <= 1 ? null : promptIds[currentIndex - 2]
  return await reorderPromptInFolder(folderName, promptId, previousPromptId)
}

export const movePromptDownInFolder = async (
  folderName: string,
  promptId: string
): Promise<boolean> => {
  const folderData = promptFolderDataByFolderName.get(folderName)
  if (!folderData) return false

  const { promptIds } = folderData
  const currentIndex = promptIds.indexOf(promptId)
  if (currentIndex === -1 || currentIndex >= promptIds.length - 1) return false

  const previousPromptId = promptIds[currentIndex + 1]
  return await reorderPromptInFolder(folderName, promptId, previousPromptId)
}

export const deletePromptInFolder = async (folderName: string, promptId: string): Promise<void> => {
  const folderData = promptFolderDataByFolderName.get(folderName)!

  try {
    await ipcInvoke<WorkspaceResult, DeletePromptRequestPayload>('delete-prompt', {
      workspacePath: currentWorkspacePath!,
      folderName,
      id: promptId
    })

    folderData.promptIds = folderData.promptIds.filter((id) => id !== promptId)
    removePromptData(promptId)
  } catch {
    // Intentionally ignore delete errors to keep the UI quiet.
  }
}
