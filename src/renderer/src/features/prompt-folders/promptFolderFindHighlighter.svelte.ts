import type { editor as MonacoEditor } from 'monaco-editor'
import {
  registerPromptFolderFindEditor,
  unregisterPromptFolderFindEditor,
  updatePromptFolderFindHighlights
} from '@renderer/data/PromptFolderFindEditorRegistry.svelte.ts'

type FindHighlighterInput = {
  getIsFindOpen: () => boolean
  getQuery: () => string
}

export const createPromptFolderFindHighlighter = ({
  getIsFindOpen,
  getQuery
}: FindHighlighterInput) => {
  const handleEditorLifecycle = (
    promptId: string,
    editor: MonacoEditor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      registerPromptFolderFindEditor(promptId, editor)
      updatePromptFolderFindHighlights(getQuery(), getIsFindOpen())
      return
    }

    unregisterPromptFolderFindEditor(editor)
  }

  // Side effect: mirror the prompt folder find query into Monaco highlight decorations.
  $effect(() => {
    updatePromptFolderFindHighlights(getQuery(), getIsFindOpen())
  })

  return { handleEditorLifecycle }
}
