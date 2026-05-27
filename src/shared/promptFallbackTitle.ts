export const DEFAULT_PROMPT_FALLBACK_TITLE = 'New Prompt'

export type PromptFallbackTitleCandidate = {
  id: string
  title: string
  fallbackTitle: string
}

export const getPromptDisplayTitle = (
  prompt: Pick<PromptFallbackTitleCandidate, 'title' | 'fallbackTitle'>
): string => {
  const trimmedTitle = prompt.title.trim()
  return trimmedTitle.length > 0 ? trimmedTitle : prompt.fallbackTitle
}

export const normalizePromptTitle = (title: string): string => {
  return title.trim().length > 0 ? title : ''
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

export const collectPromptFallbackTitleCandidates = <TPrompt extends PromptFallbackTitleCandidate>(
  promptIds: string[],
  lookupPrompt: (promptId: string) => TPrompt | null | undefined,
  promptId: string
): TPrompt[] => {
  const prompts: TPrompt[] = []

  for (const currentPromptId of promptIds) {
    if (currentPromptId === promptId) {
      continue
    }

    const prompt = lookupPrompt(currentPromptId)
    if (prompt) {
      prompts.push(prompt)
    }
  }

  return prompts
}

export const resolvePromptFallbackTitleForPromptIds = <
  TPrompt extends PromptFallbackTitleCandidate
>(
  promptIds: string[],
  lookupPrompt: (promptId: string) => TPrompt | null | undefined,
  promptId: string,
  preferredFallbackTitle: string = DEFAULT_PROMPT_FALLBACK_TITLE
): string => {
  return resolveAvailablePromptFallbackTitle(
    collectPromptFallbackTitleCandidates(promptIds, lookupPrompt, promptId),
    promptId,
    preferredFallbackTitle
  )
}

export const resolvePromptTitleFields = (
  prompts: PromptFallbackTitleCandidate[],
  promptId: string,
  title: string,
  preferredFallbackTitle: string = DEFAULT_PROMPT_FALLBACK_TITLE
): Pick<PromptFallbackTitleCandidate, 'title' | 'fallbackTitle'> => {
  const normalizedTitle = normalizePromptTitle(title)

  return {
    title: normalizedTitle,
    fallbackTitle:
      normalizedTitle.length > 0
        ? ''
        : resolveAvailablePromptFallbackTitle(prompts, promptId, preferredFallbackTitle)
  }
}

export const resolvePromptTitleFieldsForPromptIds = <
  TPrompt extends PromptFallbackTitleCandidate
>(
  promptIds: string[],
  lookupPrompt: (promptId: string) => TPrompt | null | undefined,
  promptId: string,
  title: string,
  preferredFallbackTitle: string = DEFAULT_PROMPT_FALLBACK_TITLE
): Pick<PromptFallbackTitleCandidate, 'title' | 'fallbackTitle'> => {
  return resolvePromptTitleFields(
    collectPromptFallbackTitleCandidates(promptIds, lookupPrompt, promptId),
    promptId,
    title,
    preferredFallbackTitle
  )
}
