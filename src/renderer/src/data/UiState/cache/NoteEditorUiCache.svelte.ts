import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

/** Wrapped note heights retained across virtual-row unmounts and visibility changes. */
export const noteEditorMeasuredHeight = createSessionMeasuredHeightCache()
