import { describe, expect, it } from 'vitest'
import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand,
  parseMoveCategoryDomainCommand,
  parseRenameCategoryDomainCommand
} from '@shared/CategoryDomainMutations'
import {
  parseCreatePromptDomainCommand,
  parseCreatePromptTemplateDomainCommand,
  parseMoveMarkdownContentDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  parseCreatePromptFolderDomainCommand,
  parseMovePromptFolderDomainCommand,
  parseRenamePromptFolderDomainCommand
} from '@shared/PromptFolderDomainMutations'
import { parseSetPromptStatusDomainCommand } from '@shared/PromptDomainMutations'
import { PromptStatus } from '@shared/Prompt'

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

  it('accepts root-folder creation and reorder commands', () => {
    /** Valid root-folder creation command carrying stable intent only. */
    const createCommand = {
      workspaceId: 'workspace',
      promptFolderId: 'root',
      displayName: 'Root',
      previousEntryId: null,
      kind: 'prompt' as const
    }
    /** Valid root-folder reorder command carrying its requested predecessor. */
    const moveCommand = {
      workspaceId: 'workspace',
      promptFolderId: 'root',
      previousEntryId: 'sibling'
    }
    expect(parseCreatePromptFolderDomainCommand(createCommand)).toEqual(createCommand)
    expect(parseMovePromptFolderDomainCommand(moveCommand)).toEqual(moveCommand)
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

  it('accepts category rename and reorder commands', () => {
    /** Valid category rename command. */
    const renameCommand = { categoryId: 'category', displayName: 'Renamed' }
    /** Valid category reorder command. */
    const moveCommand = {
      promptFolderId: 'root',
      categoryId: 'category',
      previousCategoryId: null
    }
    expect(parseRenameCategoryDomainCommand(renameCommand)).toEqual(renameCommand)
    expect(parseMoveCategoryDomainCommand(moveCommand)).toEqual(moveCommand)
  })

  it('accepts prompt and template creation commands with exact timestamps', () => {
    /** Shared valid creation timestamp. */
    const createdAt = '2026-08-30T12:00:00Z'
    /** Valid prompt creation command with ordered template references. */
    const promptCommand = {
      promptFolderId: 'prompts',
      contentId: 'prompt',
      title: '',
      fallbackTitle: 'New Prompt',
      promptText: '',
      createdAt,
      categoryId: null,
      previousEntryId: null,
      templates: [{ id: 'template' }]
    }
    /** Valid template creation command without prompt-only fields. */
    const templateCommand = {
      promptFolderId: 'templates',
      contentId: 'template',
      title: '',
      fallbackTitle: 'New Template',
      templateText: '',
      createdAt,
      categoryId: null,
      previousEntryId: null
    }
    expect(parseCreatePromptDomainCommand(promptCommand)).toEqual(promptCommand)
    expect(parseCreatePromptTemplateDomainCommand(templateCommand)).toEqual(templateCommand)
    expect(parseCreatePromptDomainCommand({ ...promptCommand, createdAt: 'invalid' })).toBeNull()
    /** Template command lacking the required explicit nullable category placement. */
    const { categoryId: _categoryId, ...templateWithoutCategory } = templateCommand
    expect(parseCreatePromptTemplateDomainCommand(templateWithoutCategory)).toBeNull()
    expect(
      parseCreatePromptTemplateDomainCommand({ ...templateCommand, status: PromptStatus.Todo })
    ).toBeNull()
    expect(
      parseCreatePromptDomainCommand({ ...promptCommand, templates: ['template'] })
    ).toBeNull()
  })

  it('accepts a prompt-status command and rejects redundant entity payloads', () => {
    /** Valid prompt-status command carrying domain intent only. */
    const command = {
      sourcePromptFolderId: 'source-prompts',
      destinationPromptFolderId: 'destination-prompts',
      promptId: 'prompt',
      status: PromptStatus.Completed,
      categoryOrderPlacement: { categoryId: null, previousEntryId: null },
      modifiedAt: '2026-08-30T12:00:00Z'
    }
    expect(parseSetPromptStatusDomainCommand(command)).toEqual(command)
    expect(parseSetPromptStatusDomainCommand({ ...command, prompt: { id: 'legacy' } })).toBeNull()
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
