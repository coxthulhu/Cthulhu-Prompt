type PromptFolderFindShortcutHandlers = {
  getIsFindOpen: () => boolean
  openFindDialog: () => void
  closeFindDialog: () => void
}

export const registerPromptFolderFindShortcuts = ({
  getIsFindOpen,
  openFindDialog,
  closeFindDialog
}: PromptFolderFindShortcutHandlers) => {
  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!getIsFindOpen()) return
      event.preventDefault()
      event.stopPropagation()
      closeFindDialog()
      return
    }

    if (
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'f'
    ) {
      event.preventDefault()
      event.stopPropagation()
      openFindDialog()
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
  return () => {
    window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
  }
}
