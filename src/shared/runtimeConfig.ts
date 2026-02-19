export type RuntimeEnvironment = '' | 'DEV' | 'PLAYWRIGHT'

export type RuntimeConfig = {
  executionFolderName: string | null
  environment: RuntimeEnvironment
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
