import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import { monaco } from '@renderer/common/Monaco'
import {
  getPromptData,
  subscribeToPromptDraftChanges
} from '@renderer/data/PromptDataStore.svelte.ts'

export const promptFolderFindState = $state({
  query: '',
  totalMatches: 0
})

let activeFolderName = $state<string | null>(null)
const promptMatchesById = new SvelteMap<string, number>()
const activePromptIds = new SvelteSet<string>()
let searchModel: monaco.editor.ITextModel | null = null

const resetFindState = (): void => {
  promptMatchesById.clear()
  activePromptIds.clear()
  promptFolderFindState.totalMatches = 0
}

const ensureSearchModel = (): monaco.editor.ITextModel => {
  if (searchModel) return searchModel
  searchModel = monaco.editor.createModel('', 'plaintext')
  return searchModel
}

const countMatchesInText = (query: string, text: string): number => {
  const model = ensureSearchModel()
  model.setValue(text)
  return model.findMatches(query, false, false, false, null, false).length
}

const countMatchesForPrompt = (promptId: string, query: string): number => {
  const promptData = getPromptData(promptId)
  return (
    countMatchesInText(query, promptData.draft.title) +
    countMatchesInText(query, promptData.draft.text)
  )
}

const setPromptMatchCount = (promptId: string, nextCount: number): void => {
  const previousCount = promptMatchesById.get(promptId) ?? 0
  if (previousCount === nextCount) return
  promptMatchesById.set(promptId, nextCount)
  promptFolderFindState.totalMatches += nextCount - previousCount
}

const removePrompt = (promptId: string): void => {
  const previousCount = promptMatchesById.get(promptId) ?? 0
  if (previousCount) {
    promptFolderFindState.totalMatches -= previousCount
  }
  promptMatchesById.delete(promptId)
  activePromptIds.delete(promptId)
}

const rebuildPromptMatches = (promptIds: string[], query: string): void => {
  resetFindState()
  const hasQuery = query.length > 0

  for (const promptId of promptIds) {
    activePromptIds.add(promptId)
    if (!hasQuery) continue
    setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
  }
}

export const setFindQuery = (query: string): void => {
  if (promptFolderFindState.query === query) return
  promptFolderFindState.query = query
  rebuildPromptMatches(Array.from(activePromptIds), query)
}

export const syncPromptFolderFindScope = (
  folderName: string,
  promptIds: string[]
): void => {
  if (activeFolderName !== folderName) {
    activeFolderName = folderName
    rebuildPromptMatches(promptIds, promptFolderFindState.query)
    return
  }

  const query = promptFolderFindState.query
  const hasQuery = query.length > 0
  const nextPromptIds = new SvelteSet<string>(promptIds)

  for (const promptId of activePromptIds) {
    if (!nextPromptIds.has(promptId)) {
      removePrompt(promptId)
    }
  }

  for (const promptId of nextPromptIds) {
    if (!activePromptIds.has(promptId)) {
      activePromptIds.add(promptId)
      if (!hasQuery) continue
      setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
    }
  }
}

const updatePromptMatchesForPrompt = (promptId: string, query: string): void => {
  if (!activePromptIds.has(promptId)) return
  setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
}

// Side effect: update matches for prompts as their draft content changes.
subscribeToPromptDraftChanges((promptId) => {
  const query = promptFolderFindState.query
  if (!query) return
  updatePromptMatchesForPrompt(promptId, query)
})
