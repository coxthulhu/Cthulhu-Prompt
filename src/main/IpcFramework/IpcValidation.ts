import type {
  CreatePromptPayload,
  CreatePromptWireRequest,
  DeletePromptPayload,
  DeletePromptWireRequest,
  Prompt,
  PromptRevisionPayload,
  UpdatePromptRevisionRequest
} from '@shared/Prompt'
import type {
  CreatePromptFolderPayload,
  CreatePromptFolderWireRequest,
  LoadPromptFolderInitialWireRequest,
  PromptFolder,
  PromptFolderRevisionPayload,
  UpdatePromptFolderRevisionRequest
} from '@shared/PromptFolder'
import type {
  IpcRequestContext,
  IpcRequestWithPayload
} from '@shared/IpcRequest'
import type { RevisionPayloadEntity } from '@shared/Revision'
import type {
  SystemSettings,
  SystemSettingsRevisionPayload,
  UpdateSystemSettingsRevisionRequest
} from '@shared/SystemSettings'
import type {
  CloseWorkspaceWireRequest,
  CreateWorkspacePayload,
  CreateWorkspaceWireRequest,
  LoadWorkspaceByPathWireRequest,
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

const parseObject = <TValue extends object>(
  shape: { [TKey in keyof TValue]: Parser<TValue[TKey]> }
): Parser<TValue> => {
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

const parseWireRequestWithoutPayload = (): Parser<IpcRequestContext> => {
  return parseObject({
    requestId: parseString,
    clientId: parseClientId
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
  promptFolderIds: parseArray(parseString)
})

const parseWorkspaceRevisionPayloadEntity =
  parseRevisionPayloadEntity<Workspace>(parseWorkspace)

const parsePromptFolder = parseObject<PromptFolder>({
  id: parseString,
  folderName: parseString,
  displayName: parseString,
  promptCount: parseNumber,
  promptIds: parseArray(parseString),
  folderDescription: parseString
})

const parsePromptFolderRevisionPayloadEntity =
  parseRevisionPayloadEntity<PromptFolder>(parsePromptFolder)

const parseSystemSettings = parseObject<SystemSettings>({
  promptFontSize: parseNumber,
  promptEditorMinLines: parseNumber
})

const parseSystemSettingsRevisionPayloadEntity =
  parseRevisionPayloadEntity<SystemSettings>(parseSystemSettings)

const parsePrompt = parseObject<Prompt>({
  id: parseString,
  title: parseString,
  creationDate: parseString,
  lastModifiedDate: parseString,
  promptText: parseString,
  promptFolderCount: parseNumber
})

const parsePromptRevisionPayloadEntity =
  parseRevisionPayloadEntity<Prompt>(parsePrompt)

const parseCreateWorkspacePayload = parseObject<CreateWorkspacePayload>({
  workspacePath: parseString,
  includeExamplePrompts: parseBoolean
})

const parseCreateWorkspaceWireRequest: Parser<CreateWorkspaceWireRequest> =
  parseWireRequestWithPayload<CreateWorkspacePayload>(parseCreateWorkspacePayload)

const parseCloseWorkspaceWireRequest: Parser<CloseWorkspaceWireRequest> =
  parseWireRequestWithoutPayload()

const parseCreatePromptFolderPayload = parseObject<CreatePromptFolderPayload>({
  workspace: parseWorkspaceRevisionPayloadEntity,
  promptFolderId: parseString,
  displayName: parseString
})

const parseCreatePromptFolderWireRequest: Parser<CreatePromptFolderWireRequest> =
  parseWireRequestWithPayload<CreatePromptFolderPayload>(
    parseCreatePromptFolderPayload
  )

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
    !('previousPromptId' in record)
  ) {
    return null
  }

  const promptFolder = parsePromptFolderRevisionPayloadEntity(record.promptFolder)
  const prompt = parsePromptRevisionPayloadEntity(record.prompt)

  if (promptFolder === null || prompt === null) {
    return null
  }

  const previousPromptId = record.previousPromptId

  if (previousPromptId !== null && typeof previousPromptId !== 'string') {
    return null
  }

  return {
    promptFolder,
    prompt,
    previousPromptId
  }
}

const parseCreatePromptWireRequest: Parser<CreatePromptWireRequest> =
  parseWireRequestWithPayload<CreatePromptPayload>(parseCreatePromptPayload)

const parsePromptRevisionPayload = parseObject<PromptRevisionPayload>({
  prompt: parsePromptRevisionPayloadEntity
})

const parseUpdatePromptRevisionWireRequest: Parser<
  IpcRequestWithPayload<UpdatePromptRevisionRequest['payload']>
> = parseWireRequestWithPayload<PromptRevisionPayload>(parsePromptRevisionPayload)

const parsePromptFolderRevisionPayload =
  parseObject<PromptFolderRevisionPayload>({
    promptFolder: parsePromptFolderRevisionPayloadEntity
  })

const parseUpdatePromptFolderRevisionWireRequest: Parser<
  IpcRequestWithPayload<UpdatePromptFolderRevisionRequest['payload']>
> = parseWireRequestWithPayload<PromptFolderRevisionPayload>(
  parsePromptFolderRevisionPayload
)

const parseDeletePromptPayload = parseObject<DeletePromptPayload>({
  promptFolder: parsePromptFolderRevisionPayloadEntity,
  prompt: parsePromptRevisionPayloadEntity
})

const parseDeletePromptWireRequest: Parser<DeletePromptWireRequest> =
  parseWireRequestWithPayload<DeletePromptPayload>(parseDeletePromptPayload)

const parseSystemSettingsRevisionPayload =
  parseObject<SystemSettingsRevisionPayload>({
    systemSettings: parseSystemSettingsRevisionPayloadEntity
  })

const parseUpdateSystemSettingsRevisionWireRequest: Parser<
  IpcRequestWithPayload<UpdateSystemSettingsRevisionRequest['payload']>
> = parseWireRequestWithPayload<SystemSettingsRevisionPayload>(
  parseSystemSettingsRevisionPayload
)

const parseLoadWorkspaceByPathPayload =
  parseObject<LoadWorkspaceByPathWireRequest['payload']>({
    workspacePath: parseString
  })

const parseLoadWorkspaceByPathWireRequest: Parser<LoadWorkspaceByPathWireRequest> =
  parseWireRequestWithPayload<LoadWorkspaceByPathWireRequest['payload']>(
    parseLoadWorkspaceByPathPayload
  )

const parseLoadPromptFolderInitialPayload =
  parseObject<LoadPromptFolderInitialWireRequest['payload']>({
    workspaceId: parseString,
    promptFolderId: parseString
  })

const parseLoadPromptFolderInitialWireRequest: Parser<
  LoadPromptFolderInitialWireRequest
> = parseWireRequestWithPayload<LoadPromptFolderInitialWireRequest['payload']>(
  parseLoadPromptFolderInitialPayload
)

export const parseCreateWorkspaceRequest = createRequestParser(
  parseCreateWorkspaceWireRequest
)

export const parseCloseWorkspaceRequest = createRequestParser(
  parseCloseWorkspaceWireRequest
)

export const parseCreatePromptFolderRequest = createRequestParser(
  parseCreatePromptFolderWireRequest
)

export const parseCreatePromptRequest = createRequestParser(
  parseCreatePromptWireRequest
)

export const parseUpdatePromptRevisionRequest = createRequestParser(
  parseUpdatePromptRevisionWireRequest
)

export const parseUpdatePromptFolderRevisionRequest = createRequestParser(
  parseUpdatePromptFolderRevisionWireRequest
)

export const parseDeletePromptRequest = createRequestParser(
  parseDeletePromptWireRequest
)

export const parseUpdateSystemSettingsRevisionRequest = createRequestParser(
  parseUpdateSystemSettingsRevisionWireRequest
)

export const parseLoadWorkspaceByPathRequest = createRequestParser(
  parseLoadWorkspaceByPathWireRequest
)

export const parseLoadPromptFolderInitialRequest = createRequestParser(
  parseLoadPromptFolderInitialWireRequest
)
