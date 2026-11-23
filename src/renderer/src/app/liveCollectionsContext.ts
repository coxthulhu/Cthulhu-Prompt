import { getContext, setContext } from 'svelte'
import { useLiveQuery } from '@tanstack/svelte-db'
import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { noteClientStateCollection } from '@renderer/data/Collections/NoteClientStateCollection'
import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import {
  promptClientStateCollection,
  type PromptClientStateRecord
} from '@renderer/data/Collections/PromptClientStateCollection'
import {
  promptCollectionClientStateCollection,
  type PromptCollectionClientStateRecord
} from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import {
  promptTemplateClientStateCollection,
  type PromptTemplateClientStateRecord
} from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import type { Category } from '@shared/domain/category/Category'
import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { Prompt } from '@shared/domain/prompt/Prompt'
import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
import type { Workspace } from '@shared/domain/workspace/Workspace'

const LIVE_COLLECTIONS_CONTEXT = Symbol('live-collections')

/**
 * Subscribes once to every renderer collection that screens read in full. Each live query copies its whole
 * collection when it mounts, so screens share these instead of mounting their own on every tab switch.
 * Must be called during component initialization, since each live query registers a subscription effect.
 */
export const createLiveCollections = () => ({
  workspaces: useLiveQuery(workspaceCollection) as { data: Workspace[] },
  promptCollections: useLiveQuery(promptCollectionsCollection) as { data: PromptCollection[] },
  prompts: useLiveQuery(promptsCollection) as { data: Prompt[] },
  promptTemplates: useLiveQuery(promptTemplatesCollection) as { data: PromptTemplate[] },
  categories: useLiveQuery(categoryCollection) as { data: Category[] },
  promptClientStates: useLiveQuery(promptClientStateCollection) as { data: PromptClientStateRecord[] },
  promptTemplateClientStates: useLiveQuery(promptTemplateClientStateCollection) as {
    data: PromptTemplateClientStateRecord[]
  },
  promptCollectionClientStates: useLiveQuery(promptCollectionClientStateCollection) as {
    data: PromptCollectionClientStateRecord[]
  },
  notes: useLiveQuery(notesCollection),
  attachedNoteUiStates: useLiveQuery(attachedNoteUiStateCollection),
  noteClientStates: useLiveQuery(noteClientStateCollection)
})

export type LiveCollections = ReturnType<typeof createLiveCollections>

export const setLiveCollectionsContext = (value: LiveCollections): void => {
  setContext(LIVE_COLLECTIONS_CONTEXT, value)
}

export const getLiveCollectionsContext = (): LiveCollections => {
  return getContext<LiveCollections>(LIVE_COLLECTIONS_CONTEXT)
}
