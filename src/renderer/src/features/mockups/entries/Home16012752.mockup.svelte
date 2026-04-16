<script lang="ts">
  import {
    AlertCircle,
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    X
  } from 'lucide-svelte'
</script>

<main
  style="display:flex; min-height:100%; width:100%; flex:1 1 auto; overflow:auto; padding:32px 24px; box-sizing:border-box;"
>
  <div
    style="display:flex; width:100%; min-height:100%; align-items:center; justify-content:center;"
  >
    <section
      style="display:flex; width:100%; max-width:1120px; flex-direction:column; gap:22px; margin:0 auto; font-family:'Segoe UI Variable Display', 'Segoe UI', sans-serif; color:var(--ui-text);"
    >
      <div style="display:flex; justify-content:center; padding:4px 0 2px 0;">
        <h1
          data-testid="home-title"
          style="margin:0; color:var(--ui-text-bright); font-family:'Cascadia Code', 'Consolas', monospace; font-size:clamp(2.3rem, 9vw, 6rem); font-weight:700; line-height:0.96; letter-spacing:0.16em; text-align:center; white-space:nowrap;"
        >
          CTHULHU PROMPT
        </h1>
      </div>

      <div
        style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap:18px; align-items:stretch;"
      >
        <section
          style="display:flex; min-width:0; flex-direction:column; gap:18px; padding:24px; border:1px solid var(--ui-card-border-soft); border-radius:28px; background:linear-gradient(180deg, color-mix(in srgb, var(--ui-card-surface-top) 100%, transparent), color-mix(in srgb, var(--ui-card-surface-bottom) 100%, transparent)); box-shadow:0 24px 60px -34px var(--ui-card-shadow), inset 0 1px 0 rgb(255 255 255 / 3%); backdrop-filter:blur(10px);"
        >
          <div
            style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:14px;"
          >
            <div style="display:flex; min-width:0; flex:1 1 auto; flex-direction:column; gap:6px;">
              <p
                style="margin:0; color:var(--ui-text-bright); font-size:1.2rem; font-weight:650; letter-spacing:-0.02em;"
              >
                Current Workspace
              </p>
              <p
                style="margin:0; color:var(--ui-text-muted); font-size:0.9rem; font-weight:600; line-height:1.45;"
              >
                Information about your current workspace.
              </p>
            </div>

            <div
              style="display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--ui-success-border); border-radius:999px; background:var(--ui-success-surface); color:var(--ui-success-text); font-size:0.78rem; font-weight:700; letter-spacing:0.01em; white-space:nowrap;"
            >
              <Check size={15} strokeWidth={2.4} />
              <span data-testid="workspace-ready-title">Workspace Ready</span>
            </div>
          </div>

          <div
            style="display:flex; flex-direction:column; gap:10px; padding:18px; border:1px solid var(--ui-border-default); border-radius:22px; background:rgb(10 12 18 / 55%); box-shadow:inset 0 1px 0 rgb(255 255 255 / 3%);"
          >
            <div
              style="display:flex; align-items:center; gap:12px; color:var(--ui-text-muted); font-size:0.74rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;"
            >
              <span>Workspace Path</span>
            </div>

            <div
              data-testid="workspace-ready-path"
              title="C:\\Users\\Dmin\\Documents\\Cthulhu Prompt\\My Workspace"
              style="display:flex; min-height:64px; align-items:center; padding:14px 16px; border:1px solid var(--ui-border-muted); border-radius:18px; background:var(--ui-surface-input); color:var(--ui-text); font-family:'Cascadia Code', 'Consolas', monospace; font-size:0.89rem; font-weight:600; line-height:1.45; word-break:break-word; box-sizing:border-box;"
            >
              C:\Users\Dmin\Documents\Cthulhu Prompt\My Workspace
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px;">
            <div
              style="display:flex; min-width:0; flex-direction:column; gap:18px; padding:18px; border:1px solid var(--ui-border-default); border-radius:22px; background:rgb(11 14 20 / 74%); box-shadow:inset 0 1px 0 rgb(255 255 255 / 3%);"
            >
              <div
                style="display:flex; height:42px; width:42px; align-items:center; justify-content:center; border-radius:14px; background:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon);"
              >
                <FileText size={18} strokeWidth={2.2} />
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <p
                  style="margin:0; color:var(--ui-text-muted); font-size:0.78rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;"
                >
                  Prompts
                </p>
                <p
                  style="margin:0; color:var(--ui-text-bright); font-size:2rem; font-weight:700; letter-spacing:-0.04em;"
                >
                  9999
                </p>
              </div>
            </div>

            <div
              style="display:flex; min-width:0; flex-direction:column; gap:18px; padding:18px; border:1px solid var(--ui-border-default); border-radius:22px; background:rgb(11 14 20 / 74%); box-shadow:inset 0 1px 0 rgb(255 255 255 / 3%);"
            >
              <div
                style="display:flex; height:42px; width:42px; align-items:center; justify-content:center; border-radius:14px; background:var(--ui-surface-default); box-shadow:0 0 0 1px var(--ui-border-muted); color:var(--ui-text);"
              >
                <FolderClosed size={18} strokeWidth={2.2} />
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <p
                  style="margin:0; color:var(--ui-text-muted); font-size:0.78rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;"
                >
                  Prompt Folders
                </p>
                <p
                  style="margin:0; color:var(--ui-text-bright); font-size:2rem; font-weight:700; letter-spacing:-0.04em;"
                >
                  9999
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          style="display:flex; min-width:0; flex-direction:column; gap:18px; padding:24px; border:1px solid var(--ui-card-border-soft); border-radius:28px; background:linear-gradient(180deg, color-mix(in srgb, var(--ui-card-surface-top) 100%, transparent), color-mix(in srgb, var(--ui-card-surface-bottom) 100%, transparent)); box-shadow:0 24px 60px -34px var(--ui-card-shadow), inset 0 1px 0 rgb(255 255 255 / 3%); backdrop-filter:blur(10px);"
        >
          <div
            style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:14px;"
          >
            <div style="display:flex; min-width:0; flex:1 1 auto; flex-direction:column; gap:6px;">
              <p
                style="margin:0; color:var(--ui-text-bright); font-size:1.2rem; font-weight:650; letter-spacing:-0.02em;"
              >
                Workspace Actions
              </p>
              <p
                style="margin:0; color:var(--ui-text-muted); font-size:0.9rem; font-weight:600; line-height:1.45;"
              >
                Change your current workspace.
              </p>
            </div>

            <div
              style="display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--ui-accent-border); border-radius:999px; background:var(--ui-accent-surface); color:var(--ui-accent-text); font-size:0.78rem; font-weight:700; letter-spacing:0.01em; white-space:nowrap;"
            >
              <Check size={15} strokeWidth={2.4} />
              <span>Workspace Ready</span>
            </div>
          </div>

          <div
            style="display:flex; flex-direction:column; gap:12px; padding:18px; border:1px solid var(--ui-border-default); border-radius:22px; background:rgb(10 12 18 / 55%);"
          >
            <button
              data-testid="select-workspace-folder-button"
              type="button"
              style="display:flex; width:100%; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; border:1px solid var(--ui-accent-border); border-radius:18px; background:linear-gradient(180deg, rgb(78 43 142 / 92%), rgb(52 27 97 / 96%)); color:var(--ui-text-bright); box-shadow:0 16px 32px -24px var(--ui-card-shadow), inset 0 1px 0 rgb(255 255 255 / 10%); font:inherit; cursor:default;"
            >
              <span style="display:inline-flex; align-items:center; gap:12px;">
                <span
                  style="display:flex; height:38px; width:38px; align-items:center; justify-content:center; border-radius:12px; background:rgb(255 255 255 / 8%); color:var(--ui-text-bright);"
                >
                  <FolderOpen size={18} strokeWidth={2.2} />
                </span>
                <span style="font-size:0.96rem; font-weight:700;">Open Workspace Folder</span>
              </span>
            </button>

            <button
              data-testid="create-workspace-folder-button"
              type="button"
              style="display:flex; width:100%; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; border:1px solid var(--ui-border-default); border-radius:18px; background:rgb(255 255 255 / 5%); color:var(--ui-text); box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%); font:inherit; cursor:default;"
            >
              <span style="display:inline-flex; align-items:center; gap:12px;">
                <span
                  style="display:flex; height:38px; width:38px; align-items:center; justify-content:center; border-radius:12px; background:var(--ui-surface-default); color:var(--ui-text-bright);"
                >
                  <FolderPlus size={18} strokeWidth={2.2} />
                </span>
                <span style="font-size:0.96rem; font-weight:700;">Create Workspace Folder</span>
              </span>
            </button>

            <button
              data-testid="close-workspace-button"
              type="button"
              style="display:flex; width:100%; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; border:1px solid rgb(255 99 71 / 22%); border-radius:18px; background:rgb(153 27 27 / 14%); color:rgb(254 226 226); box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%); font:inherit; cursor:default;"
            >
              <span style="display:inline-flex; align-items:center; gap:12px;">
                <span
                  style="display:flex; height:38px; width:38px; align-items:center; justify-content:center; border-radius:12px; background:rgb(255 255 255 / 7%); color:rgb(254 242 242);"
                >
                  <X size={18} strokeWidth={2.2} />
                </span>
                <span style="font-size:0.96rem; font-weight:700;">Close Workspace</span>
              </span>
            </button>
          </div>

          <div
            style="display:grid; grid-template-columns:minmax(0, 1fr); gap:12px; padding:18px; border:1px solid var(--ui-border-default); border-radius:22px; background:rgb(11 14 20 / 74%);"
          >
            <div
              style="display:flex; align-items:center; justify-content:space-between; gap:12px;"
            >
              <div style="display:flex; align-items:center; gap:10px;">
                <div
                  style="display:flex; height:34px; width:34px; align-items:center; justify-content:center; border-radius:11px; background:rgb(255 255 255 / 5%); color:var(--ui-text);"
                >
                  <AlertCircle size={16} strokeWidth={2.2} />
                </div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <p
                    style="margin:0; color:var(--ui-text-bright); font-size:0.88rem; font-weight:700;"
                  >
                    Current Workspace
                  </p>
                  <p
                    style="margin:0; color:var(--ui-text-muted); font-size:0.8rem; font-weight:600;"
                  >
                    No workspace selected
                  </p>
                </div>
              </div>

              <div
                style="display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid var(--ui-accent-border); border-radius:999px; background:var(--ui-accent-surface); color:var(--ui-accent-text); font-size:0.74rem; font-weight:700;"
              >
                <AlertCircle size={13} strokeWidth={2.2} />
                <span>Workspace Not Selected</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
