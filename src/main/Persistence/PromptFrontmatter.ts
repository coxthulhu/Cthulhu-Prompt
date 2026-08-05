import matter from 'gray-matter'
import {
  PromptStatus,
  type PromptPersisted,
  type PromptTemplateReference
} from '@shared/Prompt'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import { normalizePromptTitle } from '@shared/promptFallbackTitle'

// Current and legacy template fields accepted while workspace startup migrates prompt files.
type PromptSelectionFrontmatterData =
  | { templates?: PromptTemplateReference[] | null; templateId?: never }
  | { templates?: never; templateId?: string | null }

type PromptFrontmatterData = Pick<PromptPersisted, 'id' | 'createdAt'> &
  PromptSelectionFrontmatterData &
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
  const hasTitle = keys.includes('title')
  const hasFallbackTitle = keys.includes('fallbackTitle')
  const hasStatus = keys.includes('status')
  const hasCompletedAt = keys.includes('completedAt')
  const hasTemplates = keys.includes('templates')
  const hasLegacyTemplateId = keys.includes('templateId')
  const allowedKeys = new Set([
    'id',
    'createdAt',
    hasTitle ? 'title' : 'fallbackTitle',
    ...(hasTemplates ? ['templates'] : []),
    ...(hasLegacyTemplateId ? ['templateId'] : []),
    'status',
    ...(hasCompletedAt ? ['completedAt'] : [])
  ])
  if (
    keys.length !== allowedKeys.size ||
    !keys.includes('id') ||
    !keys.includes('createdAt') ||
    !hasStatus ||
    hasTitle === hasFallbackTitle ||
    (hasTemplates && hasLegacyTemplateId)
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
    (!hasTemplates ||
      frontmatter.templates === null ||
      (Array.isArray(frontmatter.templates) &&
        frontmatter.templates.every(
          (template) =>
            typeof template === 'object' &&
            template !== null &&
            !Array.isArray(template) &&
            Object.keys(template).length === 1 &&
            typeof (template as Record<string, unknown>).id === 'string'
        ))) &&
    (!hasLegacyTemplateId ||
      frontmatter.templateId === null ||
      typeof frontmatter.templateId === 'string') &&
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
    ...(data.templates !== undefined
      ? { templates: data.templates }
      : data.templateId !== undefined
        ? { templates: data.templateId === null ? null : [{ id: data.templateId }] }
        : {}),
    status: data.status,
    ...(data.status === PromptStatus.Completed ? { completedAt: data.completedAt } : {})
  }))

export const serializePromptMarkdown = (prompt: PromptPersisted): string => {
  const baseMetadata = createTitleMetadata(prompt)
  const metadata: PromptFrontmatterData =
    prompt.status === PromptStatus.Completed && prompt.completedAt
      ? {
          ...baseMetadata,
          ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
          status: PromptStatus.Completed,
          completedAt: prompt.completedAt
        }
      : {
          ...baseMetadata,
          ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
          status:
            prompt.status === PromptStatus.InProgress ? PromptStatus.InProgress : PromptStatus.Todo
        }
  return serializeMarkdownContent(metadata, prompt.promptText)
}

// Detects legacy prompt template metadata so startup rewrites only files that need migration.
export const promptMarkdownHasLegacyTemplateId = (fileText: string): boolean => {
  try {
    const parsed = matter(fileText, {})
    return (
      typeof parsed.data === 'object' &&
      parsed.data !== null &&
      !Array.isArray(parsed.data) &&
      Object.keys(parsed.data).includes('templateId')
    )
  } catch {
    return false
  }
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
