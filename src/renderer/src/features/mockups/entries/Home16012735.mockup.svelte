<script lang="ts">
  import {
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    HardDrive,
    Sparkles,
    X
  } from 'lucide-svelte'

  const secondaryTitleText = 'CTHULHU PROMPT'
  const workspacePath = 'C:\\Users\\Dev\\Documents\\Cthulhu Prompt Workspace'
  const promptCount = '284'
  const folderCount = '18'
  const isWorkspaceReady = true
</script>

<main
  data-testid="home-screen"
  style="flex: 1; min-width: 0; overflow-y: auto; padding: 32px 24px 40px;"
>
  <div
    style="margin: 0 auto; display: flex; min-height: 100%; width: min(1100px, 100%); align-items: center; justify-content: center;"
  >
    <section style="display: flex; width: 100%; flex-direction: column; gap: 20px;">
      <h2
        data-testid="home-title"
        style="margin: 0; text-align: center; color: var(--ui-emphasis-text); font-family: 'Cascadia Code', Consolas, 'Courier New', monospace; font-size: clamp(2.35rem, 8vw, 5.5rem); font-weight: 700; letter-spacing: 0.14em; line-height: 0.96; white-space: nowrap;"
      >
        {secondaryTitleText}
      </h2>

      <div
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; align-items: stretch;"
      >
        <section
          style="display: flex; min-width: 0; flex-direction: column; gap: 18px; border: 1px solid rgb(255 255 255 / 10%); border-radius: 32px; background: linear-gradient(180deg, rgb(30 33 39 / 92%), rgb(17 19 24 / 96%)); box-shadow: 0 22px 56px rgb(0 0 0 / 30%), inset 0 1px 0 rgb(255 255 255 / 4%); padding: 22px;"
        >
          <div
            style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px;"
          >
            <div style="display: flex; min-width: 0; align-items: flex-start; gap: 14px;">
              <div
                style="display: flex; height: 52px; width: 52px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-icon-ring); border-radius: 18px; background: linear-gradient(180deg, rgb(139 92 246 / 20%), rgb(139 92 246 / 10%)); box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%); color: var(--ui-accent-icon);"
              >
                <HardDrive size={22} />
              </div>

              <div style="min-width: 0;">
                <h3
                  style="margin: 0; color: var(--ui-emphasis-text); font-size: 1.1rem; font-weight: 650; letter-spacing: -0.02em;"
                >
                  Current Workspace
                </h3>
                <p
                  style="margin: 6px 0 0; color: var(--ui-muted-text); font-size: 0.88rem; font-weight: 600; line-height: 1.5;"
                >
                  Information about your current workspace.
                </p>
              </div>
            </div>

            {#if isWorkspaceReady}
              <div
                data-testid="workspace-ready-title"
                style="display: inline-flex; width: max-content; align-items: center; gap: 8px; border: 1px solid rgb(74 222 128 / 34%); border-radius: 999px; background: rgb(22 163 74 / 18%); color: var(--ui-success-text); padding: 9px 14px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.02em;"
              >
                <Check size={16} />
                <span>Workspace Ready</span>
              </div>
            {/if}
          </div>

          <div
            style="display: flex; flex-direction: column; gap: 10px; border: 1px solid rgb(255 255 255 / 8%); border-radius: 24px; background: rgb(9 11 15 / 60%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 3%); padding: 16px 18px 18px;"
          >
            <span
              style="color: var(--ui-muted-text); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;"
            >
              Workspace Path
            </span>
            <div
              data-testid="workspace-ready-path"
              title={workspacePath}
              style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-default-text); font-family: 'Cascadia Code', Consolas, 'Courier New', monospace; font-size: 0.92rem; font-weight: 600; line-height: 1.55;"
            >
              {workspacePath}
            </div>
          </div>

          <div
            style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;"
          >
            <div
              style="display: flex; min-width: 0; flex-direction: column; gap: 14px; border: 1px solid rgb(255 255 255 / 8%); border-radius: 24px; background: linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 2%)); padding: 16px;"
            >
              <div
                style="display: inline-flex; height: 38px; width: 38px; align-items: center; justify-content: center; border-radius: 14px; background: rgb(255 255 255 / 5%); color: var(--ui-default-text);"
              >
                <FileText size={18} />
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span
                  style="color: var(--ui-muted-text); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;"
                >
                  Prompts
                </span>
                <strong
                  style="color: var(--ui-emphasis-text); font-size: 2rem; font-weight: 700; letter-spacing: -0.04em; line-height: 1;"
                >
                  {promptCount}
                </strong>
              </div>
            </div>

            <div
              style="display: flex; min-width: 0; flex-direction: column; gap: 14px; border: 1px solid rgb(255 255 255 / 8%); border-radius: 24px; background: linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 2%)); padding: 16px;"
            >
              <div
                style="display: inline-flex; height: 38px; width: 38px; align-items: center; justify-content: center; border-radius: 14px; background: rgb(255 255 255 / 5%); color: var(--ui-default-text);"
              >
                <FolderClosed size={18} />
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span
                  style="color: var(--ui-muted-text); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;"
                >
                  Prompt Folders
                </span>
                <strong
                  style="color: var(--ui-emphasis-text); font-size: 2rem; font-weight: 700; letter-spacing: -0.04em; line-height: 1;"
                >
                  {folderCount}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section
          style="display: flex; min-width: 0; flex-direction: column; gap: 18px; border: 1px solid rgb(255 255 255 / 10%); border-radius: 32px; background: linear-gradient(180deg, rgb(28 30 36 / 94%), rgb(14 16 21 / 98%)); box-shadow: 0 22px 56px rgb(0 0 0 / 30%), inset 0 1px 0 rgb(255 255 255 / 4%); padding: 22px;"
        >
          <div style="display: flex; min-width: 0; align-items: flex-start; gap: 14px;">
            <div
              style="display: flex; height: 52px; width: 52px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid rgb(255 255 255 / 9%); border-radius: 18px; background: linear-gradient(180deg, rgb(255 255 255 / 7%), rgb(255 255 255 / 3%)); box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%); color: var(--ui-accent-icon);"
            >
              <Sparkles size={22} />
            </div>

            <div style="min-width: 0;">
              <h3
                style="margin: 0; color: var(--ui-emphasis-text); font-size: 1.1rem; font-weight: 650; letter-spacing: -0.02em;"
              >
                Workspace Actions
              </h3>
              <p
                style="margin: 6px 0 0; color: var(--ui-muted-text); font-size: 0.88rem; font-weight: 600; line-height: 1.5;"
              >
                Change your current workspace.
              </p>
            </div>
          </div>

          <div
            style="display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid rgb(216 180 254 / 18%); border-radius: 22px; background: linear-gradient(180deg, rgb(139 92 246 / 12%), rgb(139 92 246 / 5%)); padding: 14px 16px;"
          >
            <div
              style="color: var(--ui-accent-text); font-size: 0.9rem; font-weight: 700; letter-spacing: -0.01em;"
            >
              Workspace Ready
            </div>

            <div
              style="display: inline-flex; height: 34px; width: 34px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 12px; background: rgb(255 255 255 / 7%); color: var(--ui-accent-icon);"
            >
              <Check size={16} />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button
              data-testid="select-workspace-folder-button"
              type="button"
              style="display: flex; min-height: 64px; width: 100%; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid rgb(255 255 255 / 12%); border-radius: 22px; background: rgb(255 255 255 / 6%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%); color: var(--ui-emphasis-text); padding: 0 18px; font: inherit; cursor: pointer;"
            >
              <span style="display: inline-flex; align-items: center; gap: 12px;">
                <span
                  style="display: inline-flex; height: 38px; width: 38px; align-items: center; justify-content: center; border-radius: 14px; background: rgb(255 255 255 / 6%); color: var(--ui-default-text);"
                >
                  <FolderOpen size={18} />
                </span>
                <span style="font-size: 0.95rem; font-weight: 700;">Open Workspace Folder</span>
              </span>
            </button>

            <button
              data-testid="create-workspace-folder-button"
              type="button"
              style="display: flex; min-height: 64px; width: 100%; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid rgb(216 180 254 / 24%); border-radius: 22px; background: linear-gradient(180deg, rgb(139 92 246 / 18%), rgb(139 92 246 / 10%)); box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%); color: var(--ui-accent-text); padding: 0 18px; font: inherit; cursor: pointer;"
            >
              <span style="display: inline-flex; align-items: center; gap: 12px;">
                <span
                  style="display: inline-flex; height: 38px; width: 38px; align-items: center; justify-content: center; border-radius: 14px; background: rgb(255 255 255 / 8%); color: var(--ui-accent-text);"
                >
                  <FolderPlus size={18} />
                </span>
                <span style="font-size: 0.95rem; font-weight: 700;">Create Workspace Folder</span>
              </span>
            </button>
          </div>

          <div
            style="margin-top: auto; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgb(255 255 255 / 8%); padding-top: 16px;"
          >
            <button
              data-testid="close-workspace-button"
              type="button"
              style="display: flex; min-height: 58px; width: 100%; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid rgb(248 113 113 / 18%); border-radius: 20px; background: rgb(239 68 68 / 8%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 3%); color: rgb(254 226 226); padding: 0 18px; font: inherit; cursor: pointer;"
            >
              <span style="display: inline-flex; align-items: center; gap: 12px;">
                <span
                  style="display: inline-flex; height: 36px; width: 36px; align-items: center; justify-content: center; border-radius: 13px; background: rgb(255 255 255 / 6%); color: rgb(254 202 202);"
                >
                  <X size={17} />
                </span>
                <span style="font-size: 0.92rem; font-weight: 700;">Close Workspace</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
