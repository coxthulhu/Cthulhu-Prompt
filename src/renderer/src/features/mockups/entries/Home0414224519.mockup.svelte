<script lang="ts">
  type PreviewDialog = 'none' | 'setup' | 'existing' | 'invalid'

  let {
    workspacePath = 'C:\\Users\\Daria\\Documents\\Cthulhu Prompt Workspace',
    isWorkspaceReady = true,
    isWorkspaceLoading = false,
    promptCount = 124,
    promptFolderCount = 9,
    previewDialog = 'none'
  } = $props<{
    workspacePath?: string | null
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    promptCount?: number
    promptFolderCount?: number
    previewDialog?: PreviewDialog
  }>()

  let includeExamplePrompts = $state(true)

  const workspaceName = $derived.by(() => {
    if (!workspacePath) {
      return 'No Workspace Selected'
    }

    const segments = workspacePath.split(/[\\/]/).filter(Boolean)
    return segments.at(-1) ?? workspacePath
  })

  const selectWorkspaceLabel = $derived(
    isWorkspaceLoading ? 'Loading...' : 'Select Workspace Folder'
  )
  const createWorkspaceLabel = $derived(
    isWorkspaceLoading ? 'Creating...' : 'Create Workspace Folder'
  )
</script>

<main
  data-testid="home-screen"
  style="min-height: 100%; padding: 32px; box-sizing: border-box; overflow: auto; background:
    radial-gradient(circle at top, rgba(124, 58, 237, 0.18), transparent 32%),
    linear-gradient(180deg, #0f1117 0%, #0a0c10 100%); color: #f5f5f5; font-family: 'Segoe UI', sans-serif;"
>
  <div
    style="width: 100%; max-width: 1120px; margin: 0 auto; min-height: calc(100vh - 64px); display: flex; align-items: center; justify-content: center;"
  >
    <section style="width: 100%; display: flex; flex-direction: column; gap: 24px;">
      <div
        style="display: flex; flex-direction: column; gap: 22px; padding: 28px; border-radius: 34px; border: 1px solid rgba(255, 255, 255, 0.08); background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.025));
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);"
      >
        <div
          style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;"
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <div
              style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(216, 180, 254, 0.28); background: rgba(139, 92, 246, 0.14); color: #f5f3ff; font-size: 12px; font-weight: 700; letter-spacing: 0.14em;"
            >
              <span
                style="width: 8px; height: 8px; border-radius: 999px; background: #c4b5fd; box-shadow: 0 0 18px rgba(196, 181, 253, 0.65);"
              ></span>
              HOME
            </div>

            <div
              style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.05); color: #d4d4d8; font-size: 12px; font-weight: 600;"
            >
              {#if isWorkspaceReady}
                Workspace Ready
              {:else}
                Get Started
              {/if}
            </div>
          </div>

          <div
            style="display: inline-flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(6, 8, 12, 0.55); color: #a1a1aa; font-size: 12px; font-weight: 600;"
          >
            <span>Prompts</span>
            <span style="color: #ffffff;">{promptCount}</span>
            <span style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.1);"></span>
            <span>Folders</span>
            <span style="color: #ffffff;">{promptFolderCount}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <h1
            data-testid="home-title"
            style="margin: 0; font-size: clamp(44px, 8vw, 72px); line-height: 0.94; letter-spacing: -0.05em; font-weight: 800;"
          >
            Cthulhu Prompt
          </h1>

          {#if isWorkspaceReady}
            <p
              style="margin: 0; max-width: 720px; color: #a1a1aa; font-size: 15px; line-height: 1.7; font-weight: 600;"
            >
              Open your current workspace, manage its prompt library, or switch to another folder.
            </p>
          {:else}
            <p
              style="margin: 0; max-width: 720px; color: #a1a1aa; font-size: 15px; line-height: 1.7; font-weight: 600;"
            >
              Select a folder to set up your workspace and start managing prompts.
            </p>
          {/if}
        </div>

        <div
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px;"
        >
          <div
            style="display: flex; flex-direction: column; gap: 14px; min-height: 212px; padding: 22px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(8, 10, 14, 0.76); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);"
          >
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span
                style="color: #d4d4d8; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
              >
                Workspace
              </span>
              <span
                style="display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); color: #e4e4e7; font-size: 12px; font-weight: 700;"
              >
                {#if isWorkspaceReady}
                  Active
                {:else}
                  Inactive
                {/if}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <h2
                data-testid="workspace-ready-title"
                style="margin: 0; font-size: 26px; line-height: 1.08; font-weight: 700; color: #ffffff;"
              >
                {workspaceName}
              </h2>
              <p
                data-testid="workspace-ready-path"
                title={workspacePath ?? undefined}
                style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.65; word-break: break-word;"
              >
                {workspacePath ?? 'No folder selected'}
              </p>
            </div>

            <div style="margin-top: auto; display: flex; gap: 12px; flex-wrap: wrap;">
              <div
                style="flex: 1 1 132px; min-width: 132px; padding: 16px 18px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.06); background: rgba(255, 255, 255, 0.03);"
              >
                <div
                  style="color: #a1a1aa; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
                >
                  Prompts
                </div>
                <div style="margin-top: 8px; font-size: 34px; line-height: 1; font-weight: 800;">
                  {promptCount}
                </div>
              </div>

              <div
                style="flex: 1 1 132px; min-width: 132px; padding: 16px 18px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.06); background: rgba(255, 255, 255, 0.03);"
              >
                <div
                  style="color: #a1a1aa; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
                >
                  Folders
                </div>
                <div style="margin-top: 8px; font-size: 34px; line-height: 1; font-weight: 800;">
                  {promptFolderCount}
                </div>
              </div>
            </div>
          </div>

          <div
            style="display: flex; flex-direction: column; gap: 14px; min-height: 212px; padding: 22px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);"
          >
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <span
                style="color: #d4d4d8; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
              >
                Workspace Actions
              </span>
              <p style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.7;">
                Choose a folder, create a new workspace, or close the current one.
              </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: auto;">
              <button
                type="button"
                data-testid="select-workspace-folder-button"
                disabled={isWorkspaceLoading}
                style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; padding: 0 18px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); color: #e4e4e7; font-size: 14px; font-weight: 700; cursor: pointer;"
              >
                <span
                  style="width: 10px; height: 10px; border-radius: 999px; background: #e4e4e7;"
                ></span>
                {selectWorkspaceLabel}
              </button>

              <button
                type="button"
                data-testid="create-workspace-folder-button"
                disabled={isWorkspaceLoading}
                style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; padding: 0 18px; border: 1px solid rgba(216, 180, 254, 0.3); border-radius: 999px; background: rgba(139, 92, 246, 0.14); color: #f5f3ff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03); font-size: 14px; font-weight: 700; cursor: pointer;"
              >
                <span
                  style="width: 10px; height: 10px; border-radius: 3px; background: #ddd6fe;"
                ></span>
                {createWorkspaceLabel}
              </button>

              {#if isWorkspaceReady}
                <button
                  type="button"
                  data-testid="close-workspace-button"
                  style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; padding: 0 18px; border: 1px solid rgba(248, 113, 113, 0.24); border-radius: 999px; background: rgba(127, 29, 29, 0.22); color: #fecaca; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02); font-size: 14px; font-weight: 700; cursor: pointer;"
                >
                  <span
                    style="width: 10px; height: 10px; border-radius: 999px; background: #fca5a5;"
                  ></span>
                  Close Workspace
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 18px;"
      >
        <div
          style="padding: 22px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(9, 11, 15, 0.84); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);"
        >
          <div
            style="color: #d4d4d8; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
          >
            Library
          </div>
          <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div
              style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);"
            >
              <span style="color: #a1a1aa; font-size: 13px; font-weight: 600;">Prompts</span>
              <span style="font-size: 28px; font-weight: 800; color: #ffffff;">{promptCount}</span>
            </div>
            <div
              style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;"
            >
              <span style="color: #a1a1aa; font-size: 13px; font-weight: 600;">Folders</span>
              <span style="font-size: 28px; font-weight: 800; color: #ffffff;"
                >{promptFolderCount}</span
              >
            </div>
          </div>
        </div>

        <div
          style="padding: 22px; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(9, 11, 15, 0.84); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);"
        >
          <div
            style="color: #d4d4d8; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;"
          >
            Current Folder
          </div>
          <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 20px; font-weight: 700; color: #ffffff;">{workspaceName}</div>
            <div style="color: #a1a1aa; font-size: 13px; line-height: 1.7; word-break: break-word;">
              {workspacePath ?? 'No folder selected'}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  {#if previewDialog !== 'none'}
    <div
      style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(3, 5, 8, 0.64); backdrop-filter: blur(10px);"
    >
      <div
        style="width: 100%; max-width: 520px; padding: 24px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.08); background:
          linear-gradient(180deg, rgba(18, 21, 28, 0.96), rgba(10, 12, 17, 0.98));
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.42);"
      >
        {#if previewDialog === 'setup'}
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
              Setup Workspace
            </h2>
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.7;">
              This folder doesn't have a Cthulhu Prompt workspace. Would you like to set it up?
              This will create the necessary files and subfolders.
            </p>
          </div>

          <label
            style="margin-top: 22px; display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); cursor: pointer;"
          >
            <input type="checkbox" bind:checked={includeExamplePrompts} />
            <span style="color: #e4e4e7; font-size: 14px; line-height: 1.6;">
              Include example prompts in a "My Prompts" folder.
            </span>
          </label>

          <div style="margin-top: 22px; display: flex; justify-content: flex-end; gap: 10px;">
            <button
              type="button"
              style="min-height: 48px; padding: 0 18px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: #e4e4e7; font-size: 14px; font-weight: 700; cursor: pointer;"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="setup-workspace-button"
              style="min-height: 48px; padding: 0 18px; border: 1px solid rgba(216, 180, 254, 0.3); border-radius: 999px; background: rgba(139, 92, 246, 0.14); color: #f5f3ff; font-size: 14px; font-weight: 700; cursor: pointer;"
            >
              Setup Workspace
            </button>
          </div>
        {:else if previewDialog === 'existing'}
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
              Workspace already exists
            </h2>
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.7;">
              This folder already has a Cthulhu Prompt workspace. Would you like to select it?
            </p>
          </div>

          <div style="margin-top: 22px; display: flex; justify-content: flex-end; gap: 10px;">
            <button
              type="button"
              data-testid="cancel-existing-workspace-button"
              style="min-height: 48px; padding: 0 18px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: #e4e4e7; font-size: 14px; font-weight: 700; cursor: pointer;"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="select-existing-workspace-button"
              style="min-height: 48px; padding: 0 18px; border: 1px solid rgba(216, 180, 254, 0.3); border-radius: 999px; background: rgba(139, 92, 246, 0.14); color: #f5f3ff; font-size: 14px; font-weight: 700; cursor: pointer;"
            >
              Select Workspace
            </button>
          </div>
        {:else}
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
              Invalid workspace folder
            </h2>
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.7;">
              Select a folder that is not a drive root or top-level system directory.
            </p>
          </div>

          <div style="margin-top: 22px; display: flex; justify-content: flex-end;">
            <button
              type="button"
              style="min-height: 48px; padding: 0 18px; border: 1px solid rgba(216, 180, 254, 0.3); border-radius: 999px; background: rgba(139, 92, 246, 0.14); color: #f5f3ff; font-size: 14px; font-weight: 700; cursor: pointer;"
            >
              OK
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>
