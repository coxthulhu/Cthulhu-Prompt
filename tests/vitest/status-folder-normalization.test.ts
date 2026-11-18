import { describe, expect, it } from 'vitest'
import {
  hasStatusFolderNormalizationChanges,
  normalizeContentForStatusFolder
} from '../../src/main/Persistence/StatusFolderNormalization'
import { createFinalizedAtMetadata } from '../../src/main/Persistence/PromptFrontmatter'
import { PromptStatus, type PromptContentStatus } from '@shared/domain/prompt/Prompt'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'

const FINALIZED_AT = '2026-08-30T12:00:00Z'

/** Loaded markdown content as parsed before status-folder normalization. */
type LoadedContent = { id: string; status?: PromptContentStatus; finalizedAt?: string }

/** Normalizes one loaded fixture with its widened content type. */
const normalize = (content: LoadedContent, folderPath: string, kind: 'prompt' | 'template'): LoadedContent =>
  normalizeContentForStatusFolder(content, folderPath, kind)

describe('status-folder normalization', () => {
  it('keeps a prompt status its Active folder owns and drops stray finalization', () => {
    const normalized = normalize(
      { id: 'prompt', status: PromptStatus.InProgress, finalizedAt: FINALIZED_AT },
      'Root\\Active',
      'prompt'
    )
    expect(normalized).toEqual({ id: 'prompt', status: PromptStatus.InProgress })
  })

  it('keeps the recorded finalization time when a final folder changes the status', () => {
    const normalized = normalize(
      { id: 'prompt', status: PromptStatus.Completed, finalizedAt: FINALIZED_AT },
      'Root\\Archived',
      'prompt'
    )
    expect(normalized).toEqual({ id: 'prompt', status: PromptStatus.Archived, finalizedAt: FINALIZED_AT })
  })

  it('adds a finalization time when a final folder has none', () => {
    const normalized = normalize(
      { id: 'prompt', status: PromptStatus.Todo },
      'Root\\Completed',
      'prompt'
    )
    expect(normalized.status).toBe(PromptStatus.Completed)
    expect(normalized.finalizedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('maps template folders to template statuses', () => {
    expect(
      normalize({ id: 'template' }, 'Templates\\Archived', 'template')
    ).toMatchObject({ status: PromptTemplateStatus.Archived })
    expect(
      normalize(
        { id: 'template', status: PromptTemplateStatus.Archived, finalizedAt: FINALIZED_AT },
        'Templates\\Active',
        'template'
      )
    ).toEqual({ id: 'template', status: PromptTemplateStatus.Active })
  })

  it('loads unknown folders as Active', () => {
    expect(
      normalize({ id: 'prompt', status: PromptStatus.Completed }, 'Root\\Unknown', 'prompt')
    ).toEqual({ id: 'prompt', status: PromptStatus.Todo })
  })

  it('reports rewrites only for status or finalization changes', () => {
    expect(
      hasStatusFolderNormalizationChanges(
        { status: PromptStatus.Archived, finalizedAt: FINALIZED_AT },
        { status: PromptStatus.Archived, finalizedAt: FINALIZED_AT }
      )
    ).toBe(false)
    expect(
      hasStatusFolderNormalizationChanges(
        { status: PromptStatus.Completed, finalizedAt: FINALIZED_AT },
        { status: PromptStatus.Archived, finalizedAt: FINALIZED_AT }
      )
    ).toBe(true)
  })

  it('writes finalization metadata only for final statuses that carry a time', () => {
    expect(createFinalizedAtMetadata({ status: PromptTemplateStatus.Archived })).toEqual({})
    expect(createFinalizedAtMetadata({ status: PromptStatus.Todo, finalizedAt: FINALIZED_AT })).toEqual({})
    expect(
      createFinalizedAtMetadata({ status: PromptTemplateStatus.Archived, finalizedAt: FINALIZED_AT })
    ).toEqual({ finalizedAt: FINALIZED_AT })
  })
})
