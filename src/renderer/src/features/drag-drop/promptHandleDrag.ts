export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'

export type PromptHandleDragPayload = {
  fromId: string
}

export type PromptHandleDropPayload = {
  toId: string
}

export const promptFolderSettingsDropId = (folderId: string): string =>
  `folder-settings:${folderId}`
