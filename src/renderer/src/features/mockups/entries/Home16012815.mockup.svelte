<script lang="ts">
  import {
    Check,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    HardDriveDownload,
    X
  } from 'lucide-svelte'

  const displayedWorkspacePath = 'C:\\Users\\dmin\\Documents\\Cthulhu Prompt Workspace'
  const statCards = [
    { label: 'Prompts', value: '9999', icon: FileText },
    { label: 'Prompt Folders', value: '9999', icon: FolderClosed }
  ] as const

  const actionCards = [
    {
      testId: 'select-workspace-folder-button',
      label: 'Open Workspace Folder',
      detail: 'Select an existing workspace.',
      icon: FolderOpen,
      badge: 'Select',
      tone: 'default'
    },
    {
      testId: 'create-workspace-folder-button',
      label: 'Create Workspace Folder',
      detail: 'Choose a folder and set up a new workspace.',
      icon: FolderPlus,
      badge: 'Create',
      tone: 'accent'
    },
    {
      testId: 'close-workspace-button',
      label: 'Close Workspace',
      detail: 'Unload the current workspace.',
      icon: X,
      badge: 'Close',
      tone: 'danger'
    }
  ] as const
</script>

<main
  data-testid="home-screen"
  style="display:flex; min-width:0; flex:1 1 auto; overflow-y:auto; padding:24px 24px 40px;"
>
  <div
    style="display:flex; min-height:100%; width:100%; min-width:0; align-items:center; justify-content:center;"
  >
    <section
      style="width:100%; max-width:1056px; min-width:0; display:flex; flex-direction:column; gap:24px;"
    >
      <h1
        data-testid="home-title"
        style="margin:0; text-align:center; color:var(--ui-text-bright); font-family:Consolas, 'Cascadia Code', 'Courier New', monospace; font-size:clamp(2.75rem, 8.5vw, 6rem); font-weight:700; letter-spacing:0.16em; line-height:0.96; white-space:nowrap;"
      >
        CTHULHU PROMPT
      </h1>

      <div
        style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;"
      >
        <section
          style="display:flex; min-width:0; flex-direction:column; gap:18px; border:1px solid var(--ui-card-border-soft); border-radius:32px; padding:24px; background:linear-gradient(180deg, var(--ui-card-surface-top), var(--ui-card-surface-bottom)); box-shadow:0 24px 64px var(--ui-card-shadow);"
        >
          <div
            style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:16px;"
          >
            <div style="display:flex; min-width:0; align-items:flex-start; gap:14px;">
              <div
                style="display:flex; height:52px; width:52px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:18px; background-color:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon);"
              >
                <HardDriveDownload size={22} />
              </div>

              <div style="min-width:0; display:flex; flex-direction:column; gap:4px;">
                <h2
                  style="margin:0; color:var(--ui-text-bright); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:1.125rem; font-weight:650; letter-spacing:-0.025em;"
                >
                  Current Workspace
                </h2>
                <p
                  style="margin:0; color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.875rem; font-weight:500; line-height:1.45;"
                >
                  Information about your current workspace.
                </p>
              </div>
            </div>

            <div
              style="display:inline-flex; width:max-content; align-items:center; gap:8px; border:1px solid var(--ui-success-border); border-radius:999px; background:var(--ui-success-surface); padding:9px 14px; color:var(--ui-success-text); box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);"
            >
              <Check size={16} />
              <span
                data-testid="workspace-ready-title"
                style="font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.8125rem; font-weight:700; letter-spacing:0.01em;"
              >
                Workspace Ready
              </span>
            </div>
          </div>

          <div
            style="display:flex; min-width:0; flex-direction:column; gap:10px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px 18px 20px; box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.03);"
          >
            <div
              style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.8125rem; font-weight:650; letter-spacing:0.01em;"
            >
              Workspace Path
            </div>
            <div
              data-testid="workspace-ready-path"
              title={displayedWorkspacePath}
              style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-text-strong); font-family:Consolas, 'Cascadia Code', 'Courier New', monospace; font-size:0.9rem; font-weight:500; line-height:1.5; padding-left:4px;"
            >
              {displayedWorkspacePath}
            </div>
          </div>

          <div
            style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;"
          >
            {#each statCards as stat (stat.label)}
              <div
                style="display:flex; min-width:0; align-items:center; gap:14px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px; box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.03);"
              >
                <div
                  style="display:flex; height:48px; width:48px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:17px; background-color:var(--ui-accent-icon-surface); box-shadow:0 0 0 1px var(--ui-accent-icon-ring); color:var(--ui-accent-icon);"
                >
                  <stat.icon size={20} />
                </div>

                <div style="min-width:0; display:flex; flex-direction:column; gap:7px;">
                  <div
                    style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:700; line-height:1;"
                  >
                    {stat.label}
                  </div>
                  <div
                    style="color:var(--ui-text-bright); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:1.7rem; font-weight:750; line-height:0.95; font-variant-numeric:tabular-nums;"
                  >
                    {stat.value}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div
            style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px;"
          >
            <div
              style="display:flex; min-width:0; flex-direction:column; justify-content:space-between; gap:10px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px;"
            >
              <div
                style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; text-transform:uppercase;"
              >
                Status
              </div>
              <div
                style="display:flex; align-items:center; gap:10px; color:var(--ui-text-bright); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:1rem; font-weight:650;"
              >
                <span
                  style="display:inline-flex; height:10px; width:10px; flex:0 0 auto; border-radius:999px; background:var(--ui-accent-fill); box-shadow:0 0 0 6px rgba(167, 139, 250, 0.12);"
                ></span>
                Workspace Ready
              </div>
            </div>

            <div
              style="display:flex; min-width:0; flex-direction:column; justify-content:space-between; gap:10px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px;"
            >
              <div
                style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; text-transform:uppercase;"
              >
                Workspace
              </div>
              <div
                style="color:var(--ui-text-bright); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:1rem; font-weight:650;"
              >
                Active
              </div>
            </div>
          </div>
        </section>

        <section
          style="display:flex; min-width:0; flex-direction:column; gap:18px; border:1px solid var(--ui-card-border-soft); border-radius:32px; padding:24px; background:linear-gradient(180deg, var(--ui-card-surface-top), var(--ui-card-surface-bottom)); box-shadow:0 24px 64px var(--ui-card-shadow);"
        >
          <div
            style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:16px;"
          >
            <div style="min-width:0; display:flex; flex-direction:column; gap:4px;">
              <h2
                style="margin:0; color:var(--ui-text-bright); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:1.125rem; font-weight:650; letter-spacing:-0.025em;"
              >
                Workspace Actions
              </h2>
              <p
                style="margin:0; color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.875rem; font-weight:500; line-height:1.45;"
              >
                Change your current workspace.
              </p>
            </div>

            <div
              style="display:inline-flex; width:max-content; align-items:center; gap:8px; border:1px solid var(--ui-accent-border); border-radius:999px; background:var(--ui-accent-surface); padding:9px 14px; color:var(--ui-accent-text); box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);"
            >
              <Check size={16} />
              <span
                style="font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.8125rem; font-weight:700; letter-spacing:0.01em;"
              >
                Ready
              </span>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:14px;">
            {#each actionCards as action (action.testId)}
              <button
                type="button"
                data-testid={action.testId}
                style={`display:flex; width:100%; min-width:0; cursor:pointer; align-items:center; justify-content:space-between; gap:16px; border-radius:24px; padding:18px 18px 18px 16px; text-align:left; transition:background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease; ${
                  action.tone === 'danger'
                    ? 'border:1px solid rgba(248, 113, 113, 0.28); background:rgba(127, 29, 29, 0.16); color:rgb(254, 202, 202); box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.02);'
                    : action.tone === 'accent'
                      ? 'border:1px solid var(--ui-accent-border); background:var(--ui-accent-surface); color:var(--ui-accent-text); box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.04);'
                      : 'border:1px solid var(--ui-border-default); background:var(--ui-surface-default); color:var(--ui-text); box-shadow:inset 0 1px 0 var(--ui-surface-muted);'
                }`}
              >
                <div style="display:flex; min-width:0; align-items:center; gap:14px;">
                  <div
                    style={`display:flex; height:46px; width:46px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:16px; ${
                      action.tone === 'danger'
                        ? 'background:rgba(248, 113, 113, 0.14); color:rgb(254, 226, 226); box-shadow:0 0 0 1px rgba(248, 113, 113, 0.18);'
                        : 'background:var(--ui-accent-icon-surface); color:var(--ui-accent-icon); box-shadow:0 0 0 1px var(--ui-accent-icon-ring);'
                    }`}
                  >
                    <action.icon size={20} />
                  </div>

                  <div style="min-width:0; display:flex; flex-direction:column; gap:3px;">
                    <span
                      style={`font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.975rem; font-weight:700; letter-spacing:-0.015em; ${
                        action.tone === 'danger' ? 'color:rgb(254, 226, 226);' : 'color:var(--ui-text-bright);'
                      }`}
                    >
                      {action.label}
                    </span>
                    <span
                      style={`font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.8125rem; font-weight:600; line-height:1.35; ${
                        action.tone === 'danger'
                          ? 'color:rgba(254, 202, 202, 0.82);'
                          : action.tone === 'accent'
                            ? 'color:var(--ui-accent-text); opacity:0.8;'
                            : 'color:var(--ui-text-muted);'
                      }`}
                    >
                      {action.detail}
                    </span>
                  </div>
                </div>

                <div
                  style={`display:inline-flex; flex:0 0 auto; align-items:center; justify-content:center; border-radius:999px; padding:8px 12px; font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:800; letter-spacing:0.03em; text-transform:uppercase; ${
                    action.tone === 'danger'
                      ? 'background:rgba(248, 113, 113, 0.12); color:rgb(254, 226, 226);'
                      : action.tone === 'accent'
                        ? 'background:rgba(255, 255, 255, 0.08); color:var(--ui-accent-text);'
                        : 'background:var(--ui-surface-emphasis); color:var(--ui-text-strong);'
                  }`}
                >
                  {action.badge}
                </div>
              </button>
            {/each}
          </div>

          <div
            style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-top:auto;"
          >
            <div
              style="display:flex; min-width:0; flex-direction:column; gap:10px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px;"
            >
              <div
                style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; text-transform:uppercase;"
              >
                Setup Workspace
              </div>
              <div
                style="color:var(--ui-text-strong); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.9rem; font-weight:650; line-height:1.4;"
              >
                Include example prompts
              </div>
            </div>

            <div
              style="display:flex; min-width:0; flex-direction:column; gap:10px; border:1px solid var(--ui-card-border-subcard); border-radius:24px; background:var(--ui-card-subcard-surface); padding:18px;"
            >
              <div
                style="color:var(--ui-text-muted); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; text-transform:uppercase;"
              >
                Existing Workspace
              </div>
              <div
                style="color:var(--ui-text-strong); font-family:'Segoe UI Variable Text', 'Segoe UI', sans-serif; font-size:0.9rem; font-weight:650; line-height:1.4;"
              >
                Select Workspace
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
