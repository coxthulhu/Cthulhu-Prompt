import type { Note } from '@shared/domain/note/Note'
import { isFinalPromptStatus, isPromptStatus } from '@shared/domain/prompt/Prompt'
import { isPromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { parseMarkdownFrontmatter, serializeMarkdownFrontmatter } from './MarkdownFrontmatter'

/** Parses either minimal attachment metadata or a complete standalone note. */
export const parseNoteMarkdown = (source: string, modifiedAt = ''): Note | null => {
  try {
    /** Parsed front matter and unmodified Markdown body. */
    const { data, content } = parseMarkdownFrontmatter(source)
    if (typeof data.id !== 'string') return null
    /** Common record fields; modification time belongs to the filesystem. */
    const base = { id: data.id, noteText: content, modifiedAt }
    if (Object.keys(data).length === 1) return { ...base, kind: 'attached' }
    /** Exactly one title representation is persisted, like prompts and templates. */
    const hasTitle = typeof data.title === 'string'
    /** Permitted standalone metadata, including optional category and finalization. */
    const allowed = new Set(['id', 'createdAt', hasTitle ? 'title' : 'fallbackTitle', 'category', 'status', 'finalizedAt'])
    if (Object.keys(data).some((key) => !allowed.has(key)) ||
      typeof data.createdAt !== 'string' ||
      (!hasTitle && typeof data.fallbackTitle !== 'string') ||
      (data.category !== undefined && typeof data.category !== 'string') ||
      (!isPromptStatus(data.status) && !isPromptTemplateStatus(data.status)) ||
      (isFinalPromptStatus(data.status)
        ? typeof data.finalizedAt !== 'string'
        : data.finalizedAt !== undefined)) return null
    return {
      ...base, kind: 'standalone', title: data.title ?? '', fallbackTitle: data.fallbackTitle ?? '',
      createdAt: data.createdAt, status: data.status,
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.finalizedAt !== undefined ? { finalizedAt: data.finalizedAt } : {})
    }
  } catch {
    return null
  }
}

/** Writes only attachment identity until detachment supplies independent metadata. */
export const serializeNoteMarkdown = (note: Note): string => serializeMarkdownFrontmatter(
  note.kind === 'attached' ? { id: note.id } : {
    id: note.id, createdAt: note.createdAt,
    ...(note.title.trim() ? { title: note.title } : { fallbackTitle: note.fallbackTitle }),
    ...(note.category !== undefined ? { category: note.category } : {}),
    status: note.status,
    ...(note.finalizedAt ? { finalizedAt: note.finalizedAt } : {})
  }, note.noteText
)
