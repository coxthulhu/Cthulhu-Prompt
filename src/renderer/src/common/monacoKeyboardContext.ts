import { getService, ICodeEditorService, IContextKeyService } from '@codingame/monaco-vscode-api'

/** Shared services are resolved before rendering so capture-phase shortcuts stay synchronous. */
let keyboardServices: {
  codeEditorService: ICodeEditorService
  contextKeyService: IContextKeyService
} | null = null

export const initializeMonacoKeyboardContext = async (): Promise<void> => {
  const [codeEditorService, contextKeyService] = await Promise.all([
    getService(ICodeEditorService),
    getService(IContextKeyService)
  ])
  keyboardServices = { codeEditorService, contextKeyService }
}

/** Lets Monaco dismiss its active interaction before an application-level Escape action. */
export const shouldMonacoHandleEscape = (event: KeyboardEvent): boolean => {
  // These native dismissal commands accept Escape and Shift+Escape, without other modifiers.
  if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey) return false

  const editor = keyboardServices?.codeEditorService.getFocusedCodeEditor()
  const editorNode = editor?.getDomNode()
  if (!keyboardServices || !editorNode) return false

  // Portalled widgets lack the editor's DOM context, but Monaco tracks their owning editor's focus.
  const context = keyboardServices.contextKeyService.getContext(editorNode)
  const hasContext = (key: string): boolean => context.getValue<boolean>(key) === true

  // Match native focus conditions; a selection alone must not prevent application dismissal.
  return (
    (hasContext('textInputFocus') &&
      (hasContext('suggestWidgetVisible') || hasContext('inSnippetMode'))) ||
    (hasContext('editorFocus') &&
      (hasContext('parameterHintsVisible') || hasContext('renameInputVisible')))
  )
}
