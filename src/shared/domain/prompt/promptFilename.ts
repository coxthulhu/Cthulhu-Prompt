const MAX_PROMPT_FILENAME_TITLE_LENGTH = 64
const DEFAULT_PROMPT_FILENAME_TITLE = 'Prompt'
// Illegal filename characters for Windows files.
// eslint-disable-next-line no-control-regex
const ILLEGAL_WINDOWS_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

export const sanitizePromptTitleForFilename = (title: string): string => {
  const noIllegalChars = title.trim().replace(ILLEGAL_WINDOWS_FILENAME_CHARS, '')
  const noTrailingDotsOrSpaces = noIllegalChars.replace(/[. ]+$/g, '').trim()
  const normalizedTitle = noTrailingDotsOrSpaces || DEFAULT_PROMPT_FILENAME_TITLE
  return normalizedTitle.slice(0, MAX_PROMPT_FILENAME_TITLE_LENGTH)
}

/** Allocates and reserves a readable stem against complete case-insensitive filenames. */
export const allocateFilenameStem = (
  title: string,
  suffix: string,
  occupiedNames: Set<string>,
  currentFilename?: string
): string => {
  /** Sanitized title retained even when it already ends in a number. */
  const titleStem = sanitizePromptTitleForFilename(title)
  /** Lowest available suffix; zero represents the unnumbered filename. */
  let index = 0
  /** Candidate stem checked together with its complete file extension. */
  let stem = titleStem
  while (
    occupiedNames.has(`${stem}${suffix}`.toLowerCase()) &&
    `${stem}${suffix}`.toLowerCase() !== currentFilename?.toLowerCase()
  ) {
    index += 1
    stem = `${titleStem} ${index}`
  }
  occupiedNames.add(`${stem}${suffix}`.toLowerCase())
  return stem
}
