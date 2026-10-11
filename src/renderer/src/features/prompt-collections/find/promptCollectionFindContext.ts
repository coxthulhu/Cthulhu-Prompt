import { getContext, setContext } from 'svelte'
import type { PromptCollectionFindState } from './promptCollectionFindTypes'

const PROMPT_COLLECTION_FIND_CONTEXT = Symbol('prompt-collection-find')

export const setPromptCollectionFindContext = (value: PromptCollectionFindState): void => {
  setContext(PROMPT_COLLECTION_FIND_CONTEXT, value)
}

export const getPromptCollectionFindContext = (): PromptCollectionFindState | null => {
  return getContext<PromptCollectionFindState | null>(PROMPT_COLLECTION_FIND_CONTEXT) ?? null
}
