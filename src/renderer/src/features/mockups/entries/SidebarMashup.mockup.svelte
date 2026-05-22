<script lang="ts">
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Search,
    Settings
  } from 'lucide-svelte'

  const folders = [
    {
      name: 'Coding Workflows',
      count: 8,
      expanded: true,
      active: true,
      items: [
        { icon: Settings, label: 'Folder Settings', active: false },
        { icon: FileText, label: 'Feature implementation brief', active: true },
        { icon: FileText, label: 'Review staged changes', active: false },
        { icon: FileText, label: 'Write Playwright coverage', active: false }
      ]
    },
    {
      name: 'Release Notes',
      count: 4,
      expanded: true,
      active: false,
      items: [
        { icon: Settings, label: 'Folder Settings', active: false },
        { icon: FileText, label: 'Patch summary', active: false },
        { icon: FileText, label: 'Customer-facing changelog', active: false }
      ]
    },
    {
      name: 'Research',
      count: 6,
      expanded: false,
      active: false,
      items: []
    },
    {
      name: 'Bug Triage',
      count: 5,
      expanded: false,
      active: false,
      items: []
    }
  ]
</script>

<div class="mockupFrame">
  <aside class="sidebarShell" aria-label="Sidebar">
    <section class="workspacePanel" aria-label="Workspace">
      <div class="workspaceMark" aria-hidden="true">CP</div>
      <div class="workspaceText">
        <h1>Cthulhu Prompt</h1>
        <p>C:\Source\PromptApps\Workspace</p>
      </div>
    </section>

    <nav class="navRail" aria-label="Primary">
      <button type="button" class="railButton" data-active="false" aria-label="Home">
        <Home size={17} />
      </button>
      <button type="button" class="railButton" data-active="true" aria-label="Prompts">
        <Folder size={17} />
      </button>
      <button type="button" class="railButton" data-active="false" aria-label="Settings">
        <Settings size={17} />
      </button>
    </nav>

    <section class="promptPanel" aria-label="Prompts">
      <div class="promptHeader">
        <div>
          <p class="sectionKicker">Prompts</p>
          <p class="sectionCount">4 folders</p>
        </div>
        <div class="headerActions">
          <button type="button" aria-label="Expand All Prompt Folders">
            <ChevronsUpDown size={15} />
          </button>
          <button type="button" aria-label="Collapse All Prompt Folders">
            <ChevronsDownUp size={15} />
          </button>
          <button type="button" aria-label="Create Prompt Folder">
            <Plus size={15} />
          </button>
        </div>
      </div>

      <label class="searchBox" aria-label="Search prompts">
        <Search size={15} />
        <span>Search prompts</span>
      </label>

      <div class="folderList">
        {#each folders as folder (folder.name)}
          <section class="folderGroup" data-active={folder.active}>
            <button type="button" class="folderButton">
              <span class="folderDisclosure">
                {#if folder.expanded}
                  <ChevronDown size={15} />
                {:else}
                  <ChevronRight size={15} />
                {/if}
              </span>
              <Folder size={16} />
              <span class="folderName">{folder.name}</span>
              <span class="folderCount">{folder.count}</span>
              <ArrowRight class="folderOpenIcon" size={15} />
            </button>

            {#if folder.expanded}
              <div class="folderChildren">
                {#each folder.items as item (item.label)}
                  {@const ItemIcon = item.icon}
                  <button type="button" class="childButton" data-active={item.active}>
                    <ItemIcon size={14} />
                    <span>{item.label}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/each}
      </div>
    </section>
  </aside>

  <main class="contentPreview" aria-label="Prompt folder preview">
    <header class="previewHeader">
      <span>Coding Workflows</span>
      <span>/</span>
      <strong>Feature implementation brief</strong>
    </header>

    <section class="previewBody">
      <div class="previewTitle">
        <Folder size={18} />
        <div>
          <h2>Coding Workflows</h2>
          <p>Prompts for implementation, review, and release work.</p>
        </div>
      </div>

      <article class="promptCard">
        <div class="promptCardHeader">
          <span>Feature implementation brief</span>
          <span>1 of 8</span>
        </div>
        <p>
          Implement the requested change, keep edits scoped, and verify with lint and typecheck
          before reporting back.
        </p>
      </article>
    </section>
  </main>
</div>

<style>
  .mockupFrame {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
    min-height: 42rem;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }

  .sidebarShell {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid var(--ui-neutral-muted-border);
    background-color: var(--ui-card-nested-surface);
    background:
      linear-gradient(180deg, var(--ui-neutral-normal-surface), transparent 42%),
      var(--ui-card-nested-surface);
  }

  .workspacePanel {
    grid-column: 1 / -1;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
    padding: 0.8rem;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    background: linear-gradient(
      135deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
  }

  .workspaceMark {
    display: grid;
    height: 2.35rem;
    width: 2.35rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    font-size: 0.78rem;
    font-weight: 760;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .workspaceText {
    min-width: 0;
  }

  .workspaceText h1 {
    margin: 0;
    overflow: hidden;
    color: var(--ui-normal-text);
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspaceText p {
    margin: 0.16rem 0 0;
    overflow: hidden;
    color: var(--ui-muted-text);
    font-size: 0.73rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .navRail {
    display: flex;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    gap: 0.55rem;
    padding: 0.75rem 0.55rem;
    border-right: 1px solid var(--ui-neutral-muted-border);
    background: var(--ui-neutral-muted-surface);
  }

  .railButton,
  .headerActions button {
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    background: transparent;
    color: var(--ui-secondary-text);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .railButton {
    height: 2.25rem;
    width: 2.25rem;
  }

  .railButton:hover,
  .headerActions button:hover {
    border-color: var(--ui-neutral-hover-border);
    background: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .railButton[data-active='true'] {
    border-color: var(--ui-accent-normal-border);
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
  }

  .promptPanel {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .promptHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
  }

  .sectionKicker,
  .sectionCount {
    margin: 0;
  }

  .sectionKicker {
    color: var(--ui-secondary-text);
    font-size: 0.68rem;
    font-weight: 760;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .sectionCount {
    margin-top: 0.1rem;
    color: var(--ui-muted-text);
    font-size: 0.76rem;
    line-height: 1.2;
  }

  .headerActions {
    display: flex;
    flex: 0 0 auto;
    gap: 0.25rem;
  }

  .headerActions button {
    height: 1.8rem;
    width: 1.8rem;
  }

  .searchBox {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    height: 2.25rem;
    padding: 0 0.65rem;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-neutral-field-surface);
    box-shadow: var(--cthulhu-ui-shadow-field);
    color: var(--ui-muted-text);
    font-size: 0.82rem;
  }

  .folderList {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 0.35rem;
    overflow: hidden;
  }

  .folderGroup {
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-card);
  }

  .folderGroup[data-active='true'] {
    border-color: var(--ui-neutral-normal-border);
    background: linear-gradient(
      180deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    box-shadow: var(--cthulhu-ui-shadow-subcard);
  }

  .folderButton,
  .childButton {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    text-align: left;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .folderButton {
    gap: 0.5rem;
    height: 2.35rem;
    padding: 0 0.45rem;
    border-radius: var(--cthulhu-ui-radius-card);
  }

  .folderButton:hover,
  .childButton:hover {
    border-color: var(--ui-neutral-hover-border);
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .folderDisclosure {
    display: grid;
    flex: 0 0 auto;
    height: 1.35rem;
    width: 1.35rem;
    place-items: center;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-text);
  }

  .folderName,
  .childButton span {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folderName {
    font-size: 0.86rem;
    font-weight: 620;
  }

  .folderCount {
    flex: 0 0 auto;
    padding: 0.1rem 0.4rem;
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-secondary-text);
    font-size: 0.68rem;
    font-weight: 650;
  }

  .folderButton :global(.folderOpenIcon) {
    flex: 0 0 auto;
    color: var(--ui-muted-text);
  }

  .folderChildren {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0 0.35rem 0.45rem 2.35rem;
  }

  .childButton {
    gap: 0.5rem;
    height: 1.85rem;
    padding: 0 0.5rem;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-text);
  }

  .childButton span {
    font-size: 0.8rem;
  }

  .childButton[data-active='true'] {
    border-color: var(--ui-accent-normal-border);
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
  }

  .contentPreview {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
  }

  .previewHeader {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    height: 2.25rem;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    background: var(--ui-neutral-muted-surface);
    color: var(--ui-muted-text);
    font-size: 0.86rem;
  }

  .previewHeader strong {
    color: var(--ui-normal-text);
    font-weight: 650;
  }

  .previewBody {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }

  .previewTitle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-left: 1rem;
    border-left: 3px solid var(--ui-accent-normal-border);
  }

  .previewTitle h2,
  .previewTitle p,
  .promptCard p {
    margin: 0;
  }

  .previewTitle h2 {
    color: var(--ui-normal-text);
    font-size: 1.35rem;
    font-weight: 760;
    line-height: 1.2;
  }

  .previewTitle p {
    margin-top: 0.25rem;
    color: var(--ui-muted-text);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .promptCard {
    width: min(100%, 42rem);
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    background: linear-gradient(
      180deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    box-shadow: var(--cthulhu-ui-shadow-card);
  }

  .promptCardHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.8rem 0.9rem;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-secondary-text);
    font-size: 0.84rem;
    font-weight: 650;
  }

  .promptCardHeader span:last-child {
    color: var(--ui-muted-text);
    font-size: 0.76rem;
  }

  .promptCard p {
    padding: 0.9rem;
    color: var(--ui-secondary-text);
    font-size: 0.9rem;
    line-height: 1.55;
  }

  @media (max-width: 760px) {
    .mockupFrame {
      grid-template-columns: 1fr;
    }

    .contentPreview {
      display: none;
    }
  }
</style>
