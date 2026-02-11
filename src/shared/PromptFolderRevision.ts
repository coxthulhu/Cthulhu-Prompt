import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  MutationRequest,
  MutationResultWithRequestId
} from './SystemSettingsRevision'

export type PromptFolderRevisionPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
}

export type UpdatePromptFolderRevisionRequest =
  MutationRequest<PromptFolderRevisionPayload>

export type PromptFolderRevisionResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type UpdatePromptFolderRevisionResult =
  MutationResultWithRequestId<PromptFolderRevisionResponsePayload>
