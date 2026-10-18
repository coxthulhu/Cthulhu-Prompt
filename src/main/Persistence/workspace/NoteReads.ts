import * as path from 'path'
import type { Note } from '@shared/domain/note/Note'
import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import { getFs } from '../../fs-provider'
import { NOTE_MARKDOWN_FILENAME_SUFFIX, resolvePromptDirectoryPath } from '../PromptPersistencePaths'
import { parseNoteMarkdown } from '../NoteFrontmatter'

/** Discovers valid note files in one physical status folder. */
export const readNoteFiles = (
  workspacePath: string, folderPath: string, kind: PromptCollectionKind
): Array<{ stem: string; note: Note }> => {
  /** Filesystem and library-aware physical directory. */
  const fs = getFs()
  /** Physical folder shared with prompts or templates. */
  const directory = resolvePromptDirectoryPath(workspacePath, folderPath, kind)
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).sort().flatMap((name) => {
    if (!name.endsWith(NOTE_MARKDOWN_FILENAME_SUFFIX)) return []
    /** Stable identity and metadata parsed from the discovered note. */
    const note = parseNoteMarkdown(fs.readFileSync(path.join(directory, name), 'utf8'))
    return note ? [{ stem: name.slice(0, -NOTE_MARKDOWN_FILENAME_SUFFIX.length), note }] : []
  })
}
