<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import { untrack, type ComponentType, type Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { getAccordionContext } from './accordionContext'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import { droppable, type DroppableOptions } from '@renderer/common/drag-drop/dragDrop.svelte.ts'

  /** Fixed header height included in every expanded section minimum. */
  const ACCORDION_HEADER_HEIGHT_PX = 36
  /** Default total configured height for an expanded section. */
  const DEFAULT_EXPANDED_HEIGHT_PX = 200
  /** Default configurable minimum for expanded section content. */
  const DEFAULT_MINIMUM_EXPANDED_CONTENT_HEIGHT_PX = 64

  /** Public properties for one resizable accordion section and its owned content. */
  type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    id: string
    label: string
    icon: ComponentType
    count?: number
    initialExpandedHeightPx?: number
    minimumExpandedContentHeightPx?: number
    children: Snippet
    class?: string
    /** Optional whole-header drop target supplied by the owning feature. */
    headerDroppableOptions?: DroppableOptions
  }

  /** Section metadata, sizing configuration, content, and remaining element attributes. */
  let {
    id,
    label,
    icon,
    count,
    initialExpandedHeightPx = DEFAULT_EXPANDED_HEIGHT_PX,
    minimumExpandedContentHeightPx = DEFAULT_MINIMUM_EXPANDED_CONTENT_HEIGHT_PX,
    children,
    class: className,
    headerDroppableOptions,
    ...restProps
  }: Props = $props()

  /** Nearest accordion controller that owns this section's layout and persisted state. */
  const accordionContext = getAccordionContext()
  /** Header element registered as a drop target when the feature supplies options. */
  let headerElement = $state<HTMLButtonElement | null>(null)

  // Side effect: register only enabled header targets and release them when options or ownership change.
  $effect(() => {
    if (!headerElement || !headerDroppableOptions) return
    /** Registration kept outside effect tracking because drag indicators are mutable state. */
    const registration = untrack(() => droppable(headerElement!, headerDroppableOptions!))
    return () => untrack(() => registration.destroy())
  })
  /** Reactive icon component selected by the section metadata. */
  const SectionIcon = $derived(icon)
  /** Reactive persisted expansion state for this section ID. */
  const isExpanded = $derived(accordionContext.isSectionExpanded(id))
  /** Explicit total display height calculated by the owning accordion. */
  const displayedHeightPx = $derived(accordionContext.getSectionHeightPx(id))
  /** Whether this section starts the trailing collapsed group placed at the bottom. */
  const isBottomAnchored = $derived(accordionContext.isSectionBottomAnchored(id))
  /** Whether this expanded section has an expanded section above it to resize. */
  const canResize = $derived(accordionContext.canResizeSection(id))
  /** Whether this section's sash should show its active blue overlay. */
  const isSashDragging = $derived(accordionContext.isSectionSashDragging(id))
  /** Stable content ID connecting this section's header and region. */
  const contentId = $derived(`${accordionContext.persistenceId}-${id}-content`)
  /** Parent-derived section test ID preserving consistent accordion selectors. */
  const sectionTestId = $derived(
    accordionContext.testId ? `${accordionContext.testId}-section-${id}` : undefined
  )
  /** Parent-derived header test ID preserving consistent accordion selectors. */
  const headerTestId = $derived(
    accordionContext.testId ? `${accordionContext.testId}-header-${id}` : undefined
  )
  /** Parent-derived content test ID preserving consistent accordion selectors. */
  const contentTestId = $derived(
    accordionContext.testId ? `${accordionContext.testId}-content-${id}` : undefined
  )
  /** Parent-derived sash test ID preserving consistent accordion selectors. */
  const sashTestId = $derived(
    accordionContext.testId ? `${accordionContext.testId}-sash-${id}` : undefined
  )

  // Side effect: register this section's current identity and sizing configuration with its owner.
  $effect(() => {
    /** Section registration isolated from the parent's reactive layout updates. */
    const section = {
      id,
      initialExpandedHeightPx,
      minimumExpandedHeightPx:
        ACCORDION_HEADER_HEIGHT_PX + minimumExpandedContentHeightPx
    }
    untrack(() => accordionContext.registerSection(section))
    return () => untrack(() => accordionContext.unregisterSection(section.id))
  })
</script>

<!-- Independently owned accordion section with an optional draggable top sash. -->
<section
  class={mergeClasses('cthulhuUiAccordionSection', className)}
  data-bottom-anchored={isBottomAnchored ? 'true' : 'false'}
  data-expanded={isExpanded ? 'true' : 'false'}
  data-testid={sectionTestId}
  style={`--cthulhu-ui-accordion-section-height: ${displayedHeightPx}px;`}
  {...restProps}
>
  {#if canResize}
    <button
      type="button"
      class="cthulhuUiAccordionSash"
      data-dragging={isSashDragging ? 'true' : 'false'}
      data-testid={sashTestId}
      aria-label={`Resize ${label} section`}
      tabindex="-1"
      onpointerdown={(event) => accordionContext.startSectionResize(id, event)}
    ></button>
  {/if}

  <button
    bind:this={headerElement}
    type="button"
    class="cthulhuUiAccordionHeader"
    data-drop-state={headerDroppableOptions?.indicator.isOver
      ? headerDroppableOptions.indicator.isBlocked ? 'blocked' : 'over'
      : 'idle'}
    aria-controls={contentId}
    aria-expanded={isExpanded}
    data-testid={headerTestId}
    onclick={() => accordionContext.toggleSection(id)}
  >
    <span class="cthulhuUiAccordionChevron">
      <ChevronRight size={20} aria-hidden="true" />
    </span>
    <IconCell icon={SectionIcon} iconClass="cthulhuUiAccordionIcon" variant="small" />
    <span class="cthulhuUiAccordionLabel text-sm leading-5">{label}</span>
    {#if count !== undefined}
      <!-- Button counts are explicitly excluded from default line heights to preserve header spacing. -->
      <span class="cthulhuUiAccordionCount text-xs leading-4.5">{count}</span>
    {/if}
  </button>

  <div
    id={contentId}
    class="cthulhuUiAccordionContent"
    data-testid={contentTestId}
    hidden={!isExpanded}
  >
    {@render children()}
  </div>
</section>

<style>
  .cthulhuUiAccordionSection {
    display: flex;
    flex: 0 0 var(--cthulhu-ui-accordion-section-height);
    flex-direction: column;
    min-height: var(--cthulhu-ui-accordion-section-height);
    overflow: hidden;
    position: relative;
  }

  .cthulhuUiAccordionSection[data-bottom-anchored='true'] {
    margin-top: auto;
  }

  .cthulhuUiAccordionSash {
    background: transparent;
    border: 0;
    cursor: ns-resize;
    height: 4px;
    left: 0;
    padding: 0;
    position: absolute;
    right: 0;
    top: 0;
    touch-action: none;
    z-index: 1;
  }

  .cthulhuUiAccordionSash[data-dragging='true'] {
    background: var(--ui-info-strong-border);
  }

  .cthulhuUiAccordionHeader {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-muted-text);
    cursor: pointer;
    display: grid;
    flex: 0 0 36px;
    gap: 7px;
    grid-template-columns: 24px 18px minmax(0, 1fr) auto;
    height: 36px;
    padding: 0 12px 0 6px;
    text-align: left;
    width: 100%;
  }

  .cthulhuUiAccordionHeader:hover,
  .cthulhuUiAccordionHeader:focus-visible {
    color: var(--ui-normal-text);
  }

  .cthulhuUiAccordionHeader[data-drop-state='over'] {
    background: var(--ui-info-normal-surface);
    box-shadow: inset 0 0 0 1px var(--ui-info-strong-border);
  }

  .cthulhuUiAccordionHeader[data-drop-state='blocked'] {
    background: var(--ui-neutral-emphasis-surface);
    box-shadow: inset 0 0 0 1px var(--ui-neutral-emphasis-border);
  }

  .cthulhuUiAccordionChevron {
    align-items: center;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    justify-content: center;
    transform: rotate(0deg);
  }

  .cthulhuUiAccordionSection[data-expanded='true'] .cthulhuUiAccordionChevron {
    transform: rotate(90deg);
  }

  :global(.cthulhuUiAccordionIcon) {
    color: var(--ui-secondary-icon-glyph);
  }

  .cthulhuUiAccordionLabel {
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.01em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiAccordionCount {
    color: var(--ui-muted-text);
    font-variant-numeric: tabular-nums;
  }

  .cthulhuUiAccordionHeader:hover .cthulhuUiAccordionChevron,
  .cthulhuUiAccordionHeader:hover :global(.cthulhuUiAccordionIcon),
  .cthulhuUiAccordionHeader:hover .cthulhuUiAccordionCount,
  .cthulhuUiAccordionHeader:focus-visible .cthulhuUiAccordionChevron,
  .cthulhuUiAccordionHeader:focus-visible :global(.cthulhuUiAccordionIcon),
  .cthulhuUiAccordionHeader:focus-visible .cthulhuUiAccordionCount {
    color: var(--ui-normal-text);
  }

  .cthulhuUiAccordionContent {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
</style>
