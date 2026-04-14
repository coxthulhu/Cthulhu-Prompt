import type { ComponentType } from 'svelte'
import { Bug, Home, PanelsTopLeft, Settings } from 'lucide-svelte'

export type ScreenId = 'home' | 'settings' | 'mockups' | 'test-screen' | 'prompt-folders'

type ScreenConfig = {
  label: string
  testId: string
  requiresWorkspace: boolean
  devOnly?: boolean
  showInNav?: boolean
  icon?: ComponentType
}

export const screens: Record<ScreenId, ScreenConfig> = {
  home: {
    label: 'Home',
    testId: 'nav-button-home',
    requiresWorkspace: false,
    showInNav: true,
    icon: Home
  },
  settings: {
    label: 'Settings',
    testId: 'nav-button-settings',
    requiresWorkspace: false,
    showInNav: true,
    icon: Settings
  },
  mockups: {
    label: 'Mockups',
    testId: 'nav-button-mockups',
    requiresWorkspace: false,
    devOnly: true,
    showInNav: true,
    icon: PanelsTopLeft
  },
  'test-screen': {
    label: 'Test Screen',
    testId: 'nav-button-test-screen',
    requiresWorkspace: false,
    devOnly: true,
    showInNav: false,
    icon: Bug
  },
  'prompt-folders': {
    label: 'Prompt Folders',
    testId: 'nav-button-prompt-folders',
    requiresWorkspace: true,
    showInNav: false
  }
}
