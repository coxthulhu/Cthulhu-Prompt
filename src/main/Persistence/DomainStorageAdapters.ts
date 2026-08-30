import type { Category } from '@shared/Category'
import { isDeepStrictEqual } from 'node:util'
import type { DomainEntityMap, DomainEntityType } from '@shared/DomainChanges'
import { getActiveMarkdownContentIds } from '@shared/MarkdownContent'
import type { PromptFolder, PromptFolderContentKind } from '@shared/PromptFolder'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import type {
  DomainGraph,
  DomainGraphEntryFor,
  DomainTransition
} from '../Data/DomainTransitions'
import type { CategoryPersistenceFields } from './CategoryPersistence'
import type {
  DomainPersistenceFieldsMap,
  PersistenceRecord
} from './PersistenceTypes'
import type { PromptFolderPersistenceFields } from './PromptFolderPersistence'
import {
  resolveActivePromptFolderName,
  resolveCompletedPromptFolderName,
  resolveWorkspaceInfoPath
} from './PromptPersistencePaths'
import type { WorkspacePersistenceFields } from './WorkspacePersistence'

/** One typed storage transition staged without inventing a domain mutation. */
export type DomainStorageTransitionFor<TEntityType extends DomainEntityType> = {
  entityType: TEntityType
  id: string
  /** Whether this transition needs its entity persistence adapter or only an in-memory metadata update. */
  persistenceMode: 'stage' | 'metadataOnly'
  before: PersistenceRecord<
    DomainEntityMap[TEntityType],
    DomainPersistenceFieldsMap[TEntityType]
  > | null
  after: PersistenceRecord<
    DomainEntityMap[TEntityType],
    DomainPersistenceFieldsMap[TEntityType]
  > | null
}

/** Strongly typed union of storage transitions produced by entity adapters. */
export type DomainStorageTransition = {
  [TEntityType in DomainEntityType]: DomainStorageTransitionFor<TEntityType>
}[DomainEntityType]

/** Per-entity adapter that derives desired storage metadata from a projected graph. */
type DomainStorageAdapter<TEntityType extends DomainEntityType> = {
  deriveDesiredFields: (
    graph: DomainGraph,
    id: string,
    entry: DomainGraphEntryFor<TEntityType>
  ) => DomainPersistenceFieldsMap[TEntityType]
}

/** One root directory rename that physically relocates every descendant file. */
type RootDirectoryRename = {
  promptFolderId: string
  kind: PromptFolderContentKind
  beforeFolderName: string
  afterFolderName: string
}

/** Finds the workspace graph node that owns one root prompt folder. */
const findOwningWorkspace = (
  graph: DomainGraph,
  promptFolderId: string
): DomainGraphEntryFor<'workspace'> | undefined =>
  graph
    .getAll('workspace')
    .find((workspace) => workspace.data.entries.some((entry) => entry.id === promptFolderId))

/** Derives canonical prompt-folder metadata from its owning workspace and after data. */
const derivePromptFolderFields = (
  graph: DomainGraph,
  id: string,
  entry: DomainGraphEntryFor<'promptFolder'>
): PromptFolderPersistenceFields => {
  /** Workspace that owns this projected root folder. */
  const workspace = findOwningWorkspace(graph, id)
  /** Existing metadata retained only when a partial test graph omits workspace ownership. */
  const currentFields = entry.persistenceFields
  if (!workspace && !currentFields) {
    throw new Error(`Prompt-folder storage owner not found: ${id}`)
  }
  return {
    workspaceId: workspace?.data.id ?? currentFields!.workspaceId,
    workspacePath: workspace?.data.workspacePath ?? currentFields!.workspacePath,
    folderName: entry.data.folderName,
    folderPath: entry.data.folderName,
    kind: entry.data.kind
  }
}

/** Finds the projected root folder that owns one category. */
const findCategoryOwner = (graph: DomainGraph, categoryId: string): PromptFolder | undefined =>
  graph
    .getAll('promptFolder')
    .map((entry) => entry.data)
    .find((folder) =>
      folder.categoryOrder.categories.some((group) => group.categoryId === categoryId)
    )

/** Calculates the collision suffix required by one category in its projected root. */
const needsCategoryFilenameIdSuffix = (
  graph: DomainGraph,
  owner: PromptFolder,
  category: Category
): boolean => {
  /** Case-insensitive sanitized boundary shared by colliding category filenames. */
  const boundary = sanitizePromptTitleForFilename(category.displayName).toLocaleLowerCase()
  /** Projected categories with the same filename boundary in this root. */
  const collisionCount = owner.categoryOrder.categories.filter((group) => {
    if (group.categoryId === null) return false
    /** Projected category associated with one ordered root group. */
    const candidate = graph.get('category', group.categoryId)?.data
    return (
      candidate !== undefined &&
      sanitizePromptTitleForFilename(candidate.displayName).toLocaleLowerCase() === boundary
    )
  }).length
  return collisionCount > 1
}

/** Derives category ownership and its complete desired filename metadata. */
const deriveCategoryFields = (
  graph: DomainGraph,
  id: string,
  entry: DomainGraphEntryFor<'category'>
): CategoryPersistenceFields => {
  /** Projected root folder owning this category group. */
  const owner = findCategoryOwner(graph, id)
  if (!owner) throw new Error(`Category storage owner not found: ${id}`)
  /** Canonical storage metadata for the owning root folder. */
  const ownerFields = derivePromptFolderFields(graph, owner.id, graph.get('promptFolder', owner.id)!)
  /** Whether the desired category name collides at the sanitized filename boundary. */
  const needsFilenameIdSuffix = needsCategoryFilenameIdSuffix(graph, owner, entry.data)
  return {
    workspaceId: ownerFields.workspaceId,
    workspacePath: ownerFields.workspacePath,
    rootPromptFolderId: owner.id,
    rootFolderName: owner.folderName,
    kind: owner.kind,
    categoryStem: buildPromptStem(entry.data.displayName, id, needsFilenameIdSuffix),
    needsFilenameIdSuffix
  }
}

/** Projected markdown owner and physical group selected for filename planning. */
type MarkdownOwner = {
  folder: PromptFolder
  contentIds: string[]
  folderPath: string
}

/** Finds the projected active or completed group that owns markdown content. */
const findMarkdownOwner = (
  graph: DomainGraph,
  kind: PromptFolderContentKind,
  contentId: string
): MarkdownOwner | undefined => {
  for (const entry of graph.getAll('promptFolder')) {
    /** Projected root inspected for channel-specific content ownership. */
    const folder = entry.data
    if (folder.kind !== kind) continue
    /** Active content IDs sharing one collision-aware filename group. */
    const activeIds = getActiveMarkdownContentIds(folder, kind)
    if (activeIds.includes(contentId)) {
      return {
        folder,
        contentIds: activeIds,
        folderPath: resolveActivePromptFolderName(folder.folderName, kind)
      }
    }
    if (kind === 'prompt' && folder.completedPromptIds.includes(contentId)) {
      return {
        folder,
        contentIds: [...folder.completedPromptIds],
        folderPath: resolveCompletedPromptFolderName(folder.folderName, kind)
      }
    }
  }
  return undefined
}

/** Reads a prompt or template record through one markdown adapter boundary. */
const getMarkdownData = (
  graph: DomainGraph,
  kind: PromptFolderContentKind,
  contentId: string
): DomainEntityMap['prompt'] | DomainEntityMap['promptTemplate'] | undefined =>
  kind === 'prompt'
    ? graph.get('prompt', contentId)?.data
    : graph.get('promptTemplate', contentId)?.data

/** Calculates the filename suffix required within one projected markdown group. */
const needsMarkdownFilenameIdSuffix = (
  graph: DomainGraph,
  kind: PromptFolderContentKind,
  owner: MarkdownOwner,
  content: DomainEntityMap['prompt'] | DomainEntityMap['promptTemplate']
): boolean => {
  /** Sanitized display-title boundary used for collision counting. */
  const boundary = sanitizePromptTitleForFilename(
    getPromptDisplayTitle(content)
  ).toLocaleLowerCase()
  /** Projected same-boundary content count within the desired physical group. */
  const collisionCount = owner.contentIds.filter((contentId) => {
    /** Projected markdown record for one group member. */
    const candidate = getMarkdownData(graph, kind, contentId)
    return (
      candidate !== undefined &&
      sanitizePromptTitleForFilename(getPromptDisplayTitle(candidate)).toLocaleLowerCase() ===
        boundary
    )
  }).length
  return collisionCount > 1
}

/** Creates a prompt or template adapter that derives ownership and desired filenames. */
const createMarkdownStorageAdapter = <TEntityType extends 'prompt' | 'promptTemplate'>(
  entityType: TEntityType,
  kind: PromptFolderContentKind
): DomainStorageAdapter<TEntityType> => ({
  deriveDesiredFields: (graph, id, entry) => {
    /** Projected root and physical filename group owning this content. */
    const owner = findMarkdownOwner(graph, kind, id)
    if (!owner) throw new Error(`Markdown storage owner not found: ${entityType}:${id}`)
    /** Canonical root metadata supplying workspace ownership. */
    const ownerFields = derivePromptFolderFields(
      graph,
      owner.folder.id,
      graph.get('promptFolder', owner.folder.id)!
    )
    /** Collision policy calculated across the complete desired group. */
    const needsFilenameIdSuffix = needsMarkdownFilenameIdSuffix(
      graph,
      kind,
      owner,
      entry.data
    )
    return {
      workspaceId: ownerFields.workspaceId,
      workspacePath: ownerFields.workspacePath,
      folderPath: owner.folderPath,
      promptFolderId: owner.folder.id,
      promptId: id,
      promptStem: buildPromptStem(
        getPromptDisplayTitle(entry.data),
        id,
        needsFilenameIdSuffix
      ),
      needsFilenameIdSuffix
    } as DomainPersistenceFieldsMap[TEntityType]
  }
})

/** Per-entity adapters deriving desired locations from the projected after graph. */
const domainStorageAdapters: {
  [TEntityType in DomainEntityType]: DomainStorageAdapter<TEntityType>
} = {
  systemSettings: { deriveDesiredFields: () => ({}) },
  workspace: {
    deriveDesiredFields: (_graph, _id, entry) => {
      /** Existing info filename retained when the workspace was loaded from disk. */
      const currentInfoPath = entry.persistenceFields?.workspaceInfoPath
      return {
        workspacePath: entry.data.workspacePath,
        workspaceInfoPath:
          currentInfoPath ??
          resolveWorkspaceInfoPath(entry.data.workspacePath, entry.data.workspaceName)
      } satisfies WorkspacePersistenceFields
    }
  },
  promptFolder: { deriveDesiredFields: derivePromptFolderFields },
  category: { deriveDesiredFields: deriveCategoryFields },
  prompt: createMarkdownStorageAdapter('prompt', 'prompt'),
  promptTemplate: createMarkdownStorageAdapter('promptTemplate', 'template')
}

/** Converts one graph entry into the persistence record used during staging. */
const toPersistenceRecord = <TEntityType extends DomainEntityType>(
  entry: DomainGraphEntryFor<TEntityType>,
  persistenceFields: DomainPersistenceFieldsMap[TEntityType]
): PersistenceRecord<DomainEntityMap[TEntityType], DomainPersistenceFieldsMap[TEntityType]> => ({
  data: entry.data,
  persistenceFields
})

/** Reports whether current and desired storage metadata resolve identically. */
const hasEqualPersistenceFields = (
  current: DomainPersistenceFieldsMap[DomainEntityType],
  desired: DomainPersistenceFieldsMap[DomainEntityType]
): boolean => isDeepStrictEqual(current, desired)

/** Collects root directory renames from revision-bearing prompt-folder transitions. */
const collectRootDirectoryRenames = (
  domainTransitions: readonly DomainTransition[]
): RootDirectoryRename[] =>
  domainTransitions.flatMap((transition) => {
    if (
      transition.entityType !== 'promptFolder' ||
      !transition.before ||
      !transition.after ||
      transition.before.data.kind !== transition.after.data.kind ||
      transition.before.data.folderName === transition.after.data.folderName
    ) {
      return []
    }
    return [
      {
        promptFolderId: transition.id,
        kind: transition.after.data.kind,
        beforeFolderName: transition.before.data.folderName,
        afterFolderName: transition.after.data.folderName
      }
    ]
  })

/** Reports whether category metadata changed only because its owning root directory moved. */
const isCategoryRelocatedByRootRename = (
  transition: DomainStorageTransitionFor<'category'>,
  rename: RootDirectoryRename
): boolean => {
  if (!transition.before || !transition.after) return false
  /** Current category persistence fields before the root rename. */
  const beforeFields = transition.before.persistenceFields
  /** Desired category persistence fields after the root rename. */
  const afterFields = transition.after.persistenceFields
  /** Current fields excluding the root directory segment. */
  const { rootFolderName: _beforeRootFolderName, ...beforeRest } = beforeFields
  /** Desired fields excluding the root directory segment. */
  const { rootFolderName: _afterRootFolderName, ...afterRest } = afterFields
  return (
    isDeepStrictEqual(transition.before.data, transition.after.data) &&
    beforeFields.rootPromptFolderId === rename.promptFolderId &&
    afterFields.rootPromptFolderId === rename.promptFolderId &&
    beforeFields.kind === rename.kind &&
    beforeFields.rootFolderName === rename.beforeFolderName &&
    afterFields.rootFolderName === rename.afterFolderName &&
    isDeepStrictEqual(beforeRest, afterRest)
  )
}

/** Reports whether one markdown path changed only because its owning root directory moved. */
const isMarkdownRelocatedByRootRename = (
  transition: DomainStorageTransitionFor<'prompt'> | DomainStorageTransitionFor<'promptTemplate'>,
  rename: RootDirectoryRename
): boolean => {
  if (!transition.before || !transition.after) return false
  /** Current markdown persistence fields before the root rename. */
  const beforeFields = transition.before.persistenceFields
  /** Desired markdown persistence fields after the root rename. */
  const afterFields = transition.after.persistenceFields
  /** Current fields excluding the root-relative content directory. */
  const { folderPath: _beforeFolderPath, ...beforeRest } = beforeFields
  /** Desired fields excluding the root-relative content directory. */
  const { folderPath: _afterFolderPath, ...afterRest } = afterFields
  /** Whether the content follows the root's active directory. */
  const followsActiveDirectory =
    beforeFields.folderPath === resolveActivePromptFolderName(rename.beforeFolderName, rename.kind) &&
    afterFields.folderPath === resolveActivePromptFolderName(rename.afterFolderName, rename.kind)
  /** Whether the content follows the root's completed directory. */
  const followsCompletedDirectory =
    beforeFields.folderPath ===
      resolveCompletedPromptFolderName(rename.beforeFolderName, rename.kind) &&
    afterFields.folderPath ===
      resolveCompletedPromptFolderName(rename.afterFolderName, rename.kind)
  return (
    isDeepStrictEqual(transition.before.data, transition.after.data) &&
    beforeFields.promptFolderId === rename.promptFolderId &&
    afterFields.promptFolderId === rename.promptFolderId &&
    (followsActiveDirectory || followsCompletedDirectory) &&
    isDeepStrictEqual(beforeRest, afterRest)
  )
}

/** Reports whether an ancestor root rename already performs this descendant's disk move. */
const isRelocatedByRootDirectoryRename = (
  transition: DomainStorageTransition,
  renames: readonly RootDirectoryRename[]
): boolean =>
  renames.some((rename) => {
    if (transition.entityType === 'category') {
      return isCategoryRelocatedByRootRename(transition, rename)
    }
    if (transition.entityType === 'prompt' || transition.entityType === 'promptTemplate') {
      return isMarkdownRelocatedByRootRename(transition, rename)
    }
    return false
  })

/** Calculates desired storage first, then diffs it against every current entity location. */
export const planDomainStorageTransitions = (
  beforeGraph: DomainGraph,
  afterGraph: DomainGraph,
  domainTransitions: readonly DomainTransition[]
): DomainStorageTransition[] => {
  /** Domain targets whose data must be written even when their location is unchanged. */
  const domainTargetKeys = new Set(
    domainTransitions.map((transition) => `${transition.entityType}:${transition.id}`)
  )
  /** Storage transitions containing domain writes and location-only sibling moves. */
  const storageTransitions: DomainStorageTransition[] = []
  /** Root directory moves that cover their descendants' physical relocation. */
  const rootDirectoryRenames = collectRootDirectoryRenames(domainTransitions)
  /** Domain entity types dispatched through their storage adapters. */
  const entityTypes: DomainEntityType[] = [
    'systemSettings',
    'workspace',
    'promptFolder',
    'category',
    'prompt',
    'promptTemplate'
  ]

  for (const entityType of entityTypes) {
    /** IDs present before, after, or on a deleted domain transition. */
    const ids = new Set([
      ...beforeGraph.entries[entityType].keys(),
      ...afterGraph.entries[entityType].keys()
    ])
    for (const id of ids) {
      /** Current projected node and physical metadata. */
      const beforeEntry = beforeGraph.get(entityType, id)
      /** Desired projected node used by the adapter. */
      const afterEntry = afterGraph.get(entityType, id)
      /** Stable entity target key shared with domain transitions. */
      const targetKey = `${entityType}:${id}`
      if (!afterEntry) {
        if (!domainTargetKeys.has(targetKey) || !beforeEntry?.persistenceFields) continue
        storageTransitions.push({
          entityType,
          id,
          persistenceMode: 'stage',
          before: toPersistenceRecord(beforeEntry, beforeEntry.persistenceFields),
          after: null
        } as DomainStorageTransition)
        continue
      }

      /** Complete desired location and filename state derived from the after graph. */
      const desiredFields = domainStorageAdapters[entityType].deriveDesiredFields(
        afterGraph,
        id,
        afterEntry as never
      ) as DomainPersistenceFieldsMap[typeof entityType]
      /** Current persistence record when this entity already exists. */
      const beforeRecord =
        beforeEntry?.persistenceFields == null
          ? null
          : toPersistenceRecord(beforeEntry, beforeEntry.persistenceFields)
      if (
        !domainTargetKeys.has(targetKey) &&
        beforeRecord &&
        hasEqualPersistenceFields(beforeRecord.persistenceFields, desiredFields)
      ) {
        continue
      }
      /** Candidate transition used to determine whether an ancestor already moves its files. */
      const storageTransition = {
        entityType,
        id,
        persistenceMode: 'stage' as const,
        before: beforeRecord,
        after: toPersistenceRecord(afterEntry, desiredFields)
      } as DomainStorageTransition
      storageTransition.persistenceMode = isRelocatedByRootDirectoryRename(
        storageTransition,
        rootDirectoryRenames
      )
        ? 'metadataOnly'
        : 'stage'
      storageTransitions.push(storageTransition)
    }
  }

  return storageTransitions
}
