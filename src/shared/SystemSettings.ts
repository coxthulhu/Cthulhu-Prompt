import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { IpcResult } from './IpcResult'

export interface SystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
  showLineNumbers: boolean
}

export const SYSTEM_SETTINGS_ID = 'system-settings'

export const MIN_PROMPT_FONT_SIZE = 10
export const MAX_PROMPT_FONT_SIZE = 32
export const MIN_PROMPT_EDITOR_MIN_LINES = 2
export const MAX_PROMPT_EDITOR_MIN_LINES = 20
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = Object.freeze({
  promptFontSize: 16,
  promptEditorMinLines: 3,
  showLineNumbers: true
})

const clampPromptFontSize = (value: number): number => {
  return Math.min(MAX_PROMPT_FONT_SIZE, Math.max(MIN_PROMPT_FONT_SIZE, value))
}

const resolvePromptFontSize = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptFontSize(Math.round(value))
}

const clampPromptEditorMinLines = (value: number): number => {
  return Math.min(MAX_PROMPT_EDITOR_MIN_LINES, Math.max(MIN_PROMPT_EDITOR_MIN_LINES, value))
}

const resolvePromptEditorMinLines = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptEditorMinLines(Math.round(value))
}

const resolveShowLineNumbers = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

export const normalizeSystemSettings = (payload: Record<string, unknown>): SystemSettings => {
  return {
    promptFontSize: resolvePromptFontSize(
      payload.promptFontSize,
      DEFAULT_SYSTEM_SETTINGS.promptFontSize
    ),
    promptEditorMinLines: resolvePromptEditorMinLines(
      payload.promptEditorMinLines,
      DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
    ),
    showLineNumbers: resolveShowLineNumbers(
      payload.showLineNumbers,
      DEFAULT_SYSTEM_SETTINGS.showLineNumbers
    )
  }
}

export type LoadSystemSettingsResult = IpcResult<{
  systemSettings: RevisionEnvelope<SystemSettings>
}>

export type SystemSettingsRevisionPayload = {
  systemSettings: RevisionPayloadEntity<SystemSettings>
}

export type SystemSettingsRevisionResponsePayload = {
  systemSettings: RevisionEnvelope<SystemSettings>
}
