import { describe, expect, it } from 'vitest'
import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand
} from '@shared/CategoryDomainMutations'
import { parseMoveMarkdownContentDomainCommand } from '@shared/MarkdownContentDomainMutations'
import { parseRenamePromptFolderDomainCommand } from '@shared/PromptFolderDomainMutations'

describe('domain mutation command validation', () => {
  it('accepts a root-folder rename command and rejects legacy payload fields', () => {
    /** Valid root-folder rename command containing domain intent only. */
    const command = { promptFolderId: 'root', displayName: 'Renamed Root' }
    expect(parseRenamePromptFolderDomainCommand(command)).toEqual(command)
    expect(
      parseRenamePromptFolderDomainCommand({
        ...command,
        promptFolder: { id: 'legacy', expectedRevision: 1 }
      })
    ).toBeNull()
  })

  it('accepts a valid category creation command', () => {
    /** Valid creation command carrying only stable domain intent. */
    const command = {
      categoryId: 'category',
      promptFolderId: 'root',
      displayName: 'Category'
    }
    expect(parseCreateCategoryDomainCommand(command)).toEqual(command)
  })

  it('accepts the channel-independent markdown movement command', () => {
    /** Valid movement command shared by the prompt and template channels. */
    const command = {
      sourcePromptFolderId: 'source',
      destinationPromptFolderId: 'destination',
      contentId: 'content',
      categoryId: null,
      previousEntryId: null
    }
    expect(parseMoveMarkdownContentDomainCommand(command)).toEqual(command)
  })

  it('rejects legacy kind and other extra movement fields', () => {
    /** Legacy movement command whose kind must now be determined by the IPC channel. */
    const command = {
      kind: 'prompt',
      sourcePromptFolderId: 'source',
      destinationPromptFolderId: 'destination',
      contentId: 'prompt',
      categoryId: null,
      previousEntryId: null
    }
    expect(parseMoveMarkdownContentDomainCommand(command)).toBeNull()
  })

  it('accepts a valid category deletion command', () => {
    /** Valid category command colocated with its shared planner. */
    const command = {
      categoryId: 'category',
      promptFolderId: 'root',
      modifiedAt: 'timestamp'
    }
    expect(parseDeleteCategoryDomainCommand(command)).toEqual(command)
  })

  it('rejects extra category deletion fields', () => {
    /** Category command containing an unrecognized legacy payload field. */
    const command = {
      categoryId: 'category',
      promptFolderId: 'root',
      modifiedAt: 'timestamp',
      category: { id: 'legacy' }
    }
    expect(parseDeleteCategoryDomainCommand(command)).toBeNull()
  })
})
