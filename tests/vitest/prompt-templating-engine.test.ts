import { describe, expect, it } from 'vitest'
import {
  applyPromptTemplates,
  createPromptFolderTemplate,
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

  it('applies folder and selected templates in order', () => {
    const ownerFolder = createPromptFolderTemplate('Owner prefix', 'Owner suffix')
    const parentFolder = createPromptFolderTemplate('Parent prefix', 'Parent suffix')

    expect(
      applyPromptTemplates('Prompt', [
        ownerFolder,
        parentFolder,
        'Template prefix\n\n[[PROMPT_TEXT]]\n\nTemplate suffix'
      ])
    ).toBe(
      'Template prefix\n\nParent prefix\n\nOwner prefix\n\nPrompt\n\nOwner suffix\n\nParent suffix\n\nTemplate suffix'
    )
  })

  it('ignores templates without the prompt text token', () => {
    expect(applyPromptTemplates('Prompt', ['No insertion point'])).toBe('Prompt')
    expect(hasPromptTextToken('[[prompt_text]]')).toBe(false)
  })
})
