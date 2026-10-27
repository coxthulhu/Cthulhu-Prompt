import type { DomainPlanner, DomainTarget } from '@shared/domain/DomainChanges'
import { ATTACHED_NOTE_LINE_RESERVE, SYSTEM_SETTINGS_ID, normalizeSystemSettings, type SystemSettings } from '@shared/domain/settings/SystemSettings'

/** Renderer-authored command containing the complete desired system settings. */
export type SetSystemSettingsDomainCommand = SystemSettings

/** Strict runtime parser for complete system-settings replacement commands. */
export const parseSetSystemSettingsDomainCommand = (
  value: unknown
): SetSystemSettingsDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 7 ||
    typeof record.promptFontSize !== 'number' ||
    !Number.isFinite(record.promptFontSize) ||
    typeof record.promptEditorMinLines !== 'number' ||
    !Number.isFinite(record.promptEditorMinLines) ||
    typeof record.promptEditorMaxLines !== 'number' ||
    !Number.isFinite(record.promptEditorMaxLines) ||
    typeof record.attachedNoteMaxLines !== 'number' ||
    !Number.isFinite(record.attachedNoteMaxLines) ||
    typeof record.showLineNumbers !== 'boolean' ||
    typeof record.automaticUpdates !== 'boolean' ||
    (record.newPromptFocus !== 'title' && record.newPromptFocus !== 'editor')
  ) {
    return null
  }
  return {
    promptFontSize: record.promptFontSize,
    promptEditorMinLines: record.promptEditorMinLines,
    promptEditorMaxLines: record.promptEditorMaxLines,
    attachedNoteMaxLines: record.attachedNoteMaxLines,
    showLineNumbers: record.showLineNumbers,
    newPromptFocus: record.newPromptFocus,
    automaticUpdates: record.automaticUpdates
  }
}

/** Plans one normalized system-settings replacement as a single paced target update. */
export const planSetSystemSettingsDomainMutation: DomainPlanner<
  SetSystemSettingsDomainCommand
> = (state, command) => {
  /** Current singleton settings required before an update may be planned. */
  const settings = state.get('systemSettings', SYSTEM_SETTINGS_ID)
  /** Stable singleton target returned when settings have not loaded. */
  const targets: DomainTarget[] = [
    { entityType: 'systemSettings', id: SYSTEM_SETTINGS_ID }
  ]
  if (!settings) {
    return { status: 'conflict', reason: 'System settings conflict', targets }
  }
  /** Normalized settings shared by renderer optimism and main persistence. */
  const normalizedSettings = normalizeSystemSettings({ ...command })
  if (normalizedSettings.promptEditorMaxLines < normalizedSettings.attachedNoteMaxLines + ATTACHED_NOTE_LINE_RESERVE) {
    return { status: 'conflict', reason: 'Editor maximum must leave at least five lines beyond the note maximum', targets }
  }
  return [
    {
      type: 'update',
      entityType: 'systemSettings',
      id: SYSTEM_SETTINGS_ID,
      recipe: (draft) => {
        Object.assign(draft, normalizedSettings)
      }
    }
  ]
}
