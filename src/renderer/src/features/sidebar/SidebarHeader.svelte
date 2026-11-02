<script lang="ts">
  import type { Snippet } from 'svelte'

  /** Shared sidebar title row; modes may place their own controls after the title. */
  let { title, children }: {
    /** Mode title shown in the top left of the sidebar. */
    title: string
    /** Optional mode-specific controls rendered beside the title. */
    children?: Snippet
  } = $props()
</script>

<header class="sidebarHeader">
  <h2 class="sidebarHeaderTitle min-w-0 truncate text-sm leading-5" data-testid="sidebar-title">
    {title}
  </h2>
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

  .sidebarHeaderTitle {
    flex: 1;
    font-weight: var(--font-weight-semibold);
    color: var(--ui-secondary-text);
  }
</style>
