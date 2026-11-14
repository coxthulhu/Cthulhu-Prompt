<script lang="ts">
  import { tick } from 'svelte'
  import { FolderKanban, Settings } from 'lucide-svelte'
  import { getProjectInfoErrors, type ProjectInfo } from '@shared/domain/workspace/Project'
  import type { Workspace } from '@shared/domain/workspace/Workspace'
  import { compactGuid } from '@shared/utilities/compactGuid'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import ManagementDialog from '@renderer/common/cthulhu-ui/dialogs/ManagementDialog.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { saveProjects } from '@renderer/data/Mutations/ProjectMutations'
  import ManagementDescriptionField from '../management/ManagementDescriptionField.svelte'
  import ManagementEditor from '../management/ManagementEditor.svelte'
  import ManagementTextField from '../management/ManagementTextField.svelte'

  /** Editable local copy of one existing or newly staged project. */
  type ProjectDraft = {
    id: string
    name: string
    abbreviation: string
    shortDescription: string
    description: string
    /** Validation for each required field appears only after the user edits it. */
    nameInteracted: boolean
    abbreviationInteracted: boolean
  }

  /** Workspace whose projects are managed; null while no workspace is open. */
  let { workspace }: { workspace: Workspace | null } = $props()

  /** Starter collections every new project receives when saved. */
  const NEW_PROJECT_COLLECTION_COUNT = 2
  /** Component-scoped identity prevents separate dialogs from sharing Monaco models. */
  const modelOwnerId = globalThis.crypto.randomUUID()
  /** Increasing identity gives every dialog opening fresh Monaco draft models. */
  let editorSessionId = $state(0)
  /** Controls whether the project management modal is visible. */
  let isDialogOpen = $state(false)
  /** Normalized project list captured when the dialog opened for change detection. */
  let originalProjectsJson = $state('')
  /** Retained editable project drafts in the order they will be saved. */
  let drafts = $state<ProjectDraft[]>([])
  /** Currently selected project draft. */
  let selectedId = $state<string | null>(null)
  /** New draft created by the activity bar's + button, opened after a successful save. */
  let navigateToProjectId = $state<string | null>(null)
  /** Existing project awaiting delete confirmation before its removal is staged. */
  let pendingDeleteId = $state<string | null>(null)
  /** Name input of the selected draft, focused when a new draft is added. */
  let nameInput = $state<HTMLInputElement | null>(null)
  /** Prevents duplicate saves while project persistence is pending. */
  let isSubmitting = $state(false)
  /** General persistence failure displayed until the user edits or closes. */
  let submissionError = $state<string | null>(null)

  /** Converts a draft into the normalized metadata that the planner persists. */
  const toProjectInfo = (draft: ProjectDraft): ProjectInfo => ({
    id: draft.id,
    name: draft.name.trim(),
    abbreviation: draft.abbreviation.trim().toUpperCase(),
    ...(draft.shortDescription.trim() ? { shortDescription: draft.shortDescription.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description } : {})
  })

  /** Normalized retained projects in submission order. */
  const projectInfos = $derived(drafts.map(toProjectInfo))
  /** Name and abbreviation errors for every draft against the complete retained list. */
  const draftErrors = $derived(projectInfos.map((info) => getProjectInfoErrors(info, projectInfos)))
  /** Currently selected retained draft. */
  const selectedDraft = $derived(drafts.find((draft) => draft.id === selectedId) ?? null)
  /** Validation errors belonging to the selected draft. */
  const selectedErrors = $derived(draftErrors[drafts.findIndex((draft) => draft.id === selectedId)])
  /** Existing project shown in the delete confirmation. */
  const pendingDeleteDraft = $derived(drafts.find((draft) => draft.id === pendingDeleteId) ?? null)
  /** Selector items showing each project's collection count, or the starter count for new drafts. */
  const selectorItems = $derived(
    drafts.map((draft) => {
      /** Saved collection count, or the starter collections a new project will receive. */
      const count = workspace?.projects.find((project) => project.id === draft.id)?.collectionEntries.length ??
        NEW_PROJECT_COLLECTION_COUNT
      return {
        id: draft.id,
        icon: FolderKanban,
        text: draft.name.trim() || 'New Project',
        detail: `${count} ${count === 1 ? 'collection' : 'collections'}`
      }
    })
  )
  /** Submission availability after workspace, change, and draft validation. */
  const canSubmit = $derived(
    workspace !== null && !isSubmitting &&
      JSON.stringify(projectInfos) !== originalProjectsJson &&
      draftErrors.every((errors) => !errors.name && !errors.abbreviation)
  )

  /** Creates an untouched draft from saved or blank project metadata. */
  const createDraft = (project: ProjectInfo): ProjectDraft => ({
    id: project.id,
    name: project.name,
    abbreviation: project.abbreviation,
    shortDescription: project.shortDescription ?? '',
    description: project.description ?? '',
    nameInteracted: false,
    abbreviationInteracted: false
  })

  /** Focuses the selected draft's name once its editor has rendered. */
  const focusName = async (): Promise<void> => {
    await tick()
    nameInput?.focus()
  }

  /** Appends an empty draft at the end, selects it, and focuses its name. */
  const addDraft = (): string => {
    /** Stable client-generated project ID used by optimistic and main projections. */
    const id = compactGuid(globalThis.crypto.randomUUID())
    drafts.push(createDraft({ id, name: '', abbreviation: '' }))
    selectedId = id
    submissionError = null
    void focusName()
    return id
  }

  /** Opens the dialog to one project, or to a new draft that is opened after saving when openCreatedProject is set. */
  export const openDialog = (options: { projectId?: string; createProject?: boolean; openCreatedProject?: boolean }): void => {
    if (!workspace) return
    drafts = workspace.projects.map(createDraft)
    originalProjectsJson = JSON.stringify(drafts.map(toProjectInfo))
    editorSessionId += 1
    submissionError = null
    selectedId = options.projectId ?? drafts[0]?.id ?? null
    isDialogOpen = true
    /** Draft appended and selected for a New Project button. */
    const createdDraftId = options.createProject ? addDraft() : null
    navigateToProjectId = options.openCreatedProject ? createdDraftId : null
  }

  /** Clears every unsaved project draft when the dialog closes. */
  const resetDialog = (): void => {
    isDialogOpen = false
    drafts = []
    selectedId = null
    navigateToProjectId = null
    pendingDeleteId = null
    submissionError = null
  }

  /** Selects one retained draft without discarding edits to the previous draft. */
  const selectDraft = (projectId: string): void => {
    selectedId = projectId
    submissionError = null
  }

  /** Stages a new project order without changing the selected draft. */
  const reorderDrafts = (projectIds: string[]): void => {
    drafts = projectIds.map((id) => drafts.find((draft) => draft.id === id)!)
    submissionError = null
  }

  /** Stages a draft's removal and selects the next project, then the previous one. */
  const removeDraft = (projectId: string): void => {
    /** Removed draft index used to choose the nearest retained selection. */
    const index = drafts.findIndex((draft) => draft.id === projectId)
    drafts.splice(index, 1)
    selectedId = drafts[index]?.id ?? drafts[index - 1]?.id ?? null
    submissionError = null
  }

  /** Removes new drafts immediately and asks before staging deletion of a saved project. */
  const deleteSelectedDraft = (): void => {
    if (!selectedDraft) return
    if (workspace?.projects.some((project) => project.id === selectedDraft.id)) pendingDeleteId = selectedDraft.id
    else removeDraft(selectedDraft.id)
  }

  /** Persists the complete retained list through one atomic project mutation. */
  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    isSubmitting = true
    submissionError = null
    /** Workspace and submitted values captured before the asynchronous save. */
    const workspaceId = workspace!.id
    const projects = projectInfos
    /** New project opened after saving, if the + button's draft was retained. */
    const openedProjectId = projects.some((project) => project.id === navigateToProjectId) ? navigateToProjectId : null
    const didSave = await runIpcBestEffort(
      async () => {
        await saveProjects(workspaceId, projects, openedProjectId)
        return true
      },
      () => false
    )
    if (didSave) resetDialog()
    else submissionError = 'Failed to save project changes. Please try again.'
    isSubmitting = false
  }

  /** Closes project management and discards all unsaved drafts. */
  const handleCancel = (): void => {
    if (!isSubmitting) resetDialog()
  }
</script>

<!-- Workspace project management with retained multi-item drafts saved as one batch. -->
<ManagementDialog
  bind:open={isDialogOpen}
  icon={Settings}
  title="Manage Projects"
  subtitle={workspace?.workspaceName ?? ''}
  listLabel="All Projects"
  items={selectorItems}
  {selectedId}
  addText="New Project"
  itemTestIdPrefix="manage-project-selector"
  addTestId="manage-projects-new-button"
  submitTestId="manage-projects-save-button"
  cancelTestId="manage-projects-close-button"
  dragHandleTestIdPrefix="manage-projects-drag-handle"
  {isSubmitting}
  {canSubmit}
  {submissionError}
  onselect={selectDraft}
  onadd={addDraft}
  onreorder={reorderDrafts}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  {#if selectedDraft}
    {#key selectedDraft.id}
      <ManagementEditor
        icon={FolderKanban}
        label={selectedDraft.name.trim() || 'New Project'}
        detail="Project settings"
        deleteLabel="Delete project"
        deleteTestId="manage-projects-delete-button"
        disabled={isSubmitting}
        ondelete={deleteSelectedDraft}
      >
        <ManagementTextField
          id="manage-project-name-input"
          title="Project Name"
          help="Required. Names must be unique in this workspace."
          required
          bind:value={selectedDraft.name}
          bind:ref={nameInput}
          errorMessage={selectedDraft.nameInteracted && !isSubmitting ? selectedErrors.name : null}
          errorTestId="manage-project-name-error"
          disabled={isSubmitting}
          oninput={() => {
            selectedDraft.nameInteracted = true
          }}
        />
        <ManagementTextField
          id="manage-project-abbreviation-input"
          title="Abbreviation"
          help="Required. Two letters or digits shown in the activity bar. Must be unique."
          required
          maxlength={2}
          bind:value={selectedDraft.abbreviation}
          errorMessage={selectedDraft.abbreviationInteracted && !isSubmitting ? selectedErrors.abbreviation : null}
          errorTestId="manage-project-abbreviation-error"
          disabled={isSubmitting}
          oninput={() => {
            selectedDraft.abbreviation = selectedDraft.abbreviation.toUpperCase()
            selectedDraft.abbreviationInteracted = true
          }}
        />
        <ManagementTextField
          id="manage-project-short-description-input"
          title="Short Description"
          help="A brief summary to help you recognize this project."
          bind:value={selectedDraft.shortDescription}
          disabled={isSubmitting}
        />
        <ManagementDescriptionField
          id="manage-project-full-description-input"
          help="Describe what this project covers and how its prompts are used."
          modelKey={`${modelOwnerId}-${editorSessionId}-${selectedDraft.id}`}
          bind:value={selectedDraft.description}
        />
      </ManagementEditor>
    {/key}
  {/if}
</ManagementDialog>

<ConfirmationDialog
  open={pendingDeleteDraft !== null}
  title="Delete Project"
  description="This project and all of its collections, prompts, and templates will be permanently deleted when you save your changes."
  confirmationText="Yes, I want to delete this project and all of its contents."
  confirmText="Delete project"
  confirmTestId="manage-projects-confirm-delete-button"
  oncancel={() => {
    pendingDeleteId = null
  }}
  onconfirm={() => {
    removeDraft(pendingDeleteId!)
    pendingDeleteId = null
  }}
/>
