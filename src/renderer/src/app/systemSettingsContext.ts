import { getContext, setContext } from 'svelte'
import type { SystemSettings } from '@shared/domain/settings/SystemSettings'

const SYSTEM_SETTINGS_CONTEXT = Symbol('system-settings')

export type SystemSettingsContext = SystemSettings

export const setSystemSettingsContext = (value: SystemSettingsContext): void => {
  setContext(SYSTEM_SETTINGS_CONTEXT, value)
}

export const getSystemSettingsContext = (): SystemSettingsContext => {
  return getContext<SystemSettingsContext>(SYSTEM_SETTINGS_CONTEXT)
}
