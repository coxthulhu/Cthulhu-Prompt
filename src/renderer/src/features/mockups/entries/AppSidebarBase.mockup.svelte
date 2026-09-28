<script lang="ts">
  import {
    Archive, ArrowRight, ArrowUpToLine, Bookmark, Bug, Check, ChevronsDownUp, ChevronsUpDown,
    ChevronDown, ChevronUp, ChevronRight, CircleCheckBig, ExternalLink, FileText, Folder, FolderCog,
    GripVertical, Home, Layers, ListTodo, MoreHorizontal, PanelsTopLeft, Plus, Settings, Trash2, X
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  // Visual sandbox: only icons, brand details, and palette tokens are shared with the app.
  // All sample data and interactions below are local and reset when this mockup unmounts.
  type MockPrompt = { id: string; title: string; status?: string; edited?: boolean }
  type MockCategory = { id: string; title: string; prompts: MockPrompt[]; shortDescription?: string; description?: string }
  type MockGroup = {
    id: string
    label: string
    icon: typeof Plus
    prompts: MockPrompt[]
    categories: MockCategory[]
    expanded: boolean
    weight: number
  }
  const prompt = (id: string, title: string): MockPrompt => ({ id, title })
  const indentLevels = (count: number): number[] => Array.from({ length: count }, (_, i) => i)
  const uncategorizedPrompts: MockPrompt[] = [
    { ...prompt('map-implementation', 'Map the current implementation'), status: 'InProgress' },
    { ...prompt('clarify-requirements', 'Clarify product requirements'), edited: true },
    prompt('draft-plan', 'Draft an implementation plan'),
    prompt('identify-edge-cases', 'Identify edge cases'),
    prompt('acceptance-criteria', 'Define acceptance criteria'),
    prompt('review-data-flow', 'Review the data flow')
  ]

  const categories: MockCategory[] = [
    {
      id: 'research',
      title: 'Research',
      shortDescription: 'Investigate requirements and compare implementation options.',
      description: 'Collect findings before choosing an approach. Include accessibility and UI copy reviews.',
      prompts: [
        prompt('compare-patterns', 'Compare sidebar patterns'),
        prompt('prepare-ui-copy', 'Prepare the UI copy'),
        prompt('audit-accessibility', 'Audit accessibility behavior')
      ]
    },
    {
      id: 'verification',
      title: 'Verification',
      prompts: [
        prompt('verify-interactions', 'Verify folder interactions'),
        prompt('regression-checklist', 'Create a regression checklist'),
        prompt('performance-risks', 'Inspect performance risks'),
        prompt('architecture-decisions', 'Document architecture decisions'),
        prompt('error-handling', 'Review error handling'),
        prompt('keyboard-navigation', 'Validate keyboard navigation'),
        prompt('responsive-behavior', 'Check responsive behavior'),
        prompt('test-coverage', 'Summarize test coverage'),
        prompt('release-notes', 'Prepare release notes'),
        prompt('review-diff', 'Review the final diff'),
        prompt('implementation-handoff', 'Write the implementation handoff')
      ]
    },
    { id: 'ideas', title: 'Ideas', prompts: [] }
  ]


  const createGroups = (): MockGroup[] => [
    { id: 'completed', label: 'Completed', icon: CircleCheckBig, expanded: true, weight: 200,
      prompts: [{ ...prompt('completed-audit', 'Audit the existing sidebar'), status: 'Completed' }], categories: [] },
    { id: 'archived', label: 'Archived', icon: Archive, expanded: true, weight: 200,
      prompts: [{ ...prompt('archived-layout', 'Explore the previous layout'), status: 'Archived' }], categories: [] },
    { id: 'active', label: 'Active', icon: ListTodo, expanded: true, weight: 400,
      prompts: uncategorizedPrompts, categories },
    { id: 'backlog', label: 'Backlog', icon: Bookmark, expanded: true, weight: 200,
      prompts: [prompt('future-search', 'Explore prompt search'), prompt('future-shortcuts', 'Plan keyboard shortcuts')],
      categories: categories.map((category) => ({ ...category, prompts: [] })) }
  ]
  type MockFolder = { id: string; title: string; kind: 'prompt' | 'template'; groups: MockGroup[] }
  const emptyGroups = (): MockGroup[] => createGroups().map((group) => ({ ...group, prompts: [], categories: [] }))
  let folders = $state<MockFolder[]>([
    { id: 'product', title: 'Product Work', kind: 'prompt', groups: createGroups() },
    { id: 'personal', title: 'Personal Projects', kind: 'prompt', groups: emptyGroups().map((group) => ({
      ...group, prompts: group.id === 'active' ? [prompt('website', 'Review the personal website'), prompt('backup', 'Automate workspace backups')] : []
    })) },
    { id: 'engineering', title: 'Engineering Templates', kind: 'template', groups: emptyGroups().map((group) => ({
      ...group,
      prompts: group.id === 'active' ? [prompt('template-plan', 'Plan an implementation'), prompt('template-review', 'Review a pull request')] :
        group.id === 'archived' ? [{ ...prompt('template-old', 'Legacy release checklist'), status: 'Archived' }] : [],
      categories: group.id === 'active' ? [{ id: 'template-quality', title: 'Quality', prompts: [prompt('template-test', 'Build a test plan'), prompt('template-security', 'Review security boundaries')] }] : []
    })) }
  ])
  const activities = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prompt', label: 'Task Prompts', icon: FileText },
    { id: 'template', label: 'Prompt Templates', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft },
    { id: 'test', label: 'Test Screen', icon: Bug }
  ]
  // Local navigation and fixture selection never touch the app's screen or workspace state.
  let activeActivity = $state('prompt')
  let folderKind = $state<'prompt' | 'template'>('prompt')
  let selectedFolderId = $state('product')
  const visibleFolders = $derived(folders.filter((folder) => folder.kind === folderKind))
  const selectedFolder = $derived(visibleFolders.find((folder) => folder.id === selectedFolderId) ?? visibleFolders[0])
  const groups = $derived(selectedFolder?.groups ?? [])
  const isTemplateFolder = $derived(folderKind === 'template')
  const FolderIcon = $derived(isTemplateFolder ? Layers : FileText)
  const contentLabel = $derived(isTemplateFolder ? 'Template' : 'Prompt')
  const isFolderActivity = $derived(activeActivity === 'prompt' || activeActivity === 'template')
  const folderTitle = $derived(selectedFolder?.title ?? 'No folders')
  let showCompleted = $state(false)
  let showArchived = $state(false)
  let expandedCategoryIds = $state<Record<string, boolean>>({ research: true, verification: true, ideas: true, 'template-quality': true })
  let selectedPromptId = $state('map-implementation')
  let selectedGroupId = $state('active')
  let isOverviewActive = $state(false)
  let sidebarWidth = $state(275)
  let categoryDialog: HTMLDialogElement
  let folderDialog: HTMLDialogElement
  let deleteDialog: HTMLDialogElement
  let folderName = $state('')
  let categoryDrafts = $state<MockCategory[]>([])
  let draftId = $state('')
  // Derive the selected draft and validation so dialog edits remain local until saved.
  const selectedDraft = $derived(categoryDrafts.find((category) => category.id === draftId))
  const validDrafts = $derived(categoryDrafts.every((category, index) => category.title.trim() &&
    !categoryDrafts.some((other, otherIndex) => index !== otherIndex && other.title.trim().toLowerCase() === category.title.trim().toLowerCase())))
  const validFolderName = $derived(folderName.trim().length > 0 && !visibleFolders.some((folder) => folder.title.toLowerCase() === folderName.trim().toLowerCase()))
  let folderMenuOpen = $state(false)
  let actionsMenuOpen = $state(false)
  let categoryMenu = $state<{ category: MockCategory; group: MockGroup; x: number; y: number } | null>(null)
  let selectedCategoryId = $state<string | null>(null)
  // Folder reorder previews live entirely in this mockup's fixture array.
  let draggedFolderId = $state<string | null>(null)
  const reorderFolder = (targetId: string) => {
    const sourceIndex = folders.findIndex((folder) => folder.id === draggedFolderId)
    const targetIndex = folders.findIndex((folder) => folder.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return
    const [folder] = folders.splice(sourceIndex, 1)
    folders.splice(targetIndex, 0, folder!)
  }
  const closeMenus = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('.local-menu, .folder-selector, .prompts-actions')) return
    folderMenuOpen = false
    actionsMenuOpen = false
    categoryMenu = null
  }
  // Templates expose Active and Archived only, matching the live sidebar's workflow filters.
  const visibleGroups = $derived(groups.filter((group) =>
    group.id === 'active' || (!isTemplateFolder && group.id === 'backlog') ||
    (!isTemplateFolder && group.id === 'completed' && showCompleted) || (group.id === 'archived' && showArchived)))
  const toolbarGroup = $derived(groups.find((group) => group.id ===
    (selectedGroupId === 'backlog' && !isTemplateFolder ? 'backlog' : 'active')))
  const areAllCategoriesCollapsed = $derived(toolbarGroup?.categories.every((category) => !expandedCategoryIds[category.id]) ?? true)
  const folderCount = (folder: MockFolder) => folder.groups.filter((group) => group.id === 'active' || (folder.kind === 'prompt' && group.id === 'backlog'))
    .reduce((sum, group) => sum + group.prompts.length + group.categories.reduce((n, category) => n + category.prompts.length, 0), 0)
  const groupCount = (group: MockGroup) => group.prompts.length + group.categories.reduce((sum, category) => sum + category.prompts.length, 0)

  const selectPrompt = (entry: MockPrompt, group: MockGroup) => {
    activeActivity = folderKind
    selectedCategoryId = null
    selectedPromptId = entry.id
    selectedGroupId = group.id
    isOverviewActive = false
  }
  const addPrompt = (category: MockCategory, group: MockGroup) => {
    const entry = prompt(window.crypto.randomUUID(), `New ${contentLabel}`)
    category.prompts.unshift(entry)
    expandedCategoryIds[category.id] = true
    selectPrompt(entry, group)
  }
  const openCategories = (categoryId?: string) => {
    const unique = new Map(groups.flatMap((group) => group.categories).map((category) => [category.id, category]))
    categoryDrafts = [...unique.values()].map((category) => ({ ...category, prompts: [], shortDescription: category.shortDescription ?? '', description: category.description ?? '' }))
    draftId = categoryId ?? categoryDrafts[0]?.id ?? ''
    categoryDialog.showModal()
  }
  const saveCategories = () => {
    if (!validDrafts) return
    for (const group of groups.filter((entry) => entry.id === 'active' || entry.id === 'backlog')) {
      group.prompts.push(...group.categories.filter((category) => !categoryDrafts.some((draft) => draft.id === category.id)).flatMap((category) => category.prompts))
      group.categories = categoryDrafts.map((draft) => ({ ...draft, title: draft.title.trim(), prompts: group.categories.find((category) => category.id === draft.id)?.prompts ?? [] }))
    }
    categoryDialog.close()
  }
  const selectFolder = (folder: MockFolder) => {
    selectedFolderId = folder.id
    selectedPromptId = ''
    selectedCategoryId = null
    selectedGroupId = 'active'
    isOverviewActive = true
    activeActivity = folderKind
    folderMenuOpen = false
  }
  const createFolder = () => {
    if (!validFolderName) return
    const folder: MockFolder = { id: window.crypto.randomUUID(), title: folderName.trim(), kind: folderKind, groups: emptyGroups() }
    folders.push(folder)
    selectFolder(folder)
    folderDialog.close()
  }
  const openCreateFolder = () => { folderName = ''; folderMenuOpen = false; folderDialog.showModal() }
  const toggleAllCategories = () => {
    const expand = areAllCategoriesCollapsed
    for (const category of toolbarGroup?.categories ?? []) expandedCategoryIds[category.id] = expand
  }

  type ScrollMetrics = { top: number; height: number; total: number; hovered: boolean; dragging: boolean }
  let scrollMetrics = $state<Record<string, ScrollMetrics>>({})
  const viewports: Record<string, HTMLDivElement | undefined> = {}
  // Element references are imperative handles; scroll geometry is kept in rune state above.
  const observeTree = (node: HTMLDivElement, id: string) => {
    viewports[id] = node
    scrollMetrics[id] = { top: 0, height: 0, total: 0, hovered: false, dragging: false }
    const measure = () => {
      Object.assign(scrollMetrics[id]!, { top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight })
    }
    // Side effect: track viewport and content changes for each independent overlay scrollbar.
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    node.addEventListener('scroll', measure)
    measure()
    return { destroy() { observer.disconnect(); node.removeEventListener('scroll', measure); delete viewports[id] } }
  }
  const thumbHeight = (scroll: ScrollMetrics) => Math.min(scroll.height, Math.max(20, scroll.height ** 2 / Math.max(1, scroll.total)))
  const thumbTop = (scroll: ScrollMetrics) => scroll.top / Math.max(1, scroll.total - scroll.height) * (scroll.height - thumbHeight(scroll))
  let drag: { kind: 'width' | 'section' | 'scroll'; start: number; size: number; id?: string; previousId?: string; previousSize?: number } | null = null
  const startResize = (event: PointerEvent, group?: MockGroup) => {
    const target = event.currentTarget as HTMLButtonElement
    event.preventDefault()
    target.setPointerCapture(event.pointerId)
    if (!group) { drag = { kind: 'width', start: event.clientX, size: sidebarWidth }; return }
    const expanded = visibleGroups.filter((entry) => entry.expanded)
    const previous = expanded[expanded.indexOf(group) - 1]
    if (!previous) return
    // Snapshot rendered content heights so resizing remains stable after proportional layout.
    for (const entry of expanded) entry.weight = (viewports[entry.id]?.clientHeight ?? entry.weight - 36) + 36
    drag = { kind: 'section', start: event.clientY, size: group.weight, id: group.id,
      previousId: previous.id, previousSize: previous.weight }
  }
  const startScroll = (event: PointerEvent, id: string) => {
    event.preventDefault()
    const target = event.currentTarget as HTMLDivElement
    target.setPointerCapture(event.pointerId)
    drag = { kind: 'scroll', start: event.clientY, size: scrollMetrics[id]!.top, id }
    scrollMetrics[id]!.dragging = true
  }
  const moveDrag = (event: PointerEvent) => {
    if (!drag) return
    if (drag.kind === 'width') { sidebarWidth = Math.max(240, Math.min(400, drag.size + event.clientX - drag.start)); return }
    if (drag.kind === 'scroll' && drag.id) {
      const scroll = scrollMetrics[drag.id]!
      const node = viewports[drag.id]
      if (node) node.scrollTop = drag.size + (event.clientY - drag.start) *
        (scroll.total - scroll.height) / Math.max(1, scroll.height - thumbHeight(scroll))
      return
    }
    const group = groups.find((entry) => entry.id === drag!.id)!
    const previous = groups.find((entry) => entry.id === drag!.previousId)!
    const delta = Math.max(100 - drag.previousSize!, Math.min(drag.size - 100, event.clientY - drag.start))
    group.weight = drag.size - delta
    previous.weight = drag.previousSize! + delta
  }
  const stopDrag = () => {
    if (drag?.kind === 'scroll' && drag.id) scrollMetrics[drag.id]!.dragging = false
    drag = null
  }
</script>

{#snippet IconAction(Icon: typeof Plus, label: string, onclick: () => void, active = false, disabled = false)}
  <button class="icon-action" type="button" aria-label={label} title={label} {onclick} {disabled} data-active={active}>
    <Icon size={20} aria-hidden="true" />
  </button>
{/snippet}

{#snippet TreeGutter(indentCount: number, isLastRow: boolean)}
  <span class="tree-gutter" data-last-row={isLastRow ? 'true' : undefined} aria-hidden="true">
    {#each indentLevels(indentCount) as level (level)}
      <span class="tree-guide" style={`--tree-guide-index:${level};`}></span>
    {/each}
  </span>
{/snippet}

{#snippet PromptRow(promptEntry: MockPrompt, indentCount: number, isLastRow: boolean, group: MockGroup)}
  <div class="tree-prompt-row" style={`--tree-indent-count:${indentCount};`}>
    <span class="prompt-status-indicator" data-status={promptEntry.status} data-edited={promptEntry.edited} aria-hidden="true"></span>
    <button
      class="tree-prompt-button"
      data-active={isFolderActivity && !isOverviewActive && selectedPromptId === promptEntry.id ? 'true' : 'false'}
      type="button"
      aria-current={isFolderActivity && !isOverviewActive && selectedPromptId === promptEntry.id ? 'true' : undefined}
      onclick={() => {
        selectPrompt(promptEntry, group)
      }}
    >
      {@render TreeGutter(indentCount, isLastRow)}
      <span class="tree-label text-sm">{promptEntry.title}</span>
    </button>
  </div>
{/snippet}

{#snippet CategoryRow(category: MockCategory, group: MockGroup)}
  <div class="tree-category-row">
    <div class="tree-category-content" role="group" data-active={isFolderActivity && selectedGroupId === group.id && selectedCategoryId === category.id}
      oncontextmenu={(event) => {
        event.preventDefault()
        categoryMenu = { category, group, x: event.clientX, y: event.clientY }
      }}>
      <button
        class="tree-category-toggle"
        type="button"
        aria-label={`${expandedCategoryIds[category.id] ? 'Collapse' : 'Expand'} category ${category.title}`}
        aria-expanded={expandedCategoryIds[category.id]}
        onclick={() => { expandedCategoryIds[category.id] = !expandedCategoryIds[category.id] }}
      >
        <span
          class="tree-chevron"
          data-expanded={expandedCategoryIds[category.id] ? 'true' : 'false'}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </span>
        <Folder class="tree-category-icon" size={16} aria-hidden="true" />
        <span class="tree-label text-sm">{category.title}</span>
      </button>

      <div class="tree-category-actions">
        <button
          class="tree-category-action"
          type="button"
          aria-label={`Add ${contentLabel} to top of category ${category.title}`}
          title={`Add ${contentLabel} to top of category ${category.title}`}
          onclick={() => addPrompt(category, group)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>

  {#if expandedCategoryIds[category.id]}
    {#each category.prompts as promptEntry, promptIndex (promptEntry.id)}
      {@render PromptRow(promptEntry, 1, promptIndex === category.prompts.length - 1, group)}
    {:else}
      <button class="empty-category text-xs leading-4.5" type="button" onclick={() => addPrompt(category, group)}>Category is empty, click to add.</button>
    {/each}
  {/if}
{/snippet}

<svelte:window onclick={closeMenus} onkeydown={(event) => {
  if (event.key === 'Escape') { folderMenuOpen = false; actionsMenuOpen = false; categoryMenu = null }
}} />

<main class="sidebar-base-stage" data-testid="app-sidebar-base-mockup">
  <nav class="mock-activity-bar" aria-label="Mockup primary navigation">
    {#each activities as activity (activity.id)}
      <button class="activity-button" type="button" title={activity.label} aria-label={activity.label}
        aria-current={activeActivity === activity.id ? 'page' : undefined}
        onclick={() => {
          activeActivity = activity.id
          folderMenuOpen = false
          actionsMenuOpen = false
          if (activity.id === 'prompt' || activity.id === 'template') {
            folderKind = activity.id
            selectedGroupId = 'active'
          }
        }}>
        <activity.icon size={24} strokeWidth={1.5} aria-hidden="true" />
      </button>
    {/each}
  </nav>
  <aside class="mock-sidebar" style={`--sidebar-width:${sidebarWidth}px;`} aria-label="Cthulhu Prompt sidebar">
    <header class="workspace-header">
      <div class="workspace-icon-cell">
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          title="Cthulhu Prompt"
          draggable="false"
          ondragstart={(event) => event.preventDefault()}
        />
      </div>
      <div class="workspace-copy">
        <div class="workspace-title-row">
          <h1 class="text-sm">CthulhuPromptPublic</h1>
          <button
            class="workspace-open-button"
            type="button"
            aria-label="Open Workspace Folder"
            title="Open Workspace Folder"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </div>
        <p class="text-xs" title="C:\Source\PromptApps\CthulhuPromptPublic">
          C:\Source\PromptApps\CthulhuPromptPublic
        </p>
      </div>
    </header>

    <div class="separator"></div>

    <div class="folder-selector-wrap">
      <button class="folder-selector" type="button" aria-label={selectedFolder ? 'Folder selector' : 'Create Folder'} aria-expanded={folderMenuOpen} onclick={() => { if (selectedFolder) folderMenuOpen = !folderMenuOpen; else openCreateFolder() }}>
        <span class="selector-icon-cell">{#if selectedFolder}<FolderIcon size={20} aria-hidden="true" />{:else}<Plus size={20} aria-hidden="true" />{/if}</span>
        <span class="selector-copy">
          <span class="selector-title text-sm leading-5">{selectedFolder ? folderTitle : 'Create Folder'}</span>
          <span class="selector-detail text-xs leading-4.5">
            {#if selectedFolder}
            <span>{folderCount(selectedFolder)} {contentLabel.toLowerCase()}{folderCount(selectedFolder) === 1 ? '' : 's'}</span>
            <span class="separator-dot" aria-hidden="true"></span>
            <span>Updated today</span>
            {:else}<span>Create a {isTemplateFolder ? 'prompt template' : 'task prompt'} folder</span>{/if}
          </span>
        </span>
        {#if selectedFolder}<span class="selector-chevron">{#if folderMenuOpen}<ChevronUp size={20} aria-hidden="true" />{:else}<ChevronDown size={20} aria-hidden="true" />{/if}</span>{/if}
      </button>
      {#if folderMenuOpen}
        <div class="local-menu folder-menu">
          {#each visibleFolders as folder (folder.id)}
            <button class="folder-option text-sm leading-5" type="button" data-selected={selectedFolder?.id === folder.id}
              draggable="true" data-dragging={draggedFolderId === folder.id}
              ondragstart={(event) => { draggedFolderId = folder.id; event.dataTransfer?.setData('text/plain', folder.id) }}
              ondragover={(event) => { if (draggedFolderId) event.preventDefault() }}
              ondrop={(event) => { event.preventDefault(); reorderFolder(folder.id); draggedFolderId = null }}
              ondragend={() => { draggedFolderId = null }}
              onclick={() => selectFolder(folder)}>
              <GripVertical size={16} aria-hidden="true" /><FolderIcon size={20} aria-hidden="true" />
              <span>{folder.title}<small class="text-xs leading-4.5">{folderCount(folder)} {contentLabel.toLowerCase()}{folderCount(folder) === 1 ? '' : 's'} · Updated today</small></span>
              {#if selectedFolder?.id === folder.id}<ChevronRight size={20} aria-hidden="true" />{/if}
            </button>
          {/each}
          <div class="menu-footer"><button class="folder-option text-sm leading-5" type="button" onclick={openCreateFolder}><Plus size={20} aria-hidden="true" /><span>Create Folder<small class="text-xs leading-4.5">Create a {isTemplateFolder ? 'prompt template' : 'task prompt'} folder</small></span></button></div>
        </div>
      {/if}
    </div>

    <div class="separator"></div>

    <div class="prompts-header">
      <div class="prompts-actions">
        {@render IconAction(ArrowUpToLine, 'Show Folder Overview', () => { activeActivity = folderKind; isOverviewActive = true; selectedCategoryId = null }, false, !selectedFolder)}
        {#if selectedFolder && !isTemplateFolder}
          {@render IconAction(Check, 'Show Completed Prompts', () => { showCompleted = !showCompleted }, showCompleted)}
        {/if}
        {#if selectedFolder}
          {@render IconAction(Archive, `Show Archived ${contentLabel}s`, () => { showArchived = !showArchived }, showArchived)}
        {/if}
        {@render IconAction(areAllCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp,
          areAllCategoriesCollapsed ? 'Expand All Categories' : 'Collapse All Categories', toggleAllCategories, false, !selectedFolder)}
        {@render IconAction(FolderCog, 'Manage Categories', () => openCategories(), false, !selectedFolder)}
        {@render IconAction(MoreHorizontal, 'Selected Folder Actions', () => { actionsMenuOpen = !actionsMenuOpen }, actionsMenuOpen, !selectedFolder)}
      </div>
      {#if actionsMenuOpen}
        <div class="local-menu actions-menu">
          <button class="danger-action text-sm" type="button" onclick={() => { actionsMenuOpen = false; deleteDialog.showModal() }}><Trash2 size={16} />Delete Folder</button>
        </div>
      {/if}
    </div>

    <div class="status-accordion">
      {#if !selectedFolder}<p class="empty-folders text-sm">Create a folder to get started.</p>{/if}
      {#key selectedFolder?.id}
      {#each visibleGroups as group (group.id)}
        <section class="status-section" data-testid={`mock-status-section-${group.id}`} data-expanded={group.expanded}
          style={`flex:${group.expanded ? `${group.weight} 1 0px` : '0 0 36px'};`}>
          {#if group.expanded && visibleGroups.slice(0, visibleGroups.indexOf(group)).some((entry) => entry.expanded)}
            <button type="button" class="section-sash" aria-label={`Resize ${group.label} section`} tabindex="-1"
              onpointerdown={(event) => startResize(event, group)} onpointermove={moveDrag}
              onpointerup={stopDrag} onpointercancel={stopDrag} onlostpointercapture={stopDrag}></button>
          {/if}
          <button class="status-header" type="button" aria-expanded={group.expanded}
            onclick={() => { group.expanded = !group.expanded }}>
            <span class="status-chevron"><ChevronRight size={20} /></span>
            <group.icon size={16} />
            <span class="status-label text-sm leading-5">{group.label}</span>
            <span class="status-count text-xs leading-4.5">{groupCount(group)}</span>
          </button>
          {#if group.expanded}
            <div class="prompt-tree-shell" role="presentation"
              onmouseenter={() => { if (scrollMetrics[group.id]) scrollMetrics[group.id]!.hovered = true }}
              onmouseleave={() => { if (scrollMetrics[group.id]) scrollMetrics[group.id]!.hovered = false }}>
              <div class="prompt-tree" use:observeTree={group.id}>
                <div>
                  {#each group.prompts as entry, index (entry.id)}
                    {@render PromptRow(entry, 0, index === group.prompts.length - 1, group)}
                  {/each}
                  {#each group.categories as category (category.id)}
                    {@render CategoryRow(category, group)}
                  {/each}
                  {#if groupCount(group) === 0 && group.categories.length === 0}
                    <button class="empty-status text-xs leading-4.5" type="button" onclick={() => {
                      selectedGroupId = group.id
                      if (group.id === 'active' || group.id === 'backlog') {
                        const entry = prompt(window.crypto.randomUUID(), `New ${contentLabel}`)
                        group.prompts.push(entry)
                        selectPrompt(entry, group)
                      } else { activeActivity = folderKind; isOverviewActive = true }
                    }}>No {group.label.toLowerCase()} {contentLabel.toLowerCase()}s. Click to {group.id === 'active' || group.id === 'backlog' ? 'add' : 'view'}.</button>
                  {/if}
                  <div class="tree-bottom-spacer" aria-hidden="true"></div>
                </div>
              </div>
              {#if scrollMetrics[group.id]}
                {@const scroll = scrollMetrics[group.id]!}
                <div class="mock-overlay-scrollbar" data-visible={scroll.total > scroll.height && (scroll.hovered || scroll.dragging) ? 'true' : 'false'} aria-hidden="true">
                  <div class="mock-scrollbar-track" role="button" tabindex="-1"
                    onpointerdown={(event) => {
                      if (event.target !== event.currentTarget) return
                      const node = viewports[group.id]
                      if (node) node.scrollTop = (event.clientY - event.currentTarget.getBoundingClientRect().top - thumbHeight(scroll) / 2) / Math.max(1, scroll.height - thumbHeight(scroll)) * (scroll.total - scroll.height)
                    }}>
                    <div class="mock-scrollbar-thumb" class:active={scroll.dragging} role="button" tabindex="-1"
                      style={`height:${thumbHeight(scroll)}px; transform:translateY(${thumbTop(scroll)}px);`}
                      onpointerdown={(event) => startScroll(event, group.id)} onpointermove={moveDrag}
                      onpointerup={stopDrag} onpointercancel={stopDrag} onlostpointercapture={stopDrag}></div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/each}
      {/key}
    </div>
    <button class="resize-handle" type="button" aria-label="Resize sidebar" tabindex="-1"
      onpointerdown={(event) => startResize(event)} onpointermove={moveDrag}
      onpointerup={stopDrag} onpointercancel={stopDrag} onlostpointercapture={stopDrag}></button>
  </aside>
  {#if categoryMenu}
    <div class="local-menu category-menu" style={`left:${categoryMenu.x}px; top:${categoryMenu.y}px;`}>
      {#each [{ label: 'Open Category', icon: ArrowRight }, { label: 'Open Category Settings', icon: Settings }] as action (action.label)}
        <button class="text-sm" type="button" onclick={() => {
          if (action.icon === Settings) {
            openCategories(categoryMenu!.category.id)
            categoryMenu = null
            return
          }
          activeActivity = folderKind
          selectedCategoryId = categoryMenu!.category.id
          selectedGroupId = categoryMenu!.group.id
          selectedPromptId = ''
          isOverviewActive = false
          categoryMenu = null
        }}><action.icon size={16} />{action.label}</button>
      {/each}
    </div>
  {/if}
  <dialog bind:this={categoryDialog} class="mock-dialog category-dialog text-sm leading-5" aria-labelledby="mock-manage-title">
    <form onsubmit={(event) => { event.preventDefault(); saveCategories() }}>
      <header class="dialog-header"><FolderCog size={24} /><div><h2 id="mock-manage-title" class="text-lg font-semibold">Manage Categories</h2><p class="text-xs">{folderTitle}</p></div><button class="dialog-close" type="button" aria-label="Close" onclick={() => categoryDialog.close()}><X size={20} /></button></header>
      <div class="management-body">
        <div class="category-list">
          <h3 class="text-xs font-semibold">All Categories</h3>
          {#each categoryDrafts as draft (draft.id)}
            <button class="text-sm" type="button" data-selected={draft.id === draftId} onclick={() => { draftId = draft.id }}><Folder size={20} /><span>{draft.title || 'New Category'}<small class="text-xs">{groups.reduce((total, group) => total + (group.categories.find((category) => category.id === draft.id)?.prompts.length ?? 0), 0)} {contentLabel.toLowerCase()}s</small></span></button>
          {/each}
          <button class="text-sm" type="button" onclick={() => { draftId = window.crypto.randomUUID(); categoryDrafts.push({ id: draftId, title: '', prompts: [], shortDescription: '', description: '' }) }}><Plus size={20} />New Category</button>
        </div>
        <div class="category-editor">
          {#if selectedDraft}
            <div class="category-editor-heading"><Folder size={20} /><span>{selectedDraft.title || 'New Category'}<small class="text-xs">Category settings</small></span><button class="danger-action" type="button" aria-label="Delete category" onclick={() => { categoryDrafts = categoryDrafts.filter((draft) => draft.id !== draftId); draftId = categoryDrafts[0]?.id ?? '' }}><Trash2 size={20} /></button></div>
            <label>Category Name *<small class="text-xs">Required. Names must be unique in this folder.</small><input class="text-sm leading-5" bind:value={selectedDraft.title} required /></label>
            <label>Short Description<small class="text-xs">A brief summary to help you recognize this category.</small><input class="text-sm leading-5" bind:value={selectedDraft.shortDescription} /></label>
            <label>Full Description<small class="text-xs">Describe what belongs here and how to use these prompts.</small><textarea class="text-sm leading-5" bind:value={selectedDraft.description}></textarea></label>
          {/if}
        </div>
      </div>
      <footer class="dialog-footer"><button type="button" onclick={() => categoryDialog.close()}>Close</button><button class="accent-action" type="submit" disabled={!validDrafts}><Check size={16} />Save Changes</button></footer>
    </form>
  </dialog>
  <dialog bind:this={folderDialog} class="mock-dialog text-sm leading-5" aria-labelledby="mock-create-title">
    <form onsubmit={(event) => { event.preventDefault(); createFolder() }}>
      <header class="dialog-header"><FolderIcon size={24} /><div><h2 id="mock-create-title" class="text-lg font-semibold">Create {isTemplateFolder ? 'Prompt Template' : 'Task Prompt'} Folder</h2><p class="text-xs">{isTemplateFolder ? 'Organize reusable prompts for repeatable workflows.' : 'Organize one-time prompts for individual tasks.'}</p></div></header>
      <div class="dialog-body"><label>Folder Name<input class="text-sm leading-5" bind:value={folderName} required /></label><p class="text-xs">Required. Names must be unique among {isTemplateFolder ? 'prompt template' : 'task prompt'} folders.</p></div>
      <footer class="dialog-footer"><button type="button" onclick={() => folderDialog.close()}>Cancel</button><button class="accent-action" type="submit" disabled={!validFolderName}>Create Folder</button></footer>
    </form>
  </dialog>
  <dialog bind:this={deleteDialog} class="mock-dialog text-sm leading-5" aria-labelledby="mock-delete-title">
    <form onsubmit={(event) => { event.preventDefault(); folders = folders.filter((folder) => folder.id !== selectedFolder?.id); selectedPromptId = ''; selectedCategoryId = null; deleteDialog.close() }}>
      <header class="dialog-header"><Trash2 size={24} /><h2 id="mock-delete-title" class="text-lg font-semibold">Delete Folder</h2></header>
      <p class="dialog-body">Delete “{folderTitle}” and its {contentLabel.toLowerCase()}s?</p>
      <footer class="dialog-footer"><button type="button" onclick={() => deleteDialog.close()}>Cancel</button><button class="danger-action" type="submit">Delete Folder</button></footer>
    </form>
  </dialog>
</main>

<style>
  .sidebar-base-stage {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    min-height: 0;
    min-width: 0;
    width: 100%;
  }

  .sidebar-base-stage {
    --cthulhu-ui-radius-card: 8px;
    --cthulhu-ui-radius-control: 6px;
  }

  .mock-activity-bar {
    display: flex;
    flex: 0 0 48px;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 0;
    background: var(--ui-chrome-normal-surface);
    border-right: 1px solid var(--ui-neutral-muted-border);
    border-top: 1px solid var(--ui-neutral-hover-border);
  }

  .activity-button {
    position: relative;
    display: inline-flex;
    height: 44px;
    width: 100%;
    flex: none;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: var(--ui-ghost-surface);
    color: var(--ui-muted-icon-glyph);
    cursor: pointer;
  }

  .activity-button:hover,
  .activity-button:focus-visible,
  .activity-button[aria-current='page'] {
    color: var(--ui-normal-text);
  }

  .activity-button[aria-current='page']::before {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background: var(--ui-accent-strong-border);
    content: '';
  }

  .mock-sidebar {
    background: var(--ui-chrome-normal-surface);
    border-right: 1px solid var(--ui-neutral-hover-border);
    border-top: 1px solid var(--ui-neutral-hover-border);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    display: flex;
    flex: 0 0 var(--sidebar-width);
    flex-direction: column;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    height: 100%;
    max-width: 100%;
    min-height: 0;
    position: relative;
    user-select: none;
    width: var(--sidebar-width);
  }


  .workspace-header {
    align-items: flex-start;
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    padding: 16px 8px 12px;
  }

  .workspace-icon-cell {
    align-items: center;
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .workspace-icon-cell img {
    height: 32px;
    object-fit: contain;
    width: 32px;
  }

  .workspace-copy {
    flex: 1 1 auto;
    min-width: 0;
  }

  .workspace-title-row {
    align-items: center;
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  .workspace-title-row h1 {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.025em;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-copy p {
    color: var(--ui-muted-text);
    margin: 0;
    overflow: hidden;
    padding-top: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-open-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 18px;
    height: 18px;
    justify-content: center;
    margin-left: 2px;
    padding: 0;
    width: 18px;
  }

  .workspace-open-button:hover,
  .workspace-open-button:focus-visible {
    color: var(--ui-normal-text);
  }

  .separator {
    border-top: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    flex: 0 0 1px;
    height: 1px;
    width: 100%;
  }

  .folder-selector-wrap {
    flex: 0 0 auto;
    padding: 4px 8px;
  }

  .folder-selector {
    align-items: center;
    background: transparent;
    border: 1px solid var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    grid-template-columns: 34px 8px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 7px;
    text-align: left;
    width: 100%;
  }

  .folder-selector:hover,
  .folder-selector:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .folder-selector[aria-expanded='true'] {
    background: var(--ui-neutral-action-hover-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .selector-icon-cell {
    align-items: center;
    display: flex;
    grid-column: 1;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .selector-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    grid-column: 3;
    min-width: 0;
  }

  .selector-title {
    font-weight: var(--font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selector-detail {
    align-items: center;
    color: inherit;
    display: flex;
    gap: 6px;
    min-width: 0;
    white-space: nowrap;
  }

  .separator-dot {
    background: var(--ui-muted-icon-glyph);
    border-radius: 50%;
    display: inline-block;
    height: 3px;
    opacity: 0.7;
    width: 3px;
  }

  .selector-chevron {
    align-items: center;
    display: flex;
    grid-column: 4;
    justify-content: center;
  }

  .prompts-header {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
    min-height: 40px;
    padding: 8px;
  }

  .prompts-actions {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 2px;
  }

  .icon-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 36px;
    height: 36px;
    justify-content: center;
    padding: 0;
    width: 36px;
  }

  .icon-action:hover,
  .icon-action:focus-visible {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .prompt-tree-shell {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  }

  .prompt-tree {
    height: 100%;
    outline: none;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
    width: 100%;
  }

  .prompt-tree::-webkit-scrollbar {
    display: none;
  }

  .tree-prompt-row,
  .tree-category-row {
    box-sizing: border-box;
    padding-block: 1px;
    width: 100%;
  }

  .tree-prompt-row {
    position: relative;
  }


  .tree-prompt-button {
    align-items: center;
    background: transparent;
    border: 0;
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: calc(5px + 12px * var(--tree-indent-count)) minmax(0, 1fr);
    height: 30px;
    min-width: 0;
    padding: 0 22px 0 0;
    text-align: left;
    width: 100%;
  }

  .tree-prompt-button:hover,
  .tree-prompt-button:focus-visible,
  .tree-category-content:hover {
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .tree-prompt-button[data-active='true'] {
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  .tree-prompt-button[data-active='true']:hover {
    background: var(--ui-neutral-selection-surface);
  }

  .tree-category-content {
    align-items: center;
    background: transparent;
    color: var(--ui-hoverable-text);
    display: flex;
    height: 30px;
    position: relative;
    width: 100%;
  }

  .tree-category-content[data-active='true'] {
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  .local-menu.category-menu {
    position: fixed;
    width: 196px;
  }

  .tree-category-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: 24px 18px minmax(0, 1fr);
    height: 100%;
    inset: 0;
    min-width: 0;
    padding: 0 12px 0 6px;
    position: absolute;
    text-align: left;
    width: 100%;
  }

  .tree-chevron {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 24px;
    justify-content: center;
    transform: rotate(0deg);
    transition: transform var(--ui-animation-duration-fast) ease-out;
    width: 24px;
  }

  .tree-chevron[data-expanded='true'] {
    transform: rotate(90deg);
  }

  .tree-category-toggle :global(.tree-category-icon) {
    color: var(--ui-secondary-icon-glyph);
    justify-self: center;
  }

  .tree-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-category-toggle .tree-label {
    font-weight: var(--font-weight-normal);
  }

  .tree-category-actions {
    display: none;
    margin-left: auto;
    margin-right: 14px;
    position: relative;
    z-index: 1;
  }

  .tree-category-content:hover .tree-category-actions,
  .tree-category-content:focus-within .tree-category-actions {
    display: flex;
  }

  .tree-category-content:hover .tree-category-toggle,
  .tree-category-content:focus-within .tree-category-toggle {
    padding-right: 56px;
  }

  .tree-category-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    cursor: pointer;
    display: flex;
    height: 28px;
    justify-content: center;
    padding: 0;
    width: 28px;
  }

  .tree-category-action:hover,
  .tree-category-action:focus-visible {
    background: var(--ui-neutral-normal-surface);
  }

  .tree-gutter {
    align-self: stretch;
    height: 30px;
    margin-left: 5px;
    min-height: 30px;
    min-width: 0;
    position: relative;
  }

  .tree-guide {
    background: var(--ui-neutral-emphasis-border);
    bottom: -1px;
    left: calc(8px + 12px * var(--tree-guide-index));
    opacity: 0;
    position: absolute;
    top: -1px;
    transition: opacity var(--ui-animation-duration-standard) ease-out;
    width: 1px;
  }

  .tree-gutter[data-last-row='true'] .tree-guide {
    bottom: 0;
  }

  .prompt-tree-shell:hover .tree-guide,
  .prompt-tree-shell:focus-within .tree-guide {
    opacity: 1;
  }

  .mock-overlay-scrollbar {
    bottom: 0;
    display: flex;
    opacity: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
    transition: opacity 800ms linear;
    user-select: none;
    width: 10px;
  }

  .mock-overlay-scrollbar[data-visible='true'] {
    opacity: 1;
    pointer-events: auto;
    transition: opacity var(--ui-animation-duration-standard) linear;
    z-index: 11;
  }

  .mock-scrollbar-track {
    background: transparent;
    height: 100%;
    position: relative;
    width: 100%;
  }

  .mock-scrollbar-thumb {
    background: var(--ui-neutral-emphasis-border);
    left: 0;
    position: absolute;
    right: 0;
    touch-action: none;
  }

  .mock-scrollbar-thumb:hover {
    background: var(--ui-neutral-hover-border);
  }

  .mock-scrollbar-thumb.active {
    background: var(--ui-secondary-icon-glyph);
  }

  .tree-bottom-spacer {
    height: 32px;
  }

  .resize-handle {
    background: transparent;
    border: 0;
    padding: 0;
    touch-action: none;
    bottom: 0;
    cursor: ew-resize;
    position: absolute;
    right: -3px;
    top: 0;
    width: 6px;
    z-index: 2;
  }
  .status-accordion {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .status-section {
    display: flex;
    flex-direction: column;
    min-height: 100px;
    position: relative;
  }

  .status-section[data-expanded='false'] {
    min-height: 36px;
  }

  .status-header {
    display: grid;
    grid-template-columns: 24px 18px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: center;
    flex: 0 0 36px;
    height: 36px;
    width: 100%;
    padding: 0 12px 0 6px;
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    background: var(--ui-ghost-surface);
    color: var(--ui-muted-text);
    cursor: pointer;
    text-align: left;
  }

  .status-chevron {
    display: flex;
    justify-content: center;
    color: var(--ui-muted-icon-glyph);
  }

  .status-section[data-expanded='true'] .status-chevron {
    transform: rotate(90deg);
  }

  .status-header :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .status-header:hover, .status-header:focus-visible,
  .status-header:hover :global(svg), .status-header:focus-visible :global(svg) {
    color: var(--ui-normal-text);
  }

  .status-label {
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-count {
    font-variant-numeric: tabular-nums;
  }

  .section-sash {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: ns-resize;
    touch-action: none;
    z-index: 3;
  }

  .section-sash:active, .resize-handle:active {
    background: var(--ui-info-strong-border);
  }

  .icon-action[data-active='true'] {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .icon-action:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .prompt-status-indicator {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    pointer-events: none;
    z-index: 1;
    --status-color: transparent;
    background: var(--status-color);
  }

  .prompt-status-indicator[data-edited='true'] {
    --status-color: var(--ui-info-strong-border);
  }

  .prompt-status-indicator[data-status='InProgress'] {
    --status-color: var(--ui-warning-icon-glyph);
  }

  .prompt-status-indicator[data-status='Completed'] {
    --status-color: var(--ui-success-normal-text);
  }

  .prompt-status-indicator[data-status='Archived'] {
    --status-color: var(--ui-secondary-icon-glyph);
  }

  .empty-category, .empty-status {
    display: block;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--ui-secondary-text);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .empty-category {
    height: 24px;
    padding: 0 12px 0 24px;
  }

  .empty-status {
    height: 24px;
    padding: 0 12px;
  }

  .empty-category:hover, .empty-status:hover {
    color: var(--ui-normal-text);
  }

  .folder-selector-wrap, .prompts-header {
    position: relative;
  }

  .local-menu {
    position: absolute;
    z-index: 20;
    padding: 4px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 8px;
    background: var(--ui-card-overlay-surface);
    color: var(--ui-normal-text);
    box-shadow: 0 0 12px var(--ui-shadow-raised);
  }

  .folder-menu {
    top: 100%;
    left: 8px;
    width: max(320px, calc(100% - 16px));
    padding: 6px;
  }

  .actions-menu {
    top: 100%;
    right: 8px;
    width: 204px;
  }

  .local-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    background: transparent;
    color: var(--ui-hoverable-text);
    border: 0;
    text-align: left;
    cursor: pointer;
  }

  .local-menu button:hover, .local-menu button:focus-visible {
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .local-menu small {
    display: block;
  }

  .local-menu .folder-option {
    display: grid;
    grid-template-columns: 22px 34px minmax(0, 1fr) 22px;
    height: 58px;
    border: 1px solid var(--ui-ghost-surface);
    border-radius: 8px;
    gap: 8px;
  }

  .folder-option :global(svg) {
    justify-self: center;
  }

  .local-menu .folder-option[data-dragging='true'] {
    background: var(--ui-info-normal-surface);
  }

  .menu-footer .folder-option {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .empty-folders {
    color: var(--ui-muted-text);
    padding: 0 8px;
    margin: 0;
  }

  .folder-option > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .folder-option small {
    font-weight: var(--font-weight-normal);
  }

  .local-menu .folder-option[data-selected='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .local-menu .folder-option[data-selected='true']:hover,
  .menu-footer button:hover, .menu-footer button:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .menu-footer {
    border-top: 1px solid var(--ui-neutral-muted-border);
    margin-top: 5px;
    padding-top: 5px;
  }

  .mock-dialog {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 8px;
    padding: 0;
    background: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    width: 560px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    margin: auto;
  }

  .mock-dialog::backdrop {
    background: var(--ui-card-normal-shadow);
  }

  .category-dialog {
    width: 1040px;
  }

  .dialog-header, .dialog-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
  }

  .dialog-header {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .dialog-header h2, .dialog-header p {
    margin: 0;
  }

  .mock-dialog small, .mock-dialog p {
    color: var(--ui-muted-text);
  }

  .mock-dialog small {
    display: block;
    font-weight: var(--font-weight-normal);
  }

  .mock-dialog input, .mock-dialog textarea {
    display: block;
    width: 100%;
    margin: 8px 0 17px;
    padding: 8px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 6px;
    background: var(--ui-ghost-surface);
    color: inherit;
  }

  .mock-dialog textarea {
    height: 176px;
    resize: vertical;
    background: var(--ui-editor-content-surface);
  }

  .dialog-footer {
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .mock-dialog button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 6px;
    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
    cursor: pointer;
  }

  .mock-dialog button:hover, .mock-dialog button:focus-visible {
    background: var(--ui-neutral-action-hover-fill);
  }

  .mock-dialog button:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .mock-dialog .accent-action {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-normal-border);
  }

  .mock-dialog .accent-action:hover, .mock-dialog .accent-action:focus-visible {
    background: var(--ui-accent-action-hover-fill);
  }

  .mock-dialog .danger-action, .local-menu .danger-action {
    color: var(--ui-danger-icon-glyph);
  }

  .mock-dialog .dialog-close {
    margin-left: auto;
  }

  .management-body {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    height: min(570px, calc(100vh - 212px));
    min-height: 240px;
    padding: 0 24px;
  }

  .category-list {
    padding: 16px 12px 16px 0;
    overflow: auto;
    border-right: 1px solid var(--ui-neutral-muted-border);
  }

  .category-list h3 {
    color: var(--ui-muted-text);
    margin: 0 0 12px;
  }

  .category-list button {
    width: 100%;
    min-height: 58px;
    border-color: var(--ui-ghost-surface);
    background: var(--ui-ghost-surface);
    text-align: left;
    color: var(--ui-hoverable-text);
  }

  .category-list button:hover, .category-list button:focus-visible {
    color: var(--ui-normal-text);
  }

  .category-list button[data-selected='true'] {
    background: var(--ui-accent-action-fill);
    color: var(--ui-normal-text);
  }

  .category-editor {
    padding: 16px 8px 22px 26px;
    min-width: 0;
    overflow: auto;
  }

  .category-editor-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
  }

  .category-editor-heading button {
    margin-left: auto;
  }

  .dialog-body {
    padding: 24px;
  }
</style>
