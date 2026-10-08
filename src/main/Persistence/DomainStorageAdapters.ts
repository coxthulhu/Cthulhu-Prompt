import * as path from 'path'
import { createFilenameAllocator } from './FilenameAllocation'
import { isDeepStrictEqual } from 'node:util'
import type { DomainEntityMap, DomainEntityType } from '@shared/domain/DomainChanges'
import {
  getPromptFolderCategoryIds,
  type PromptFolder,
  type PromptFolderContentKind
} from '@shared/domain/prompt-folder/PromptFolder'
import {
  PROMPT_STATUS_FOLDERS,
  type PromptStatusFolderId
} from '@shared/domain/prompt/Prompt'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
import { sanitizePromptTitleForFilename } from '@shared/domain/prompt/promptFilename'
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
  CATEGORY_FILENAME_SUFFIX,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  resolveCategoriesDirectoryPath,
  resolvePromptFolderPath,
  resolvePromptStatusFolderName,
  resolveWorkspaceInfoPath
} from './PromptPersistencePaths'
import { getAllWorkspaceFolderEntries } from '@shared/domain/workspace/Workspace'
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
    .find((workspace) =>
      getAllWorkspaceFolderEntries(workspace.data).some((entry) => entry.id === promptFolderId)
    )

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
    .find((folder) => getPromptFolderCategoryIds(folder).includes(categoryId))

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
  return {
    workspaceId: ownerFields.workspaceId,
    workspacePath: ownerFields.workspacePath,
    rootPromptFolderId: owner.id,
    rootFolderName: owner.folderName,
    kind: owner.kind,
    categoryStem: entry.persistenceFields?.categoryStem ?? sanitizePromptTitleForFilename(entry.data.displayName)
  }
}

/** Projected markdown owner and physical group selected for filename planning. */
type MarkdownOwner = {
  folder: PromptFolder
  folderPath: string
}

/** Finds the projected active or final-status group that owns markdown content. */
const findMarkdownOwner = (
  graph: DomainGraph,
  kind: PromptFolderContentKind,
  contentId: string
): MarkdownOwner | undefined => {
  for (const entry of graph.getAll('promptFolder')) {
    /** Projected root inspected for channel-specific content ownership. */
    const folder = entry.data
    if (folder.kind !== kind) continue
    for (const [statusFolderId, layout] of Object.entries(folder.statusFolders)) {
      /** Prompt IDs sharing this exact physical status-folder filename group. */
      const promptIds =
        layout.ordering === 'category'
          ? layout.categoryOrder.categories.flatMap((category) =>
              category.entries.flatMap((entry) =>
                entry.kind === kind ? [entry.id] : []
              )
            )
          : layout.promptIds
      if (promptIds.includes(contentId)) {
        return {
          folder,
          folderPath: resolvePromptStatusFolderName(
            folder.folderName,
            statusFolderId as PromptStatusFolderId
          )
        }
      }
    }
  }
  return undefined
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
    return {
      workspaceId: ownerFields.workspaceId,
      workspacePath: ownerFields.workspacePath,
      folderPath: owner.folderPath,
      promptFolderId: owner.folder.id,
      promptId: id,
      promptStem: entry.persistenceFields?.promptStem ?? sanitizePromptTitleForFilename(getPromptDisplayTitle(entry.data))
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
  promptTemplate: createMarkdownStorageAdapter('promptTemplate', 'template'),
  userPersistence: { deriveDesiredFields: () => ({}) },
  markdownContentUiState: { deriveDesiredFields: () => ({}) },
  workspaceUiState: { deriveDesiredFields: () => ({}) },
  workspacePromptFolderUiState: { deriveDesiredFields: () => ({}) },
  accordionUiState: { deriveDesiredFields: () => ({}) }
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
  /** Whether prompt content follows the same registry-backed status directory through the rename. */
  const followsPromptStatusDirectory =
    PROMPT_STATUS_FOLDERS.some(
      (statusFolder) =>
        beforeFields.folderPath ===
          resolvePromptStatusFolderName(rename.beforeFolderName, statusFolder.id) &&
        afterFields.folderPath ===
          resolvePromptStatusFolderName(rename.afterFolderName, statusFolder.id)
    )
  return (
    isDeepStrictEqual(transition.before.data, transition.after.data) &&
    beforeFields.promptFolderId === rename.promptFolderId &&
    afterFields.promptFolderId === rename.promptFolderId &&
    followsPromptStatusDirectory &&
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

/** File-backed entities whose filenames are independent of their domain identity. */
type FilenameEntityType = 'category' | 'prompt' | 'promptTemplate'

/** Resolves the directory, extension, and persisted stem for one file-backed entity. */
const getFilenameLocation = (
  entityType: FilenameEntityType,
  fields: DomainPersistenceFieldsMap[FilenameEntityType]
): { directory: string; stem: string; suffix: string } => {
  if (entityType === 'category') {
    /** Category metadata owns its root-level category directory. */
    const category = fields as CategoryPersistenceFields
    return {
      directory: resolveCategoriesDirectoryPath(category.workspacePath, category.rootFolderName, category.kind),
      stem: category.categoryStem,
      suffix: CATEGORY_FILENAME_SUFFIX
    }
  }
  /** Markdown metadata owns one physical status directory. */
  const markdown = fields as DomainPersistenceFieldsMap['prompt']
  return {
    directory: resolvePromptFolderPath(markdown.workspacePath, markdown.folderPath, entityType === 'prompt' ? 'prompt' : 'template'),
    stem: markdown.promptStem,
    suffix: entityType === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX
  }
}

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
  /** Storage transitions containing domain writes and descendant path updates. */
  const storageTransitions: DomainStorageTransition[] = []
  /** Root directory moves that cover their descendants' physical relocation. */
  const rootDirectoryRenames = collectRootDirectoryRenames(domainTransitions)
  /** Shared disk snapshot and reservations for all file writes in this transaction. */
  const filenames = createFilenameAllocator()
  /** File-backed types reserved before any new destination is allocated. */
  const filenameTypes: FilenameEntityType[] = ['category', 'prompt', 'promptTemplate']
  /** Maps a descendant directory through a root rename without reallocating its filename. */
  const relocatedDirectory = (directory: string): string => {
    for (const rename of rootDirectoryRenames) {
      /** Existing root metadata identifies the absolute source directory. */
      const root = beforeGraph.get('promptFolder', rename.promptFolderId)!.persistenceFields!
      /** Absolute source and destination of this root move. */
      const source = resolvePromptFolderPath(root.workspacePath, rename.beforeFolderName, rename.kind)
      /** Relative child path retained by the directory rename. */
      const relative = path.relative(source, directory)
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return path.join(resolvePromptFolderPath(root.workspacePath, rename.afterFolderName, rename.kind), relative)
      }
    }
    return directory
  }
  for (const entityType of filenameTypes) {
    for (const entry of beforeGraph.getAll(entityType)) {
      if (!entry.persistenceFields) continue
      /** Existing file remains reserved even when this transaction will remove it. */
      const location = getFilenameLocation(entityType, entry.persistenceFields)
      filenames.reserve(path.join(location.directory, `${location.stem}${location.suffix}`))
      filenames.reserve(path.join(relocatedDirectory(location.directory), `${location.stem}${location.suffix}`))
    }
  }
  /** Domain entity types dispatched through their storage adapters. */
  const entityTypes: DomainEntityType[] = [
    'systemSettings',
    'workspace',
    'promptFolder',
    'category',
    'prompt',
    'promptTemplate',
    'userPersistence',
    'markdownContentUiState',
    'workspaceUiState',
    'workspacePromptFolderUiState',
    'accordionUiState'
  ]

  for (const entityType of entityTypes) {
    /** IDs present before, after, or on a deleted domain transition. */
    const ids = new Set([
      ...beforeGraph.entries[entityType].keys(),
      ...afterGraph.entries[entityType].keys(),
      ...domainTransitions
        .filter((transition) => transition.entityType === entityType)
        .map((transition) => transition.id)
    ])
    for (const id of ids) {
      /** Current projected node and physical metadata. */
      const beforeEntry = beforeGraph.get(entityType, id)
      /** Desired projected node used by the adapter. */
      const afterEntry = afterGraph.get(entityType, id)
      /** Stable entity target key shared with domain transitions. */
      const targetKey = `${entityType}:${id}`
      if (!afterEntry) {
        if (!domainTargetKeys.has(targetKey)) continue
        if (!beforeEntry) {
          storageTransitions.push({
            entityType,
            id,
            persistenceMode: 'stage',
            before: null,
            after: null
          } as DomainStorageTransition)
          continue
        }
        if (!beforeEntry.persistenceFields) continue
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
      if (entityType === 'category' || entityType === 'prompt' || entityType === 'promptTemplate') {
        /** Destination directory derived from the projected owner, independent of the title. */
        const destination = getFilenameLocation(entityType, desiredFields as DomainPersistenceFieldsMap[FilenameEntityType])
        /** Existing location follows an ancestor rename while retaining its allocated stem. */
        const current = beforeEntry?.persistenceFields
          ? getFilenameLocation(entityType, beforeEntry.persistenceFields as DomainPersistenceFieldsMap[FilenameEntityType])
          : null
        /** Whether the entity stays in its current physical directory. */
        const sameDirectory = current !== null && relocatedDirectory(current.directory).toLowerCase() === destination.directory.toLowerCase()
        /** Current and desired title fields determine whether allocation must run again. */
        const beforeData = beforeEntry?.data as DomainEntityMap[FilenameEntityType] | undefined
        /** Desired domain data supplies the readable filename without changing its full ID. */
        const afterData = afterEntry.data as DomainEntityMap[FilenameEntityType]
        /** Category names and Markdown title/fallback pairs retain their existing domain behavior. */
        const sameTitle = beforeData && ('displayName' in afterData
          ? 'displayName' in beforeData && beforeData.displayName === afterData.displayName
          : 'title' in beforeData && beforeData.title === afterData.title && beforeData.fallbackTitle === afterData.fallbackTitle)
        /** Stable files bypass allocation; renamed and moved files claim the lowest available name. */
        const stem = sameDirectory && sameTitle
          ? current!.stem
          : filenames.allocate(
              destination.directory,
              'displayName' in afterData ? afterData.displayName : getPromptDisplayTitle(afterData),
              destination.suffix,
              sameDirectory ? `${current!.stem}${current!.suffix}` : undefined
            )
        if (entityType === 'category') (desiredFields as CategoryPersistenceFields).categoryStem = stem
        else (desiredFields as DomainPersistenceFieldsMap['prompt']).promptStem = stem
      }
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
