import { parseMarkdownFrontmatter, serializeMarkdownFrontmatter } from './MarkdownFrontmatter'
import {
  isFinalPromptStatus,
  isPromptStatus,
  PromptStatus,
  type PromptPersisted,
  type PromptTemplateReference
} from '@shared/domain/prompt/Prompt'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import { normalizePromptTitle } from '@shared/domain/prompt/promptFallbackTitle'

type PromptFrontmatterData = Pick<PromptPersisted, 'id' | 'createdAt' | 'category'> &
  { templates?: PromptTemplateReference[] | null } &
  ({ title: string; fallbackTitle?: never } | { title?: never; fallbackTitle: string }) &
  {
    status: PromptStatus
    finalizedAt?: string
  }

type PromptTemplateFrontmatterData = Pick<
  PromptTemplatePersisted,
  'id' | 'createdAt' | 'category' | 'status' | 'finalizedAt'
> &
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
  const hasFinalizedAt = keys.includes('finalizedAt')
  const hasTemplates = keys.includes('templates')
  const hasCategory = keys.includes('category')
  const allowedKeys = new Set([
    'id',
    'createdAt',
    hasTitle ? 'title' : 'fallbackTitle',
    ...(hasTemplates ? ['templates'] : []),
    ...(hasCategory ? ['category'] : []),
    'status',
    ...(hasFinalizedAt ? ['finalizedAt'] : [])
  ])
  if (
    keys.length !== allowedKeys.size ||
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

  if (!isPromptStatus(frontmatter.status)) return false
  const hasFinalStatus = isFinalPromptStatus(frontmatter.status)
  if (hasFinalStatus !== hasFinalizedAt) return false

  return (
    typeof frontmatter.id === 'string' &&
    typeof frontmatter.createdAt === 'string' &&
    (!hasCategory || typeof frontmatter.category === 'string') &&
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
    (hasTitle
      ? typeof frontmatter.title === 'string'
      : typeof frontmatter.fallbackTitle === 'string') &&
    (!hasFinalStatus || typeof frontmatter.finalizedAt === 'string')
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
  const hasCategory = keys.includes('category')

  return (
    keys.length === (hasCategory ? 4 : 3) + (frontmatter.status === undefined ? 0 : 1) + (frontmatter.finalizedAt === undefined ? 0 : 1) &&
    (frontmatter.status === undefined || frontmatter.status === PromptStatus.Todo || frontmatter.status === PromptStatus.Archived) &&
    (frontmatter.status === PromptStatus.Archived ? typeof frontmatter.finalizedAt === 'string' : frontmatter.finalizedAt === undefined) &&
    keys.includes('id') &&
    keys.includes('createdAt') &&
    hasTitle !== hasFallbackTitle &&
    keys.every((key) =>
      new Set([
        'id',
        'createdAt',
        'status',
        'finalizedAt',
        hasTitle ? 'title' : 'fallbackTitle',
        ...(hasCategory ? ['category'] : [])
      ]).has(key)
    ) &&
    typeof frontmatter.id === 'string' &&
    typeof frontmatter.createdAt === 'string' &&
    (!hasCategory || typeof frontmatter.category === 'string') &&
    (hasTitle
      ? typeof frontmatter.title === 'string'
      : typeof frontmatter.fallbackTitle === 'string')
  )
}

const parseMarkdownContent = <TFrontmatter, TContent>(
  fileText: string,
  modifiedAt: string,
  isFrontmatter: (data: unknown) => data is TFrontmatter,
  createContent: (data: TFrontmatter, content: string, modifiedAt: string) => TContent
): TContent | null => {
  try {
    const parsed = parseMarkdownFrontmatter(fileText)
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
    ...(data.category !== undefined ? { category: data.category } : {}),
    promptText: content,
    ...(data.templates !== undefined ? { templates: data.templates } : {}),
    status: data.status,
    ...(isFinalPromptStatus(data.status) ? { finalizedAt: data.finalizedAt } : {})
  }))

export const serializePromptMarkdown = (prompt: PromptPersisted): string => {
  const baseMetadata = createTitleMetadata(prompt)
  /** Registry-compatible metadata preserving the exact current prompt status. */
  const metadata: PromptFrontmatterData = {
    ...baseMetadata,
    ...(prompt.category !== undefined ? { category: prompt.category } : {}),
    ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
    status: prompt.status,
    ...(isFinalPromptStatus(prompt.status) && prompt.finalizedAt
      ? { finalizedAt: prompt.finalizedAt }
      : {})
  }
  return serializeMarkdownFrontmatter(metadata, prompt.promptText)
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
      ...(data.category !== undefined ? { category: data.category } : {}),
      status: data.status ?? PromptStatus.Todo,
      ...(data.finalizedAt ? { finalizedAt: data.finalizedAt } : {}),
      templateText: content
    })
  )

export const serializePromptTemplateMarkdown = (template: PromptTemplatePersisted): string => {
  const metadata: PromptTemplateFrontmatterData = {
    ...createTitleMetadata(template),
    ...(template.status === PromptStatus.Archived ? { status: template.status, finalizedAt: template.finalizedAt } : {}),
    ...(template.category !== undefined ? { category: template.category } : {})
  }
  return serializeMarkdownFrontmatter(metadata, template.templateText)
}
