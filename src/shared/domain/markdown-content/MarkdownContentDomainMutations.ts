import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from '@shared/domain/DomainChanges'
import {
  getMarkdownContentIds,
  getOrderedMarkdownContentIds,
  getPromptStatusFolderContentIds,
  placeMarkdownContentInCategoryOrder
} from '@shared/domain/markdown-content/MarkdownContent'
import { parseIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { promptEntryRef, promptTemplateEntryRef } from '@shared/domain/OrderContainer'
import {
  getPromptStatusFolderDefinition,
  isPromptStatusFolderId,
  PROMPT_STATUS_FOLDER_REGISTRY,
  type PromptContentStatus,
  PromptStatusFolderId,
  type PromptPersisted,
  type PromptTemplateReference
} from '@shared/domain/prompt/Prompt'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolderContentKind
} from '@shared/domain/prompt-folder/PromptFolder'
import {
  DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
  resolvePromptTitleUpdateForPromptIds
} from '@shared/domain/prompt/promptFallbackTitle'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import { getAllWorkspaceFolderEntries } from '@shared/domain/workspace/Workspace'
import { createMarkdownContentUiStateKey } from '@shared/domain/ui-state/MarkdownContentUiState'

/** Renderer-authored command for creating one prompt at an exact root position. */
export type CreatePromptDomainCommand = {
  /** Category-ordered group receiving the new prompt. */
  statusFolderId: PromptStatusFolderId
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
        'templates',
        'statusFolderId'
      ].includes(key)
  )
  if (
    (Object.keys(record).length !== 9 && Object.keys(record).length !== 10) ||
    hasUnknownField ||
    !isPromptStatusFolderId(record.statusFolderId) ||
    PROMPT_STATUS_FOLDER_REGISTRY[record.statusFolderId].ordering !== 'category' ||
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
    statusFolderId: record.statusFolderId,
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
    promptIds: getOrderedMarkdownContentIds(
      promptFolder,
      'prompt',
      command.statusFolderId
    ),
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
    status: PROMPT_STATUS_FOLDER_REGISTRY[command.statusFolderId].entryStatus
  }

  /** Destination layout resolved from the creation group. */
  const layout = promptFolder.statusFolders[command.statusFolderId]
  if (layout.ordering !== 'category') return createConflict('Prompt creation group conflict', targets)

  try {
    /** Validated prompt data and category order for the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      layout.categoryOrder,
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
          if (draft.kind === 'prompt') {
            /** Ordered draft layout receiving the created prompt. */
            const draftLayout = draft.statusFolders[command.statusFolderId]
            if (draftLayout.ordering === 'category') draftLayout.categoryOrder = placement.categoryOrder
          }
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
    promptIds: getOrderedMarkdownContentIds(promptFolder, 'template'),
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
    templateText: command.templateText,
    status: PromptTemplateStatus.Active
  }

  try {
    /** Validated template data and category order for the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      promptFolder.statusFolders.active.categoryOrder,
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
          if (draft.kind === 'template') draft.statusFolders.active.categoryOrder = placement.categoryOrder
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
  status?: PromptContentStatus
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
    .find((candidate) =>
      getAllWorkspaceFolderEntries(candidate).some(
        (entry) => entry.id === command.promptFolderId
      )
    )
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
        for (const layout of Object.values(draft.statusFolders)) {
          if (layout.ordering === 'category') {
            layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, entry)
          } else {
            layout.promptIds = layout.promptIds.filter((id) => id !== command.contentId)
          }
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
    promptIds:
      owner.kind === 'prompt'
        ? getPromptStatusFolderContentIds(
            owner,
            getPromptStatusFolderDefinition(prompt.status).id
          )
        : [],
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
    promptIds: getPromptStatusFolderContentIds(
      owner,
      getPromptStatusFolderDefinition(template.status ?? PromptTemplateStatus.Active).id
    ),
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
