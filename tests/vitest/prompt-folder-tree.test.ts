import type { PromptFolder } from '@shared/PromptFolder'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
import type { EntryRef } from '@shared/OrderContainer'
import { describe, expect, it } from 'vitest'

const createFolder = (id: string, entries: EntryRef[] = []): PromptFolder => ({
  id,
  folderName: id,
  displayName: id,
  entries,
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  }
})

describe('buildPromptFolderTreeIndex', () => {
  it('derives parent and depth from the authoritative containers', () => {
    const grandchild = createFolder('grandchild')
    const child = createFolder('child', [{ kind: 'folder', id: grandchild.id }])
    const root = createFolder('root', [
      { kind: 'prompt', id: 'prompt-between-folders' },
      { kind: 'folder', id: child.id }
    ])

    const index = buildPromptFolderTreeIndex(
      { id: 'workspace', entries: [{ kind: 'folder', id: root.id }] },
      [grandchild, root, child]
    )

    expect([...index]).toEqual([
      ['root', { parentPromptFolderId: null, depth: 0 }],
      ['child', { parentPromptFolderId: 'root', depth: 1 }],
      ['grandchild', { parentPromptFolderId: 'child', depth: 2 }]
    ])
  })
})
