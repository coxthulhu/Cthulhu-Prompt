<script lang="ts">
  import { AlertTriangle, Check, FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import { ipcInvoke } from '@renderer/data/IpcFramework/IpcInvoke'

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let dialogOpen = $state(true)
  let workspaceName = $state('Client prompts')
  let workspacePath = $state('C:\\Users\\Dmin\\Documents\\Client prompts')
  let includeExamples = $state(true)
  let isBrowsing = $state(false)

  const pathWarning = $derived(
    workspacePath ? 'Choose an empty folder before creating a new workspace.' : ''
  )

  const openDialog = () => {
    dialogOpen = true
  }

  const closeDialog = () => {
    dialogOpen = false
  }

  const browseForWorkspacePath = async () => {
    isBrowsing = true
    try {
      const result =
        await ipcInvoke<OpenSelectWorkspaceFolderDialogResult>('select-workspace-folder')
      if (!result.dialogCancelled && result.filePaths[0]) {
        workspacePath = result.filePaths[0]
      }
    } finally {
      isBrowsing = false
    }
  }
</script>

<main class="mockupHome">
  <section class="mockupHomeColumn">
    <div class="mockupTitleRow">
      <div>
        <p class="mockupKicker">CTHULHU PROMPT</p>
        <h1>Home</h1>
      </div>
      <button class="mockupTempButton" type="button" onclick={openDialog}>
        <FolderPlus size={18} />
        <span>New Workspace</span>
      </button>
    </div>

    <div class="mockupCardGrid">
      <article class="mockupCard">
        <div class="mockupCardIcon">
          <FolderOpen size={22} />
        </div>
        <div>
          <h2>Current Workspace</h2>
          <p>No workspace selected</p>
        </div>
      </article>

      <article class="mockupCard">
        <div class="mockupCardIcon mockupAccentIcon">
          <FolderPlus size={22} />
        </div>
        <div>
          <h2>Workspace Actions</h2>
          <p>Create or open a workspace folder.</p>
        </div>
      </article>
    </div>
  </section>

  {#if dialogOpen}
    <div class="mockupOverlay" role="presentation">
      <section
        class="mockupDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-create-title"
      >
        <div class="mockupDialogHeader">
          <div class="mockupDialogTitleWrap">
            <div class="mockupDialogIcon">
              <FolderPlus size={22} />
            </div>
            <div>
              <h2 id="workspace-create-title">Create Workspace</h2>
              <p>Set up a new Cthulhu Prompt workspace folder.</p>
            </div>
          </div>
          <button class="mockupIconButton" type="button" aria-label="Close" onclick={closeDialog}>
            <X size={18} />
          </button>
        </div>

        <div class="mockupDialogBody">
          <label class="mockupField">
            <span>Workspace Name</span>
            <input bind:value={workspaceName} spellcheck="false" />
          </label>

          <label class="mockupField">
            <span>Workspace Path</span>
            <div class="mockupPathControl">
              <input bind:value={workspacePath} spellcheck="false" />
              <button type="button" onclick={browseForWorkspacePath}>
                <FolderOpen size={17} />
                <span>{isBrowsing ? 'Browsing...' : 'Browse'}</span>
              </button>
            </div>
          </label>

          {#if pathWarning}
            <div class="mockupWarning">
              <AlertTriangle size={17} />
              <span>{pathWarning}</span>
            </div>
          {/if}

          <label class="mockupCheckboxRow">
            <input type="checkbox" bind:checked={includeExamples} />
            <span>Include example prompts in a "My Prompts" folder.</span>
          </label>
        </div>

        <div class="mockupDialogFooter">
          <button class="mockupSecondaryButton" type="button" onclick={closeDialog}>Cancel</button>
          <button class="mockupPrimaryButton" type="button">
            <Check size={17} />
            <span>Create Workspace</span>
          </button>
        </div>
      </section>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: oklch(0.13 0.014 268);
  }

  .mockupHome {
    align-items: flex-start;
    background:
      radial-gradient(circle at 50% -18%, var(--ui-accent-normal-surface), transparent 34rem),
      linear-gradient(180deg, oklch(0.16 0.014 268), oklch(0.105 0.011 268));
    color: var(--ui-normal-text);
    display: flex;
    justify-content: center;
    min-height: 100vh;
    overflow: hidden;
    padding: 56px 24px;
  }

  .mockupHomeColumn {
    display: grid;
    gap: 22px;
    max-width: 960px;
    width: 100%;
  }

  .mockupTitleRow {
    align-items: end;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }

  .mockupKicker {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    margin: 0 0 9px;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: 32px;
    font-weight: 750;
    line-height: 1;
  }

  .mockupTempButton,
  .mockupPrimaryButton,
  .mockupSecondaryButton,
  .mockupPathControl button,
  .mockupIconButton {
    align-items: center;
    border: 1px solid;
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-weight: 700;
    justify-content: center;
  }

  .mockupTempButton {
    background: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    border-radius: 16px;
    box-shadow: 0 18px 48px var(--ui-shadow-raised);
    color: var(--ui-accent-normal-text);
    gap: 10px;
    min-height: 46px;
    padding: 0 18px;
  }

  .mockupCardGrid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mockupCard {
    align-items: center;
    background: linear-gradient(
      135deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    border: 1px solid var(--ui-card-normal-border);
    border-radius: 22px;
    box-shadow: 0 24px 70px var(--ui-card-normal-shadow);
    display: flex;
    gap: 16px;
    min-height: 136px;
    padding: 22px;
  }

  .mockupCardIcon,
  .mockupDialogIcon {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 16px;
    color: var(--ui-hoverable-text);
    display: inline-flex;
    flex: 0 0 auto;
    height: 50px;
    justify-content: center;
    width: 50px;
  }

  .mockupAccentIcon,
  .mockupDialogIcon {
    background: var(--ui-accent-icon-surface);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-icon-glyph);
  }

  .mockupCard h2,
  .mockupDialog h2 {
    color: var(--ui-normal-text);
    font-size: 18px;
    font-weight: 750;
    line-height: 1.1;
  }

  .mockupCard p,
  .mockupDialogHeader p {
    color: var(--ui-muted-text);
    font-size: 13px;
    font-weight: 550;
    line-height: 1.45;
    margin-top: 7px;
  }

  .mockupOverlay {
    align-items: center;
    background: oklch(0 0 0 / 52%);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 24px;
    position: fixed;
  }

  .mockupDialog {
    background:
      linear-gradient(180deg, oklch(0.195 0.013 268 / 96%), oklch(0.145 0.012 268 / 96%)),
      var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-normal-border);
    border-radius: 26px;
    box-shadow:
      0 30px 90px oklch(0 0 0 / 48%),
      inset 0 1px 0 var(--ui-card-nested-inset-highlight);
    max-width: 620px;
    overflow: hidden;
    width: min(100%, 620px);
  }

  .mockupDialogHeader {
    align-items: flex-start;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    gap: 18px;
    justify-content: space-between;
    padding: 24px 24px 20px;
  }

  .mockupDialogTitleWrap {
    align-items: center;
    display: flex;
    gap: 16px;
    min-width: 0;
  }

  .mockupIconButton {
    background: var(--ui-neutral-muted-surface);
    border-color: var(--ui-neutral-muted-border);
    border-radius: 14px;
    color: var(--ui-secondary-text);
    height: 38px;
    width: 38px;
  }

  .mockupDialogBody {
    display: grid;
    gap: 16px;
    padding: 22px 24px 24px;
  }

  .mockupField {
    display: grid;
    gap: 8px;
  }

  .mockupField > span {
    color: var(--ui-secondary-text);
    font-size: 12px;
    font-weight: 750;
  }

  .mockupField input,
  .mockupPathControl input {
    background: var(--ui-neutral-field-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 15px;
    box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
    color: var(--ui-normal-text);
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    min-height: 46px;
    min-width: 0;
    outline: none;
    padding: 0 15px;
    width: 100%;
  }

  .mockupField input:focus,
  .mockupPathControl input:focus {
    border-color: var(--ui-accent-hover-border);
    box-shadow:
      0 0 0 3px var(--ui-accent-normal-surface),
      inset 0 1px 0 var(--ui-card-nested-inset-highlight);
  }

  .mockupPathControl {
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .mockupPathControl button {
    background: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    border-radius: 15px;
    color: var(--ui-hoverable-text);
    gap: 9px;
    min-height: 46px;
    padding: 0 16px;
  }

  .mockupWarning {
    align-items: center;
    background: var(--ui-danger-normal-surface);
    border: 1px solid var(--ui-danger-normal-border);
    border-radius: 16px;
    color: var(--ui-danger-icon-glyph);
    display: flex;
    gap: 10px;
    min-height: 44px;
    padding: 10px 13px;
  }

  .mockupWarning span {
    color: var(--ui-hoverable-text);
    font-size: 13px;
    font-weight: 650;
    line-height: 1.35;
  }

  .mockupCheckboxRow {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 18px;
    color: var(--ui-secondary-text);
    display: flex;
    gap: 12px;
    min-height: 54px;
    padding: 12px 14px;
  }

  .mockupCheckboxRow input {
    accent-color: oklch(0.709 0.159 293.541);
    flex: 0 0 auto;
    height: 18px;
    width: 18px;
  }

  .mockupCheckboxRow span {
    font-size: 13px;
    font-weight: 650;
    line-height: 1.4;
  }

  .mockupDialogFooter {
    align-items: center;
    background: oklch(1 0 0 / 3%);
    border-top: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 18px 24px 22px;
  }

  .mockupPrimaryButton,
  .mockupSecondaryButton {
    border-radius: 16px;
    gap: 9px;
    min-height: 46px;
    padding: 0 18px;
  }

  .mockupPrimaryButton {
    background: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }

  .mockupSecondaryButton {
    background: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-hoverable-text);
  }

  @media (max-width: 720px) {
    .mockupHome {
      padding: 28px 16px;
    }

    .mockupTitleRow,
    .mockupDialogFooter {
      align-items: stretch;
      flex-direction: column;
    }

    .mockupTempButton,
    .mockupPrimaryButton,
    .mockupSecondaryButton {
      width: 100%;
    }

    .mockupCardGrid,
    .mockupPathControl {
      grid-template-columns: 1fr;
    }

    .mockupDialogHeader {
      padding: 20px 20px 18px;
    }

    .mockupDialogBody,
    .mockupDialogFooter {
      padding-left: 20px;
      padding-right: 20px;
    }
  }
</style>
