import { describe, expect, it } from 'vitest'
import {
  applyPromptTemplates,
  hasPromptTextToken
} from '@renderer/features/prompt-editor/promptTemplatingEngine'

describe('prompt templating engine', () => {
  it('replaces every prompt text token', () => {
    expect(
      applyPromptTemplates('Prompt', [
        'First [[PROMPT_TEXT]] between [[PROMPT_TEXT]] last'
      ])
    ).toBe('First Prompt between Prompt last')
  })

  it('applies selected templates in order', () => {
    expect(
      applyPromptTemplates('Prompt', [
        'Inner [[PROMPT_TEXT]] wrapper',
        'Template prefix\n\n[[PROMPT_TEXT]]\n\nTemplate suffix'
      ])
    ).toBe('Template prefix\n\nInner Prompt wrapper\n\nTemplate suffix')
  })

  it('ignores templates without the prompt text token', () => {
    expect(applyPromptTemplates('Prompt', ['No insertion point'])).toBe('Prompt')
    expect(hasPromptTextToken('[[prompt_text]]')).toBe(false)
  })
})
