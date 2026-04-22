<script lang="ts">
  import { AlertTriangle, Check, FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let isCreateWorkspaceDialogOpen = $state(true)
  let isBrowsingFolder = $state(false)
  let workspaceName = $state('Cthulhu Prompt Workspace')
  let workspacePath = $state('C:\\Users\\dmin\\Documents\\Prompt Workspace')
  let includeExamplePrompts = $state(true)

  const openCreateWorkspaceDialog = () => {
    isCreateWorkspaceDialogOpen = true
  }

  const closeCreateWorkspaceDialog = () => {
    isCreateWorkspaceDialogOpen = false
  }

  const openWorkspaceFolderDialog = async (): Promise<OpenSelectWorkspaceFolderDialogResult> => {
    isBrowsingFolder = true
    try {
      return await ipcInvoke<OpenSelectWorkspaceFolderDialogResult>('select-workspace-folder')
    } finally {
      isBrowsingFolder = false
    }
  }

  const handleBrowseFolder = async () => {
    const result = await runIpcBestEffort(openWorkspaceFolderDialog, () => ({
      dialogCancelled: true,
      filePaths: []
    }))

    if (!result.dialogCancelled && result.filePaths.length > 0) {
      workspacePath = result.filePaths[0]
    }
  }
</script>

<main
  style="box-sizing: border-box; min-height: 100vh; width: 100%; overflow: hidden; background: radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ui-accent-normal-surface, rgb(76 29 149)) 52%, transparent), transparent 34rem), rgb(18 18 21); color: var(--ui-normal-text, rgb(244 244 245)); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
>
  <section
    style="box-sizing: border-box; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 48px 24px;"
  >
    <div
      style="box-sizing: border-box; width: min(100%, 720px); border: 1px solid rgb(255 255 255 / 0.1); border-radius: 28px; background: rgb(31 31 35 / 0.82); box-shadow: 0 28px 90px rgb(0 0 0 / 0.36); padding: 34px;"
    >
      <div style="display: flex; align-items: center; gap: 16px;">
        <div
          style="display: grid; height: 54px; width: 54px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-accent-normal-border, rgb(139 92 246 / 0.42)); border-radius: 18px; background: var(--ui-accent-normal-surface, rgb(91 33 182 / 0.22)); color: var(--ui-accent-normal-text, rgb(196 181 253));"
        >
          <FolderPlus size={26} strokeWidth={2.1} />
        </div>
        <div style="min-width: 0;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 750; letter-spacing: 0;">
            Current Workspace
          </h1>
          <p style="margin: 8px 0 0; color: rgb(161 161 170); font-size: 14px; font-weight: 500;">
            No workspace selected
          </p>
        </div>
      </div>

      <div
        style="box-sizing: border-box; margin-top: 28px; display: grid; gap: 14px; border: 1px solid rgb(255 255 255 / 0.08); border-radius: 22px; background: rgb(24 24 27 / 0.76); padding: 18px;"
      >
        <button
          type="button"
          onclick={openCreateWorkspaceDialog}
          style="box-sizing: border-box; display: flex; min-height: 64px; width: 100%; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--ui-accent-normal-border, rgb(139 92 246 / 0.5)); border-radius: 18px; background: var(--ui-accent-normal-surface, rgb(91 33 182 / 0.24)); color: var(--ui-normal-text, rgb(250 250 250)); cursor: pointer; padding: 14px 18px; text-align: left;"
        >
          <span style="display: flex; min-width: 0; align-items: center; gap: 14px;">
            <span
              style="display: grid; height: 38px; width: 38px; flex: 0 0 auto; place-items: center; border-radius: 13px; background: rgb(255 255 255 / 0.08); color: var(--ui-accent-normal-text, rgb(216 180 254));"
            >
              <FolderPlus size={21} />
            </span>
            <span style="display: grid; min-width: 0; gap: 4px;">
              <span style="font-size: 15px; font-weight: 750; letter-spacing: 0;">
                Create Workspace
              </span>
              <span style="color: rgb(212 212 216); font-size: 13px; font-weight: 500;">
                Choose a folder and set up a new workspace folder.
              </span>
            </span>
          </span>
          <FolderOpen size={20} style="flex: 0 0 auto; color: var(--ui-accent-normal-text, rgb(216 180 254));" />
        </button>
      </div>
    </div>
  </section>

  {#if isCreateWorkspaceDialogOpen}
    <div
      role="presentation"
      style="position: fixed; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 0.58); padding: 24px;"
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby="create-workspace-title"
        style="box-sizing: border-box; width: min(100%, 640px); overflow: hidden; border: 1px solid rgb(255 255 255 / 0.12); border-radius: 30px; background: rgb(31 31 35 / 0.96); box-shadow: 0 34px 120px rgb(0 0 0 / 0.58); color: var(--ui-normal-text, rgb(250 250 250));"
      >
        <header
          style="box-sizing: border-box; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 1px solid rgb(255 255 255 / 0.08); padding: 24px 26px 22px;"
        >
          <div style="display: flex; min-width: 0; gap: 16px;">
            <div
              style="display: grid; height: 48px; width: 48px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-accent-normal-border, rgb(139 92 246 / 0.42)); border-radius: 17px; background: var(--ui-accent-normal-surface, rgb(91 33 182 / 0.24)); color: var(--ui-accent-normal-text, rgb(216 180 254));"
            >
              <FolderPlus size={24} />
            </div>
            <div style="min-width: 0;">
              <h2
                id="create-workspace-title"
                style="margin: 0; font-size: 22px; font-weight: 780; letter-spacing: 0;"
              >
                Create Workspace
              </h2>
              <p style="margin: 7px 0 0; color: rgb(161 161 170); font-size: 13px; font-weight: 500;">
                Set up a new workspace folder.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onclick={closeCreateWorkspaceDialog}
            style="display: grid; height: 38px; width: 38px; flex: 0 0 auto; place-items: center; border: 1px solid rgb(255 255 255 / 0.09); border-radius: 13px; background: rgb(39 39 42); color: rgb(212 212 216); cursor: pointer;"
          >
            <X size={18} />
          </button>
        </header>

        <div style="box-sizing: border-box; display: grid; gap: 18px; padding: 24px 26px;">
          <label style="display: grid; gap: 9px;">
            <span style="font-size: 13px; font-weight: 720; color: rgb(228 228 231);">
              Workspace Name
            </span>
            <input
              bind:value={workspaceName}
              type="text"
              style="box-sizing: border-box; height: 50px; width: 100%; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 16px; background: rgb(18 18 21); color: var(--ui-normal-text, rgb(250 250 250)); font-size: 15px; font-weight: 600; outline: none; padding: 0 16px;"
            />
          </label>

          <div style="display: grid; gap: 9px;">
            <label
              for="workspace-folder-path"
              style="font-size: 13px; font-weight: 720; color: rgb(228 228 231);"
            >
              Workspace Folder
            </label>
            <div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px;">
              <input
                id="workspace-folder-path"
                bind:value={workspacePath}
                type="text"
                style="box-sizing: border-box; height: 50px; min-width: 0; width: 100%; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 16px; background: rgb(18 18 21); color: var(--ui-normal-text, rgb(250 250 250)); font-size: 14px; font-weight: 600; outline: none; padding: 0 16px;"
              />
              <button
                type="button"
                onclick={handleBrowseFolder}
                disabled={isBrowsingFolder}
                style="box-sizing: border-box; display: inline-flex; height: 50px; align-items: center; justify-content: center; gap: 9px; border: 1px solid rgb(255 255 255 / 0.11); border-radius: 16px; background: rgb(63 63 70); color: rgb(244 244 245); cursor: pointer; padding: 0 16px; font-size: 14px; font-weight: 720;"
              >
                <FolderOpen size={18} />
                {isBrowsingFolder ? 'Browsing...' : 'Browse'}
              </button>
            </div>
            <div
              style="box-sizing: border-box; display: flex; align-items: flex-start; gap: 10px; border: 1px solid rgb(251 191 36 / 0.34); border-radius: 15px; background: rgb(113 63 18 / 0.24); color: rgb(253 230 138); padding: 11px 12px; font-size: 13px; font-weight: 600; line-height: 1.35;"
            >
              <AlertTriangle size={17} style="margin-top: 1px; flex: 0 0 auto;" />
              <span>This folder is not empty. Choose an empty folder for a new workspace.</span>
            </div>
          </div>

          <label
            style="box-sizing: border-box; display: flex; align-items: center; gap: 13px; border: 1px solid rgb(255 255 255 / 0.08); border-radius: 18px; background: rgb(24 24 27 / 0.86); padding: 15px 16px;"
          >
            <input
              bind:checked={includeExamplePrompts}
              type="checkbox"
              style="height: 18px; width: 18px; accent-color: rgb(139 92 246);"
            />
            <span style="color: rgb(228 228 231); font-size: 14px; font-weight: 650;">
              Include example prompts in a "My Prompts" folder.
            </span>
          </label>
        </div>

        <footer
          style="box-sizing: border-box; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgb(255 255 255 / 0.08); padding: 18px 26px 24px;"
        >
          <button
            type="button"
            onclick={closeCreateWorkspaceDialog}
            style="box-sizing: border-box; height: 44px; border: 1px solid rgb(255 255 255 / 0.11); border-radius: 15px; background: rgb(39 39 42); color: rgb(244 244 245); cursor: pointer; padding: 0 18px; font-size: 14px; font-weight: 720;"
          >
            Cancel
          </button>
          <button
            type="button"
            style="box-sizing: border-box; display: inline-flex; height: 44px; align-items: center; gap: 9px; border: 1px solid var(--ui-accent-normal-border, rgb(139 92 246 / 0.5)); border-radius: 15px; background: var(--ui-accent-normal-surface, rgb(91 33 182 / 0.34)); color: var(--ui-normal-text, rgb(250 250 250)); cursor: pointer; padding: 0 18px; font-size: 14px; font-weight: 760;"
          >
            <Check size={18} />
            Create Workspace
          </button>
        </footer>
      </div>
    </div>
  {/if}
</main>
