import { monaco } from '@renderer/common/Monaco'

export type PromptFolderFindSearchModel = {
  countMatchesInText: (text: string, query: string) => number
  dispose: () => void
}

export const createPromptFolderFindSearchModel = (): PromptFolderFindSearchModel => {
  let searchModel: monaco.editor.ITextModel | null = null

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

  const dispose = () => {
    searchModel?.dispose()
    searchModel = null
  }

  return {
    countMatchesInText,
    dispose
  }
}
