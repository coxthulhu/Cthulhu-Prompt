import { normalizeCategoryShortDescription, type Category } from '@shared/domain/category/Category'

/** Validates the exact JSON shape used by persisted category files. */
export const isCategory = (value: unknown): value is Category => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 4 &&
    typeof record.id === 'string' &&
    typeof record.displayName === 'string' &&
    (typeof record.shortDescription === 'string' || record.shortDescription === null) &&
    (typeof record.description === 'string' || record.description === null)
  )
}

/** Parses current category data into its normalized persisted shape. */
const parseCategoryValue = (value: unknown): Category | null => {
  if (!isCategory(value)) return null

  return {
    ...value,
    shortDescription: normalizeCategoryShortDescription(value.shortDescription)
  }
}

/** Parses one category JSON file and rejects malformed records. */
export const parseCategoryJson = (fileText: string): Category | null => {
  try {
    const parsed = JSON.parse(fileText) as unknown
    return parseCategoryValue(parsed)
  } catch {
    return null
  }
}
