import type { TextMeasurement } from '@renderer/data/UiState/cache/measuredHeightCache'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { isPromptFull } from '@shared/domain/prompt/Prompt'
import { getPromptDisplayTitle as getPromptTitleText } from '@shared/domain/prompt/promptFallbackTitle'
import {
  setPromptText,
  setPromptTitle
} from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'

type PromptCollectionScreenPromptDraft = {
  title: string
  text: string
}

type PromptCollectionScreenPromptData = {
  draft: PromptCollectionScreenPromptDraft
  modifiedAt: string
  fallbackTitle: string
  setTitle: (title: string) => void
  setText: (text: string, measurement: TextMeasurement) => void
}

export const getPromptDisplayTitle = (promptId: string): string => {
  return getPromptTitleText(promptsCollection.get(promptId)!)
}

export const getPromptCollectionScreenPromptData = (promptId: string): PromptCollectionScreenPromptData => {
  /** Canonical full prompt projected into the editor's draft-shaped view model. */
  const prompt = promptsCollection.get(promptId)!
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
