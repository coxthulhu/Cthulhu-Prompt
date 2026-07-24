import type { MarkdownContentPersisted } from '@shared/MarkdownContent'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import type { CommittedEntry } from '../Data/CommittedStore'
import type { MarkdownPersistenceFields } from '../Persistence/MarkdownPersistence'

export type MarkdownFilenameTarget<
  TContent extends MarkdownContentPersisted,
  TPersistenceFields extends MarkdownPersistenceFields
> = {
  contentId: string
  content: TContent
  persistenceFields: TPersistenceFields
}

type MarkdownFilenameTargetOverride<
  TContent extends MarkdownContentPersisted,
  TPersistenceFields extends MarkdownPersistenceFields
> = Omit<MarkdownFilenameTarget<TContent, TPersistenceFields>, 'contentId'>

export const planMarkdownFilenamePersistenceFields = <
  TContent extends MarkdownContentPersisted,
  TPersistenceFields extends MarkdownPersistenceFields
>(params: {
  contentIds: string[]
  lookupContent: (
    contentId: string
  ) => CommittedEntry<TContent, TPersistenceFields> | null | undefined
  overridesByContentId?: Map<
    string,
    MarkdownFilenameTargetOverride<TContent, TPersistenceFields>
  >
}): Array<MarkdownFilenameTarget<TContent, TPersistenceFields>> => {
  const { contentIds, lookupContent, overridesByContentId = new Map() } = params
  const targets: Array<MarkdownFilenameTarget<TContent, TPersistenceFields>> = []

  for (const contentId of contentIds) {
    const override = overridesByContentId.get(contentId)
    if (override) {
      targets.push({ contentId, ...override })
      continue
    }

    const entry = lookupContent(contentId)
    if (entry) {
      targets.push({
        contentId,
        content: entry.committed,
        persistenceFields: entry.persistenceFields
      })
    }
  }

  const boundaryCounts = new Map<string, number>()
  for (const target of targets) {
    const boundary = sanitizePromptTitleForFilename(
      getPromptDisplayTitle(target.content)
    ).toLowerCase()
    boundaryCounts.set(boundary, (boundaryCounts.get(boundary) ?? 0) + 1)
  }

  return targets.map((target) => {
    const boundary = sanitizePromptTitleForFilename(
      getPromptDisplayTitle(target.content)
    ).toLowerCase()
    return {
      ...target,
      persistenceFields: {
        ...target.persistenceFields,
        needsFilenameIdSuffix: (boundaryCounts.get(boundary) ?? 0) > 1
      }
    }
  })
}

export const getPlannedMarkdownPersistenceFields = <
  TContent extends MarkdownContentPersisted,
  TPersistenceFields extends MarkdownPersistenceFields
>(
  plans: Array<MarkdownFilenameTarget<TContent, TPersistenceFields>>,
  contentId: string
): TPersistenceFields => plans.find((plan) => plan.contentId === contentId)!.persistenceFields

export const shouldUpdateMarkdownFilename = <
  TContent extends MarkdownContentPersisted,
  TPersistenceFields extends MarkdownPersistenceFields
>(
  plan: MarkdownFilenameTarget<TContent, TPersistenceFields>,
  lookupContent: (
    contentId: string
  ) => CommittedEntry<TContent, TPersistenceFields> | null | undefined
): boolean => {
  const expectedStem = buildPromptStem(
    getPromptDisplayTitle(plan.content),
    plan.contentId,
    plan.persistenceFields.needsFilenameIdSuffix
  )
  const currentFields = lookupContent(plan.contentId)?.persistenceFields

  return (
    plan.persistenceFields.promptStem !== expectedStem ||
    plan.persistenceFields.needsFilenameIdSuffix !== currentFields?.needsFilenameIdSuffix
  )
}
