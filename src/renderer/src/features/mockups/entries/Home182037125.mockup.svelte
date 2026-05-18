<script lang="ts">
  import {
    ArrowUpRight,
    Bug,
    Check,
    FileCode2,
    FolderOpen,
    FolderPlus,
    Library,
    Sparkles
  } from 'lucide-svelte'

  type HoverKey = 'getStarted' | 'open' | 'create' | 'github'

  let hovered = $state<HoverKey | null>(null)

  const setHovered = (key: HoverKey) => {
    hovered = key
  }

  const clearHovered = (key: HoverKey) => {
    if (hovered === key) {
      hovered = null
    }
  }

  const cardStyle = (key: HoverKey) => `
    border: 1px solid ${hovered === key ? 'var(--ui-accent-hover-border)' : 'var(--ui-card-normal-border)'};
    border-radius: 8px;
    background:
      linear-gradient(145deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)),
      linear-gradient(90deg, oklch(0.627 0.17 149.214 / 10%), oklch(0.666 0.181 254.617 / 10%));
    box-shadow: ${hovered === key ? '0 22px 44px var(--ui-card-normal-shadow)' : '0 14px 32px var(--ui-shadow-raised)'};
    transform: ${hovered === key ? 'translateY(-1px)' : 'translateY(0)'};
    transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  `

  const actionButtonStyle = (key: HoverKey, variant: 'neutral' | 'accent') => `
    align-items: center;
    border: 1px solid ${
      variant === 'accent'
        ? hovered === key
          ? 'var(--ui-accent-hover-border)'
          : 'var(--ui-accent-normal-border)'
        : hovered === key
          ? 'var(--ui-neutral-hover-border)'
          : 'var(--ui-neutral-normal-border)'
    };
    border-radius: 8px;
    background: ${
      variant === 'accent'
        ? hovered === key
          ? 'var(--ui-accent-hover-surface)'
          : 'var(--ui-accent-normal-surface)'
        : hovered === key
          ? 'var(--ui-neutral-hover-surface)'
          : 'var(--ui-neutral-normal-surface)'
    };
    color: var(--ui-normal-text);
    cursor: pointer;
    display: flex;
    gap: 12px;
    min-height: 74px;
    padding: 14px 16px;
    text-align: left;
    transform: ${hovered === key ? 'translateY(-1px)' : 'translateY(0)'};
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
    width: 100%;
  `

  const iconTileStyle = (key: HoverKey, variant: 'neutral' | 'accent') => `
    align-items: center;
    border: 1px solid ${
      variant === 'accent' ? 'var(--ui-accent-normal-border)' : 'var(--ui-neutral-normal-border)'
    };
    border-radius: 8px;
    background: ${
      variant === 'accent'
        ? hovered === key
          ? 'var(--ui-accent-normal-fill)'
          : 'var(--ui-accent-normal-surface)'
        : hovered === key
          ? 'var(--ui-neutral-emphasis-surface)'
          : 'var(--ui-neutral-muted-surface)'
    };
    color: ${variant === 'accent' ? 'var(--ui-accent-icon-glyph)' : 'var(--ui-hoverable-text)'};
    display: flex;
    flex: 0 0 auto;
    height: 42px;
    justify-content: center;
    transition: background 150ms ease;
    width: 42px;
  `
</script>

<main
  style="
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: flex;
    min-height: 100%;
    min-width: 0;
    overflow-y: auto;
    padding: 24px;
    width: 100%;
  "
>
  <div
    style="
      align-items: center;
      display: flex;
      justify-content: center;
      min-height: 100%;
      min-width: 0;
      width: 100%;
    "
  >
    <section style="max-width: 1024px; min-width: 0; width: 100%;">
      <header>
        <div style="margin: 0 auto; max-width: 992px; width: 100%;">
          <h2
            style="
              color: var(--ui-normal-text);
              font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
              font-size: clamp(4rem, 9vw, 5.5rem);
              font-weight: 700;
              letter-spacing: 0.14em;
              line-height: 1;
              margin: 0;
              text-align: center;
              white-space: nowrap;
            "
          >
            CTHULHU PROMPT
          </h2>
          <div
            style="
              background: var(--ui-neutral-muted-border);
              height: 1px;
              margin-top: 16px;
              width: 100%;
            "
          ></div>
        </div>
      </header>

      <div
        style="
          align-items: start;
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
          margin-top: 20px;
          width: 100%;
        "
      >
        <article
          onmouseenter={() => setHovered('getStarted')}
          onmouseleave={() => clearHovered('getStarted')}
          style={cardStyle('getStarted')}
        >
          <div style="display: flex; flex-direction: column; gap: 18px; padding: 22px;">
            <div
              style="
                align-items: flex-start;
                display: flex;
                gap: 14px;
                justify-content: space-between;
              "
            >
              <div style="display: flex; gap: 14px; min-width: 0;">
                <div
                  style="
                    align-items: center;
                    border: 1px solid var(--ui-success-normal-border);
                    border-radius: 8px;
                    background: var(--ui-success-normal-surface);
                    color: var(--ui-success-normal-text);
                    display: flex;
                    flex: 0 0 auto;
                    height: 46px;
                    justify-content: center;
                    width: 46px;
                  "
                >
                  <Library size={24} strokeWidth={1.8} />
                </div>
                <div style="min-width: 0;">
                  <p
                    style="
                      color: var(--ui-muted-text);
                      font-size: 0.74rem;
                      font-weight: 700;
                      letter-spacing: 0.12em;
                      line-height: 1.2;
                      margin: 0 0 6px;
                      text-transform: uppercase;
                    "
                  >
                    No workspace selected
                  </p>
                  <h3
                    style="
                      color: var(--ui-normal-text);
                      font-size: 1.18rem;
                      font-weight: 700;
                      line-height: 1.25;
                      margin: 0;
                    "
                  >
                    Get started
                  </h3>
                </div>
              </div>
              <div
                style="
                  align-items: center;
                  border: 1px solid var(--ui-info-normal-border);
                  border-radius: 999px;
                  background: var(--ui-info-normal-surface);
                  color: var(--ui-normal-text);
                  display: inline-flex;
                  flex: 0 0 auto;
                  font-size: 0.76rem;
                  font-weight: 700;
                  gap: 6px;
                  padding: 6px 9px;
                "
              >
                <Sparkles size={14} strokeWidth={2} />
                Ready
              </div>
            </div>

            <div
              style="
                border-left: 2px solid var(--ui-success-normal-border);
                color: var(--ui-secondary-text);
                display: flex;
                flex-direction: column;
                font-size: 0.95rem;
                gap: 12px;
                line-height: 1.55;
                padding-left: 16px;
              "
            >
              <p style="margin: 0;">
                Cthulhu Prompt is a prompt editor and manager that stores your prompts as a
                series of Markdown files in a directory.
              </p>
              <p style="margin: 0;">
                This directory is called a workspace. Create a new workspace folder somewhere
                with the create button, or download or clone a workspace from somewhere else and
                use the open button to get started.
              </p>
            </div>

            <div
              style="
                border: 1px solid var(--ui-card-nested-border);
                border-radius: 8px;
                background: var(--ui-card-nested-surface);
                box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
                display: grid;
                gap: 10px;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                padding: 12px;
              "
            >
              <div style="display: flex; gap: 10px; min-width: 0;">
                <FileCode2
                  size={18}
                  strokeWidth={1.8}
                  style="color: var(--ui-accent-icon-glyph); flex: 0 0 auto; margin-top: 2px;"
                />
                <div style="min-width: 0;">
                  <p
                    style="
                      color: var(--ui-muted-text);
                      font-size: 0.72rem;
                      font-weight: 700;
                      margin: 0 0 3px;
                      text-transform: uppercase;
                    "
                  >
                    Example file
                  </p>
                  <p
                    style="
                      color: var(--ui-hoverable-text);
                      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
                      font-size: 0.82rem;
                      margin: 0;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    "
                  >
                    prompts/refactor-plan.md
                  </p>
                </div>
              </div>
              <div style="display: flex; gap: 10px; min-width: 0;">
                <Check
                  size={18}
                  strokeWidth={1.8}
                  style="color: var(--ui-success-normal-text); flex: 0 0 auto; margin-top: 2px;"
                />
                <div style="min-width: 0;">
                  <p
                    style="
                      color: var(--ui-muted-text);
                      font-size: 0.72rem;
                      font-weight: 700;
                      margin: 0 0 3px;
                      text-transform: uppercase;
                    "
                  >
                    Workspace
                  </p>
                  <p
                    style="
                      color: var(--ui-hoverable-text);
                      font-size: 0.82rem;
                      margin: 0;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    "
                  >
                    Markdown folder
                  </p>
                </div>
              </div>
            </div>

            <a
              href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
              onmouseenter={() => setHovered('github')}
              onmouseleave={() => clearHovered('github')}
              rel="noreferrer"
              style="
                align-items: center;
                align-self: flex-start;
                border: 1px solid {hovered === 'github'
                ? 'var(--ui-warning-normal-border)'
                : 'var(--ui-neutral-muted-border)'};
                border-radius: 8px;
                background: {hovered === 'github'
                ? 'var(--ui-warning-normal-surface)'
                : 'var(--ui-neutral-muted-surface)'};
                color: var(--ui-hoverable-text);
                display: inline-flex;
                font-size: 0.9rem;
                font-weight: 650;
                gap: 9px;
                padding: 10px 12px;
                text-decoration: none;
                transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
                transform: {hovered === 'github' ? 'translateY(-1px)' : 'translateY(0)'};
              "
              target="_blank"
            >
              <Bug size={17} strokeWidth={1.9} />
              Report bugs on GitHub
              <ArrowUpRight size={15} strokeWidth={2} />
            </a>
          </div>
        </article>

        <article
          style="
            border: 1px solid var(--ui-card-normal-border);
            border-radius: 8px;
            background: linear-gradient(
              145deg,
              var(--ui-card-normal-surface-gradient-start),
              var(--ui-card-normal-surface-gradient-end)
            );
            box-shadow: 0 14px 32px var(--ui-shadow-raised);
          "
        >
          <div style="display: flex; flex-direction: column; gap: 16px; padding: 22px;">
            <div
              style="
                align-items: flex-start;
                display: flex;
                gap: 12px;
                justify-content: space-between;
              "
            >
              <div style="min-width: 0;">
                <div
                  style="
                    background: var(--ui-accent-normal-border);
                    border-radius: 999px;
                    height: 3px;
                    margin-bottom: 10px;
                    width: 34px;
                  "
                ></div>
                <h3
                  style="
                    color: var(--ui-normal-text);
                    font-size: 1rem;
                    font-weight: 700;
                    line-height: 1.25;
                    margin: 0 0 5px;
                  "
                >
                  Workspace Actions
                </h3>
                <p
                  style="
                    color: var(--ui-muted-text);
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin: 0;
                  "
                >
                  Create or select a workspace.
                </p>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button
                onmouseenter={() => setHovered('open')}
                onmouseleave={() => clearHovered('open')}
                style={actionButtonStyle('open', 'neutral')}
                type="button"
              >
                <span style={iconTileStyle('open', 'neutral')}>
                  <FolderOpen size={22} strokeWidth={1.8} />
                </span>
                <span style="display: block; min-width: 0;">
                  <span
                    style="
                      color: var(--ui-normal-text);
                      display: block;
                      font-size: 0.94rem;
                      font-weight: 700;
                      line-height: 1.25;
                      margin-bottom: 3px;
                    "
                  >
                    Open Workspace
                  </span>
                  <span
                    style="
                      color: var(--ui-muted-text);
                      display: block;
                      font-size: 0.82rem;
                      line-height: 1.35;
                    "
                  >
                    Select an existing workspace file.
                  </span>
                </span>
              </button>

              <button
                onmouseenter={() => setHovered('create')}
                onmouseleave={() => clearHovered('create')}
                style={actionButtonStyle('create', 'accent')}
                type="button"
              >
                <span style={iconTileStyle('create', 'accent')}>
                  <FolderPlus size={22} strokeWidth={1.8} />
                </span>
                <span style="display: block; min-width: 0;">
                  <span
                    style="
                      color: var(--ui-normal-text);
                      display: block;
                      font-size: 0.94rem;
                      font-weight: 700;
                      line-height: 1.25;
                      margin-bottom: 3px;
                    "
                  >
                    Create Workspace
                  </span>
                  <span
                    style="
                      color: var(--ui-accent-normal-text);
                      display: block;
                      font-size: 0.82rem;
                      line-height: 1.35;
                    "
                  >
                    Choose a folder and set up a new workspace folder.
                  </span>
                </span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</main>
