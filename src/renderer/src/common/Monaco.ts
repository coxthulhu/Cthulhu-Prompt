// src/renderer/src/common/Monaco.ts
import '@codingame/monaco-vscode-markdown-basics-default-extension'
import '@codingame/monaco-vscode-theme-defaults-default-extension'
import { initialize } from '@codingame/monaco-vscode-api'
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override'
import getTextMateServiceOverride from '@codingame/monaco-vscode-textmate-service-override'
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override'
import * as monaco from 'monaco-editor'

// Import Monaco workers as module workers (bundled by Vite).
import textMateWorker from '@codingame/monaco-vscode-textmate-service-override/worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

const PROMPT_EDITOR_THEME_ID = 'Default Dark Modern'
let monacoVscodeInitialization: Promise<void> | null = null
let monacoEditorOverridesRegistered = false
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

// Tell Monaco how to spawn a worker for each language/feature.
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    switch (label) {
      case 'TextMateWorker':
        return new textMateWorker()
      case 'editorWorkerService':
        return new editorWorker()
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

const registerMonacoEditorOverrides = (): void => {
  if (monacoEditorOverridesRegistered) return
  monacoEditorOverridesRegistered = true

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
    {
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit1,
      command: null
    },
    { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter, command: null },
    { keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Enter, command: null }
  ])
}

export const initializeMonacoVscodeApi = (): Promise<void> => {
  if (monacoVscodeInitialization == null) {
    monacoVscodeInitialization = initialize({
      ...getThemeServiceOverride(),
      ...getTextMateServiceOverride(),
      ...getLanguagesServiceOverride()
    })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : typeof error === 'string' ? error : ''
        if (message.includes('Services are already initialized')) return
        throw error
      })
      .then(() => {
        monaco.editor.setTheme(PROMPT_EDITOR_THEME_ID)
        registerMonacoEditorOverrides()
      })
  }

  return monacoVscodeInitialization
}

// (Optionally) export monaco to reuse elsewhere
export const PROMPT_EDITOR_THEME = PROMPT_EDITOR_THEME_ID

export const warmupMonacoEditor = (): void => {
  const warmupHost = document.createElement('div')
  warmupHost.style.position = 'fixed'
  warmupHost.style.left = '-10000px'
  warmupHost.style.top = '0'
  warmupHost.style.width = '1px'
  warmupHost.style.height = '1px'
  document.body.append(warmupHost)

  const warmupModel = monaco.editor.createModel('', 'markdown')
  const warmupEditor = monaco.editor.create(warmupHost, {
    model: warmupModel,
    language: 'markdown',
    theme: PROMPT_EDITOR_THEME_ID,
    minimap: { enabled: false },
    dimension: { width: 1, height: 1 }
  })

  warmupEditor.dispose()
  warmupModel.dispose()
  warmupHost.remove()
}

export { monaco }
