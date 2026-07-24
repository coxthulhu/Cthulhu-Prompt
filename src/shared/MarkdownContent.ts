import type { PromptFolder, PromptFolderKind } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type MarkdownContentPersisted = {
  id: string
  title: string
  fallbackTitle: string
  createdAt: string
  modifiedAt: string
}

export const MARKDOWN_CONTENT_KINDS = ['prompt', 'template'] as const

export const getActiveMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderKind
): string[] =>
  promptFolder.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))

export const getMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderKind
): string[] => [
  ...getActiveMarkdownContentIds(promptFolder, kind),
  ...(kind === 'prompt' ? promptFolder.completedPromptIds : [])
]

export type MarkdownContentRevisionPayload<TContent extends MarkdownContentPersisted> = {
  content: RevisionPayloadEntity<TContent>
}

export type MarkdownContentRevisionResponsePayload<TContent extends MarkdownContentPersisted> = {
  content: RevisionEnvelope<TContent>
  promptFolder?: RevisionEnvelope<PromptFolder>
}

export type CreateMarkdownContentPayload<TContent extends MarkdownContentPersisted> = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadEntity<TContent>
  previousEntryId: string | null
}

export type CreateMarkdownContentResponsePayload<TContent extends MarkdownContentPersisted> = {
  promptFolder: RevisionEnvelope<PromptFolder>
  content?: RevisionEnvelope<TContent>
}

export type DeleteMarkdownContentPayload<TContent extends MarkdownContentPersisted> = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadEntity<TContent>
}

export type DeleteMarkdownContentResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type MoveMarkdownContentPayload<TContent extends MarkdownContentPersisted> = {
  sourcePromptFolder: RevisionPayloadEntity<PromptFolder>
  destinationPromptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadEntity<TContent>
  previousEntryId: string | null
}

export type MoveMarkdownContentResponsePayload<TContent extends MarkdownContentPersisted> = {
  sourcePromptFolder: RevisionEnvelope<PromptFolder>
  destinationPromptFolder: RevisionEnvelope<PromptFolder>
  content: RevisionEnvelope<TContent>
}
