import type { SystemSettings } from './ipc'
import { DEFAULT_SYSTEM_SETTINGS, normalizeSystemSettings } from './systemSettings'

export type RuntimeEnvironment = '' | 'DEV' | 'PLAYWRIGHT'

export type RuntimeConfig = {
  devWorkspacePath: string | null
  executionFolderName: string | null
  environment: RuntimeEnvironment
  systemSettings: SystemSettings
  systemSettingsVersion: number
}

export const RUNTIME_ARG_PREFIX = '--cthulhu-runtime='

export const normalizeRuntimeEnvironment = (
  value: string | undefined | null
): RuntimeEnvironment => {
  if (!value) {
    return ''
  }

  const normalized = value.trim().toUpperCase()

  if (normalized === 'DEV' || normalized === 'PLAYWRIGHT') {
    return normalized
  }

  return ''
}

export const normalizeRuntimeSystemSettings = (value: unknown): SystemSettings => {
  if (value && typeof value === 'object') {
    return normalizeSystemSettings(value as Record<string, unknown>)
  }

  return DEFAULT_SYSTEM_SETTINGS
}
