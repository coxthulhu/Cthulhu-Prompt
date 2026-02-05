export interface TanstackSystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
}

export const MIN_PROMPT_FONT_SIZE = 10
export const MAX_PROMPT_FONT_SIZE = 32
export const MIN_PROMPT_EDITOR_MIN_LINES = 2
export const MAX_PROMPT_EDITOR_MIN_LINES = 20
export const DEFAULT_SYSTEM_SETTINGS: TanstackSystemSettings = Object.freeze({
  promptFontSize: 16,
  promptEditorMinLines: 3
})

export type TanstackSystemSettingsRecord = TanstackSystemSettings & {
  id: string
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
