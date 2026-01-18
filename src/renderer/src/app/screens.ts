import { Bug, Home, Settings } from 'lucide-svelte'

export type ScreenId = 'home' | 'settings' | 'test-screen' | 'prompt-folders'

export type ScreenConfig = {
  label: string
  testId: string
  requiresWorkspace: boolean
  devOnly?: boolean
  showInNav?: boolean
  icon?: typeof Home
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
  'test-screen': {
    label: 'Test Screen',
    testId: 'nav-button-test-screen',
    requiresWorkspace: false,
    devOnly: true,
    showInNav: true,
    icon: Bug
  },
  'prompt-folders': {
    label: 'Prompt Folders',
    testId: 'nav-button-prompt-folders',
    requiresWorkspace: true,
    showInNav: false
  }
}
