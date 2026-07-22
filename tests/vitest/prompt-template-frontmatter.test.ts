import { describe, expect, it } from 'vitest'
import {
  parsePromptTemplateMarkdown,
  serializePromptTemplateMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'

describe('prompt template frontmatter', () => {
  it('round trips title metadata and template text', () => {
    const serialized = serializePromptTemplateMarkdown({
      id: 'template-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-22T12:00:00.000Z',
      modifiedAt: 'ignored',
      templateText: 'Review {{change}} exactly.\n'
    })

    expect(parsePromptTemplateMarkdown(serialized, '2026-07-22T13:00:00.000Z')).toEqual({
      id: 'template-1',
      title: 'Review Change',
      fallbackTitle: '',
      createdAt: '2026-07-22T12:00:00.000Z',
      modifiedAt: '2026-07-22T13:00:00.000Z',
      templateText: 'Review {{change}} exactly.\n'
    })
  })

  it('serializes fallbackTitle when the title is blank', () => {
    const serialized = serializePromptTemplateMarkdown({
      id: 'template-2',
      title: '   ',
      fallbackTitle: 'New Template',
      createdAt: '2026-07-22T12:00:00.000Z',
      modifiedAt: '',
      templateText: ''
    })

    expect(serialized).toContain('fallbackTitle: New Template')
    expect(serialized).not.toContain('\ntitle:')
    expect(parsePromptTemplateMarkdown(serialized)).toMatchObject({
      title: '',
      fallbackTitle: 'New Template'
    })
  })

  it.each([
    ['missing title', 'id: template-3\ncreatedAt: 2026-07-22T12:00:00.000Z'],
    [
      'both title fields',
      'id: template-3\ncreatedAt: 2026-07-22T12:00:00.000Z\ntitle: Title\nfallbackTitle: Fallback'
    ],
    [
      'prompt status',
      'id: template-3\ncreatedAt: 2026-07-22T12:00:00.000Z\ntitle: Title\nstatus: Todo'
    ]
  ])('rejects %s', (_caseName, frontmatter) => {
    expect(parsePromptTemplateMarkdown(`---\n${frontmatter}\n---\nText`)).toBeNull()
  })
})
