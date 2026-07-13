import type { PromptFolder } from '@shared/PromptFolder'

type PromptFolderScreenOwnedRow = {
  ownerFolderId: string
  indentLevel: number
  isOwnerRoot: boolean
}

export type PromptFolderScreenFolderEditorRow = PromptFolderScreenOwnedRow & {
  kind: 'folder-editor'
  isRoot: boolean
  isFirstSibling: boolean
  isLastSibling: boolean
}

export type PromptFolderScreenPromptEditorRow = PromptFolderScreenOwnedRow & {
  kind: 'prompt-editor'
  promptId: string
  isFirstPrompt: boolean
  isLastPrompt: boolean
}

export type PromptFolderScreenDividerRow = PromptFolderScreenOwnedRow & {
  kind: 'prompt-divider'
  previousEntryId: string | null
}

export type PromptFolderDividerTarget = {
  ownerFolderId: string
  previousEntryId: string | null
}

export type PromptFolderPromptTarget = {
  ownerFolderId: string
  promptId: string
}

export type PromptFolderScreenPlaceholderRow = PromptFolderScreenOwnedRow & {
  kind: 'placeholder'
}

export type PromptFolderScreenRow =
  | PromptFolderScreenFolderEditorRow
  | PromptFolderScreenPromptEditorRow
  | PromptFolderScreenDividerRow
  | PromptFolderScreenPlaceholderRow

type BuildPromptFolderScreenRowsOptions = {
  rootFolder: PromptFolder
  descendantFolders: readonly PromptFolder[]
  promptIds: readonly string[]
  isFolderExpanded: (folderId: string) => boolean
}

export const buildPromptFolderScreenRows = ({
  rootFolder,
  descendantFolders,
  promptIds,
  isFolderExpanded
}: BuildPromptFolderScreenRowsOptions): PromptFolderScreenRow[] => {
  const rows: PromptFolderScreenRow[] = []
  const promptIdSet = new Set(promptIds)
  const folderById = new Map(
    [...descendantFolders, rootFolder].map((folder) => [folder.id, folder])
  )
  const visitedFolderIds = new Set<string>()

  const addFolder = (
    folder: PromptFolder,
    indentLevel: number,
    isFirstSibling: boolean,
    isLastSibling: boolean
  ): void => {
    if (visitedFolderIds.has(folder.id)) return
    visitedFolderIds.add(folder.id)

    const isRoot = folder.id === rootFolder.id
    rows.push({
      kind: 'folder-editor',
      ownerFolderId: folder.id,
      indentLevel,
      isOwnerRoot: isRoot,
      isRoot,
      isFirstSibling,
      isLastSibling
    })

    if (!isFolderExpanded(folder.id)) return

    const childIndentLevel = indentLevel + 1
    const entries = folder.entries.filter((entry) =>
      entry.kind === 'folder' ? folderById.has(entry.id) : promptIdSet.has(entry.id)
    )
    const directPromptIds = entries
      .filter((entry) => entry.kind === 'prompt')
      .map((entry) => entry.id)
    const directPromptIndexById = new Map(
      directPromptIds.map((promptId, promptIndex) => [promptId, promptIndex])
    )

    rows.push({
      kind: 'prompt-divider',
      ownerFolderId: folder.id,
      previousEntryId: null,
      indentLevel: childIndentLevel,
      isOwnerRoot: isRoot
    })

    for (const [entryIndex, entry] of entries.entries()) {
      const childFolder = entry.kind === 'folder' ? folderById.get(entry.id) : undefined
      if (childFolder) {
        addFolder(
          childFolder,
          childIndentLevel,
          entryIndex === 0,
          entryIndex === entries.length - 1
        )
      } else {
        const promptIndex = directPromptIndexById.get(entry.id)!
        rows.push({
          kind: 'prompt-editor',
          ownerFolderId: folder.id,
          promptId: entry.id,
          indentLevel: childIndentLevel,
          isOwnerRoot: isRoot,
          isFirstPrompt: isRoot ? entryIndex === 0 : promptIndex === 0,
          isLastPrompt: isRoot
            ? entryIndex === entries.length - 1
            : promptIndex === directPromptIds.length - 1
        })
      }

      rows.push({
        kind: 'prompt-divider',
        ownerFolderId: folder.id,
        previousEntryId: entry.id,
        indentLevel: childIndentLevel,
        isOwnerRoot: isRoot
      })
    }

    if (isRoot && entries.length === 0) {
      rows.push({
        kind: 'placeholder',
        ownerFolderId: folder.id,
        indentLevel: childIndentLevel,
        isOwnerRoot: true
      })
    }
  }

  addFolder(rootFolder, 0, true, true)
  return rows
}
