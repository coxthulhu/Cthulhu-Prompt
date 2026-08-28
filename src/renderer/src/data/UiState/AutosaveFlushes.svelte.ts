import { flushPromptClientStateAutosaves } from './PromptClientStateMutations.svelte.ts'
import { flushPromptTemplateClientStateAutosaves } from './PromptTemplateClientStateMutations.svelte.ts'
import { flushMarkdownContentUiStateAutosaves } from './MarkdownContentUiStateAutosave.svelte.ts'
import { flushSystemSettingsAutosaves } from './SystemSettingsAutosave.svelte.ts'
import { flushUserPersistenceAutosaves } from './UserPersistenceAutosave.svelte.ts'
import { flushWorkspacePersistenceAutosaves } from './WorkspacePersistenceAutosave.svelte.ts'

type AutosaveFlushTask = () => Promise<void>

const workspaceScopedAutosaveFlushTasks: AutosaveFlushTask[] = [
  flushPromptClientStateAutosaves,
  flushPromptTemplateClientStateAutosaves,
  flushMarkdownContentUiStateAutosaves,
  flushSystemSettingsAutosaves,
  flushWorkspacePersistenceAutosaves
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
