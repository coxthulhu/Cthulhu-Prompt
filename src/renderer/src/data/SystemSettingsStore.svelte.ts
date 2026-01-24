import type {
  LoadSystemSettingsResult,
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

export type SystemSettingsState = {
  settings: SystemSettings | null
  isLoading: boolean
  isSaving: boolean
  errorMessage: string | null
  hasLoaded: boolean
  requestId: number
}

const runtimeConfig = getRuntimeConfig()
const initialSettings = runtimeConfig.systemSettings ?? null

const systemSettingsState = $state<SystemSettingsState>({
  settings: initialSettings,
  isLoading: false,
  isSaving: false,
  errorMessage: null,
  hasLoaded: false,
  requestId: 0
})

let nextRequestId = 0
let loadPromise: Promise<void> | null = null

const isLatestRequest = (requestId: number): boolean => {
  return systemSettingsState.requestId === requestId
}

export const getSystemSettingsState = (): SystemSettingsState => systemSettingsState

export const loadSystemSettingsOnce = async (): Promise<void> => {
  if (systemSettingsState.hasLoaded) return
  if (loadPromise) return loadPromise

  const requestId = (nextRequestId += 1)
  systemSettingsState.requestId = requestId
  systemSettingsState.isLoading = true
  systemSettingsState.errorMessage = null

  const task = (async () => {
    try {
      const result = await ipcInvoke<LoadSystemSettingsResult>('load-system-settings')

      if (!isLatestRequest(requestId)) return

      systemSettingsState.settings = result.settings ?? DEFAULT_SYSTEM_SETTINGS
    } catch (error) {
      if (!isLatestRequest(requestId)) return

      systemSettingsState.errorMessage = error instanceof Error ? error.message : String(error)
    }

    if (!isLatestRequest(requestId)) return

    systemSettingsState.isLoading = false
    systemSettingsState.hasLoaded = true
  })()

  loadPromise = task
  try {
    await task
  } finally {
    if (loadPromise === task) {
      loadPromise = null
    }
  }
}

export const updateSystemSettings = async (
  request: UpdateSystemSettingsRequest
): Promise<UpdateSystemSettingsResult> => {
  systemSettingsState.isSaving = true
  systemSettingsState.errorMessage = null

  try {
    const result = await ipcInvoke<UpdateSystemSettingsResult, UpdateSystemSettingsRequest>(
      'update-system-settings',
      request
    )

    if (result.settings) {
      systemSettingsState.settings = result.settings
    }

    return result
  } catch (error) {
    systemSettingsState.errorMessage = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    systemSettingsState.isSaving = false
  }
}
