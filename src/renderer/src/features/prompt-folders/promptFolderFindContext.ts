import { getContext, setContext } from 'svelte'
import type { PromptFolderFindState } from './promptFolderFindTypes'

const PROMPT_FOLDER_FIND_CONTEXT = Symbol('prompt-folder-find')

export const setPromptFolderFindContext = (value: PromptFolderFindState): void => {
  setContext(PROMPT_FOLDER_FIND_CONTEXT, value)
}

export const getPromptFolderFindContext = (): PromptFolderFindState | null => {
  return getContext<PromptFolderFindState | null>(PROMPT_FOLDER_FIND_CONTEXT) ?? null
}
