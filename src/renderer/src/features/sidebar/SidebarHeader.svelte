<script lang="ts">
  import type { Snippet } from 'svelte'

  /** Shared sidebar title row; modes may place their own controls after the title. */
  let { title, titleAccessory, children }: {
    /** Mode title shown in the top left of the sidebar. */
    title: string
    /** Optional control placed immediately after the title text. */
    titleAccessory?: Snippet
    /** Optional mode-specific controls rendered at the end of the row. */
    children?: Snippet
  } = $props()
</script>

<header class="sidebarHeader">
  <!-- The accessory shares the title's font, so a text-baseline icon gets the title's baseline. The 18px line
       fits a tiny icon button, so the title and the button's own text line start on the same pixel at every display scale. -->
  <div class="sidebarHeaderTitleGroup text-sm leading-4.5">
    <h2 class="sidebarHeaderTitle min-w-0 truncate" data-testid="sidebar-title">
      {title}
    </h2>
    {@render titleAccessory?.()}
  </div>
  {@render children?.()}
</header>

<style>
  .sidebarHeader {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 4px 0 10px;
  }

  .sidebarHeaderTitleGroup {
    display: flex;
    flex: 1;
    align-items: center;
    font-weight: var(--font-weight-semibold);
    gap: 4px;
    min-width: 0;
  }

  .sidebarHeaderTitle {
    color: var(--ui-secondary-text);
  }
</style>
