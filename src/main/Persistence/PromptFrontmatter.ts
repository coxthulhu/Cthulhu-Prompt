import matter from 'gray-matter'
import type { PromptPersisted } from '@shared/Prompt'
import { normalizePromptTitle } from '@shared/promptFallbackTitle'

type PromptFrontmatterData = Pick<PromptPersisted, 'id' | 'createdAt'> &
  ({ title: string; fallbackTitle?: never } | { title?: never; fallbackTitle: string })

const isPromptFrontmatterData = (data: unknown): data is PromptFrontmatterData => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }

  const frontmatter = data as Record<string, unknown>
  const keys = Object.keys(frontmatter)
  if (keys.length !== 3) {
    return false
  }

  const hasTitle = keys.includes('title')
  const hasFallbackTitle = keys.includes('fallbackTitle')
  if (!keys.includes('id') || !keys.includes('createdAt') || hasTitle === hasFallbackTitle) {
    return false
  }

  return (
    typeof frontmatter.id === 'string' &&
    typeof frontmatter.createdAt === 'string' &&
    (hasTitle
      ? typeof frontmatter.title === 'string'
      : typeof frontmatter.fallbackTitle === 'string')
  )
}

const resolveFrontmatterPrefix = (document: string): string => {
  const frontmatterPrefixMatch = document.match(/^---\n[\s\S]*?\n---\n/)
  if (!frontmatterPrefixMatch) {
    throw new Error('Failed to serialize prompt frontmatter')
  }
  return frontmatterPrefixMatch[0]
}

export const parsePromptMarkdown = (
  fileText: string,
  modifiedAt: string = ''
): PromptPersisted | null => {
  try {
    // Side effect: pass explicit options to avoid gray-matter's internal content cache path.
    const parsed = matter(fileText, {})
    if (!isPromptFrontmatterData(parsed.data)) {
      return null
    }

    return {
      id: parsed.data.id,
      title: parsed.data.title ?? '',
      fallbackTitle: parsed.data.fallbackTitle ?? '',
      createdAt: parsed.data.createdAt,
      modifiedAt,
      promptText: parsed.content
    }
  } catch {
    return null
  }
}

export const serializePromptMarkdown = (prompt: PromptPersisted): string => {
  const metadata: PromptFrontmatterData = {
    id: prompt.id,
    createdAt: prompt.createdAt,
    ...(normalizePromptTitle(prompt.title).length > 0
      ? { title: prompt.title }
      : { fallbackTitle: prompt.fallbackTitle })
  }
  const frontmatterDocument = matter.stringify('', metadata)
  const frontmatterPrefix = resolveFrontmatterPrefix(frontmatterDocument)

  // Side effect: keep promptText exactly as provided; only prefix frontmatter.
  return `${frontmatterPrefix}${prompt.promptText}`
}
