<script lang="ts">
  import { AlertTriangle, Check, FolderOpen, FolderPlus, X } from 'lucide-svelte'

  let showCreateWorkspaceDialog = $state(true)
  let workspaceName = $state('My Prompts')
  let workspacePath = $state('C:\\Users\\dmin\\Documents\\Cthulhu Prompt')
  let includeExamplePrompts = $state(true)

  const openCreateWorkspaceDialog = () => {
    showCreateWorkspaceDialog = true
  }

  const closeCreateWorkspaceDialog = () => {
    showCreateWorkspaceDialog = false
  }
</script>

<main class="homeMockupShell">
  <section class="homeMockupContent">
    <div class="homeMockupTitleBlock">
      <h1>CTHULHU PROMPT</h1>
    </div>

    <div class="homeMockupGrid">
      <article class="homeMockupCard">
        <div class="homeMockupCardHeader">
          <div>
            <h2>Current Workspace</h2>
            <p>No workspace selected</p>
          </div>
          <span class="homeMockupStatus">
            <AlertTriangle size={16} />
            Workspace Not Selected
          </span>
        </div>

        <div class="homeMockupFieldStack">
          <div class="homeMockupDisplayField">
            <span>Workspace Name</span>
            <strong>No workspace selected</strong>
          </div>
          <div class="homeMockupDisplayField">
            <span>Workspace Path</span>
            <strong>No workspace selected</strong>
          </div>
        </div>
      </article>

      <article class="homeMockupCard">
        <div class="homeMockupCardHeader">
          <div>
            <h2>Workspace Actions</h2>
            <p>Change your current workspace.</p>
          </div>
        </div>

        <button class="homeMockupActionButton" type="button" onclick={openCreateWorkspaceDialog}>
          <span class="homeMockupActionIcon">
            <FolderPlus size={21} />
          </span>
          <span>
            <strong>Create Workspace</strong>
            <em>Choose a folder and set up a new workspace.</em>
          </span>
        </button>
      </article>
    </div>
  </section>

  {#if showCreateWorkspaceDialog}
    <div class="homeMockupOverlay" role="presentation">
      <div
        aria-labelledby="create-workspace-dialog-title"
        aria-modal="true"
        class="homeMockupDialog"
        role="dialog"
      >
        <header class="homeMockupDialogHeader">
          <div class="homeMockupDialogTitleRow">
            <div class="homeMockupDialogIcon">
              <FolderPlus size={24} />
            </div>
            <div>
              <h2 id="create-workspace-dialog-title">Create Workspace</h2>
              <p>Set up a new Cthulhu Prompt workspace.</p>
            </div>
          </div>
          <button
            aria-label="Close"
            class="homeMockupIconButton"
            type="button"
            onclick={closeCreateWorkspaceDialog}
          >
            <X size={18} />
          </button>
        </header>

        <div class="homeMockupForm">
          <label class="homeMockupInputGroup" for="workspace-name">
            <span>Workspace Name</span>
            <input id="workspace-name" bind:value={workspaceName} type="text" />
          </label>

          <label class="homeMockupInputGroup" for="workspace-path">
            <span>Workspace Folder</span>
            <div class="homeMockupPathRow">
              <input id="workspace-path" bind:value={workspacePath} type="text" />
              <button class="homeMockupBrowseButton" type="button">
                <FolderOpen size={18} />
                Browse
              </button>
            </div>
          </label>

          <div class="homeMockupWarning">
            <AlertTriangle size={17} />
            <span>Choose an empty folder. This folder already contains files.</span>
          </div>

          <label class="homeMockupCheckboxRow" for="include-examples">
            <input id="include-examples" bind:checked={includeExamplePrompts} type="checkbox" />
            <span>Include example prompts in a "My Prompts" folder.</span>
          </label>
        </div>

        <footer class="homeMockupDialogFooter">
          <button
            class="homeMockupSecondaryButton"
            type="button"
            onclick={closeCreateWorkspaceDialog}
          >
            Cancel
          </button>
          <button class="homeMockupPrimaryButton" type="button">
            <Check size={18} />
            Create Workspace
          </button>
        </footer>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: #09090b;
  }

  .homeMockupShell {
    align-items: center;
    background:
      radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.13), transparent 34rem),
      linear-gradient(180deg, #111113 0%, #09090b 100%);
    color: var(--ui-normal-text, #f4f4f5);
    display: flex;
    flex: 1;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
    justify-content: center;
    min-height: 100vh;
    min-width: 0;
    overflow: hidden;
    padding: 28px;
  }

  .homeMockupContent {
    max-width: 1060px;
    width: min(100%, 1060px);
  }

  .homeMockupTitleBlock {
    margin: 0 auto 34px;
    max-width: 720px;
    text-align: center;
  }

  .homeMockupTitleBlock h1 {
    color: var(--ui-normal-text, #fafafa);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 76px;
    font-weight: 760;
    letter-spacing: 0.12em;
    line-height: 0.95;
    margin: 0;
    white-space: nowrap;
  }

  .homeMockupGrid {
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .homeMockupCard,
  .homeMockupDialog {
    background: rgba(30, 30, 34, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.48),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .homeMockupCard {
    border-radius: 24px;
    min-width: 0;
    padding: 24px;
  }

  .homeMockupCardHeader {
    align-items: flex-start;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .homeMockupCardHeader h2,
  .homeMockupDialogHeader h2 {
    color: var(--ui-normal-text, #fafafa);
    font-size: 18px;
    font-weight: 720;
    letter-spacing: 0;
    line-height: 1.2;
    margin: 0;
  }

  .homeMockupCardHeader p,
  .homeMockupDialogHeader p {
    color: var(--ui-muted-text, #a1a1aa);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    margin: 6px 0 0;
  }

  .homeMockupStatus {
    align-items: center;
    background: var(--ui-accent-normal-surface, rgba(139, 92, 246, 0.14));
    border: 1px solid var(--ui-accent-normal-border, rgba(167, 139, 250, 0.28));
    border-radius: 999px;
    color: var(--ui-accent-normal-text, #d8b4fe);
    display: inline-flex;
    flex: none;
    font-size: 13px;
    font-weight: 650;
    gap: 8px;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .homeMockupFieldStack {
    display: grid;
    gap: 12px;
  }

  .homeMockupDisplayField {
    background: rgba(10, 10, 12, 0.44);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 18px;
    display: grid;
    gap: 8px;
    min-width: 0;
    padding: 16px;
  }

  .homeMockupDisplayField span,
  .homeMockupInputGroup > span {
    color: var(--ui-muted-text, #a1a1aa);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .homeMockupDisplayField strong {
    color: var(--ui-normal-text, #fafafa);
    font-size: 15px;
    font-weight: 620;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .homeMockupActionButton {
    align-items: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.28), rgba(72, 56, 132, 0.24));
    border: 1px solid var(--ui-accent-normal-border, rgba(167, 139, 250, 0.34));
    border-radius: 20px;
    color: var(--ui-normal-text, #fafafa);
    cursor: pointer;
    display: flex;
    gap: 14px;
    padding: 16px;
    text-align: left;
    width: 100%;
  }

  .homeMockupActionButton:hover,
  .homeMockupBrowseButton:hover,
  .homeMockupPrimaryButton:hover,
  .homeMockupSecondaryButton:hover,
  .homeMockupIconButton:hover {
    filter: brightness(1.08);
  }

  .homeMockupActionIcon,
  .homeMockupDialogIcon {
    align-items: center;
    background: var(--ui-accent-normal-surface, rgba(139, 92, 246, 0.16));
    border: 1px solid var(--ui-accent-normal-border, rgba(167, 139, 250, 0.32));
    border-radius: 16px;
    color: var(--ui-accent-normal-text, #ddd6fe);
    display: inline-flex;
    flex: none;
    height: 48px;
    justify-content: center;
    width: 48px;
  }

  .homeMockupActionButton strong,
  .homeMockupActionButton em {
    display: block;
    font-style: normal;
  }

  .homeMockupActionButton strong {
    font-size: 15px;
    font-weight: 720;
    line-height: 1.2;
  }

  .homeMockupActionButton em {
    color: var(--ui-muted-text, #c4c4cc);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    margin-top: 4px;
  }

  .homeMockupOverlay {
    align-items: center;
    background: rgba(0, 0, 0, 0.58);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 28px;
    position: fixed;
  }

  .homeMockupDialog {
    border-radius: 28px;
    max-width: 640px;
    padding: 24px;
    width: min(100%, 640px);
  }

  .homeMockupDialogHeader {
    align-items: flex-start;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    margin-bottom: 22px;
  }

  .homeMockupDialogTitleRow {
    align-items: center;
    display: flex;
    gap: 14px;
    min-width: 0;
  }

  .homeMockupIconButton {
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: var(--ui-muted-text, #d4d4d8);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .homeMockupForm {
    display: grid;
    gap: 16px;
  }

  .homeMockupInputGroup {
    display: grid;
    gap: 9px;
    min-width: 0;
  }

  .homeMockupInputGroup input[type='text'] {
    background: rgba(9, 9, 11, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: var(--ui-normal-text, #fafafa);
    font-size: 15px;
    font-weight: 580;
    height: 50px;
    min-width: 0;
    outline: none;
    padding: 0 16px;
    width: 100%;
  }

  .homeMockupInputGroup input[type='text']:focus {
    border-color: var(--ui-accent-normal-border, rgba(167, 139, 250, 0.55));
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.16);
  }

  .homeMockupPathRow {
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .homeMockupBrowseButton,
  .homeMockupPrimaryButton,
  .homeMockupSecondaryButton {
    align-items: center;
    border-radius: 16px;
    cursor: pointer;
    display: inline-flex;
    font-size: 14px;
    font-weight: 720;
    gap: 8px;
    height: 50px;
    justify-content: center;
    padding: 0 16px;
    white-space: nowrap;
  }

  .homeMockupBrowseButton,
  .homeMockupSecondaryButton {
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--ui-normal-text, #fafafa);
  }

  .homeMockupWarning {
    align-items: center;
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.24);
    border-radius: 16px;
    color: #fdba74;
    display: flex;
    font-size: 13px;
    font-weight: 620;
    gap: 10px;
    line-height: 1.35;
    padding: 12px 14px;
  }

  .homeMockupCheckboxRow {
    align-items: center;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    color: var(--ui-normal-text, #fafafa);
    display: flex;
    font-size: 14px;
    font-weight: 600;
    gap: 12px;
    line-height: 1.35;
    padding: 14px;
  }

  .homeMockupCheckboxRow input {
    accent-color: #8b5cf6;
    height: 18px;
    width: 18px;
  }

  .homeMockupDialogFooter {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 22px;
  }

  .homeMockupPrimaryButton {
    background: linear-gradient(135deg, #8b5cf6, #6d5dfc);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: white;
    min-width: 174px;
  }

  .homeMockupSecondaryButton {
    min-width: 96px;
  }

  @media (max-width: 820px) {
    .homeMockupShell {
      padding: 18px;
    }

    .homeMockupTitleBlock h1 {
      font-size: 42px;
    }

    .homeMockupGrid {
      grid-template-columns: 1fr;
    }

    .homeMockupCardHeader,
    .homeMockupDialogHeader,
    .homeMockupDialogFooter {
      align-items: stretch;
      flex-direction: column;
    }

    .homeMockupStatus {
      width: max-content;
    }

    .homeMockupPathRow {
      grid-template-columns: 1fr;
    }

    .homeMockupBrowseButton,
    .homeMockupPrimaryButton,
    .homeMockupSecondaryButton {
      width: 100%;
    }
  }
</style>
