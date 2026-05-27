import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'
import {
  getPromptDraftState,
  setPromptDraftText,
  setPromptDraftTitle
} from './PromptDraftMutations.svelte.ts'

type PromptFolderScreenPromptDraft = {
  title: string
  text: string
}

type PromptFolderScreenPromptData = {
  draft: PromptFolderScreenPromptDraft
  modifiedAt: string
  fallbackTitle: string
  setTitle: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
}

export const getPromptDisplayTitle = (promptId: string): string => {
  const promptDraftState = getPromptDraftState(promptId)
  return getPromptTitleText(promptDraftState)
}

export const getPromptFolderScreenPromptData = (promptId: string): PromptFolderScreenPromptData => {
  const promptDraftState = getPromptDraftState(promptId)
  return {
    draft: {
      title: promptDraftState.title,
      text: promptDraftState.promptText
    },
    modifiedAt: promptDraftState.modifiedAt,
    fallbackTitle: promptDraftState.fallbackTitle,
    setTitle: (title: string) => {
      setPromptDraftTitle(promptId, title)
    },
    setText: (text: string, measurement: TextMeasurement) => {
      setPromptDraftText(promptId, text, measurement)
    }
  }
}
