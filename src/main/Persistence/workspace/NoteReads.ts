import type { Note } from '@shared/domain/note/Note'
import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import { scanMarkdownFiles } from './MarkdownFileScan'
import { NOTE_MARKDOWN_FILENAME_SUFFIX, resolvePromptDirectoryPath } from '../PromptPersistencePaths'
import { parseNoteMarkdown } from '../NoteFrontmatter'

/** Discovers valid note files in one physical status folder. */
export const readNoteFiles = (
  workspacePath: string, folderPath: string, kind: PromptCollectionKind
): Array<{ stem: string; note: Note }> => {
  /** Physical folder shared with prompts or templates. */
  const directory = resolvePromptDirectoryPath(workspacePath, folderPath, kind)
  return scanMarkdownFiles(directory, [NOTE_MARKDOWN_FILENAME_SUFFIX], (fileText) =>
    parseNoteMarkdown(fileText)
  ).map((file) => ({ stem: file.stem, note: file.parsed }))
}
