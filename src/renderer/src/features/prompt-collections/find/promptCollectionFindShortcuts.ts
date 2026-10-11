import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
import { shouldMonacoHandleEscape } from '@renderer/common/monacoKeyboardContext'

/** Find state and actions supplied by the active prompt-collection screen. */
type PromptCollectionFindShortcutHandlers = {
  getIsFindOpen: () => boolean
  openFindDialog: () => void
  closeFindDialog: () => void
  /** Navigates collection results without letting Monaco open its own find widget. */
  navigateFind: (event: KeyboardEvent) => void
}

/** Registers screen shortcuts that yield to open dialogs and dropdowns. */
export const registerPromptCollectionFindShortcuts = ({
  getIsFindOpen,
  openFindDialog,
  closeFindDialog,
  navigateFind
}: PromptCollectionFindShortcutHandlers) =>
  registerKeyboardScope({
    layer: 'screen',
    bindings: [
      {
        matches: (event) =>
          event.key === 'F3' && !event.ctrlKey && !event.altKey && !event.metaKey,
        run: navigateFind
      },
      {
        matches: (event) =>
          event.key === 'Escape' && getIsFindOpen() && !shouldMonacoHandleEscape(event),
        run: closeFindDialog
      },
      {
        matches: (event) =>
          event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'f',
        run: openFindDialog
      }
    ]
  })
