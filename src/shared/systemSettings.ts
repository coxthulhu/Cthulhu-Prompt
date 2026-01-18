import type { SystemSettings } from './ipc'

export const MIN_PROMPT_FONT_SIZE = 10
export const MAX_PROMPT_FONT_SIZE = 32
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = Object.freeze({
  promptFontSize: 16
})

export const clampPromptFontSize = (value: number): number => {
  return Math.min(MAX_PROMPT_FONT_SIZE, Math.max(MIN_PROMPT_FONT_SIZE, value))
}

export const resolvePromptFontSize = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptFontSize(Math.round(value))
}

export const normalizeSystemSettings = (payload: Record<string, unknown>): SystemSettings => {
  return {
    promptFontSize: resolvePromptFontSize(
      payload.promptFontSize,
      DEFAULT_SYSTEM_SETTINGS.promptFontSize
    )
  }
}
