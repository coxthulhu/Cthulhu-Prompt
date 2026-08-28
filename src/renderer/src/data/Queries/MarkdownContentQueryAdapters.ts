import { createPromptFull, createPromptSummary, isPromptFull, type PromptFull } from '@shared/Prompt'
import {
  createPromptTemplateFull,
  isPromptTemplateFull,
  type PromptTemplateFull
} from '@shared/PromptTemplate'
import type { LoadPromptFolderInitialResult } from '@shared/PromptFolder'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import type { PromptFolderContentKind } from '@shared/PromptFolder'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import {
  deletePromptClientStates,
  upsertPromptClientStates
} from '../UiState/PromptClientStateMutations.svelte.ts'
import {
  deletePromptTemplateClientStates,
  upsertPromptTemplateClientStates
} from '../UiState/PromptTemplateClientStateMutations.svelte.ts'
import { clearPromptEditorMeasuredHeights } from '../UiState/PromptEditorUiCache.svelte.ts'

/** Clears prompt measurements whose canonical full text is changing. */
const clearChangedPromptMeasurements = (prompts: PromptFull[]): void => {
  /** Prompt IDs whose cached editor height no longer matches canonical text. */
  const changedPromptIds = prompts.flatMap((prompt) => {
    /** Canonical prompt record present before this authoritative load. */
    const current = promptCollection.get(prompt.id)
    return !current || !isPromptFull(current) || current.promptText !== prompt.promptText
      ? [prompt.id]
      : []
  })
  clearPromptEditorMeasuredHeights(changedPromptIds)
}

/** Clears template measurements whose canonical full text is changing. */
const clearChangedTemplateMeasurements = (templates: PromptTemplateFull[]): void => {
  /** Template IDs whose cached editor height no longer matches canonical text. */
  const changedTemplateIds = templates.flatMap((template) => {
    /** Canonical template record present before this authoritative load. */
    const current = promptTemplateCollection.get(template.id)
    return !current ||
      !isPromptTemplateFull(current) ||
      current.templateText !== template.templateText
      ? [template.id]
      : []
  })
  clearPromptEditorMeasuredHeights(changedTemplateIds)
}

type MarkdownContentQueryAdapter = {
  kind: PromptFolderContentKind
  getWorkspaceIds: (result: LoadWorkspaceByPathResult & { success: true }) => Set<string>
  applyWorkspaceResult: (result: LoadWorkspaceByPathResult & { success: true }) => void
  applyFolderResult: (result: LoadPromptFolderInitialResult & { success: true }) => void
  delete: (contentIds: string[]) => void
}

export const markdownContentQueryAdapters: readonly MarkdownContentQueryAdapter[] = [
  {
    kind: 'prompt',
    getWorkspaceIds: (result) => new Set(result.prompts.map((prompt) => prompt.id)),
    applyWorkspaceResult: (result) => {
      promptCollection.utils.upsertManyAuthoritative(
        result.prompts.map((prompt) => ({ ...prompt, data: createPromptSummary(prompt.data) }))
      )
      upsertPromptClientStates(result.prompts.map((prompt) => prompt.data))
    },
    applyFolderResult: (result) => {
      const snapshots = result.prompts.map((prompt) => ({
        ...prompt,
        data: createPromptFull(prompt.data)
      }))
      clearChangedPromptMeasurements(snapshots.map((prompt) => prompt.data))
      promptCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptClientStates(snapshots.map((prompt) => prompt.data))
    },
    delete: (promptIds) => {
      promptCollection.utils.deleteManyAuthoritative(promptIds)
      deletePromptClientStates(promptIds)
    }
  },
  {
    kind: 'template',
    getWorkspaceIds: (result) => new Set(result.promptTemplates.map((template) => template.id)),
    applyWorkspaceResult: (result) => {
      const snapshots = result.promptTemplates.map((template) => ({
        ...template,
        data: createPromptTemplateFull(template.data)
      }))
      clearChangedTemplateMeasurements(snapshots.map((template) => template.data))
      promptTemplateCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptTemplateClientStates(snapshots.map((template) => template.data))
    },
    applyFolderResult: (result) => {
      const snapshots = result.promptTemplates.map((template) => ({
        ...template,
        data: createPromptTemplateFull(template.data)
      }))
      clearChangedTemplateMeasurements(snapshots.map((template) => template.data))
      promptTemplateCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptTemplateClientStates(snapshots.map((template) => template.data))
    },
    delete: (templateIds) => {
      promptTemplateCollection.utils.deleteManyAuthoritative(templateIds)
      deletePromptTemplateClientStates(templateIds)
    }
  }
]
