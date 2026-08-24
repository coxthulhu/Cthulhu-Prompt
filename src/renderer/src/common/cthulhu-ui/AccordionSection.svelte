<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import { untrack, type ComponentType, type Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { getAccordionContext } from './accordionContext'
  import { mergeClasses } from './mergeClasses'

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
    ...restProps
  }: Props = $props()

  /** Nearest accordion controller that owns this section's layout and persisted state. */
  const accordionContext = getAccordionContext()
  /** Reactive icon component selected by the section metadata. */
  const SectionIcon = $derived(icon)
  /** Reactive persisted expansion state for this section ID. */
  const isExpanded = $derived(accordionContext.isSectionExpanded(id))
  /** Explicit total display height calculated by the owning accordion. */
  const displayedHeightPx = $derived(accordionContext.getSectionHeightPx(id))
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
    type="button"
    class="cthulhuUiAccordionHeader"
    aria-controls={contentId}
    aria-expanded={isExpanded}
    data-testid={headerTestId}
    onclick={() => accordionContext.toggleSection(id)}
  >
    <span class="cthulhuUiAccordionChevron">
      <ChevronRight size={20} aria-hidden="true" />
    </span>
    <SectionIcon class="cthulhuUiAccordionIcon" size={16} aria-hidden="true" />
    <span class="cthulhuUiAccordionLabel">{label}</span>
    {#if count !== undefined}
      <span class="cthulhuUiAccordionCount">{count}</span>
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
    color: var(--ui-hoverable-text);
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

  .cthulhuUiAccordionChevron {
    align-items: center;
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    justify-content: center;
    transform: rotate(0deg);
  }

  .cthulhuUiAccordionSection[data-expanded='true'] .cthulhuUiAccordionChevron {
    transform: rotate(90deg);
  }

  .cthulhuUiAccordionIcon {
    color: var(--ui-secondary-icon-glyph);
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
    color: var(--ui-secondary-text);
    font-size: 12px;
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
