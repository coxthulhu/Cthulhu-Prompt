import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from './DomainChanges'
import {
  getActiveMarkdownContentIds,
  getMarkdownContentIds,
  placeMarkdownContentInCategoryOrder
} from './MarkdownContent'
import { parseIsoSecondTimestamp } from './isoTimestamp'
import { promptEntryRef, promptTemplateEntryRef } from './OrderContainer'
import {
  PromptStatus,
  type PromptPersisted,
  type PromptTemplateReference
} from './Prompt'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolderContentKind
} from './PromptFolder'
import {
  DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
  resolvePromptTitleUpdateForPromptIds
} from './promptFallbackTitle'
import type { PromptTemplatePersisted } from './PromptTemplate'
import { createMarkdownContentUiStateKey } from './MarkdownContentUiState'

/** Renderer-authored command for creating one prompt at an exact root position. */
export type CreatePromptDomainCommand = {
  promptFolderId: string
  contentId: string
  title: string
  fallbackTitle: string
  promptText: string
  createdAt: string
  categoryId: string | null
  previousEntryId: string | null
  templates?: PromptTemplateReference[] | null
}

/** Renderer-authored command for creating one template at an exact root position. */
export type CreatePromptTemplateDomainCommand = {
  promptFolderId: string
  contentId: string
  title: string
  fallbackTitle: string
  templateText: string
  createdAt: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Channel-scoped command for moving markdown content to an exact category-order position. */
export type MoveMarkdownContentDomainCommand = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  contentId: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Renderer-authored command for deleting one prompt or template and its editor state. */
export type DeleteMarkdownContentDomainCommand = {
  workspaceId: string
  promptFolderId: string
  contentId: string
}

/** Strict runtime parser for prompt or template deletion commands. */
export const parseDeleteMarkdownContentDomainCommand = (
  value: unknown
): DeleteMarkdownContentDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.contentId !== 'string'
  ) {
    return null
  }
  return record as DeleteMarkdownContentDomainCommand
}

/** Renderer-authored command for replacing editable prompt fields. */
export type UpdatePromptDomainCommand = {
  contentId: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  promptText: string
  templates?: PromptTemplateReference[] | null
}

/** Renderer-authored command for replacing editable prompt-template fields. */
export type UpdatePromptTemplateDomainCommand = {
  contentId: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  templateText: string
}

/** Parses one ordered prompt-template reference array. */
const parsePromptTemplateReferences = (
  value: unknown
): PromptTemplateReference[] | null | undefined => {
  if (value === undefined || value === null) return value
  if (!Array.isArray(value)) return undefined
  /** Strict template references parsed from the command candidate. */
  const references: PromptTemplateReference[] = []
  for (const candidate of value) {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate) ||
      Object.keys(candidate).length !== 1 ||
      typeof (candidate as Record<string, unknown>).id !== 'string'
    ) {
      return undefined
    }
    references.push({ id: (candidate as Record<string, string>).id })
  }
  return references
}

/** Strict runtime parser for prompt creation commands. */
export const parseCreatePromptDomainCommand = (
  value: unknown
): CreatePromptDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  /** Optional template references parsed separately to retain undefined versus null. */
  const templates = parsePromptTemplateReferences(record.templates)
  /** Whether an invalid present templates value collapsed to undefined. */
  const hasInvalidTemplates = 'templates' in record && record.templates !== undefined && templates === undefined
  /** Whether the command contains a field outside the exact prompt creation contract. */
  const hasUnknownField = Object.keys(record).some(
    (key) =>
      ![
        'promptFolderId',
        'contentId',
        'title',
        'fallbackTitle',
        'promptText',
        'createdAt',
        'categoryId',
        'previousEntryId',
        'templates'
      ].includes(key)
  )
  if (
    (Object.keys(record).length !== 8 && Object.keys(record).length !== 9) ||
    hasUnknownField ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.contentId !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.fallbackTitle !== 'string' ||
    typeof record.promptText !== 'string' ||
    parseIsoSecondTimestamp(record.createdAt) === null ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string') ||
    hasInvalidTemplates
  ) {
    return null
  }
  return {
    promptFolderId: record.promptFolderId,
    contentId: record.contentId,
    title: record.title,
    fallbackTitle: record.fallbackTitle,
    promptText: record.promptText,
    createdAt: record.createdAt as string,
    categoryId: record.categoryId,
    previousEntryId: record.previousEntryId,
    ...(templates !== undefined ? { templates } : {})
  }
}

/** Strict runtime parser for prompt-template creation commands. */
export const parseCreatePromptTemplateDomainCommand = (
  value: unknown
): CreatePromptTemplateDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 8 ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.contentId !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.fallbackTitle !== 'string' ||
    typeof record.templateText !== 'string' ||
    parseIsoSecondTimestamp(record.createdAt) === null ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return {
    promptFolderId: record.promptFolderId,
    contentId: record.contentId,
    title: record.title,
    fallbackTitle: record.fallbackTitle,
    templateText: record.templateText,
    createdAt: record.createdAt as string,
    categoryId: record.categoryId,
    previousEntryId: record.previousEntryId
  }
}

/** Strict runtime parser for prompt or template movement commands. */
export const parseMoveMarkdownContentDomainCommand = (
  value: unknown
): MoveMarkdownContentDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.sourcePromptFolderId !== 'string' ||
    typeof record.destinationPromptFolderId !== 'string' ||
    typeof record.contentId !== 'string' ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return {
    sourcePromptFolderId: record.sourcePromptFolderId,
    destinationPromptFolderId: record.destinationPromptFolderId,
    contentId: record.contentId,
    categoryId: record.categoryId,
    previousEntryId: record.previousEntryId
  }
}

/** Strict runtime parser for prompt update commands. */
export const parseUpdatePromptDomainCommand = (
  value: unknown
): UpdatePromptDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  /** Optional template references retaining undefined versus explicit null. */
  const templates = parsePromptTemplateReferences(record.templates)
  /** Whether a present templates field failed strict reference parsing. */
  const hasInvalidTemplates = 'templates' in record && templates === undefined
  /** Whether the command contains a field outside the exact prompt update contract. */
  const hasUnknownField = Object.keys(record).some(
    (key) =>
      ![
        'contentId',
        'title',
        'fallbackTitle',
        'modifiedAt',
        'promptText',
        'templates'
      ].includes(key)
  )
  if (
    (Object.keys(record).length !== 5 && Object.keys(record).length !== 6) ||
    hasUnknownField ||
    typeof record.contentId !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.fallbackTitle !== 'string' ||
    parseIsoSecondTimestamp(record.modifiedAt) === null ||
    typeof record.promptText !== 'string' ||
    hasInvalidTemplates
  ) {
    return null
  }
  return {
    contentId: record.contentId,
    title: record.title,
    fallbackTitle: record.fallbackTitle,
    modifiedAt: record.modifiedAt as string,
    promptText: record.promptText,
    ...(templates !== undefined ? { templates } : {})
  }
}

/** Strict runtime parser for prompt-template update commands. */
export const parseUpdatePromptTemplateDomainCommand = (
  value: unknown
): UpdatePromptTemplateDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.contentId !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.fallbackTitle !== 'string' ||
    parseIsoSecondTimestamp(record.modifiedAt) === null ||
    typeof record.templateText !== 'string'
  ) {
    return null
  }
  return {
    contentId: record.contentId,
    title: record.title,
    fallbackTitle: record.fallbackTitle,
    modifiedAt: record.modifiedAt as string,
    templateText: record.templateText
  }
}

/** Plans creation of one prompt and its synchronized root-folder entry. */
export const planCreatePromptDomainMutation: DomainPlanner<CreatePromptDomainCommand> = (
  state,
  command
) => {
  /** Prompt root that will own the new content. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Existing entity occupying the requested stable prompt ID. */
  const existingPrompt = state.get('prompt', command.contentId)
  /** Folder and prompt targets returned for creation conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId },
    { entityType: 'prompt', id: command.contentId }
  ]
  if (!promptFolder || promptFolder.kind !== 'prompt' || existingPrompt) {
    return createConflict('Prompt creation conflict', targets)
  }

  /** Collision-free title fields for the new prompt. */
  const titleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getActiveMarkdownContentIds(promptFolder, 'prompt'),
    lookupPrompt: (promptId) => state.get('prompt', promptId),
    promptId: command.contentId,
    currentFallbackTitle: command.fallbackTitle,
    nextTitle: command.title
  })
  /** Initial prompt data before category placement synchronization. */
  const prompt: PromptPersisted = {
    id: command.contentId,
    ...titleFields,
    createdAt: command.createdAt,
    modifiedAt: command.createdAt,
    promptText: command.promptText,
    ...(command.templates !== undefined ? { templates: command.templates } : {}),
    status: PromptStatus.Todo
  }

  try {
    /** Validated prompt data and category order for the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      promptFolder.categoryOrder,
      prompt,
      promptEntryRef(command.contentId),
      command.categoryId,
      command.previousEntryId
    )
    return [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.promptFolderId,
        recipe: (draft) => {
          draft.categoryOrder = placement.categoryOrder
        }
      },
      {
        type: 'insert',
        entityType: 'prompt',
        id: command.contentId,
        data: placement.content
      }
    ]
  } catch {
    return createConflict('Prompt creation conflict', targets)
  }
}

/** Plans creation of one prompt template and its synchronized root-folder entry. */
export const planCreatePromptTemplateDomainMutation: DomainPlanner<
  CreatePromptTemplateDomainCommand
> = (state, command) => {
  /** Template root that will own the new content. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Existing entity occupying the requested stable template ID. */
  const existingTemplate = state.get('promptTemplate', command.contentId)
  /** Folder and template targets returned for creation conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId },
    { entityType: 'promptTemplate', id: command.contentId }
  ]
  if (!promptFolder || promptFolder.kind !== 'template' || existingTemplate) {
    return createConflict('Prompt template creation conflict', targets)
  }

  /** Collision-free title fields for the new template. */
  const titleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getActiveMarkdownContentIds(promptFolder, 'template'),
    lookupPrompt: (templateId) => state.get('promptTemplate', templateId),
    promptId: command.contentId,
    currentFallbackTitle: command.fallbackTitle,
    nextTitle: command.title,
    defaultFallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE
  })
  /** Initial template data before category placement synchronization. */
  const template: PromptTemplatePersisted = {
    id: command.contentId,
    ...titleFields,
    createdAt: command.createdAt,
    modifiedAt: command.createdAt,
    templateText: command.templateText
  }

  try {
    /** Validated template data and category order for the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      promptFolder.categoryOrder,
      template,
      promptTemplateEntryRef(command.contentId),
      command.categoryId,
      command.previousEntryId
    )
    return [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.promptFolderId,
        recipe: (draft) => {
          draft.categoryOrder = placement.categoryOrder
        }
      },
      {
        type: 'insert',
        entityType: 'promptTemplate',
        id: command.contentId,
        data: placement.content
      }
    ]
  } catch {
    return createConflict('Prompt template creation conflict', targets)
  }
}

/** Adds a target once while preserving the caller's meaningful order. */
const addUniqueTarget = (targets: DomainTarget[], target: DomainTarget): void => {
  /** Stable key for the candidate target. */
  const targetKey = `${target.entityType}:${target.id}`
  if (targets.some((candidate) => `${candidate.entityType}:${candidate.id}` === targetKey)) return
  targets.push(target)
}

/** Builds a planner conflict with a unique authoritative target set. */
const createConflict = (reason: string, targets: DomainTarget[]): DomainMutationConflict => ({
  status: 'conflict',
  reason,
  targets
})

/** Returns the ordered reference corresponding to a prompt or template channel. */
const createContentEntryRef = (
  kind: PromptFolderContentKind,
  contentId: string
): CategoryOrderEntryRef =>
  kind === 'prompt' ? promptEntryRef(contentId) : promptTemplateEntryRef(contentId)

/** Summary-compatible markdown fields required by the shared movement planner. */
type MarkdownContentDomainProjection = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  status?: PromptStatus
}

/** Reads one prompt or template projection from shared domain state. */
const getMarkdownContent = (
  state: DomainState,
  kind: PromptFolderContentKind,
  contentId: string
): MarkdownContentDomainProjection | undefined =>
  kind === 'prompt'
    ? state.get('prompt', contentId)
    : state.get('promptTemplate', contentId)

/** Finds the root folder that owns one prompt or template. */
const findMarkdownContentOwner = (
  state: DomainState,
  kind: PromptFolderContentKind,
  contentId: string
) =>
  state
    .getAll('promptFolder')
    .find(
      (folder) =>
        folder.kind === kind && getMarkdownContentIds(folder, kind).includes(contentId)
    )

/** Creates a prompt- or template-specific shared deletion planner. */
const createDeletePlanner = (
  kind: PromptFolderContentKind
): DomainPlanner<DeleteMarkdownContentDomainCommand> => (state, command) => {
  /** Requested root folder that should own the deleted content. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Requested prompt or template projection. */
  const content = getMarkdownContent(state, kind, command.contentId)
  /** Workspace expected to own the requested root folder. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) => candidate.entries.some((entry) => entry.id === command.promptFolderId))
  /** Required folder and content targets returned for ownership conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId },
    {
      entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
      id: command.contentId
    }
  ]
  if (
    !promptFolder ||
    promptFolder.kind !== kind ||
    !content ||
    !getMarkdownContentIds(promptFolder, kind).includes(command.contentId) ||
    !workspace ||
    workspace.id !== command.workspaceId
  ) {
    return createConflict('Markdown content deletion conflict', targets)
  }
  /** Category-order reference removed with the deleted content. */
  const entry = createContentEntryRef(kind, command.contentId)
  return [
    {
      type: 'update',
      entityType: 'promptFolder',
      id: command.promptFolderId,
      recipe: (draft) => {
        draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
        if (kind === 'prompt') {
          draft.completedPromptIds = draft.completedPromptIds.filter(
            (id) => id !== command.contentId
          )
        }
      }
    },
    {
      type: 'delete',
      entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
      id: command.contentId
    } as DomainChange,
    {
      type: 'delete',
      entityType: 'markdownContentUiState',
      id: createMarkdownContentUiStateKey(command.workspaceId, command.contentId)
    }
  ]
}

/** Plans prompt deletion and optional editor UI-state cleanup. */
export const planPromptDelete = createDeletePlanner('prompt')

/** Plans prompt-template deletion and optional editor UI-state cleanup. */
export const planPromptTemplateDelete = createDeletePlanner('template')

/** Plans one complete editable prompt replacement. */
export const planPromptUpdate: DomainPlanner<UpdatePromptDomainCommand> = (
  state,
  command
) => {
  /** Prompt selected by the update command. */
  const prompt = state.get('prompt', command.contentId)
  /** Root folder owning the prompt and its filename-collision group. */
  const owner = findMarkdownContentOwner(state, 'prompt', command.contentId)
  /** Stable prompt target returned for missing-content conflicts. */
  const targets: DomainTarget[] = [{ entityType: 'prompt', id: command.contentId }]
  if (!prompt || !owner || !('promptText' in prompt)) {
    return createConflict('Prompt update conflict', targets)
  }
  /** Collision-free title fields resolved against authoritative sibling state. */
  const titleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getActiveMarkdownContentIds(owner, 'prompt'),
    lookupPrompt: (promptId) => state.get('prompt', promptId),
    promptId: command.contentId,
    currentTitle: prompt.title,
    currentFallbackTitle: command.fallbackTitle,
    nextTitle: command.title
  })
  return [
    {
      type: 'update',
      entityType: 'prompt',
      id: command.contentId,
      recipe: (draft) => {
        Object.assign(draft, {
          ...titleFields,
          modifiedAt: command.modifiedAt,
          promptText: command.promptText
        })
        if (command.templates === undefined) delete draft.templates
        else draft.templates = command.templates
      }
    }
  ]
}

/** Plans one complete editable prompt-template replacement. */
export const planPromptTemplateUpdate: DomainPlanner<UpdatePromptTemplateDomainCommand> = (
  state,
  command
) => {
  /** Prompt template selected by the update command. */
  const template = state.get('promptTemplate', command.contentId)
  /** Root folder owning the template and its filename-collision group. */
  const owner = findMarkdownContentOwner(state, 'template', command.contentId)
  /** Stable template target returned for missing-content conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptTemplate', id: command.contentId }
  ]
  if (!template || !owner || !('templateText' in template)) {
    return createConflict('Prompt template update conflict', targets)
  }
  /** Collision-free title fields resolved against authoritative sibling state. */
  const titleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getActiveMarkdownContentIds(owner, 'template'),
    lookupPrompt: (templateId) => state.get('promptTemplate', templateId),
    promptId: command.contentId,
    currentTitle: template.title,
    currentFallbackTitle: command.fallbackTitle,
    nextTitle: command.title,
    defaultFallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE
  })
  return [
    {
      type: 'update',
      entityType: 'promptTemplate',
      id: command.contentId,
      recipe: (draft) => {
        Object.assign(draft, {
          ...titleFields,
          modifiedAt: command.modifiedAt,
          templateText: command.templateText
        })
      }
    }
  ]
}

/** Returns the authoritative targets relevant to one content movement attempt. */
const collectMoveTargets = (
  sourcePromptFolderId: string,
  destinationPromptFolderId: string,
  contentId: string,
  kind: PromptFolderContentKind
): DomainTarget[] => {
  /** Ordered unique movement target set. */
  const targets: DomainTarget[] = []
  addUniqueTarget(targets, { entityType: 'promptFolder', id: sourcePromptFolderId })
  addUniqueTarget(targets, { entityType: 'promptFolder', id: destinationPromptFolderId })
  addUniqueTarget(targets, {
    entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
    id: contentId
  })
  return targets
}

/** Creates a channel-specific movement planner without placing kind on the command wire shape. */
const createMovePlanner = (
  kind: PromptFolderContentKind
): DomainPlanner<MoveMarkdownContentDomainCommand> => (state, command) => {
  /** Requested source folder from the movement command. */
  const requestedSource = state.get('promptFolder', command.sourcePromptFolderId)
  /** Requested destination folder from the movement command. */
  const destination = state.get('promptFolder', command.destinationPromptFolderId)
  /** Canonical content projection selected by the registered movement channel. */
  const content = getMarkdownContent(state, kind, command.contentId)
  /** Actual root containing the requested active content reference. */
  const actualSource = state
    .getAll('promptFolder')
    .find(
      (folder) =>
        folder.kind === kind &&
        getActiveMarkdownContentIds(folder, kind).includes(command.contentId)
    )
  /** Correct source used for invariant-conflict reconciliation. */
  const conflictSourceId = actualSource?.id ?? requestedSource?.id ?? command.sourcePromptFolderId
  /** Correct authoritative movement target set. */
  const targets = collectMoveTargets(
    conflictSourceId,
    command.destinationPromptFolderId,
    command.contentId,
    kind
  )
  /** Whether channel-selected content is active and therefore eligible for movement. */
  const canMoveContent = kind === 'template' || content?.status !== PromptStatus.Completed

  if (
    !requestedSource ||
    !destination ||
    requestedSource.kind !== kind ||
    destination.kind !== kind ||
    !content ||
    !actualSource ||
    actualSource.id !== requestedSource.id ||
    !canMoveContent
  ) {
    return createConflict('Markdown content ownership conflict', targets)
  }

  /** Entry reference transferred between category groups or root folders. */
  const entry = createContentEntryRef(kind, command.contentId)
  /** Destination IDs used to resolve blank-title fallback collisions. */
  const destinationContentIds = getActiveMarkdownContentIds(destination, kind).filter(
    (contentId) => contentId !== command.contentId
  )
  /** Cross-root content projection with a destination-safe fallback title. */
  const contentWithDestinationFallback =
    requestedSource.id !== destination.id && content.title.trim().length === 0
      ? {
          ...content,
          fallbackTitle: resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationContentIds,
            lookupPrompt: (contentId) => getMarkdownContent(state, kind, contentId),
            promptId: command.contentId,
            currentTitle: content.title,
            currentFallbackTitle: content.fallbackTitle,
            nextTitle: content.title,
            defaultFallbackTitle:
              kind === 'template' ? DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE : undefined
          }).fallbackTitle
        }
      : content

  try {
    /** Destination placement validates category and predecessor invariants. */
    const placement = placeMarkdownContentInCategoryOrder(
      destination.categoryOrder,
      contentWithDestinationFallback,
      entry,
      command.categoryId,
      command.previousEntryId
    )
    /** Domain changes shared by renderer optimism and main persistence. */
    const changes: DomainChange[] = []

    if (requestedSource.id === destination.id) {
      changes.push({
        type: 'update',
        entityType: 'promptFolder',
        id: requestedSource.id,
        recipe: (draft) => {
          draft.categoryOrder = placeMarkdownContentInCategoryOrder(
            draft.categoryOrder,
            placement.content,
            entry,
            command.categoryId,
            command.previousEntryId
          ).categoryOrder
        }
      })
    } else {
      changes.push(
        {
          type: 'update',
          entityType: 'promptFolder',
          id: requestedSource.id,
          recipe: (draft) => {
            draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
          }
        },
        {
          type: 'update',
          entityType: 'promptFolder',
          id: destination.id,
          recipe: (draft) => {
            draft.categoryOrder = placeMarkdownContentInCategoryOrder(
              draft.categoryOrder,
              placement.content,
              entry,
              command.categoryId,
              command.previousEntryId
            ).categoryOrder
          }
        }
      )
    }

    changes.push({
      type: 'update',
      entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
      id: command.contentId,
      recipe: (draft) => {
        if (placement.content.category === undefined) delete draft.category
        else draft.category = placement.content.category
        draft.fallbackTitle = placement.content.fallbackTitle
      }
    } as DomainChange)

    return changes
  } catch {
    return createConflict('Markdown content placement conflict', targets)
  }
}

/** Plans prompt movement for the prompt-specific move channel. */
export const planPromptMove = createMovePlanner('prompt')

/** Plans prompt-template movement for the prompt-template-specific move channel. */
export const planPromptTemplateMove = createMovePlanner('template')
