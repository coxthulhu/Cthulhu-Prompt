import * as path from 'path'
import { vol } from 'memfs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { serializePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import { readPromptStemByPromptId } from '../../src/main/Persistence/workspace/WorkspaceReads'
import { PromptStatus } from '@shared/domain/prompt/Prompt'

const workspacePath = '/ws/scan'
const folderPath = path.join(workspacePath, 'Prompts', 'Root', 'Active')

/** Serialized prompt file sharing one stable ID across copies. */
const promptFile = (title: string): string =>
  serializePromptMarkdown({
    id: 'shared-id',
    title,
    fallbackTitle: '',
    createdAt: '2026-08-30T12:00:00Z',
    modifiedAt: '2026-08-30T12:00:00Z',
    status: PromptStatus.Todo,
    promptText: title
  })

beforeEach(() => {
  vol.reset()
  setFs(vol)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('markdown content scanning', () => {
  it('keeps the first file in name order when copies share an ID', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vol.fromJSON({
      [path.join(folderPath, 'B Copy.prompt.md')]: promptFile('Copy'),
      [path.join(folderPath, 'A Original.prompt.md')]: promptFile('Original')
    })

    expect(readPromptStemByPromptId(workspacePath, path.join('Root', 'Active'))).toEqual(
      new Map([['shared-id', 'A Original']])
    )
    expect(warn).toHaveBeenCalledOnce()
  })
})
