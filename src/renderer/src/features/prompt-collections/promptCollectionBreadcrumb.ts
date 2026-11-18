import type { PromptCollectionHeaderSegment } from './PromptCollectionHeaderBar.svelte'

/** One clickable breadcrumb location. */
type PromptCollectionBreadcrumbLink = {
  label: string
  onclick: () => void
}

/** Builds the shared project → collection → status → category → prompt path for collection screens. */
export const buildPromptCollectionBreadcrumb = ({
  project,
  collection,
  statusGroup,
  category,
  prompt
}: {
  project: PromptCollectionBreadcrumbLink | null
  collection: PromptCollectionBreadcrumbLink
  statusGroup: PromptCollectionBreadcrumbLink
  category: PromptCollectionBreadcrumbLink | null
  /** Open prompt shown by the single-prompt screen. */
  prompt?: PromptCollectionBreadcrumbLink
}): PromptCollectionHeaderSegment[] => [
  ...(project ? [{ ...project, testId: 'prompt-collection-header-project' }] : []),
  { ...collection, testId: 'prompt-collection-header-collection' },
  { ...statusGroup, testId: 'prompt-collection-header-section' },
  ...(category ? [{ ...category, testId: 'prompt-collection-header-category' }] : []),
  ...(prompt ? [{ ...prompt, testId: 'prompt-collection-header-prompt' }] : [])
]
