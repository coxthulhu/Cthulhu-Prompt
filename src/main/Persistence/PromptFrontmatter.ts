import matter from 'gray-matter'
import type { PromptPersisted } from '@shared/Prompt'

type PromptFrontmatterData = Omit<PromptPersisted, 'promptText'>

const isPromptFrontmatterData = (data: unknown): data is PromptFrontmatterData => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }

  const frontmatter = data as Partial<PromptFrontmatterData>
  const keys = Object.keys(frontmatter)
  if (keys.length !== 4) {
    return false
  }

  if (
    !keys.includes('id') ||
    !keys.includes('title') ||
    !keys.includes('createdAt') ||
    !keys.includes('promptFolderCount')
  ) {
    return false
  }

  return (
    typeof frontmatter.id === 'string' &&
    typeof frontmatter.title === 'string' &&
    typeof frontmatter.createdAt === 'string' &&
    typeof frontmatter.promptFolderCount === 'number'
  )
}

const resolveFrontmatterPrefix = (document: string): string => {
  const frontmatterPrefixMatch = document.match(/^---\n[\s\S]*?\n---\n/)
  if (!frontmatterPrefixMatch) {
    throw new Error('Failed to serialize prompt frontmatter')
  }
  return frontmatterPrefixMatch[0]
}

export const parsePromptMarkdown = (fileText: string): PromptPersisted | null => {
  try {
    // Side effect: pass explicit options to avoid gray-matter's internal content cache path.
    const parsed = matter(fileText, {})
    if (!isPromptFrontmatterData(parsed.data)) {
      return null
    }

    return {
      id: parsed.data.id,
      title: parsed.data.title,
      createdAt: parsed.data.createdAt,
      promptFolderCount: parsed.data.promptFolderCount,
      promptText: parsed.content
    }
  } catch {
    return null
  }
}

export const serializePromptMarkdown = (prompt: PromptPersisted): string => {
  const metadata: PromptFrontmatterData = {
    id: prompt.id,
    title: prompt.title,
    createdAt: prompt.createdAt,
    promptFolderCount: prompt.promptFolderCount
  }
  const frontmatterDocument = matter.stringify('', metadata)
  const frontmatterPrefix = resolveFrontmatterPrefix(frontmatterDocument)

  // Side effect: keep promptText exactly as provided; only prefix frontmatter.
  return `${frontmatterPrefix}${prompt.promptText}`
}
