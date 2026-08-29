import { ipcMain } from 'electron'
import {
  hasCategoryDisplayNameConflict,
  normalizeCategoryDisplayName,
  type Category,
  type CategoryRevisionResponsePayload,
  type CreateCategoryResponsePayload
} from '@shared/Category'
import { planDeleteCategoryDomainMutation } from '@shared/DomainMutations'
import {
  getCategoryOrderCategoryIds,
  insertCategoryOrderGroup,
  moveCategoryOrderGroup
} from '@shared/PromptFolder'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import type { AtomicDataBuilder } from '../Data/AtomicDataTransaction'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import {
  buildCategorySnapshot,
  buildPromptFolderSnapshot,
  getLoadedCategoryEntries
} from '../Data/DataSnapshotHelpers'
import {
  parseCreateCategoryRequest,
  parseDeleteCategoryDomainMutationRequest,
  parseMoveCategoryRequest,
  parseRenameCategoryRequest,
  parseSetCategoryDescriptionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import type { CategoryPersistenceFields } from '../Persistence/CategoryPersistence'
import { handleMainDomainMutation } from './DomainMutation'

/** Planned category data and filename state for one root-owned category. */
type CategoryFilenamePlan = {
  categoryId: string
  category: Category
  persistenceFields: CategoryPersistenceFields
}

/** Returns all loaded categories owned by one root folder. */
const getRootCategories = (categoryIds: string[]): Category[] =>
  getLoadedCategoryEntries(categoryIds).map((entry) => entry.committed)

/** Plans prompt-style filename suffixes for an entire root category set. */
const planCategoryFilenames = (
  categoryIds: string[],
  overrides: Map<string, Omit<CategoryFilenamePlan, 'categoryId'>> = new Map()
): CategoryFilenamePlan[] => {
  const plans = categoryIds.flatMap((categoryId) => {
    const override = overrides.get(categoryId)
    if (override) return [{ categoryId, ...override }]
    const entry = data.category.committedStore.getEntry(categoryId)
    return entry
      ? [{ categoryId, category: entry.committed, persistenceFields: entry.persistenceFields }]
      : []
  })
  const boundaryCounts = new Map<string, number>()
  for (const plan of plans) {
    const boundary = sanitizePromptTitleForFilename(plan.category.displayName).toLocaleLowerCase()
    boundaryCounts.set(boundary, (boundaryCounts.get(boundary) ?? 0) + 1)
  }
  return plans.map((plan) => {
    const boundary = sanitizePromptTitleForFilename(plan.category.displayName).toLocaleLowerCase()
    return {
      ...plan,
      persistenceFields: {
        ...plan.persistenceFields,
        needsFilenameIdSuffix: (boundaryCounts.get(boundary) ?? 0) > 1
      }
    }
  })
}

/** Adds no-op category writes needed to apply planned filename changes. */
const createCategoryFilenameUpdateHandles = (
  tx: AtomicDataBuilder,
  plans: CategoryFilenamePlan[],
  excludedCategoryIds: Set<string>
): Record<string, ReturnType<typeof tx.category.update>> =>
  Object.fromEntries(
    plans.flatMap((plan) => {
      if (excludedCategoryIds.has(plan.categoryId)) return []
      const entry = data.category.committedStore.getEntry(plan.categoryId)
      const expectedStem = buildPromptStem(
        plan.category.displayName,
        plan.categoryId,
        plan.persistenceFields.needsFilenameIdSuffix
      )
      if (
        entry?.persistenceFields.categoryStem === expectedStem &&
        entry.persistenceFields.needsFilenameIdSuffix ===
          plan.persistenceFields.needsFilenameIdSuffix
      ) {
        return []
      }
      return [
        [
          `categoryFilename:${plan.categoryId}`,
          tx.category.updatePersistenceFields({
            id: plan.categoryId,
            persistenceFields: plan.persistenceFields
          })
        ]
      ]
    })
  )

/** Registers create, rename, description, and deletion category mutation channels. */
export const setupCategoryMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: {
      channel: 'delete-category',
      parseRequest: parseDeleteCategoryDomainMutationRequest
    },
    mutation: planDeleteCategoryDomainMutation
  })

  ipcMain.handle('create-category', async (_, request: unknown) => {
    return await runMutationIpcRequest(request, parseCreateCategoryRequest, async (validated) => {
      try {
        const requestedFolder = validated.payload.promptFolder
        const requestedCategory = validated.payload.category
        const folder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        if (!folder || /[\\/]/.test(folder.persistenceFields.folderPath)) {
          return { success: false, error: 'Root prompt folder not loaded' }
        }
        const displayName = normalizeCategoryDisplayName(requestedCategory.data.displayName)
        const categories = getRootCategories(
          getCategoryOrderCategoryIds(folder.committed.categoryOrder)
        )
        if (!displayName) return { success: false, error: 'Category name is required' }
        if (hasCategoryDisplayNameConflict(categories, displayName)) {
          return { success: false, error: 'Category name already exists' }
        }
        if (data.category.committedStore.getEntry(requestedCategory.id)) {
          return { success: false, error: 'Category already exists' }
        }

        const category: Category = {
          id: requestedCategory.id,
          displayName,
          description: null
        }
        const persistenceFields: CategoryPersistenceFields = {
          workspaceId: folder.persistenceFields.workspaceId,
          workspacePath: folder.persistenceFields.workspacePath,
          rootPromptFolderId: folder.committed.id,
          rootFolderName: folder.persistenceFields.folderPath,
          kind: folder.committed.kind,
          categoryStem: requestedCategory.id,
          needsFilenameIdSuffix: false
        }
        /** Category IDs after inserting the new group at index 1. */
        const nextCategoryIds = [
          category.id,
          ...getCategoryOrderCategoryIds(folder.committed.categoryOrder)
        ]
        const filenamePlans = planCategoryFilenames(
          nextCategoryIds,
          new Map([[category.id, { category, persistenceFields }]])
        )
        const categoryPlan = filenamePlans.find((plan) => plan.categoryId === category.id)!
        const outcome = await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: folder.committed.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.categoryOrder = insertCategoryOrderGroup(draft.categoryOrder, category.id)
            }
          }),
          category: tx.category.create({
            id: category.id,
            data: category,
            persistenceFields: categoryPlan.persistenceFields
          }),
          ...createCategoryFilenameUpdateHandles(tx, filenamePlans, new Set([category.id]))
        }))
        if (outcome.status === 'conflict') {
          const latestFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
          if (!latestFolder) return { success: false, error: 'Prompt folder not loaded' }
          return {
            success: false,
            conflict: true,
            payload: { promptFolder: buildPromptFolderSnapshot(latestFolder) }
          }
        }
        const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        const createdCategory = data.category.committedStore.getEntry(category.id)
        if (!updatedFolder || !createdCategory) {
          return { success: false, error: 'Category create commit did not complete' }
        }
        return {
          success: true,
          payload: {
            promptFolder: buildPromptFolderSnapshot(updatedFolder),
            category: buildCategorySnapshot(createdCategory)
          } satisfies CreateCategoryResponsePayload
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })

  ipcMain.handle('rename-category', async (_, request: unknown) => {
    return await runMutationIpcRequest(request, parseRenameCategoryRequest, async (validated) => {
      try {
        const requestedCategory = validated.payload.category
        const categoryEntry = data.category.committedStore.getEntry(requestedCategory.id)
        if (!categoryEntry) return { success: false, error: 'Category not loaded' }
        const rootFolder = data.promptFolder.committedStore.getEntry(
          categoryEntry.persistenceFields.rootPromptFolderId
        )
        if (!rootFolder) return { success: false, error: 'Root prompt folder not loaded' }
        const displayName = normalizeCategoryDisplayName(validated.payload.displayName)
        const categories = getRootCategories(
          getCategoryOrderCategoryIds(rootFolder.committed.categoryOrder)
        )
        if (!displayName) return { success: false, error: 'Category name is required' }
        if (hasCategoryDisplayNameConflict(categories, displayName, requestedCategory.id)) {
          return { success: false, error: 'Category name already exists' }
        }
        const renamedCategory = { ...categoryEntry.committed, displayName }
        const filenamePlans = planCategoryFilenames(
          getCategoryOrderCategoryIds(rootFolder.committed.categoryOrder),
          new Map([
            [
              requestedCategory.id,
              { category: renamedCategory, persistenceFields: categoryEntry.persistenceFields }
            ]
          ])
        )
        const renamedPlan = filenamePlans.find(
          (plan) => plan.categoryId === requestedCategory.id
        )!
        const outcome = await runAtomicDataTransaction((tx) => ({
          category: tx.category.update({
            id: requestedCategory.id,
            expectedRevision: requestedCategory.expectedRevision,
            recipe: (draft) => {
              draft.displayName = displayName
            },
            persistenceFields: renamedPlan.persistenceFields
          }),
          ...createCategoryFilenameUpdateHandles(
            tx,
            filenamePlans,
            new Set([requestedCategory.id])
          )
        }))
        const latestCategory = data.category.committedStore.getEntry(requestedCategory.id)
        if (!latestCategory) return { success: false, error: 'Category not loaded' }
        const payload: CategoryRevisionResponsePayload = {
          category: buildCategorySnapshot(latestCategory)
        }
        return outcome.status === 'conflict'
          ? { success: false, conflict: true, payload }
          : { success: true, payload }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })

  ipcMain.handle('set-category-description', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseSetCategoryDescriptionRequest,
      async (validated) => {
        try {
          const requestedCategory = validated.payload.category
          const categoryEntry = data.category.committedStore.getEntry(requestedCategory.id)
          if (!categoryEntry) return { success: false, error: 'Category not loaded' }
          const outcome = await runAtomicDataTransaction((tx) => ({
            category: tx.category.update({
              id: requestedCategory.id,
              expectedRevision: requestedCategory.expectedRevision,
              recipe: (draft) => {
                draft.description = validated.payload.description
              }
            })
          }))
          const latestCategory = data.category.committedStore.getEntry(requestedCategory.id)
          if (!latestCategory) return { success: false, error: 'Category not loaded' }
          const payload: CategoryRevisionResponsePayload = {
            category: buildCategorySnapshot(latestCategory)
          }
          return outcome.status === 'conflict'
            ? { success: false, conflict: true, payload }
            : { success: true, payload }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })

  ipcMain.handle('move-category', async (_, request: unknown) => {
    return await runMutationIpcRequest(request, parseMoveCategoryRequest, async (validated) => {
      try {
        /** Revision-bearing root folder whose category order changes. */
        const requestedFolder = validated.payload.promptFolder
        /** Authoritative root folder selected for category reordering. */
        const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        if (!promptFolder) return { success: false, error: 'Root prompt folder not loaded' }
        /** Atomic category-group reorder result. */
        const outcome = await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.categoryOrder = moveCategoryOrderGroup(
                draft.categoryOrder,
                validated.payload.categoryId,
                validated.payload.previousCategoryId
              )
            }
          })
        }))
        /** Latest authoritative folder returned for success or conflict. */
        const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        if (!updatedFolder) return { success: false, error: 'Root prompt folder not loaded' }
        const payload = { promptFolder: buildPromptFolderSnapshot(updatedFolder) }
        return outcome.status === 'conflict'
          ? { success: false, conflict: true, payload }
          : { success: true, payload }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })
}
