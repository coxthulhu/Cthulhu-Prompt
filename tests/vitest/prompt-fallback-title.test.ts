import { describe, expect, it } from 'vitest'
import {
  getPromptDisplayTitle,
  resolvePromptTitleUpdate,
  resolvePromptTitleUpdateForPromptIds,
  type PromptFallbackTitleCandidate
} from '@shared/promptFallbackTitle'

const prompts: PromptFallbackTitleCandidate[] = [
  { id: 'active-new-prompt', title: 'New Prompt', fallbackTitle: '' },
  { id: 'fallback-new-prompt', title: '', fallbackTitle: 'New Prompt' }
]

describe('prompt fallback title helpers', () => {
  it('shows the explicit title before the fallback title', () => {
    expect(getPromptDisplayTitle({ title: 'Custom title', fallbackTitle: 'New Prompt' })).toBe(
      'Custom title'
    )
  })

  it('shows the fallback title when the explicit title is blank', () => {
    expect(getPromptDisplayTitle({ title: '   ', fallbackTitle: 'New Prompt' })).toBe('New Prompt')
  })

  it('clears the fallback title when setting an explicit title', () => {
    expect(
      resolvePromptTitleUpdate({
        prompts,
        promptId: 'fallback-new-prompt',
        currentTitle: '',
        currentFallbackTitle: 'New Prompt',
        nextTitle: 'Renamed prompt'
      })
    ).toEqual({ title: 'Renamed prompt', fallbackTitle: '' })
  })

  it('regenerates from the base fallback when clearing an explicit title', () => {
    expect(
      resolvePromptTitleUpdate({
        prompts,
        promptId: 'clear-title-target',
        currentTitle: 'Clear Me',
        currentFallbackTitle: 'Old fallback',
        nextTitle: ''
      })
    ).toEqual({ title: '', fallbackTitle: 'New Prompt 1' })
  })

  it('preserves an already untitled prompt fallback when it is available', () => {
    expect(
      resolvePromptTitleUpdate({
        prompts,
        promptId: 'existing-untitled',
        currentTitle: '',
        currentFallbackTitle: 'New Prompt 2',
        nextTitle: ''
      })
    ).toEqual({ title: '', fallbackTitle: 'New Prompt 2' })
  })

  it('deduplicates an already untitled prompt fallback when it collides', () => {
    expect(
      resolvePromptTitleUpdate({
        prompts,
        promptId: 'existing-untitled',
        currentTitle: '',
        currentFallbackTitle: 'New Prompt',
        nextTitle: ''
      })
    ).toEqual({ title: '', fallbackTitle: 'New Prompt 1' })
  })

  it('resolves sibling candidates from prompt ids', () => {
    const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]))

    expect(
      resolvePromptTitleUpdateForPromptIds({
        promptIds: ['active-new-prompt', 'missing-prompt', 'fallback-new-prompt'],
        lookupPrompt: (promptId) => promptById.get(promptId),
        promptId: 'new-prompt',
        nextTitle: ''
      })
    ).toEqual({ title: '', fallbackTitle: 'New Prompt 1' })
  })
})
