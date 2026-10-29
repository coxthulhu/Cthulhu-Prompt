import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'

/** One navigable settings tree entry and the settings screen element it reveals. */
export type SettingsTreeRow = {
  id: string
  label: string
  /** Test ID of the settings screen element revealed by this entry. */
  targetTestId: string
}

/** One folder-like settings section and the settings rows grouped beneath it. */
export type SettingsTreeSection = SettingsTreeRow & {
  rows: SettingsTreeRow[]
}

/** Settings screen sections and rows, in screen order. */
export const settingsTreeSections: SettingsTreeSection[] = [
  {
    id: 'editor-layout',
    label: 'Editor & Layout',
    targetTestId: 'settings-section-editor-layout',
    rows: [
      { id: 'font-size', label: 'Font Size', targetTestId: 'editor-layout-font-size-row' },
      { id: 'new-prompt-focus', label: 'New Prompt Focus', targetTestId: 'editor-layout-new-prompt-focus-row' },
      { id: 'min-lines', label: 'Minimum Line Count', targetTestId: 'editor-layout-min-lines-row' },
      { id: 'max-lines', label: 'Maximum Line Count', targetTestId: 'editor-layout-max-lines-row' },
      { id: 'note-max-lines', label: 'Attached Note Maximum Lines', targetTestId: 'editor-layout-note-max-lines-row' },
      { id: 'line-numbers', label: 'Show Line Numbers', targetTestId: 'editor-layout-line-numbers-row' }
    ]
  },
  {
    id: 'about',
    label: 'About',
    targetTestId: 'settings-section-about',
    rows: [
      { id: 'report-issue', label: 'Report an Issue', targetTestId: 'about-issue-display-row' },
      { id: 'automatic-updates', label: 'Automatic Updates', targetTestId: 'about-automatic-updates-row' },
      { id: 'current-version', label: 'Current Version', targetTestId: 'about-version-display-row' }
    ]
  }
]

/** Highlighted settings tree entry, set by a tree click and cleared by user scrolling. */
export const settingsNavigation = $state<{ selectedRowId: string | null }>({ selectedRowId: null })

/** Settings screen scroll requests for one tree entry. */
export const settingsScrollRequests = createConsumableRequestCoordinator<{ rowId: string }>()
