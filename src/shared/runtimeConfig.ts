export type RuntimeEnvironment = '' | 'DEV' | 'PLAYWRIGHT'

export type RuntimeConfig = {
  executionFolderName: string | null
  environment: RuntimeEnvironment
  appVersion: string
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  executionFolderName: null,
  environment: '',
  appVersion: '0.0.0'
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

export const normalizeAppVersion = (value: string | undefined | null): string => {
  const normalized = value?.trim()
  return normalized || DEFAULT_RUNTIME_CONFIG.appVersion
}
