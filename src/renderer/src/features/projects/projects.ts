/** One project shown in the activity bar; every collection currently belongs to the default project. */
export type Project = {
  /** Sidebar title for the project mode. */
  title: string
  /** Two letters shown on the project's activity bar button. */
  initials: string
}

/** Uneditable project that owns every collection until full project support exists. */
export const DEFAULT_PROJECT: Project = { title: 'Default Project', initials: 'DE' }

/** Projects shown in the activity bar, in display order. */
export const projects: Project[] = [DEFAULT_PROJECT]
