<script lang="ts">
  import CollectionSidebar from './CollectionSidebar.svelte'
  import SettingsSidebar from '@renderer/features/settings/SettingsSidebar.svelte'
  import { SidebarModeId, type SidebarMode } from './sidebarModes.svelte.ts'

  /** Sidebar host that renders the content of the active sidebar mode. */
  let {
    mode,
    isWorkspaceReady,
    isWorkspaceLoading,
    onScreenCollectionSelect,
    onDeleteSelectedPromptCollection,
    onManageProjects,
    onShowAll
  }: {
    /** Active sidebar mode, chosen by the active screen. */
    mode: SidebarMode
    isWorkspaceReady: boolean
    isWorkspaceLoading: boolean
    /** Navigates to a collection selected from a collection mode. */
    onScreenCollectionSelect: (collectionId: string) => void
    /** Opens the screen-owned deletion flow for a collection mode's selected collection. */
    onDeleteSelectedPromptCollection: (collectionId: string) => void
    /** Opens project management to the project shown by a collection mode. */
    onManageProjects: () => void
    /** Returns the selected work tab to its New Tab screen from the collection mode's Show All button. */
    onShowAll: () => void
  } = $props()
</script>

<aside data-testid="app-sidebar" data-sidebar-mode={mode.id} class="appSidebar flex h-full w-full flex-col text-foreground/80">
  {#if mode.id === SidebarModeId.Settings}
    <SettingsSidebar title={mode.title} modeData={mode.data} />
  {:else}
    {#key mode.id}
      <CollectionSidebar
        title={mode.title}
        modeData={mode.data}
        {isWorkspaceReady}
        {isWorkspaceLoading}
        {onScreenCollectionSelect}
        {onDeleteSelectedPromptCollection}
        {onManageProjects}
        onShowAll={mode.id === SidebarModeId.Collection ? onShowAll : undefined}
      />
    {/key}
  {/if}
</aside>
