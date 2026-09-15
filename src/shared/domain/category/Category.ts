/** Persisted category metadata owned by one root prompt or template folder. */
export type Category = {
  id: string
  displayName: string
  /** Optional single-sentence summary stored beside the display name. */
  shortDescription: string | null
  description: string | null
}

/** Trims a category display name before validation or persistence. */
export const normalizeCategoryDisplayName = (displayName: string): string => displayName.trim()

/** Trims a category short description and represents empty text as absent. */
export const normalizeCategoryShortDescription = (
  shortDescription: string | null
): string | null => shortDescription?.trim() || null

/** Reports a case-insensitive category-name conflict within one root folder. */
export const hasCategoryDisplayNameConflict = (
  categories: readonly Pick<Category, 'id' | 'displayName'>[],
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
