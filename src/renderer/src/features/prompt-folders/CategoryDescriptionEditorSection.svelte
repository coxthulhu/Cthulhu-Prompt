<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Action } from 'svelte/action'
  import { createCategoryDescriptionModelUri, type monaco } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import {
    lookupWorkspacePersistedCategoryDescriptionEditorViewStateJson,
    setCategoryDescriptionEditorViewStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import EditorCardSection from '../prompt-editor/EditorCardSection.svelte'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import {
    MONACO_PADDING_PX,
    type PromptEditorSizingConfig
  } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { categoryDescriptionFindEntityId } from './promptFolderRowIds'
  import { PROMPT_FOLDER_FIND_CATEGORY_DESCRIPTION_SECTION_KEY } from './find/promptFolderFindSectionKeys'
  import {
    SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX,
    SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_TOP_PX,
    getCategoryDescriptionMonacoHeightFromRowPx,
    getCategoryDescriptionRowHeightPx,
    getCategoryDescriptionSizingConfig
  } from './categoryEditorSizing'

  /** Inputs and callbacks for the category description Monaco section. */
  type Props = {
    workspaceId: string | null
    categoryId: string
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    sectionHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    value: string
    focusAfterAdd?: boolean
    onHydrationChange?: (isHydrated: boolean) => void
    onDeleteRequestChange?: (requestDelete: (() => void) | null) => void
    onFocusAfterAddComplete?: () => void
    onDescriptionChange: (text: string, measurement: TextMeasurement) => void
    onDescriptionPresenceChange: (isPresent: boolean) => void
  }

  let {
    workspaceId,
    categoryId,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    sectionHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    value,
    focusAfterAdd = false,
    onHydrationChange,
    onDeleteRequestChange,
    onFocusAfterAddComplete,
    onDescriptionChange,
    onDescriptionPresenceChange
  }: Props = $props()

  /** Current renderer settings used to size Monaco text. */
  const systemSettings = getSystemSettingsContext()
  /** Monaco sizing derived from the configured prompt font size. */
  const sizingConfig: PromptEditorSizingConfig = $derived(
    getCategoryDescriptionSizingConfig(systemSettings.promptFontSize)
  )
  /** Prompt-folder screen find integration, when mounted inside that screen. */
  const findContext = getPromptFolderFindContext()
  /** Stable find entity ID for this category description. */
  const categoryFindEntityId = $derived(categoryDescriptionFindEntityId(categoryId))
  /** Reactive editor configuration for the selected category description. */
  const section = $derived({
    title: 'Category Description',
    description:
      'A general description of this category and the types of prompts that are within it. For informational use only.',
    deleteLabel: 'category description',
    findSectionKey: PROMPT_FOLDER_FIND_CATEGORY_DESCRIPTION_SECTION_KEY,
    value,
    modelUri: createCategoryDescriptionModelUri(categoryId),
    initialViewStateJson: workspaceId
      ? lookupWorkspacePersistedCategoryDescriptionEditorViewStateJson(workspaceId, categoryId)
      : null,
    viewStateCaptureKey: `category-description:${categoryId}`
  })
  /** Monaco placeholder height derived from the virtual section row. */
  const placeholderMonacoHeightPx = $derived(
    Math.max(0, getCategoryDescriptionMonacoHeightFromRowPx(sectionHeightPx))
  )

  /** Root category-description section element. */
  let sectionElement = $state<HTMLElement | null>(null)
  /** Clickable body surrounding the Monaco editor. */
  let editorBodyElement = $state<HTMLDivElement | null>(null)
  /** Monaco overflow widget host synchronized with the overlay row. */
  let overflowHost = $state<HTMLDivElement | null>(null)
  /** Padding host used to align Monaco overflow widgets. */
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  /** Active Monaco editor for this category description. */
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  /** Whether this category description editor is hydrated. */
  let isHydrated = $state(false)
  /** Immediate hydration request supplied by the hydratable editor. */
  let requestImmediateHydration = $state<(() => Promise<void>) | null>(null)
  /** Reveals one find match inside the hydrated category description. */
  let revealSectionMatch = $state<((query: string, matchIndex: number) => number | null) | null>(
    null
  )
  /** Whether category description deletion confirmation is open. */
  let isDeleteDialogOpen = $state(false)
  /** Prevents deletion from recapturing obsolete Monaco view state. */
  let suppressViewStateCapture = false
  /** Whether focus should move to Monaco after adding the description. */
  let focusAfterAddPending = $state(false)

  // Side effect: keep the Monaco overflow host aligned to this section's editor body.
  $effect(() => {
    let padding = `${SETTINGS_EDITOR_SECTION_PADDING_TOP_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX}px`
    if (overlayRowElement && editorBodyElement) {
      const rowRect = overlayRowElement.getBoundingClientRect()
      const bodyRect = editorBodyElement.getBoundingClientRect()
      const verticalInsetPx = MONACO_PADDING_PX / 2
      const topPx = Math.max(
        0,
        bodyRect.top - rowRect.top + SETTINGS_EDITOR_SECTION_PADDING_TOP_PX + verticalInsetPx
      )
      const rightPx = Math.max(
        0,
        rowRect.right - bodyRect.right + SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX
      )
      const bottomPx = Math.max(
        0,
        rowRect.bottom -
          bodyRect.bottom +
          SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX +
          verticalInsetPx
      )
      const leftPx = Math.max(
        0,
        bodyRect.left - rowRect.left + SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX
      )
      padding = `${topPx}px ${rightPx}px ${bottomPx}px ${leftPx}px`
    }

    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
  })

  /** Current find request scoped to this category description. */
  const findRequest = $derived.by<PromptFolderFindRequest | null>(() => {
    if (!findContext) return null
    const activeMatch =
      findContext.currentMatch?.entityId === categoryFindEntityId
        ? findContext.currentMatch
        : null

    return {
      isOpen: findContext.isFindOpen,
      query: findContext.query,
      activeSectionKey: activeMatch?.sectionKey ?? null,
      activeSectionMatchIndex: activeMatch?.sectionMatchIndex ?? null,
      shouldSelectActiveMatch: findContext.shouldSelectCurrentMatch
    }
  })

  /** Persists this category description's Monaco view state. */
  const setViewState = (viewStateJson: string | null) => {
    if (!workspaceId || suppressViewStateCapture) return
    setCategoryDescriptionEditorViewStateWithAutosave(workspaceId, categoryId, viewStateJson)
  }

  /** Reports category description hydration to the row and find context. */
  const handleHydrationChange = (nextIsHydrated: boolean) => {
    isHydrated = nextIsHydrated
    onHydrationChange?.(nextIsHydrated)
  }

  /** Tracks the active Monaco instance during hydration changes. */
  const handleEditorLifecycle = (
    activeEditor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      editor = activeEditor
    } else if (editor === activeEditor) {
      editor = null
    }
  }

  /** Requests immediate category description hydration when needed. */
  const ensureHydrated = async (): Promise<boolean> => {
    if (isHydrated) return true
    // Side effect: wait for immediate hydration to mount and activate Monaco.
    await requestImmediateHydration?.()
    return isHydrated
  }

  /** Focuses Monaco when the user clicks unused description body space. */
  const focusEditorFromBodyClick = async (event: MouseEvent) => {
    if (section.value === null) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.monaco-editor')) return
    if (!editor) {
      await ensureHydrated()
    }

    // Side effect: wait for click-triggered hydration before focusing the settings editor.
    await tick()
    editor?.focus()
  }

  // Side effect: hydrate and focus the editor after its toolbar toggle adds the setting.
  $effect(() => {
    if (!focusAfterAddPending) return
    if (!editor) {
      void requestImmediateHydration?.()
      return
    }

    focusAfterAddPending = false
    editor.focus()
    onFocusAfterAddComplete?.()
  })

  /** Removes the category description and its persisted editor view state. */
  const performDelete = () => {
    isDeleteDialogOpen = false
    suppressViewStateCapture = true
    editor?.setValue('')
    if (workspaceId) {
      setCategoryDescriptionEditorViewStateWithAutosave(workspaceId, categoryId, null)
    }
    findContext?.reportSectionTextChange(
      categoryFindEntityId,
      section.findSectionKey,
      ''
    )
    onDescriptionPresenceChange(false)
  }

  /** Deletes an empty description immediately or confirms nonempty deletion. */
  const handleDeleteClick = () => {
    if ((section.value ?? '').trim().length > 0) {
      isDeleteDialogOpen = true
      return
    }

    performDelete()
  }

  // Side effect: expose this mounted editor's existing delete workflow to its toolbar toggle.
  onMount(() => {
    focusAfterAddPending = focusAfterAdd
    onDeleteRequestChange?.(handleDeleteClick)
    return () => onDeleteRequestChange?.(null)
  })

  /** Svelte action that delegates category description body clicks to Monaco focus. */
  const focusEditorBodyClickAction: Action<HTMLDivElement, unknown> = (node) => {
    const handleClick = (event: MouseEvent) => {
      void focusEditorFromBodyClick(event)
    }

    node.addEventListener('click', handleClick)

    return {
      destroy() {
        node.removeEventListener('click', handleClick)
      }
    }
  }

  // Side effect: register this settings section with find navigation.
  onMount(() => {
    if (!findContext) return
    const handle: PromptFolderFindRowHandle = {
      entityId: categoryFindEntityId,
      rowId,
      isHydrated: () => isHydrated,
      requestHydration: () => {
        void ensureHydrated()
      },
      shouldEnsureHydratedForSection: (sectionKey) => sectionKey === section.findSectionKey,
      isSectionReady: (sectionKey) =>
        sectionKey === section.findSectionKey && editor !== null && revealSectionMatch !== null,
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        if (sectionKey !== section.findSectionKey) return null
        return revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: () => null
    }
    return findContext.registerRow(handle)
  })

  // Side effect: focus the matched settings editor after the find widget closes.
  $effect(() => {
    if (!findContext) return
    const request = findContext.focusRequests.pending
    if (!request) return
    const focusTarget = request.payload
    if (
      focusTarget.entityId !== categoryFindEntityId ||
      focusTarget.sectionKey !== section.findSectionKey
    ) {
      return
    }
    if (!sectionElement || !editor) return
    findContext.focusRequests.consume(request, ({ selection }) => {
      const targetEditor = editor!
      const model = targetEditor.getModel()
      if (selection && model) {
        const start = model.getPositionAt(selection.startOffset)
        const end = model.getPositionAt(selection.endOffset)
        targetEditor.setSelection({
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        })
      }
      targetEditor.focus()
    })
  })
</script>

<EditorCardSection
  bind:sectionElement
  class="category-description-editor-card-section"
  title={section.title}
  description={section.description}
  testId="category-description-section"
>
  <div
    bind:this={editorBodyElement}
    class="category-description-editor-section"
    style={`padding:${SETTINGS_EDITOR_SECTION_PADDING_TOP_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX}px;`}
    use:focusEditorBodyClickAction
  >
    {#if overflowHost}
      {#key categoryId}
        <HydratableMonacoEditor
          class="bg-[var(--ui-editor-content-surface)]"
          initialValue={section.value}
          initialViewStateJson={section.initialViewStateJson}
          viewStateCaptureKey={section.viewStateCaptureKey}
          modelUri={section.modelUri}
          containerWidthPx={virtualWindowWidthPx}
          placeholderHeightPx={placeholderMonacoHeightPx}
          overflowWidgetsDomNode={overflowHost}
          {sizingConfig}
          {hydrationPriority}
          {shouldDehydrate}
          {rowId}
          {scrollToWithinWindowBand}
          onEditorLifecycle={handleEditorLifecycle}
          findSectionKey={section.findSectionKey}
          {findRequest}
          onFindMatchReveal={(handler) => {
            revealSectionMatch = handler
          }}
          onSelectionChange={(startOffset, endOffset) => {
            findContext?.reportSelection({
              entityId: categoryFindEntityId,
              sectionKey: section.findSectionKey,
              startOffset,
              endOffset
            })
          }}
          onImmediateHydrationRequest={(request) => {
            requestImmediateHydration = request
          }}
          onViewStateCapture={setViewState}
          onHydrationChange={handleHydrationChange}
          onChange={(text, meta) => {
            onDescriptionChange(text, {
              measuredHeightPx: getCategoryDescriptionRowHeightPx(meta.heightPx),
              widthPx: virtualWindowWidthPx,
              devicePixelRatio
            })
            findContext?.reportSectionTextChange(
              categoryFindEntityId,
              section.findSectionKey,
              text,
              meta.selection
            )
          }}
        />
      {/key}
    {:else}
      <MonacoEditorPlaceholder
        class="bg-[var(--ui-editor-content-surface)]"
        heightPx={placeholderMonacoHeightPx}
        {sizingConfig}
      />
    {/if}
  </div>
</EditorCardSection>

<ConfirmationDialog
  bind:open={isDeleteDialogOpen}
  title={`Delete ${section.title}`}
  description={`Are you sure you want to delete this ${section.deleteLabel}?`}
  confirmText="Delete"
  confirmTestId="category-description-confirm-delete"
  oncancel={() => {
    isDeleteDialogOpen = false
  }}
  onconfirm={performDelete}
/>

<style>
  .category-description-editor-section {
    background: var(--ui-editor-content-surface);
    box-sizing: border-box;
    min-width: 0;
  }

  :global(.category-description-editor-card-section .editor-card-section-header) {
    color: var(--ui-normal-text);
    font-size: 14px;
    line-height: 18px;
  }
</style>
