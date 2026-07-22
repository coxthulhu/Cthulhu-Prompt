import type { PromptFolder } from '@shared/PromptFolder'
import {
  buildPromptFolderScreenRows,
  type PromptFolderScreenRow
} from '@renderer/features/prompt-folders/promptFolderScreenRows'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  entryIds: string[] = [],
  overrides: Partial<PromptFolder> = {}
): PromptFolder => ({
  id,
  kind: 'prompt',
  folderName: id,
  displayName: id,
  entries: entryIds.map((entryId) => ({
    kind: entryId.startsWith('folder-') ? 'folder' : 'prompt',
    id: entryId
  })),
  completedPromptIds: [],
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  },
  ...overrides
})

const buildRows = ({
  rootFolder,
  descendantFolders = [],
  promptIds = [],
  collapsedFolderIds = []
}: {
  rootFolder: PromptFolder
  descendantFolders?: PromptFolder[]
  promptIds?: string[]
  collapsedFolderIds?: string[]
}): PromptFolderScreenRow[] => {
  const collapsedFolderIdSet = new Set(collapsedFolderIds)
  return buildPromptFolderScreenRows({
    rootFolder,
    descendantFolders,
    promptIds,
    isFolderExpanded: (folderId) => !collapsedFolderIdSet.has(folderId)
  })
}

describe('buildPromptFolderScreenRows', () => {
  it('preserves mixed prompt and subfolder entry order', () => {
    const childFolder = createFolder('folder-child', ['prompt-child'])
    const rows = buildRows({
      rootFolder: createFolder('folder-root', ['prompt-first', childFolder.id, 'prompt-last']),
      descendantFolders: [childFolder],
      promptIds: ['prompt-first', 'prompt-child', 'prompt-last']
    })

    expect(rows).toEqual([
      {
        kind: 'root-header'
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-root',
        previousEntryId: null,
        indentLevel: 0,
        isOwnerRoot: true
      },
      {
        kind: 'prompt-editor',
        ownerFolderId: 'folder-root',
        promptId: 'prompt-first',
        indentLevel: 0,
        isOwnerRoot: true,
        isFirstPrompt: true,
        isLastPrompt: false
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-root',
        previousEntryId: 'prompt-first',
        indentLevel: 0,
        isOwnerRoot: true
      },
      {
        kind: 'folder-editor',
        ownerFolderId: 'folder-child',
        indentLevel: 0,
        isOwnerRoot: false,
        isRoot: false,
        isFirstSibling: false,
        isLastSibling: false
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-child',
        previousEntryId: null,
        indentLevel: 1,
        isOwnerRoot: false
      },
      {
        kind: 'prompt-editor',
        ownerFolderId: 'folder-child',
        promptId: 'prompt-child',
        indentLevel: 1,
        isOwnerRoot: false,
        isFirstPrompt: true,
        isLastPrompt: true
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-child',
        previousEntryId: 'prompt-child',
        indentLevel: 1,
        isOwnerRoot: false
      },
      {
        kind: 'folder-bottom-cap',
        ownerFolderId: 'folder-child',
        indentLevel: 0,
        isOwnerRoot: false
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-root',
        previousEntryId: 'folder-child',
        indentLevel: 0,
        isOwnerRoot: true
      },
      {
        kind: 'prompt-editor',
        ownerFolderId: 'folder-root',
        promptId: 'prompt-last',
        indentLevel: 0,
        isOwnerRoot: true,
        isFirstPrompt: false,
        isLastPrompt: true
      },
      {
        kind: 'prompt-divider',
        ownerFolderId: 'folder-root',
        previousEntryId: 'prompt-last',
        indentLevel: 0,
        isOwnerRoot: true
      }
    ])
  })

  it('emits an initial divider and placeholder for an empty root folder', () => {
    const rows = buildRows({ rootFolder: createFolder('folder-root') })

    expect(rows.map((row) => row.kind)).toEqual(['root-header', 'prompt-divider', 'placeholder'])
    expect(rows[1]).toMatchObject({
      ownerFolderId: 'folder-root',
      previousEntryId: null,
      indentLevel: 0,
      isOwnerRoot: true
    })
  })

  it('does not emit a placeholder inside an empty subfolder', () => {
    const childFolder = createFolder('folder-child')
    const rows = buildRows({
      rootFolder: createFolder('folder-root', [childFolder.id]),
      descendantFolders: [childFolder]
    })

    expect(rows.filter((row) => row.kind === 'placeholder')).toEqual([])
    expect(rows).toContainEqual({
      kind: 'prompt-divider',
      ownerFolderId: 'folder-child',
      previousEntryId: null,
      indentLevel: 1,
      isOwnerRoot: false
    })
    expect(rows).toContainEqual({
      kind: 'folder-bottom-cap',
      ownerFolderId: 'folder-child',
      indentLevel: 0,
      isOwnerRoot: false
    })
  })

  it('emits the parent-owned divider after the complete child subtree', () => {
    const grandchildFolder = createFolder('folder-grandchild', ['prompt-grandchild'])
    const childFolder = createFolder('folder-child', [grandchildFolder.id])
    const rows = buildRows({
      rootFolder: createFolder('folder-root', [childFolder.id]),
      descendantFolders: [childFolder, grandchildFolder],
      promptIds: ['prompt-grandchild']
    })

    const grandchildPromptIndex = rows.findIndex(
      (row) => row.kind === 'prompt-editor' && row.promptId === 'prompt-grandchild'
    )
    const childDividerIndex = rows.findIndex(
      (row) =>
        row.kind === 'prompt-divider' &&
        row.ownerFolderId === 'folder-root' &&
        row.previousEntryId === 'folder-child'
    )

    expect(childDividerIndex).toBeGreaterThan(grandchildPromptIndex)
    expect(rows[childDividerIndex - 1]).toMatchObject({
      kind: 'folder-bottom-cap',
      ownerFolderId: 'folder-child'
    })
  })

  it('emits all eight nested subfolder levels at their relative indents', () => {
    const folders = Array.from({ length: 9 }, (_, depth) =>
      createFolder(`folder-${depth}`, depth < 8 ? [`folder-${depth + 1}`] : ['prompt-deepest'])
    )
    const rows = buildRows({
      rootFolder: folders[0],
      descendantFolders: folders.slice(1),
      promptIds: ['prompt-deepest']
    })

    const folderRows = rows.filter((row) => row.kind === 'folder-editor')
    expect(folderRows).toHaveLength(8)
    expect(folderRows.map((row) => row.indentLevel)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(rows).toContainEqual({
      kind: 'prompt-editor',
      ownerFolderId: 'folder-8',
      promptId: 'prompt-deepest',
      indentLevel: 8,
      isOwnerRoot: false,
      isFirstPrompt: true,
      isLastPrompt: true
    })
  })

  it("replaces a collapsed folder's direct contents with their summary", () => {
    const grandchildFolder = createFolder('folder-grandchild', ['prompt-grandchild'])
    const childFolder = createFolder('folder-child', ['prompt-child', grandchildFolder.id])
    const rows = buildRows({
      rootFolder: createFolder('folder-root', [childFolder.id]),
      descendantFolders: [childFolder, grandchildFolder],
      promptIds: ['prompt-child', 'prompt-grandchild'],
      collapsedFolderIds: [childFolder.id]
    })

    expect(rows.map((row) => row.kind)).toEqual([
      'root-header',
      'prompt-divider',
      'folder-editor',
      'collapsed-summary',
      'folder-bottom-cap',
      'prompt-divider'
    ])
    expect(rows).toContainEqual({
      kind: 'collapsed-summary',
      ownerFolderId: 'folder-child',
      indentLevel: 1,
      isOwnerRoot: false,
      promptCount: 1,
      subfolderCount: 1
    })
    expect(rows).not.toContainEqual(
      expect.objectContaining({ kind: 'prompt-editor', ownerFolderId: 'folder-child' })
    )
    expect(rows).not.toContainEqual(
      expect.objectContaining({ kind: 'prompt-divider', ownerFolderId: 'folder-child' })
    )
    expect(rows).toContainEqual(
      expect.objectContaining({ kind: 'folder-bottom-cap', ownerFolderId: 'folder-child' })
    )
    expect(rows.at(-1)).toEqual({
      kind: 'prompt-divider',
      ownerFolderId: 'folder-root',
      previousEntryId: 'folder-child',
      indentLevel: 0,
      isOwnerRoot: true
    })
  })

  it('summarizes an empty collapsed folder with zero counts', () => {
    const childFolder = createFolder('folder-child')
    const rows = buildRows({
      rootFolder: createFolder('folder-root', [childFolder.id]),
      descendantFolders: [childFolder],
      collapsedFolderIds: [childFolder.id]
    })

    expect(rows).toContainEqual({
      kind: 'collapsed-summary',
      ownerFolderId: 'folder-child',
      indentLevel: 1,
      isOwnerRoot: false,
      promptCount: 0,
      subfolderCount: 0
    })
  })

  it('always emits root contents when the persisted root state is collapsed', () => {
    const rows = buildRows({
      rootFolder: createFolder('folder-root', ['prompt-root']),
      promptIds: ['prompt-root'],
      collapsedFolderIds: ['folder-root']
    })

    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: 'prompt-editor',
        ownerFolderId: 'folder-root',
        promptId: 'prompt-root',
        indentLevel: 0
      })
    )
  })
})
