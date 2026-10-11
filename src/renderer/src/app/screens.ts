import type { ComponentType } from 'svelte'
import { Bug, FileText, Home, Layers, PanelsTopLeft, Settings } from 'lucide-svelte'

export type ScreenId =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'prompt-task-collections'
  | 'prompt-template-collections'

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
    showInNav: true,
    icon: Bug
  },
  'prompt-task-collections': {
    label: 'Task Prompts',
    testId: 'nav-button-prompt-task-collections',
    requiresWorkspace: true,
    showInNav: true,
    icon: FileText
  },
  'prompt-template-collections': {
    label: 'Prompt Templates',
    testId: 'nav-button-prompt-template-collections',
    requiresWorkspace: true,
    showInNav: true,
    icon: Layers
  }
}
