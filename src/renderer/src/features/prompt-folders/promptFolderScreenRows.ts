import type { Category } from '@shared/Category'
import type { PromptFolder } from '@shared/PromptFolder'

/** Placement identity shared by category-screen rows. */
type PromptFolderScreenOwnedRow = {
  ownerFolderId: string
  categoryId: string | null
  indentLevel: number
  isOwnerRoot: boolean
}

/** Root page-header row. */
export type PromptFolderScreenRootHeaderRow = { kind: 'root-header' }

/** Folder-style editor row backed by one category. */
export type PromptFolderScreenFolderEditorRow = PromptFolderScreenOwnedRow & {
  kind: 'folder-editor'
  isRoot: false
  isFirstSibling: boolean
  isLastSibling: boolean
}

/** Prompt or template editor row at one category placement. */
export type PromptFolderScreenPromptEditorRow = PromptFolderScreenOwnedRow & {
  kind: 'prompt-editor'
  promptId: string
  isFirstPrompt: boolean
  isLastPrompt: boolean
}

/** Add-content and drop-target divider within one category group. */
export type PromptFolderScreenDividerRow = PromptFolderScreenOwnedRow & {
  kind: 'prompt-divider'
  previousEntryId: string | null
}

/** Plain noninteractive divider rendered after one category card. */
export type PromptFolderScreenCategorySeparatorRow = {
  kind: 'category-separator'
  categoryId: string
}

/** Exact category placement selected by a divider. */
export type PromptFolderDividerTarget = {
  ownerFolderId: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Exact category placement of one rendered content row. */
export type PromptFolderPromptTarget = {
  ownerFolderId: string
  categoryId: string | null
  promptId: string
}

/** Empty root content placeholder. */
export type PromptFolderScreenPlaceholderRow = PromptFolderScreenOwnedRow & {
  kind: 'placeholder'
}

/** Count summary shown while one category is collapsed. */
export type PromptFolderScreenCollapsedSummaryRow = PromptFolderScreenOwnedRow & {
  kind: 'collapsed-summary'
  promptCount: number
}

/** Rounded bottom cap for one expanded category card. */
export type PromptFolderScreenBottomCapRow = PromptFolderScreenOwnedRow & {
  kind: 'folder-bottom-cap'
}

/** Every virtual row emitted by the active category screen. */
export type PromptFolderScreenRow =
  | PromptFolderScreenRootHeaderRow
  | PromptFolderScreenFolderEditorRow
  | PromptFolderScreenPromptEditorRow
  | PromptFolderScreenDividerRow
  | PromptFolderScreenCategorySeparatorRow
  | PromptFolderScreenCollapsedSummaryRow
  | PromptFolderScreenBottomCapRow
  | PromptFolderScreenPlaceholderRow

/** Inputs used to project FolderOrderV2 into screen rows. */
type BuildPromptFolderScreenRowsOptions = {
  rootFolder: PromptFolder
  categories: readonly Category[]
  promptIds: readonly string[]
  isFolderExpanded: (categoryId: string) => boolean
}

/** Projects Uncategorized and ordered category groups into the existing folder-style UI. */
export const buildPromptFolderScreenRows = ({
  rootFolder,
  categories,
  promptIds,
  isFolderExpanded
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
    /** Stable row owner uses the root for Uncategorized and category ID otherwise. */
    const ownerFolderId = group.categoryId ?? rootFolder.id
    /** Whether this group is the unheaded root-level Uncategorized area. */
    const isUncategorized = group.categoryId === null

    if (!isUncategorized) {
      /** Non-null category ID established by the Uncategorized branch. */
      const categoryId = group.categoryId as string
      rows.push({
        kind: 'folder-editor',
        ownerFolderId,
        categoryId,
        indentLevel: 0,
        isOwnerRoot: false,
        isRoot: false,
        isFirstSibling: groupIndex === 1,
        isLastSibling: groupIndex === groups.length - 1
      })
      if (!isFolderExpanded(categoryId)) {
        rows.push({
          kind: 'collapsed-summary',
          ownerFolderId,
          categoryId,
          indentLevel: 1,
          isOwnerRoot: false,
          promptCount: groupPromptIds.length
        })
        rows.push({
          kind: 'folder-bottom-cap',
          ownerFolderId,
          categoryId,
          indentLevel: 0,
          isOwnerRoot: false
        })
        rows.push({ kind: 'category-separator', categoryId })
        continue
      }
    }

    rows.push({
      kind: 'prompt-divider',
      ownerFolderId,
      categoryId: group.categoryId,
      previousEntryId: null,
      indentLevel: isUncategorized ? 0 : 1,
      isOwnerRoot: isUncategorized
    })
    for (const [promptIndex, promptId] of groupPromptIds.entries()) {
      rows.push({
        kind: 'prompt-editor',
        ownerFolderId,
        categoryId: group.categoryId,
        promptId,
        indentLevel: isUncategorized ? 0 : 1,
        isOwnerRoot: isUncategorized,
        isFirstPrompt: promptIndex === 0,
        isLastPrompt: promptIndex === groupPromptIds.length - 1
      })
      rows.push({
        kind: 'prompt-divider',
        ownerFolderId,
        categoryId: group.categoryId,
        previousEntryId: promptId,
        indentLevel: isUncategorized ? 0 : 1,
        isOwnerRoot: isUncategorized
      })
    }
    if (!isUncategorized) {
      rows.push({
        kind: 'folder-bottom-cap',
        ownerFolderId,
        categoryId: group.categoryId,
        indentLevel: 0,
        isOwnerRoot: false
      })
      rows.push({ kind: 'category-separator', categoryId: ownerFolderId })
    }
  }

  if (visiblePromptCount === 0 && groups.length === 1) {
    rows.push({
      kind: 'placeholder',
      ownerFolderId: rootFolder.id,
      categoryId: null,
      indentLevel: 0,
      isOwnerRoot: true
    })
  }
  return rows
}
