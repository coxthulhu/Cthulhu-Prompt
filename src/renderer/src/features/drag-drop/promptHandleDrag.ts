export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'

export type PromptHandleDragPayload = {
  fromId: string
}

export type PromptHandleDropPayload =
  | {
      kind: 'folder'
      folderId: string
    }
  | {
      kind: 'folder-settings'
      folderId: string
    }
  | {
      kind: 'prompt'
      folderId: string
      promptId: string
    }
