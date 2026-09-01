import type { PromptPersisted } from './Prompt'
import type { PromptTemplatePersisted } from './PromptTemplate'
import type { PromptEntryRef, PromptTemplateEntryRef } from './OrderContainer'
import type { RevisionEnvelope } from './Revision'
import type { IpcResult } from './IpcResult'
import type { MarkdownContentUiState } from './MarkdownContentUiState'

export type PromptFolderKind = 'prompt' | 'template'

export type PromptFolderContentKind = PromptFolderKind

/** Ordered prompt or template reference stored inside one category group. */
export type CategoryOrderEntryRef = PromptEntryRef | PromptTemplateEntryRef

/** One category and its ordered active content references. */
export type CategoryOrderGroup = {
  categoryId: string | null
  entries: CategoryOrderEntryRef[]
}

/** Root-folder category ordering persisted in FolderOrder.json. */
export type CategoryOrder = {
  categories: CategoryOrderGroup[]
}

/** Creates category ordering for a root folder with Uncategorized first. */
export const createRootCategoryOrder = (): CategoryOrder => ({
  categories: [{ categoryId: null, entries: [] }]
})

/** Returns the ordered category IDs owned by one root folder. */
export const getCategoryOrderCategoryIds = (categoryOrder: CategoryOrder): string[] =>
  categoryOrder.categories.flatMap(({ categoryId }) =>
    categoryId === null ? [] : [categoryId]
  )

/** Removes one content reference from every category group. */
export const removeCategoryOrderEntry = (
  categoryOrder: CategoryOrder,
  entry: CategoryOrderEntryRef
): CategoryOrder => ({
  categories: categoryOrder.categories.map((category) => ({
    ...category,
    entries: category.entries.filter(
      (candidate) => candidate.kind !== entry.kind || candidate.id !== entry.id
    )
  }))
})

/** Finds the category group currently containing one content reference. */
export const findCategoryOrderEntryCategoryId = (
  categoryOrder: CategoryOrder,
  entry: CategoryOrderEntryRef
): string | null | undefined =>
  categoryOrder.categories.find((category) =>
    category.entries.some(
      (candidate) => candidate.kind === entry.kind && candidate.id === entry.id
    )
  )?.categoryId

/** Appends one content reference to its requested category or Uncategorized. */
export const appendCategoryOrderEntry = (
  categoryOrder: CategoryOrder,
  entry: CategoryOrderEntryRef,
  categoryId: string | undefined
): CategoryOrder => {
  /** Category ID accepted only when its group currently exists. */
  const targetCategoryId = categoryOrder.categories.some(
    (category) => category.categoryId === categoryId
  )
    ? (categoryId ?? null)
    : null
  /** Ordering with any previous occurrence of the content removed. */
  const withoutEntry = removeCategoryOrderEntry(categoryOrder, entry)

  return {
    categories: withoutEntry.categories.map((category) =>
      category.categoryId === targetCategoryId
        ? { ...category, entries: [...category.entries, entry] }
        : category
    )
  }
}

/** Inserts one content reference at a specific position in a category group. */
export const insertCategoryOrderEntry = (
  categoryOrder: CategoryOrder,
  entry: CategoryOrderEntryRef,
  categoryId: string | null,
  previousEntryId: string | null
): CategoryOrder => {
  /** Ordering with the moved content removed from its previous category. */
  const withoutEntry = removeCategoryOrderEntry(categoryOrder, entry)
  /** Requested group that receives the content reference. */
  const targetGroup = withoutEntry.categories.find(
    (category) => category.categoryId === categoryId
  )
  if (!targetGroup) throw new Error('Category not found')

  /** Position immediately following the requested predecessor. */
  const insertIndex =
    previousEntryId === null
      ? 0
      : targetGroup.entries.findIndex((candidate) => candidate.id === previousEntryId) + 1
  if (previousEntryId !== null && insertIndex === 0) {
    throw new Error('Previous category entry not found')
  }

  return {
    categories: withoutEntry.categories.map((category) => {
      if (category.categoryId !== categoryId) return category
      /** Ordered entries with the moved reference inserted once. */
      const entries = [...category.entries]
      entries.splice(insertIndex, 0, entry)
      return { ...category, entries }
    })
  }
}

/** Reorders one category while keeping Uncategorized fixed at the beginning. */
export const moveCategoryOrderGroup = (
  categoryOrder: CategoryOrder,
  categoryId: string,
  previousCategoryId: string | null
): CategoryOrder => {
  /** Category group removed before its new insertion position is resolved. */
  const movedGroup = categoryOrder.categories.find(
    (category) => category.categoryId === categoryId
  )
  if (!movedGroup) throw new Error('Category not found')

  /** Categorized groups excluding the dragged group. */
  const categories = categoryOrder.categories.filter(
    (category) => category.categoryId !== null && category.categoryId !== categoryId
  )
  /** Position after the requested categorized predecessor. */
  const insertIndex =
    previousCategoryId === null
      ? 0
      : categories.findIndex((category) => category.categoryId === previousCategoryId) + 1
  if (previousCategoryId !== null && insertIndex === 0) {
    throw new Error('Previous category not found')
  }
  categories.splice(insertIndex, 0, movedGroup)
  return { categories: [categoryOrder.categories[0]!, ...categories] }
}

/** Inserts a new empty category immediately after Uncategorized. */
export const insertCategoryOrderGroup = (
  categoryOrder: CategoryOrder,
  categoryId: string
): CategoryOrder => ({
  categories: [
    categoryOrder.categories[0]!,
    { categoryId, entries: [] },
    ...categoryOrder.categories.slice(1)
  ]
})

/** Deletes a category group and appends its content to Uncategorized. */
export const deleteCategoryOrderGroup = (
  categoryOrder: CategoryOrder,
  categoryId: string
): CategoryOrder => {
  /** Entries whose deleted category ownership becomes Uncategorized. */
  const movedEntries = categoryOrder.categories.find(
    (category) => category.categoryId === categoryId
  )?.entries ?? []
  return {
    categories: categoryOrder.categories
      .filter((category) => category.categoryId !== categoryId)
      .map((category) =>
        category.categoryId === null
          ? { ...category, entries: [...category.entries, ...movedEntries] }
          : category
      )
  }
}

interface PromptFolderBase {
  id: string
  folderName: string
  displayName: string
  completedPromptIds: string[]
  categoryOrder: CategoryOrder
}

export interface PromptContentFolder extends PromptFolderBase {
  kind: 'prompt'
  settings: PromptFolderSettings
}

export interface PromptTemplateFolder extends PromptFolderBase {
  kind: 'template'
  settings: PromptTemplateFolderSettings
}

export type PromptFolder = PromptContentFolder | PromptTemplateFolder

export const PROMPT_FOLDER_SETTINGS_FIELDS = ['folderDescription'] as const

export type PromptFolderSettingsField = (typeof PROMPT_FOLDER_SETTINGS_FIELDS)[number]

export type PromptFolderSettings = Record<PromptFolderSettingsField, string | null>

export type PromptTemplateFolderSettings = PromptFolderSettings

export type PromptFolderSettingsFieldMetadata = {
  field: PromptFolderSettingsField
  diskFilename: string
  monacoModelUriSegment: string
  findSectionKey: string
}

export const PROMPT_FOLDER_SETTINGS_FIELD_METADATA = [
  {
    field: 'folderDescription',
    diskFilename: 'Description.md',
    monacoModelUriSegment: 'folder-descriptions',
    findSectionKey: 'folder-description'
  }
] as const satisfies readonly PromptFolderSettingsFieldMetadata[]

export const PROMPT_FOLDER_SETTINGS_DISK_FILENAMES = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, diskFilename }) => [field, diskFilename])
) as Record<PromptFolderSettingsField, string>

export const PROMPT_FOLDER_SETTINGS_MONACO_MODEL_URI_SEGMENTS = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, monacoModelUriSegment }) => [
    field,
    monacoModelUriSegment
  ])
) as Record<PromptFolderSettingsField, string>

export const PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, findSectionKey }) => [field, findSectionKey])
) as Record<PromptFolderSettingsField, string>

export const createEmptyPromptFolderSettings = (): PromptFolderSettings => ({
  folderDescription: null
})

export const copyPromptFolderSettings = (
  settings: PromptFolderSettings
): PromptFolderSettings => ({ folderDescription: settings.folderDescription })

export const haveSamePromptFolderSettings = (
  left: PromptFolderSettings,
  right: PromptFolderSettings
): boolean => left.folderDescription === right.folderDescription

export type LoadPromptFolderInitialPayload = {
  workspaceId: string
  promptFolderId: string
}

export type LoadPromptFolderInitialResult = IpcResult<{
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  categories: Array<RevisionEnvelope<import('./Category').Category>>
  prompts: Array<RevisionEnvelope<PromptPersisted>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
  markdownContentUiStates: Array<RevisionEnvelope<MarkdownContentUiState>>
}>
