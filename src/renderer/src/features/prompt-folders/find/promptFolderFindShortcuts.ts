import { registerKeyboardScope } from '@renderer/common/keyboardRouter'

/** Find state and actions supplied by the active prompt-folder screen. */
type PromptFolderFindShortcutHandlers = {
  getIsFindOpen: () => boolean
  openFindDialog: () => void
  closeFindDialog: () => void
}

/** Registers screen shortcuts that yield to open dialogs and dropdowns. */
export const registerPromptFolderFindShortcuts = ({
  getIsFindOpen,
  openFindDialog,
  closeFindDialog
}: PromptFolderFindShortcutHandlers) =>
  registerKeyboardScope({
    layer: 'screen',
    bindings: [
      {
        matches: (event) => event.key === 'Escape' && getIsFindOpen(),
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
