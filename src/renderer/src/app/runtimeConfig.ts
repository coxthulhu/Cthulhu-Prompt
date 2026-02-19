import { normalizeRuntimeEnvironment, type RuntimeConfig } from '@shared/runtimeConfig'

const fallbackRuntimeConfig: RuntimeConfig = {
  devWorkspacePath: null,
  executionFolderName: null,
  environment: ''
}

export const getRuntimeConfig = (): RuntimeConfig => {
  const config = window.runtimeConfig ?? fallbackRuntimeConfig
  return {
    devWorkspacePath: config.devWorkspacePath,
    executionFolderName: config.executionFolderName ?? null,
    environment: normalizeRuntimeEnvironment(config.environment)
  }
}

export const isDevOrPlaywrightEnvironment = () => {
  const env = getRuntimeConfig().environment
  return env === 'DEV' || env === 'PLAYWRIGHT'
}
