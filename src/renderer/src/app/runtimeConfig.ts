import {
  normalizeRuntimeEnvironment,
  normalizeRuntimeSystemSettingsRevision,
  normalizeRuntimeSystemSettings,
  type RuntimeConfig
} from '@shared/runtimeConfig'

const fallbackRuntimeConfig: RuntimeConfig = {
  devWorkspacePath: null,
  executionFolderName: null,
  environment: '',
  systemSettings: normalizeRuntimeSystemSettings(undefined),
  systemSettingsRevision: 0
}

export const getRuntimeConfig = (): RuntimeConfig => {
  const config = window.runtimeConfig ?? fallbackRuntimeConfig
  return {
    devWorkspacePath: config.devWorkspacePath,
    executionFolderName: config.executionFolderName ?? null,
    environment: normalizeRuntimeEnvironment(config.environment),
    systemSettings: normalizeRuntimeSystemSettings(config.systemSettings),
    systemSettingsRevision: normalizeRuntimeSystemSettingsRevision(config.systemSettingsRevision)
  }
}

export const isDevEnvironment = () => getRuntimeConfig().environment === 'DEV'
export const isPlaywrightEnvironment = () => getRuntimeConfig().environment === 'PLAYWRIGHT'
export const isDevOrPlaywrightEnvironment = () => {
  const env = getRuntimeConfig().environment
  return env === 'DEV' || env === 'PLAYWRIGHT'
}
