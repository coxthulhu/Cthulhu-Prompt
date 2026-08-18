import type { Category } from '@shared/Category'
import type { PromptFolder } from '@shared/PromptFolder'

/** Placement identity shared by category-screen rows. */
type PromptFolderScreenContentRow = {
  contentOwnerId: string
  categoryId: string | null
  indentLevel: number
}

/** Root page-header row. */
export type PromptFolderScreenRootHeaderRow = { kind: 'root-header' }

/** Folder-style editor row backed by one category. */
export type PromptFolderScreenCategoryEditorRow = PromptFolderScreenContentRow & {
  kind: 'category-editor'
  categoryId: string
}

/** Prompt or template editor row at one category placement. */
export type PromptFolderScreenPromptEditorRow = PromptFolderScreenContentRow & {
  kind: 'prompt-editor'
  promptId: string
  isFirstPrompt: boolean
  isLastPrompt: boolean
}

/** Add-content and drop-target divider within one category group. */
export type PromptFolderScreenDividerRow = PromptFolderScreenContentRow & {
  kind: 'prompt-divider'
  previousEntryId: string | null
  /** Category boundary shared by the final Uncategorized prompt divider when present. */
  categoryDropNextCategoryId?: string | null
}

/** Plain noninteractive divider rendered after one category card. */
export type PromptFolderScreenCategorySeparatorRow = {
  kind: 'category-separator'
  categoryId: string
  /** Category immediately after this divider, or null for the bottom boundary. */
  nextCategoryId: string | null
}

/** Exact category placement selected by a divider. */
export type PromptFolderDividerTarget = {
  contentOwnerId: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Exact category placement of one rendered content row. */
export type PromptFolderPromptTarget = {
  contentOwnerId: string
  categoryId: string | null
  promptId: string
}

/** Empty root content placeholder. */
export type PromptFolderScreenPlaceholderRow = PromptFolderScreenContentRow & {
  kind: 'placeholder'
}

/** Count summary shown while one category is collapsed. */
export type PromptFolderScreenCollapsedSummaryRow = PromptFolderScreenContentRow & {
  kind: 'collapsed-summary'
  promptCount: number
}

/** Rounded bottom cap for one expanded category card. */
export type PromptFolderScreenCategoryBottomCapRow = PromptFolderScreenContentRow & {
  kind: 'category-bottom-cap'
}

/** Every virtual row emitted by the active category screen. */
export type PromptFolderScreenRow =
  | PromptFolderScreenRootHeaderRow
  | PromptFolderScreenCategoryEditorRow
  | PromptFolderScreenPromptEditorRow
  | PromptFolderScreenDividerRow
  | PromptFolderScreenCategorySeparatorRow
  | PromptFolderScreenCollapsedSummaryRow
  | PromptFolderScreenCategoryBottomCapRow
  | PromptFolderScreenPlaceholderRow

/** Inputs used to project FolderOrderV2 into screen rows. */
type BuildPromptFolderScreenRowsOptions = {
  rootFolder: PromptFolder
  categories: readonly Category[]
  promptIds: readonly string[]
  isCategoryExpanded: (categoryId: string) => boolean
}

/** Projects Uncategorized and ordered category groups into the existing folder-style UI. */
export const buildPromptFolderScreenRows = ({
  rootFolder,
  categories,
  promptIds,
  isCategoryExpanded
}: BuildPromptFolderScreenRowsOptions): PromptFolderScreenRow[] => {
  /** Rows emitted in virtual display order. */
  const rows: PromptFolderScreenRow[] = [{ kind: 'root-header' }]
  /** Loaded content IDs eligible for rendering. */
  const promptIdSet = new Set(promptIds)
  /** Loaded category metadata indexed by stable ID. */
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  /** Valid V2 groups retained in authoritative order. */
  const groups = rootFolder.categoryOrder.categories.filter(
    (group) => group.categoryId === null || categoryById.has(group.categoryId)
  )
  /** Total visible active content used by the empty-root decision. */
  let visiblePromptCount = 0

  for (const [groupIndex, group] of groups.entries()) {
    /** Loaded content IDs retained in this group order. */
    const groupPromptIds = group.entries
      .filter((entry) => promptIdSet.has(entry.id))
      .map((entry) => entry.id)
    visiblePromptCount += groupPromptIds.length
    /** Stable content owner uses the root for Uncategorized and category ID otherwise. */
    const contentOwnerId = group.categoryId ?? rootFolder.id
    /** Whether this group is the unheaded root-level Uncategorized area. */
    const isUncategorized = group.categoryId === null
    /** Group immediately after the current group in authoritative category order. */
    const nextGroup = groups[groupIndex + 1]
    /** First category boundary shared by the final Uncategorized prompt divider. */
    const categoryDropNextCategoryId = isUncategorized
      ? (nextGroup?.categoryId ?? undefined)
      : undefined

    if (!isUncategorized) {
      /** Non-null category ID established by the Uncategorized branch. */
      const categoryId = group.categoryId as string
      rows.push({
        kind: 'category-editor',
        contentOwnerId,
        categoryId,
        indentLevel: 0
      })
      if (!isCategoryExpanded(categoryId)) {
        rows.push({
          kind: 'collapsed-summary',
          contentOwnerId,
          categoryId,
          indentLevel: 1,
          promptCount: groupPromptIds.length
        })
        rows.push({
          kind: 'category-bottom-cap',
          contentOwnerId,
          categoryId,
          indentLevel: 0
        })
        rows.push({
          kind: 'category-separator',
          categoryId,
          nextCategoryId: nextGroup?.categoryId ?? null
        })
        continue
      }
    }

    rows.push({
      kind: 'prompt-divider',
      contentOwnerId,
      categoryId: group.categoryId,
      previousEntryId: null,
      indentLevel: isUncategorized ? 0 : 1,
      ...(categoryDropNextCategoryId && groupPromptIds.length === 0
        ? { categoryDropNextCategoryId }
        : {})
    })
    for (const [promptIndex, promptId] of groupPromptIds.entries()) {
      rows.push({
        kind: 'prompt-editor',
        contentOwnerId,
        categoryId: group.categoryId,
        promptId,
        indentLevel: isUncategorized ? 0 : 1,
        isFirstPrompt: promptIndex === 0,
        isLastPrompt: promptIndex === groupPromptIds.length - 1
      })
      rows.push({
        kind: 'prompt-divider',
        contentOwnerId,
        categoryId: group.categoryId,
        previousEntryId: promptId,
        indentLevel: isUncategorized ? 0 : 1,
        ...(categoryDropNextCategoryId && promptIndex === groupPromptIds.length - 1
          ? { categoryDropNextCategoryId }
          : {})
      })
    }
    if (!isUncategorized) {
      rows.push({
        kind: 'category-bottom-cap',
        contentOwnerId,
        categoryId: group.categoryId,
        indentLevel: 0
      })
      rows.push({
        kind: 'category-separator',
        categoryId: contentOwnerId,
        nextCategoryId: nextGroup?.categoryId ?? null
      })
    }
  }

  if (visiblePromptCount === 0 && groups.length === 1) {
    rows.push({
      kind: 'placeholder',
      contentOwnerId: rootFolder.id,
      categoryId: null,
      indentLevel: 0
    })
  }
  return rows
}
