import type { DomainEntityMap } from '@shared/DomainChanges'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import type { CategoryPersistenceFields } from './CategoryPersistence'
import {
  buildDomainPersistenceKey,
  type DomainPersistencePlanningContext
} from './DomainPersistencePlanning'

/** Replans surviving category filenames after category domain deletions. */
export const planCategoryPersistenceChanges = (
  context: DomainPersistencePlanningContext
): void => {
  /** Deleted categories whose former roots may have removable filename suffixes. */
  const deletedCategoryIds = context.changes.flatMap((change) =>
    change.type === 'delete' && change.entityType === 'category' ? [change.id] : []
  )

  for (const deletedCategoryId of deletedCategoryIds) {
    /** Deleted category metadata identifying its owning root. */
    const deletedCategory = context.getCommittedEntry('category', deletedCategoryId)
    if (!deletedCategory) continue
    /** Persistence fields for the category being removed. */
    const deletedFields = deletedCategory.persistenceFields as CategoryPersistenceFields
    /** Projected owning folder after category-order deletion. */
    const projectedFolder = context.getProjectedOrCommittedData(
      'promptFolder',
      deletedFields.rootPromptFolderId
    )
    if (!projectedFolder) continue
    /** Surviving categories and filename state owned by the projected root. */
    const categories = projectedFolder.categoryOrder.categories.flatMap((group) => {
      if (group.categoryId === null) return []
      /** Loaded surviving category entry. */
      const entry = context.getCommittedEntry('category', group.categoryId)
      return entry
        ? [
            {
              id: group.categoryId,
              data: entry.committed as DomainEntityMap['category'],
              fields: entry.persistenceFields as CategoryPersistenceFields
            }
          ]
        : []
    })
    /** Case-insensitive sanitized filename-boundary counts for surviving categories. */
    const boundaryCounts = new Map<string, number>()
    for (const category of categories) {
      /** Filename collision boundary for one surviving category. */
      const boundary = sanitizePromptTitleForFilename(
        category.data.displayName
      ).toLocaleLowerCase()
      boundaryCounts.set(boundary, (boundaryCounts.get(boundary) ?? 0) + 1)
    }

    for (const category of categories) {
      /** Collision boundary used to select the surviving filename suffix policy. */
      const boundary = sanitizePromptTitleForFilename(
        category.data.displayName
      ).toLocaleLowerCase()
      /** Planned category persistence fields after deleting its duplicate-named sibling. */
      const fields = {
        ...category.fields,
        needsFilenameIdSuffix: (boundaryCounts.get(boundary) ?? 0) > 1
      }
      /** Expected stem produced by the category persistence layer. */
      const expectedStem = buildPromptStem(
        category.data.displayName,
        category.id,
        fields.needsFilenameIdSuffix
      )
      if (
        expectedStem === category.fields.categoryStem &&
        fields.needsFilenameIdSuffix === category.fields.needsFilenameIdSuffix
      ) {
        continue
      }
      context.persistenceChanges.set(buildDomainPersistenceKey('category', category.id), {
        type: 'upsert',
        entityType: 'category',
        id: category.id,
        data: category.data,
        persistenceFields: fields
      })
    }
  }
}
