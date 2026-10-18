import * as notes from '@renderer/data/Mutations/NoteMutations'
import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { loadPromptCollectionInitial } from '@renderer/data/Queries/PromptCollectionQuery'
import { setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
import { deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import { deletePromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
import { deletePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'
import { renamePromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
import { deleteCategory } from '@renderer/data/Mutations/CategoryMutations'
import { submitAllPacedUpdateTransactionsAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { planPromptUpdate, planPromptTemplateUpdate } from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'

/**
 * Exercises production renderer commands before notes have visible controls.
 * These test controls should be REMOVED once the operations are available in the UI,
 * and the Playwright tests should exercise those UI controls instead.
 */
export const playwrightNoteControls = {
  ...notes,
  loadCollection: loadPromptCollectionInitial,
  setOwnerLocation: setPromptLocation,
  deleteCollection: deletePromptCollection,
  renameCollection: renamePromptCollection,
  deleteCategory,
  flush: submitAllPacedUpdateTransactionsAndWait,
  /** Reads a note after optimistic or authoritative reconciliation. */
  getNote: (id: string) => notesCollection.get(id),
  /** Reads collection ordering without introducing a note UI. */
  getCollection: (id: string) => promptCollectionsCollection.get(id),
  /** Reads owner metadata to assert timestamp and relationship isolation. */
  getOwner: (kind: 'prompt' | 'template', id: string) =>
    (kind === 'prompt' ? promptsCollection : promptTemplatesCollection).get(id),
  /** Deletes through existing renderer wrappers, including attached-note cleanup. */
  deleteOwner: (kind: 'prompt' | 'template', collectionId: string, id: string) =>
    (kind === 'prompt' ? deletePrompt : deletePromptTemplate)(collectionId, id),
  /** Renames an owner through its normal shared edit planner. */
  renameOwner: async (kind: 'prompt' | 'template', id: string, title: string): Promise<void> => {
    /** Full hydrated owner supplies unchanged body and metadata. */
    const owner = (kind === 'prompt' ? promptsCollection : promptTemplatesCollection).get(id)!
    /** Common editable fields supplied to the entity-specific planner. */
    const base = { contentId: id, title, fallbackTitle: owner.fallbackTitle, modifiedAt: getCurrentIsoSecondTimestamp() }
    if ('promptText' in owner) await runImmediateRendererDomainMutation({
      mutation: { command: { ...base, promptText: owner.promptText, ...(owner.templates !== undefined ? { templates: owner.templates } : {}) }, plan: planPromptUpdate },
      ipc: { channel: 'update-prompt' }, renderer: {}
    })
    else if ('templateText' in owner) await runImmediateRendererDomainMutation({
      mutation: { command: { ...base, templateText: owner.templateText }, plan: planPromptTemplateUpdate },
      ipc: { channel: 'update-prompt-template' }, renderer: {}
    })
  }
}
