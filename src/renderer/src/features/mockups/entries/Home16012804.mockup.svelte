<script lang="ts">
  import {
    Check,
    ChevronRight,
    FileText,
    FolderClosed,
    FolderOpen,
    FolderPlus,
    HardDrive,
    X
  } from 'lucide-svelte'

  const workspacePath = 'C:\\Users\\Dana\\Documents\\Cthulhu Prompt'

  const workspaceStats = [
    { label: 'Prompts', value: '128', icon: FileText },
    { label: 'Prompt Folders', value: '12', icon: FolderClosed }
  ] as const

  const workspaceActions = [
    { label: 'Open Workspace Folder', icon: FolderOpen, accent: true },
    { label: 'Create Workspace Folder', icon: FolderPlus, accent: false }
  ] as const
</script>

<main
  data-testid="home-screen"
  style="display:flex; min-width:0; flex:1 1 auto; overflow-y:auto; padding:24px;"
>
  <div
    style="display:flex; min-height:100%; width:100%; align-items:center; justify-content:center;"
  >
    <section style="display:flex; width:100%; max-width:1040px; flex-direction:column; gap:24px;">
      <h1
        data-testid="home-title"
        style="margin:0; text-align:center; color:var(--ui-emphasis-text); font-family:'Segoe UI Variable Display', 'Segoe UI', sans-serif; font-size:clamp(3.5rem, 8vw, 5.75rem); font-weight:800; letter-spacing:0.2em; line-height:0.92;"
      >
        CTHULHU PROMPT
      </h1>

      <div
        style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; align-items:stretch;"
      >
        <section
          style="display:flex; min-width:0; flex-direction:column; gap:20px; border:1px solid var(--ui-border-default); border-radius:30px; background:linear-gradient(180deg, rgb(26 28 34 / 96%), rgb(14 16 20 / 96%)); padding:26px; box-shadow:0 24px 48px var(--ui-raised-shadow), inset 0 1px 0 rgb(255 255 255 / 4%);"
        >
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
            <div style="display:flex; min-width:0; flex-direction:column; gap:12px;">
              <p
                style="margin:0; color:var(--ui-emphasis-text); font-size:1.25rem; font-weight:700; letter-spacing:-0.03em;"
              >
                Current Workspace
              </p>
              <div
                style="display:inline-flex; width:max-content; align-items:center; gap:10px; border:1px solid var(--ui-success-border); border-radius:999px; background:linear-gradient(180deg, rgb(22 163 74 / 18%), rgb(22 163 74 / 12%)); padding:10px 14px; color:var(--ui-success-text); box-shadow:inset 0 1px 0 rgb(255 255 255 / 6%);"
              >
                <Check size={16} strokeWidth={2.25} />
                <span style="font-size:0.8125rem; font-weight:700; letter-spacing:0.02em;">
                  Workspace Ready
                </span>
              </div>
            </div>

            <div
              style="display:flex; height:46px; width:46px; flex:0 0 auto; align-items:center; justify-content:center; border:1px solid var(--ui-accent-border); border-radius:16px; background:linear-gradient(180deg, rgb(139 92 246 / 18%), rgb(139 92 246 / 10%)); color:var(--ui-accent-icon); box-shadow:inset 0 1px 0 rgb(255 255 255 / 5%);"
            >
              <HardDrive size={20} strokeWidth={2.1} />
            </div>
          </div>

          <div
            style="display:flex; min-width:0; flex-direction:column; gap:10px; border:1px solid rgb(255 255 255 / 6%); border-radius:24px; background:linear-gradient(180deg, rgb(255 255 255 / 5%), rgb(255 255 255 / 2%)); padding:18px 18px 16px;"
          >
            <span
              style="color:var(--ui-muted-text); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase;"
            >
              Workspace Path
            </span>
            <div style="display:flex; min-width:0; align-items:center; gap:12px;">
              <div
                style="display:flex; height:38px; width:38px; flex:0 0 auto; align-items:center; justify-content:center; border:1px solid rgb(255 255 255 / 8%); border-radius:14px; background:rgb(255 255 255 / 4%); color:var(--ui-default-text);"
              >
                <FolderOpen size={18} strokeWidth={2.1} />
              </div>
              <p
                title={workspacePath}
                style="margin:0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-strong-text); font-size:0.95rem; font-weight:600; letter-spacing:-0.01em;"
              >
                {workspacePath}
              </p>
            </div>
          </div>

          <div
            style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; margin-top:auto;"
          >
            {#each workspaceStats as stat (stat.label)}
              <div
                style="display:flex; min-width:0; flex-direction:column; gap:16px; border:1px solid rgb(255 255 255 / 7%); border-radius:24px; background:linear-gradient(180deg, rgb(19 21 26 / 96%), rgb(10 11 14 / 96%)); padding:18px; box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%);"
              >
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <span style="color:var(--ui-muted-text); font-size:0.8125rem; font-weight:700;">
                    {stat.label}
                  </span>
                  <div
                    style="display:flex; height:34px; width:34px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:12px; background:rgb(255 255 255 / 5%); color:var(--ui-accent-icon);"
                  >
                    <stat.icon size={17} strokeWidth={2.1} />
                  </div>
                </div>
                <p
                  style="margin:0; color:var(--ui-emphasis-text); font-size:2rem; font-weight:800; letter-spacing:-0.05em; line-height:1;"
                >
                  {stat.value}
                </p>
              </div>
            {/each}
          </div>
        </section>

        <section
          style="display:flex; min-width:0; flex-direction:column; gap:18px; border:1px solid var(--ui-border-default); border-radius:30px; background:linear-gradient(180deg, rgb(21 23 29 / 96%), rgb(12 13 17 / 96%)); padding:26px; box-shadow:0 24px 48px var(--ui-raised-shadow), inset 0 1px 0 rgb(255 255 255 / 4%);"
        >
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
            <p
              style="margin:0; color:var(--ui-emphasis-text); font-size:1.25rem; font-weight:700; letter-spacing:-0.03em;"
            >
              Workspace Actions
            </p>
            <div
              style="display:inline-flex; align-items:center; gap:8px; border:1px solid var(--ui-accent-border); border-radius:999px; background:var(--ui-accent-surface-default); padding:8px 12px; color:var(--ui-accent-text);"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
              <span style="font-size:0.75rem; font-weight:700; letter-spacing:0.08em;">
                ACTIVE
              </span>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:14px;">
            {#each workspaceActions as action (action.label)}
              <button
                type="button"
                style={`display:flex; width:100%; align-items:center; justify-content:space-between; gap:14px; border:${action.accent ? '1px solid var(--ui-accent-border)' : '1px solid rgb(255 255 255 / 7%)'}; border-radius:22px; background:${action.accent ? 'linear-gradient(180deg, rgb(139 92 246 / 18%), rgb(139 92 246 / 10%))' : 'linear-gradient(180deg, rgb(255 255 255 / 5%), rgb(255 255 255 / 3%))'}; padding:18px 18px 18px 16px; color:${action.accent ? 'var(--ui-accent-text)' : 'var(--ui-strong-text)'}; box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%); cursor:default;`}
              >
                <span style="display:flex; min-width:0; align-items:center; gap:14px;">
                  <span
                    style={`display:flex; height:42px; width:42px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:15px; background:${action.accent ? 'rgb(255 255 255 / 8%)' : 'rgb(255 255 255 / 4%)'}; color:${action.accent ? 'var(--ui-accent-icon)' : 'var(--ui-default-text)'}`}
                  >
                    <action.icon size={19} strokeWidth={2.1} />
                  </span>
                  <span
                    style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.95rem; font-weight:700; letter-spacing:-0.01em;"
                  >
                    {action.label}
                  </span>
                </span>
                <ChevronRight size={18} strokeWidth={2.2} />
              </button>
            {/each}
          </div>

          <div
            style="margin-top:auto; display:flex; flex-direction:column; gap:12px; border:1px solid rgb(255 255 255 / 6%); border-radius:24px; background:linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 2%)); padding:16px;"
          >
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <span style="color:var(--ui-muted-text); font-size:0.8125rem; font-weight:700;">
                Current Session
              </span>
              <span style="color:var(--ui-default-text); font-size:0.8125rem; font-weight:700;">
                Connected
              </span>
            </div>

            <button
              type="button"
              style="display:flex; width:100%; align-items:center; justify-content:space-between; gap:14px; border:1px solid rgb(255 99 71 / 24%); border-radius:20px; background:linear-gradient(180deg, rgb(255 99 71 / 14%), rgb(255 99 71 / 8%)); padding:16px; color:rgb(255 221 214); box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%); cursor:default;"
            >
              <span style="display:flex; min-width:0; align-items:center; gap:14px;">
                <span
                  style="display:flex; height:40px; width:40px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:14px; background:rgb(255 255 255 / 6%);"
                >
                  <X size={18} strokeWidth={2.2} />
                </span>
                <span
                  style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.95rem; font-weight:700; letter-spacing:-0.01em;"
                >
                  Close Workspace
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
