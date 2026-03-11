<script lang="ts">
  import { FileText, FolderClosed, Home, Plus, Settings } from 'lucide-svelte'

  type PromptMockup = {
    id: string
    name: string
  }

  type FolderMockup = {
    id: string
    name: string
    prompts: PromptMockup[]
  }

  type SidebarMockup = {
    id: string
    kicker: string
    name: string
    description: string
    styleClass: string
    workspaceBadge: string
    treeLabel: string
    selectedScreen: 'home' | 'settings'
    selectedPromptId: string
  }

  const workspaceName = 'Cthulhu Prompt'
  const workspacePath = 'C:\\Source\\PromptApps\\CthulhuPromptPublic'

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'settings', label: 'Settings', icon: Settings }
  ] as const

  const folders: FolderMockup[] = [
    {
      id: 'product-strategy',
      name: 'Product Strategy',
      prompts: [
        { id: 'vision-brief', name: 'Vision Brief' },
        { id: 'launch-story', name: 'Launch Story' },
        { id: 'review-checklist', name: 'Review Checklist' }
      ]
    },
    {
      id: 'renderer-work',
      name: 'Renderer Work',
      prompts: [
        { id: 'renderer-state', name: 'Renderer State Audit' },
        { id: 'electron-packaging', name: 'Electron Packaging Plan' },
        { id: 'sidebar-retrospective', name: 'Sidebar Retrospective' }
      ]
    },
    {
      id: 'agent-routines',
      name: 'Agent Routines',
      prompts: [
        { id: 'agent-guardrails', name: 'Agent Guardrails' },
        { id: 'pairing-routine', name: 'Pairing Routine' },
        { id: 'release-checklist', name: 'Release Checklist' }
      ]
    }
  ]

  const mockups: SidebarMockup[] = [
    {
      id: 'command-deck',
      kicker: 'Mockup 01',
      name: 'Command Deck',
      description: 'Segmented navigation with contained folder cards and a cool cyan accent.',
      styleClass: 'mockup--cadet',
      workspaceBadge: 'Active Workspace',
      treeLabel: 'Prompt Library',
      selectedScreen: 'home',
      selectedPromptId: 'renderer-state'
    },
    {
      id: 'night-ledger',
      kicker: 'Mockup 02',
      name: 'Night Ledger',
      description: 'Vertical index treatment with tighter hierarchy and a muted rose accent.',
      styleClass: 'mockup--ledger',
      workspaceBadge: 'Workspace Index',
      treeLabel: 'Working Tree',
      selectedScreen: 'settings',
      selectedPromptId: 'release-checklist'
    },
    {
      id: 'signal-stack',
      kicker: 'Mockup 03',
      name: 'Signal Stack',
      description: 'Terminal-like blocks with monospaced labels and a restrained olive highlight.',
      styleClass: 'mockup--signal',
      workspaceBadge: 'Attached Workspace',
      treeLabel: 'Folders + Prompts',
      selectedScreen: 'home',
      selectedPromptId: 'agent-guardrails'
    }
  ]

  const folderCount = folders.length
  const promptCount = folders.reduce((count, folder) => count + folder.prompts.length, 0)
</script>

<div class="test-screen-shell" data-testid="test-screen">
  <div class="test-screen-content">
    <header class="test-screen-header">
      <div class="test-screen-copy">
        <p class="test-screen-kicker">Sidebar Prototypes</p>
        <h1>Three flat dark mockups for the app sidebar</h1>
        <p>
          Each concept includes the workspace summary, Home and Settings buttons, a full
          folder-and-prompt tree, and a new-folder action.
        </p>
      </div>
      <div class="test-screen-summary">
        <span>{folderCount} folders</span>
        <span>{promptCount} prompts</span>
        <span>Static prototype only</span>
      </div>
    </header>

    {#snippet sidebarPreview(mockup)}
      <aside
        class={`sidebar-mockup ${mockup.styleClass}`}
        data-testid={`sidebar-mockup-${mockup.id}`}
      >
        <div class="sidebar-workspace">
          <p class="workspace-badge">{mockup.workspaceBadge}</p>
          <h3 class="workspace-name">{workspaceName}</h3>
          <p class="workspace-path">{workspacePath}</p>
        </div>

        <nav class="sidebar-nav" aria-label={`${mockup.name} navigation`}>
          {#each navItems as item (item.id)}
            {@const Icon = item.icon}
            <button
              type="button"
              class="nav-button"
              data-active={mockup.selectedScreen === item.id}
              aria-pressed={mockup.selectedScreen === item.id}
            >
              <Icon class="mockup-icon" />
              <span>{item.label}</span>
            </button>
          {/each}
        </nav>

        <section class="sidebar-tree-shell" aria-label={mockup.treeLabel}>
          <div class="sidebar-tree-header">
            <span>{mockup.treeLabel}</span>
            <span>{folderCount} / {promptCount}</span>
          </div>

          <div class="sidebar-tree">
            {#each folders as folder (folder.id)}
              <section class="tree-folder">
                <header class="tree-folder-header">
                  <div class="tree-folder-title">
                    <FolderClosed class="mockup-icon" />
                    <span>{folder.name}</span>
                  </div>
                  <span class="tree-folder-count">{folder.prompts.length}</span>
                </header>

                <ul class="tree-prompt-list">
                  {#each folder.prompts as prompt (prompt.id)}
                    <li>
                      <button
                        type="button"
                        class="tree-prompt"
                        data-active={mockup.selectedPromptId === prompt.id}
                        aria-current={mockup.selectedPromptId === prompt.id ? 'true' : undefined}
                      >
                        <FileText class="mockup-icon" />
                        <span>{prompt.name}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              </section>
            {/each}
          </div>
        </section>

        <button type="button" class="add-folder-button">
          <Plus class="mockup-icon" />
          <span>New Prompt Folder</span>
        </button>
      </aside>
    {/snippet}

    <section class="mockup-grid" data-testid="sidebar-mockup-gallery">
      {#each mockups as mockup (mockup.id)}
        <article class="mockup-stage">
          <div class="mockup-stage-copy">
            <p class="mockup-stage-kicker">{mockup.kicker}</p>
            <h2>{mockup.name}</h2>
            <p>{mockup.description}</p>
          </div>

          <div class="mockup-stage-preview">
            {@render sidebarPreview(mockup)}
          </div>
        </article>
      {/each}
    </section>
  </div>
</div>

<style>
  .test-screen-shell {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background: #0b0d11;
    color: #f4f6fb;
  }

  .test-screen-content {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }

  .test-screen-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1.25rem;
    align-items: flex-end;
  }

  .test-screen-copy {
    max-width: 50rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .test-screen-kicker,
  .mockup-stage-kicker,
  .workspace-badge,
  .sidebar-tree-header {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .test-screen-kicker {
    font-size: 0.72rem;
    color: #9198aa;
  }

  .test-screen-copy h1,
  .mockup-stage-copy h2,
  .workspace-name {
    margin: 0;
    font-weight: 600;
  }

  .test-screen-copy h1 {
    font-size: clamp(2rem, 2vw + 1.4rem, 3rem);
    line-height: 1.05;
  }

  .test-screen-copy p,
  .mockup-stage-copy p {
    margin: 0;
    color: #abb2c3;
    line-height: 1.45;
  }

  .test-screen-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .test-screen-summary span {
    padding: 0.55rem 0.8rem;
    border: 1px solid #252b39;
    background: #121720;
    font-size: 0.82rem;
    color: #cad0dd;
  }

  .mockup-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    gap: 1.25rem;
    align-items: start;
  }

  .mockup-stage {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid #222938;
    background: #11161e;
  }

  .mockup-stage-copy {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .mockup-stage-kicker {
    font-size: 0.68rem;
    color: #82899a;
  }

  .mockup-stage-copy h2 {
    font-size: 1.2rem;
  }

  .mockup-stage-preview {
    display: flex;
    justify-content: center;
  }

  .sidebar-mockup {
    width: min(100%, 22rem);
    min-height: 46rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid #283041;
    background: #141925;
  }

  .sidebar-workspace {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 1rem;
  }

  .workspace-badge {
    font-size: 0.66rem;
  }

  .workspace-name {
    font-size: 1.4rem;
    line-height: 1.1;
  }

  .workspace-path {
    margin: 0;
    color: #97a2b8;
    font-size: 0.82rem;
    line-height: 1.4;
    word-break: break-all;
  }

  .sidebar-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .nav-button,
  .tree-prompt,
  .add-folder-button {
    width: 100%;
    appearance: none;
    border: 1px solid transparent;
    background: none;
    color: inherit;
    cursor: default;
    font: inherit;
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 0.95rem;
    text-align: left;
  }

  .mockup-icon {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
  }

  .sidebar-tree-shell {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .sidebar-tree-header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    font-size: 0.68rem;
  }

  .sidebar-tree {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
    padding-right: 0.2rem;
  }

  .tree-folder {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.8rem;
  }

  .tree-folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .tree-folder-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    font-size: 0.92rem;
    font-weight: 600;
  }

  .tree-folder-title span {
    min-width: 0;
  }

  .tree-folder-count {
    min-width: 1.85rem;
    padding: 0.25rem 0.45rem;
    text-align: center;
    font-size: 0.72rem;
  }

  .tree-prompt-list {
    list-style: none;
    margin: 0;
    padding: 0 0 0 1.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .tree-prompt {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.62rem 0.7rem;
    text-align: left;
  }

  .tree-prompt span {
    min-width: 0;
  }

  .add-folder-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
    margin-top: auto;
  }

  .mockup--cadet {
    border-color: #2b3848;
    background: #10161f;
    color: #ebf7fb;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }

  .mockup--cadet .sidebar-workspace {
    border: 1px solid #314050;
    background: #18212c;
  }

  .mockup--cadet .workspace-badge {
    color: #82d6e9;
  }

  .mockup--cadet .workspace-path,
  .mockup--cadet .sidebar-tree-header {
    color: #9eb8c7;
  }

  .mockup--cadet .nav-button {
    border-color: #314153;
    background: #17212d;
  }

  .mockup--cadet .nav-button[data-active='true'] {
    border-color: #66b9cd;
    background: #1d4050;
    color: #f5fdff;
  }

  .mockup--cadet .tree-folder {
    border: 1px solid #2d3b4b;
    background: #151d27;
  }

  .mockup--cadet .tree-folder-count {
    background: #203848;
    color: #abebfa;
  }

  .mockup--cadet .tree-prompt {
    border-color: #253241;
    background: #10161e;
    color: #d6e7ef;
  }

  .mockup--cadet .tree-prompt[data-active='true'] {
    border-color: #71c3d8;
    background: #1c4250;
    color: #f6feff;
  }

  .mockup--cadet .add-folder-button {
    border-color: #355063;
    background: #172633;
    color: #d9f5fd;
  }

  .mockup--ledger {
    border-color: #433147;
    background: #130f16;
    color: #f6ebf4;
    font-family: Bahnschrift, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }

  .mockup--ledger .sidebar-workspace {
    border-left: 0.4rem solid #ab5876;
    background: #1b151d;
  }

  .mockup--ledger .workspace-badge {
    color: #db9ab4;
  }

  .mockup--ledger .workspace-path {
    color: #c6b4c1;
    font-family: 'Cascadia Mono', Consolas, monospace;
  }

  .mockup--ledger .sidebar-nav {
    grid-template-columns: 1fr;
  }

  .mockup--ledger .nav-button {
    border-color: #4a384e;
    background: transparent;
  }

  .mockup--ledger .nav-button[data-active='true'] {
    border-color: #b86f8d;
    background: #352431;
  }

  .mockup--ledger .sidebar-tree-shell {
    padding: 0.8rem;
    border: 1px solid #382a3b;
    background: #171219;
  }

  .mockup--ledger .sidebar-tree-header {
    color: #d6b4c5;
  }

  .mockup--ledger .tree-folder {
    padding: 0;
    background: transparent;
    border: 0;
  }

  .mockup--ledger .tree-folder-header {
    padding-bottom: 0.4rem;
    border-bottom: 1px solid #372d39;
  }

  .mockup--ledger .tree-folder-count {
    background: #2b1f2d;
    color: #f0bfd4;
  }

  .mockup--ledger .tree-prompt-list {
    padding-left: 0.8rem;
    border-left: 1px solid #4b3a4e;
    gap: 0.2rem;
  }

  .mockup--ledger .tree-prompt {
    padding: 0.58rem 0.15rem 0.58rem 0.55rem;
    border: 0;
    border-bottom: 1px solid #302431;
    background: transparent;
    color: #decfda;
  }

  .mockup--ledger .tree-prompt[data-active='true'] {
    background: #2d2029;
    color: #fff2f8;
  }

  .mockup--ledger .add-folder-button {
    border-color: #573c57;
    background: #211724;
    color: #f0d9e6;
  }

  .mockup--signal {
    border-color: #344133;
    background: #101410;
    color: #eff7ec;
    font-family: 'Cascadia Mono', Consolas, monospace;
  }

  .mockup--signal .sidebar-workspace {
    border: 1px solid #334133;
    background: #161d16;
  }

  .mockup--signal .workspace-badge {
    color: #d8e686;
  }

  .mockup--signal .workspace-name {
    font-size: 1.18rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .mockup--signal .workspace-path,
  .mockup--signal .sidebar-tree-header {
    color: #95a595;
  }

  .mockup--signal .nav-button {
    justify-content: center;
    border-color: #324132;
    background: #181f18;
    text-transform: uppercase;
    font-size: 0.78rem;
  }

  .mockup--signal .nav-button[data-active='true'] {
    border-color: #a4b554;
    background: #2e3819;
    color: #faffdc;
  }

  .mockup--signal .tree-folder {
    border: 1px solid #2a342a;
    background: #151a15;
  }

  .mockup--signal .tree-folder-header {
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
  }

  .mockup--signal .tree-folder-count {
    border: 1px solid #465646;
    background: #202720;
    color: #dce8b0;
  }

  .mockup--signal .tree-prompt-list {
    padding-left: 1.1rem;
  }

  .mockup--signal .tree-prompt {
    border-color: #263026;
    background: #0f130f;
    color: #d8e2d2;
  }

  .mockup--signal .tree-prompt[data-active='true'] {
    border-color: #a7b951;
    background: #303a18;
    color: #fbffeb;
  }

  .mockup--signal .add-folder-button {
    border-color: #445343;
    background: #161d16;
    color: #eef8de;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  @media (max-width: 42rem) {
    .test-screen-content {
      padding: 1rem;
    }

    .sidebar-mockup {
      width: 100%;
      min-height: auto;
    }
  }
</style>
