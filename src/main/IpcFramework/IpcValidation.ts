import { PromptStatus } from '@shared/Prompt'
import type { PromptPersisted, PromptTemplateReference } from '@shared/Prompt'
import type {
  DeletePromptFolderPayload,
  LoadPromptFolderInitialPayload,
  PromptFolder,
  PromptFolderSettings
} from '@shared/PromptFolder'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import type {
  Category,
  SetCategoryDescriptionPayload
} from '@shared/Category'
import type {
  MarkdownContentUiState,
  MarkdownContentUiStateRevisionPayload
} from '@shared/MarkdownContentUiState'
import type { IpcRequestContext, IpcRequestWithPayload } from '@shared/IpcRequest'
import type { RevisionPayloadEntity } from '@shared/Revision'
import type {
  DeleteMarkdownContentPayload,
  MarkdownContentPersisted,
  MarkdownContentRevisionPayload
} from '@shared/MarkdownContent'
import type { SystemSettings, SystemSettingsRevisionPayload } from '@shared/SystemSettings'
import type {
  LoadWorkspacePersistenceRequest,
  UserPersistence,
  UserPersistenceRevisionPayload,
  WorkspacePersistence,
  WorkspacePersistenceRevisionPayload
} from '@shared/UserPersistence'
import { parseWorkspacePersistence as parseSharedWorkspacePersistence } from '@shared/UserPersistence'
import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload,
  LoadWorkspaceByPathRequest,
  Workspace
} from '@shared/Workspace'

export type Parser<T> = (value: unknown) => T | null

export type ParsedRequest<TRequest> =
  | { success: true; value: TRequest }
  | ({ success: false } & IpcRequestContext)

export const parseString: Parser<string> = (value) => {
  return typeof value === 'string' ? value : null
}

export const parseClientId: Parser<string> = (value) => {
  return typeof value === 'string' && value.length > 0 ? value : null
}

const parseBoolean: Parser<boolean> = (value) => {
  return typeof value === 'boolean' ? value : null
}

export const parseNumber: Parser<number> = (value) => {
  return typeof value === 'number' ? value : null
}

const parsePromptStatus: Parser<PromptStatus> = (value) => {
  return value === PromptStatus.Todo ||
    value === PromptStatus.InProgress ||
    value === PromptStatus.Completed
    ? value
    : null
}

const parseNullableString: Parser<string | null> = (value) => {
  return value === null || typeof value === 'string' ? value : null
}

export const parseArray = <TItem>(itemParser: Parser<TItem>): Parser<TItem[]> => {
  return (value) => {
    if (!Array.isArray(value)) {
      return null
    }

    const parsedItems: TItem[] = []

    for (const item of value) {
      const parsedItem = itemParser(item)

      if (parsedItem === null) {
        return null
      }

      parsedItems.push(parsedItem)
    }

    return parsedItems
  }
}

export const parseObject = <TValue extends object>(shape: {
  [TKey in keyof TValue]: Parser<TValue[TKey]>
}): Parser<TValue> => {
  return (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null
    }

    const record = value as Record<string, unknown>
    const shapeKeys = Object.keys(shape) as Array<keyof TValue & string>
    const valueKeys = Object.keys(record)

    if (shapeKeys.length !== valueKeys.length) {
      return null
    }

    for (const valueKey of valueKeys) {
      if (!(valueKey in shape)) {
        return null
      }
    }

    const parsedObject = {} as { [TKey in keyof TValue]: TValue[TKey] }

    for (const key of shapeKeys) {
      const parser = shape[key]
      const parsedField = parser(record[key])

      if (parsedField === null) {
        if (record[key] === null && parser === parseNullableString) {
          parsedObject[key] = null as TValue[typeof key]
          continue
        }

        return null
      }

      parsedObject[key] = parsedField
    }

    return parsedObject
  }
}

const parseRevisionPayloadEntity = <TData>(
  dataParser: Parser<TData>
): Parser<RevisionPayloadEntity<TData>> => {
  return parseObject({
    id: parseString,
    expectedRevision: parseNumber,
    data: dataParser
  })
}

export const parseWireRequestWithPayload = <TPayload>(
  payloadParser: Parser<TPayload>
): Parser<IpcRequestWithPayload<TPayload>> => {
  return parseObject({
    requestId: parseString,
    clientId: parseClientId,
    payload: payloadParser
  })
}

const extractRequestId = (request: unknown): string => {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return ''
  }

  const requestId = (request as Record<string, unknown>).requestId
  return typeof requestId === 'string' ? requestId : ''
}

const extractClientId = (request: unknown): string => {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return ''
  }

  const clientId = (request as Record<string, unknown>).clientId
  return typeof clientId === 'string' ? clientId : ''
}

const toParsedRequest = <TRequest>(
  value: TRequest | null,
  requestId: string,
  clientId: string
): ParsedRequest<TRequest> => {
  if (value === null) {
    return {
      success: false,
      requestId,
      clientId
    }
  }

  return { success: true, value }
}

export const createRequestParser = <TRequest>(requestParser: Parser<TRequest>) => {
  return (request: unknown): ParsedRequest<TRequest> => {
    return toParsedRequest(
      requestParser(request),
      extractRequestId(request),
      extractClientId(request)
    )
  }
}

const parseWorkspace = parseObject<Workspace>({
  id: parseString,
  workspacePath: parseString,
  workspaceName: parseString,
  entries: parseArray(
    parseObject({
      kind: (value) => (value === 'folder' ? 'folder' : null),
      id: parseString
    })
  )
})

const parseWorkspaceRevisionPayloadEntity = parseRevisionPayloadEntity<Workspace>(parseWorkspace)

const parsePromptFolderSettings = parseObject<PromptFolderSettings>({
  folderDescription: parseNullableString
})

type ParsedPromptFolder = Omit<PromptFolder, 'kind' | 'settings'> & {
  kind: PromptFolder['kind']
  settings: PromptFolderSettings
}

const parsePromptFolderBase = parseObject<ParsedPromptFolder>({
  id: parseString,
  kind: (value) => (value === 'prompt' || value === 'template' ? value : null),
  folderName: parseString,
  displayName: parseString,
  completedPromptIds: parseArray(parseString),
  categoryOrder: parseObject({
    categories: parseArray(
      parseObject({
        categoryId: parseNullableString,
        entries: parseArray(
          parseObject({
            kind: (value) =>
              value === 'prompt' || value === 'template' ? value : null,
            id: parseString
          })
        )
      })
    )
  }),
  settings: parsePromptFolderSettings
})

const parsePromptFolder: Parser<PromptFolder> = (value) => {
  return parsePromptFolderBase(value) as PromptFolder | null
}

const parsePromptFolderRevisionPayloadEntity =
  parseRevisionPayloadEntity<PromptFolder>(parsePromptFolder)

const parseSystemSettings = parseObject<SystemSettings>({
  promptFontSize: parseNumber,
  promptEditorMinLines: parseNumber,
  promptEditorMaxLines: parseNumber,
  showLineNumbers: parseBoolean
})

const parseSystemSettingsRevisionPayloadEntity =
  parseRevisionPayloadEntity<SystemSettings>(parseSystemSettings)

const parseUserPersistence = parseObject<UserPersistence>({
  lastWorkspaceInfoPath: parseNullableString,
  appSidebarWidthPx: parseNumber
})

const parseUserPersistenceRevisionPayloadEntity =
  parseRevisionPayloadEntity<UserPersistence>(parseUserPersistence)

const parseWorkspacePersistence: Parser<WorkspacePersistence> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const workspaceId = parseString(record.workspaceId)
  return workspaceId ? parseSharedWorkspacePersistence(record, workspaceId) : null
}

const parseWorkspacePersistenceRevisionPayloadEntity =
  parseRevisionPayloadEntity<WorkspacePersistence>(parseWorkspacePersistence)

const parsePrompt: Parser<PromptPersisted> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  const hasStatus = keys.includes('status')
  const hasCompletedAt = keys.includes('completedAt')
  const hasTemplates = keys.includes('templates')
  const hasCategory = keys.includes('category')
  const allowedKeys = new Set([
    'id',
    'title',
    'fallbackTitle',
    'createdAt',
    'modifiedAt',
    'promptText',
    ...(hasCategory ? ['category'] : []),
    ...(hasTemplates ? ['templates'] : []),
    'status',
    ...(hasCompletedAt ? ['completedAt'] : [])
  ])

  if (keys.length !== allowedKeys.size) {
    return null
  }

  if (!hasStatus || keys.some((key) => !allowedKeys.has(key))) {
    return null
  }

  const hasCompletedStatus = record.status === PromptStatus.Completed
  if (hasCompletedStatus !== hasCompletedAt) {
    return null
  }

  // Template references are parsed separately because null is a valid selection value.
  const { templates: templateReferences, ...recordWithoutTemplates } = record
  const prompt = parseObject<Omit<PromptPersisted, 'templates'>>({
    id: parseString,
    title: parseString,
    fallbackTitle: parseString,
    createdAt: parseString,
    modifiedAt: parseString,
    promptText: parseString,
    ...(hasCategory ? { category: parseString } : {}),
    status: parsePromptStatus,
    ...(hasCompletedAt
      ? {
          completedAt: parseString
        }
      : {})
  } as {
    [TKey in keyof Omit<PromptPersisted, 'templates'>]: Parser<
      Omit<PromptPersisted, 'templates'>[TKey]
    >
  })(recordWithoutTemplates)

  if (!prompt || !hasTemplates) return prompt
  if (templateReferences === null) return { ...prompt, templates: null }

  // Strict reference parser keeps the current on-wire object shape exact.
  const parsedTemplateReferences = parseArray(
    parseObject<PromptTemplateReference>({ id: parseString })
  )(templateReferences)
  return parsedTemplateReferences ? { ...prompt, templates: parsedTemplateReferences } : null
}

const parsePromptRevisionPayloadEntity = parseRevisionPayloadEntity<PromptPersisted>(parsePrompt)

const parsePromptTemplate: Parser<PromptTemplatePersisted> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const hasCategory = Object.keys(record).includes('category')
  return parseObject<PromptTemplatePersisted>({
    id: parseString,
    title: parseString,
    fallbackTitle: parseString,
    createdAt: parseString,
    modifiedAt: parseString,
    templateText: parseString,
    ...(hasCategory ? { category: parseString } : {})
  } as { [TKey in keyof PromptTemplatePersisted]: Parser<PromptTemplatePersisted[TKey]> })(record)
}

const parsePromptTemplateRevisionPayloadEntity =
  parseRevisionPayloadEntity<PromptTemplatePersisted>(parsePromptTemplate)

/** Exact parser for category records sent over mutation IPC. */
const parseCategory = parseObject<Category>({
  id: parseString,
  displayName: parseString,
  description: parseNullableString
})

/** Revision payload parser for category mutations. */
const parseCategoryRevisionPayloadEntity = parseRevisionPayloadEntity<Category>(parseCategory)

const parseMarkdownContentUiState = parseObject<MarkdownContentUiState>({
  workspaceId: parseString,
  contentId: parseString,
  editorViewStateJson: parseString
})

const parseMarkdownContentUiStateRevisionPayloadEntity =
  parseRevisionPayloadEntity<MarkdownContentUiState>(parseMarkdownContentUiState)

const parseCreateWorkspacePayload = parseObject<CreateWorkspacePayload>({
  workspacePath: parseString,
  workspaceName: parseString,
  includeExamplePrompts: parseBoolean
})

const parseCreateWorkspaceWireRequest: Parser<IpcRequestWithPayload<CreateWorkspacePayload>> =
  parseWireRequestWithPayload<CreateWorkspacePayload>(parseCreateWorkspacePayload)

const parseCloseWorkspacePayload = parseObject<CloseWorkspacePayload>({})

const parseCloseWorkspaceWireRequest: Parser<IpcRequestWithPayload<CloseWorkspacePayload>> =
  parseWireRequestWithPayload<CloseWorkspacePayload>(parseCloseWorkspacePayload)

const createMarkdownContentPayloadParsers = <TContent extends MarkdownContentPersisted>(
  parseContentRevisionPayloadEntity: Parser<RevisionPayloadEntity<TContent>>
) => {
  const parseRevisionPayload = parseObject<MarkdownContentRevisionPayload<TContent>>({
    content: parseContentRevisionPayloadEntity
  })
  const parseDeletePayload = parseObject<DeleteMarkdownContentPayload<TContent>>({
    promptFolder: parsePromptFolderRevisionPayloadEntity,
    content: parseContentRevisionPayloadEntity
  })
  return {
    update: parseWireRequestWithPayload(parseRevisionPayload),
    delete: parseWireRequestWithPayload(parseDeletePayload)
  }
}

const promptContentPayloadParsers = createMarkdownContentPayloadParsers(
  parsePromptRevisionPayloadEntity
)
const promptTemplateContentPayloadParsers = createMarkdownContentPayloadParsers(
  parsePromptTemplateRevisionPayloadEntity
)

/** Parser for category description payloads. */
const parseSetCategoryDescriptionPayload = parseObject<SetCategoryDescriptionPayload>({
  category: parseCategoryRevisionPayloadEntity,
  description: parseNullableString
})

/** Wire request parser for category description updates. */
const parseSetCategoryDescriptionWireRequest: Parser<
  IpcRequestWithPayload<SetCategoryDescriptionPayload>
> = parseWireRequestWithPayload<SetCategoryDescriptionPayload>(
  parseSetCategoryDescriptionPayload
)

const parseDeletePromptFolderPayload: Parser<DeletePromptFolderPayload> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    !('workspace' in record) ||
    !('promptFolder' in record)
  ) {
    return null
  }

  const workspace = parseWorkspaceRevisionPayloadEntity(record.workspace)
  const promptFolder = parsePromptFolderRevisionPayloadEntity(record.promptFolder)

  if (!workspace || !promptFolder) {
    return null
  }

  return { workspace, promptFolder }
}

const parseDeletePromptFolderWireRequest: Parser<IpcRequestWithPayload<DeletePromptFolderPayload>> =
  parseWireRequestWithPayload<DeletePromptFolderPayload>(parseDeletePromptFolderPayload)

const parseSystemSettingsRevisionPayload = parseObject<SystemSettingsRevisionPayload>({
  systemSettings: parseSystemSettingsRevisionPayloadEntity
})

const parseUpdateSystemSettingsRevisionWireRequest: Parser<
  IpcRequestWithPayload<SystemSettingsRevisionPayload>
> = parseWireRequestWithPayload<SystemSettingsRevisionPayload>(parseSystemSettingsRevisionPayload)

const parseUserPersistenceRevisionPayload = parseObject<UserPersistenceRevisionPayload>({
  userPersistence: parseUserPersistenceRevisionPayloadEntity
})

const parseUpdateUserPersistenceRevisionWireRequest: Parser<
  IpcRequestWithPayload<UserPersistenceRevisionPayload>
> = parseWireRequestWithPayload<UserPersistenceRevisionPayload>(parseUserPersistenceRevisionPayload)

const parseWorkspacePersistenceRevisionPayload = parseObject<WorkspacePersistenceRevisionPayload>({
  workspacePersistence: parseWorkspacePersistenceRevisionPayloadEntity
})

const parseUpdateWorkspacePersistenceRevisionWireRequest: Parser<
  IpcRequestWithPayload<WorkspacePersistenceRevisionPayload>
> = parseWireRequestWithPayload<WorkspacePersistenceRevisionPayload>(
  parseWorkspacePersistenceRevisionPayload
)

const parseMarkdownContentUiStateRevisionPayload =
  parseObject<MarkdownContentUiStateRevisionPayload>({
    markdownContentUiState: parseMarkdownContentUiStateRevisionPayloadEntity
  })

const parseUpdateMarkdownContentUiStateRevisionWireRequest: Parser<
  IpcRequestWithPayload<MarkdownContentUiStateRevisionPayload>
> = parseWireRequestWithPayload<MarkdownContentUiStateRevisionPayload>(
  parseMarkdownContentUiStateRevisionPayload
)

const parseLoadWorkspaceByPathPayload = parseObject<LoadWorkspaceByPathRequest>({
  workspaceInfoPath: parseString
})

const parseLoadWorkspaceByPathWireRequest: Parser<
  IpcRequestWithPayload<LoadWorkspaceByPathRequest>
> = parseWireRequestWithPayload<LoadWorkspaceByPathRequest>(parseLoadWorkspaceByPathPayload)

const parseLoadWorkspacePersistencePayload = parseObject<LoadWorkspacePersistenceRequest>({
  workspaceId: parseString
})

const parseLoadWorkspacePersistenceWireRequest: Parser<
  IpcRequestWithPayload<LoadWorkspacePersistenceRequest>
> = parseWireRequestWithPayload<LoadWorkspacePersistenceRequest>(
  parseLoadWorkspacePersistencePayload
)

const parseLoadPromptFolderInitialPayload = parseObject<LoadPromptFolderInitialPayload>({
  workspaceId: parseString,
  promptFolderId: parseString
})

const parseLoadPromptFolderInitialWireRequest: Parser<
  IpcRequestWithPayload<LoadPromptFolderInitialPayload>
> = parseWireRequestWithPayload<LoadPromptFolderInitialPayload>(parseLoadPromptFolderInitialPayload)

export const parseCreateWorkspaceRequest = createRequestParser(parseCreateWorkspaceWireRequest)

export const parseCloseWorkspaceRequest = createRequestParser(parseCloseWorkspaceWireRequest)

export const parseUpdatePromptRevisionRequest = createRequestParser(
  promptContentPayloadParsers.update
)

/** Validated request parser for category description IPC. */
export const parseSetCategoryDescriptionRequest = createRequestParser(
  parseSetCategoryDescriptionWireRequest
)

export const parseDeletePromptFolderRequest = createRequestParser(
  parseDeletePromptFolderWireRequest
)

export const parseDeletePromptRequest = createRequestParser(promptContentPayloadParsers.delete)

export const parseUpdatePromptTemplateRevisionRequest = createRequestParser(
  promptTemplateContentPayloadParsers.update
)

export const parseDeletePromptTemplateRequest = createRequestParser(
  promptTemplateContentPayloadParsers.delete
)

export const parseUpdateSystemSettingsRevisionRequest = createRequestParser(
  parseUpdateSystemSettingsRevisionWireRequest
)

export const parseUpdateUserPersistenceRevisionRequest = createRequestParser(
  parseUpdateUserPersistenceRevisionWireRequest
)

export const parseUpdateWorkspacePersistenceRevisionRequest = createRequestParser(
  parseUpdateWorkspacePersistenceRevisionWireRequest
)

export const parseUpdateMarkdownContentUiStateRevisionRequest = createRequestParser(
  parseUpdateMarkdownContentUiStateRevisionWireRequest
)

export const parseLoadWorkspaceByPathRequest = createRequestParser(
  parseLoadWorkspaceByPathWireRequest
)

export const parseLoadWorkspacePersistenceRequest = createRequestParser(
  parseLoadWorkspacePersistenceWireRequest
)

export const parseLoadPromptFolderInitialRequest = createRequestParser(
  parseLoadPromptFolderInitialWireRequest
)
