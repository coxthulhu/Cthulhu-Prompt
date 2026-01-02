// Illegal characters for filesystem paths across Windows, macOS, and Linux
// eslint-disable-next-line no-control-regex
const ILLEGAL_PATH_CHARS = /[<>:"/\\|?*\x00-\x1f]/
const RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

const MAX_FOLDER_NAME_LENGTH = 100

export type FolderNameValidation = { isValid: boolean; errorMessage?: string }

export const sanitizePromptFolderName = (name: string): string => name.replace(/\s+/g, '')

export const validatePromptFolderName = (name: string): FolderNameValidation => {
  if (!name.trim()) {
    return { isValid: false, errorMessage: 'Folder name cannot be empty' }
  }

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or less`
    }
  }

  if (ILLEGAL_PATH_CHARS.test(name)) {
    return {
      isValid: false,
      errorMessage: 'Folder name contains illegal characters: < > : " / \\ | ? *'
    }
  }

  const sanitizedName = sanitizePromptFolderName(name)

  if (!sanitizedName) {
    return {
      isValid: false,
      errorMessage: 'Folder name must contain at least one non-whitespace character'
    }
  }

  if (RESERVED_NAMES.has(sanitizedName.toUpperCase())) {
    return { isValid: false, errorMessage: 'This is a reserved system name and cannot be used' }
  }

  if (name.startsWith('.') || name.endsWith('.')) {
    return { isValid: false, errorMessage: 'Folder name cannot start or end with dots' }
  }

  return { isValid: true }
}
