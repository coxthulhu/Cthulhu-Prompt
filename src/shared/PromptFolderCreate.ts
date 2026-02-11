import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  MutationRequest,
  MutationResultWithRequestId,
  MutationWireRequest
} from './SystemSettingsRevision'
import type { Workspace } from './Workspace'

export type CreatePromptFolderPayload = {
  workspace: RevisionPayloadEntity<Workspace>
  promptFolderId: string
  displayName: string
}

export type CreatePromptFolderRequest = MutationRequest<
  CreatePromptFolderPayload
>

export type CreatePromptFolderWireRequest =
  MutationWireRequest<CreatePromptFolderRequest>

export type CreatePromptFolderResponsePayload = {
  workspace: RevisionEnvelope<Workspace>
  promptFolder?: RevisionEnvelope<PromptFolder>
}

export type CreatePromptFolderResult = MutationResultWithRequestId<
  CreatePromptFolderResponsePayload
>
