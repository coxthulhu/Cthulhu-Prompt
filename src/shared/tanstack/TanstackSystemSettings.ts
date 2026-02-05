import type { SystemSettings } from '@shared/ipc'

export type TanstackSystemSettings = SystemSettings

export type TanstackSystemSettingsRecord = TanstackSystemSettings & {
  id: string
}

export type TanstackLoadSystemSettingsSuccess = {
  settings: TanstackSystemSettings
}

export type TanstackLoadSystemSettingsResult =
  | ({ success: true } & TanstackLoadSystemSettingsSuccess)
  | { success: false; error: string }

export type TanstackUpdateSystemSettingsRequest = {
  settings: TanstackSystemSettings
}

export type TanstackUpdateSystemSettingsSuccess = {
  settings: TanstackSystemSettings
}

export type TanstackUpdateSystemSettingsResult =
  | ({ success: true } & TanstackUpdateSystemSettingsSuccess)
  | { success: false; error: string }
