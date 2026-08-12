<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteSet } from 'svelte/reactivity'
  import { Ban, Check, Copy, FolderOpen, Layers } from 'lucide-svelte'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import type { PromptTemplateReference } from '@shared/Prompt'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
  import PromptTreeFolderRow from '../sidebar/PromptTreeFolderRow.svelte'
  import PromptTreePromptRow from '../sidebar/PromptTreePromptRow.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import { hasPromptTextToken } from './promptTemplatingEngine'

  // Dialog behavior selected by the prompt editor action that opened it.
  type TemplateDialogMode = 'select' | 'select-and-copy'

  // Virtual rows used to render complete base-folder cards and their nested tree entries.
  type TemplateDialogRow =
    | {
        kind: 'base-folder-header'
        folder: PromptFolder
        templateCount: number
      }
    | {
        kind: 'base-folder-header-spacer'
        folderId: string
      }
    | {
        kind: 'folder'
        folder: PromptFolder
        indentCount: number
        endsVisibleBranch: boolean
      }
    | {
        kind: 'template'
        folderId: string
        templateId: string
        indentCount: number
        isLastRow: boolean
      }
    | {
        kind: 'base-folder-footer'
        folderId: string
      }

  // Props received by a virtualized base-folder header snippet.
  type BaseFolderHeaderRowProps = VirtualWindowRowComponentProps<
    Extract<TemplateDialogRow, { kind: 'base-folder-header' }>
  >

  // Props received by the spacing row between a base-folder header and its content.
  type BaseFolderHeaderSpacerRowProps = VirtualWindowRowComponentProps<
    Extract<TemplateDialogRow, { kind: 'base-folder-header-spacer' }>
  >

  // Props received by a virtualized nested-folder snippet.
  type FolderRowProps = VirtualWindowRowComponentProps<
    Extract<TemplateDialogRow, { kind: 'folder' }>
  >

  // Props received by a virtualized template-option snippet.
  type TemplateRowProps = VirtualWindowRowComponentProps<
    Extract<TemplateDialogRow, { kind: 'template' }>
  >

  // Props received by a virtualized base-folder footer snippet.
  type BaseFolderFooterRowProps = VirtualWindowRowComponentProps<
    Extract<TemplateDialogRow, { kind: 'base-folder-footer' }>
  >

  // Public inputs and ordered-selection callback for the two dialog variants.
  type Props = {
    open?: boolean
    workspaceId: string | null
    selectedTemplates?: PromptTemplateReference[] | null
    mode?: TemplateDialogMode
    onselect: (templates: PromptTemplateReference[] | null) => void | Promise<void>
  }

  let {
    open = $bindable(false),
    workspaceId,
    selectedTemplates,
    mode = 'select',
    onselect
  }: Props = $props()

  // Reactive workspaces determine which root template folders appear in the dialog.
  const workspaceQuery = useLiveQuery(workspaceCollection) as { data: Workspace[] }
  // Reactive folders provide the complete nested template-folder hierarchy.
  const promptFolderQuery = useLiveQuery(promptFolderCollection) as { data: PromptFolder[] }
  // Reactive template drafts keep picker titles and token eligibility current.
  const promptTemplateDraftQuery = useLiveQuery(promptTemplateDraftCollection) as {
    data: Array<{ id: string; title: string; fallbackTitle: string; templateText: string }>
  }
  // Folder expansion is local to one opening of the dialog.
  const collapsedFolderIds = new SvelteSet<string>()
  // Ordered available IDs stage full-dialog edits until confirmation.
  let stagedTemplateIds = $state<string[]>([])
  // Tracks the opening edge so staging is initialized exactly once per opening.
  let wasOpen = $state(false)
  // Calculated virtual row extent lets short template libraries size the dialog to their content.
  let templateTreeContentHeightPx = $state(0)

  // Workspace currently supplying the template library.
  const selectedWorkspace = $derived(
    workspaceQuery.data.find((workspace) => workspace.id === workspaceId) ?? null
  )
  // Constant-time folder lookup used while flattening the hierarchy into rows.
  const promptFolderById = $derived.by(() =>
    Object.fromEntries(promptFolderQuery.data.map((folder) => [folder.id, folder]))
  )
  // Titles for templates that can actually wrap prompt text.
  const templateTitleById = $derived.by(() =>
    Object.fromEntries(
      promptTemplateDraftQuery.data.flatMap((template) =>
        hasPromptTextToken(template.templateText)
          ? [[template.id, getPromptDisplayTitle(template)] as const]
          : []
      )
    )
  )
  // Root template folders retain workspace ordering.
  const rootTemplateFolders = $derived.by(() =>
    (selectedWorkspace?.entries ?? []).flatMap((entry) => {
      const folder = promptFolderById[entry.id]
      return folder?.kind === 'template' ? [folder] : []
    })
  )
  // Dialog icon follows the selected full or quick behavior.
  const dialogIcon = $derived(mode === 'select-and-copy' ? Copy : Layers)
  // Title used for display and the accessible dialog name.
  const dialogTitle = $derived(
    mode === 'select-and-copy' ? 'Quick Template Selection' : 'Configure Templates'
  )
  // Subtitle explains whether selection is staged or immediate.
  const dialogSubtitle = $derived(
    mode === 'select-and-copy'
      ? 'Click a template to apply it and copy this prompt immediately.'
      : 'Select one or more templates to apply to this prompt.'
  )
  // Shared row control switches from checkboxes to copy glyphs in quick mode.
  const selectionControl = $derived(mode === 'select-and-copy' ? 'copy' : 'checkbox')

  // Keeps only the first occurrence of each currently available template ID.
  const normalizeTemplateIds = (templateIds: Iterable<string>): string[] => {
    const normalizedIds: string[] = []
    const seenIds = new SvelteSet<string>()
    for (const templateId of templateIds) {
      if (seenIds.has(templateId) || !templateTitleById[templateId]) continue
      seenIds.add(templateId)
      normalizedIds.push(templateId)
    }
    return normalizedIds
  }

  // Staged selection projected against the templates currently available in the library.
  const normalizedStagedTemplateIds = $derived(normalizeTemplateIds(stagedTemplateIds))

  // Side effect: every dialog opening expands folders and initializes independent staging.
  $effect(() => {
    if (open && !wasOpen) {
      collapsedFolderIds.clear()
      stagedTemplateIds =
        mode === 'select'
          ? normalizeTemplateIds((selectedTemplates ?? []).map((template) => template.id))
          : []
    }
    wasOpen = open
  })

  // Reports whether one nested template folder is expanded.
  const getFolderExpanded = (folderId: string): boolean => !collapsedFolderIds.has(folderId)

  // Updates local expansion without changing prompt-tree persistence.
  const handleFolderExpandedChange = (folderId: string, isExpanded: boolean): void => {
    if (isExpanded) collapsedFolderIds.delete(folderId)
    else collapsedFolderIds.add(folderId)
  }

  // Filters a folder to nested template folders and usable template drafts.
  const getAvailableEntries = (folder: PromptFolder) =>
    folder.entries.filter((entry) =>
      entry.kind === 'folder'
        ? promptFolderById[entry.id]?.kind === 'template'
        : entry.kind === 'template' && Boolean(templateTitleById[entry.id])
    )

  // Counts every usable template below a base folder for its header summary.
  const getAvailableTemplateCount = (folder: PromptFolder): number =>
    getAvailableEntries(folder).reduce((count, entry) => {
      if (entry.kind === 'template') return count + 1
      const childFolder = promptFolderById[entry.id]
      return count + (childFolder ? getAvailableTemplateCount(childFolder) : 0)
    }, 0)

  // Applies a quick selection immediately or toggles an ordered staged selection.
  const handleTemplateSelect = (templateId: string): void => {
    if (mode === 'select-and-copy') {
      void onselect([{ id: templateId }])
      open = false
      return
    }

    stagedTemplateIds = normalizedStagedTemplateIds.includes(templateId)
      ? normalizedStagedTemplateIds.filter((selectedId) => selectedId !== templateId)
      : [...normalizedStagedTemplateIds, templateId]
  }

  // Selects the explicit no-template option, immediately only in quick mode.
  const handleNoTemplateSelect = (): void => {
    if (mode === 'select-and-copy') {
      void onselect(null)
      open = false
      return
    }

    stagedTemplateIds = []
  }

  // Persists the normalized staged selection and closes the full dialog.
  const handleConfirm = (): void => {
    const templates = normalizedStagedTemplateIds.map((id) => ({ id }))
    void onselect(templates.length > 0 ? templates : null)
    open = false
  }

  // Complete virtual row stream including card headers, bordered gutters, and footer caps.
  const virtualItems = $derived.by((): VirtualWindowItem<TemplateDialogRow>[] => {
    const items: VirtualWindowItem<TemplateDialogRow>[] = []

    // Recursively flattens one visible nested folder into shared prompt-tree rows.
    const addFolderRows = (
      folder: PromptFolder,
      indentCount: number,
      isLastSibling: boolean
    ): void => {
      const isExpanded = getFolderExpanded(folder.id)
      const childEntries = getAvailableEntries(folder)
      items.push({
        id: `${folder.id}:folder`,
        row: {
          kind: 'folder',
          folder,
          indentCount,
          endsVisibleBranch: isLastSibling && (!isExpanded || childEntries.length === 0)
        }
      })
      if (!isExpanded) return

      for (const [entryIndex, entry] of childEntries.entries()) {
        const isLastChild = entryIndex === childEntries.length - 1
        const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null
        if (childFolder) {
          addFolderRows(childFolder, indentCount + 1, isLastChild)
          continue
        }
        items.push({
          id: `${folder.id}:template:${entry.id}`,
          row: {
            kind: 'template',
            folderId: folder.id,
            templateId: entry.id,
            indentCount: indentCount + 1,
            isLastRow: isLastChild
          }
        })
      }
    }

    for (const rootFolder of rootTemplateFolders) {
      items.push({
        id: `${rootFolder.id}:header`,
        row: {
          kind: 'base-folder-header',
          folder: rootFolder,
          templateCount: getAvailableTemplateCount(rootFolder)
        }
      })
      items.push({
        id: `${rootFolder.id}:header-spacer`,
        row: { kind: 'base-folder-header-spacer', folderId: rootFolder.id }
      })

      const rootEntries = getAvailableEntries(rootFolder)
      for (const [entryIndex, entry] of rootEntries.entries()) {
        const isLastChild = entryIndex === rootEntries.length - 1
        const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null
        if (childFolder) {
          addFolderRows(childFolder, 0, isLastChild)
          continue
        }
        items.push({
          id: `${rootFolder.id}:template:${entry.id}`,
          row: {
            kind: 'template',
            folderId: rootFolder.id,
            templateId: entry.id,
            indentCount: 0,
            isLastRow: isLastChild
          }
        })
      }

      items.push({
        id: `${rootFolder.id}:footer`,
        row: { kind: 'base-folder-footer', folderId: rootFolder.id }
      })
    }

    return items
  })

  // Fixed-height registry lets all base-folder structure participate in virtualization.
  const rowRegistry = defineVirtualWindowRowRegistry<TemplateDialogRow>({
    'base-folder-header': {
      estimateHeight: () => 51,
      snippet: baseFolderHeaderRow
    },
    'base-folder-header-spacer': {
      estimateHeight: () => 6,
      snippet: baseFolderHeaderSpacerRow
    },
    folder: {
      estimateHeight: () => 32,
      snippet: folderRow
    },
    template: {
      estimateHeight: () => 32,
      snippet: templateRow
    },
    'base-folder-footer': {
      estimateHeight: () => 18,
      snippet: baseFolderFooterRow
    }
  })
</script>

<Dialog
  bind:open
  class="promptTemplateSelectionDialog w-full max-w-[580px]"
  icon={dialogIcon}
  title={dialogTitle}
  subtitle={dialogSubtitle}
  submitText="Confirm Selections"
  submitIcon={Check}
  submitTestId="prompt-template-confirm-button"
  showSubmitButton={mode === 'select'}
  cancelFirst
  onsubmit={handleConfirm}
>
  <div class="prompt-template-selection-body">
    <div class="prompt-template-no-template-panel">
      <button
        type="button"
        class="prompt-template-no-template-option"
        data-row-state={mode === 'select' && normalizedStagedTemplateIds.length === 0
          ? 'active'
          : 'idle'}
        aria-pressed={mode === 'select'
          ? normalizedStagedTemplateIds.length === 0
          : undefined}
        data-testid="prompt-template-option-none"
        onclick={handleNoTemplateSelect}
      >
        <span class="prompt-template-no-template-icon"><Ban size={18} aria-hidden="true" /></span>
        <span class="prompt-template-no-template-copy">
          <strong>No Template</strong>
          <small>Use the prompt exactly as written</small>
        </span>
        <span
          class="prompt-template-no-template-control"
          data-control={selectionControl}
          aria-hidden="true"
        >
          {#if selectionControl === 'checkbox'}
            <Check size={13} />
          {:else}
            <Copy size={16} />
          {/if}
        </span>
      </button>
    </div>

    <div class="prompt-template-tree-label">
      <span>Template Library</span>
      {#if mode === 'select'}
        <span>{normalizedStagedTemplateIds.length} selected</span>
      {/if}
    </div>
    <Separator class="mb-2" />

    <div
      class="prompt-template-selection-tree sidebarPromptTree"
      style={`--template-tree-content-height:${templateTreeContentHeightPx}px;`}
    >
      <SvelteVirtualWindow
        items={virtualItems}
        {rowRegistry}
        bind:contentHeightPx={templateTreeContentHeightPx}
        leftScrollPaddingPx={0}
        rightScrollPaddingPx={4}
        testId="prompt-template-selection-tree"
        spacerTestId="prompt-template-selection-tree-spacer"
      />
    </div>
  </div>
</Dialog>

{#snippet baseFolderHeaderRow({ row }: BaseFolderHeaderRowProps)}
  <div
    class="prompt-template-base-folder-header"
    data-testid={`prompt-template-base-folder-header-${row.folder.id}`}
  >
    <span class="prompt-template-base-folder-icon">
      <FolderOpen size={18} aria-hidden="true" />
    </span>
    <span class="prompt-template-base-folder-copy">
      <strong>{row.folder.displayName}</strong>
      <span>{row.templateCount} {row.templateCount === 1 ? 'template' : 'templates'}</span>
    </span>
  </div>
{/snippet}

{#snippet baseFolderHeaderSpacerRow({ row }: BaseFolderHeaderSpacerRowProps)}
  <div
    class="prompt-template-base-folder-header-spacer"
    data-testid={`prompt-template-base-folder-header-spacer-${row.folderId}`}
    aria-hidden="true"
  ></div>
{/snippet}

{#snippet folderRow({ row }: FolderRowProps)}
  <div class="prompt-template-base-folder-content-row">
    <PromptTreeFolderRow
      folder={row.folder}
      isActive={false}
      isDragging={false}
      isPromptDragActive={false}
      isExpanded={getFolderExpanded(row.folder.id)}
      indentCount={row.indentCount}
      endsVisibleBranch={row.endsVisibleBranch}
      showActions={false}
      roundedCorners
      onFolderExpandedChange={handleFolderExpandedChange}
      onPromptFolderOpen={() => {}}
      onFolderSettingsOpen={() => {}}
    />
  </div>
{/snippet}

{#snippet templateRow({ row }: TemplateRowProps)}
  <div class="prompt-template-base-folder-content-row">
    <PromptTreePromptRow
      folderId={row.folderId}
      promptId={row.templateId}
      promptTitle={templateTitleById[row.templateId]!}
      isActive={mode === 'select' && normalizedStagedTemplateIds.includes(row.templateId)}
      isDragging={false}
      isPromptDragActive={false}
      indentCount={row.indentCount}
      isLastRow={row.isLastRow}
      {selectionControl}
      onPromptSelect={(_folderId, templateId) => handleTemplateSelect(templateId)}
    />
  </div>
{/snippet}

{#snippet baseFolderFooterRow({ row }: BaseFolderFooterRowProps)}
  <div
    class="prompt-template-base-folder-footer"
    data-testid={`prompt-template-base-folder-footer-${row.folderId}`}
    aria-hidden="true"
  ></div>
{/snippet}

<style>
  :global(.promptTemplateSelectionDialog) {
    min-height: 0;
  }

  .prompt-template-selection-body {
    min-width: 0;
    padding-top: 14px;
  }

  .prompt-template-no-template-panel {
    margin-bottom: 15px;
  }

  .prompt-template-no-template-option {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 11px;
    grid-template-columns: 32px minmax(0, 1fr) 20px;
    height: 54px;
    padding: 0 13px 0 10px;
    text-align: left;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
    width: 100%;
  }

  .prompt-template-no-template-option:hover {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .prompt-template-no-template-option[data-row-state='active'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .prompt-template-no-template-option[data-row-state='active']:hover {
    background: var(--ui-accent-action-hover-fill);
  }

  .prompt-template-no-template-icon {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .prompt-template-no-template-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .prompt-template-no-template-copy strong {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 19px;
  }

  .prompt-template-no-template-copy small {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 17px;
  }

  .prompt-template-no-template-control {
    align-items: center;
    box-sizing: border-box;
    display: inline-flex;
    height: 17px;
    justify-content: center;
    width: 17px;
  }

  .prompt-template-no-template-control[data-control='checkbox'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
  }

  .prompt-template-no-template-option[data-row-state='active']
    .prompt-template-no-template-control[data-control='checkbox'] {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .prompt-template-no-template-control[data-control='copy'] {
    color: var(--ui-secondary-icon-glyph);
  }

  .prompt-template-tree-label {
    align-items: flex-end;
    display: flex;
    justify-content: space-between;
    padding: 0 3px 8px;
  }

  .prompt-template-tree-label > span:first-child {
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }

  .prompt-template-tree-label span:last-child:not(:first-child) {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
  }

  .prompt-template-selection-tree {
    height: min(var(--template-tree-content-height), 470px, calc(100vh - 295px));
    width: 100%;
  }

  .prompt-template-base-folder-header {
    align-items: center;
    background: var(--ui-card-normal-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card) 0 0;
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: flex;
    gap: 9px;
    height: 51px;
    padding: 9px 12px;
  }

  .prompt-template-base-folder-icon {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
  }

  .prompt-template-base-folder-copy {
    display: grid;
    flex: 1 1 auto;
    gap: 1px;
    min-width: 0;
  }

  .prompt-template-base-folder-copy strong {
    color: var(--ui-normal-text);
    font-size: 13px;
    font-weight: 650;
    line-height: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-template-base-folder-copy span {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
  }

  .prompt-template-base-folder-header-spacer {
    background: var(--ui-card-solid-surface);
    border-left: 1px solid var(--ui-card-nested-border);
    border-right: 1px solid var(--ui-card-nested-border);
    box-sizing: border-box;
    height: 6px;
  }

  .prompt-template-base-folder-content-row {
    background: var(--ui-card-solid-surface);
    border-left: 1px solid var(--ui-card-nested-border);
    border-right: 1px solid var(--ui-card-nested-border);
    box-sizing: border-box;
    height: 32px;
    padding-inline: 5px;
  }

  .prompt-template-base-folder-footer {
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 0 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card);
    border-top: 0;
    box-sizing: border-box;
    height: 8px;
  }
</style>
