// src/renderer/src/common/Monaco.ts
import * as monaco from 'monaco-editor'

// Import Monaco's workers as *module workers* (bundled by Vite)
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const PROMPT_EDITOR_THEME_ID = 'cthulhu-prompt-dark'

// Tell Monaco how to spawn a worker for each language/feature
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
} as any

monaco.editor.defineTheme(PROMPT_EDITOR_THEME_ID, {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.foreground': '#D4D4D4',
    'editorLineNumber.foreground': '#D4D4D4',
    'editorActiveLineNumber.foreground': '#D4D4D4'
  }
})

// (Optionally) export monaco to reuse elsewhere
export const PROMPT_EDITOR_THEME = PROMPT_EDITOR_THEME_ID
export { monaco }
