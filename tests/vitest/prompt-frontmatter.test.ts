import { describe, expect, it } from 'vitest'
import { PromptStatus } from '@shared/Prompt'
import {
  parsePromptMarkdown,
  serializePromptMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'

describe('prompt frontmatter', () => {
  it('round trips an optional template id', () => {
    const serialized = serializePromptMarkdown({
      id: 'prompt-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: 'ignored',
      promptText: 'Review this change.\n',
      templateId: 'template-1',
      status: PromptStatus.Todo
    })

    expect(serialized).toContain('templateId: template-1')
    expect(parsePromptMarkdown(serialized, '2026-07-26T13:00:00.000Z')).toEqual({
      id: 'prompt-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: '2026-07-26T13:00:00.000Z',
      promptText: 'Review this change.\n',
      templateId: 'template-1',
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
      templateId: null,
      status: PromptStatus.Todo
    })

    expect(serialized).toContain('templateId: null')
    expect(parsePromptMarkdown(serialized)).toMatchObject({ templateId: null })
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

    expect(serialized).not.toContain('templateId:')
    expect(parsePromptMarkdown(serialized)).not.toHaveProperty('templateId')
  })
})
