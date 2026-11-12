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
  /** Displayed note viewport height after the prompt claims its share of the shared lines. */
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

/** Keeps a visible note's lines up to its reservation while letting the shared maximum override the prompt minimum. */
export const getPromptSizingWithNote = (
  sizing: PromptEditorSizingConfig,
  reservedLines: number,
  attachment: AttachedNoteLayout | undefined
): PromptEditorSizingConfig => {
  /** Hidden attachments return every line to the prompt, and note lines beyond the reservation never limit it. */
  const maxLines = sizing.maxLines - (attachment?.visible
    ? Math.min(Math.ceil(attachment.editorHeightPx / getLineHeightPx(sizing.fontSize)), reservedLines)
    : 0)
  return { ...sizing, minLines: Math.min(sizing.minLines, maxLines), maxLines }
}

/** Lets a note fill the shared lines the prompt's displayed height leaves unused, never capping below its reservation. */
export const getNoteSizingWithPrompt = (
  sizing: PromptEditorSizingConfig,
  reservedLines: number,
  promptHeightPx: number
): PromptEditorSizingConfig => ({
  fontSize: sizing.fontSize,
  minLines: 1,
  maxLines: Math.max(reservedLines, sizing.maxLines - Math.ceil(promptHeightPx / getLineHeightPx(sizing.fontSize)))
})
