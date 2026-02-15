import type { PromptFolder } from '@shared/PromptFolder'
import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import {
  getPromptDraftState,
  removePromptDraft,
  setPromptDraftText,
  setPromptDraftTitle,
  syncPromptDraft
} from './PromptDraftStore.svelte.ts'
import {
  getPromptFolderDraftState,
  setPromptFolderDraftDescription,
  syncPromptFolderDescriptionDraft
} from './PromptFolderDraftStore.svelte.ts'

type PromptFolderScreenPromptDraft = {
  title: string
  text: string
}

type PromptFolderScreenPromptData = {
  draft: PromptFolderScreenPromptDraft
  promptFolderCount: number
  setTitle: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
}

const promptFolderDescriptionMeasuredHeights = createMeasuredHeightCache()

const ensurePromptDraftState = (promptId: string): void => {
  const prompt = promptCollection.get(promptId)
  if (!prompt) {
    return
  }

  syncPromptDraft(prompt)
}

const ensurePromptFolderDescriptionDraftState = (promptFolderId: string): void => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    return
  }

  syncPromptFolderDescriptionDraft(promptFolder)
}

const getPromptTitle = (promptId: string): string => {
  return (
    getPromptDraftState(promptId)?.draftSnapshot.title ??
    promptCollection.get(promptId)?.title ??
    ''
  )
}

const getPromptText = (promptId: string): string => {
  return (
    getPromptDraftState(promptId)?.draftSnapshot.promptText ??
    promptCollection.get(promptId)?.promptText ??
    ''
  )
}

const getPromptFolderCount = (promptId: string): number => {
  return promptCollection.get(promptId)?.promptFolderCount ?? 0
}

const getPromptFolderDescription = (promptFolderId: string): string => {
  return (
    getPromptFolderDraftState(promptFolderId)?.draftSnapshot.folderDescription ??
    promptFolderCollection.get(promptFolderId)?.folderDescription ??
    ''
  )
}

export const syncPromptFolderScreenDescriptionDraft = (
  promptFolder: PromptFolder
): void => {
  syncPromptFolderDescriptionDraft(promptFolder)
}

export const getPromptFolderScreenPromptData = (
  promptId: string
): PromptFolderScreenPromptData => {
  return {
    draft: {
      title: getPromptTitle(promptId),
      text: getPromptText(promptId)
    },
    promptFolderCount: getPromptFolderCount(promptId),
    setTitle: (title: string) => {
      ensurePromptDraftState(promptId)
      setPromptDraftTitle(promptId, title)
    },
    setText: (text: string, measurement: TextMeasurement) => {
      ensurePromptDraftState(promptId)
      setPromptDraftText(promptId, text, measurement)
    }
  }
}

export const getPromptFolderScreenDescriptionText = (promptFolderId: string): string => {
  return getPromptFolderDescription(promptFolderId)
}

export const setPromptFolderScreenDescriptionText = (
  promptFolderId: string,
  text: string,
  measurement: TextMeasurement
): void => {
  ensurePromptFolderDescriptionDraftState(promptFolderId)
  const textChanged = getPromptFolderDescription(promptFolderId) !== text
  promptFolderDescriptionMeasuredHeights.record(promptFolderId, measurement, textChanged)

  if (!textChanged) {
    return
  }

  setPromptFolderDraftDescription(promptFolderId, text)
}

export const lookupPromptFolderScreenDescriptionMeasuredHeight = (
  promptFolderId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDescriptionMeasuredHeights.lookup(promptFolderId, widthPx, devicePixelRatio)
}

export const removePromptFolderScreenPrompt = (promptId: string): void => {
  removePromptDraft(promptId)
}

export const clearPromptFolderScreenState = (): void => {
  promptFolderDescriptionMeasuredHeights.clearAll()
}
