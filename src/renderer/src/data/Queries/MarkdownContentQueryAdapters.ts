import { createPromptFull, createPromptSummary, isPromptFull, type PromptFull } from '@shared/domain/prompt/Prompt'
import {
  createPromptTemplateFull,
  isPromptTemplateFull,
  type PromptTemplateFull
} from '@shared/domain/prompt-template/PromptTemplate'
import type { LoadPromptCollectionInitialResult } from '@shared/domain/prompt-collection/PromptCollection'
import type { LoadWorkspaceByPathResult } from '@shared/domain/workspace/Workspace'
import type { PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import {
  deletePromptClientStates,
  upsertPromptClientStates
} from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
import {
  deletePromptTemplateClientStates,
  upsertPromptTemplateClientStates
} from '@renderer/data/UiState/client-state/PromptTemplateClientStateMutations.svelte.ts'
import { clearPromptEditorMeasuredHeights } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'

/** Clears prompt measurements whose canonical full text is changing. */
const clearChangedPromptMeasurements = (prompts: PromptFull[]): void => {
  /** Prompt IDs whose cached editor height no longer matches canonical text. */
  const changedPromptIds = prompts.flatMap((prompt) => {
    /** Canonical prompt record present before this authoritative load. */
    const current = promptsCollection.get(prompt.id)
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
    const current = promptTemplatesCollection.get(template.id)
    return !current ||
      !isPromptTemplateFull(current) ||
      current.templateText !== template.templateText
      ? [template.id]
      : []
  })
  clearPromptEditorMeasuredHeights(changedTemplateIds)
}

type MarkdownContentQueryAdapter = {
  kind: PromptCollectionContentKind
  getWorkspaceIds: (result: LoadWorkspaceByPathResult & { success: true }) => Set<string>
  applyWorkspaceResult: (result: LoadWorkspaceByPathResult & { success: true }) => void
  applyCollectionResult: (result: LoadPromptCollectionInitialResult & { success: true }) => void
  delete: (contentIds: string[]) => void
}

export const markdownContentQueryAdapters: readonly MarkdownContentQueryAdapter[] = [
  {
    kind: 'prompt',
    getWorkspaceIds: (result) => new Set(result.prompts.map((prompt) => prompt.id)),
    applyWorkspaceResult: (result) => {
      promptsCollection.utils.upsertManyAuthoritative(
        result.prompts.map((prompt) => ({ ...prompt, data: createPromptSummary(prompt.data) }))
      )
      upsertPromptClientStates(result.prompts.map((prompt) => prompt.data))
    },
    applyCollectionResult: (result) => {
      const snapshots = result.prompts.map((prompt) => ({
        ...prompt,
        data: createPromptFull(prompt.data)
      }))
      clearChangedPromptMeasurements(snapshots.map((prompt) => prompt.data))
      promptsCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptClientStates(snapshots.map((prompt) => prompt.data))
    },
    delete: (promptIds) => {
      promptsCollection.utils.deleteManyAuthoritative(promptIds)
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
      promptTemplatesCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptTemplateClientStates(snapshots.map((template) => template.data))
    },
    applyCollectionResult: (result) => {
      const snapshots = result.promptTemplates.map((template) => ({
        ...template,
        data: createPromptTemplateFull(template.data)
      }))
      clearChangedTemplateMeasurements(snapshots.map((template) => template.data))
      promptTemplatesCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptTemplateClientStates(snapshots.map((template) => template.data))
    },
    delete: (templateIds) => {
      promptTemplatesCollection.utils.deleteManyAuthoritative(templateIds)
      deletePromptTemplateClientStates(templateIds)
    }
  }
]
