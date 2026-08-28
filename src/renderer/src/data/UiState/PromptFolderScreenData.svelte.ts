import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { isPromptFull } from '@shared/Prompt'
import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'
import {
  setPromptText,
  setPromptTitle
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
  return getPromptTitleText(promptCollection.get(promptId)!)
}

export const getPromptFolderScreenPromptData = (promptId: string): PromptFolderScreenPromptData => {
  /** Canonical full prompt projected into the editor's draft-shaped view model. */
  const prompt = promptCollection.get(promptId)!
  if (!isPromptFull(prompt)) throw new Error('Full prompt not loaded')
  return {
    draft: {
      title: prompt.title,
      text: prompt.promptText
    },
    modifiedAt: prompt.modifiedAt,
    fallbackTitle: prompt.fallbackTitle,
    setTitle: (title: string) => {
      setPromptTitle(promptId, title)
    },
    setText: (text: string, measurement: TextMeasurement) => {
      setPromptText(promptId, text, measurement)
    }
  }
}
