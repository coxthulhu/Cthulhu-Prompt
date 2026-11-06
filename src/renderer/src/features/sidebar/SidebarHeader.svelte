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
  <div class="sidebarHeaderTitleGroup">
    <h2 class="sidebarHeaderTitle min-w-0 truncate text-sm leading-5" data-testid="sidebar-title">
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
    gap: 4px;
    min-width: 0;
  }

  .sidebarHeaderTitle {
    font-weight: var(--font-weight-semibold);
    color: var(--ui-secondary-text);
  }
</style>
