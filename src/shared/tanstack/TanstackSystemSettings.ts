export interface TanstackSystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
}

export type TanstackSystemSettingsSnapshot = {
  settings: TanstackSystemSettings
  revision: number
}

export const TANSTACK_SYSTEM_SETTINGS_ID = 'system-settings'

export const MIN_PROMPT_FONT_SIZE = 10
export const MAX_PROMPT_FONT_SIZE = 32
export const MIN_PROMPT_EDITOR_MIN_LINES = 2
export const MAX_PROMPT_EDITOR_MIN_LINES = 20
export const DEFAULT_SYSTEM_SETTINGS: TanstackSystemSettings = Object.freeze({
  promptFontSize: 16,
  promptEditorMinLines: 3
})

export const clampPromptFontSize = (value: number): number => {
  return Math.min(MAX_PROMPT_FONT_SIZE, Math.max(MIN_PROMPT_FONT_SIZE, value))
}

const resolvePromptFontSize = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptFontSize(Math.round(value))
}

export const clampPromptEditorMinLines = (value: number): number => {
  return Math.min(MAX_PROMPT_EDITOR_MIN_LINES, Math.max(MIN_PROMPT_EDITOR_MIN_LINES, value))
}

const resolvePromptEditorMinLines = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptEditorMinLines(Math.round(value))
}

export const normalizeTanstackSystemSettings = (
  payload: Record<string, unknown>
): TanstackSystemSettings => {
  return {
    promptFontSize: resolvePromptFontSize(
      payload.promptFontSize,
      DEFAULT_SYSTEM_SETTINGS.promptFontSize
    ),
    promptEditorMinLines: resolvePromptEditorMinLines(
      payload.promptEditorMinLines,
      DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
    )
  }
}

export type TanstackLoadSystemSettingsSuccess = {
  settings: TanstackSystemSettings
}

export type TanstackLoadSystemSettingsResult =
  | ({ success: true } & TanstackLoadSystemSettingsSuccess)
  | { success: false; error: string }

export type TanstackUpdateSystemSettingsRequest = {
  settings: TanstackSystemSettings
}

export type TanstackUpdateSystemSettingsSuccess = {
  settings: TanstackSystemSettings
}

export type TanstackUpdateSystemSettingsResult =
  | ({ success: true } & TanstackUpdateSystemSettingsSuccess)
  | { success: false; error: string }
