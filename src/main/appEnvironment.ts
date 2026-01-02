import { normalizeRuntimeEnvironment } from '@shared/runtimeConfig'

const DEV_ENVIRONMENT_VARIABLE = 'DEV_ENVIRONMENT' as const

const readEnvironment = () => normalizeRuntimeEnvironment(process.env[DEV_ENVIRONMENT_VARIABLE])

export const isDevEnvironment = (): boolean => readEnvironment() === 'DEV'

export const isPlaywrightEnvironment = (): boolean => readEnvironment() === 'PLAYWRIGHT'

export const isDevOrPlaywrightEnvironment = (): boolean => {
  const environment = readEnvironment()
  return environment === 'DEV' || environment === 'PLAYWRIGHT'
}
