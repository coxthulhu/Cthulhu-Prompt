import type { AuthoritativeSnapshotQueryResult } from '@shared/ipc/AuthoritativeSnapshot'

/** Field focused after creating a prompt or prompt template. */
export type NewPromptFocus = 'title' | 'editor'

/** Release type the auto-updater follows. */
export type UpdateChannel = 'stable' | 'prerelease'

export interface SystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
  promptEditorMaxLines: number
  /** Note lines kept from the shared editor maximum before the prompt may use them. */
  attachedNoteReservedLines: number
  showLineNumbers: boolean
  /** Preferred initial focus for newly created prompts and templates. */
  newPromptFocus: NewPromptFocus
  /** Allows startup and periodic update checks with automatic downloads. */
  automaticUpdates: boolean
  /** Whether update checks also consider prereleases. */
  updateChannel: UpdateChannel
}

export const SYSTEM_SETTINGS_ID = 'system-settings'
/** IPC channel used to load the authoritative system-settings singleton. */
export const LOAD_SYSTEM_SETTINGS_CHANNEL = 'load-system-settings'

export const MIN_PROMPT_FONT_SIZE = 10
export const MAX_PROMPT_FONT_SIZE = 32
export const MIN_PROMPT_EDITOR_MIN_LINES = 2
export const MAX_PROMPT_EDITOR_MIN_LINES = 10
export const MIN_PROMPT_EDITOR_MAX_LINES = 10
export const MAX_PROMPT_EDITOR_MAX_LINES = 40
/** Inclusive limits for the attached note's reserved lines. */
export const MIN_ATTACHED_NOTE_RESERVED_LINES = 1
/** Largest configurable attached-note reservation. */
export const MAX_ATTACHED_NOTE_RESERVED_LINES = 20
/** Minimum main-editor capacity remaining beyond the note's reserved lines. */
export const ATTACHED_NOTE_LINE_RESERVE = 5
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = Object.freeze({
  promptFontSize: 16,
  promptEditorMinLines: 2,
  promptEditorMaxLines: 35,
  attachedNoteReservedLines: 10,
  showLineNumbers: true,
  newPromptFocus: 'editor',
  /** Automatic update discovery is enabled for new and existing installations. */
  automaticUpdates: true,
  updateChannel: 'stable'
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

const clampPromptEditorMaxLines = (value: number): number => {
  return Math.min(MAX_PROMPT_EDITOR_MAX_LINES, Math.max(MIN_PROMPT_EDITOR_MAX_LINES, value))
}

const resolvePromptEditorMaxLines = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptEditorMaxLines(Math.round(value))
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
    promptEditorMaxLines: resolvePromptEditorMaxLines(
      payload.promptEditorMaxLines,
      DEFAULT_SYSTEM_SETTINGS.promptEditorMaxLines
    ),
    attachedNoteReservedLines:
      typeof payload.attachedNoteReservedLines === 'number' && Number.isFinite(payload.attachedNoteReservedLines)
        ? Math.min(MAX_ATTACHED_NOTE_RESERVED_LINES, Math.max(MIN_ATTACHED_NOTE_RESERVED_LINES, Math.round(payload.attachedNoteReservedLines)))
        : DEFAULT_SYSTEM_SETTINGS.attachedNoteReservedLines,
    showLineNumbers: resolveShowLineNumbers(
      payload.showLineNumbers,
      DEFAULT_SYSTEM_SETTINGS.showLineNumbers
    ),
    newPromptFocus:
      payload.newPromptFocus === 'title' || payload.newPromptFocus === 'editor'
        ? payload.newPromptFocus
        : DEFAULT_SYSTEM_SETTINGS.newPromptFocus,
    automaticUpdates:
      typeof payload.automaticUpdates === 'boolean'
        ? payload.automaticUpdates
        : DEFAULT_SYSTEM_SETTINGS.automaticUpdates,
    updateChannel:
      payload.updateChannel === 'stable' || payload.updateChannel === 'prerelease'
        ? payload.updateChannel
        : DEFAULT_SYSTEM_SETTINGS.updateChannel
  }
}

/** Startup query result containing authoritative snapshots for system settings. */
export type LoadSystemSettingsResult = AuthoritativeSnapshotQueryResult
