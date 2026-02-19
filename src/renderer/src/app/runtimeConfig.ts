import {
  DEFAULT_RUNTIME_CONFIG,
  normalizeRuntimeEnvironment,
  type RuntimeConfig
} from '@shared/runtimeConfig'

export const getRuntimeConfig = (): RuntimeConfig => {
  const config = window.runtimeConfig ?? DEFAULT_RUNTIME_CONFIG
  return {
    executionFolderName: config.executionFolderName ?? null,
    environment: normalizeRuntimeEnvironment(config.environment)
  }
}

export const isDevOrPlaywrightEnvironment = () => {
  const env = getRuntimeConfig().environment
  return env === 'DEV' || env === 'PLAYWRIGHT'
}
