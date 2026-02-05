import { getContext, setContext } from 'svelte'
import type { TanstackSystemSettingsRecord } from '@shared/tanstack/TanstackSystemSettings'

const SYSTEM_SETTINGS_CONTEXT = Symbol('system-settings')

export type SystemSettingsContext = {
  data: TanstackSystemSettingsRecord
}

export const setSystemSettingsContext = (value: SystemSettingsContext): void => {
  setContext(SYSTEM_SETTINGS_CONTEXT, value)
}

export const getSystemSettingsContext = (): SystemSettingsContext => {
  return getContext<SystemSettingsContext>(SYSTEM_SETTINGS_CONTEXT)
}
