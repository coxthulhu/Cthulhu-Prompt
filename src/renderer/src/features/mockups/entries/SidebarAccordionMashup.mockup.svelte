<script lang="ts">
  import {
    ArrowRight,
    Check,
    ChevronsDownUp,
    ChevronDown,
    ChevronRight,
    CircleCheckBig,
    ExternalLink,
    Folder,
    ListTodo,
    MoreHorizontal,
    Plus,
    Settings
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  type MockPrompt = {
    id: string
    title: string
  }

  type MockCategory = {
    id: string
    title: string
    prompts: MockPrompt[]
  }

  const prompt = (id: string, title: string): MockPrompt => ({ id, title })
  const indentLevels = (indentCount: number): number[] =>
    Array.from({ length: indentCount }, (_, index) => index)

  const uncategorizedPrompts: MockPrompt[] = [
    prompt('map-implementation', 'Map the current implementation'),
    prompt('clarify-requirements', 'Clarify product requirements'),
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

  const completedPrompts: MockPrompt[] = [
    prompt('completed-project-scope', 'Summarize the project scope'),
    prompt('completed-user-flows', 'Map the primary user flows'),
    prompt('completed-ui-inventory', 'Create a UI inventory')
  ]

  const completedCategories: MockCategory[] = [
    {
      id: 'completed-discovery',
      title: 'Discovery',
      prompts: [
        prompt('completed-interviews', 'Synthesize user interviews'),
        prompt('completed-competitors', 'Review competitor workflows')
      ]
    }
  ]

  let expandedCategoryIds = $state<Record<string, boolean>>({
    'completed-discovery': true,
    research: true,
    verification: true
  })
  let selectedPromptId = $state('map-implementation')
  let promptTreeElement = $state<HTMLDivElement | null>(null)
  let promptTreeScrollTopPx = $state(0)
  let promptTreeViewportHeightPx = $state(0)
  let promptTreeScrollHeightPx = $state(0)
  let isPromptTreeHovered = $state(false)
  let isScrollbarDragging = $state(false)
  let scrollbarDragOffsetPx = 0

  const SCROLLBAR_WIDTH_PX = 10
  const MIN_SCROLLBAR_THUMB_HEIGHT_PX = 20
  const promptTreeMaxScrollTopPx = $derived(
    Math.max(0, promptTreeScrollHeightPx - promptTreeViewportHeightPx)
  )
  const scrollbarThumbHeightPx = $derived.by(() => {
    if (promptTreeScrollHeightPx <= 0) return MIN_SCROLLBAR_THUMB_HEIGHT_PX
    const proportionalHeight =
      (promptTreeViewportHeightPx / promptTreeScrollHeightPx) * promptTreeViewportHeightPx
    return Math.min(
      promptTreeViewportHeightPx,
      Math.max(MIN_SCROLLBAR_THUMB_HEIGHT_PX, proportionalHeight)
    )
  })
  const scrollbarMaxThumbTopPx = $derived(
    Math.max(0, promptTreeViewportHeightPx - scrollbarThumbHeightPx)
  )
  const scrollbarThumbTopPx = $derived(
    promptTreeMaxScrollTopPx <= 0
      ? 0
      : (promptTreeScrollTopPx / promptTreeMaxScrollTopPx) * scrollbarMaxThumbTopPx
  )
  const isScrollbarNeeded = $derived(promptTreeScrollHeightPx > promptTreeViewportHeightPx)
  const areAllCategoriesCollapsed = $derived(
    categories.every((category) => expandedCategoryIds[category.id] === false)
  )

  const measurePromptTree = () => {
    if (!promptTreeElement) return
    promptTreeViewportHeightPx = promptTreeElement.clientHeight
    promptTreeScrollHeightPx = promptTreeElement.scrollHeight
    promptTreeScrollTopPx = promptTreeElement.scrollTop
  }

  const observePromptTree = (node: HTMLDivElement) => {
    promptTreeElement = node
    measurePromptTree()

    // Side effect: keep the local overlay scrollbar sized to the mock tree viewport.
    const resizeObserver = new ResizeObserver(measurePromptTree)
    resizeObserver.observe(node)

    return {
      destroy() {
        resizeObserver.disconnect()
        if (promptTreeElement === node) promptTreeElement = null
      }
    }
  }

  const applyPromptTreeScrollTop = (nextScrollTopPx: number) => {
    if (!promptTreeElement) return
    promptTreeElement.scrollTop = Math.min(Math.max(nextScrollTopPx, 0), promptTreeMaxScrollTopPx)
    promptTreeScrollTopPx = promptTreeElement.scrollTop
  }

  const applyScrollbarThumbTop = (nextThumbTopPx: number) => {
    if (scrollbarMaxThumbTopPx <= 0) {
      applyPromptTreeScrollTop(0)
      return
    }

    const clampedThumbTopPx = Math.min(Math.max(nextThumbTopPx, 0), scrollbarMaxThumbTopPx)
    applyPromptTreeScrollTop(
      (clampedThumbTopPx / scrollbarMaxThumbTopPx) * promptTreeMaxScrollTopPx
    )
  }

  const handleScrollbarTrackPointerDown = (event: PointerEvent) => {
    if (!(event.currentTarget instanceof HTMLDivElement) || event.target !== event.currentTarget) {
      return
    }

    const trackRect = event.currentTarget.getBoundingClientRect()
    applyScrollbarThumbTop(event.clientY - trackRect.top - scrollbarThumbHeightPx / 2)
  }

  const handleScrollbarThumbPointerDown = (event: PointerEvent) => {
    if (!(event.currentTarget instanceof HTMLDivElement)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const thumbRect = event.currentTarget.getBoundingClientRect()
    scrollbarDragOffsetPx = event.clientY - thumbRect.top
    isScrollbarDragging = true
  }

  const handleScrollbarThumbPointerMove = (event: PointerEvent) => {
    if (!isScrollbarDragging || !(event.currentTarget instanceof HTMLDivElement)) return
    const trackRect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!trackRect) return
    applyScrollbarThumbTop(event.clientY - trackRect.top - scrollbarDragOffsetPx)
  }

  const handleScrollbarThumbPointerUp = (event: PointerEvent) => {
    if (!(event.currentTarget instanceof HTMLDivElement)) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    isScrollbarDragging = false
  }

  const setCategoryExpanded = (categoryId: string, isExpanded: boolean) => {
    expandedCategoryIds = { ...expandedCategoryIds, [categoryId]: isExpanded }
    window.queueMicrotask(measurePromptTree)
  }

  const toggleAllCategories = () => {
    const nextExpanded = areAllCategoriesCollapsed
    expandedCategoryIds = Object.fromEntries(
      categories.map((category) => [category.id, nextExpanded])
    )
    window.queueMicrotask(measurePromptTree)
  }
</script>

{#snippet IconAction(
  Icon: typeof Plus,
  label: string,
  onclick: (() => void) | undefined = undefined
)}
  <button class="icon-action" type="button" aria-label={label} title={label} {onclick}>
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

{#snippet PromptRow(promptEntry: MockPrompt, indentCount: number, isLastRow: boolean)}
  <div class="tree-prompt-row" style={`--tree-indent-count:${indentCount};`}>
    <button
      class="tree-prompt-button"
      data-active={selectedPromptId === promptEntry.id ? 'true' : 'false'}
      type="button"
      aria-current={selectedPromptId === promptEntry.id ? 'true' : undefined}
      onclick={() => {
        selectedPromptId = promptEntry.id
      }}
    >
      {@render TreeGutter(indentCount, isLastRow)}
      <span class="tree-label">{promptEntry.title}</span>
    </button>
  </div>
{/snippet}

{#snippet CategoryRow(category: MockCategory, isLastCategory: boolean)}
  <div class="tree-category-row">
    <div class="tree-category-content">
      <button
        class="tree-category-toggle"
        type="button"
        aria-label={`${expandedCategoryIds[category.id] ? 'Collapse' : 'Expand'} category ${category.title}`}
        aria-expanded={expandedCategoryIds[category.id]}
        onclick={() => setCategoryExpanded(category.id, !expandedCategoryIds[category.id])}
      >
        <span
          class="tree-chevron"
          data-expanded={expandedCategoryIds[category.id] ? 'true' : 'false'}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </span>
        <Folder class="tree-category-icon" size={16} aria-hidden="true" />
        <span class="tree-label">{category.title}</span>
      </button>

      <div class="tree-category-actions">
        <button
          class="tree-category-action"
          type="button"
          aria-label={`Open category ${category.title}`}
          title={`Open category ${category.title}`}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>

  {#if expandedCategoryIds[category.id]}
    {#each category.prompts as promptEntry, promptIndex (promptEntry.id)}
      {@render PromptRow(promptEntry, 1, promptIndex === category.prompts.length - 1)}
    {/each}
  {:else if isLastCategory}
    <span class="collapsed-last-category-marker" aria-hidden="true"></span>
  {/if}
{/snippet}

<main class="sidebar-base-stage" data-testid="app-sidebar-base-mockup">
  <aside class="mock-sidebar" aria-label="Cthulhu Prompt sidebar">
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
          <h1>CthulhuPromptPublic</h1>
          <button
            class="workspace-open-button"
            type="button"
            aria-label="Open Workspace Folder"
            title="Open Workspace Folder"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </div>
        <p title="C:\Source\PromptApps\CthulhuPromptPublic">
          C:\Source\PromptApps\CthulhuPromptPublic
        </p>
      </div>
    </header>

    <div class="separator"></div>

    <div class="folder-selector-wrap">
      <button class="folder-selector" type="button" aria-label="Folder selector">
        <span class="selector-icon-cell"><Folder size={20} aria-hidden="true" /></span>
        <span class="selector-copy">
          <span class="selector-title">Product Work</span>
          <span class="selector-detail">
            <span>20 prompts</span>
            <span class="separator-dot" aria-hidden="true"></span>
            <span>Updated today</span>
          </span>
        </span>
        <span class="selector-chevron"><ChevronDown size={20} aria-hidden="true" /></span>
      </button>
    </div>

    <div class="separator"></div>

    <div class="prompts-header">
      <div class="prompts-actions">
        {@render IconAction(Settings, 'Show Folder Overview')}
        {@render IconAction(Check, 'Show Completed Prompts')}
        {@render IconAction(
          ChevronsDownUp,
          areAllCategoriesCollapsed ? 'Expand All Categories' : 'Collapse All Categories',
          toggleAllCategories
        )}
        {@render IconAction(Plus, 'Add Prompt')}
        {@render IconAction(MoreHorizontal, 'Selected Prompt Folder Actions')}
      </div>
    </div>

    <div class="prompt-accordion">
      <section class="accordion-section completed-section" aria-label="Completed prompts">
        <button class="accordion-header" type="button" aria-expanded="true">
          <span class="accordion-chevron tree-chevron" data-expanded="true">
            <ChevronRight size={20} aria-hidden="true" />
          </span>
          <CircleCheckBig size={16} aria-hidden="true" />
          <span class="accordion-title">COMPLETED</span>
          <span class="accordion-count">5</span>
        </button>

        <div class="prompt-tree-shell accordion-tree-shell" role="presentation">
          <div class="prompt-tree">
            {#each completedPrompts as promptEntry, promptIndex (promptEntry.id)}
              {@render PromptRow(promptEntry, 0, promptIndex === completedPrompts.length - 1)}
            {/each}
            {#each completedCategories as category, categoryIndex (category.id)}
              {@render CategoryRow(category, categoryIndex === completedCategories.length - 1)}
            {/each}
            <div class="tree-bottom-spacer" aria-hidden="true"></div>
          </div>
        </div>
      </section>

      <section class="accordion-section active-section" aria-label="Active prompts">
        <button class="accordion-header" type="button" aria-expanded="true">
          <span class="accordion-chevron tree-chevron" data-expanded="true">
            <ChevronRight size={20} aria-hidden="true" />
          </span>
          <ListTodo size={16} aria-hidden="true" />
          <span class="accordion-title">ACTIVE</span>
          <span class="accordion-count">20</span>
        </button>

        <div
          class="prompt-tree-shell accordion-tree-shell"
          role="presentation"
          style={`--mock-scrollbar-width:${SCROLLBAR_WIDTH_PX}px;`}
          onmouseenter={() => {
            isPromptTreeHovered = true
          }}
          onmouseleave={() => {
            isPromptTreeHovered = false
          }}
        >
          <div
            class="prompt-tree"
            bind:this={promptTreeElement}
            use:observePromptTree
            onscroll={measurePromptTree}
          >
            {#each uncategorizedPrompts as promptEntry, promptIndex (promptEntry.id)}
              {@render PromptRow(
                promptEntry,
                0,
                promptIndex === uncategorizedPrompts.length - 1
              )}
            {/each}
            {#each categories as category, categoryIndex (category.id)}
              {@render CategoryRow(category, categoryIndex === categories.length - 1)}
            {/each}
            <div class="tree-bottom-spacer" aria-hidden="true"></div>
          </div>

          <div
            class="mock-overlay-scrollbar"
            data-visible={isScrollbarNeeded && (isPromptTreeHovered || isScrollbarDragging)
              ? 'true'
              : 'false'}
            aria-hidden="true"
          >
            <div
              class="mock-scrollbar-track"
              role="button"
              tabindex="-1"
              onpointerdown={handleScrollbarTrackPointerDown}
            >
              <div
                class="mock-scrollbar-thumb"
                class:active={isScrollbarDragging}
                role="button"
                tabindex="-1"
                style={`height:${scrollbarThumbHeightPx}px; transform:translate3d(0, ${scrollbarThumbTopPx}px, 0);`}
                onpointerdown={handleScrollbarThumbPointerDown}
                onpointermove={handleScrollbarThumbPointerMove}
                onpointerup={handleScrollbarThumbPointerUp}
                onpointercancel={handleScrollbarThumbPointerUp}
              ></div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="resize-handle" aria-hidden="true"></div>
  </aside>
</main>

<style>
  .sidebar-base-stage {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    min-height: 640px;
    min-width: 0;
    width: 100%;
  }

  .mock-sidebar {
    background: var(--app-chrome-surface);
    border-right: 1px solid var(--ui-neutral-hover-border);
    border-top: 1px solid var(--ui-neutral-hover-border);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    display: flex;
    flex: 0 0 275px;
    flex-direction: column;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    height: 100%;
    max-width: 100%;
    min-height: 0;
    position: relative;
    user-select: none;
    width: 275px;
  }

  button {
    font: inherit;
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
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 20px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-copy p {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
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
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selector-detail {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 12px;
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

  .prompt-accordion {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .accordion-section {
    display: flex;
    flex-direction: column;
    min-height: 78px;
    overflow: hidden;
    position: relative;
  }

  .accordion-section::before {
    content: '';
    cursor: ns-resize;
    height: 5px;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 2;
  }

  .completed-section {
    flex: 0 1 38%;
  }

  .active-section {
    flex: 1 1 62%;
  }

  .accordion-header {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    flex: 0 0 36px;
    gap: 7px;
    grid-template-columns: 24px 18px minmax(0, 1fr) auto;
    height: 36px;
    padding: 0 12px 0 9px;
    text-align: left;
    width: 100%;
  }

  .accordion-header:hover,
  .accordion-header:focus-visible {
    color: var(--ui-normal-text);
  }

  .accordion-chevron {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    justify-content: center;
  }

  .accordion-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .accordion-count {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .accordion-tree-shell {
    flex: 1 1 auto;
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
    padding: 0 12px 0 9px;
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
    font-size: 14px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-category-toggle .tree-label {
    font-weight: 400;
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

  .collapsed-last-category-marker {
    display: none;
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
    width: var(--mock-scrollbar-width);
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
    background: rgba(121, 121, 121, 0.4);
    left: 0;
    position: absolute;
    right: 0;
    touch-action: none;
  }

  .mock-scrollbar-thumb:hover {
    background: rgba(100, 100, 100, 0.7);
  }

  .mock-scrollbar-thumb.active {
    background: rgba(191, 191, 191, 0.4);
  }

  .tree-bottom-spacer {
    height: 32px;
  }

  .resize-handle {
    bottom: 0;
    cursor: ew-resize;
    position: absolute;
    right: -3px;
    top: 0;
    width: 6px;
    z-index: 2;
  }
</style>
