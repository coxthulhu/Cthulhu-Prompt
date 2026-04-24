<script lang="ts">
  import { AlertTriangle, Check, FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let isCreateWorkspaceDialogOpen = $state(true)
  let workspaceName = $state('Cthulhu Prompt Workspace')
  let workspacePath = $state('C:\\Projects\\Prompt Workspaces\\Cthulhu Prompt')
  let includeExamplePrompts = $state(true)
  let isBrowsing = $state(false)

  const openWorkspaceFolderDialog = async (): Promise<OpenSelectWorkspaceFolderDialogResult> => {
    isBrowsing = true
    try {
      return await ipcInvoke<OpenSelectWorkspaceFolderDialogResult>('select-workspace-folder')
    } finally {
      isBrowsing = false
    }
  }

  const handleBrowseWorkspacePath = async () => {
    const result = await runIpcBestEffort(openWorkspaceFolderDialog, () => ({
      dialogCancelled: true,
      filePaths: []
    }))

    if (!result.dialogCancelled && result.filePaths.length > 0) {
      workspacePath = result.filePaths[0]
    }
  }
</script>

<main class="mockupShell">
  <section class="homeColumn">
    <div class="homeHeader">
      <div>
        <p class="eyebrow">CTHULHU PROMPT</p>
        <h1>Home</h1>
      </div>
      <button class="ghostButton" type="button" onclick={() => (isCreateWorkspaceDialogOpen = true)}>
        <FolderPlus size={18} />
        Create Workspace
      </button>
    </div>

    <div class="workspaceCard">
      <div class="cardTitleRow">
        <div class="accentTile">
          <FolderOpen size={24} />
        </div>
        <div>
          <h2>Current Workspace</h2>
          <p>No workspace selected</p>
        </div>
      </div>

      <div class="emptyWorkspace">
        <FolderPlus size={30} />
        <span>Choose or create a workspace to start organizing prompts.</span>
      </div>
    </div>
  </section>

  {#if isCreateWorkspaceDialogOpen}
    <div class="dialogOverlay">
      <div class="dialogPanel" aria-modal="true" role="dialog" aria-labelledby="create-workspace-title">
        <div class="dialogHeader">
          <div class="dialogTitleGroup">
            <div class="dialogIcon">
              <FolderPlus size={22} />
            </div>
            <div>
              <h2 id="create-workspace-title">Create Workspace</h2>
              <p>Set up a folder for prompts, folders, and workspace settings.</p>
            </div>
          </div>
          <button
            class="iconButton"
            type="button"
            aria-label="Close"
            onclick={() => (isCreateWorkspaceDialogOpen = false)}
          >
            <X size={18} />
          </button>
        </div>

        <div class="fieldStack">
          <label class="fieldGroup" for="workspace-name">
            <span>Workspace Name</span>
            <input id="workspace-name" bind:value={workspaceName} />
          </label>

          <label class="fieldGroup" for="workspace-path">
            <span>Workspace Path</span>
            <div class="pathControl">
              <input id="workspace-path" bind:value={workspacePath} />
              <button type="button" onclick={handleBrowseWorkspacePath}>
                <FolderOpen size={18} />
                {isBrowsing ? 'Browsing...' : 'Browse'}
              </button>
            </div>
          </label>

          <div class="warningRow">
            <AlertTriangle size={17} />
            <span>Select an empty folder to create a new workspace.</span>
          </div>

          <label class="checkboxRow" for="include-examples">
            <input id="include-examples" type="checkbox" bind:checked={includeExamplePrompts} />
            <span>Include example prompts in a "My Prompts" folder.</span>
          </label>
        </div>

        <div class="dialogFooter">
          <button class="secondaryButton" type="button" onclick={() => (isCreateWorkspaceDialogOpen = false)}>
            Cancel
          </button>
          <button class="primaryButton" type="button">
            <Check size={18} />
            Create Workspace
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background:
      radial-gradient(circle at top, oklch(0.22 0.025 281 / 70%), transparent 36rem),
      oklch(0.115 0.012 270);
  }

  .mockupShell {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    min-height: 100vh;
    justify-content: center;
    padding: 32px;
  }

  .homeColumn {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 880px;
    width: min(100%, 880px);
  }

  .homeHeader {
    align-items: center;
    display: flex;
    gap: 18px;
    justify-content: space-between;
  }

  .eyebrow {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0 0 8px;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: 32px;
    font-weight: 750;
    letter-spacing: 0;
    line-height: 1.08;
  }

  .ghostButton,
  .secondaryButton,
  .primaryButton,
  .pathControl button,
  .iconButton {
    align-items: center;
    border: 1px solid var(--ui-neutral-normal-border);
    color: var(--ui-normal-text);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    gap: 9px;
    justify-content: center;
    min-height: 44px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      transform 120ms ease;
  }

  .ghostButton,
  .secondaryButton,
  .pathControl button {
    background: var(--ui-neutral-normal-surface);
    border-radius: 14px;
    padding: 0 16px;
  }

  .ghostButton:hover,
  .secondaryButton:hover,
  .pathControl button:hover,
  .iconButton:hover {
    background: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-hover-border);
  }

  .workspaceCard,
  .dialogPanel {
    background: linear-gradient(
      145deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    border: 1px solid var(--ui-card-normal-border);
    box-shadow:
      0 24px 70px var(--ui-card-normal-shadow),
      inset 0 1px 0 var(--ui-card-nested-inset-highlight);
  }

  .workspaceCard {
    border-radius: 24px;
    padding: 24px;
  }

  .cardTitleRow,
  .dialogTitleGroup {
    align-items: center;
    display: flex;
    gap: 14px;
  }

  .accentTile,
  .dialogIcon {
    align-items: center;
    background: var(--ui-accent-icon-surface);
    border: 1px solid var(--ui-accent-icon-ring);
    border-radius: 18px;
    color: var(--ui-accent-icon-glyph);
    display: flex;
    flex: 0 0 auto;
    height: 54px;
    justify-content: center;
    width: 54px;
  }

  .cardTitleRow h2,
  .dialogHeader h2 {
    color: var(--ui-normal-text);
    font-size: 18px;
    font-weight: 750;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .cardTitleRow p,
  .dialogHeader p {
    color: var(--ui-secondary-text);
    font-size: 13px;
    line-height: 1.45;
    margin-top: 4px;
  }

  .emptyWorkspace {
    align-items: center;
    background: var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 18px;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 14px;
    font-weight: 650;
    gap: 12px;
    margin-top: 24px;
    min-height: 96px;
    padding: 20px;
  }

  .dialogOverlay {
    align-items: center;
    background: oklch(0 0 0 / 62%);
    backdrop-filter: blur(18px);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 24px;
    position: fixed;
    z-index: 10;
  }

  .dialogPanel {
    border-radius: 28px;
    max-width: 620px;
    padding: 24px;
    width: min(100%, 620px);
  }

  .dialogHeader {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }

  .iconButton {
    background: var(--ui-neutral-muted-surface);
    border-radius: 14px;
    flex: 0 0 auto;
    height: 42px;
    min-height: 42px;
    padding: 0;
    width: 42px;
  }

  .fieldStack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 24px;
  }

  .fieldGroup {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fieldGroup > span {
    color: var(--ui-secondary-text);
    font-size: 13px;
    font-weight: 750;
  }

  .fieldGroup input:not([type]),
  .pathControl input {
    background: var(--ui-neutral-field-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 14px;
    color: var(--ui-normal-text);
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    min-height: 48px;
    outline: none;
    padding: 0 14px;
    width: 100%;
  }

  input:focus {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: 0 0 0 4px var(--ui-accent-icon-ring);
  }

  .pathControl {
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .pathControl button {
    min-width: 122px;
  }

  .warningRow {
    align-items: center;
    background: var(--ui-danger-normal-surface);
    border: 1px solid var(--ui-danger-normal-border);
    border-radius: 14px;
    color: var(--ui-danger-icon-glyph);
    display: flex;
    font-size: 13px;
    font-weight: 700;
    gap: 10px;
    line-height: 1.35;
    padding: 12px 14px;
  }

  .checkboxRow {
    align-items: center;
    background: var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 16px;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 14px;
    font-weight: 650;
    gap: 12px;
    line-height: 1.4;
    padding: 14px;
  }

  .checkboxRow input {
    accent-color: var(--ui-accent-icon-glyph);
    flex: 0 0 auto;
    height: 18px;
    width: 18px;
  }

  .dialogFooter {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 24px;
  }

  .primaryButton {
    background: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    border-radius: 14px;
    color: var(--ui-accent-normal-text);
    padding: 0 18px;
  }

  .primaryButton:hover {
    background: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
  }

  @media (max-width: 640px) {
    .mockupShell {
      align-items: flex-start;
      padding: 18px;
    }

    .homeHeader,
    .dialogHeader {
      align-items: stretch;
      flex-direction: column;
    }

    .ghostButton,
    .pathControl,
    .dialogFooter,
    .secondaryButton,
    .primaryButton {
      width: 100%;
    }

    .pathControl {
      grid-template-columns: 1fr;
    }

    .dialogPanel {
      border-radius: 22px;
      padding: 18px;
    }
  }
</style>
