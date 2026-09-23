import { tick } from 'svelte'
import { getRuntimeConfig } from './runtimeConfig'
import { waitForRevisionMutations } from '@renderer/data/IpcFramework/RevisionMutation'
import { hasPendingPacedUpdates } from '@renderer/data/IpcFramework/RevisionMutationTransactionRegistry'
import { createPlaywrightTokenizationControls } from './playwrightTokenizationControls'

/** Installs test synchronization without flushing or changing autosave timing. */
export const initializePlaywrightTestControls = (): void => {
  if (getRuntimeConfig().environment !== 'PLAYWRIGHT') return
  window.playwrightTestControls = {
    tokenization: createPlaywrightTokenizationControls(),
    hasPendingAutosaves: hasPendingPacedUpdates,
    waitForMutations: async () => {
      await waitForRevisionMutations()
      // Commit Svelte effects caused by authoritative reconciliation before inspecting the DOM.
      await tick()
    }
  }
}
