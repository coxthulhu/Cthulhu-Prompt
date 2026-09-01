import { describe, expect, it } from 'vitest'
import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand,
  parseMoveCategoryDomainCommand,
  parseRenameCategoryDomainCommand,
  parseSetCategoryDescriptionDomainCommand
} from '@shared/CategoryDomainMutations'
import {
  parseCreatePromptDomainCommand,
  parseCreatePromptTemplateDomainCommand,
  parseDeleteMarkdownContentDomainCommand,
  parseMoveMarkdownContentDomainCommand,
  parseUpdatePromptDomainCommand,
  parseUpdatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  parseCreatePromptFolderDomainCommand,
  parseDeletePromptFolderDomainCommand,
  parseMovePromptFolderDomainCommand,
  parseRenamePromptFolderDomainCommand
} from '@shared/PromptFolderDomainMutations'
import { parseSetPromptStatusDomainCommand } from '@shared/PromptDomainMutations'
import { PromptStatus } from '@shared/Prompt'
import { parseSetSystemSettingsDomainCommand } from '@shared/SystemSettingsDomainMutations'

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

  it('accepts root and markdown deletion commands and rejects legacy entity payloads', () => {
    /** Valid root deletion command carrying only workspace ownership intent. */
    const rootCommand = { workspaceId: 'workspace', promptFolderId: 'root' }
    /** Valid prompt or template deletion command carrying its exact owner. */
    const contentCommand = {
      workspaceId: 'workspace',
      promptFolderId: 'root',
      contentId: 'content'
    }
    expect(parseDeletePromptFolderDomainCommand(rootCommand)).toEqual(rootCommand)
    expect(parseDeleteMarkdownContentDomainCommand(contentCommand)).toEqual(contentCommand)
    expect(
      parseDeletePromptFolderDomainCommand({
        ...rootCommand,
        workspace: { id: 'legacy', expectedRevision: 1 }
      })
    ).toBeNull()
    expect(
      parseDeleteMarkdownContentDomainCommand({
        ...contentCommand,
        content: { id: 'legacy', expectedRevision: 1 }
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

  it('accepts nullable category-description commands and rejects legacy entities', () => {
    /** Valid category-description removal command. */
    const command = { categoryId: 'category', description: null }
    expect(parseSetCategoryDescriptionDomainCommand(command)).toEqual(command)
    expect(
      parseSetCategoryDescriptionDomainCommand({ ...command, category: { id: 'legacy' } })
    ).toBeNull()
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

  it('accepts exact prompt and template update commands', () => {
    /** Valid prompt replacement command with explicit template selection. */
    const promptCommand = {
      contentId: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: '2026-08-30T12:00:00Z',
      promptText: 'Updated prompt.',
      templates: [{ id: 'template' }]
    }
    /** Valid template replacement command without prompt-only fields. */
    const templateCommand = {
      contentId: 'template',
      title: 'Template',
      fallbackTitle: '',
      modifiedAt: '2026-08-30T12:00:00Z',
      templateText: 'Updated template.'
    }
    expect(parseUpdatePromptDomainCommand(promptCommand)).toEqual(promptCommand)
    expect(parseUpdatePromptTemplateDomainCommand(templateCommand)).toEqual(templateCommand)
    /** Valid five-field prompt command used to expose unknown sixth-field acceptance. */
    const { templates: _templates, ...promptWithoutTemplates } = promptCommand
    expect(
      parseUpdatePromptDomainCommand({ ...promptWithoutTemplates, status: PromptStatus.Todo })
    ).toBeNull()
    expect(
      parseUpdatePromptTemplateDomainCommand({
        ...templateCommand,
        modifiedAt: '2026-08-30T12:00:00.000Z'
      })
    ).toBeNull()
  })

  it('accepts complete finite system-settings commands', () => {
    /** Valid complete system-settings replacement command. */
    const command = {
      promptFontSize: 18,
      promptEditorMinLines: 3,
      promptEditorMaxLines: 30,
      showLineNumbers: false
    }
    expect(parseSetSystemSettingsDomainCommand(command)).toEqual(command)
    expect(parseSetSystemSettingsDomainCommand({ ...command, promptFontSize: NaN })).toBeNull()
    expect(parseSetSystemSettingsDomainCommand({ ...command, legacy: true })).toBeNull()
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
      workspaceId: 'workspace',
      modifiedAt: 'timestamp'
    }
    expect(parseDeleteCategoryDomainCommand(command)).toEqual(command)
  })

  it('rejects extra category deletion fields', () => {
    /** Category command containing an unrecognized legacy payload field. */
    const command = {
      categoryId: 'category',
      promptFolderId: 'root',
      workspaceId: 'workspace',
      modifiedAt: 'timestamp',
      category: { id: 'legacy' }
    }
    expect(parseDeleteCategoryDomainCommand(command)).toBeNull()
  })
})
