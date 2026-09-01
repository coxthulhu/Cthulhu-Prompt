import type { LoadPromptFolderInitialPayload } from '@shared/PromptFolder'
import type { IpcRequestContext, IpcRequestWithPayload } from '@shared/IpcRequest'
import type { LoadWorkspaceUiStateRequest } from '@shared/UiState'
import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload,
  LoadWorkspaceByPathRequest
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
        return null
      }

      parsedObject[key] = parsedField
    }

    return parsedObject
  }
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

const parseLoadWorkspaceByPathPayload = parseObject<LoadWorkspaceByPathRequest>({
  workspaceInfoPath: parseString
})

const parseLoadWorkspaceByPathWireRequest: Parser<
  IpcRequestWithPayload<LoadWorkspaceByPathRequest>
> = parseWireRequestWithPayload<LoadWorkspaceByPathRequest>(parseLoadWorkspaceByPathPayload)

const parseLoadWorkspaceUiStatePayload = parseObject<LoadWorkspaceUiStateRequest>({
  workspaceId: parseString
})

const parseLoadWorkspaceUiStateWireRequest: Parser<
  IpcRequestWithPayload<LoadWorkspaceUiStateRequest>
> = parseWireRequestWithPayload<LoadWorkspaceUiStateRequest>(
  parseLoadWorkspaceUiStatePayload
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

export const parseLoadWorkspaceByPathRequest = createRequestParser(
  parseLoadWorkspaceByPathWireRequest
)

export const parseLoadWorkspaceUiStateRequest = createRequestParser(
  parseLoadWorkspaceUiStateWireRequest
)

export const parseLoadPromptFolderInitialRequest = createRequestParser(
  parseLoadPromptFolderInitialWireRequest
)
