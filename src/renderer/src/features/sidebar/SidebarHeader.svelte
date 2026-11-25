<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { LucideIcon } from '@lucide/svelte'

  /** Shared sidebar title row; modes may place their own controls after the title. */
  let { title, icon: Icon, screenHeader = false, titleAccessory, children }: {
    /** Mode title shown in the top left of the sidebar. */
    title: string
    /** Optional icon shown before the title, such as the shown collection's kind icon. */
    icon?: LucideIcon
    /** Lines up with the collection screen header bar beside the sidebar and shows the title in normal text, for a title
        that names the shown collection rather than captioning a list. */
    screenHeader?: boolean
    /** Optional control placed immediately after the title text. */
    titleAccessory?: Snippet
    /** Optional mode-specific controls rendered at the end of the row. */
    children?: Snippet
  } = $props()
</script>

<header class="sidebarHeader" data-screen-header={screenHeader}>
  <!-- The accessory shares the title's font, so a text-baseline icon gets the title's baseline. The 18px line
       fits a tiny icon button, so the title and the button's own text line start on the same pixel at every display scale. -->
  <div class="sidebarHeaderTitleGroup text-sm leading-4.5">
    {#if Icon}
      <Icon size={16} class="sidebarHeaderIcon" aria-hidden="true" data-testid="sidebar-title-icon" />
    {/if}
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

  /* With the group's 4px gap, the margin gives the 8px icon-to-title spacing of work tabs and tree rows. */
  .sidebarHeaderTitleGroup :global(.sidebarHeaderIcon) {
    flex: none;
    margin-right: 4px;
    color: var(--ui-hoverable-icon-glyph);
  }

  /* Below the sidebar's 1px top border and with no padding beneath, 35px puts the separator on the screen header bar's
     bottom border row, since that 36px bar includes its border and sits below the screen's own 1px top border. */
  .sidebarHeader[data-screen-header='true'] {
    min-height: 35px;
  }

  .sidebarHeader[data-screen-header='true'] .sidebarHeaderTitle {
    color: var(--ui-normal-text);
  }
</style>
