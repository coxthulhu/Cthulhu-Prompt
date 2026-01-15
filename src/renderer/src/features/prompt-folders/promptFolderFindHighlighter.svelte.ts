import { SvelteMap } from 'svelte/reactivity'
import type { editor as MonacoEditor } from 'monaco-editor'
import { FindController } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
import { FindModelBoundToEditorModel } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findModel'

type FindHighlightEntry = {
  editor: MonacoEditor.IStandaloneCodeEditor
  controller: FindController
  model: FindModelBoundToEditorModel | null
}

type FindHighlighterInput = {
  getIsFindOpen: () => boolean
  getQuery: () => string
}

export const createPromptFolderFindHighlighter = ({
  getIsFindOpen,
  getQuery
}: FindHighlighterInput) => {
  const findHighlightEntries = new SvelteMap<
    MonacoEditor.IStandaloneCodeEditor,
    FindHighlightEntry
  >()

  const applyFindHighlights = (entry: FindHighlightEntry, query: string) => {
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

  const clearFindHighlights = (entry: FindHighlightEntry) => {
    entry.model?.dispose()
    entry.model = null
  }

  const handleEditorLifecycle = (
    editor: MonacoEditor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      const controller = FindController.get(editor)
      if (!controller) return
      const entry = { editor, controller, model: null }
      findHighlightEntries.set(editor, entry)
      if (getIsFindOpen() && getQuery().length > 0) {
        applyFindHighlights(entry, getQuery())
      }
      return
    }

    const entry = findHighlightEntries.get(editor)
    if (!entry) return
    clearFindHighlights(entry)
    findHighlightEntries.delete(editor)
  }

  // Side effect: mirror the prompt folder find query into Monaco highlight decorations.
  $effect(() => {
    const query = getQuery()
    if (!getIsFindOpen() || query.length === 0) {
      findHighlightEntries.forEach(clearFindHighlights)
      return
    }

    findHighlightEntries.forEach((entry) => applyFindHighlights(entry, query))
  })

  return { handleEditorLifecycle }
}
