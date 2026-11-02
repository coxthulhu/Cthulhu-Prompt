import type { ComponentType } from 'svelte'
import { Bug, Home, PanelsTopLeft, Settings } from 'lucide-svelte'
import { SidebarModeId } from '@renderer/features/sidebar/sidebarModes.svelte.ts'

export type ScreenId =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'project'

type ScreenConfig = {
  label: string
  testId: string
  requiresWorkspace: boolean
  devOnly?: boolean
  showInNav?: boolean
  icon?: ComponentType
  /** Sidebar mode displayed beside this screen, or null for screens without a sidebar. */
  sidebarMode: SidebarModeId | null
}

export const screens: Record<ScreenId, ScreenConfig> = {
  home: {
    label: 'Home',
    testId: 'nav-button-home',
    requiresWorkspace: false,
    showInNav: true,
    icon: Home,
    sidebarMode: null
  },
  settings: {
    label: 'System Settings',
    testId: 'nav-button-settings',
    requiresWorkspace: false,
    showInNav: true,
    icon: Settings,
    sidebarMode: SidebarModeId.Settings
  },
  mockups: {
    label: 'Mockups',
    testId: 'nav-button-mockups',
    requiresWorkspace: false,
    devOnly: true,
    showInNav: true,
    icon: PanelsTopLeft,
    sidebarMode: null
  },
  'test-screen': {
    label: 'Test Screen',
    testId: 'nav-button-test-screen',
    requiresWorkspace: false,
    devOnly: true,
    showInNav: true,
    icon: Bug,
    sidebarMode: null
  },
  /** Rendered by the activity bar's project group instead of the screen list. */
  project: {
    label: 'Project',
    testId: 'nav-button-project',
    requiresWorkspace: true,
    sidebarMode: SidebarModeId.Project
  }
}
