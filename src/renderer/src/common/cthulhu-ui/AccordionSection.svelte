<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import { untrack, type ComponentType, type Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { getAccordionContext } from './accordionContext'
  import { mergeClasses } from './mergeClasses'

  /** Public properties for one weighted accordion section and its owned content. */
  type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    id: string
    label: string
    icon: ComponentType
    count?: number
    weight: number
    children: Snippet
    class?: string
  }

  /** Section metadata, owned content, and remaining section element attributes. */
  let {
    id,
    label,
    icon,
    count,
    weight,
    children,
    class: className,
    ...restProps
  }: Props = $props()

  /** Nearest accordion controller that owns this section's persisted state. */
  const accordionContext = getAccordionContext()
  /** Reactive icon component selected by the section metadata. */
  const SectionIcon = $derived(icon)
  /** Reactive persisted expansion state for this section ID. */
  const isExpanded = $derived(accordionContext.isSectionExpanded(id))
  /** Stable content ID connecting this section's header and region. */
  const contentId = $derived(`${accordionContext.persistenceId}-${id}-content`)
  /** Parent-derived test ID preserving consistent accordion selectors. */
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

  // Side effect: register this section's current ID for default state and persistence ordering.
  $effect(() => {
    /** Section ID tracked independently from the parent's mutable registration list. */
    const sectionId = id
    untrack(() => accordionContext.registerSection(sectionId))
    return () => untrack(() => accordionContext.unregisterSection(sectionId))
  })
</script>

<!-- Independently owned accordion section with header metadata and content snippet. -->
<section
  class={mergeClasses('cthulhuUiAccordionSection', className)}
  data-expanded={isExpanded ? 'true' : 'false'}
  data-testid={sectionTestId}
  style={`--cthulhu-ui-accordion-section-weight: ${weight};`}
  {...restProps}
>
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
