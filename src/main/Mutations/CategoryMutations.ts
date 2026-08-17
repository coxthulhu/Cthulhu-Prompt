import { ipcMain } from 'electron'
import {
  hasCategoryDisplayNameConflict,
  normalizeCategoryDisplayName,
  type Category,
  type CategoryRevisionResponsePayload,
  type CreateCategoryResponsePayload,
  type DeleteCategoryResponsePayload
} from '@shared/Category'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  deleteCategoryOrderGroup,
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
  buildPromptSnapshot,
  buildPromptTemplateSnapshot,
  getLoadedCategoryEntries
} from '../Data/DataSnapshotHelpers'
import {
  parseCreateCategoryRequest,
  parseDeleteCategoryRequest,
  parseMoveCategoryRequest,
  parseRenameCategoryRequest,
  parseSetCategoryDescriptionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import type { CategoryPersistenceFields } from '../Persistence/CategoryPersistence'
import { collectPromptFolderContentIds } from './PromptFolderContentMutations'
import { collectWorkspacePromptFolders } from './PromptFolderPathHelpers'

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
          tx.category.update({
            id: plan.categoryId,
            recipe: () => {},
            persistenceFields: plan.persistenceFields
          })
        ]
      ]
    })
  )

/** Builds the authoritative graph affected by one category deletion attempt. */
const buildDeleteCategoryResponsePayload = (
  rootPromptFolderId: string,
  categoryId: string,
  promptIds: string[],
  promptTemplateIds: string[]
): DeleteCategoryResponsePayload | null => {
  /** Latest owning root snapshot source. */
  const promptFolder = data.promptFolder.committedStore.getEntry(rootPromptFolderId)
  if (!promptFolder) return null

  /** Latest category snapshot source, absent after successful deletion. */
  const category = data.category.committedStore.getEntry(categoryId)
  return {
    promptFolder: buildPromptFolderSnapshot(promptFolder),
    ...(category ? { category: buildCategorySnapshot(category) } : {}),
    prompts: promptIds.flatMap((promptId) => {
      /** Latest affected prompt snapshot source. */
      const prompt = data.prompt.committedStore.getEntry(promptId)
      return prompt ? [buildPromptSnapshot(prompt)] : []
    }),
    promptTemplates: promptTemplateIds.flatMap((promptTemplateId) => {
      /** Latest affected template snapshot source. */
      const promptTemplate = data.promptTemplate.committedStore.getEntry(promptTemplateId)
      return promptTemplate ? [buildPromptTemplateSnapshot(promptTemplate)] : []
    })
  }
}

/** Registers create, rename, description, and deletion category mutation channels. */
export const setupCategoryMutationHandlers = (): void => {
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

  ipcMain.handle('delete-category', async (_, request: unknown) => {
    return await runMutationIpcRequest(request, parseDeleteCategoryRequest, async (validated) => {
      try {
        /** Revision-bearing category requested for deletion. */
        const requestedCategory = validated.payload.category
        /** Revision-bearing root folder that owns the category. */
        const requestedFolder = validated.payload.promptFolder
        /** Current category record and persistence ownership. */
        const category = data.category.committedStore.getEntry(requestedCategory.id)
        /** Current owning root folder record. */
        const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        if (
          !category ||
          !promptFolder ||
          category.persistenceFields.rootPromptFolderId !== requestedFolder.id ||
          !getCategoryOrderCategoryIds(promptFolder.committed.categoryOrder).includes(
            requestedCategory.id
          )
        ) {
          return { success: false, error: 'Category ownership not loaded' }
        }

        /** Workspace whose loaded content is scanned for every matching reference. */
        const workspace = data.workspace.committedStore.getEntry(
          category.persistenceFields.workspaceId
        )
        if (!workspace) return { success: false, error: 'Workspace not loaded' }

        /** All loaded prompt and template IDs in the active workspace. */
        const workspaceContentIds = collectPromptFolderContentIds(
          collectWorkspacePromptFolders(workspace.committed).map((folder) => folder.id)
        )
        /** Prompt IDs whose category reference must be cleared. */
        const promptIds = workspaceContentIds.prompt.filter(
          (promptId) =>
            data.prompt.committedStore.getEntry(promptId)?.committed.category ===
            requestedCategory.id
        )
        /** Template IDs whose category reference must be cleared. */
        const promptTemplateIds = workspaceContentIds.template.filter(
          (promptTemplateId) =>
            data.promptTemplate.committedStore.getEntry(promptTemplateId)?.committed.category ===
            requestedCategory.id
        )
        /** One logical optimistic timestamp shared by every cleared reference. */
        const modifiedAt = getCurrentIsoSecondTimestamp()
        /** Atomic category, ownership, and referencing-content persistence outcome. */
        const outcome = await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.categoryOrder = deleteCategoryOrderGroup(
                draft.categoryOrder,
                requestedCategory.id
              )
            }
          }),
          category: tx.category.delete({
            id: requestedCategory.id,
            expectedRevision: requestedCategory.expectedRevision
          }),
          ...Object.fromEntries(
            promptIds.map((promptId) => [
              `prompt:${promptId}`,
              tx.prompt.update({
                id: promptId,
                recipe: (draft) => {
                  delete draft.category
                  draft.modifiedAt = modifiedAt
                }
              })
            ])
          ),
          ...Object.fromEntries(
            promptTemplateIds.map((promptTemplateId) => [
              `promptTemplate:${promptTemplateId}`,
              tx.promptTemplate.update({
                id: promptTemplateId,
                recipe: (draft) => {
                  delete draft.category
                  draft.modifiedAt = modifiedAt
                }
              })
            ])
          )
        }))
        /** Latest authoritative graph returned for success or rollback reconciliation. */
        const payload = buildDeleteCategoryResponsePayload(
          requestedFolder.id,
          requestedCategory.id,
          promptIds,
          promptTemplateIds
        )
        if (!payload) return { success: false, error: 'Category delete commit did not complete' }
        return outcome.status === 'conflict'
          ? { success: false, conflict: true, payload }
          : { success: true, payload }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
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
