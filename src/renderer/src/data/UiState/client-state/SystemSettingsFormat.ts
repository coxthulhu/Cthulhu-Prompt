import {
  ATTACHED_NOTE_LINE_RESERVE,
  MIN_ATTACHED_NOTE_MAX_LINES,
  MAX_ATTACHED_NOTE_MAX_LINES,
  MAX_PROMPT_EDITOR_MAX_LINES,
  MAX_PROMPT_EDITOR_MIN_LINES,
  MAX_PROMPT_FONT_SIZE,
  MIN_PROMPT_EDITOR_MAX_LINES,
  MIN_PROMPT_EDITOR_MIN_LINES,
  MIN_PROMPT_FONT_SIZE,
  type SystemSettings,
  type NewPromptFocus
} from '@shared/domain/settings/SystemSettings'

export type SystemSettingsFormData = {
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
  promptEditorMaxLinesInput: string
  /** Editable note viewport limit. */
  attachedNoteMaxLinesInput: string
  showLineNumbers: boolean
  /** Selected creation focus in the settings form. */
  newPromptFocus: NewPromptFocus
  /** Current automatic-update selection in the settings form. */
  automaticUpdates: boolean
}

export type SystemSettingsValidation = {
  fontSizeError: string | null
  minLinesError: string | null
  maxLinesError: string | null
  /** Range or shared-budget error for the note maximum. */
  noteMaxLinesError: string | null
}

const formatNumericInput = (value: number): string => {
  return String(value)
}

const normalizeNumericInput = (value: string): { parsed: number; rounded: number } => {
  const parsed = Number(value)
  return {
    parsed,
    rounded: Math.round(parsed)
  }
}

export const formatPromptFontSizeInput = (value: number): string => {
  return formatNumericInput(value)
}

export const formatPromptEditorMinLinesInput = (value: number): string => {
  return formatNumericInput(value)
}

export const formatPromptEditorMaxLinesInput = (value: number): string => {
  return formatNumericInput(value)
}

export const normalizePromptFontSizeInput = (
  value: string
): { parsed: number; rounded: number } => {
  return normalizeNumericInput(value)
}

export const normalizePromptEditorMinLinesInput = (
  value: string
): { parsed: number; rounded: number } => {
  return normalizeNumericInput(value)
}

export const normalizePromptEditorMaxLinesInput = (
  value: string
): { parsed: number; rounded: number } => {
  return normalizeNumericInput(value)
}

export const toSystemSettingsFormData = (
  settings: SystemSettings
): SystemSettingsFormData => ({
  promptFontSizeInput: formatPromptFontSizeInput(settings.promptFontSize),
  promptEditorMinLinesInput: formatPromptEditorMinLinesInput(settings.promptEditorMinLines),
  promptEditorMaxLinesInput: formatPromptEditorMaxLinesInput(settings.promptEditorMaxLines),
  attachedNoteMaxLinesInput: String(settings.attachedNoteMaxLines),
  showLineNumbers: settings.showLineNumbers,
  newPromptFocus: settings.newPromptFocus,
  automaticUpdates: settings.automaticUpdates
})

const validateFontSize = (value: string): string | null => {
  if (!value.trim()) {
    return 'Enter a font size.'
  }

  const { parsed } = normalizePromptFontSizeInput(value)

  if (!Number.isFinite(parsed)) {
    return 'Font size must be a number.'
  }

  if (parsed < MIN_PROMPT_FONT_SIZE || parsed > MAX_PROMPT_FONT_SIZE) {
    return `Use a value between ${MIN_PROMPT_FONT_SIZE} and ${MAX_PROMPT_FONT_SIZE}.`
  }

  return null
}

const validateMinLines = (value: string): string | null => {
  if (!value.trim()) {
    return 'Enter a minimum line count.'
  }

  const { parsed } = normalizePromptEditorMinLinesInput(value)

  if (!Number.isFinite(parsed)) {
    return 'Minimum line count must be a number.'
  }

  if (parsed < MIN_PROMPT_EDITOR_MIN_LINES || parsed > MAX_PROMPT_EDITOR_MIN_LINES) {
    return `Use a value between ${MIN_PROMPT_EDITOR_MIN_LINES} and ${MAX_PROMPT_EDITOR_MIN_LINES}.`
  }

  return null
}

const validateMaxLines = (value: string): string | null => {
  if (!value.trim()) {
    return 'Enter a maximum line count.'
  }

  const { parsed } = normalizePromptEditorMaxLinesInput(value)

  if (!Number.isFinite(parsed)) {
    return 'Maximum line count must be a number.'
  }

  if (parsed < MIN_PROMPT_EDITOR_MAX_LINES || parsed > MAX_PROMPT_EDITOR_MAX_LINES) {
    return `Use a value between ${MIN_PROMPT_EDITOR_MAX_LINES} and ${MAX_PROMPT_EDITOR_MAX_LINES}.`
  }

  return null
}

// Keep these messages stable because the settings screen renders them directly.
export const getSystemSettingsValidation = (
  formData: SystemSettingsFormData
): SystemSettingsValidation => {
  /** Validate both fields before comparing their rounded persisted values. */
  let maxLinesError = validateMaxLines(formData.promptEditorMaxLinesInput)
  /** Note limit shares the numeric settings convention and reports its own range. */
  let noteMaxLinesError = !formData.attachedNoteMaxLinesInput.trim()
    ? 'Enter a note maximum line count.'
    : !Number.isFinite(Number(formData.attachedNoteMaxLinesInput))
      ? 'Note maximum line count must be a number.'
      : Number(formData.attachedNoteMaxLinesInput) < MIN_ATTACHED_NOTE_MAX_LINES ||
          Number(formData.attachedNoteMaxLinesInput) > MAX_ATTACHED_NOTE_MAX_LINES
        ? `Use a value between ${MIN_ATTACHED_NOTE_MAX_LINES} and ${MAX_ATTACHED_NOTE_MAX_LINES}.`
        : null
  if (!maxLinesError && !noteMaxLinesError &&
    Math.round(Number(formData.promptEditorMaxLinesInput)) < Math.round(Number(formData.attachedNoteMaxLinesInput)) + ATTACHED_NOTE_LINE_RESERVE) {
    maxLinesError = 'Use at least 5 more lines than the attached note maximum.'
    noteMaxLinesError = 'Use at least 5 fewer lines than the shared editor maximum.'
  }
  return {
    fontSizeError: validateFontSize(formData.promptFontSizeInput),
    minLinesError: validateMinLines(formData.promptEditorMinLinesInput),
    maxLinesError,
    noteMaxLinesError
  }
}
