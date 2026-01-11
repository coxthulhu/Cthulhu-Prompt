// src/renderer/src/common/Monaco.ts
import * as monaco from 'monaco-editor'

// Import Monaco's workers as *module workers* (bundled by Vite)
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const PROMPT_EDITOR_THEME_ID = 'cthulhu-prompt-dark'
// Note: closeFindWidget stays enabled so Esc can still dismiss any stray widget.
const DISABLED_FIND_COMMANDS = [
  'actions.find',
  'actions.findWithSelection',
  'editor.actions.findWithArgs',
  'editor.action.startFindReplaceAction',
  'editor.action.nextMatchFindAction',
  'editor.action.previousMatchFindAction',
  'editor.action.goToMatchFindAction',
  'editor.action.nextSelectionMatchFindAction',
  'editor.action.previousSelectionMatchFindAction',
  'toggleFindCaseSensitive',
  'toggleFindWholeWord',
  'toggleFindRegex',
  'toggleFindInSelection',
  'togglePreserveCase',
  'editor.action.replaceOne',
  'editor.action.replaceAll',
  'editor.action.selectAllMatches'
] as const

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

// Disable Monaco's built-in find/replace widget so we can use our external dialog.
DISABLED_FIND_COMMANDS.forEach((id) => {
  monaco.editor.addCommand({ id, run: () => {} })
})
monaco.editor.addKeybindingRules([
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.KeyC, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.KeyW, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.KeyR, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.KeyL, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.KeyP, command: null },
  { keybinding: monaco.KeyCode.F3, command: null },
  { keybinding: monaco.KeyMod.Shift | monaco.KeyCode.F3, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.F3, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F3, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit1, command: null },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter, command: null },
  { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Enter, command: null }
])

// (Optionally) export monaco to reuse elsewhere
export const PROMPT_EDITOR_THEME = PROMPT_EDITOR_THEME_ID
export { monaco }
