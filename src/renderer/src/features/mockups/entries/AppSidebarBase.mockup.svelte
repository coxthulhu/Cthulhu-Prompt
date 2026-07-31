<script lang="ts">
  import {
    ArrowRight,
    Check,
    ChevronsDownUp,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Folder,
    MoreHorizontal,
    Plus
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  type MockPrompt = {
    id: string
    kind: 'prompt'
    title: string
  }

  type MockFolder = {
    id: string
    kind: 'folder'
    title: string
    entries: MockEntry[]
  }

  type MockEntry = MockPrompt | MockFolder

  const prompt = (id: string, title: string): MockPrompt => ({ id, kind: 'prompt', title })
  const indentLevels = (indentCount: number): number[] =>
    Array.from({ length: indentCount }, (_, index) => index)

  const entries: MockEntry[] = [
    prompt('map-implementation', 'Map the current implementation'),
    prompt('clarify-requirements', 'Clarify product requirements'),
    prompt('draft-plan', 'Draft an implementation plan'),
    prompt('identify-edge-cases', 'Identify edge cases'),
    prompt('acceptance-criteria', 'Define acceptance criteria'),
    prompt('review-data-flow', 'Review the data flow'),
    {
      id: 'research',
      kind: 'folder',
      title: 'Research',
      entries: [
        prompt('compare-patterns', 'Compare sidebar patterns'),
        {
          id: 'verification',
          kind: 'folder',
          title: 'Verification',
          entries: [prompt('verify-interactions', 'Verify folder interactions')]
        }
      ]
    },
    prompt('prepare-ui-copy', 'Prepare the UI copy'),
    prompt('audit-accessibility', 'Audit accessibility behavior'),
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

  let expandedFolderIds = $state<Record<string, boolean>>({
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

  const measurePromptTree = () => {
    if (!promptTreeElement) return
    promptTreeViewportHeightPx = promptTreeElement.clientHeight
    promptTreeScrollHeightPx = promptTreeElement.scrollHeight
    promptTreeScrollTopPx = promptTreeElement.scrollTop
  }

  const observePromptTree = (node: HTMLDivElement) => {
    promptTreeElement = node
    measurePromptTree()

    // Side effect: keep the cloned overlay scrollbar sized to its local scroll viewport.
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

  const toggleFolder = (folderId: string) => {
    expandedFolderIds = {
      ...expandedFolderIds,
      [folderId]: !expandedFolderIds[folderId]
    }
    window.queueMicrotask(measurePromptTree)
  }

  const expandAllFolders = () => {
    expandedFolderIds = { research: true, verification: true }
    window.queueMicrotask(measurePromptTree)
  }
</script>

{#snippet IconAction(
  Icon: typeof Plus,
  label: string,
  onclick: (() => void) | undefined = undefined
)}
  <button class="icon-action" type="button" aria-label={label} title={label} {onclick}>
    <Icon size={16} aria-hidden="true" />
  </button>
{/snippet}

{#snippet TreeGutter(indentCount: number, isLastRow: boolean)}
  <span class="tree-gutter" data-last-row={isLastRow ? 'true' : undefined} aria-hidden="true">
    {#each indentLevels(indentCount) as level (level)}
      <span class="tree-guide" style={`--tree-guide-index:${level};`}></span>
    {/each}
  </span>
{/snippet}

{#snippet TreeEntries(treeEntries: MockEntry[], indentCount: number)}
  {#each treeEntries as entry, entryIndex (entry.id)}
    {@const isLastRow = entryIndex === treeEntries.length - 1}
    {#if entry.kind === 'folder'}
      <div
        class="tree-folder-row"
        style={`--tree-indent-count:${indentCount};`}
        data-indented={indentCount > 0 ? 'true' : undefined}
      >
        <div class="tree-folder-content">
          <button
            class="tree-folder-toggle"
            type="button"
            aria-label={`${expandedFolderIds[entry.id] ? 'Collapse' : 'Expand'} ${entry.title}`}
            aria-expanded={expandedFolderIds[entry.id]}
            onclick={() => toggleFolder(entry.id)}
          >
            {#if indentCount > 0}
              {@render TreeGutter(indentCount, isLastRow)}
            {/if}
            <span class="tree-chevron">
              {#if expandedFolderIds[entry.id]}
                <ChevronDown size={20} aria-hidden="true" />
              {:else}
                <ChevronRight size={20} aria-hidden="true" />
              {/if}
            </span>
            <span class="tree-label">{entry.title}</span>
          </button>

          <div class="tree-folder-actions">
            {@render IconAction(MoreHorizontal, `Folder options for ${entry.title}`)}
            {@render IconAction(ArrowRight, `Open ${entry.title}`)}
          </div>
        </div>
      </div>

      {#if expandedFolderIds[entry.id]}
        {@render TreeEntries(entry.entries, indentCount + 1)}
      {/if}
    {:else}
      <div class="tree-prompt-row" style={`--tree-indent-count:${indentCount};`}>
        <button
          class="tree-prompt-button"
          data-active={selectedPromptId === entry.id ? 'true' : 'false'}
          type="button"
          aria-current={selectedPromptId === entry.id ? 'true' : undefined}
          onclick={() => {
            selectedPromptId = entry.id
          }}
        >
          {@render TreeGutter(indentCount, isLastRow)}
          <span class="tree-label">{entry.title}</span>
        </button>
      </div>
    {/if}
  {/each}
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

    <section class="prompts-section" aria-labelledby="mock-sidebar-prompts-title">
      <header class="prompts-header">
        <h2 id="mock-sidebar-prompts-title">Prompts</h2>
        <div class="prompts-actions">
          {@render IconAction(Plus, 'Add Prompt')}
          {@render IconAction(Check, 'Show Completed Prompts')}
          {@render IconAction(ChevronsDownUp, 'Expand All Prompt Folders', expandAllFolders)}
          {@render IconAction(MoreHorizontal, 'Selected Prompt Folder Actions')}
        </div>
      </header>

      <div
        class="prompt-tree-shell"
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
          <div class="root-folder-row">
            <button type="button">Product Work</button>
          </div>
          {@render TreeEntries(entries, 0)}
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
    padding: 0;
    width: 18px;
  }

  .workspace-open-button:hover,
  .workspace-open-button:focus-visible {
    color: var(--ui-hoverable-icon-glyph);
  }

  .separator {
    background: var(--ui-neutral-muted-border);
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

  .prompts-section {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .prompts-header {
    align-items: center;
    display: flex;
    flex: 0 0 40px;
    gap: 8px;
    justify-content: space-between;
    min-height: 40px;
    padding: 4px 8px 0 12px;
  }

  .prompts-header h2 {
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
    margin: 0;
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
    flex: 0 0 28px;
    height: 28px;
    justify-content: center;
    padding: 0;
    width: 28px;
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

  .root-folder-row,
  .tree-prompt-row,
  .tree-folder-row {
    box-sizing: border-box;
    padding-block: 1px;
    width: 100%;
  }

  .root-folder-row button,
  .tree-prompt-button {
    background: transparent;
    border: 0;
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    height: 30px;
    min-width: 0;
    text-align: left;
    width: 100%;
  }

  .root-folder-row button {
    font-size: 14px;
    font-weight: 600;
    padding: 0 22px 0 13px;
  }

  .root-folder-row button:hover,
  .tree-prompt-button:hover,
  .tree-prompt-button:focus-visible,
  .tree-folder-content:hover {
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .tree-folder-content {
    align-items: center;
    background: transparent;
    color: var(--ui-hoverable-text);
    display: flex;
    height: 30px;
    position: relative;
    width: 100%;
  }

  .tree-folder-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    display: flex;
    gap: 8px;
    height: 100%;
    inset: 0;
    min-width: 0;
    padding: 0 12px 0 9px;
    position: absolute;
    text-align: left;
    width: 100%;
  }

  .tree-folder-row[data-indented='true'] .tree-folder-toggle {
    display: grid;
    grid-template-columns:
      calc(5px + 12px * var(--tree-indent-count)) 20px minmax(0, 1fr);
    padding-left: 0;
  }

  .tree-chevron {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 20px;
    height: 24px;
    justify-content: center;
    width: 20px;
  }

  .tree-label {
    font-size: 14px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-folder-toggle .tree-label {
    font-weight: 500;
  }

  .tree-folder-actions {
    display: none;
    gap: 2px;
    margin-left: auto;
    margin-right: 20px;
    position: relative;
    z-index: 1;
  }

  .tree-folder-content:hover .tree-folder-actions,
  .tree-folder-content:focus-within .tree-folder-actions {
    display: flex;
  }

  .tree-folder-content:hover .tree-folder-toggle,
  .tree-folder-content:focus-within .tree-folder-toggle {
    padding-right: 92px;
  }

  .tree-folder-actions .icon-action {
    color: var(--ui-normal-text);
  }

  .tree-prompt-button {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: calc(5px + 12px * var(--tree-indent-count)) minmax(0, 1fr);
    padding: 0 22px 0 0;
  }

  .tree-prompt-button[data-active='true'] {
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  .tree-prompt-button[data-active='true']:hover {
    background: var(--ui-neutral-selection-surface);
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
    transition: opacity 100ms ease-out;
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
    width: var(--mock-scrollbar-width);
  }

  .mock-overlay-scrollbar[data-visible='true'] {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 100ms linear;
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
