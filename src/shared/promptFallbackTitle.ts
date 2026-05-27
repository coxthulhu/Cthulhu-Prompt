export const DEFAULT_PROMPT_FALLBACK_TITLE = 'New Prompt'

export type PromptFallbackTitleCandidate = {
  id: string
  title: string
  fallbackTitle: string
}

export type PromptTitleUpdateOptions = {
  prompts: PromptFallbackTitleCandidate[]
  promptId: string
  currentTitle?: string
  currentFallbackTitle?: string
  nextTitle: string
  fallbackTitleWhenTitleCleared?: string
}

export type PromptTitleUpdateForPromptIdsOptions<
  TPrompt extends PromptFallbackTitleCandidate
> = Omit<PromptTitleUpdateOptions, 'prompts'> & {
  promptIds: string[]
  lookupPrompt: (promptId: string) => TPrompt | null | undefined
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

export const resolvePromptTitleUpdate = ({
  prompts,
  promptId,
  currentTitle = '',
  currentFallbackTitle = '',
  nextTitle,
  fallbackTitleWhenTitleCleared = DEFAULT_PROMPT_FALLBACK_TITLE
}: PromptTitleUpdateOptions): Pick<PromptFallbackTitleCandidate, 'title' | 'fallbackTitle'> => {
  const normalizedNextTitle = normalizePromptTitle(nextTitle)
  if (normalizedNextTitle.length > 0) {
    return { title: normalizedNextTitle, fallbackTitle: '' }
  }

  const normalizedCurrentTitle = normalizePromptTitle(currentTitle)
  const preferredFallbackTitle =
    normalizedCurrentTitle.length > 0
      ? fallbackTitleWhenTitleCleared
      : currentFallbackTitle || DEFAULT_PROMPT_FALLBACK_TITLE

  return {
    title: '',
    fallbackTitle: resolveAvailablePromptFallbackTitle(prompts, promptId, preferredFallbackTitle)
  }
}

export const resolvePromptTitleUpdateForPromptIds = <
  TPrompt extends PromptFallbackTitleCandidate
>({
  promptIds,
  lookupPrompt,
  promptId,
  currentTitle,
  currentFallbackTitle,
  nextTitle,
  fallbackTitleWhenTitleCleared
}: PromptTitleUpdateForPromptIdsOptions<TPrompt>): Pick<
  PromptFallbackTitleCandidate,
  'title' | 'fallbackTitle'
> => {
  return resolvePromptTitleUpdate({
    prompts: collectPromptFallbackTitleCandidates(promptIds, lookupPrompt, promptId),
    promptId,
    currentTitle,
    currentFallbackTitle,
    nextTitle,
    fallbackTitleWhenTitleCleared
  })
}
