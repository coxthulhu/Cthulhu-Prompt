import { SvelteMap } from 'svelte/reactivity'
import type { editor as MonacoEditor } from 'monaco-editor'
import { FindController } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
import { FindModelBoundToEditorModel } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findModel'

type FindEntry = {
  promptId: string
  editor: MonacoEditor.IStandaloneCodeEditor
  controller: FindController
  model: FindModelBoundToEditorModel | null
}

const entriesByEditor = new SvelteMap<MonacoEditor.IStandaloneCodeEditor, FindEntry>()
const entriesByPromptId = new SvelteMap<string, FindEntry>()

const applyFindQuery = (entry: FindEntry, query: string) => {
  entry.controller.getState().change(
    {
      searchString: query,
      isRegex: false,
      wholeWord: false,
      matchCase: false,
      preserveCase: false,
      searchScope: null
    },
    false
  )
  if (!entry.model) {
    entry.model = new FindModelBoundToEditorModel(entry.editor, entry.controller.getState())
  }
}

const clearFindHighlights = (entry: FindEntry) => {
  entry.model?.dispose()
  entry.model = null
}

export const registerPromptFolderFindEditor = (
  promptId: string,
  editor: MonacoEditor.IStandaloneCodeEditor
): void => {
  const existing = entriesByEditor.get(editor)
  if (existing) {
    if (existing.promptId !== promptId) {
      entriesByPromptId.delete(existing.promptId)
      existing.promptId = promptId
    }
    entriesByPromptId.set(promptId, existing)
    return
  }

  const controller = FindController.get(editor)
  if (!controller) return
  const entry: FindEntry = { promptId, editor, controller, model: null }
  entriesByEditor.set(editor, entry)
  entriesByPromptId.set(promptId, entry)
}

export const unregisterPromptFolderFindEditor = (
  editor: MonacoEditor.IStandaloneCodeEditor
): void => {
  const entry = entriesByEditor.get(editor)
  if (!entry) return
  clearFindHighlights(entry)
  entriesByEditor.delete(editor)
  entriesByPromptId.delete(entry.promptId)
}

export const updatePromptFolderFindHighlights = (query: string, isFindOpen: boolean): void => {
  if (!isFindOpen || query.length === 0) {
    entriesByEditor.forEach(clearFindHighlights)
    return
  }

  entriesByEditor.forEach((entry) => {
    applyFindQuery(entry, query)
  })
}

export const countPromptFolderFindMatches = (promptId: string, query: string): number | null => {
  const entry = entriesByPromptId.get(promptId)
  if (!entry) return null
  if (query.length === 0) return 0
  applyFindQuery(entry, query)
  return entry.controller.getState().matchesCount
}
