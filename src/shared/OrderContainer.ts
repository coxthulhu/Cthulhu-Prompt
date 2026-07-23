export type PromptEntryRef = { kind: 'prompt'; id: string }

export type PromptTemplateEntryRef = { kind: 'template'; id: string }

export type FolderEntryRef = { kind: 'folder'; id: string }

export type EntryRef = PromptEntryRef | PromptTemplateEntryRef | FolderEntryRef

export interface OrderContainer<TEntry extends EntryRef> {
  entries: TEntry[]
}

export const promptEntryRef = (id: string): PromptEntryRef => ({ kind: 'prompt', id })

export const promptTemplateEntryRef = (id: string): PromptTemplateEntryRef => ({
  kind: 'template',
  id
})

export const folderEntryRef = (id: string): FolderEntryRef => ({ kind: 'folder', id })

export const findEntryIndex = <TEntry extends EntryRef>(
  entries: readonly TEntry[],
  kind: TEntry['kind'],
  id: string
): number => entries.findIndex((entry) => entry.kind === kind && entry.id === id)

export const removeEntry = <TEntry extends EntryRef>(
  entries: readonly TEntry[],
  kind: TEntry['kind'],
  id: string
): TEntry[] => entries.filter((entry) => entry.kind !== kind || entry.id !== id)

export const moveEntryWithinSubset = <TEntry extends EntryRef>(
  entries: readonly TEntry[],
  entryId: string,
  previousEntryId: string | null,
  isSubsetEntry: (entry: TEntry) => boolean
): TEntry[] => {
  const movedEntry = entries.find((entry) => entry.id === entryId)!
  const subsetEntries = entries.filter(
    (entry) => entry.id !== entryId && isSubsetEntry(entry)
  )
  const insertIndex =
    previousEntryId === null
      ? 0
      : subsetEntries.findIndex((entry) => entry.id === previousEntryId) + 1
  subsetEntries.splice(insertIndex, 0, movedEntry)

  let subsetIndex = 0
  return entries.map((entry) =>
    isSubsetEntry(entry) ? subsetEntries[subsetIndex++]! : entry
  )
}
