import {
  MAX_PROMPT_EDITOR_MIN_LINES,
  MAX_PROMPT_FONT_SIZE,
  MIN_PROMPT_EDITOR_MIN_LINES,
  MIN_PROMPT_FONT_SIZE,
  type SystemSettings
} from '@shared/SystemSettings'

export type SystemSettingsDraftSnapshot = {
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
}

export type SystemSettingsValidation = {
  fontSizeError: string | null
  minLinesError: string | null
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

export const toSystemSettingsDraftSnapshot = (
  settings: SystemSettings
): SystemSettingsDraftSnapshot => ({
  promptFontSizeInput: formatPromptFontSizeInput(settings.promptFontSize),
  promptEditorMinLinesInput: formatPromptEditorMinLinesInput(settings.promptEditorMinLines)
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

// Keep these messages stable because the settings screen renders them directly.
export const getSystemSettingsValidation = (
  draftValues: SystemSettingsDraftSnapshot
): SystemSettingsValidation => {
  return {
    fontSizeError: validateFontSize(draftValues.promptFontSizeInput),
    minLinesError: validateMinLines(draftValues.promptEditorMinLinesInput)
  }
}

export const haveSameSystemSettings = (left: SystemSettings, right: SystemSettings): boolean => {
  return (
    left.promptFontSize === right.promptFontSize &&
    left.promptEditorMinLines === right.promptEditorMinLines
  )
}
