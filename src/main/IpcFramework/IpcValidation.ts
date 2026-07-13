import { PromptStatus } from '@shared/Prompt'
import type {
  CreatePromptPayload,
  DeletePromptPayload,
  MovePromptPayload,
  PromptPersisted,
  PromptRevisionPayload,
  SetPromptStatusPayload
} from '@shared/Prompt'
import type {
  CreatePromptFolderPayload,
  LoadPromptFolderInitialPayload,
  PromptFolder,
  PromptFolderSettings,
  RenamePromptFolderPayload,
  UpdatePromptFolderSettingsPayload
} from '@shared/PromptFolder'
import type { PromptUiState, PromptUiStateRevisionPayload } from '@shared/PromptUiState'
import type { IpcRequestContext, IpcRequestWithPayload } from '@shared/IpcRequest'
import type { RevisionPayloadEntity } from '@shared/Revision'
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
  MovePromptFolderPayload,
  Workspace
} from '@shared/Workspace'

type Parser<T> = (value: unknown) => T | null

export type ParsedRequest<TRequest> =
  | { success: true; value: TRequest }
  | ({ success: false } & IpcRequestContext)

const parseString: Parser<string> = (value) => {
  return typeof value === 'string' ? value : null
}

const parseClientId: Parser<string> = (value) => {
  return typeof value === 'string' && value.length > 0 ? value : null
}

const parseBoolean: Parser<boolean> = (value) => {
  return typeof value === 'boolean' ? value : null
}

const parseNumber: Parser<number> = (value) => {
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

const parseArray = <TItem>(itemParser: Parser<TItem>): Parser<TItem[]> => {
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

const parseObject = <TValue extends object>(shape: {
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

const parseWireRequestWithPayload = <TPayload>(
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

const createRequestParser = <TRequest>(requestParser: Parser<TRequest>) => {
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
  folderDescription: parseString,
  folderPrefix: parseString,
  folderSuffix: parseString
})

const parsePromptFolder = parseObject<PromptFolder>({
  id: parseString,
  folderName: parseString,
  displayName: parseString,
  entries: parseArray(
    parseObject({
      kind: (value) => (value === 'prompt' || value === 'folder' ? value : null),
      id: parseString
    })
  ),
  completedPromptIds: parseArray(parseString),
  settings: parsePromptFolderSettings
})

const parsePromptFolderRevisionPayloadEntity =
  parseRevisionPayloadEntity<PromptFolder>(parsePromptFolder)

const parsePromptFolderSettingsPayloadEntity =
  parseRevisionPayloadEntity<PromptFolderSettings>(parsePromptFolderSettings)

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
  const allowedKeys = new Set([
    'id',
    'title',
    'fallbackTitle',
    'createdAt',
    'modifiedAt',
    'promptText',
    'status',
    ...(hasCompletedAt ? ['completedAt'] : [])
  ])

  if (keys.length !== 7 && keys.length !== 8) {
    return null
  }

  if (!hasStatus || keys.some((key) => !allowedKeys.has(key))) {
    return null
  }

  const hasCompletedStatus = record.status === PromptStatus.Completed
  if (hasCompletedStatus !== hasCompletedAt) {
    return null
  }

  const prompt = parseObject<PromptPersisted>({
    id: parseString,
    title: parseString,
    fallbackTitle: parseString,
    createdAt: parseString,
    modifiedAt: parseString,
    promptText: parseString,
    status: parsePromptStatus,
    ...(hasCompletedAt
      ? {
          completedAt: parseString
        }
      : {})
  } as {
    [TKey in keyof PromptPersisted]: Parser<PromptPersisted[TKey]>
  })(record)

  return prompt
}

const parsePromptRevisionPayloadEntity = parseRevisionPayloadEntity<PromptPersisted>(parsePrompt)

const parsePromptUiState = parseObject<PromptUiState>({
  workspaceId: parseString,
  promptId: parseString,
  editorViewStateJson: parseString
})

const parsePromptUiStateRevisionPayloadEntity =
  parseRevisionPayloadEntity<PromptUiState>(parsePromptUiState)

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

const parseNullablePromptFolderRevisionPayloadEntity = (
  value: unknown
): RevisionPayloadEntity<PromptFolder> | null | undefined => {
  if (value === null) {
    return null
  }

  return parsePromptFolderRevisionPayloadEntity(value) ?? undefined
}

const parseCreatePromptFolderPayload: Parser<CreatePromptFolderPayload> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const valueKeys = Object.keys(record)

  if (
    valueKeys.length !== 5 ||
    !('workspace' in record) ||
    !('parentPromptFolder' in record) ||
    !('promptFolderId' in record) ||
    !('displayName' in record) ||
    !('previousEntryId' in record)
  ) {
    return null
  }

  const workspace = parseWorkspaceRevisionPayloadEntity(record.workspace)
  const parentPromptFolder = parseNullablePromptFolderRevisionPayloadEntity(
    record.parentPromptFolder
  )
  const promptFolderId = parseString(record.promptFolderId)
  const displayName = parseString(record.displayName)

  if (
    !workspace ||
    parentPromptFolder === undefined ||
    promptFolderId === null ||
    displayName === null ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }

  return {
    workspace,
    parentPromptFolder,
    promptFolderId,
    displayName,
    previousEntryId: record.previousEntryId
  }
}

const parseCreatePromptFolderWireRequest: Parser<IpcRequestWithPayload<CreatePromptFolderPayload>> =
  parseWireRequestWithPayload<CreatePromptFolderPayload>(parseCreatePromptFolderPayload)

const parseCreatePromptPayload: Parser<CreatePromptPayload> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const valueKeys = Object.keys(record)

  if (
    valueKeys.length !== 3 ||
    !('promptFolder' in record) ||
    !('prompt' in record) ||
    !('previousEntryId' in record)
  ) {
    return null
  }

  const promptFolder = parsePromptFolderRevisionPayloadEntity(record.promptFolder)
  const prompt = parsePromptRevisionPayloadEntity(record.prompt)

  if (promptFolder === null || prompt === null) {
    return null
  }

  const previousEntryId = record.previousEntryId

  if (previousEntryId !== null && typeof previousEntryId !== 'string') {
    return null
  }

  return {
    promptFolder,
    prompt,
    previousEntryId
  }
}

const parseCreatePromptWireRequest: Parser<IpcRequestWithPayload<CreatePromptPayload>> =
  parseWireRequestWithPayload<CreatePromptPayload>(parseCreatePromptPayload)

const parsePromptRevisionPayload = parseObject<PromptRevisionPayload>({
  prompt: parsePromptRevisionPayloadEntity
})

const parseUpdatePromptRevisionWireRequest: Parser<IpcRequestWithPayload<PromptRevisionPayload>> =
  parseWireRequestWithPayload<PromptRevisionPayload>(parsePromptRevisionPayload)

const parseUpdatePromptFolderSettingsPayload = parseObject<UpdatePromptFolderSettingsPayload>({
  promptFolder: parsePromptFolderSettingsPayloadEntity
})

const parseUpdatePromptFolderSettingsWireRequest: Parser<
  IpcRequestWithPayload<UpdatePromptFolderSettingsPayload>
> = parseWireRequestWithPayload<UpdatePromptFolderSettingsPayload>(
  parseUpdatePromptFolderSettingsPayload
)

const parseRenamePromptFolderPayload = parseObject<RenamePromptFolderPayload>({
  promptFolder: parsePromptFolderRevisionPayloadEntity,
  displayName: parseString
})

const parseRenamePromptFolderWireRequest: Parser<
  IpcRequestWithPayload<RenamePromptFolderPayload>
> = parseWireRequestWithPayload<RenamePromptFolderPayload>(parseRenamePromptFolderPayload)

const parseDeletePromptPayload = parseObject<DeletePromptPayload>({
  promptFolder: parsePromptFolderRevisionPayloadEntity,
  prompt: parsePromptRevisionPayloadEntity
})

const parseDeletePromptWireRequest: Parser<IpcRequestWithPayload<DeletePromptPayload>> =
  parseWireRequestWithPayload<DeletePromptPayload>(parseDeletePromptPayload)

const parseMovePromptPayload: Parser<MovePromptPayload> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const valueKeys = Object.keys(record)

  if (
    valueKeys.length !== 4 ||
    !('sourcePromptFolder' in record) ||
    !('destinationPromptFolder' in record) ||
    !('prompt' in record) ||
    !('previousEntryId' in record)
  ) {
    return null
  }

  const sourcePromptFolder = parsePromptFolderRevisionPayloadEntity(record.sourcePromptFolder)
  const destinationPromptFolder = parsePromptFolderRevisionPayloadEntity(
    record.destinationPromptFolder
  )
  const prompt = parsePromptRevisionPayloadEntity(record.prompt)

  if (sourcePromptFolder === null || destinationPromptFolder === null || prompt === null) {
    return null
  }

  const previousEntryId = record.previousEntryId

  if (previousEntryId !== null && typeof previousEntryId !== 'string') {
    return null
  }

  return {
    sourcePromptFolder,
    destinationPromptFolder,
    prompt,
    previousEntryId
  }
}

const parseMovePromptWireRequest: Parser<IpcRequestWithPayload<MovePromptPayload>> =
  parseWireRequestWithPayload<MovePromptPayload>(parseMovePromptPayload)

const parseSetPromptStatusPayload = parseObject<SetPromptStatusPayload>({
  promptFolder: parsePromptFolderRevisionPayloadEntity,
  prompt: parsePromptRevisionPayloadEntity,
  status: parsePromptStatus
})

const parseSetPromptStatusWireRequest: Parser<IpcRequestWithPayload<SetPromptStatusPayload>> =
  parseWireRequestWithPayload<SetPromptStatusPayload>(parseSetPromptStatusPayload)

const parseMovePromptFolderPayload: Parser<MovePromptFolderPayload> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const valueKeys = Object.keys(record)

  if (
    valueKeys.length !== 5 ||
    !('workspace' in record) ||
    !('sourceParentPromptFolder' in record) ||
    !('destinationParentPromptFolder' in record) ||
    !('promptFolderId' in record) ||
    !('previousEntryId' in record)
  ) {
    return null
  }

  const workspace = parseWorkspaceRevisionPayloadEntity(record.workspace)
  const sourceParentPromptFolder = parseNullablePromptFolderRevisionPayloadEntity(
    record.sourceParentPromptFolder
  )
  const destinationParentPromptFolder = parseNullablePromptFolderRevisionPayloadEntity(
    record.destinationParentPromptFolder
  )
  const promptFolderId = parseString(record.promptFolderId)

  if (
    !workspace ||
    sourceParentPromptFolder === undefined ||
    destinationParentPromptFolder === undefined ||
    promptFolderId === null ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }

  return {
    workspace,
    sourceParentPromptFolder,
    destinationParentPromptFolder,
    promptFolderId,
    previousEntryId: record.previousEntryId
  }
}

const parseMovePromptFolderWireRequest: Parser<IpcRequestWithPayload<MovePromptFolderPayload>> =
  parseWireRequestWithPayload<MovePromptFolderPayload>(parseMovePromptFolderPayload)

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

const parsePromptUiStateRevisionPayload = parseObject<PromptUiStateRevisionPayload>({
  promptUiState: parsePromptUiStateRevisionPayloadEntity
})

const parseUpdatePromptUiStateRevisionWireRequest: Parser<
  IpcRequestWithPayload<PromptUiStateRevisionPayload>
> = parseWireRequestWithPayload<PromptUiStateRevisionPayload>(parsePromptUiStateRevisionPayload)

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

export const parseCreatePromptFolderRequest = createRequestParser(
  parseCreatePromptFolderWireRequest
)

export const parseCreatePromptRequest = createRequestParser(parseCreatePromptWireRequest)

export const parseUpdatePromptRevisionRequest = createRequestParser(
  parseUpdatePromptRevisionWireRequest
)

export const parseUpdatePromptFolderSettingsRequest = createRequestParser(
  parseUpdatePromptFolderSettingsWireRequest
)

export const parseRenamePromptFolderRequest = createRequestParser(
  parseRenamePromptFolderWireRequest
)

export const parseDeletePromptRequest = createRequestParser(parseDeletePromptWireRequest)

export const parseMovePromptRequest = createRequestParser(parseMovePromptWireRequest)

export const parseSetPromptStatusRequest = createRequestParser(parseSetPromptStatusWireRequest)

export const parseMovePromptFolderRequest = createRequestParser(parseMovePromptFolderWireRequest)

export const parseUpdateSystemSettingsRevisionRequest = createRequestParser(
  parseUpdateSystemSettingsRevisionWireRequest
)

export const parseUpdateUserPersistenceRevisionRequest = createRequestParser(
  parseUpdateUserPersistenceRevisionWireRequest
)

export const parseUpdateWorkspacePersistenceRevisionRequest = createRequestParser(
  parseUpdateWorkspacePersistenceRevisionWireRequest
)

export const parseUpdatePromptUiStateRevisionRequest = createRequestParser(
  parseUpdatePromptUiStateRevisionWireRequest
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
