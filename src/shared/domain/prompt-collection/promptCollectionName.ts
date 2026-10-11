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

const MAX_COLLECTION_NAME_LENGTH = 100

export const PROMPT_COLLECTION_NAME_CONFLICT_ERROR = 'A collection with this name already exists'

export type PromptCollectionNameCandidate = {
  id: string
  folderName: string
}

type CollectionNameValidation = { isValid: boolean; errorMessage?: string }

export const sanitizePromptCollectionName = (name: string): string => name.replace(/\s+/g, '')

type NormalizedPromptCollectionName = {
  displayName: string
  folderName: string
}

const normalizePromptCollectionDisplayName = (displayName: string): NormalizedPromptCollectionName => {
  const trimmedDisplayName = displayName.trim()
  return {
    displayName: trimmedDisplayName,
    folderName: sanitizePromptCollectionName(trimmedDisplayName)
  }
}

export const validatePromptCollectionName = (name: string): CollectionNameValidation => {
  if (!name.trim()) {
    return { isValid: false, errorMessage: 'Collection name cannot be empty' }
  }

  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Collection name must be ${MAX_COLLECTION_NAME_LENGTH} characters or less`
    }
  }

  if (ILLEGAL_PATH_CHARS.test(name)) {
    return {
      isValid: false,
      errorMessage: 'Collection name contains illegal characters: < > : " / \\ | ? *'
    }
  }

  const sanitizedName = sanitizePromptCollectionName(name)

  if (!sanitizedName) {
    return {
      isValid: false,
      errorMessage: 'Collection name must contain at least one non-whitespace character'
    }
  }

  if (RESERVED_NAMES.has(sanitizedName.toUpperCase())) {
    return { isValid: false, errorMessage: 'This is a reserved system name and cannot be used' }
  }

  if (name.startsWith('.') || name.endsWith('.')) {
    return { isValid: false, errorMessage: 'Collection name cannot start or end with dots' }
  }

  return { isValid: true }
}

type PreparedPromptCollectionName = NormalizedPromptCollectionName & {
  validation: CollectionNameValidation
}

export const preparePromptCollectionName = (displayName: string): PreparedPromptCollectionName => {
  const validation = validatePromptCollectionName(displayName)
  const normalized = normalizePromptCollectionDisplayName(displayName)
  return {
    ...normalized,
    validation
  }
}

export const hasPromptCollectionNameConflict = (
  promptCollections: readonly PromptCollectionNameCandidate[],
  folderName: string,
  excludedPromptCollectionId: string | null = null
): boolean => {
  const normalizedTargetName = folderName.toLowerCase()

  return promptCollections.some(
    (collection) =>
      collection.id !== excludedPromptCollectionId &&
      collection.folderName.toLowerCase() === normalizedTargetName
  )
}
