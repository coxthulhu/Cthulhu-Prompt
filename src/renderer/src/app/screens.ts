import { Bug, Home, LayoutGrid, PanelsTopLeft, Settings, type LucideIcon } from '@lucide/svelte'
import { SidebarModeId } from '@renderer/features/sidebar/sidebarModes.svelte.ts'

export type ScreenId =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'work-tab'

type ScreenConfig = {
  label: string
  testId: string
  requiresWorkspace: boolean
  devOnly?: boolean
  icon?: LucideIcon
  /** Sidebar mode displayed beside this screen, or null for screens without a sidebar. */
  sidebarMode: SidebarModeId | null
}

export const screens: Record<ScreenId, ScreenConfig> = {
  home: {
    label: 'Home',
    testId: 'nav-button-home',
    requiresWorkspace: false,
    icon: Home,
    sidebarMode: null
  },
  settings: {
    label: 'System Settings',
    testId: 'nav-button-settings',
    requiresWorkspace: false,
    icon: Settings,
    sidebarMode: SidebarModeId.Settings
  },
  mockups: {
    label: 'Mockups',
    testId: 'nav-button-mockups',
    requiresWorkspace: false,
    devOnly: true,
    icon: PanelsTopLeft,
    sidebarMode: null
  },
  'test-screen': {
    label: 'Test Screen',
    testId: 'nav-button-test-screen',
    requiresWorkspace: false,
    devOnly: true,
    icon: Bug,
    sidebarMode: null
  },
  /** Shown by the selected work tab instead of a title bar screen button: its New Tab screen, which hides the
      sidebar, or its collection or single-prompt screen beside the collection mode. */
  'work-tab': {
    label: 'Work Tab',
    testId: 'nav-button-work-tab',
    requiresWorkspace: true,
    icon: LayoutGrid,
    sidebarMode: SidebarModeId.Collection
  }
}
