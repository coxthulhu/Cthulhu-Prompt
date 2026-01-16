declare module 'monaco-editor/esm/vs/editor/contrib/find/browser/findController' {
  import type { editor } from 'monaco-editor'

  export class FindController {
    static get(editor: editor.IStandaloneCodeEditor): FindController | null
    getState(): {
      change: (
        newState: {
          searchString?: string
          isRegex?: boolean
          wholeWord?: boolean
          matchCase?: boolean
          preserveCase?: boolean
          searchScope?: unknown
          isRevealed?: boolean
        },
        moveCursor: boolean,
        updateHistory?: boolean
      ) => void
      matchesCount: number
    }
  }
}

declare module 'monaco-editor/esm/vs/editor/contrib/find/browser/findModel' {
  import type { editor } from 'monaco-editor'

  export class FindModelBoundToEditorModel {
    constructor(editor: editor.IStandaloneCodeEditor, state: unknown)
    dispose(): void
  }
}
