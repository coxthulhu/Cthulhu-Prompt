<script lang="ts">
  import PromptTreeCategoryRow from '@renderer/features/prompt-tree/PromptTreeCategoryRow.svelte'
  import PromptTreePromptRow from '@renderer/features/prompt-tree/PromptTreePromptRow.svelte'
  import SidebarHeader from '@renderer/features/sidebar/SidebarHeader.svelte'
  import type { SettingsSidebarModeData } from '@renderer/features/sidebar/sidebarModes.svelte.ts'
  import { settingsTreeSections } from './settingsTreeSections'

  let { title, modeData }: {
    /** Mode title shown in the shared sidebar header. */
    title: string
    /** Settings mode state shared with the settings screen. */
    modeData: SettingsSidebarModeData
  } = $props()
</script>

<SidebarHeader {title} />

<div class="sidebarPromptTree min-h-0 flex-1 overflow-y-auto pb-4" data-testid="settings-tree">
  {#each settingsTreeSections as section (section.id)}
    {@const isExpanded = !modeData.collapsedSectionIds.includes(section.id)}
    <PromptTreeCategoryRow
      testIdGroup="settings"
      category={{ id: section.id, displayName: section.label }}
      isActive={modeData.selectedRowId === section.id}
      isDragging={false}
      isPromptDragActive={false}
      {isExpanded}
      openLabel="Open Section"
      onCategoryExpandedChange={modeData.setSectionExpanded}
      onCategoryOpen={modeData.selectRow}
    />
    {#if isExpanded}
      {#each section.rows as row, rowIndex (row.id)}
        <PromptTreePromptRow
          testId={`settings-tree-row-${row.id}`}
          collectionId={section.id}
          promptId={row.id}
          promptTitle={row.label}
          isActive={modeData.selectedRowId === row.id}
          isDragging={false}
          isPromptDragActive={false}
          indentCount={1}
          isLastRow={rowIndex === section.rows.length - 1}
          onPromptSelect={(_sectionId, rowId) => modeData.selectRow(rowId)}
        />
      {/each}
    {/if}
  {/each}
</div>
