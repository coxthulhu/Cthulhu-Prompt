<script module lang="ts">
  /** One complete retained category value submitted by the management dialog. */
  export type ManagedCategoryInput = {
    id: string
    displayName: string
    shortDescription: string | null
    description: string | null
  }

  /** Options supported by category-specific management entry points. */
  export type ManageCategoriesDialogOpenOptions = {
    categoryId?: string
    focusName?: boolean
  }
</script>

<script lang="ts">
  import { tick } from 'svelte'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Folder, FolderCog } from 'lucide-svelte'
  import type { Category } from '@shared/domain/category/Category'
  import {
    hasCategoryDisplayNameConflict,
    normalizeCategoryDisplayName,
    normalizeCategoryShortDescription
  } from '@shared/domain/category/Category'
  import { compactGuid } from '@shared/utilities/compactGuid'
  import type { PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'
  import type { Prompt } from '@shared/domain/prompt/Prompt'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import ManagementDialog from '@renderer/common/cthulhu-ui/dialogs/ManagementDialog.svelte'
  import type { ManagementSelectorPanelItem } from '@renderer/common/cthulhu-ui/selectors/ManagementSelectorPanel.svelte'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import ManagementDescriptionField from '../management/ManagementDescriptionField.svelte'
  import ManagementEditor from '../management/ManagementEditor.svelte'
  import ManagementTextField from '../management/ManagementTextField.svelte'

  /** Editable local copy of one existing or newly staged category. */
  type CategoryDraft = {
    id: string
    displayName: string
    shortDescription: string
    description: string
    hasInteracted: boolean
  }

  /** Inputs and persistence callback for category management. */
  type Props = {
    categories: Category[]
    collectionDisplayName: string
    contentKind: PromptCollectionContentKind
    isWorkspaceReady: boolean
    onsubmit: (categories: ManagedCategoryInput[]) => Promise<boolean>
  }

  /** Reactive collection inputs supplied by the sidebar or prompt-collection screen. */
  let {
    categories,
    collectionDisplayName,
    contentKind,
    isWorkspaceReady,
    onsubmit
  }: Props = $props()
  /** Loaded prompts used to count category membership across every status. */
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  /** Loaded templates used to count category membership in template collections. */
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as {
    data: PromptTemplate[]
  }
  /** Component-scoped identity prevents separate dialogs from sharing Monaco models. */
  const modelOwnerId = globalThis.crypto.randomUUID()
  /** Increasing identity gives every dialog opening fresh Monaco draft models. */
  let editorSessionId = $state(0)
  /** Controls whether the category management modal is visible. */
  let isDialogOpen = $state(false)
  /** Category values captured when the dialog opened for change detection. */
  let originalCategories = $state<Category[]>([])
  /** Retained editable category drafts in Active status-folder order followed by new drafts. */
  let drafts = $state<CategoryDraft[]>([])
  /** Currently selected category draft. */
  let selectedId = $state<string | null>(null)
  /** Name input of the selected draft, focused by rename and creation entry points. */
  let nameInput = $state<HTMLInputElement | null>(null)
  /** Prevents duplicate saves while category persistence is pending. */
  let isSubmitting = $state(false)
  /** General persistence failure displayed until the user edits or closes. */
  let submissionError = $state<string | null>(null)

  /** Currently selected retained draft. */
  const selectedDraft = $derived(
    drafts.find((draft) => draft.id === selectedId) ?? null
  )
  /** Singular category membership noun used by selector details. */
  const contentName = $derived(contentKind === 'template' ? 'template' : 'prompt')
  /** Total cross-status content membership indexed by category ID. */
  const contentCountByCategoryId = $derived.by<Record<string, number>>(() => {
    /** Content records for the active collection kind. */
    const content = contentKind === 'template' ? promptTemplateQuery.data : promptQuery.data
    /** Mutable count index assembled from loaded content metadata. */
    const counts: Record<string, number> = {}
    for (const entry of content) {
      if (!entry.category) continue
      counts[entry.category] = (counts[entry.category] ?? 0) + 1
    }
    return counts
  })
  /** Standard selector-panel items derived from retained drafts. */
  const selectorItems = $derived.by<ManagementSelectorPanelItem[]>(() =>
    drafts.map((draft) => {
      /** Total content count for this retained category. */
      const count = contentCountByCategoryId[draft.id] ?? 0
      return {
        id: draft.id,
        icon: Folder,
        text: normalizeCategoryDisplayName(draft.displayName) || 'New Category',
        detail: `${count} ${count === 1 ? contentName : `${contentName}s`}`
      }
    })
  )
  /** Validation message shown after the selected draft's name has been edited. */
  const selectedValidationMessage = $derived(
    !selectedDraft || !selectedDraft.hasInteracted || isSubmitting
      ? null
      : normalizeCategoryDisplayName(selectedDraft.displayName).length === 0
        ? 'Category name is required'
        : hasCategoryDisplayNameConflict(
              drafts,
              selectedDraft.displayName,
              selectedDraft.id
            )
          ? 'A category with this name already exists'
          : null
  )
  /** Whether every retained category name is present and collection-unique. */
  const areDraftsValid = $derived(
    drafts.every((draft, index) => {
      /** Normalized name participating in required and duplicate validation. */
      const name = normalizeCategoryDisplayName(draft.displayName)
      return (
        name.length > 0 &&
        !drafts.some(
          (candidate, candidateIndex) =>
            candidateIndex !== index &&
            normalizeCategoryDisplayName(candidate.displayName).toLocaleLowerCase() ===
              name.toLocaleLowerCase()
        )
      )
    })
  )
  /** Normalized retained categories ready for atomic persistence. */
  const normalizedDrafts = $derived<ManagedCategoryInput[]>(
    drafts.map((draft) => ({
      id: draft.id,
      displayName: normalizeCategoryDisplayName(draft.displayName),
      shortDescription: normalizeCategoryShortDescription(draft.shortDescription),
      description: draft.description.trim().length > 0 ? draft.description : null
    }))
  )
  /** Normalized opening snapshot used to disable no-op saves. */
  const normalizedOriginalCategories = $derived<ManagedCategoryInput[]>(
    originalCategories.map((category) => ({
      id: category.id,
      displayName: normalizeCategoryDisplayName(category.displayName),
      shortDescription: normalizeCategoryShortDescription(category.shortDescription),
      description: category.description?.trim().length ? category.description : null
    }))
  )
  /** Whether retained drafts differ from the opening category snapshot. */
  const hasChanges = $derived(
    JSON.stringify(normalizedDrafts) !== JSON.stringify(normalizedOriginalCategories)
  )
  /** Submission availability after workspace, change, and draft validation. */
  const canSubmit = $derived(
    isWorkspaceReady && !isSubmitting && hasChanges && areDraftsValid
  )

  /** Replaces transient dialog state with a fresh snapshot of authoritative categories. */
  const initializeDrafts = (): void => {
    originalCategories = categories.map((category) => ({ ...category }))
    drafts = categories.map((category) => ({
      id: category.id,
      displayName: category.displayName,
      shortDescription: category.shortDescription ?? '',
      description: category.description ?? '',
      hasInteracted: false
    }))
    submissionError = null
  }

  /** Focuses and selects the selected draft's name once its editor has rendered. */
  const focusName = async (): Promise<void> => {
    await tick()
    nameInput?.focus()
    nameInput?.select()
  }

  /** Opens category management to the requested category or the first retained category. */
  export const openDialog = (
    options: ManageCategoriesDialogOpenOptions = {}
  ): void => {
    if (!isWorkspaceReady) return
    initializeDrafts()
    editorSessionId += 1
    selectedId = options.categoryId && drafts.some((draft) => draft.id === options.categoryId)
      ? options.categoryId
      : (drafts[0]?.id ?? null)
    isDialogOpen = true
    if (options.focusName) void focusName()
  }

  /** Clears every unsaved category draft when the dialog closes. */
  const resetDialog = (): void => {
    isDialogOpen = false
    originalCategories = []
    drafts = []
    selectedId = null
    submissionError = null
  }

  /** Selects one retained draft without discarding edits to the previous draft. */
  const selectDraft = (categoryId: string): void => {
    selectedId = categoryId
    submissionError = null
  }

  /** Appends a new empty category draft and focuses its required name field. */
  const addDraft = (): void => {
    /** Stable client-generated category ID used by optimistic and main projections. */
    const categoryId = compactGuid(globalThis.crypto.randomUUID())
    drafts.push({
      id: categoryId,
      displayName: '',
      shortDescription: '',
      description: '',
      hasInteracted: false
    })
    selectedId = categoryId
    submissionError = null
    void focusName()
  }

  /** Stages selected-category deletion and selects the nearest retained draft. */
  const deleteSelectedDraft = (): void => {
    if (!selectedDraft) return
    /** Removed draft index used to prefer the next category, then the previous category. */
    const selectedIndex = drafts.findIndex((draft) => draft.id === selectedDraft.id)
    drafts.splice(selectedIndex, 1)
    selectedId = drafts[selectedIndex]?.id ?? drafts[selectedIndex - 1]?.id ?? null
    submissionError = null
  }

  /** Persists every retained draft through one atomic category mutation. */
  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    isSubmitting = true
    submissionError = null
    /** Whether the owning screen successfully persisted the complete draft set. */
    const didSave = await onsubmit(normalizedDrafts)
    if (didSave) resetDialog()
    else submissionError = 'Failed to save category changes. Please try again.'
    isSubmitting = false
  }

  /** Closes category management and discards all unsaved drafts. */
  const handleCancel = (): void => {
    if (!isSubmitting) resetDialog()
  }
</script>

<!-- collection category management dialog with retained multi-item drafts. -->
<ManagementDialog
  bind:open={isDialogOpen}
  icon={FolderCog}
  title="Manage Categories"
  subtitle={collectionDisplayName}
  listLabel="All Categories"
  items={selectorItems}
  {selectedId}
  addText="New Category"
  itemTestIdPrefix="manage-category-selector"
  addTestId="manage-categories-new-button"
  submitTestId="manage-categories-save-button"
  cancelTestId="manage-categories-close-button"
  {isSubmitting}
  {canSubmit}
  {submissionError}
  onselect={selectDraft}
  onadd={addDraft}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  {#if selectedDraft}
    {#key selectedDraft.id}
      <ManagementEditor
        icon={Folder}
        label={selectedDraft.displayName.trim() || 'New Category'}
        detail="Category settings"
        deleteLabel="Delete category"
        deleteTestId="manage-categories-delete-button"
        disabled={isSubmitting}
        ondelete={deleteSelectedDraft}
      >
        <ManagementTextField
          id="manage-category-name-input"
          title="Category Name"
          help="Required. Names must be unique in this collection."
          required
          bind:value={selectedDraft.displayName}
          bind:ref={nameInput}
          errorMessage={selectedValidationMessage}
          errorTestId="manage-category-name-error"
          disabled={isSubmitting}
          oninput={() => {
            selectedDraft.hasInteracted = true
          }}
        />
        <ManagementTextField
          id="manage-category-short-description-input"
          title="Short Description"
          help="A brief summary to help you recognize this category."
          bind:value={selectedDraft.shortDescription}
          disabled={isSubmitting}
        />
        <ManagementDescriptionField
          id="manage-category-full-description-input"
          help="Describe what belongs here and how to use these prompts."
          modelKey={`${modelOwnerId}-${editorSessionId}-${selectedDraft.id}`}
          bind:value={selectedDraft.description}
        />
      </ManagementEditor>
    {/key}
  {/if}
</ManagementDialog>
