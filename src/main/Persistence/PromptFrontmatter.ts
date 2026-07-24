import matter from 'gray-matter'
import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import { normalizePromptTitle } from '@shared/promptFallbackTitle'

type PromptFrontmatterData = Pick<PromptPersisted, 'id' | 'createdAt'> &
  ({ title: string; fallbackTitle?: never } | { title?: never; fallbackTitle: string }) &
  (
    | { status: PromptStatus.Completed; completedAt: string }
    | { status: PromptStatus.Todo | PromptStatus.InProgress; completedAt?: never }
  )

type PromptTemplateFrontmatterData = Pick<PromptTemplatePersisted, 'id' | 'createdAt'> &
  ({ title: string; fallbackTitle?: never } | { title?: never; fallbackTitle: string })

const isPromptFrontmatterData = (data: unknown): data is PromptFrontmatterData => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }

  const frontmatter = data as Record<string, unknown>
  const keys = Object.keys(frontmatter)
  if (keys.length !== 4 && keys.length !== 5) {
    return false
  }

  const hasTitle = keys.includes('title')
  const hasFallbackTitle = keys.includes('fallbackTitle')
  const hasStatus = keys.includes('status')
  const hasCompletedAt = keys.includes('completedAt')
  const allowedKeys = new Set([
    'id',
    'createdAt',
    hasTitle ? 'title' : 'fallbackTitle',
    'status',
    ...(hasCompletedAt ? ['completedAt'] : [])
  ])
  if (
    !keys.includes('id') ||
    !keys.includes('createdAt') ||
    !hasStatus ||
    hasTitle === hasFallbackTitle
  ) {
    return false
  }

  if (keys.some((key) => !allowedKeys.has(key))) {
    return false
  }

  const hasCompletedStatus = frontmatter.status === PromptStatus.Completed
  if (hasCompletedStatus !== hasCompletedAt) {
    return false
  }

  return (
    typeof frontmatter.id === 'string' &&
    typeof frontmatter.createdAt === 'string' &&
    (hasTitle
      ? typeof frontmatter.title === 'string'
      : typeof frontmatter.fallbackTitle === 'string') &&
    (frontmatter.status === PromptStatus.Todo ||
      frontmatter.status === PromptStatus.InProgress ||
      (hasCompletedStatus && typeof frontmatter.completedAt === 'string'))
  )
}

const isPromptTemplateFrontmatterData = (data: unknown): data is PromptTemplateFrontmatterData => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }

  const frontmatter = data as Record<string, unknown>
  const keys = Object.keys(frontmatter)
  const hasTitle = keys.includes('title')
  const hasFallbackTitle = keys.includes('fallbackTitle')

  return (
    keys.length === 3 &&
    keys.includes('id') &&
    keys.includes('createdAt') &&
    hasTitle !== hasFallbackTitle &&
    keys.every((key) =>
      new Set(['id', 'createdAt', hasTitle ? 'title' : 'fallbackTitle']).has(key)
    ) &&
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

const parseMarkdownContent = <TFrontmatter, TContent>(
  fileText: string,
  modifiedAt: string,
  isFrontmatter: (data: unknown) => data is TFrontmatter,
  createContent: (data: TFrontmatter, content: string, modifiedAt: string) => TContent
): TContent | null => {
  try {
    // Side effect: pass explicit options to avoid gray-matter's internal content cache path.
    const parsed = matter(fileText, {})
    return isFrontmatter(parsed.data)
      ? createContent(parsed.data, parsed.content, modifiedAt)
      : null
  } catch {
    return null
  }
}

const createTitleMetadata = (content: {
  id: string
  title: string
  fallbackTitle: string
  createdAt: string
}) => ({
  id: content.id,
  createdAt: content.createdAt,
  ...(normalizePromptTitle(content.title).length > 0
    ? { title: content.title }
    : { fallbackTitle: content.fallbackTitle })
})

const serializeMarkdownContent = (metadata: object, content: string): string => {
  const frontmatterDocument = matter.stringify('', metadata)
  const frontmatterPrefix = resolveFrontmatterPrefix(frontmatterDocument)
  // Side effect: keep markdown content exactly as provided; only prefix frontmatter.
  return `${frontmatterPrefix}${content}`
}

export const parsePromptMarkdown = (
  fileText: string,
  modifiedAt: string = ''
): PromptPersisted | null =>
  parseMarkdownContent(fileText, modifiedAt, isPromptFrontmatterData, (data, content, timestamp) => ({
    id: data.id,
    title: data.title ?? '',
    fallbackTitle: data.fallbackTitle ?? '',
    createdAt: data.createdAt,
    modifiedAt: timestamp,
    promptText: content,
    status: data.status,
    ...(data.status === PromptStatus.Completed ? { completedAt: data.completedAt } : {})
  }))

export const serializePromptMarkdown = (prompt: PromptPersisted): string => {
  const baseMetadata = createTitleMetadata(prompt)
  const metadata: PromptFrontmatterData =
    prompt.status === PromptStatus.Completed && prompt.completedAt
      ? {
          ...baseMetadata,
          status: PromptStatus.Completed,
          completedAt: prompt.completedAt
        }
      : {
          ...baseMetadata,
          status:
            prompt.status === PromptStatus.InProgress ? PromptStatus.InProgress : PromptStatus.Todo
        }
  return serializeMarkdownContent(metadata, prompt.promptText)
}

export const parsePromptTemplateMarkdown = (
  fileText: string,
  modifiedAt: string = ''
): PromptTemplatePersisted | null =>
  parseMarkdownContent(
    fileText,
    modifiedAt,
    isPromptTemplateFrontmatterData,
    (data, content, timestamp) => ({
      id: data.id,
      title: data.title ?? '',
      fallbackTitle: data.fallbackTitle ?? '',
      createdAt: data.createdAt,
      modifiedAt: timestamp,
      templateText: content
    })
  )

export const serializePromptTemplateMarkdown = (template: PromptTemplatePersisted): string => {
  const metadata: PromptTemplateFrontmatterData = createTitleMetadata(template)
  return serializeMarkdownContent(metadata, template.templateText)
}
