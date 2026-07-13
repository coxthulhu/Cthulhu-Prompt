import type { PromptFolder } from '@shared/PromptFolder'
import { MAX_PROMPT_SUBFOLDER_DEPTH } from '@shared/PromptFolderTree'
import {
  doesEntryDropChangeOrder,
  resolveEntryDropPreviousEntryId,
  type PromptHandleDropPayload
} from './promptHandleDrag'

export type PromptFolderEntryMove = {
  sourceParentPromptFolderId: string
  destinationParentPromptFolderId: string
  promptFolderId: string
  previousEntryId: string | null
}

const buildParentByFolderId = (promptFolders: readonly PromptFolder[]): Map<string, string> => {
  const parentByFolderId = new Map<string, string>()
  for (const folder of promptFolders) {
    for (const entry of folder.entries) {
      if (entry.kind === 'folder') parentByFolderId.set(entry.id, folder.id)
    }
  }
  return parentByFolderId
}

const collectDescendantFolderIds = (
  promptFolderById: Map<string, PromptFolder>,
  promptFolderId: string,
  descendantIds = new Set<string>()
): Set<string> => {
  const folder = promptFolderById.get(promptFolderId)
  if (!folder) return descendantIds

  for (const entry of folder.entries) {
    if (entry.kind !== 'folder' || descendantIds.has(entry.id)) continue
    descendantIds.add(entry.id)
    collectDescendantFolderIds(promptFolderById, entry.id, descendantIds)
  }
  return descendantIds
}

const getFolderDepth = (parentByFolderId: Map<string, string>, folderId: string): number => {
  let depth = 0
  let currentFolderId = folderId
  while (parentByFolderId.has(currentFolderId)) {
    depth += 1
    currentFolderId = parentByFolderId.get(currentFolderId)!
  }
  return depth
}

export const resolvePromptFolderEntryDropMove = (
  promptFolders: readonly PromptFolder[],
  getActiveEntryIds: (folder: PromptFolder) => string[],
  promptFolderId: string,
  dropPayload: PromptHandleDropPayload | null
): PromptFolderEntryMove | null => {
  if (!dropPayload) return null

  const promptFolderById = new Map(promptFolders.map((folder) => [folder.id, folder]))
  const parentByFolderId = buildParentByFolderId(promptFolders)
  const sourceParentPromptFolderId = parentByFolderId.get(promptFolderId)
  const sourceParent = sourceParentPromptFolderId
    ? promptFolderById.get(sourceParentPromptFolderId)
    : null
  const destinationParent = promptFolderById.get(dropPayload.folderId)
  if (!sourceParentPromptFolderId || !sourceParent || !destinationParent) return null

  const descendantIds = collectDescendantFolderIds(promptFolderById, promptFolderId)
  if (dropPayload.folderId === promptFolderId || descendantIds.has(dropPayload.folderId)) {
    return null
  }

  const movedDepth = getFolderDepth(parentByFolderId, promptFolderId)
  const deepestMovedDepth = Math.max(
    movedDepth,
    ...[...descendantIds].map((folderId) => getFolderDepth(parentByFolderId, folderId))
  )
  const subtreeDepth = deepestMovedDepth - movedDepth
  const destinationDepth = getFolderDepth(parentByFolderId, destinationParent.id) + 1
  if (destinationDepth + subtreeDepth > MAX_PROMPT_SUBFOLDER_DEPTH) return null

  const destinationEntryIds = getActiveEntryIds(destinationParent)
  const previousEntryId = resolveEntryDropPreviousEntryId(
    promptFolderId,
    dropPayload,
    destinationEntryIds
  )
  if (previousEntryId === undefined) return null

  if (
    !doesEntryDropChangeOrder(
      sourceParentPromptFolderId,
      destinationParent.id,
      getActiveEntryIds(sourceParent),
      promptFolderId,
      previousEntryId
    )
  ) {
    return null
  }

  return {
    sourceParentPromptFolderId,
    destinationParentPromptFolderId: destinationParent.id,
    promptFolderId,
    previousEntryId
  }
}
