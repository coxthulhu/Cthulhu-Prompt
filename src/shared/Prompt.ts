export enum PromptStatus {
  Todo = 'Todo',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Archived = 'Archived'
}

/** Stable identifier for one code-defined prompt status folder. */
export enum PromptStatusFolderId {
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived'
}

/** Ordering behavior owned by one prompt status folder. */
export type PromptStatusFolderOrdering = 'category' | 'finalizedAt'

/** Code-defined metadata that maps prompt statuses to one physical status folder. */
export type PromptStatusFolderDefinition = {
  id: PromptStatusFolderId
  directoryName: string
  statuses: readonly PromptStatus[]
  ordering: PromptStatusFolderOrdering
  isFinal: boolean
}

/** Extensible registry of prompt status folders and their ordering behavior. */
export const PROMPT_STATUS_FOLDER_REGISTRY = {
  [PromptStatusFolderId.Active]: {
    id: PromptStatusFolderId.Active,
    directoryName: 'Active',
    statuses: [PromptStatus.Todo, PromptStatus.InProgress],
    ordering: 'category',
    isFinal: false
  },
  [PromptStatusFolderId.Completed]: {
    id: PromptStatusFolderId.Completed,
    directoryName: 'Completed',
    statuses: [PromptStatus.Completed],
    ordering: 'finalizedAt',
    isFinal: true
  },
  [PromptStatusFolderId.Archived]: {
    id: PromptStatusFolderId.Archived,
    directoryName: 'Archived',
    statuses: [PromptStatus.Archived],
    ordering: 'finalizedAt',
    isFinal: true
  }
} as const satisfies Record<PromptStatusFolderId, PromptStatusFolderDefinition>

/** Status-folder definitions retained in their code-defined display order. */
export const PROMPT_STATUS_FOLDERS = Object.values(PROMPT_STATUS_FOLDER_REGISTRY)

/** Reports whether an unknown value is one stable prompt status-folder identity. */
export const isPromptStatusFolderId = (value: unknown): value is PromptStatusFolderId =>
  PROMPT_STATUS_FOLDERS.some((statusFolder) => statusFolder.id === value)

/** Reports whether an unknown value is one of the code-defined prompt statuses. */
export const isPromptStatus = (value: unknown): value is PromptStatus =>
  PROMPT_STATUS_FOLDERS.some((statusFolder) =>
    (statusFolder.statuses as readonly unknown[]).includes(value)
  )

/** Returns the status-folder definition that owns one prompt status. */
export const getPromptStatusFolderDefinition = (
  status: PromptStatus
): PromptStatusFolderDefinition => {
  /** Registry entry whose status set contains the requested status. */
  const definition = PROMPT_STATUS_FOLDERS.find((candidate) =>
    (candidate.statuses as readonly PromptStatus[]).includes(status)
  )
  if (!definition) throw new Error(`Prompt status folder not found: ${status}`)
  return definition
}

/** Reports whether one prompt status is final. */
export const isFinalPromptStatus = (status: PromptStatus): boolean =>
  getPromptStatusFolderDefinition(status).isFinal

// Ordered reference to a prompt template selected for a prompt.
export type PromptTemplateReference = {
  id: string
}

export type PromptSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  templates?: PromptTemplateReference[] | null
  status: PromptStatus
  finalizedAt?: string
  loadingState: 'summary'
}

export type PromptFull = {
  id: string
  title: string
  createdAt: string
  modifiedAt: string
  category?: string
  promptText: string
  fallbackTitle: string
  templates?: PromptTemplateReference[] | null
  status: PromptStatus
  finalizedAt?: string
  loadingState: 'full'
}

export type Prompt = PromptSummary | PromptFull

// Prompt data as stored on disk and sent through prompt mutations.
export type PromptPersisted = Omit<PromptFull, 'loadingState'>

// Prompt data loaded during workspace bootstrap for tree/title hydration.
export type PromptSummaryData = Pick<
  PromptPersisted,
  | 'id'
  | 'title'
  | 'fallbackTitle'
  | 'modifiedAt'
  | 'category'
  | 'templates'
  | 'status'
  | 'finalizedAt'
>

export const createPromptSummary = (prompt: PromptSummaryData): PromptSummary => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  modifiedAt: prompt.modifiedAt,
  ...(prompt.category !== undefined ? { category: prompt.category } : {}),
  ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
  status: prompt.status,
  ...(isFinalPromptStatus(prompt.status) && prompt.finalizedAt
    ? { finalizedAt: prompt.finalizedAt }
    : {}),
  loadingState: 'summary'
})

export const createPromptFull = (prompt: PromptPersisted): PromptFull => ({
  id: prompt.id,
  title: prompt.title,
  createdAt: prompt.createdAt,
  modifiedAt: prompt.modifiedAt,
  ...(prompt.category !== undefined ? { category: prompt.category } : {}),
  promptText: prompt.promptText,
  fallbackTitle: prompt.fallbackTitle,
  ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
  status: prompt.status,
  ...(isFinalPromptStatus(prompt.status) && prompt.finalizedAt
    ? { finalizedAt: prompt.finalizedAt }
    : {}),
  loadingState: 'full'
})

export const isPromptFull = (prompt: Prompt): prompt is PromptFull => {
  return prompt.loadingState === 'full'
}

/** Exact category-order placement used when a prompt enters the ordered tree. */
export type PromptCategoryOrderPlacement = {
  categoryId: string | null
  previousEntryId: string | null
}
