import { describe, expect, it } from 'vitest'
import { PromptStatus } from '@shared/Prompt'
import {
  parsePromptMarkdown,
  promptMarkdownNeedsStartupMigration,
  serializePromptMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'

describe('prompt frontmatter', () => {
  it('round trips ordered template references', () => {
    const serialized = serializePromptMarkdown({
      id: 'prompt-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: 'ignored',
      promptText: 'Review this change.\n',
      templates: [{ id: 'template-1' }, { id: 'template-2' }, { id: 'template-1' }],
      category: 'category-1',
      status: PromptStatus.Todo
    })

    expect(serialized).toContain(
      'templates:\n  - id: template-1\n  - id: template-2\n  - id: template-1'
    )
    expect(parsePromptMarkdown(serialized, '2026-07-26T13:00:00.000Z')).toEqual({
      id: 'prompt-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: '2026-07-26T13:00:00.000Z',
      promptText: 'Review this change.\n',
      templates: [{ id: 'template-1' }, { id: 'template-2' }, { id: 'template-1' }],
      category: 'category-1',
      status: PromptStatus.Todo
    })
  })

  it('round trips an explicit no-template selection', () => {
    const serialized = serializePromptMarkdown({
      id: 'prompt-2',
      title: 'Plain Prompt',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: '',
      promptText: 'Plain text',
      templates: null,
      status: PromptStatus.Todo
    })

    expect(serialized).toContain('templates: null')
    expect(parsePromptMarkdown(serialized)).toMatchObject({ templates: null })
  })

  it('omits the template id when a template has not been selected', () => {
    const serialized = serializePromptMarkdown({
      id: 'prompt-3',
      title: 'Plain Prompt',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: '',
      promptText: 'Plain text',
      status: PromptStatus.Todo
    })

    expect(serialized).not.toContain('templates:')
    expect(parsePromptMarkdown(serialized)).not.toHaveProperty('templates')
    expect(parsePromptMarkdown(serialized)).not.toHaveProperty('category')
  })

  it('parses legacy template ids into the list model for startup migration', () => {
    const legacyMarkdown = `---
id: prompt-4
createdAt: '2026-07-26T12:00:00.000Z'
title: Legacy Prompt
templateId: template-1
status: Todo
---
Legacy text`

    expect(parsePromptMarkdown(legacyMarkdown)).toMatchObject({
      templates: [{ id: 'template-1' }]
    })
    expect(promptMarkdownNeedsStartupMigration(legacyMarkdown)).toBe(true)
    expect(
      promptMarkdownNeedsStartupMigration(
        serializePromptMarkdown(parsePromptMarkdown(legacyMarkdown)!)
      )
    ).toBe(false)
  })

  it('migrates legacy completion timestamps to finalized timestamps', () => {
    /** Legacy completed prompt markdown rewritten during startup. */
    const legacyMarkdown = `---
id: prompt-5
createdAt: '2026-07-26T12:00:00.000Z'
title: Legacy Completed Prompt
status: Completed
completedAt: '2026-07-27T12:00:00.000Z'
---
Legacy completed text`
    /** Current markdown serialized from the migrated prompt model. */
    const migratedMarkdown = serializePromptMarkdown(parsePromptMarkdown(legacyMarkdown)!)

    expect(parsePromptMarkdown(legacyMarkdown)).toMatchObject({
      status: PromptStatus.Completed,
      finalizedAt: '2026-07-27T12:00:00.000Z'
    })
    expect(promptMarkdownNeedsStartupMigration(legacyMarkdown)).toBe(true)
    expect(migratedMarkdown).toContain('finalizedAt:')
    expect(migratedMarkdown).not.toContain('completedAt:')
    expect(promptMarkdownNeedsStartupMigration(migratedMarkdown)).toBe(false)
  })
})
