type PromptFolderFindShortcutHandlers = {
  getIsFindOpen: () => boolean
  getMatchText: () => string
  setMatchText: (value: string) => void
  getSelectionMatchText: () => string | null
  openFindDialog: () => void
  closeFindDialog: () => void
}

export const registerPromptFolderFindShortcuts = ({
  getIsFindOpen,
  getMatchText,
  setMatchText,
  getSelectionMatchText,
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
      const nextMatchText = getSelectionMatchText()
      if (nextMatchText && nextMatchText !== getMatchText()) {
        setMatchText(nextMatchText)
      }
      openFindDialog()
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
  return () => {
    window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
  }
}
