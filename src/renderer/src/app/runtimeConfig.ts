import { normalizeRuntimeEnvironment, type RuntimeConfig } from '@shared/runtimeConfig'

const fallbackRuntimeConfig: RuntimeConfig = {
  devWorkspacePath: null,
  environment: ''
}

export const getRuntimeConfig = (): RuntimeConfig => {
  const config = window.runtimeConfig ?? fallbackRuntimeConfig
  return {
    devWorkspacePath: config.devWorkspacePath,
    environment: normalizeRuntimeEnvironment(config.environment)
  }
}

export const isDevEnvironment = () => getRuntimeConfig().environment === 'DEV'
export const isPlaywrightEnvironment = () => getRuntimeConfig().environment === 'PLAYWRIGHT'
export const isDevOrPlaywrightEnvironment = () => {
  const env = getRuntimeConfig().environment
  return env === 'DEV' || env === 'PLAYWRIGHT'
}
