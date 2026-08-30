/** Persisted category metadata owned by one root prompt or template folder. */
export type Category = {
  id: string
  displayName: string
  description: string | null
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
