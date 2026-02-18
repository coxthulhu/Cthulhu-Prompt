// src/renderer/src/common/Monaco.ts
import * as monaco from 'monaco-editor'
import darkModernRaw from './monacoThemes/dark_modern.json?raw'
import darkPlusRaw from './monacoThemes/dark_plus.json?raw'

// Import Monaco's workers as *module workers* (bundled by Vite)
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const PROMPT_EDITOR_THEME_ID = 'cthulhu-prompt-dark'

type VSCodeTokenColor = {
  scope?: string | string[]
  settings?: { foreground?: string; background?: string; fontStyle?: string }
}

type VSCodeTheme = {
  colors?: Record<string, string>
  tokenColors?: VSCodeTokenColor[]
}

const stripJsonComments = (raw: string): string => {
  let output = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    const next = raw[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        output += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (!inString && char === '/' && next === '/') {
      inLineComment = true
      i += 1
      continue
    }

    if (!inString && char === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }

    if (char === '"') {
      let backslashes = 0
      for (let j = i - 1; j >= 0 && raw[j] === '\\'; j -= 1) {
        backslashes += 1
      }
      if (backslashes % 2 === 0) {
        inString = !inString
      }
    }

    output += char
  }

  return output
}

const parseThemeJson = (raw: string): VSCodeTheme => {
  const withoutComments = stripJsonComments(raw)
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(withoutTrailingCommas) as VSCodeTheme
}

const normalizeTokenColor = (value?: string): string | undefined =>
  value ? value.replace(/^#/, '') : undefined

const toMonacoRules = (tokenColors: VSCodeTokenColor[]): monaco.editor.ITokenThemeRule[] =>
  tokenColors.flatMap((entry) => {
    const scopes = entry.scope ? (Array.isArray(entry.scope) ? entry.scope : [entry.scope]) : []
    const settings = entry.settings ?? {}
    const ruleBase = {
      foreground: normalizeTokenColor(settings.foreground),
      background: normalizeTokenColor(settings.background),
      fontStyle: settings.fontStyle
    }

    return scopes.map((token) => ({ token, ...ruleBase }))
  })
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

const darkModernTheme = parseThemeJson(darkModernRaw)
const darkPlusTheme = parseThemeJson(darkPlusRaw)

monaco.editor.defineTheme(PROMPT_EDITOR_THEME_ID, {
  base: 'vs-dark',
  inherit: true,
  rules: toMonacoRules(darkPlusTheme.tokenColors ?? []),
  colors: {
    ...(darkPlusTheme.colors ?? {}),
    ...(darkModernTheme.colors ?? {})
  }
})

// Side effect: apply the Dark Modern theme to all Monaco editors globally.
monaco.editor.setTheme(PROMPT_EDITOR_THEME_ID)

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
