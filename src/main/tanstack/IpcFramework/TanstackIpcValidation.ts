import type {
  TanstackCreatePromptPayload,
  TanstackCreatePromptWireRequest
} from '@shared/tanstack/TanstackPromptCreate'
import type {
  TanstackDeletePromptPayload,
  TanstackDeletePromptWireRequest
} from '@shared/tanstack/TanstackPromptDelete'
import type {
  TanstackPromptRevisionPayload,
  TanstackUpdatePromptRevisionRequest
} from '@shared/tanstack/TanstackPromptRevision'
import type {
  TanstackCreatePromptFolderPayload,
  TanstackCreatePromptFolderWireRequest
} from '@shared/tanstack/TanstackPromptFolderCreate'
import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import type { TanstackRevisionPayloadEntity } from '@shared/tanstack/TanstackRevision'
import type { TanstackSystemSettings } from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackSystemSettingsRevisionPayload,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackMutationWireRequest
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import type { TanstackLoadPromptFolderInitialWireRequest } from '@shared/tanstack/TanstackPromptFolderLoad'
import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'
import type { TanstackCloseWorkspaceWireRequest } from '@shared/tanstack/TanstackWorkspaceClose'
import type {
  TanstackCreateWorkspacePayload,
  TanstackCreateWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceCreate'
import type { TanstackLoadWorkspaceByPathWireRequest } from '@shared/tanstack/TanstackWorkspaceLoad'

type TanstackParser<T> = (value: unknown) => T | null

export type TanstackParsedRequest<TRequest> =
  | { success: true; value: TRequest }
  | { success: false; requestId: string }

type TanstackWireRequestWithPayload<TPayload> = {
  requestId: string
  payload: TPayload
}

type TanstackWireRequestWithoutPayload = {
  requestId: string
}

const parseString: TanstackParser<string> = (value) => {
  return typeof value === 'string' ? value : null
}

const parseBoolean: TanstackParser<boolean> = (value) => {
  return typeof value === 'boolean' ? value : null
}

const parseNumber: TanstackParser<number> = (value) => {
  return typeof value === 'number' ? value : null
}

const parseArray = <TItem>(itemParser: TanstackParser<TItem>): TanstackParser<TItem[]> => {
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
  shape: { [TKey in keyof TValue]: TanstackParser<TValue[TKey]> }
): TanstackParser<TValue> => {
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
  dataParser: TanstackParser<TData>
): TanstackParser<TanstackRevisionPayloadEntity<TData>> => {
  return parseObject({
    id: parseString,
    expectedRevision: parseNumber,
    data: dataParser
  })
}

const parseWireRequestWithPayload = <TPayload>(
  payloadParser: TanstackParser<TPayload>
): TanstackParser<TanstackWireRequestWithPayload<TPayload>> => {
  return parseObject({
    requestId: parseString,
    payload: payloadParser
  })
}

const parseWireRequestWithoutPayload = (): TanstackParser<TanstackWireRequestWithoutPayload> => {
  return parseObject({
    requestId: parseString
  })
}

const extractRequestId = (request: unknown): string => {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return ''
  }

  const requestId = (request as Record<string, unknown>).requestId
  return typeof requestId === 'string' ? requestId : ''
}

const toParsedRequest = <TRequest>(
  value: TRequest | null,
  requestId: string
): TanstackParsedRequest<TRequest> => {
  if (value === null) {
    return { success: false, requestId }
  }

  return { success: true, value }
}

const createRequestParser = <TRequest>(requestParser: TanstackParser<TRequest>) => {
  return (request: unknown): TanstackParsedRequest<TRequest> => {
    return toParsedRequest(requestParser(request), extractRequestId(request))
  }
}

const parseTanstackWorkspace = parseObject<TanstackWorkspace>({
  id: parseString,
  workspacePath: parseString,
  promptFolderIds: parseArray(parseString)
})

const parseTanstackWorkspaceRevisionPayloadEntity =
  parseRevisionPayloadEntity<TanstackWorkspace>(parseTanstackWorkspace)

const parseTanstackPromptFolder = parseObject<TanstackPromptFolder>({
  id: parseString,
  folderName: parseString,
  displayName: parseString,
  promptCount: parseNumber,
  promptIds: parseArray(parseString),
  folderDescription: parseString
})

const parseTanstackPromptFolderRevisionPayloadEntity =
  parseRevisionPayloadEntity<TanstackPromptFolder>(parseTanstackPromptFolder)

const parseTanstackSystemSettings = parseObject<TanstackSystemSettings>({
  promptFontSize: parseNumber,
  promptEditorMinLines: parseNumber
})

const parseTanstackSystemSettingsRevisionPayloadEntity =
  parseRevisionPayloadEntity<TanstackSystemSettings>(parseTanstackSystemSettings)

const parseTanstackPrompt = parseObject<TanstackPrompt>({
  id: parseString,
  title: parseString,
  creationDate: parseString,
  lastModifiedDate: parseString,
  promptText: parseString,
  promptFolderCount: parseNumber
})

const parseTanstackPromptRevisionPayloadEntity =
  parseRevisionPayloadEntity<TanstackPrompt>(parseTanstackPrompt)

const parseTanstackCreateWorkspacePayload = parseObject<TanstackCreateWorkspacePayload>({
  workspacePath: parseString,
  includeExamplePrompts: parseBoolean
})

const parseTanstackCreateWorkspaceWireRequest: TanstackParser<TanstackCreateWorkspaceWireRequest> =
  parseWireRequestWithPayload<TanstackCreateWorkspacePayload>(parseTanstackCreateWorkspacePayload)

const parseTanstackCloseWorkspaceWireRequest: TanstackParser<TanstackCloseWorkspaceWireRequest> =
  parseWireRequestWithoutPayload()

const parseTanstackCreatePromptFolderPayload = parseObject<TanstackCreatePromptFolderPayload>({
  workspace: parseTanstackWorkspaceRevisionPayloadEntity,
  promptFolderId: parseString,
  displayName: parseString
})

const parseTanstackCreatePromptFolderWireRequest: TanstackParser<TanstackCreatePromptFolderWireRequest> =
  parseWireRequestWithPayload<TanstackCreatePromptFolderPayload>(
    parseTanstackCreatePromptFolderPayload
  )

const parseTanstackCreatePromptPayload: TanstackParser<TanstackCreatePromptPayload> = (value) => {
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

  const promptFolder = parseTanstackPromptFolderRevisionPayloadEntity(record.promptFolder)
  const prompt = parseTanstackPromptRevisionPayloadEntity(record.prompt)

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

const parseTanstackCreatePromptWireRequest: TanstackParser<TanstackCreatePromptWireRequest> =
  parseWireRequestWithPayload<TanstackCreatePromptPayload>(parseTanstackCreatePromptPayload)

const parseTanstackPromptRevisionPayload = parseObject<TanstackPromptRevisionPayload>({
  prompt: parseTanstackPromptRevisionPayloadEntity
})

const parseTanstackUpdatePromptRevisionWireRequest: TanstackParser<
  TanstackMutationWireRequest<TanstackUpdatePromptRevisionRequest>
> = parseWireRequestWithPayload<TanstackPromptRevisionPayload>(parseTanstackPromptRevisionPayload)

const parseTanstackDeletePromptPayload = parseObject<TanstackDeletePromptPayload>({
  promptFolder: parseTanstackPromptFolderRevisionPayloadEntity,
  prompt: parseTanstackPromptRevisionPayloadEntity
})

const parseTanstackDeletePromptWireRequest: TanstackParser<TanstackDeletePromptWireRequest> =
  parseWireRequestWithPayload<TanstackDeletePromptPayload>(parseTanstackDeletePromptPayload)

const parseTanstackSystemSettingsRevisionPayload =
  parseObject<TanstackSystemSettingsRevisionPayload>({
    systemSettings: parseTanstackSystemSettingsRevisionPayloadEntity
  })

const parseTanstackUpdateSystemSettingsRevisionWireRequest: TanstackParser<
  TanstackMutationWireRequest<TanstackUpdateSystemSettingsRevisionRequest>
> = parseWireRequestWithPayload<TanstackSystemSettingsRevisionPayload>(
  parseTanstackSystemSettingsRevisionPayload
)

const parseTanstackLoadWorkspaceByPathPayload =
  parseObject<TanstackLoadWorkspaceByPathWireRequest['payload']>({
    workspacePath: parseString
  })

const parseTanstackLoadWorkspaceByPathWireRequest: TanstackParser<TanstackLoadWorkspaceByPathWireRequest> =
  parseWireRequestWithPayload<TanstackLoadWorkspaceByPathWireRequest['payload']>(
    parseTanstackLoadWorkspaceByPathPayload
  )

const parseTanstackLoadPromptFolderInitialPayload =
  parseObject<TanstackLoadPromptFolderInitialWireRequest['payload']>({
    workspaceId: parseString,
    promptFolderId: parseString
  })

const parseTanstackLoadPromptFolderInitialWireRequest: TanstackParser<
  TanstackLoadPromptFolderInitialWireRequest
> = parseWireRequestWithPayload<TanstackLoadPromptFolderInitialWireRequest['payload']>(
  parseTanstackLoadPromptFolderInitialPayload
)

export const parseTanstackCreateWorkspaceRequest = createRequestParser(
  parseTanstackCreateWorkspaceWireRequest
)

export const parseTanstackCloseWorkspaceRequest = createRequestParser(
  parseTanstackCloseWorkspaceWireRequest
)

export const parseTanstackCreatePromptFolderRequest = createRequestParser(
  parseTanstackCreatePromptFolderWireRequest
)

export const parseTanstackCreatePromptRequest = createRequestParser(
  parseTanstackCreatePromptWireRequest
)

export const parseTanstackUpdatePromptRevisionRequest = createRequestParser(
  parseTanstackUpdatePromptRevisionWireRequest
)

export const parseTanstackDeletePromptRequest = createRequestParser(
  parseTanstackDeletePromptWireRequest
)

export const parseTanstackUpdateSystemSettingsRevisionRequest = createRequestParser(
  parseTanstackUpdateSystemSettingsRevisionWireRequest
)

export const parseTanstackLoadWorkspaceByPathRequest = createRequestParser(
  parseTanstackLoadWorkspaceByPathWireRequest
)

export const parseTanstackLoadPromptFolderInitialRequest = createRequestParser(
  parseTanstackLoadPromptFolderInitialWireRequest
)
