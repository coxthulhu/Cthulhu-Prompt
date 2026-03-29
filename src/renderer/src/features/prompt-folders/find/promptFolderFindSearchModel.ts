import { monaco } from '@renderer/common/Monaco'
import { EditorOptions } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/config/editorOptions'
import { WordOperations } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/cursor/cursorWordOperations'

export type PromptFolderFindSearchModel = {
  countMatchesInText: (text: string, query: string) => number
  getWordAtOffset: (
    text: string,
    offset: number
  ) => { word: string; start: number; end: number } | null
  dispose: () => void
}

export const createPromptFolderFindSearchModel = (): PromptFolderFindSearchModel => {
  let searchModel: monaco.editor.ITextModel | null = null
  const wordSeparators = EditorOptions.wordSeparators.defaultValue
  const wordSegmenterLocales = EditorOptions.wordSegmenterLocales.defaultValue

  const getSearchModel = () => {
    if (!searchModel) {
      searchModel = monaco.editor.createModel('', 'plaintext')
    }
    return searchModel
  }

  const countMatchesInText = (text: string, query: string): number => {
    if (query.length === 0) return 0
    const model = getSearchModel()
    model.setValue(text)
    return model.findMatches(query, false, false, false, null, false).length
  }

  const getWordAtOffset = (
    text: string,
    offset: number
  ): { word: string; start: number; end: number } | null => {
    if (text.length === 0) return null
    const model = getSearchModel()
    model.setValue(text)

    const clampedOffset = Math.min(Math.max(offset, 0), text.length)
    const position = model.getPositionAt(clampedOffset)
    const wordAtPosition = WordOperations.getWordAtPosition(
      model,
      wordSeparators,
      wordSegmenterLocales,
      position
    )
    if (!wordAtPosition) return null

    const start = model.getOffsetAt({
      lineNumber: position.lineNumber,
      column: wordAtPosition.startColumn
    })
    const end = model.getOffsetAt({
      lineNumber: position.lineNumber,
      column: wordAtPosition.endColumn
    })
    if (end <= start) return null

    return {
      word: wordAtPosition.word,
      start,
      end
    }
  }

  const dispose = () => {
    searchModel?.dispose()
    searchModel = null
  }

  return {
    countMatchesInText,
    getWordAtOffset,
    dispose
  }
}
