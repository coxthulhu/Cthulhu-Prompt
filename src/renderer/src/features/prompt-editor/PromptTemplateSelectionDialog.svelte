<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteSet } from 'svelte/reactivity'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
  import PromptTreeFolderRow from '../sidebar/PromptTreeFolderRow.svelte'
  import PromptTreePromptRow from '../sidebar/PromptTreePromptRow.svelte'
  import PromptTreeVirtualList, {
    type PromptTreeFolderRowProps,
    type PromptTreePromptRowProps,
    type PromptTreeRootFolderRowProps,
    type PromptTreeRow,
    type PromptTreeSpecialRowProps
  } from '../sidebar/PromptTreeVirtualList.svelte'
  import type { VirtualWindowItem } from '../virtualizer/virtualWindowTypes'
  import { hasPromptTextToken } from './promptTemplatingEngine'

  let {
    open = $bindable(false),
    workspaceId,
    selectedTemplateId,
    title = 'Select Template',
    notifyOnReselect = false,
    onselect
  }: {
    open?: boolean
    workspaceId: string | null
    selectedTemplateId?: string | null
    title?: string
    notifyOnReselect?: boolean
    onselect: (templateId: string | null) => void
  } = $props()

  const workspaceQuery = useLiveQuery(workspaceCollection) as { data: Workspace[] }
  const promptFolderQuery = useLiveQuery(promptFolderCollection) as { data: PromptFolder[] }
  const promptTemplateDraftQuery = useLiveQuery(promptTemplateDraftCollection) as {
    data: Array<{ id: string; title: string; fallbackTitle: string; templateText: string }>
  }
  const collapsedFolderIds = new SvelteSet<string>()
  let wasOpen = $state(false)

  const selectedWorkspace = $derived(
    workspaceQuery.data.find((workspace) => workspace.id === workspaceId) ?? null
  )
  const promptFolderById = $derived.by(() =>
    Object.fromEntries(promptFolderQuery.data.map((folder) => [folder.id, folder]))
  )
  const templateTitleById = $derived.by(() =>
    Object.fromEntries(
      promptTemplateDraftQuery.data.flatMap((template) =>
        hasPromptTextToken(template.templateText)
          ? [[template.id, getPromptDisplayTitle(template)] as const]
          : []
      )
    )
  )
  const rootTemplateFolders = $derived.by(() =>
    (selectedWorkspace?.entries ?? []).flatMap((entry) => {
      const folder = promptFolderById[entry.id]
      return folder?.kind === 'template' ? [folder] : []
    })
  )
  const resolvedSelectedTemplateId = $derived(
    selectedTemplateId === undefined
      ? undefined
      : selectedTemplateId && templateTitleById[selectedTemplateId]
        ? selectedTemplateId
        : null
  )

  // Side effect: each dialog opening starts from a fully expanded template tree.
  $effect(() => {
    if (open && !wasOpen) collapsedFolderIds.clear()
    wasOpen = open
  })

  const getFolderExpanded = (folderId: string): boolean => !collapsedFolderIds.has(folderId)

  const handleFolderExpandedChange = (folderId: string, isExpanded: boolean): void => {
    if (isExpanded) collapsedFolderIds.delete(folderId)
    else collapsedFolderIds.add(folderId)
  }

  const handleSelect = (templateId: string | null): void => {
    if (notifyOnReselect || templateId !== resolvedSelectedTemplateId) onselect(templateId)
    open = false
  }

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = [
      {
        id: 'no-template',
        row: { kind: 'special', id: 'no-template', label: 'No Template' }
      }
    ]

    const addFolderRows = (
      folder: PromptFolder,
      parentFolder: PromptFolder,
      indentCount: number,
      isLastRow: boolean
    ): void => {
      items.push({
        id: `${folder.id}:folder`,
        row: {
          kind: 'folder',
          folder,
          parentFolder,
          indentCount,
          isLastRow,
          isSubfolder: true
        }
      })
      if (!getFolderExpanded(folder.id)) return

      const childEntries = folder.entries.filter((entry) =>
        entry.kind === 'folder'
          ? promptFolderById[entry.id]?.kind === 'template'
          : entry.kind === 'template' && Boolean(templateTitleById[entry.id])
      )
      for (const [entryIndex, entry] of childEntries.entries()) {
        const isLastChild = entryIndex === childEntries.length - 1
        const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null
        if (childFolder) {
          addFolderRows(childFolder, folder, indentCount + 1, isLastChild)
          continue
        }
        items.push({
          id: `${folder.id}:template:${entry.id}`,
          row: {
            kind: 'folder-prompt',
            folder,
            promptId: entry.id,
            indentCount: indentCount + 1,
            isLastRow: isLastChild,
            isNestedPrompt: true
          }
        })
      }
    }

    for (const rootFolder of rootTemplateFolders) {
      items.push({
        id: `${rootFolder.id}:root-folder`,
        row: { kind: 'root-folder', folder: rootFolder }
      })
      const rootEntries = rootFolder.entries.filter((entry) =>
        entry.kind === 'folder'
          ? promptFolderById[entry.id]?.kind === 'template'
          : entry.kind === 'template' && Boolean(templateTitleById[entry.id])
      )
      for (const [entryIndex, entry] of rootEntries.entries()) {
        const isLastChild = entryIndex === rootEntries.length - 1
        const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null
        if (childFolder) {
          addFolderRows(childFolder, rootFolder, 0, isLastChild)
          continue
        }
        items.push({
          id: `${rootFolder.id}:template:${entry.id}`,
          row: {
            kind: 'folder-prompt',
            folder: rootFolder,
            promptId: entry.id,
            indentCount: 0,
            isLastRow: isLastChild,
            isNestedPrompt: false
          }
        })
      }
    }

    items.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return items
  })
</script>

<Dialog
  bind:open
  class="w-full max-w-[480px]"
  {title}
  submitText=""
  showSubmitButton={false}
>
  <div class="prompt-template-selection-tree sidebarPromptTree">
    <PromptTreeVirtualList
      items={virtualItems}
      testId="prompt-template-selection-tree"
      spacerTestId="prompt-template-selection-tree-spacer"
    >
      {#snippet specialRow(props: PromptTreeSpecialRowProps)}
        <div class="sidebarPromptTreeSettingsRow">
          <button
            type="button"
            class="sidebarPromptTreeSettingsButton sidebarPromptTreeRootButton"
            data-row-state={resolvedSelectedTemplateId === null ? 'active' : 'idle'}
            aria-current={resolvedSelectedTemplateId === null ? 'true' : undefined}
            data-testid="prompt-template-option-none"
            onclick={() => handleSelect(null)}
          >
            <span class="sidebarPromptTreeSettingsLabel">{props.row.label}</span>
          </button>
        </div>
      {/snippet}

      {#snippet rootFolderRow(props: PromptTreeRootFolderRowProps)}
        <div class="sidebarPromptTreeSettingsRow">
          <div class="sidebarPromptTreeSettingsButton sidebarPromptTreeRootButton">
            <span class="sidebarPromptTreeSettingsLabel">{props.row.folder.displayName}</span>
          </div>
        </div>
      {/snippet}

      {#snippet folderRow(props: PromptTreeFolderRowProps)}
        <PromptTreeFolderRow
          folder={props.row.folder}
          isActive={false}
          isSettingsActive={false}
          isDragging={false}
          isPromptDragActive={false}
          isExpanded={getFolderExpanded(props.row.folder.id)}
          indentCount={props.row.indentCount}
          isLastRow={props.row.isLastRow}
          showActions={false}
          onFolderExpandedChange={handleFolderExpandedChange}
          onPromptFolderOpen={() => {}}
          onFolderSettingsOpen={() => {}}
        />
      {/snippet}

      {#snippet folderPromptRow(props: PromptTreePromptRowProps)}
        <PromptTreePromptRow
          folderId={props.row.folder.id}
          promptId={props.row.promptId}
          promptTitle={templateTitleById[props.row.promptId]!}
          isActive={resolvedSelectedTemplateId === props.row.promptId}
          isDragging={false}
          isPromptDragActive={false}
          indentCount={props.row.indentCount}
          isLastRow={props.row.isLastRow}
          onPromptSelect={(_folderId, templateId) => handleSelect(templateId)}
        />
      {/snippet}

      {#snippet emptyStateRow()}{/snippet}
      {#snippet bottomSpacerRow()}
        <div class="h-full" aria-hidden="true"></div>
      {/snippet}
    </PromptTreeVirtualList>
  </div>
</Dialog>

<style>
  .prompt-template-selection-tree {
    height: min(520px, calc(100vh - 180px));
    width: 100%;
  }
</style>
