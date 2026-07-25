import { flushWorkspaceScopedAutosaves } from './AutosaveFlushes.svelte.ts'
import { clearPromptFolderDraftStore } from './PromptFolderDraftMutations.svelte.ts'
import { clearPromptDraftStore } from './PromptDraftMutations.svelte.ts'
import { clearPromptTemplateDraftStore } from './PromptTemplateDraftMutations.svelte.ts'
import { clearMarkdownContentUiStateStore } from './MarkdownContentUiStateDraftMutations.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchWorkspaceStoreBridge = async (
  nextWorkspacePath: string | null
): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) {
      return
    }

    // Side effect: flush active drafts before switching to a different workspace.
    await flushWorkspaceScopedAutosaves()

    currentWorkspacePath = nextWorkspacePath
    // Side effect: reset workspace-scoped draft/screen state after the workspace path changes.
    clearPromptFolderDraftStore()
    clearPromptDraftStore()
    clearPromptTemplateDraftStore()
    clearMarkdownContentUiStateStore()
  })

  switchQueue = task
  await task
}
