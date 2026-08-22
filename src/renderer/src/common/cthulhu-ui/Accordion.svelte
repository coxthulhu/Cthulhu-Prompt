<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { ChevronRight } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { SvelteSet } from 'svelte/reactivity'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    workspacePersistenceDraftCollection,
    type WorkspacePersistenceDraftRecord
  } from '@renderer/data/Collections/WorkspacePersistenceDraftCollection'
  import { setAccordionExpandedSectionIdsWithAutosave } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import { mergeClasses } from './mergeClasses'

  /** Metadata and default layout weight for one accordion section. */
  export type AccordionSection = {
    id: string
    label: string
    icon: ComponentType
    count?: number
    weight: number
  }

  /** Public properties for the workspace-persisted weighted accordion. */
  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    persistenceId: string
    sections: AccordionSection[]
    children: Snippet<[AccordionSection]>
    class?: string
    testId?: string
  }

  /** Component inputs and remaining root element attributes. */
  let {
    persistenceId,
    sections,
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
  /** Saved expanded IDs, or every section ID before this accordion has saved state. */
  const expandedSectionIds = $derived.by(() => {
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
    return accordionViewEntry?.expandedSectionIds ?? sections.map((section) => section.id)
  })
  /** Expanded section lookup used by header and layout rendering. */
  const expandedSectionIdSet = $derived(new SvelteSet(expandedSectionIds))

  /** Toggles one section and queues its workspace-scoped persistence update. */
  const toggleSection = (sectionId: string): void => {
    /** Selected workspace required by workspace-specific persistence. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return

    /** Next expanded ID set after applying the header click. */
    const nextExpandedSectionIds = new SvelteSet(expandedSectionIds)
    if (nextExpandedSectionIds.has(sectionId)) {
      nextExpandedSectionIds.delete(sectionId)
    } else {
      nextExpandedSectionIds.add(sectionId)
    }

    /** Expanded IDs normalized to the consumer's section order. */
    const orderedExpandedSectionIds = sections
      .filter((section) => nextExpandedSectionIds.has(section.id))
      .map((section) => section.id)
    setAccordionExpandedSectionIdsWithAutosave(
      workspaceId,
      persistenceId,
      orderedExpandedSectionIds
    )
  }
</script>

<!-- Workspace-persisted accordion whose expanded sections share space by weight. -->
<div
  class={mergeClasses('cthulhuUiAccordion', className)}
  data-testid={testId}
  {...restProps}
>
  {#each sections as section (section.id)}
    <!-- Section state drives both semantic expansion and weighted flex sizing. -->
    {@const isExpanded = expandedSectionIdSet.has(section.id)}
    <!-- Stable content ID connects each header to its controlled region. -->
    {@const contentId = `${persistenceId}-${section.id}-content`}
    <!-- Section-specific decorative icon supplied by the consumer. -->
    {@const SectionIcon = section.icon}
    <section
      class="cthulhuUiAccordionSection"
      data-expanded={isExpanded ? 'true' : 'false'}
      data-testid={testId ? `${testId}-section-${section.id}` : undefined}
      style={`--cthulhu-ui-accordion-section-weight: ${section.weight};`}
    >
      <button
        type="button"
        class="cthulhuUiAccordionHeader"
        aria-controls={contentId}
        aria-expanded={isExpanded}
        data-testid={testId ? `${testId}-header-${section.id}` : undefined}
        onclick={() => toggleSection(section.id)}
      >
        <span class="cthulhuUiAccordionChevron">
          <ChevronRight size={20} aria-hidden="true" />
        </span>
        <SectionIcon class="cthulhuUiAccordionIcon" size={16} aria-hidden="true" />
        <span class="cthulhuUiAccordionLabel">{section.label}</span>
        {#if section.count !== undefined}
          <span class="cthulhuUiAccordionCount">{section.count}</span>
        {/if}
      </button>

      <div
        id={contentId}
        class="cthulhuUiAccordionContent"
        data-testid={testId ? `${testId}-content-${section.id}` : undefined}
        hidden={!isExpanded}
      >
        {@render children(section)}
      </div>
    </section>
  {/each}
</div>

<style>
  .cthulhuUiAccordion {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .cthulhuUiAccordionSection {
    display: flex;
    flex: var(--cthulhu-ui-accordion-section-weight) 1 0;
    flex-direction: column;
    min-height: 36px;
    overflow: hidden;
  }

  .cthulhuUiAccordionSection[data-expanded='false'] {
    flex: 0 0 36px;
  }

  .cthulhuUiAccordionHeader {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    flex: 0 0 36px;
    gap: 7px;
    grid-template-columns: 24px 18px minmax(0, 1fr) auto;
    height: 36px;
    padding: 0 12px 0 9px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiAccordionHeader:hover,
  .cthulhuUiAccordionHeader:focus-visible {
    color: var(--ui-normal-text);
  }

  .cthulhuUiAccordionChevron {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    justify-content: center;
    transform: rotate(0deg);
  }

  .cthulhuUiAccordionSection[data-expanded='true'] .cthulhuUiAccordionChevron {
    transform: rotate(90deg);
  }

  .cthulhuUiAccordionIcon {
    color: currentColor;
  }

  .cthulhuUiAccordionLabel {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiAccordionCount {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .cthulhuUiAccordionContent {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }
</style>
