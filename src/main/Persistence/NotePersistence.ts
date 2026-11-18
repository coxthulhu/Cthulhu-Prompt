import type { Note } from '@shared/domain/note/Note'
import { createMarkdownPersistence } from './MarkdownPersistence'
import { parseNoteMarkdown, serializeNoteMarkdown } from './NoteFrontmatter'
import {
  hasStatusFolderNormalizationChanges,
  normalizeContentForStatusFolder
} from './StatusFolderNormalization'

/** Notes share Markdown staging while retaining their collection's library and workflow. */
export const notePersistence = createMarkdownPersistence<Note>({
  kind: 'note', parseMarkdown: parseNoteMarkdown, serializeMarkdown: serializeNoteMarkdown,
  normalizeLoadedData: (note, folderPath, fields) => note.kind === 'attached'
    ? note
    // Standalone notes follow their collection's status folders, like prompts and templates.
    : normalizeContentForStatusFolder(note, folderPath, fields.collectionKind ?? 'prompt'),
  // Attached notes carry no workflow metadata, so only standalone notes can need a rewrite.
  shouldRewriteNormalizedData: (loaded, normalized) =>
    loaded.kind === 'standalone' &&
    normalized.kind === 'standalone' &&
    hasStatusFolderNormalizationChanges(loaded, normalized)
})
