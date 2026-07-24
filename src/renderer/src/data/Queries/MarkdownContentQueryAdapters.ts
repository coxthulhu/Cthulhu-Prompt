import { createPromptFull, createPromptSummary } from '@shared/Prompt'
import { createPromptTemplateFull, createPromptTemplateSummary } from '@shared/PromptTemplate'
import type { LoadPromptFolderInitialResult } from '@shared/PromptFolder'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import type { PromptFolderKind } from '@shared/PromptFolder'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { deletePromptDrafts, upsertPromptDrafts, upsertPromptSummaryDrafts } from '../UiState/PromptDraftMutations.svelte.ts'
import {
  deletePromptTemplateDrafts,
  upsertPromptTemplateDrafts,
  upsertPromptTemplateSummaryDrafts
} from '../UiState/PromptTemplateDraftMutations.svelte.ts'

type MarkdownContentQueryAdapter = {
  kind: PromptFolderKind
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
      upsertPromptSummaryDrafts(result.prompts.map((prompt) => prompt.data))
    },
    applyFolderResult: (result) => {
      const snapshots = result.prompts.map((prompt) => ({
        ...prompt,
        data: createPromptFull(prompt.data)
      }))
      promptCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptDrafts(snapshots.map((prompt) => prompt.data))
    },
    delete: (promptIds) => {
      promptCollection.utils.deleteManyAuthoritative(promptIds)
      deletePromptDrafts(promptIds)
    }
  },
  {
    kind: 'template',
    getWorkspaceIds: (result) => new Set(result.promptTemplates.map((template) => template.id)),
    applyWorkspaceResult: (result) => {
      promptTemplateCollection.utils.upsertManyAuthoritative(
        result.promptTemplates.map((template) => ({
          ...template,
          data: createPromptTemplateSummary(template.data)
        }))
      )
      upsertPromptTemplateSummaryDrafts(result.promptTemplates.map((template) => template.data))
    },
    applyFolderResult: (result) => {
      const snapshots = result.promptTemplates.map((template) => ({
        ...template,
        data: createPromptTemplateFull(template.data)
      }))
      promptTemplateCollection.utils.upsertManyAuthoritative(snapshots)
      upsertPromptTemplateDrafts(snapshots.map((template) => template.data))
    },
    delete: (templateIds) => {
      promptTemplateCollection.utils.deleteManyAuthoritative(templateIds)
      deletePromptTemplateDrafts(templateIds)
    }
  }
]
