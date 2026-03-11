import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { promptCollection } from '../Collections/PromptCollection'
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
  promptFolderCount: number
  setTitle: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
}

const getPromptFolderCount = (promptId: string): number => {
  const prompt = promptCollection.get(promptId)
  return prompt?.promptFolderCount ?? 0
}

export const getPromptDisplayTitle = (promptId: string): string => {
  const promptDraftState = getPromptDraftState(promptId)
  const trimmedTitle = promptDraftState.title.trim()
  return trimmedTitle.length > 0 ? trimmedTitle : `Prompt ${getPromptFolderCount(promptId)}`
}

export const getPromptFolderScreenPromptData = (promptId: string): PromptFolderScreenPromptData => {
  const promptDraftState = getPromptDraftState(promptId)
  return {
    draft: {
      title: promptDraftState.title,
      text: promptDraftState.promptText
    },
    promptFolderCount: getPromptFolderCount(promptId),
    setTitle: (title: string) => {
      setPromptDraftTitle(promptId, title)
    },
    setText: (text: string, measurement: TextMeasurement) => {
      setPromptDraftText(promptId, text, measurement)
    }
  }
}
