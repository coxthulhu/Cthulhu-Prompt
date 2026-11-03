<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { X } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import type { ScrollToWithinWindowBand } from '@renderer/common/virtual-window/virtualWindowTypes'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    getPromptNavigationContext,
    promptIdToPromptNavigationRow,
    type PromptNavigationRow
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { promptCollectionClientStateCollection } from '@renderer/data/Collections/PromptCollectionClientStateCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
  import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { notesCollection } from '@renderer/data/Collections/NotesCollection'
  import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
  import { noteClientStateCollection } from '@renderer/data/Collections/NoteClientStateCollection'
  import { loadPromptCollectionInitial } from '@renderer/data/Queries/PromptCollectionQuery'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { getPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
  import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
  import {
    getPromptStatusFolderDefinition,
    isPromptFull,
    PROMPT_STATUS_FOLDER_REGISTRY,
    PromptStatus
  } from '@shared/domain/prompt/Prompt'
  import { isPromptTemplateFull, PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
  import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
  import { createPromptTreePromptDragController } from '@renderer/features/prompt-tree/promptTreeDrag'
  import type { CollectionSidebarModeData } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import PromptEditor from '../prompt-editor/PromptEditor.svelte'
  import PromptTemplateEditor from '../prompt-editor/PromptTemplateEditor.svelte'
  import PromptCopyWorkflow from '../prompt-editor/PromptCopyWorkflow.svelte'
  import {
    buildPromptDraftRecord,
    buildTemplateDraftRecord
  } from '../prompt-editor/markdownContentDraftRecord'
  import type { AttachedNoteLayout } from '../prompt-editor/attachedNoteSizing'
  import PromptCollectionFindIntegration from './find/PromptCollectionFindIntegration.svelte'
  import {
    PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
    PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY
  } from './find/promptCollectionFindSectionKeys'
  import PromptCollectionHeaderBar from './PromptCollectionHeaderBar.svelte'
  import { promptEditorRowId } from './promptCollectionRowIds'
  import { deleteMarkdownContent, setMarkdownContentStatus } from './markdownContentActions'
  import {
    PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX,
    PROMPT_COLLECTION_VERTICAL_BIAS_PX
  } from './promptCollectionScrollOffsets'

  /** Full-screen editor for one prompt or template, shown beside the unchanged collection sidebar. */
  let { sidebarModeData }: {
    /** Project mode state that owns the open prompt, its collection, and its status group. */
    sidebarModeData: CollectionSidebarModeData
  } = $props()

  /** Collection and prompt fixed for this keyed screen instance, which remounts when either changes. */
  const collectionId = untrack(() => sidebarModeData.collectionId!)
  const promptId = untrack(() => sidebarModeData.openPromptId!)
  /** Virtual-row identity reused by find and Monaco cursor measurements. */
  const rowId = promptEditorRowId(promptId)
  const workspaceId = getWorkspaceSelectionContext().selectedWorkspaceId!
  const promptNavigation = getPromptNavigationContext()

  const collectionQuery = useLiveQuery(promptCollectionsCollection)
  const promptQuery = useLiveQuery(promptsCollection)
  const templateQuery = useLiveQuery(promptTemplatesCollection)
  const promptClientStateQuery = useLiveQuery(promptClientStateCollection)
  const templateClientStateQuery = useLiveQuery(promptTemplateClientStateCollection)
  const categoryQuery = useLiveQuery(categoryCollection)
  const noteQuery = useLiveQuery(notesCollection)
  const noteVisibilityQuery = useLiveQuery(attachedNoteUiStateCollection)
  const noteClientStateQuery = useLiveQuery(noteClientStateCollection)

  /** Whether this collection's full content is loaded, including after a restart into this screen. */
  let isLoaded = $state(promptCollectionClientStateCollection.get(collectionId)?.hasLoadedInitialData ?? false)
  /** Measured editor area that the screen-layout editor fills. */
  let editorAreaWidthPx = $state(0)
  let editorAreaHeightPx = $state(0)
  /** Template selection and copy confirmation shared with the collection screen. */
  let copyWorkflow = $state<PromptCopyWorkflow | null>(null)

  const collection = $derived(collectionQuery.data.find((candidate) => candidate.id === collectionId) ?? null)
  const isTemplateCollection = $derived(collection?.kind === 'template')
  /** Full prompt or template, or null while unloaded or after deletion. */
  const content = $derived.by(() => {
    if (isTemplateCollection) {
      const template = templateQuery.data.find((candidate) => candidate.id === promptId)
      return template && isPromptTemplateFull(template) ? template : null
    }
    const prompt = promptQuery.data.find((candidate) => candidate.id === promptId)
    return prompt && isPromptFull(prompt) ? prompt : null
  })
  /** Whether the content still belongs to this collection. */
  const isInCollection = $derived(
    collection !== null && getMarkdownContentIds(collection, collection.kind).includes(promptId)
  )
  /** Content can be shown only while it is loaded and still in this collection. */
  const isOpenable = $derived(isLoaded && content !== null && isInCollection)
  const status = $derived(content?.status ?? (isTemplateCollection ? PromptTemplateStatus.Active : PromptStatus.Todo))
  /** Status group currently owning the content. */
  const statusFolder = $derived(getPromptStatusFolderDefinition(status))
  /** Category owning the content in its status group, or null when uncategorized. */
  const categoryId = $derived(
    // The collection and content are read so category moves recompute this location.
    isOpenable && collection && content ? getPromptLocation(collection.id, content.id).categoryId : null
  )
  const categoryLabel = $derived(
    categoryId ? (categoryQuery.data.find((category) => category.id === categoryId)?.displayName ?? null) : null
  )
  /** Canonical template titles used to label a prompt's template selection. */
  const templateTitleById = $derived(
    Object.fromEntries(templateQuery.data.map((template) => [template.id, getPromptDisplayTitle(template)]))
  )
  /** Full template text applied when copying a prompt. */
  const promptTemplateTextById = $derived(
    Object.fromEntries(
      templateQuery.data.flatMap((template) => (isPromptTemplateFull(template) ? [[template.id, template.templateText]] : []))
    )
  )
  /** Editor view model for the open content. */
  const draft = $derived.by(() => {
    if (!content) return null
    if ('templateText' in content) {
      return buildTemplateDraftRecord(
        content,
        templateClientStateQuery.data.find((state) => state.id === promptId)?.isEdited ?? false
      )
    }
    return buildPromptDraftRecord(
      content,
      templateTitleById,
      promptClientStateQuery.data.find((state) => state.id === promptId)?.isEdited ?? false
    )
  })
  /** Attached note with its persisted visibility shared with the collection screen. */
  const attachment = $derived.by((): AttachedNoteLayout | undefined => {
    const note = noteQuery.data.find((candidate) => candidate.id === draft?.attachedNoteId)
    if (note?.kind !== 'attached') return undefined
    return {
      note,
      visible: noteVisibilityQuery.data.find(
        (state) => state.workspaceId === workspaceId && state.noteId === note.id
      )?.visible ?? false,
      isEdited: noteClientStateQuery.data.find((state) => state.id === note.id)?.isEdited ?? false,
      // The screen layout sizes the note itself, so no content-based height is reserved.
      editorHeightPx: 0
    }
  })
  const ContentEditor = $derived(isTemplateCollection ? PromptTemplateEditor : PromptEditor)
  const promptDragController = createPromptTreePromptDragController({
    getPromptCollections: () => collectionQuery.data
  })

  /** Selects one collection-screen row with a reveal, which also closes this screen. */
  const navigateToCollectionRow = (contentOwnerId: string, row: PromptNavigationRow): void => {
    promptNavigation.select({
      screenCollectionId: collectionId,
      contentOwnerId,
      row,
      source: 'header',
      forceRequest: true,
      contentReveal: {
        scrollType: 'vertical-bias',
        verticalBiasPx: row.startsWith('prompt:')
          ? PROMPT_COLLECTION_VERTICAL_BIAS_PX
          : PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
      }
    })
  }

  /** Runs a find measurement once the editor is ready; Monaco reveals the match within its own viewport. */
  const revealFindMatch: ScrollToWithinWindowBand = (_rowId, offset) => {
    /** Pending retry frame while the target section hydrates. */
    let frameId = 0
    const attempt = (): void => {
      if (typeof offset === 'number' || offset() !== null) return
      frameId = window.requestAnimationFrame(attempt)
    }
    attempt()
    return () => window.cancelAnimationFrame(frameId)
  }

  // Side effect: load the collection when this screen is restored before the collection view loaded it.
  onMount(() => {
    if (isLoaded) return
    void runIpcBestEffort(
      async () => {
        await loadPromptCollectionInitial(workspaceId, collectionId)
        isLoaded = true
      },
      () => sidebarModeData.closeOpenPrompt()
    )
  })

  // Side effect: return to the collection view once the content is deleted, finalized, or moved away.
  $effect(() => {
    if (isLoaded && (!isOpenable || statusFolder.ordering === 'finalizedAt')) sidebarModeData.closeOpenPrompt()
  })

  // Side effect: keep the sidebar's status group and highlighted row on the content as it moves.
  $effect(() => {
    if (!isOpenable || statusFolder.ordering !== 'category') return
    const groupId = statusFolder.id
    const contentOwnerId = categoryId ?? collectionId
    untrack(() => {
      if (groupId !== sidebarModeData.screenMode) sidebarModeData.followOpenPromptGroup(groupId)
      promptNavigation.select({
        screenCollectionId: collectionId,
        contentOwnerId,
        row: promptIdToPromptNavigationRow(promptId),
        source: 'editor-interaction',
        forceRequest: true,
        treeExpansion: 'owner'
      })
    })
  })

  // Side effect: leave this screen when sidebar or path navigation asks the collection view to reveal a row.
  $effect(() => {
    if (promptNavigation.contentRevealRequests.pending?.payload.screenCollectionId === collectionId) {
      sidebarModeData.closeOpenPrompt()
    }
  })
</script>

<PromptCollectionFindIntegration
  items={draft
    ? [{
        entityId: promptId,
        rowId,
        sections: [
          { key: PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY, text: draft.title },
          { key: PROMPT_COLLECTION_FIND_BODY_SECTION_KEY, text: draft.text }
        ]
      }]
    : []}
  scrollToWithinWindowBand={revealFindMatch}
>
  {#snippet children(findControls)}
    <main class="relative flex min-h-0 flex-1 flex-col" data-testid="single-prompt-screen">
      <PromptCollectionHeaderBar
        isReady={isOpenable && draft !== null}
        segments={[
          {
            label: collection?.displayName ?? '',
            testId: 'prompt-collection-header-collection',
            onclick: () => navigateToCollectionRow(collectionId, 'collection-header')
          },
          {
            label: PROMPT_STATUS_FOLDER_REGISTRY[statusFolder.id].label,
            testId: 'prompt-collection-header-section',
            onclick: () => navigateToCollectionRow(collectionId, 'collection-header')
          },
          ...(categoryId && categoryLabel
            ? [{
                label: categoryLabel,
                testId: 'prompt-collection-header-category',
                onclick: () => navigateToCollectionRow(categoryId, 'category-details')
              }]
            : []),
          {
            label: draft ? getPromptDisplayTitle(draft) : '',
            testId: 'prompt-collection-header-prompt',
            onclick: () => navigateToCollectionRow(categoryId ?? collectionId, promptIdToPromptNavigationRow(promptId))
          }
        ]}
        findLabel={`Find in ${isTemplateCollection ? 'Template' : 'Prompt'} (Control + F)`}
        onFind={findControls.toggleFindDialog}
      >
        {#snippet pathActions()}
          <IconButton
            icon={X}
            iconSize={18}
            label="Return to collection view"
            title="Return to collection view"
            size="compact"
            baseVariant="muted"
            hoverVariant="glyph"
            testId="single-prompt-return-button"
            onclick={sidebarModeData.closeOpenPrompt}
          />
        {/snippet}
      </PromptCollectionHeaderBar>

      <div
        class="min-h-0 flex-1"
        bind:clientWidth={editorAreaWidthPx}
        bind:clientHeight={editorAreaHeightPx}
      >
        {#if isOpenable && draft && editorAreaHeightPx > 0}
          <ContentEditor
            layout="screen"
            onClose={sidebarModeData.closeOpenPrompt}
            {workspaceId}
            screenCollectionId={collectionId}
            promptCollectionId={collectionId}
            {promptId}
            {attachment}
            promptDraftRecord={draft}
            {rowId}
            virtualWindowWidthPx={editorAreaWidthPx}
            devicePixelRatio={window.devicePixelRatio}
            rowHeightPx={editorAreaHeightPx}
            hydrationPriority={0}
            shouldDehydrate={false}
            copyTemplateTexts={copyWorkflow?.getCopyTemplateTexts(draft.templates) ?? []}
            screenMode={statusFolder.id}
            {status}
            finalizedAt={content?.finalizedAt ?? null}
            isFirstPrompt
            isLastPrompt
            onDelete={() => deleteMarkdownContent(collectionId, promptId)}
            onArchive={() =>
              setMarkdownContentStatus(
                collectionId,
                promptId,
                isTemplateCollection ? PromptTemplateStatus.Archived : PromptStatus.Archived
              )}
            onTemplateSelect={isTemplateCollection
              ? undefined
              : () => copyWorkflow?.openTemplateSelection(promptId, 'select')}
            onTemplateSelectAndCopy={isTemplateCollection
              ? undefined
              : () => copyWorkflow?.openTemplateSelection(promptId, 'select-and-copy')}
            onCopySuccess={isTemplateCollection ? undefined : () => copyWorkflow?.handlePromptCopySuccess(promptId)}
            onBeforeCopy={isTemplateCollection ? undefined : () => copyWorkflow!.confirmPromptCopy(promptId)}
            onStatusChange={isTemplateCollection
              ? undefined
              : (nextStatus) => setMarkdownContentStatus(collectionId, promptId, nextStatus)}
            onMoveUp={() => Promise.resolve(false)}
            onMoveDown={() => Promise.resolve(false)}
            onPromptTreeDrop={(dropPayload) =>
              promptDragController.handleDragFinish({
                sourcePayload: {
                  fromId: promptId,
                  location: getPromptLocation(collectionId, promptId),
                  contentKind: collection!.kind
                },
                dropPayload
              })}
          />
        {/if}
      </div>
    </main>
  {/snippet}
</PromptCollectionFindIntegration>

<PromptCopyWorkflow
  bind:this={copyWorkflow}
  {workspaceId}
  {isTemplateCollection}
  promptDraftById={draft ? { [promptId]: draft } : {}}
  {promptTemplateTextById}
  getStatus={() => status}
  onSetPromptStatus={(_promptId, nextStatus) => setMarkdownContentStatus(collectionId, promptId, nextStatus)}
/>
