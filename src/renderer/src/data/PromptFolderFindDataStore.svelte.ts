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

const ensureSearchModel = (): monaco.editor.ITextModel => {
  if (searchModel) return searchModel
  searchModel = monaco.editor.createModel('', 'plaintext')
  return searchModel
}

const countMatchesInText = (query: string, text: string): number => {
  if (!query) return 0
  const model = ensureSearchModel()
  model.setValue(text)
  return model.findMatches(query, false, false, false, null, false).length
}

const countMatchesForPrompt = (promptId: string, query: string): number => {
  if (!query) return 0
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

const addPrompt = (promptId: string, query: string): void => {
  activePromptIds.add(promptId)
  setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
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
  promptMatchesById.clear()
  activePromptIds.clear()
  promptFolderFindState.totalMatches = 0

  promptIds.forEach((promptId) => {
    activePromptIds.add(promptId)
  })

  if (!query) return

  promptIds.forEach((promptId) => {
    const count = countMatchesForPrompt(promptId, query)
    promptMatchesById.set(promptId, count)
    promptFolderFindState.totalMatches += count
  })
}

export const setActivePromptFolder = (folderName: string | null): void => {
  if (activeFolderName === folderName) return
  activeFolderName = folderName
  promptMatchesById.clear()
  activePromptIds.clear()
  promptFolderFindState.totalMatches = 0
}

export const setFindQuery = (query: string): void => {
  if (promptFolderFindState.query === query) return
  promptFolderFindState.query = query

  if (!activeFolderName) {
    promptMatchesById.clear()
    activePromptIds.clear()
    promptFolderFindState.totalMatches = 0
    return
  }

  const promptIds = Array.from(activePromptIds)
  rebuildPromptMatches(promptIds, query)
}

export const syncActivePromptFolderPromptIds = (
  folderName: string,
  promptIds: string[]
): void => {
  if (activeFolderName !== folderName) return

  const nextPromptIds = new SvelteSet<string>(promptIds)
  const query = promptFolderFindState.query

  for (const promptId of activePromptIds) {
    if (!nextPromptIds.has(promptId)) {
      removePrompt(promptId)
    }
  }

  for (const promptId of nextPromptIds) {
    if (!activePromptIds.has(promptId)) {
      addPrompt(promptId, query)
    }
  }
}

const updatePromptMatchesForPrompt = (promptId: string): void => {
  if (!activePromptIds.has(promptId)) return
  const query = promptFolderFindState.query
  setPromptMatchCount(promptId, countMatchesForPrompt(promptId, query))
}

// Side effect: update matches for prompts as their draft content changes.
subscribeToPromptDraftChanges((promptId) => {
  updatePromptMatchesForPrompt(promptId)
})
