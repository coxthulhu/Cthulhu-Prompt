import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'
import { tanstackPromptCollection } from '../Collections/TanstackPromptCollection'
import { tanstackPromptFolderCollection } from '../Collections/TanstackPromptFolderCollection'
import {
  getTanstackPromptDraftState,
  removeTanstackPromptDraft,
  setTanstackPromptDraftText,
  setTanstackPromptDraftTitle,
  syncTanstackPromptDraft
} from './TanstackPromptDraftStore.svelte.ts'
import {
  getTanstackPromptFolderDraftState,
  setTanstackPromptFolderDraftDescription,
  syncTanstackPromptFolderDescriptionDraft
} from './TanstackPromptFolderDraftStore.svelte.ts'

type TanstackPromptFolderScreenPromptDraft = {
  title: string
  text: string
}

export type TanstackPromptFolderScreenPromptData = {
  draft: TanstackPromptFolderScreenPromptDraft
  promptFolderCount: number
  setTitle: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
}

const promptEditorMeasuredHeights = createMeasuredHeightCache()
const promptFolderDescriptionMeasuredHeights = createMeasuredHeightCache()

const ensurePromptDraftState = (promptId: string): void => {
  const prompt = tanstackPromptCollection.get(promptId)
  if (!prompt) {
    return
  }

  syncTanstackPromptDraft(prompt)
}

const ensurePromptFolderDescriptionDraftState = (promptFolderId: string): void => {
  const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    return
  }

  syncTanstackPromptFolderDescriptionDraft(promptFolder)
}

const getPromptTitle = (promptId: string): string => {
  return (
    getTanstackPromptDraftState(promptId)?.draftSnapshot.title ??
    tanstackPromptCollection.get(promptId)?.title ??
    ''
  )
}

const getPromptText = (promptId: string): string => {
  return (
    getTanstackPromptDraftState(promptId)?.draftSnapshot.promptText ??
    tanstackPromptCollection.get(promptId)?.promptText ??
    ''
  )
}

const getPromptFolderCount = (promptId: string): number => {
  return tanstackPromptCollection.get(promptId)?.promptFolderCount ?? 0
}

const getPromptFolderDescription = (promptFolderId: string): string => {
  return (
    getTanstackPromptFolderDraftState(promptFolderId)?.draftSnapshot.folderDescription ??
    tanstackPromptFolderCollection.get(promptFolderId)?.folderDescription ??
    ''
  )
}

export const syncTanstackPromptFolderScreenPromptDraft = (prompt: TanstackPrompt): void => {
  syncTanstackPromptDraft(prompt)
}

export const syncTanstackPromptFolderScreenDescriptionDraft = (
  promptFolder: TanstackPromptFolder
): void => {
  syncTanstackPromptFolderDescriptionDraft(promptFolder)
}

export const getTanstackPromptFolderScreenPromptData = (
  promptId: string
): TanstackPromptFolderScreenPromptData => {
  return {
    draft: {
      title: getPromptTitle(promptId),
      text: getPromptText(promptId)
    },
    promptFolderCount: getPromptFolderCount(promptId),
    setTitle: (title: string) => {
      ensurePromptDraftState(promptId)
      setTanstackPromptDraftTitle(promptId, title)
    },
    setText: (text: string, measurement: TextMeasurement) => {
      ensurePromptDraftState(promptId)
      const textChanged = getPromptText(promptId) !== text
      promptEditorMeasuredHeights.record(promptId, measurement, textChanged)

      if (!textChanged) {
        return
      }

      setTanstackPromptDraftText(promptId, text)
    }
  }
}

export const getTanstackPromptFolderScreenDescriptionText = (promptFolderId: string): string => {
  return getPromptFolderDescription(promptFolderId)
}

export const setTanstackPromptFolderScreenDescriptionText = (
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

  setTanstackPromptFolderDraftDescription(promptFolderId, text)
}

export const lookupTanstackPromptFolderScreenPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptEditorMeasuredHeights.lookup(promptId, widthPx, devicePixelRatio)
}

export const lookupTanstackPromptFolderScreenDescriptionMeasuredHeight = (
  promptFolderId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDescriptionMeasuredHeights.lookup(promptFolderId, widthPx, devicePixelRatio)
}

export const removeTanstackPromptFolderScreenPrompt = (promptId: string): void => {
  removeTanstackPromptDraft(promptId)
  promptEditorMeasuredHeights.clear(promptId)
}

export const clearTanstackPromptFolderScreenState = (): void => {
  promptEditorMeasuredHeights.clearAll()
  promptFolderDescriptionMeasuredHeights.clearAll()
}
