import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'
import type {
  TanstackMutationRequest,
  TanstackMutationResultWithRequestId,
  TanstackMutationWireRequest
} from './TanstackSystemSettingsRevision'
import type { TanstackWorkspace } from './TanstackWorkspace'

export type TanstackCreatePromptFolderPayload = {
  workspace: TanstackRevisionPayloadEntity<TanstackWorkspace>
  promptFolderId: string
  displayName: string
}

export type TanstackCreatePromptFolderRequest = TanstackMutationRequest<
  TanstackCreatePromptFolderPayload
>

export type TanstackCreatePromptFolderWireRequest =
  TanstackMutationWireRequest<TanstackCreatePromptFolderRequest>

export type TanstackCreatePromptFolderResponsePayload = {
  workspace: TanstackRevisionEnvelope<TanstackWorkspace>
  promptFolder?: TanstackRevisionEnvelope<TanstackPromptFolder>
}

export type TanstackCreatePromptFolderResult = TanstackMutationResultWithRequestId<
  TanstackCreatePromptFolderResponsePayload
>
