import type { AttachedNote } from '@shared/domain/note/Note'
import {
  getLineHeightPx,
  PROMPT_EDITOR_BODY_PADDING_TOP_PX,
  PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
  type PromptEditorSizingConfig
} from './promptEditorSizing'

/** Header height shared by rendered notes and virtual-row estimates. */
export const ATTACHED_NOTE_HEADER_HEIGHT_PX = 36

/** Reactive attachment presentation supplied by the virtual list. */
export type AttachedNoteLayout = {
  /** Authoritative note text and timestamp. */
  note: AttachedNote
  /** Persisted user preference. */
  visible: boolean
  /** Independent renderer-session edit indicator. */
  isEdited: boolean
  /** Measured or estimated wrapped editor viewport height. */
  editorHeightPx: number
}

/** Includes note chrome only when an attachment exists. */
export const getAttachedNoteSectionHeight = (attachment: AttachedNoteLayout | undefined): number =>
  attachment
    ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX + ATTACHED_NOTE_HEADER_HEIGHT_PX +
      (attachment.visible
        ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX + PROMPT_EDITOR_BODY_PADDING_TOP_PX +
          attachment.editorHeightPx + PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX
        : 0)
    : 0

/** Reserves visible note lines while letting the shared maximum override the prompt minimum. */
export const getPromptSizingWithNote = (
  sizing: PromptEditorSizingConfig,
  attachment: AttachedNoteLayout | undefined
): PromptEditorSizingConfig => {
  /** Hidden attachments return their entire line allocation to the prompt. */
  const maxLines = sizing.maxLines - (attachment?.visible
    ? Math.ceil(attachment.editorHeightPx / getLineHeightPx(sizing.fontSize))
    : 0)
  return { ...sizing, minLines: Math.min(sizing.minLines, maxLines), maxLines }
}
