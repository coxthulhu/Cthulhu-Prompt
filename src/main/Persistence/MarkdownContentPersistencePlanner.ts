import type { DomainEntityMap } from '@shared/DomainChanges'
import { getActiveMarkdownContentIds } from '@shared/MarkdownContent'
import type { PromptFolder, PromptFolderContentKind } from '@shared/PromptFolder'
import type { CommittedEntry } from '../Data/CommittedStore'
import {
  planMarkdownFilenamePersistenceFields,
  shouldUpdateMarkdownFilename
} from '../Mutations/MarkdownContentMutationHelpers'
import {
  buildDomainPersistenceKey,
  type DomainPersistencePlanningContext
} from './DomainPersistencePlanning'
import type { MarkdownPersistenceFields } from './MarkdownPersistence'
import type { PersistenceChange } from './PersistenceTypes'
import { resolveActivePromptFolderName } from './PromptPersistencePaths'

/** Domain entity types whose authoritative data is persisted as markdown. */
type MarkdownContentEntityType = 'prompt' | 'promptTemplate'

/** Static entity identity used to run shared prompt or template persistence planning. */
type MarkdownContentPlannerConfig = {
  entityType: MarkdownContentEntityType
  kind: PromptFolderContentKind
}

/** Finds the projected active root that owns one prompt or template reference. */
const findProjectedContentOwner = (
  context: DomainPersistencePlanningContext,
  kind: PromptFolderContentKind,
  contentId: string
): PromptFolder | undefined =>
  context.projectedPromptFolders.find(
    (folder) =>
      folder.kind === kind && getActiveMarkdownContentIds(folder, kind).includes(contentId)
  )

/** Resolves persistence fields after an optional cross-root content movement. */
const resolveMarkdownPersistenceFields = (
  context: DomainPersistencePlanningContext,
  kind: PromptFolderContentKind,
  contentId: string,
  currentFields: MarkdownPersistenceFields
): MarkdownPersistenceFields => {
  /** Projected root owning the active content after this mutation. */
  const projectedOwner = findProjectedContentOwner(context, kind, contentId)
  if (!projectedOwner || projectedOwner.id === currentFields.promptFolderId) return currentFields

  /** Current source root providing the previous physical folder path. */
  const currentOwner = context.getCommittedEntry('promptFolder', currentFields.promptFolderId)
  /** Destination root providing the target workspace and logical folder path. */
  const destinationOwner = context.getCommittedEntry('promptFolder', projectedOwner.id)
  if (!currentOwner || !destinationOwner) {
    throw new Error('Markdown content persistence owner not loaded')
  }

  /** Source folder persistence fields used to remove the previous markdown path. */
  const sourceFields = currentOwner.persistenceFields as {
    folderPath: string
    kind: PromptFolderContentKind
  }
  /** Destination folder persistence fields used to create the target markdown path. */
  const destinationFields = destinationOwner.persistenceFields as {
    workspaceId: string
    workspacePath: string
    folderPath: string
    kind: PromptFolderContentKind
  }
  return {
    ...currentFields,
    workspaceId: destinationFields.workspaceId,
    workspacePath: destinationFields.workspacePath,
    folderPath: resolveActivePromptFolderName(destinationFields.folderPath, kind),
    previousFolderPath: resolveActivePromptFolderName(sourceFields.folderPath, kind),
    promptFolderId: projectedOwner.id
  }
}

/** Refines changed content paths and collision-aware filenames for one markdown entity type. */
const planMarkdownEntityPersistenceChanges = (
  context: DomainPersistencePlanningContext,
  config: MarkdownContentPlannerConfig
): void => {
  /** Updated content IDs that may affect current or destination filename groups. */
  const changedContentIds = context.changes.flatMap((change) =>
    change.type === 'update' && change.entityType === config.entityType ? [change.id] : []
  )
  /** Root IDs whose active filename groups require replanning. */
  const affectedRootIds = new Set<string>()

  for (const contentId of changedContentIds) {
    /** Current content persistence fields identify its pre-mutation root. */
    const currentEntry = context.getCommittedEntry(config.entityType, contentId)
    if (!currentEntry) continue
    /** Current markdown fields refined if the content moved across roots. */
    const persistenceFields = resolveMarkdownPersistenceFields(
      context,
      config.kind,
      contentId,
      currentEntry.persistenceFields as MarkdownPersistenceFields
    )
    /** Existing target persistence write receiving movement-adjusted fields. */
    const targetKey = buildDomainPersistenceKey(config.entityType, contentId)
    /** Existing content update produced by baseline domain target planning. */
    const targetChange = context.persistenceChanges.get(targetKey)
    if (targetChange?.type === 'upsert') {
      context.persistenceChanges.set(targetKey, {
        ...targetChange,
        persistenceFields
      } as PersistenceChange)
    }
    affectedRootIds.add(
      (currentEntry.persistenceFields as MarkdownPersistenceFields).promptFolderId
    )
    /** Projected owner identifies its optional post-mutation root. */
    const projectedOwner = findProjectedContentOwner(context, config.kind, contentId)
    if (projectedOwner) affectedRootIds.add(projectedOwner.id)
  }

  for (const rootId of affectedRootIds) {
    /** Projected root whose active filename group is being recalculated. */
    const rootFolder = context.projectedPromptFolders.find((folder) => folder.id === rootId)
    if (!rootFolder || rootFolder.kind !== config.kind) continue
    /** Projected content and persistence overrides for domain-changed group members. */
    const overrides = new Map<
      string,
      {
        content: DomainEntityMap['prompt'] | DomainEntityMap['promptTemplate']
        persistenceFields: MarkdownPersistenceFields
      }
    >()
    for (const contentId of getActiveMarkdownContentIds(rootFolder, config.kind)) {
      /** Existing target persistence change containing projected data and movement fields. */
      const targetChange = context.persistenceChanges.get(
        buildDomainPersistenceKey(config.entityType, contentId)
      )
      if (targetChange?.type === 'upsert') {
        overrides.set(contentId, {
          content: targetChange.data as
            | DomainEntityMap['prompt']
            | DomainEntityMap['promptTemplate'],
          persistenceFields: targetChange.persistenceFields as MarkdownPersistenceFields
        })
      }
    }

    /** Collision-aware filename plans for the complete projected active group. */
    const plans = planMarkdownFilenamePersistenceFields({
      contentIds: getActiveMarkdownContentIds(rootFolder, config.kind),
      lookupContent: (contentId) =>
        context.getCommittedEntry(config.entityType, contentId) as CommittedEntry<
          DomainEntityMap['prompt'] | DomainEntityMap['promptTemplate'],
          MarkdownPersistenceFields
        >,
      overridesByContentId: overrides
    })
    for (const plan of plans) {
      /** Existing domain persistence change, if this filename belongs to a domain target. */
      const targetKey = buildDomainPersistenceKey(config.entityType, plan.contentId)
      /** Existing target write refined with the collision-aware filename plan. */
      const targetChange = context.persistenceChanges.get(targetKey)
      if (targetChange?.type === 'upsert') {
        context.persistenceChanges.set(targetKey, {
          ...targetChange,
          persistenceFields: plan.persistenceFields
        } as PersistenceChange)
        continue
      }
      if (
        !shouldUpdateMarkdownFilename(plan, (contentId) =>
          context.getCommittedEntry(config.entityType, contentId) as CommittedEntry<
            DomainEntityMap['prompt'] | DomainEntityMap['promptTemplate'],
            MarkdownPersistenceFields
          >
        )
      ) {
        continue
      }
      context.persistenceChanges.set(targetKey, {
        type: 'upsert',
        entityType: config.entityType,
        id: plan.contentId,
        data: plan.content,
        persistenceFields: plan.persistenceFields
      } as PersistenceChange)
    }
  }
}

/** Plans prompt and prompt-template persistence refinements through shared markdown logic. */
export const planMarkdownContentPersistenceChanges = (
  context: DomainPersistencePlanningContext
): void => {
  planMarkdownEntityPersistenceChanges(context, { entityType: 'prompt', kind: 'prompt' })
  planMarkdownEntityPersistenceChanges(context, {
    entityType: 'promptTemplate',
    kind: 'template'
  })
}
