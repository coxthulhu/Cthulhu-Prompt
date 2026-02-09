import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'
import type {
  TanstackMutationRequest,
  TanstackMutationResultWithRequestId
} from './TanstackSystemSettingsRevision'

export type TanstackPromptFolderRevisionPayload = {
  promptFolder: TanstackRevisionPayloadEntity<TanstackPromptFolder>
}

export type TanstackUpdatePromptFolderRevisionRequest =
  TanstackMutationRequest<TanstackPromptFolderRevisionPayload>

export type TanstackPromptFolderRevisionData = TanstackRevisionEnvelope<TanstackPromptFolder>

export type TanstackPromptFolderRevisionResponsePayload = {
  promptFolder: TanstackPromptFolderRevisionData
}

export type TanstackUpdatePromptFolderRevisionResult =
  TanstackMutationResultWithRequestId<TanstackPromptFolderRevisionResponsePayload>
