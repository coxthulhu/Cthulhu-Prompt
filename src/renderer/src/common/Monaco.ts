import * as monaco from 'monaco-editor'

const PROMPT_EDITOR_THEME_ID = 'Default Dark Modern'

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

// Side effect: apply the VS Code Dark Modern theme to all Monaco editors globally.
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
