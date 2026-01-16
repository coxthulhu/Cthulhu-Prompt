import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import type { LoadPromptsResult, PromptResult, WorkspaceResult } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import { ingestPromptFolderPrompts, removePromptData } from '@renderer/data/PromptDataStore.svelte.ts'

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

export type PromptFolderData = {
  promptIds: string[]
  isLoading: boolean
  isCreatingPrompt: boolean
  errorMessage: string | null
  requestId: number
}

let currentWorkspacePath: string | null = null
let nextRequestId = 0
const promptFolderDataByFolderName = new SvelteMap<string, PromptFolderData>()
const inFlightRequests = new SvelteSet<Promise<void>>()

const ensurePromptFolderData = (folderName: string): PromptFolderData => {
  const existing = promptFolderDataByFolderName.get(folderName)
  if (existing) return existing

  const created = $state<PromptFolderData>({
    promptIds: [],
    isLoading: true,
    isCreatingPrompt: false,
    errorMessage: null,
    requestId: 0
  })
  promptFolderDataByFolderName.set(folderName, created)
  return created
}

export const getOrCreatePromptFolderData = (folderName: string): PromptFolderData => {
  return ensurePromptFolderData(folderName)
}

export const flushPromptFolderRequests = async (): Promise<void> => {
  await Promise.all(Array.from(inFlightRequests))
}

export const resetPromptFolderDataStoreForWorkspace = (nextWorkspacePath: string | null): void => {
  currentWorkspacePath = nextWorkspacePath
  promptFolderDataByFolderName.clear()
}

export const getPromptFolderData = (folderName: string): PromptFolderData | null => {
  return promptFolderDataByFolderName.get(folderName) ?? null
}

export const loadPromptFolder = async (
  folderName: string,
  folderDataOverride?: PromptFolderData
): Promise<void> => {
  const task = (async () => {
    const workspacePath = currentWorkspacePath!
    const requestId = (nextRequestId += 1)
    // Clear prior folder data on selection change so the UI never shows stale prompt ids.
    const folderData = folderDataOverride ?? ensurePromptFolderData(folderName)

    folderData.promptIds = []
    folderData.isLoading = true
    folderData.isCreatingPrompt = false
    folderData.errorMessage = null
    folderData.requestId = requestId

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

      folderData.promptIds = ingestPromptFolderPrompts(folderName, result.prompts ?? [])
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

    const insertIndex = previousPromptId
      ? folderData.promptIds.indexOf(previousPromptId) + 1
      : 0
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
