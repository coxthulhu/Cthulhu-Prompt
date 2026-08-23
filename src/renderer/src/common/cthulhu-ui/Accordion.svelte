<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    workspacePersistenceDraftCollection,
    type WorkspacePersistenceDraftRecord
  } from '@renderer/data/Collections/WorkspacePersistenceDraftCollection'
  import { setAccordionViewEntryWithAutosave } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type {
    WorkspaceAccordionSectionViewEntry,
    WorkspaceAccordionViewEntry
  } from '@shared/UserPersistence'
  import {
    setAccordionContext,
    type AccordionContext,
    type AccordionSectionRegistration
  } from './accordionContext'
  import { mergeClasses } from './mergeClasses'

  /** Fixed total height of every collapsed accordion section. */
  const COLLAPSED_SECTION_HEIGHT_PX = 36

  /** Public properties for the workspace-persisted resizable accordion. */
  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    persistenceId: string
    children: Snippet
    class?: string
    testId?: string
  }

  /** Resolved runtime state for one registered accordion section. */
  type ResolvedAccordionSection = AccordionSectionRegistration &
    WorkspaceAccordionSectionViewEntry

  /** Active sash drag measured from its pointer-down layout snapshot. */
  type AccordionDragState = {
    sectionId: string
    startClientYPx: number
    startHeightsById: Record<string, number>
    hasSizeChanged: boolean
  }

  /** Component inputs and remaining root element attributes. */
  let {
    persistenceId,
    children,
    class: className,
    testId,
    ...restProps
  }: Props = $props()

  /** Reactive workspace owner used to scope persisted accordion state. */
  const workspaceSelection = getWorkspaceSelectionContext()
  /** Reactive workspace-persistence drafts rendered by this component. */
  const workspacePersistenceQuery = useLiveQuery(workspacePersistenceDraftCollection) as {
    data: WorkspacePersistenceDraftRecord[]
  }
  /** Accordion root measured whenever its available height changes. */
  let accordionElement = $state<HTMLDivElement | null>(null)
  /** Current viewport height available to the accordion section stack. */
  let accordionHeightPx = $state(0)
  /** Sections registered in rendered descendant order. */
  let registeredSections = $state<AccordionSectionRegistration[]>([])
  /** Active drag metadata, or null while no sash is being dragged. */
  let dragState = $state<AccordionDragState | null>(null)
  /** Explicit section heights shown during the active sash drag. */
  let dragHeightsById = $state<Record<string, number> | null>(null)

  /** Complete persisted state for this accordion, or null before its first saved change. */
  const persistedAccordionViewEntry = $derived.by(() => {
    /** Currently selected workspace that owns this accordion state. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    /** Loaded workspace draft containing accordion view entries. */
    const workspacePersistence = workspacePersistenceQuery.data.find(
      (candidate) => candidate.id === workspaceId
    )
    return (
      workspacePersistence?.accordionViewEntries.find(
        (entry) => entry.persistenceId === persistenceId
      ) ?? null
    )
  })

  /** Registered sections merged with their saved state or component defaults. */
  const resolvedSections = $derived.by(() => {
    return registeredSections.map((registration): ResolvedAccordionSection => {
      /** Persisted state matching the registered section ID. */
      const persistedSection = persistedAccordionViewEntry?.sections.find(
        (section) => section.id === registration.id
      )
      return {
        ...registration,
        isExpanded: persistedSection?.isExpanded ?? true,
        configuredExpandedHeightPx:
          persistedSection?.configuredExpandedHeightPx ?? registration.initialExpandedHeightPx
      }
    })
  })

  /** Applies configured proportions and minimums to the current accordion height. */
  const calculateDisplayedHeights = (
    sections: ResolvedAccordionSection[],
    availableHeightPx: number
  ): Record<string, number> => {
    /** Display height accumulated for every resolved section. */
    const heightsById: Record<string, number> = {}
    /** Expanded sections that share the height left after collapsed headers. */
    let unallocatedSections = sections.filter((section) => section.isExpanded)
    /** Total fixed height occupied by collapsed sections. */
    const collapsedHeightPx =
      (sections.length - unallocatedSections.length) * COLLAPSED_SECTION_HEIGHT_PX
    /** Minimum expanded height required before proportional allocation. */
    const minimumExpandedHeightPx = unallocatedSections.reduce(
      (sum, section) => sum + section.minimumExpandedHeightPx,
      0
    )
    /** Expanded height remaining after fixed and minimum constraints. */
    let remainingHeightPx = Math.max(
      minimumExpandedHeightPx,
      availableHeightPx - collapsedHeightPx
    )

    for (const section of sections) {
      if (!section.isExpanded) heightsById[section.id] = COLLAPSED_SECTION_HEIGHT_PX
    }

    while (unallocatedSections.length > 0) {
      /** Sum of configured heights still participating in proportional allocation. */
      const configuredHeightPx = unallocatedSections.reduce(
        (sum, section) => sum + section.configuredExpandedHeightPx,
        0
      )
      /** Proportional multiplier for every section not yet fixed at its minimum. */
      const scale = remainingHeightPx / configuredHeightPx
      /** Sections whose proportional result would violate their expanded minimum. */
      const constrainedSections = unallocatedSections.filter(
        (section) => section.configuredExpandedHeightPx * scale < section.minimumExpandedHeightPx
      )

      if (constrainedSections.length === 0) {
        for (const section of unallocatedSections) {
          heightsById[section.id] = section.configuredExpandedHeightPx * scale
        }
        break
      }

      /** IDs fixed at their minimum during this allocation pass. */
      const constrainedIds = new Set(constrainedSections.map((section) => section.id))
      for (const section of constrainedSections) {
        heightsById[section.id] = section.minimumExpandedHeightPx
        remainingHeightPx -= section.minimumExpandedHeightPx
      }
      unallocatedSections = unallocatedSections.filter(
        (section) => !constrainedIds.has(section.id)
      )
    }

    return heightsById
  }

  /** Section heights displayed either proportionally or from the active drag snapshot. */
  const displayedHeightsById = $derived(
    dragHeightsById ?? calculateDisplayedHeights(resolvedSections, accordionHeightPx)
  )

  /** Registers or updates one rendered section without changing descendant order. */
  const registerSection = (section: AccordionSectionRegistration): void => {
    /** Existing registration position for the same section ID. */
    const existingIndex = registeredSections.findIndex((candidate) => candidate.id === section.id)
    if (existingIndex === -1) {
      registeredSections = [...registeredSections, section]
      return
    }

    /** Updated registrations preserving the rendered position of this section. */
    const nextSections = [...registeredSections]
    nextSections[existingIndex] = section
    registeredSections = nextSections
  }

  /** Removes a section when its owning descendant leaves this accordion. */
  const unregisterSection = (sectionId: string): void => {
    registeredSections = registeredSections.filter((section) => section.id !== sectionId)
  }

  /** Returns persisted expansion or the default expanded state for one section. */
  const isSectionExpanded = (sectionId: string): boolean => {
    return resolvedSections.find((section) => section.id === sectionId)?.isExpanded ?? true
  }

  /** Returns the current explicit display height for one section. */
  const getSectionHeightPx = (sectionId: string): number => {
    return displayedHeightsById[sectionId] ?? COLLAPSED_SECTION_HEIGHT_PX
  }

  /** Returns whether an expanded section has another expanded section above it. */
  const canResizeSection = (sectionId: string): boolean => {
    /** Rendered position of the candidate section. */
    const sectionIndex = resolvedSections.findIndex((section) => section.id === sectionId)
    if (sectionIndex < 0 || !resolvedSections[sectionIndex]!.isExpanded) return false
    return resolvedSections.slice(0, sectionIndex).some((section) => section.isExpanded)
  }

  /** Returns whether the requested section owns the active drag overlay. */
  const isSectionSashDragging = (sectionId: string): boolean => {
    return dragState?.sectionId === sectionId
  }

  /** Persists one complete ordered accordion snapshot through workspace autosave. */
  const persistAccordionSections = (sections: WorkspaceAccordionSectionViewEntry[]): void => {
    /** Selected workspace required by workspace-specific persistence. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return
    /** Complete accordion entry written as one optimistic autosave update. */
    const accordionViewEntry: WorkspaceAccordionViewEntry = { persistenceId, sections }
    setAccordionViewEntryWithAutosave(workspaceId, accordionViewEntry)
  }

  /** Toggles one section while preserving its configured expanded height. */
  const toggleSection = (sectionId: string): void => {
    /** Complete next section snapshot with only the requested collapse state changed. */
    const sections = resolvedSections.map((section) => ({
      id: section.id,
      isExpanded: section.id === sectionId ? !section.isExpanded : section.isExpanded,
      configuredExpandedHeightPx: section.configuredExpandedHeightPx
    }))
    persistAccordionSections(sections)
  }

  /** Shrinks sections in nearest-first order and returns the absorbed drag distance. */
  const shrinkSectionHeights = (
    heightsById: Record<string, number>,
    sectionIndexes: number[],
    requestedHeightPx: number
  ): number => {
    /** Drag distance that has not yet been absorbed by a shrinking section. */
    let remainingHeightPx = requestedHeightPx
    for (const sectionIndex of sectionIndexes) {
      /** Expanded section eligible to shrink during this cascade step. */
      const section = resolvedSections[sectionIndex]!
      if (!section.isExpanded) continue
      /** Current section height from the drag-start snapshot. */
      const currentHeightPx = heightsById[section.id]!
      /** Height this section can surrender without crossing its minimum. */
      const shrinkableHeightPx = currentHeightPx - section.minimumExpandedHeightPx
      /** Height absorbed by this section before cascading farther away. */
      const absorbedHeightPx = Math.min(remainingHeightPx, shrinkableHeightPx)
      heightsById[section.id] = currentHeightPx - absorbedHeightPx
      remainingHeightPx -= absorbedHeightPx
      if (remainingHeightPx === 0) break
    }
    return requestedHeightPx - remainingHeightPx
  }

  /** Recalculates drag heights from the pointer-down snapshot and current pointer position. */
  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragState) return
    /** Rendered position of the sash-owning expanded section. */
    const sectionIndex = resolvedSections.findIndex(
      (section) => section.id === dragState!.sectionId
    )
    /** Pointer distance from the original sash position. */
    const requestedDeltaPx = event.clientY - dragState.startClientYPx
    /** Fresh drag-start heights prevent pointer travel beyond capacity from accumulating. */
    const nextHeightsById = { ...dragState.startHeightsById }
    /** Ordered candidate indexes on the side that must shrink. */
    const shrinkingSectionIndexes: number[] = []
    /** Drag distance actually absorbed without violating minimum heights. */
    let absorbedDeltaPx = 0

    if (requestedDeltaPx > 0) {
      for (let index = sectionIndex; index < resolvedSections.length; index += 1) {
        shrinkingSectionIndexes.push(index)
      }
      absorbedDeltaPx = shrinkSectionHeights(
        nextHeightsById,
        shrinkingSectionIndexes,
        requestedDeltaPx
      )
      /** Nearest expanded section above the sash that grows during downward movement. */
      const growingSection = resolvedSections
        .slice(0, sectionIndex)
        .findLast((section) => section.isExpanded)!
      nextHeightsById[growingSection.id] += absorbedDeltaPx
    } else if (requestedDeltaPx < 0) {
      for (let index = sectionIndex - 1; index >= 0; index -= 1) {
        shrinkingSectionIndexes.push(index)
      }
      absorbedDeltaPx = shrinkSectionHeights(
        nextHeightsById,
        shrinkingSectionIndexes,
        -requestedDeltaPx
      )
      /** Sash-owning expanded section that grows during upward movement. */
      const growingSection = resolvedSections[sectionIndex]!
      nextHeightsById[growingSection.id] += absorbedDeltaPx
    }

    if (absorbedDeltaPx > 0) dragState.hasSizeChanged = true
    dragHeightsById = nextHeightsById
  }

  /** Finishes the active drag and promotes displayed sizes only after real movement. */
  const finishDragging = (): void => {
    if (!dragState) return
    if (dragState.hasSizeChanged && dragHeightsById) {
      /** Complete saved snapshot with displayed heights promoted for each current state. */
      const sections = resolvedSections.map((section) => ({
        id: section.id,
        isExpanded: section.isExpanded,
        configuredExpandedHeightPx: section.isExpanded
          ? dragHeightsById![section.id]!
          : section.configuredExpandedHeightPx
      }))
      persistAccordionSections(sections)
    }
    dragState = null
    dragHeightsById = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  /** Starts a left-button sash drag from the current proportional layout. */
  const startSectionResize = (sectionId: string, event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !canResizeSection(sectionId)) return
    event.preventDefault()
    event.stopPropagation()
    dragState = {
      sectionId,
      startClientYPx: event.clientY,
      startHeightsById: { ...displayedHeightsById },
      hasSizeChanged: false
    }
    dragHeightsById = { ...displayedHeightsById }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  // Side effect: recalculate proportional section sizes whenever the accordion viewport changes.
  $effect(() => {
    if (!accordionElement) return
    /** Observer that reports changes to the accordion's available height. */
    const resizeObserver = new ResizeObserver(() => {
      accordionHeightPx = accordionElement?.clientHeight ?? 0
    })
    accordionHeightPx = accordionElement.clientHeight
    resizeObserver.observe(accordionElement)
    return () => resizeObserver.disconnect()
  })

  // Side effect: capture pointer movement globally only for the duration of a sash drag.
  $effect(() => {
    if (!dragState) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDragging, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDragging)
    }
  })

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
    getSectionHeightPx,
    canResizeSection,
    isSectionSashDragging,
    startSectionResize,
    toggleSection
  }

  setAccordionContext(accordionContext)
</script>

<!-- Workspace-persisted accordion with proportional sizing and draggable section sashes. -->
<div
  bind:this={accordionElement}
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
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>
