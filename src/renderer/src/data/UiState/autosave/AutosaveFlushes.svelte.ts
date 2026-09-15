import { flushPromptClientStateAutosaves } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
import { flushPromptTemplateClientStateAutosaves } from '@renderer/data/UiState/client-state/PromptTemplateClientStateMutations.svelte.ts'
import { flushMarkdownContentUiStateAutosaves } from './MarkdownContentUiStateAutosave.svelte.ts'
import { flushSystemSettingsAutosaves } from '@renderer/data/UiState/autosave/SystemSettingsAutosave.svelte.ts'
import { flushUserPersistenceAutosaves } from './UserPersistenceAutosave.svelte.ts'
import { flushWorkspaceUiStateAutosaves } from './WorkspaceUiStateAutosave.svelte.ts'

type AutosaveFlushTask = () => Promise<void>

const workspaceScopedAutosaveFlushTasks: AutosaveFlushTask[] = [
  flushPromptClientStateAutosaves,
  flushPromptTemplateClientStateAutosaves,
  flushMarkdownContentUiStateAutosaves,
  flushSystemSettingsAutosaves,
  flushWorkspaceUiStateAutosaves
]

const flushAutosaveTasks = async (tasks: AutosaveFlushTask[]): Promise<void> => {
  await Promise.allSettled(tasks.map((task) => task()))
}

export const flushWorkspaceScopedAutosaves = async (): Promise<void> => {
  await flushAutosaveTasks(workspaceScopedAutosaveFlushTasks)
}

export const flushAllAutosaves = async (): Promise<void> => {
  await flushAutosaveTasks([...workspaceScopedAutosaveFlushTasks, flushUserPersistenceAutosaves])
}
