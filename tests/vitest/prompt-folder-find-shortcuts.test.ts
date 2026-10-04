import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
import { initializeMonacoKeyboardContext } from '@renderer/common/monacoKeyboardContext'
import { registerPromptFolderFindShortcuts } from '@renderer/features/prompt-folders/find/promptFolderFindShortcuts'

const services = vi.hoisted(() => ({
  editors: { getFocusedCodeEditor: vi.fn() },
  contexts: { getContext: vi.fn() }
}))

vi.mock('@codingame/monaco-vscode-api', () => ({
  ICodeEditorService: 'editors',
  IContextKeyService: 'contexts',
  getService: async (id: keyof typeof services) => services[id]
}))

describe('folder Find Escape routing', () => {
  const editorNode = { id: 'editor' }
  const closeFind = vi.fn()
  const cleanup: Array<() => void> = []
  let routeKeydown: (event: KeyboardEvent) => void
  let contextValues: Record<string, boolean>
  let isFindOpen: boolean

  const escapeEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent => ({
    key: 'Escape',
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    ...overrides
  }) as KeyboardEvent

  beforeEach(async () => {
    vi.clearAllMocks()
    contextValues = { editorFocus: true, textInputFocus: true }
    isFindOpen = true
    services.editors.getFocusedCodeEditor.mockReturnValue({ getDomNode: () => editorNode })
    services.contexts.getContext.mockImplementation(() => ({
      getValue: (key: string) => contextValues[key]
    }))
    vi.stubGlobal('window', {
      addEventListener: (_name: string, listener: typeof routeKeydown) => {
        routeKeydown = listener
      },
      removeEventListener: vi.fn()
    })
    await initializeMonacoKeyboardContext()
    cleanup.push(registerPromptFolderFindShortcuts({
      getIsFindOpen: () => isFindOpen,
      openFindDialog: vi.fn(),
      closeFindDialog: closeFind,
      navigateFind: vi.fn()
    }))
  })

  afterEach(() => {
    for (const dispose of cleanup.splice(0).reverse()) dispose()
    vi.unstubAllGlobals()
  })

  it('reads the owning editor rather than a portalled event target, then sees dismissal immediately', () => {
    contextValues.suggestWidgetVisible = true
    const popupEvent = escapeEvent({ target: { id: 'overflow-widget' } as unknown as EventTarget })
    routeKeydown(popupEvent)
    expect(services.contexts.getContext).toHaveBeenCalledWith(editorNode)
    expect(popupEvent.preventDefault).not.toHaveBeenCalled()
    expect(popupEvent.stopImmediatePropagation).not.toHaveBeenCalled()
    expect(closeFind).not.toHaveBeenCalled()

    contextValues.suggestWidgetVisible = false
    const nextEvent = escapeEvent()
    routeKeydown(nextEvent)
    expect(nextEvent.preventDefault).toHaveBeenCalledOnce()
    expect(nextEvent.stopImmediatePropagation).toHaveBeenCalledOnce()
    expect(closeFind).toHaveBeenCalledOnce()
  })

  it.each([
    ['suggestWidgetVisible', 'textInputFocus'],
    ['inSnippetMode', 'textInputFocus'],
    ['parameterHintsVisible', 'editorFocus'],
    ['renameInputVisible', 'editorFocus']
  ])('yields Shift+Escape to %s only while its required focus is active', (key, focusKey) => {
    contextValues = { [key]: true, [focusKey]: true }
    routeKeydown(escapeEvent({ shiftKey: true }))
    expect(closeFind).not.toHaveBeenCalled()

    contextValues[focusKey] = false
    routeKeydown(escapeEvent({ shiftKey: true }))
    expect(closeFind).toHaveBeenCalledOnce()
  })

  it('closes Find from its input even if an unfocused editor retains popup state', () => {
    contextValues.suggestWidgetVisible = true
    services.editors.getFocusedCodeEditor.mockReturnValue(null)
    routeKeydown(escapeEvent())
    expect(services.contexts.getContext).not.toHaveBeenCalled()
    expect(closeFind).toHaveBeenCalledOnce()
  })

  it('consumes Escape before selection cancellation, then leaves Monaco alone after Find closes', () => {
    contextValues.editorHasSelection = true
    contextValues.editorHasMultipleSelections = true
    const openEvent = escapeEvent()
    routeKeydown(openEvent)
    expect(openEvent.stopImmediatePropagation).toHaveBeenCalledOnce()
    expect(closeFind).toHaveBeenCalledOnce()

    isFindOpen = false
    const closedEvent = escapeEvent()
    routeKeydown(closedEvent)
    expect(closedEvent.preventDefault).not.toHaveBeenCalled()
    expect(closeFind).toHaveBeenCalledOnce()
  })

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)(
    'does not yield %s+Escape to popup commands that do not bind it',
    (modifier) => {
      contextValues.suggestWidgetVisible = true
      routeKeydown(escapeEvent({ [modifier]: true }))
      expect(closeFind).toHaveBeenCalledOnce()
    }
  )

  it('keeps foreground dialog dismissal ahead of Find and Monaco', () => {
    const closeDialog = vi.fn()
    cleanup.push(registerKeyboardScope({
      layer: 'dialog',
      bindings: [{ matches: (event) => event.key === 'Escape', run: closeDialog }]
    }))
    contextValues.suggestWidgetVisible = true
    routeKeydown(escapeEvent())
    expect(closeDialog).toHaveBeenCalledOnce()
    expect(closeFind).not.toHaveBeenCalled()
    expect(services.editors.getFocusedCodeEditor).not.toHaveBeenCalled()
  })
})
