import {
  DEFAULT_SYSTEM_SETTINGS,
  normalizeTanstackSystemSettings,
  type TanstackSystemSettings
} from './tanstack/TanstackSystemSettings'

export type RuntimeEnvironment = '' | 'DEV' | 'PLAYWRIGHT'

export type RuntimeConfig = {
  devWorkspacePath: string | null
  executionFolderName: string | null
  environment: RuntimeEnvironment
  systemSettings: TanstackSystemSettings
  systemSettingsRevision: number
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

export const normalizeRuntimeSystemSettings = (value: unknown): TanstackSystemSettings => {
  if (value && typeof value === 'object') {
    return normalizeTanstackSystemSettings(value as Record<string, unknown>)
  }

  return DEFAULT_SYSTEM_SETTINGS
}

export const normalizeRuntimeSystemSettingsRevision = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}
