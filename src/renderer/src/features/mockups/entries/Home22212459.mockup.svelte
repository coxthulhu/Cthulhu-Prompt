<script lang="ts">
  import { AlertTriangle, Check, FolderOpen, FolderPlus, X } from 'lucide-svelte'

  let isDialogOpen = $state(true)
  let workspaceName = $state('My Workspace')
  let workspacePath = $state('C:\\Users\\Dev\\Documents\\Prompt Workspaces\\My Workspace')
  let includeExamples = $state(true)

  const openDialog = () => {
    isDialogOpen = true
  }

  const closeDialog = () => {
    isDialogOpen = false
  }

  const chooseFolder = () => {
    workspacePath = 'C:\\Users\\Dev\\Documents\\Existing Project'
  }
</script>

<main class="homeMockupShell">
  <section class="homeMockupColumn">
    <div class="homeMockupHeader">
      <p class="homeMockupKicker">CTHULHU PROMPT</p>
      <h1>Home</h1>
    </div>

    <div class="homeMockupCard">
      <div class="homeMockupCardHeader">
        <div class="homeMockupIconTile">
          <FolderPlus size={24} strokeWidth={2.25} />
        </div>
        <div>
          <h2>Workspace Actions</h2>
          <p>Change your current workspace.</p>
        </div>
      </div>

      <button class="homeMockupPrimaryButton" type="button" onclick={openDialog}>
        <FolderPlus size={20} strokeWidth={2.3} />
        <span>Create Workspace</span>
      </button>
    </div>
  </section>

  {#if isDialogOpen}
    <div class="homeMockupBackdrop" role="presentation" onclick={closeDialog}></div>
    <div
      class="homeMockupDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
    >
      <div class="homeMockupDialogHeader">
        <div class="homeMockupDialogTitleBlock">
          <div class="homeMockupIconTile homeMockupIconTileLarge">
            <FolderOpen size={25} strokeWidth={2.25} />
          </div>
          <div>
            <h2 id="create-workspace-title">Create Workspace</h2>
            <p>Set up a folder for your prompts.</p>
          </div>
        </div>

        <button class="homeMockupIconButton" type="button" aria-label="Close" onclick={closeDialog}>
          <X size={19} strokeWidth={2.35} />
        </button>
      </div>

      <div class="homeMockupForm">
        <label class="homeMockupField">
          <span>Workspace Name</span>
          <input bind:value={workspaceName} type="text" aria-label="Workspace Name" />
        </label>

        <label class="homeMockupField">
          <span>Workspace Path</span>
          <div class="homeMockupPathRow">
            <input bind:value={workspacePath} type="text" aria-label="Workspace Path" />
            <button class="homeMockupBrowseButton" type="button" onclick={chooseFolder}>
              <FolderOpen size={18} strokeWidth={2.3} />
              <span>Browse</span>
            </button>
          </div>
        </label>

        <div class="homeMockupWarning">
          <AlertTriangle size={18} strokeWidth={2.3} style="flex: 0 0 auto; margin-top: 1px;" />
          <p>This folder is not empty. Choose an empty folder or create a new folder.</p>
        </div>

        <label class="homeMockupCheckboxRow">
          <input bind:checked={includeExamples} type="checkbox" />
          <span class="homeMockupCheckboxControl" aria-hidden="true">
            {#if includeExamples}
              <Check size={15} strokeWidth={3} />
            {/if}
          </span>
          <span>Include example prompts in a "My Prompts" folder.</span>
        </label>
      </div>

      <div class="homeMockupDialogFooter">
        <button class="homeMockupSecondaryButton" type="button" onclick={closeDialog}>Cancel</button>
        <button class="homeMockupCreateButton" type="button">
          <FolderPlus size={19} strokeWidth={2.35} />
          <span>Create Workspace</span>
        </button>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background:
      radial-gradient(circle at 50% -10%, rgba(139, 92, 246, 0.16), transparent 34rem),
      #09090b;
  }

  .homeMockupShell {
    align-items: center;
    background:
      linear-gradient(180deg, rgba(24, 24, 27, 0.72), rgba(9, 9, 11, 0.94)),
      #09090b;
    color: var(--ui-normal-text, #f4f4f5);
    display: flex;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    justify-content: center;
    letter-spacing: 0;
    min-height: 100vh;
    overflow: hidden;
    padding: 32px;
    position: relative;
  }

  .homeMockupColumn {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 760px;
    width: min(100%, 760px);
  }

  .homeMockupHeader {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 4px;
  }

  .homeMockupKicker {
    color: color-mix(in srgb, var(--ui-normal-text, #f4f4f5) 48%, transparent);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
    margin: 0;
  }

  .homeMockupHeader h1,
  .homeMockupCard h2,
  .homeMockupDialog h2,
  .homeMockupDialog p {
    margin: 0;
  }

  .homeMockupHeader h1 {
    color: var(--ui-normal-text, #f4f4f5);
    font-size: 34px;
    font-weight: 760;
    line-height: 1.08;
  }

  .homeMockupCard {
    background: rgba(24, 24, 27, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
  }

  .homeMockupCardHeader,
  .homeMockupDialogTitleBlock {
    align-items: center;
    display: flex;
    gap: 14px;
  }

  .homeMockupIconTile {
    align-items: center;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.28);
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
    color: rgb(196, 181, 253);
    display: inline-flex;
    flex: 0 0 auto;
    height: 52px;
    justify-content: center;
    width: 52px;
  }

  .homeMockupIconTileLarge {
    height: 56px;
    width: 56px;
  }

  .homeMockupCard h2,
  .homeMockupDialog h2 {
    color: var(--ui-normal-text, #f4f4f5);
    font-size: 19px;
    font-weight: 720;
    line-height: 1.2;
  }

  .homeMockupCard p,
  .homeMockupDialogHeader p {
    color: color-mix(in srgb, var(--ui-normal-text, #f4f4f5) 58%, transparent);
    font-size: 13px;
    font-weight: 520;
    line-height: 1.45;
    margin-top: 4px;
  }

  button,
  input {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .homeMockupPrimaryButton,
  .homeMockupCreateButton,
  .homeMockupBrowseButton,
  .homeMockupSecondaryButton,
  .homeMockupIconButton {
    align-items: center;
    border: 1px solid transparent;
    border-radius: 16px;
    display: inline-flex;
    font-size: 14px;
    font-weight: 720;
    gap: 10px;
    justify-content: center;
    min-height: 46px;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      transform 140ms ease;
  }

  .homeMockupPrimaryButton,
  .homeMockupCreateButton {
    background: linear-gradient(180deg, rgb(139, 92, 246), rgb(109, 40, 217));
    border-color: rgba(216, 180, 254, 0.28);
    box-shadow:
      0 14px 34px rgba(88, 28, 135, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    color: #ffffff;
    padding: 0 18px;
  }

  .homeMockupPrimaryButton {
    min-height: 58px;
    width: 100%;
  }

  .homeMockupPrimaryButton:hover,
  .homeMockupCreateButton:hover,
  .homeMockupBrowseButton:hover,
  .homeMockupSecondaryButton:hover,
  .homeMockupIconButton:hover {
    transform: translateY(-1px);
  }

  .homeMockupBackdrop {
    background: rgba(0, 0, 0, 0.62);
    inset: 0;
    position: fixed;
  }

  .homeMockupDialog {
    background: rgba(24, 24, 27, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 28px;
    box-shadow:
      0 30px 90px rgba(0, 0, 0, 0.62),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
    display: flex;
    flex-direction: column;
    gap: 22px;
    left: 50%;
    max-height: calc(100vh - 48px);
    max-width: 650px;
    overflow: auto;
    padding: 24px;
    position: fixed;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(calc(100vw - 32px), 650px);
  }

  .homeMockupDialogHeader {
    align-items: flex-start;
    display: flex;
    gap: 18px;
    justify-content: space-between;
  }

  .homeMockupIconButton {
    background: rgba(39, 39, 42, 0.86);
    border-color: rgba(255, 255, 255, 0.1);
    color: color-mix(in srgb, var(--ui-normal-text, #f4f4f5) 72%, transparent);
    flex: 0 0 auto;
    height: 44px;
    min-height: 44px;
    padding: 0;
    width: 44px;
  }

  .homeMockupForm {
    background: rgba(15, 15, 18, 0.76);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
  }

  .homeMockupField {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .homeMockupField > span {
    color: color-mix(in srgb, var(--ui-normal-text, #f4f4f5) 70%, transparent);
    font-size: 12px;
    font-weight: 760;
  }

  .homeMockupField input {
    background: rgba(39, 39, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    color: var(--ui-normal-text, #f4f4f5);
    font-size: 14px;
    font-weight: 620;
    min-height: 48px;
    outline: none;
    padding: 0 15px;
    width: 100%;
  }

  .homeMockupField input:focus {
    border-color: rgba(167, 139, 250, 0.72);
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.16);
  }

  .homeMockupPathRow {
    align-items: stretch;
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .homeMockupBrowseButton,
  .homeMockupSecondaryButton {
    background: rgba(39, 39, 42, 0.9);
    border-color: rgba(255, 255, 255, 0.11);
    color: var(--ui-normal-text, #f4f4f5);
    padding: 0 16px;
  }

  .homeMockupWarning {
    align-items: flex-start;
    background: rgba(120, 53, 15, 0.28);
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: 16px;
    color: rgb(252, 211, 77);
    display: flex;
    gap: 10px;
    padding: 12px 13px;
  }

  .homeMockupWarning p {
    color: rgb(253, 224, 71);
    font-size: 13px;
    font-weight: 630;
    line-height: 1.4;
  }

  .homeMockupCheckboxRow {
    align-items: center;
    color: color-mix(in srgb, var(--ui-normal-text, #f4f4f5) 78%, transparent);
    display: grid;
    font-size: 13px;
    font-weight: 620;
    gap: 10px;
    grid-template-columns: 0 24px minmax(0, 1fr);
    line-height: 1.4;
  }

  .homeMockupCheckboxRow input {
    height: 0;
    opacity: 0;
    pointer-events: none;
    width: 0;
  }

  .homeMockupCheckboxControl {
    align-items: center;
    background: rgba(39, 39, 42, 0.9);
    border: 1px solid rgba(167, 139, 250, 0.55);
    border-radius: 8px;
    color: #ffffff;
    display: inline-flex;
    height: 24px;
    justify-content: center;
    width: 24px;
  }

  .homeMockupCheckboxRow input:checked + .homeMockupCheckboxControl {
    background: rgb(124, 58, 237);
    border-color: rgba(216, 180, 254, 0.68);
  }

  .homeMockupDialogFooter {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  .homeMockupSecondaryButton,
  .homeMockupCreateButton {
    min-width: 132px;
  }

  @media (max-width: 620px) {
    .homeMockupShell {
      align-items: stretch;
      padding: 20px;
    }

    .homeMockupColumn {
      justify-content: center;
    }

    .homeMockupDialog {
      border-radius: 22px;
      padding: 18px;
    }

    .homeMockupDialogHeader,
    .homeMockupDialogTitleBlock {
      gap: 12px;
    }

    .homeMockupPathRow {
      grid-template-columns: 1fr;
    }

    .homeMockupBrowseButton,
    .homeMockupSecondaryButton,
    .homeMockupCreateButton {
      width: 100%;
    }

    .homeMockupDialogFooter {
      flex-direction: column-reverse;
    }
  }
</style>
