<script module lang="ts">
  const BOTTOM_SPACER_RATIO = 0.75
  const ROUNDING_PX = 4

  export const getBottomSpacerHeightPx = (scrollContainerHeightPx: number): number => {
    return Math.ceil((scrollContainerHeightPx * BOTTOM_SPACER_RATIO) / ROUNDING_PX) * ROUNDING_PX
  }
</script>

<script lang="ts">
  let { scrollContainerHeightPx }: { scrollContainerHeightPx: number } = $props()

  // Derived spacer height so the DOM reflects the current viewport size.
  const spacerHeight = $derived(getBottomSpacerHeightPx(scrollContainerHeightPx))
</script>

<div style={`height:${spacerHeight}px;`} aria-hidden="true"></div>
