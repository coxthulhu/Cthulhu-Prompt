<script lang="ts">
  import {
    Archive, ArrowRight, ArrowUpToLine, Bookmark, Check, ChevronsDownUp, ChevronsUpDown,
    ChevronDown, ChevronRight, CircleCheckBig, ExternalLink, Folder, FolderPlus,
    ListTodo, MoreHorizontal, Plus, Settings, Trash2
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  // Visual sandbox: only icons, the brand image, and palette tokens are shared with the app.
  // All sample data and interactions below are local and reset when this mockup unmounts.
  type MockPrompt = { id: string; title: string; status?: string; edited?: boolean }
  type MockCategory = { id: string; title: string; prompts: MockPrompt[] }
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
    }
  ]


  let groups = $state<MockGroup[]>([
    { id: 'completed', label: 'Completed', icon: CircleCheckBig, expanded: true, weight: 200,
      prompts: [{ ...prompt('completed-audit', 'Audit the existing sidebar'), status: 'Completed' }], categories: [] },
    { id: 'archived', label: 'Archived', icon: Archive, expanded: true, weight: 200,
      prompts: [{ ...prompt('archived-layout', 'Explore the previous layout'), status: 'Archived' }], categories: [] },
    { id: 'active', label: 'Active', icon: ListTodo, expanded: true, weight: 400,
      prompts: uncategorizedPrompts, categories },
    { id: 'backlog', label: 'Backlog', icon: Bookmark, expanded: true, weight: 200,
      prompts: [prompt('future-search', 'Explore prompt search'), prompt('future-shortcuts', 'Plan keyboard shortcuts')],
      categories: [{ id: 'ideas', title: 'Ideas', prompts: [] }] }
  ])
  let showCompleted = $state(false)
  let showArchived = $state(false)
  let expandedCategoryIds = $state<Record<string, boolean>>({ research: true, verification: true, ideas: true })
  let selectedPromptId = $state('map-implementation')
  let selectedGroupId = $state('active')
  let navigationGeneration = $state(0)
  let isOverviewActive = $state(false)
  let sidebarWidth = $state(275)
  let categoryName = $state('')
  let categoryDialog: HTMLDialogElement
  let folderTitle = $state('Product Work')
  let folderMenuOpen = $state(false)
  let actionsMenuOpen = $state(false)
  let categoryMenu = $state<{ category: MockCategory; group: MockGroup; x: number; y: number } | null>(null)
  let selectedCategoryId = $state<string | null>(null)
  const closeMenus = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('.local-menu, .folder-selector, .prompts-actions')) return
    folderMenuOpen = false
    actionsMenuOpen = false
    categoryMenu = null
  }
  const visibleGroups = $derived(groups.filter((group) =>
    group.id === 'active' || group.id === 'backlog' ||
    (group.id === 'completed' && showCompleted) || (group.id === 'archived' && showArchived)))
  const toolbarGroup = $derived(groups.find((group) => group.id ===
    (selectedGroupId === 'backlog' ? 'backlog' : 'active'))!)
  const areAllCategoriesCollapsed = $derived(toolbarGroup.categories.every((category) => !expandedCategoryIds[category.id]))
  const folderPromptCount = $derived(groups.filter((group) => group.id === 'active' || group.id === 'backlog')
    .reduce((sum, group) => sum + group.prompts.length + group.categories.reduce((n, category) => n + category.prompts.length, 0), 0))
  const groupCount = (group: MockGroup) => group.prompts.length + group.categories.reduce((sum, category) => sum + category.prompts.length, 0)

  const selectPrompt = (entry: MockPrompt, group: MockGroup) => {
    selectedCategoryId = null
    selectedPromptId = entry.id
    selectedGroupId = group.id
    isOverviewActive = false
    navigationGeneration += 1
  }
  const addPrompt = (category: MockCategory, group: MockGroup) => {
    const entry = prompt(window.crypto.randomUUID(), 'New Prompt')
    category.prompts.unshift(entry)
    expandedCategoryIds[category.id] = true
    selectPrompt(entry, group)
  }
  const addCategory = () => {
    if (!categoryName.trim()) return
    const id = window.crypto.randomUUID()
    toolbarGroup.categories.push({ id, title: categoryName.trim(), prompts: [] })
    toolbarGroup.expanded = true
    expandedCategoryIds[id] = true
    categoryName = ''
    categoryDialog.close()
  }
  const toggleAllCategories = () => {
    const expand = areAllCategoriesCollapsed
    for (const category of toolbarGroup.categories) expandedCategoryIds[category.id] = expand
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
    {#key !isOverviewActive && selectedPromptId === promptEntry.id ? navigationGeneration : 0}
      <span class="prompt-status-indicator" data-status={promptEntry.status} data-edited={promptEntry.edited}
        data-highlight={!isOverviewActive && selectedPromptId === promptEntry.id && navigationGeneration > 0} aria-hidden="true"></span>
    {/key}
    <button
      class="tree-prompt-button"
      data-active={!isOverviewActive && selectedPromptId === promptEntry.id ? 'true' : 'false'}
      type="button"
      aria-current={!isOverviewActive && selectedPromptId === promptEntry.id ? 'true' : undefined}
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
    <div class="tree-category-content" role="group" data-active={selectedCategoryId === category.id}
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
          aria-label={`Add Prompt to top of category ${category.title}`}
          title={`Add Prompt to top of category ${category.title}`}
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
      <button class="empty-category text-xs" type="button" onclick={() => addPrompt(category, group)}>Category is empty, click to add a prompt</button>
    {/each}
  {/if}
{/snippet}

<svelte:window onclick={closeMenus} onkeydown={(event) => {
  if (event.key === 'Escape') { folderMenuOpen = false; actionsMenuOpen = false; categoryMenu = null }
}} />

<main class="sidebar-base-stage" data-testid="app-sidebar-base-mockup">
  <aside class="mock-sidebar" style={`--sidebar-width:${sidebarWidth}px;`} aria-label="Cthulhu Prompt sidebar">
    <header class="workspace-header">
      <div class="workspace-icon-cell">
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          title="Made in R'lyeh"
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
      <button class="folder-selector" type="button" aria-label="Folder selector" aria-expanded={folderMenuOpen} onclick={() => { folderMenuOpen = !folderMenuOpen }}>
        <span class="selector-icon-cell"><Folder size={20} aria-hidden="true" /></span>
        <span class="selector-copy">
          <span class="selector-title text-sm">{folderTitle}</span>
          <span class="selector-detail text-xs">
            <span>{folderPromptCount} prompts</span>
            <span class="separator-dot" aria-hidden="true"></span>
            <span>Updated today</span>
          </span>
        </span>
        <span class="selector-chevron"><ChevronDown size={20} aria-hidden="true" /></span>
      </button>
      {#if folderMenuOpen}
        <div class="local-menu folder-menu">
          {#each ['Product Work', 'Personal Projects'] as title (title)}
            <button class="text-sm" type="button" onclick={() => { folderTitle = title; folderMenuOpen = false }}><Folder size={20} /><span>{title}<small class="text-xs">{folderPromptCount} prompts · Updated today</small></span>{#if folderTitle === title}<Check size={16} />{/if}</button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="separator"></div>

    <div class="prompts-header">
      <div class="prompts-actions">
        {@render IconAction(ArrowUpToLine, 'Show Folder Overview', () => { isOverviewActive = true; selectedCategoryId = null }, isOverviewActive)}
        {@render IconAction(Check, 'Show Completed Prompts', () => { showCompleted = !showCompleted; groups[0]!.expanded = true }, showCompleted)}
        {@render IconAction(Archive, 'Show Archived Prompts', () => { showArchived = !showArchived; groups[1]!.expanded = true }, showArchived)}
        {@render IconAction(areAllCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp,
          areAllCategoriesCollapsed ? 'Expand All Categories' : 'Collapse All Categories', toggleAllCategories, false, toolbarGroup.categories.length === 0)}
        {@render IconAction(FolderPlus, 'Add Category', () => categoryDialog.showModal())}
        {@render IconAction(MoreHorizontal, 'Selected Prompt Folder Actions', () => { actionsMenuOpen = !actionsMenuOpen }, actionsMenuOpen)}
      </div>
      {#if actionsMenuOpen}
        <div class="local-menu actions-menu">
          <button class="text-sm" type="button" onclick={() => { folderTitle = 'No prompt folder selected'; groups.forEach((group) => { group.prompts = []; group.categories = [] }); actionsMenuOpen = false }}><Trash2 size={16} />Delete Prompt Folder</button>
        </div>
      {/if}
    </div>

    <div class="status-accordion">
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
            <span class="status-label text-sm">{group.label.toUpperCase()}</span>
            <span class="status-count text-xs">{groupCount(group)}</span>
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
                    <button class="empty-status text-sm" type="button" onclick={() => { selectedGroupId = group.id }}>No {group.label.toLowerCase()} prompts. Click to view.</button>
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
    </div>
    <button class="resize-handle" type="button" aria-label="Resize sidebar" tabindex="-1"
      onpointerdown={(event) => startResize(event)} onpointermove={moveDrag}
      onpointerup={stopDrag} onpointercancel={stopDrag} onlostpointercapture={stopDrag}></button>
  </aside>
  {#if categoryMenu}
    <div class="local-menu category-menu" style={`left:${categoryMenu.x}px; top:${categoryMenu.y}px;`}>
      {#each [{ label: 'Open Category', icon: ArrowRight }, { label: 'Open Category Settings', icon: Settings }] as action (action.label)}
        <button class="text-sm" type="button" onclick={() => {
          selectedCategoryId = categoryMenu!.category.id
          selectedGroupId = categoryMenu!.group.id
          selectedPromptId = ''
          isOverviewActive = false
          categoryMenu = null
        }}><action.icon size={16} />{action.label}</button>
      {/each}
    </div>
  {/if}
  <dialog bind:this={categoryDialog} class="category-dialog">
    <form onsubmit={(event) => { event.preventDefault(); addCategory() }}>
      <h2 class="text-lg">Create Category</h2>
      <label>Category name<input bind:value={categoryName} required /></label>
      <div><button type="button" onclick={() => categoryDialog.close()}>Cancel</button><button type="submit">Create Category</button></div>
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
    color: var(--ui-hoverable-icon-glyph);
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
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    cursor: pointer;
    display: grid;
    grid-template-columns: 34px 8px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    width: 100%;
  }

  .folder-selector:hover,
  .folder-selector:focus-visible {
    background: var(--ui-neutral-action-fill);
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
    color: var(--ui-normal-text);
    display: flex;
    line-height: 18px;
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
    color: var(--ui-hoverable-icon-glyph);
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

  .status-header:hover, .status-header:focus-visible, .status-header:hover :global(svg) {
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
    line-height: 18px;
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

  .prompt-status-indicator[data-highlight='true'] {
    animation: navigation-highlight 670ms linear;
  }

  @keyframes navigation-highlight { 0%, 100% { background: var(--status-color); } 7.4627%, 82.0896% { background: var(--ui-accent-strong-border); } }
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
    line-height: 18px;
  }

  .empty-status {
    height: 32px;
    padding: 0 16px;
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
    background: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
  }

  .folder-menu {
    top: 100%;
    left: 8px;
    right: 8px;
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
    color: inherit;
    border: 0;
    text-align: left;
    cursor: pointer;
  }

  .local-menu button:hover {
    background: var(--ui-neutral-normal-surface);
  }

  .local-menu small {
    display: block;
    line-height: 18px;
  }

  .category-dialog {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 8px;
    padding: 24px;
    background: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
  }

  .category-dialog h2 {
    margin: 0 0 16px;
  }

  .category-dialog input {
    display: block;
    margin: 8px 0 20px;
    padding: 8px;
    border: 1px solid var(--ui-neutral-normal-border);
    background: var(--ui-ghost-surface);
    color: inherit;
  }

  .category-dialog form > div {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .category-dialog button {
    padding: 8px 12px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 6px;
    background: var(--ui-neutral-action-fill);
    color: inherit;
    cursor: pointer;
  }

</style>
