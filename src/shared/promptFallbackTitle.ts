import type { Prompt } from './Prompt'

export const DEFAULT_PROMPT_FALLBACK_TITLE = 'New Prompt'

type PromptFallbackTitleCandidate = Pick<Prompt, 'id' | 'title' | 'fallbackTitle'>

export const getPromptDisplayTitle = (
  prompt: Pick<Prompt, 'title' | 'fallbackTitle'>
): string => {
  const trimmedTitle = prompt.title.trim()
  return trimmedTitle.length > 0 ? trimmedTitle : prompt.fallbackTitle
}

export const resolveAvailablePromptFallbackTitle = (
  prompts: PromptFallbackTitleCandidate[],
  promptId: string,
  preferredFallbackTitle: string = DEFAULT_PROMPT_FALLBACK_TITLE
): string => {
  const fallbackTitles = new Set(
    prompts
      .filter((prompt) => prompt.id !== promptId && prompt.title.trim().length === 0)
      .map((prompt) => prompt.fallbackTitle)
  )
  const baseFallbackTitle = preferredFallbackTitle || DEFAULT_PROMPT_FALLBACK_TITLE

  if (!fallbackTitles.has(baseFallbackTitle)) {
    return baseFallbackTitle
  }

  let fallbackIndex = 1
  while (fallbackTitles.has(`${DEFAULT_PROMPT_FALLBACK_TITLE} ${fallbackIndex}`)) {
    fallbackIndex += 1
  }

  return `${DEFAULT_PROMPT_FALLBACK_TITLE} ${fallbackIndex}`
}
