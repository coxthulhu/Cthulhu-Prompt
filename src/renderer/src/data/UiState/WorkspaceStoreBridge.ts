import { flushWorkspaceScopedAutosaves } from './AutosaveFlushes.svelte.ts'
import { clearPromptFolderClientStateCollection } from './PromptFolderClientState'
import { clearPromptClientStateCollection } from './PromptClientStateMutations.svelte.ts'
import { clearPromptTemplateClientStateCollection } from './PromptTemplateClientStateMutations.svelte.ts'
import { clearMarkdownContentUiStateCollection } from './MarkdownContentUiStateAutosave.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchWorkspaceStoreBridge = async (
  nextWorkspacePath: string | null
): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) {
      return
    }

    // Side effect: flush active client state before switching to a different workspace.
    await flushWorkspaceScopedAutosaves()

    currentWorkspacePath = nextWorkspacePath
    // Side effect: reset workspace-scoped client/screen state after the workspace path changes.
    clearPromptFolderClientStateCollection()
    clearPromptClientStateCollection()
    clearPromptTemplateClientStateCollection()
    clearMarkdownContentUiStateCollection()
  })

  switchQueue = task
  await task
}
