import type { DomainPlanner, DomainTarget } from './DomainChanges'
import { SYSTEM_SETTINGS_ID, normalizeSystemSettings, type SystemSettings } from './SystemSettings'

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
    Object.keys(record).length !== 4 ||
    typeof record.promptFontSize !== 'number' ||
    !Number.isFinite(record.promptFontSize) ||
    typeof record.promptEditorMinLines !== 'number' ||
    !Number.isFinite(record.promptEditorMinLines) ||
    typeof record.promptEditorMaxLines !== 'number' ||
    !Number.isFinite(record.promptEditorMaxLines) ||
    typeof record.showLineNumbers !== 'boolean'
  ) {
    return null
  }
  return {
    promptFontSize: record.promptFontSize,
    promptEditorMinLines: record.promptEditorMinLines,
    promptEditorMaxLines: record.promptEditorMaxLines,
    showLineNumbers: record.showLineNumbers
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
