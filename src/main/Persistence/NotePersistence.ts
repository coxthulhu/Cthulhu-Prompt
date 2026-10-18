import type { Note } from '@shared/domain/note/Note'
import { getPromptStatusFolderDefinition, isPromptStatus, PROMPT_STATUS_FOLDERS } from '@shared/domain/prompt/Prompt'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { createMarkdownPersistence } from './MarkdownPersistence'
import { parseNoteMarkdown, serializeNoteMarkdown } from './NoteFrontmatter'

/** Notes share Markdown staging while retaining their collection's library and workflow. */
export const notePersistence = createMarkdownPersistence<Note>({
  kind: 'note', parseMarkdown: parseNoteMarkdown, serializeMarkdown: serializeNoteMarkdown,
  normalizeLoadedData: (note, folderPath, fields) => {
    if (note.kind === 'attached') return note
    /** Physical folder is authoritative, as for prompts and templates. */
    const folder = PROMPT_STATUS_FOLDERS.find((candidate) => candidate.directoryName === folderPath.split(/[\\/]/).at(-1))!
    /** Retain Todo/InProgress when both map to the same Active directory. */
    const status = fields.collectionKind === 'template'
      ? folder.isFinal ? PromptTemplateStatus.Archived : PromptTemplateStatus.Active
      : isPromptStatus(note.status) && getPromptStatusFolderDefinition(note.status).id === folder.id
        ? note.status : folder.entryStatus
    /** Finalization is present only in final folders. */
    const { finalizedAt, ...content } = note
    return { ...content, status, ...(folder.isFinal ? { finalizedAt: finalizedAt ?? getCurrentIsoSecondTimestamp() } : {}) }
  },
  shouldRewriteNormalizedData: (before, after) => JSON.stringify(before) !== JSON.stringify(after)
})
