import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Singleton key for renderer-session system-settings state. */
export const SYSTEM_SETTINGS_CLIENT_STATE_ID = 'system-settings-client-state'

/** Renderer-session client state for editable system settings inputs. */
export type SystemSettingsClientStateRecord = {
  id: typeof SYSTEM_SETTINGS_CLIENT_STATE_ID
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
  promptEditorMaxLinesInput: string
  showLineNumbers: boolean
}

/** Local-only renderer-session state for system settings. */
export const systemSettingsClientStateCollection = createCollection(
  localOnlyCollectionOptions<SystemSettingsClientStateRecord>({
    id: 'system-settings-client-state',
    getKey: (clientState) => clientState.id
  })
)
