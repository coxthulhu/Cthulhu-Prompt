import type { PromptFolderFindMatch } from './promptFolderFindTypes'

type PromptFolderFindShortcutHandlers = {
  getIsFindOpen: () => boolean
  getCurrentMatch: () => PromptFolderFindMatch | null
  getMatchText: () => string
  setMatchText: (value: string) => void
  getMatchTextForCurrentMatch: (match: PromptFolderFindMatch | null) => string | null
  openFindDialog: () => void
  closeFindDialog: () => void
}

export const registerPromptFolderFindShortcuts = ({
  getIsFindOpen,
  getCurrentMatch,
  getMatchText,
  setMatchText,
  getMatchTextForCurrentMatch,
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
      const currentMatch = getCurrentMatch()
      const nextMatchText = getMatchTextForCurrentMatch(currentMatch)
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
