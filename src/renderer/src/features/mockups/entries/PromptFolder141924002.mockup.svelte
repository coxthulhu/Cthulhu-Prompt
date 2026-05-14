<script lang="ts">
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Settings
  } from 'lucide-svelte'

  type PromptFolderPreview = {
    name: string
    count: number
    expanded: boolean
    active?: boolean
    prompts: string[]
  }

  const folders: PromptFolderPreview[] = [
    {
      name: 'Codex Workflows',
      count: 7,
      expanded: true,
      active: true,
      prompts: [
        'Patch review checklist',
        'Svelte 5 migration pass',
        'Playwright failure triage',
        'Release note draft'
      ]
    },
    {
      name: 'Frontend Polish',
      count: 5,
      expanded: true,
      prompts: ['Responsive layout audit', 'Palette cleanup', 'Interaction states']
    },
    {
      name: 'Research Notes',
      count: 3,
      expanded: false,
      prompts: []
    },
    {
      name: 'Archive',
      count: 12,
      expanded: false,
      prompts: []
    }
  ]

  const promptCards = [
    {
      title: 'Patch review checklist',
      body:
        'Review the diff for behavior changes, missing tests, accessibility regressions, and unclear state ownership. Lead with concrete findings and file references.'
    },
    {
      title: 'Svelte 5 migration pass',
      body:
        'Convert local state to runes, keep snippets inline at the call site, and add short side-effect comments for lifecycle or reactive synchronization.'
    }
  ]
</script>

<div
  style="
    box-sizing: border-box;
    width: 100%;
    min-height: 760px;
    display: flex;
    overflow: hidden;
    border: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-normal-text);
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  "
>
  <aside
    data-testid="app-sidebar"
    style="
      width: 292px;
      min-width: 292px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid var(--ui-neutral-muted-border);
      background:
        linear-gradient(180deg, oklch(0.2 0.012 266 / 92%) 0%, oklch(0.135 0.012 266 / 96%) 100%),
        linear-gradient(90deg, var(--ui-card-normal-surface-gradient-start), transparent 70%);
      box-shadow:
        inset -1px 0 0 var(--ui-card-nested-border),
        inset 0 1px 0 var(--ui-neutral-muted-surface);
    "
  >
    <div style="padding: 10px 13px 8px;">
      <div
        style="
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border: 1px solid var(--ui-neutral-muted-border);
          border-radius: var(--cthulhu-ui-radius-card);
          background: var(--ui-neutral-muted-surface);
          box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
        "
      >
        <div
          style="
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
          "
        >
          <img
            src={appIcon}
            alt="Cthulhu Prompt icon"
            draggable="false"
            style="width: 31px; height: 31px; object-fit: contain;"
          />
        </div>
        <div style="min-width: 0; flex: 1;">
          <h1
            style="
              margin: 0;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: var(--ui-normal-text);
              font-size: 14px;
              font-weight: 650;
              line-height: 20px;
            "
          >
            PromptApps
          </h1>
          <p
            title="C:\Source\PromptApps"
            style="
              margin: 0;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: var(--ui-muted-text);
              font-size: 12px;
              line-height: 17px;
            "
          >
            C:\Source\PromptApps
          </p>
        </div>
      </div>
    </div>

    <nav style="padding: 8px 13px 12px; border-bottom: 1px solid var(--ui-neutral-muted-border);">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button
          type="button"
          style="
            height: 36px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid var(--ui-neutral-muted-border);
            border-radius: var(--cthulhu-ui-radius-control);
            background: var(--ui-neutral-muted-surface);
            color: var(--ui-hoverable-text);
            box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
            font: inherit;
            font-size: 13px;
            font-weight: 600;
          "
        >
          <Home size={16} strokeWidth={2.2} />
          Home
        </button>
        <button
          type="button"
          style="
            height: 36px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid var(--ui-neutral-emphasis-border);
            border-radius: var(--cthulhu-ui-radius-control);
            background: var(--ui-neutral-emphasis-surface);
            color: var(--ui-normal-text);
            box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
            font: inherit;
            font-size: 13px;
            font-weight: 650;
          "
        >
          <Settings size={16} strokeWidth={2.2} />
          Settings
        </button>
      </div>
    </nav>

    <section style="display: flex; min-height: 0; flex: 1; flex-direction: column;">
      <div style="padding: 13px 13px 9px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="min-width: 0;">
            <p
              style="
                margin: 0;
                color: var(--ui-secondary-text);
                font-size: 11px;
                font-weight: 700;
                line-height: 14px;
                text-transform: uppercase;
                letter-spacing: 0.18em;
              "
            >
              Prompts
            </p>
            <p
              style="
                margin: 2px 0 0;
                color: var(--ui-muted-text);
                font-size: 12px;
                line-height: 17px;
              "
            >
              4 folders
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 2px;">
            <button
              type="button"
              aria-label="Expand All Prompt Folders"
              title="Expand All Prompt Folders"
              style="
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid transparent;
                border-radius: var(--cthulhu-ui-radius-icon-button);
                background: transparent;
                color: var(--ui-secondary-text);
              "
            >
              <ChevronsUpDown size={16} />
            </button>
            <button
              type="button"
              aria-label="Collapse All Prompt Folders"
              title="Collapse All Prompt Folders"
              style="
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid transparent;
                border-radius: var(--cthulhu-ui-radius-icon-button);
                background: transparent;
                color: var(--ui-secondary-text);
              "
            >
              <ChevronsDownUp size={16} />
            </button>
            <button
              type="button"
              aria-label="Create Prompt Folder"
              title="Create Prompt Folder"
              style="
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--ui-accent-normal-border);
                border-radius: var(--cthulhu-ui-radius-icon-button);
                background: var(--ui-accent-normal-surface);
                color: var(--ui-accent-normal-text);
                box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
              "
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style="min-height: 0; flex: 1; overflow: hidden; padding: 0 5px 12px 5px;">
        {#each folders as folder (folder.name)}
          <div
            style="
              height: 36px;
              display: flex;
              align-items: center;
              gap: 0;
              margin-bottom: 2px;
              border: 1px solid {folder.active
                ? 'var(--ui-neutral-emphasis-border)'
                : 'transparent'};
              border-radius: var(--cthulhu-ui-radius-control);
              background: {folder.active
                ? 'linear-gradient(90deg, var(--ui-accent-normal-surface), var(--ui-neutral-emphasis-surface))'
                : 'transparent'};
              box-shadow: {folder.active
                ? 'inset 0 1px 0 var(--ui-neutral-normal-surface)'
                : 'none'};
              color: {folder.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'};
            "
          >
            <button
              type="button"
              aria-expanded={folder.expanded}
              style="
                min-width: 0;
                height: 100%;
                display: flex;
                flex: 1;
                align-items: center;
                gap: 8px;
                border: 0;
                background: transparent;
                padding: 0 6px 0 8px;
                color: inherit;
                font: inherit;
                text-align: left;
              "
            >
              <span
                style="
                  width: 20px;
                  height: 20px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  flex: 0 0 auto;
                  border-radius: var(--cthulhu-ui-radius-icon-button);
                  color: inherit;
                "
              >
                {#if folder.expanded}
                  <ChevronDown size={16} />
                {:else}
                  <ChevronRight size={16} />
                {/if}
              </span>
              <Folder size={16} />
              <span
                style="
                  min-width: 0;
                  flex: 1;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-size: 14px;
                  font-weight: 560;
                "
              >
                {folder.name}
              </span>
            </button>
            <span
              style="
                height: 20px;
                min-width: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 6px;
                border: 1px solid var(--ui-neutral-muted-border);
                border-radius: var(--cthulhu-ui-radius-control);
                background: var(--ui-neutral-normal-surface);
                color: inherit;
                font-size: 11px;
                font-weight: 700;
                line-height: 1;
              "
            >
              {folder.count}
            </span>
            <button
              type="button"
              aria-label={`Open ${folder.name}`}
              style="
                width: 24px;
                height: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 6px;
                border: 0;
                border-radius: var(--cthulhu-ui-radius-icon-button);
                background: transparent;
                color: inherit;
              "
            >
              <ArrowRight size={16} />
            </button>
          </div>

          {#if folder.expanded}
            <div style="padding-left: 30px; padding-bottom: 4px;">
              {#each folder.prompts as prompt, index (prompt)}
                <button
                  type="button"
                  aria-current={folder.active && index === 0 ? 'true' : undefined}
                  style="
                    width: 100%;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid {folder.active && index === 0
                      ? 'var(--ui-neutral-emphasis-border)'
                      : 'transparent'};
                    border-radius: var(--cthulhu-ui-radius-control);
                    background: {folder.active && index === 0
                      ? 'var(--ui-neutral-emphasis-surface)'
                      : 'transparent'};
                    color: {folder.active && index === 0
                      ? 'var(--ui-normal-text)'
                      : 'var(--ui-hoverable-text)'};
                    padding: 0 8px;
                    font: inherit;
                    text-align: left;
                  "
                >
                  <FileText size={14} style="flex: 0 0 auto;" />
                  <span
                    style="
                      min-width: 0;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      font-size: 13px;
                    "
                  >
                    {prompt}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </section>
  </aside>

  <main style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
    <div
      style="
        height: 36px;
        display: flex;
        align-items: center;
        flex: 0 0 auto;
        border-bottom: 1px solid var(--ui-neutral-muted-border);
        background: oklch(0.145 0.011 266.847 / 82%);
        padding: 0 24px;
      "
    >
      <div
        style="
          min-width: 0;
          display: flex;
          align-items: center;
          color: var(--ui-muted-text);
          font-size: 14px;
          font-weight: 500;
        "
      >
        <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Codex Workflows
        </span>
        <span style="padding: 0 12px; color: oklch(1 0 0 / 32%);">/</span>
        <span style="color: var(--ui-hoverable-text); white-space: nowrap;">
          Patch review checklist
        </span>
      </div>
    </div>

    <div style="min-height: 0; flex: 1; overflow: hidden; padding: 30px 32px;">
      <section style="max-width: 980px;">
        <div
          style="
            display: grid;
            gap: 8px;
            border-left: 3px solid var(--ui-accent-normal-border);
            padding-left: 16px;
          "
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <span
              style="
                width: 30px;
                height: 30px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--ui-accent-icon-ring);
                border-radius: 7px;
                background: var(--ui-accent-normal-surface);
                color: var(--ui-accent-icon-glyph);
              "
            >
              <FileText size={16} />
            </span>
            <h2
              style="
                margin: 0;
                color: var(--ui-normal-text);
                font-size: 24px;
                font-weight: 760;
                line-height: 32px;
              "
            >
              Prompts
            </h2>
          </div>
          <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
            Create, edit, and organize prompts in this folder.
          </p>
        </div>

        <div style="height: 26px;"></div>

        {#each promptCards as prompt (prompt.title)}
          <article
            style="
              margin-bottom: 14px;
              border: 1px solid var(--ui-card-normal-border);
              border-radius: var(--cthulhu-ui-radius-card);
              background: linear-gradient(
                to bottom,
                var(--ui-card-normal-surface-gradient-start),
                var(--ui-card-normal-surface-gradient-end)
              );
              box-shadow: var(--cthulhu-ui-shadow-card);
              padding: 16px;
            "
          >
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <h3
                style="
                  margin: 0;
                  color: var(--ui-normal-text);
                  font-size: 16px;
                  font-weight: 680;
                  line-height: 22px;
                "
              >
                {prompt.title}
              </h3>
              <button
                type="button"
                aria-label="Prompt actions"
                style="
                  width: 32px;
                  height: 32px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  border: 1px solid var(--ui-neutral-normal-border);
                  border-radius: var(--cthulhu-ui-radius-icon-button);
                  background: var(--ui-neutral-muted-surface);
                  color: var(--ui-secondary-text);
                "
              >
                <Settings size={15} />
              </button>
            </div>
            <p
              style="
                margin: 12px 0 0;
                color: var(--ui-secondary-text);
                font-size: 14px;
                line-height: 22px;
              "
            >
              {prompt.body}
            </p>
          </article>
        {/each}
      </section>
    </div>
  </main>
</div>
