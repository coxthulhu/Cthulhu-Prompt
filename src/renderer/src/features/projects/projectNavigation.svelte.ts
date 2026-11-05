import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'

/** Shell-owned navigation requested after successful project creation or deletion. */
export const projectNavigation = createConsumableRequestCoordinator<{ workspaceId: string; projectId: string | null }>()
