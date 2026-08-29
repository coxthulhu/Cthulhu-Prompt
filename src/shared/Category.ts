import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { PromptFolder } from './PromptFolder'

/** Persisted category metadata owned by one root prompt or template folder. */
export type Category = {
  id: string
  displayName: string
  description: string | null
}

/** Payload used to rename one category. */
export type RenameCategoryPayload = {
  category: RevisionPayloadEntity<Category>
  displayName: string
}

/** Payload used to set or remove one category description. */
export type SetCategoryDescriptionPayload = {
  category: RevisionPayloadEntity<Category>
  description: string | null
}

/** Payload used to reorder one category within its owning root folder. */
export type MoveCategoryPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  categoryId: string
  previousCategoryId: string | null
}

/** Authoritative category snapshot returned by category updates. */
export type CategoryRevisionResponsePayload = {
  category: RevisionEnvelope<Category>
}

/** Trims a category display name before validation or persistence. */
export const normalizeCategoryDisplayName = (displayName: string): string => displayName.trim()

/** Reports a case-insensitive category-name conflict within one root folder. */
export const hasCategoryDisplayNameConflict = (
  categories: readonly Category[],
  displayName: string,
  excludedCategoryId: string | null = null
): boolean => {
  const normalizedName = normalizeCategoryDisplayName(displayName).toLocaleLowerCase()
  return categories.some(
    (category) =>
      category.id !== excludedCategoryId &&
      normalizeCategoryDisplayName(category.displayName).toLocaleLowerCase() === normalizedName
  )
}
