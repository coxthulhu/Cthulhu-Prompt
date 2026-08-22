<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { SvelteSet } from 'svelte/reactivity'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    workspacePersistenceDraftCollection,
    type WorkspacePersistenceDraftRecord
  } from '@renderer/data/Collections/WorkspacePersistenceDraftCollection'
  import { setAccordionExpandedSectionIdsWithAutosave } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import { setAccordionContext, type AccordionContext } from './accordionContext'
  import { mergeClasses } from './mergeClasses'

  /** Public properties for the workspace-persisted weighted accordion. */
  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    persistenceId: string
    children: Snippet
    class?: string
    testId?: string
  }

  /** Component inputs and remaining root element attributes. */
  let {
    persistenceId,
    children,
    class: className,
    testId,
    ...restProps
  }: Props = $props()

  /** Reactive workspace owner used to scope persisted expansion state. */
  const workspaceSelection = getWorkspaceSelectionContext()
  /** Reactive workspace-persistence drafts rendered by this component. */
  const workspacePersistenceQuery = useLiveQuery(workspacePersistenceDraftCollection) as {
    data: WorkspacePersistenceDraftRecord[]
  }
  /** Section IDs registered in rendered order by descendant AccordionSection components. */
  let sectionIds = $state<string[]>([])
  /** Saved expanded IDs, or null before this accordion has persisted state. */
  const persistedExpandedSectionIds = $derived.by(() => {
    /** Currently selected workspace that owns this accordion state. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    /** Loaded workspace draft containing accordion view entries. */
    const workspacePersistence = workspacePersistenceQuery.data.find(
      (candidate) => candidate.id === workspaceId
    )
    /** Saved entry isolated by this accordion instance's persistence ID. */
    const accordionViewEntry = workspacePersistence?.accordionViewEntries.find(
      (entry) => entry.persistenceId === persistenceId
    )
    return accordionViewEntry?.expandedSectionIds ?? null
  })

  /** Registers a rendered section ID once while preserving descendant order. */
  const registerSection = (sectionId: string): void => {
    if (!sectionIds.includes(sectionId)) {
      sectionIds = [...sectionIds, sectionId]
    }
  }

  /** Removes a section ID when its owning descendant leaves this accordion. */
  const unregisterSection = (sectionId: string): void => {
    sectionIds = sectionIds.filter((candidate) => candidate !== sectionId)
  }

  /** Returns persisted expansion or the default expanded state for one section. */
  const isSectionExpanded = (sectionId: string): boolean => {
    return persistedExpandedSectionIds?.includes(sectionId) ?? true
  }

  /** Toggles one section and queues its workspace-scoped persistence update. */
  const toggleSection = (sectionId: string): void => {
    /** Selected workspace required by workspace-specific persistence. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return

    /** Next expanded ID set after applying the header click. */
    const nextExpandedSectionIds = new SvelteSet(persistedExpandedSectionIds ?? sectionIds)
    if (nextExpandedSectionIds.has(sectionId)) {
      nextExpandedSectionIds.delete(sectionId)
    } else {
      nextExpandedSectionIds.add(sectionId)
    }

    /** Expanded IDs normalized to the consumer's section order. */
    const orderedExpandedSectionIds = sectionIds.filter((candidate) =>
      nextExpandedSectionIds.has(candidate)
    )
    setAccordionExpandedSectionIdsWithAutosave(
      workspaceId,
      persistenceId,
      orderedExpandedSectionIds
    )
  }

  /** Reactive compound-component API supplied to descendant accordion sections. */
  const accordionContext: AccordionContext = {
    get persistenceId() {
      return persistenceId
    },
    get testId() {
      return testId
    },
    registerSection,
    unregisterSection,
    isSectionExpanded,
    toggleSection
  }

  setAccordionContext(accordionContext)
</script>

<!-- Workspace-persisted accordion whose expanded sections share space by weight. -->
<div
  class={mergeClasses('cthulhuUiAccordion', className)}
  data-testid={testId}
  {...restProps}
>
  {@render children()}
</div>

<style>
  .cthulhuUiAccordion {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
</style>
