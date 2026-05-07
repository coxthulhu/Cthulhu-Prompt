<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  const prompts = [
    {
      id: 'project-brief',
      title: 'Project Brief',
      body: 'Summarize the current implementation plan, call out unresolved decisions, and list the next file-level changes.',
      lines: 5,
      tokens: 164,
      age: '2 min ago'
    },
    {
      id: 'code-review',
      title: 'Review Pass',
      body: 'Review this change for regressions, missed edge cases, and test gaps. Lead with concrete findings and cite file paths.',
      lines: 7,
      tokens: 221,
      age: '18 min ago'
    },
    {
      id: 'release-notes',
      title: 'Release Notes',
      body: 'Convert the merged changes into concise release notes for a technical user. Group behavior changes separately from fixes.',
      lines: 4,
      tokens: 139,
      age: '1 hr ago'
    }
  ]
</script>

<main
  data-testid="prompt-folder-screen"
  style="display:flex; min-height:0; height:100%; flex:1 1 auto; flex-direction:column; color:var(--ui-normal-text);"
>
  <div
    style="display:flex; height:36px; flex:0 0 auto; align-items:center; border-bottom:1px solid var(--ui-neutral-muted-border); background:oklch(0.118 0.01 268 / 82%); padding:0 24px;"
  >
    <div
      style="display:flex; min-width:0; align-items:center; gap:10px; color:var(--ui-muted-text); font-size:13px; font-weight:650;"
    >
      <button
        type="button"
        style="min-width:0; cursor:pointer; overflow:hidden; border:0; background:transparent; color:var(--ui-secondary-text); font:inherit; text-overflow:ellipsis; white-space:nowrap;"
      >
        Coding Prompts
      </button>
      <span style="color:var(--ui-neutral-emphasis-border);">/</span>
      <button
        type="button"
        style="cursor:pointer; border:0; background:transparent; color:var(--ui-normal-text); font:inherit; white-space:nowrap;"
      >
        Project Brief
      </button>
    </div>
  </div>

  <div style="min-height:0; flex:1 1 auto; overflow:auto;">
    <div style="box-sizing:border-box; width:min(100%, 1040px); padding:24px 28px 80px;">
      <section style="display:grid; gap:24px;">
        <div
          style="display:grid; gap:8px; border-left:3px solid var(--ui-accent-normal-border); padding-left:16px;"
        >
          <div style="display:flex; align-items:center; gap:10px;">
            <span
              style="display:grid; height:30px; width:30px; place-items:center; border:1px solid var(--ui-accent-normal-border); border-radius:7px; background:var(--ui-accent-icon-surface); color:var(--ui-accent-icon-glyph);"
            >
              <Settings size={16} strokeWidth={2.4} />
            </span>
            <h1
              style="margin:0; color:var(--ui-normal-text); font-size:24px; font-weight:760; line-height:32px;"
            >
              Folder Settings
            </h1>
          </div>
          <p style="margin:0; color:var(--ui-muted-text); font-size:14px; line-height:20px;">
            Settings that only affect prompts in this folder, and are saved to the workspace.
          </p>
        </div>

        <article
          data-testid="prompt-folder-settings-mockup-prompt-folder"
          style="box-sizing:border-box; display:grid; gap:10px; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:0 18px 42px var(--ui-card-normal-shadow); padding:10px;"
        >
          <div
            style="display:grid; min-width:0; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:12px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface); box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding:8px 8px 8px 10px;"
          >
            <div
              style="display:grid; min-width:0; grid-template-columns:40px minmax(0, 1fr); align-items:center; gap:10px;"
            >
              <span
                style="display:grid; height:38px; width:38px; place-items:center; border:1px solid var(--ui-accent-normal-border); border-radius:7px; background:var(--ui-accent-icon-surface); color:var(--ui-accent-icon-glyph); box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
              >
                <Folder size={18} strokeWidth={2.3} />
              </span>
              <div style="display:grid; min-width:0; gap:4px;">
                <p
                  style="margin:0; min-width:0; overflow:hidden; color:var(--ui-normal-text); font-size:15px; font-weight:720; line-height:20px; text-overflow:ellipsis; white-space:nowrap;"
                >
                  Folder Description
                </p>
                <div
                  style="display:flex; min-width:0; align-items:center; gap:7px; overflow:hidden; color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; white-space:nowrap;"
                >
                  <span
                    style="display:inline-flex; min-width:0; align-items:center; gap:5px; overflow:hidden; color:var(--ui-secondary-text); text-overflow:ellipsis; white-space:nowrap;"
                  >
                    <Folder size={12} strokeWidth={2.4} />
                    Folder Settings
                  </span>
                  <span
                    style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span>0 lines</span>
                  <span
                    style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span>0 tokens</span>
                  <span
                    style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                  ></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Copy folder description"
              title="Copy folder description"
              style="display:grid; height:30px; width:30px; place-items:center; border:1px solid var(--ui-neutral-muted-border); border-radius:6px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text);"
            >
              <Copy size={15} strokeWidth={2.4} />
            </button>
          </div>

          <div
            style="min-height:126px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:oklch(0.128 0.012 268 / 78%); box-shadow:inset 0 1px 12px var(--ui-shadow-inset); padding:14px 16px; color:var(--ui-secondary-text); font-family:ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; font-size:13px; line-height:21px;"
          >
            Prompts for implementation planning, review, release notes, and focused coding sessions.
          </div>
        </article>
      </section>

      <section style="display:grid; gap:14px; padding-top:28px;">
        <div
          style="display:grid; gap:8px; border-left:3px solid var(--ui-info-normal-border); padding-left:16px;"
        >
          <div style="display:grid; min-width:0; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span
                style="display:grid; height:30px; width:30px; place-items:center; border:1px solid var(--ui-info-normal-border); border-radius:7px; background:var(--ui-info-normal-surface); color:oklch(0.88 0.07 252);"
              >
                <FileText size={16} strokeWidth={2.4} />
              </span>
              <h2
                style="margin:0; color:var(--ui-normal-text); font-size:24px; font-weight:760; line-height:32px;"
              >
                Prompts
              </h2>
            </div>
            <p style="margin:0; color:var(--ui-muted-text); font-size:14px; line-height:20px;">
              3 reusable prompts in this folder, ready to copy or reorder.
            </p>
          </div>
        </div>

        <div style="display:grid; gap:12px;">
          <div
            style="display:grid; grid-template-columns:28px minmax(0, 1fr); align-items:center; gap:10px;"
          >
            <div
              style="display:flex; height:28px; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-normal-border); border-radius:7px; background:oklch(0.172 0.018 255 / 72%); color:var(--ui-secondary-text);"
            >
              <Plus size={15} strokeWidth={3} />
            </div>
            <div
              style="display:grid; grid-template-columns:minmax(0, 1fr) auto auto; align-items:center; gap:8px;"
            >
              <div
                style="height:1px; background:linear-gradient(90deg, var(--ui-neutral-emphasis-border), var(--ui-neutral-muted-border));"
              ></div>
              <button
                type="button"
                style="display:inline-flex; align-items:center; gap:7px; border:1px solid var(--ui-accent-normal-border); border-radius:7px; background:var(--ui-accent-normal-surface); padding:6px 10px; color:var(--ui-accent-normal-text); font-size:12px; font-weight:750;"
              >
                <FileText size={14} strokeWidth={2.5} />
                Prompt
              </button>
              <button
                type="button"
                style="display:inline-flex; align-items:center; gap:7px; border:1px solid var(--ui-info-normal-border); border-radius:7px; background:var(--ui-info-normal-surface); padding:6px 10px; color:var(--ui-hoverable-text); font-size:12px; font-weight:750;"
              >
                <FolderPlus size={14} strokeWidth={2.5} />
                Subfolder
              </button>
            </div>
          </div>

          {#each prompts as prompt, index (prompt.id)}
            <article
              style="box-sizing:border-box; display:grid; min-height:192px; grid-template-columns:34px minmax(0, 1fr); gap:10px; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:0 18px 42px var(--ui-card-normal-shadow); padding:10px;"
            >
              <div
                style="display:grid; width:34px; grid-template-rows:32px minmax(0, 1fr) 32px; gap:6px; min-height:136px;"
              >
                <button
                  type="button"
                  aria-label="Move prompt up"
                  disabled={index === 0}
                  style="display:grid; height:32px; width:34px; place-items:center; border:1px solid var(--ui-neutral-muted-border); border-radius:6px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text); opacity:{index ===
                  0
                    ? 0.38
                    : 1};"
                >
                  <ChevronUp size={16} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Drag prompt"
                  style="display:grid; width:34px; place-items:center; border:1px solid var(--ui-neutral-muted-border); border-radius:6px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text);"
                >
                  <GripVertical size={17} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label="Move prompt down"
                  disabled={index === prompts.length - 1}
                  style="display:grid; height:32px; width:34px; place-items:center; border:1px solid var(--ui-neutral-muted-border); border-radius:6px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text); opacity:{index ===
                  prompts.length - 1
                    ? 0.38
                    : 1};"
                >
                  <ChevronDown size={16} strokeWidth={2.4} />
                </button>
              </div>

              <div style="display:grid; min-width:0; align-content:start; gap:8px;">
                <div
                  style="display:grid; min-width:0; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:12px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface); box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight); padding:8px 8px 8px 10px;"
                >
                  <div
                    style="display:grid; min-width:0; grid-template-columns:40px minmax(0, 1fr); align-items:center; gap:10px;"
                  >
                    <span
                      style="display:grid; height:38px; width:38px; place-items:center; border:1px solid var(--ui-accent-normal-border); border-radius:7px; background:var(--ui-accent-icon-surface); color:var(--ui-accent-icon-glyph); box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);"
                    >
                      <FileText size={18} strokeWidth={2.3} />
                    </span>
                    <div style="display:grid; min-width:0; gap:4px;">
                      <p
                        style="margin:0; min-width:0; overflow:hidden; color:var(--ui-normal-text); font-size:15px; font-weight:720; line-height:20px; text-overflow:ellipsis; white-space:nowrap;"
                      >
                        {prompt.title}
                      </p>
                      <div
                        style="display:flex; min-width:0; align-items:center; gap:7px; overflow:hidden; color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; white-space:nowrap;"
                      >
                        <span
                          style="display:inline-flex; min-width:0; align-items:center; gap:5px; overflow:hidden; color:var(--ui-secondary-text); text-overflow:ellipsis; white-space:nowrap;"
                        >
                          <Folder size={12} strokeWidth={2.4} />
                          Coding Prompts
                        </span>
                        <span
                          style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                        ></span>
                        <span>{prompt.lines} lines</span>
                        <span
                          style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                        ></span>
                        <span>{prompt.tokens} tokens</span>
                        <span
                          style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"
                        ></span>
                        <span>{prompt.age}</span>
                      </div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <button
                      type="button"
                      aria-label="Copy prompt"
                      title="Copy prompt"
                      style="display:grid; height:30px; width:30px; place-items:center; border:1px solid var(--ui-neutral-muted-border); border-radius:6px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text);"
                    >
                      <Copy size={15} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete prompt"
                      title="Delete prompt"
                      style="display:grid; height:30px; width:30px; place-items:center; border:1px solid var(--ui-danger-normal-border); border-radius:6px; background:var(--ui-danger-normal-surface); color:var(--ui-danger-icon-glyph);"
                    >
                      <Trash2 size={15} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                <div
                  style="min-height:94px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:oklch(0.128 0.012 268 / 78%); box-shadow:inset 0 1px 12px var(--ui-shadow-inset); padding:14px 16px; color:var(--ui-secondary-text); font-family:ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; font-size:13px; line-height:21px;"
                >
                  {prompt.body}
                </div>
              </div>
            </article>

            <div
              style="display:grid; grid-template-columns:28px minmax(0, 1fr); align-items:center; gap:10px;"
            >
              <div
                style="display:flex; height:28px; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-normal-border); border-radius:7px; background:oklch(0.172 0.018 255 / 72%); color:var(--ui-secondary-text);"
              >
                <Plus size={15} strokeWidth={3} />
              </div>
              <div
                style="display:grid; grid-template-columns:minmax(0, 1fr) auto auto; align-items:center; gap:8px;"
              >
                <div
                  style="height:1px; background:linear-gradient(90deg, var(--ui-neutral-emphasis-border), var(--ui-neutral-muted-border));"
                ></div>
                <button
                  type="button"
                  style="display:inline-flex; align-items:center; gap:7px; border:1px solid var(--ui-accent-normal-border); border-radius:7px; background:var(--ui-accent-normal-surface); padding:6px 10px; color:var(--ui-accent-normal-text); font-size:12px; font-weight:750;"
                >
                  <FileText size={14} strokeWidth={2.5} />
                  Prompt
                </button>
                <button
                  type="button"
                  style="display:inline-flex; align-items:center; gap:7px; border:1px solid var(--ui-info-normal-border); border-radius:7px; background:var(--ui-info-normal-surface); padding:6px 10px; color:var(--ui-hoverable-text); font-size:12px; font-weight:750;"
                >
                  <FolderPlus size={14} strokeWidth={2.5} />
                  Subfolder
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
</main>
