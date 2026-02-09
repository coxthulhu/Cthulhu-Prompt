import {
  DEFAULT_SYSTEM_SETTINGS,
  MAX_PROMPT_EDITOR_MIN_LINES,
  MAX_PROMPT_FONT_SIZE,
  MIN_PROMPT_EDITOR_MIN_LINES,
  MIN_PROMPT_FONT_SIZE,
  type TanstackSystemSettings
} from '@shared/tanstack/TanstackSystemSettings'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updateTanstackSystemSettings } from '../Mutations/TanstackSystemSettingsMutations'
import {
  formatPromptEditorMinLinesInput,
  formatPromptFontSizeInput,
  normalizePromptEditorMinLinesInput,
  normalizePromptFontSizeInput
} from './TanstackSystemSettingsFormat'

export type TanstackSystemSettingsDraftSnapshot = {
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
}

export type TanstackSystemSettingsValidation = {
  fontSizeError: string | null
  minLinesError: string | null
}

export type TanstackSystemSettingsDraftState = {
  draftSnapshot: TanstackSystemSettingsDraftSnapshot
  saveError: string | null
}

const toDraftSnapshot = (
  settings: TanstackSystemSettings
): TanstackSystemSettingsDraftSnapshot => ({
  promptFontSizeInput: formatPromptFontSizeInput(settings.promptFontSize),
  promptEditorMinLinesInput: formatPromptEditorMinLinesInput(settings.promptEditorMinLines)
})

const draftState = $state<TanstackSystemSettingsDraftState>({
  draftSnapshot: toDraftSnapshot(DEFAULT_SYSTEM_SETTINGS),
  saveError: null
})

const autosaveDraft = $state<AutosaveDraft>({
  dirty: false,
  saving: false,
  autosaveTimeoutId: null
})

let lastSyncedSettings: TanstackSystemSettings = DEFAULT_SYSTEM_SETTINGS
let hasSyncedSettings = false

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

export const getTanstackSystemSettingsValidation = (): TanstackSystemSettingsValidation => {
  return {
    fontSizeError: validateFontSize(draftState.draftSnapshot.promptFontSizeInput),
    minLinesError: validateMinLines(draftState.draftSnapshot.promptEditorMinLinesInput)
  }
}

const syncDraftSnapshot = (settings: TanstackSystemSettings): void => {
  draftState.draftSnapshot.promptFontSizeInput = formatPromptFontSizeInput(settings.promptFontSize)
  draftState.draftSnapshot.promptEditorMinLinesInput = formatPromptEditorMinLinesInput(
    settings.promptEditorMinLines
  )
  draftState.saveError = null
  autosaveDraft.dirty = false
}

const haveSameSettings = (left: TanstackSystemSettings, right: TanstackSystemSettings): boolean => {
  return (
    left.promptFontSize === right.promptFontSize &&
    left.promptEditorMinLines === right.promptEditorMinLines
  )
}

export const syncTanstackSystemSettingsDraft = (settings: TanstackSystemSettings): void => {
  if (hasSyncedSettings && haveSameSettings(lastSyncedSettings, settings)) {
    return
  }

  hasSyncedSettings = true
  lastSyncedSettings = { ...settings }
  clearAutosaveTimeout(autosaveDraft)
  syncDraftSnapshot(settings)
}

const autosave = createAutosaveController({
  draft: autosaveDraft,
  autosaveMs: AUTOSAVE_MS,
  save: async () => {
    const validation = getTanstackSystemSettingsValidation()

    if (validation.fontSizeError || validation.minLinesError) {
      return
    }

    const fontSize = normalizePromptFontSizeInput(draftState.draftSnapshot.promptFontSizeInput)
    const minLines = normalizePromptEditorMinLinesInput(
      draftState.draftSnapshot.promptEditorMinLinesInput
    )

    draftState.saveError = null
    await updateTanstackSystemSettings({
      promptFontSize: fontSize.rounded,
      promptEditorMinLines: minLines.rounded
    })
    autosaveDraft.dirty = false
  }
})

export const getTanstackSystemSettingsDraftState = (): TanstackSystemSettingsDraftState => {
  return draftState
}

export const getTanstackSystemSettingsAutosaveDraft = (): AutosaveDraft => {
  return autosaveDraft
}

export const setTanstackSystemSettingsDraftFontSizeInput = (value: string): void => {
  if (draftState.draftSnapshot.promptFontSizeInput === value) return
  draftState.draftSnapshot.promptFontSizeInput = value
  draftState.saveError = null
  autosave.markDirtyAndScheduleAutosave()
}

export const setTanstackSystemSettingsDraftPromptEditorMinLinesInput = (value: string): void => {
  if (draftState.draftSnapshot.promptEditorMinLinesInput === value) return
  draftState.draftSnapshot.promptEditorMinLinesInput = value
  draftState.saveError = null
  autosave.markDirtyAndScheduleAutosave()
}

export const saveTanstackSystemSettingsDraftNow = async (): Promise<void> => {
  try {
    await autosave.saveNow()
  } catch (error) {
    draftState.saveError = error instanceof Error ? error.message : 'Failed to update system settings.'
    throw error
  }
}

export const flushTanstackSystemSettingsAutosave = async (): Promise<void> => {
  clearAutosaveTimeout(autosaveDraft)
  await saveTanstackSystemSettingsDraftNow()
}
