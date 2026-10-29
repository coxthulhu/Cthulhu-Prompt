<script lang="ts">
  import PromptTreeCategoryRow from '@renderer/features/prompt-tree/PromptTreeCategoryRow.svelte'
  import PromptTreePromptRow from '@renderer/features/prompt-tree/PromptTreePromptRow.svelte'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { setSettingsCollapsedSectionIdsWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
  import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
  import { settingsNavigation, settingsScrollRequests, settingsTreeSections } from './settingsNavigation.svelte.ts'

  /** Collapsed sections, seeded from the machine-scoped persistence that this sidebar autosaves. */
  let collapsedSectionIds = $state([
    ...userPersistenceCollection.get(USER_PERSISTENCE_ID)!.settingsCollapsedSectionIds
  ])
  /** Expands or collapses one section and autosaves the collapsed section list. */
  const handleSectionExpandedChange = (sectionId: string, isExpanded: boolean): void => {
    collapsedSectionIds = isExpanded
      ? collapsedSectionIds.filter((id) => id !== sectionId)
      : [...collapsedSectionIds, sectionId]
    setSettingsCollapsedSectionIdsWithAutosave(collapsedSectionIds)
  }

  /** Highlights a tree entry and scrolls the settings screen to it. */
  const selectRow = (rowId: string): void => {
    settingsNavigation.selectedRowId = rowId
    settingsScrollRequests.request({ rowId })
  }
</script>

<aside data-testid="app-sidebar" class="appSidebar flex h-full w-full flex-col text-foreground/80">
  <header class="settingsSidebarHeader">
    <h2 class="settingsSidebarTitle min-w-0 truncate text-sm leading-5" data-testid="settings-sidebar-title">
      System Settings
    </h2>
  </header>

  <div class="sidebarPromptTree min-h-0 flex-1 overflow-y-auto pb-4" data-testid="settings-tree">
    {#each settingsTreeSections as section (section.id)}
      {@const isExpanded = !collapsedSectionIds.includes(section.id)}
      <PromptTreeCategoryRow
        testIdGroup="settings"
        category={{ id: section.id, displayName: section.label }}
        isActive={settingsNavigation.selectedRowId === section.id}
        isDragging={false}
        isPromptDragActive={false}
        {isExpanded}
        openLabel="Open Section"
        onCategoryExpandedChange={handleSectionExpandedChange}
        onCategoryOpen={selectRow}
      />
      {#if isExpanded}
        {#each section.rows as row, rowIndex (row.id)}
          <PromptTreePromptRow
            testId={`settings-tree-row-${row.id}`}
            collectionId={section.id}
            promptId={row.id}
            promptTitle={row.label}
            isActive={settingsNavigation.selectedRowId === row.id}
            isDragging={false}
            isPromptDragActive={false}
            indentCount={1}
            isLastRow={rowIndex === section.rows.length - 1}
            onPromptSelect={(_sectionId, rowId) => selectRow(rowId)}
          />
        {/each}
      {/if}
    {/each}
  </div>
</aside>

<style>
  /* Keeps the title where the collection sidebars place it, with a tight gap above the tree. */
  .settingsSidebarHeader {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    padding: 10px 4px 8px 10px;
  }

  .settingsSidebarTitle {
    flex: 1;
    font-weight: var(--font-weight-semibold);
    color: var(--ui-secondary-text);
  }
</style>
