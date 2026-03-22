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

export const buildPromptStem = (title: string, promptId: string): string => {
  const idPrefix = promptId.slice(0, 8)
  return `${sanitizePromptTitleForFilename(title)}-${idPrefix}`
}

export const resolveUniquePromptStem = (
  title: string,
  promptId: string,
  isStemTaken: (stem: string) => boolean
): string => {
  const baseStem = buildPromptStem(title, promptId)

  if (!isStemTaken(baseStem)) {
    return baseStem
  }

  let suffix = 2
  while (isStemTaken(`${baseStem}-${suffix}`)) {
    suffix += 1
  }

  return `${baseStem}-${suffix}`
}
