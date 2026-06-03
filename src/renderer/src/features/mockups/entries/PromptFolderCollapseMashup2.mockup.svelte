<script lang="ts">
  import {
    AlignLeft,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Copy,
    FileText,
    Folder,
    GripVertical,
    MoreVertical,
    Plus,
    Search,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type SettingsCard = {
    id: string
    title: string
    metadata: string
    detail: string
    text: string
    lines: number
    tokens: number
  }

  type PromptCard = {
    id: string
    title: string
    folder: string
    text: string
    lines: number
    tokens: number
    updated: string
  }

  const settingsCards: SettingsCard[] = [
    {
      id: 'description',
      title: 'Folder Description',
      metadata: 'Folder Settings',
      detail: 'A general description of this folder and the types of prompts within it.',
      text: 'Reusable product engineering prompts for UI review, test planning, release notes, and codebase cleanup. Keep responses concise, specific, and grounded in the repository.',
      lines: 2,
      tokens: 34
    },
    {
      id: 'prefix',
      title: 'Prompt Folder Prefix',
      metadata: 'Folder Settings',
      detail: 'Text added before each prompt copied from this folder.',
      text: 'You are working in Cthulhu Prompt. Read the surrounding code first and keep edits scoped to the requested behavior.',
      lines: 1,
      tokens: 22
    },
    {
      id: 'suffix',
      title: 'Prompt Folder Suffix',
      metadata: 'Folder Settings',
      detail: 'Text added after each prompt copied from this folder.',
      text: 'Before finishing, summarize the files changed and the verification performed.',
      lines: 1,
      tokens: 12
    }
  ]

  const promptCards: PromptCard[] = [
    {
      id: 'review',
      title: 'Review a Renderer Change',
      folder: 'Product Engineering',
      text: 'Review this renderer change for regressions, accessibility gaps, and missing tests. Start with findings ordered by severity, then add open questions and a short summary.',
      lines: 2,
      tokens: 31,
      updated: 'Updated 4 minutes ago'
    },
    {
      id: 'playwright',
      title: 'Write a Focused Playwright Spec',
      folder: 'Product Engineering',
      text: 'Create a Playwright test for the user flow described below. Prefer existing helpers and stable data-testid selectors. Keep the scenario narrow but representative.',
      lines: 2,
      tokens: 29,
      updated: 'Updated 18 minutes ago'
    },
    {
      id: 'release',
      title: 'Draft Release Notes',
      folder: 'Product Engineering',
      text: 'Turn these merged changes into plain release notes. Group visible user changes first, then smaller fixes. Avoid implementation jargon unless it affects the user.',
      lines: 2,
      tokens: 30,
      updated: 'Updated yesterday'
    },
    {
      id: 'cleanup',
      title: 'Plan a Refactor',
      folder: 'Product Engineering',
      text: 'Inspect the target module and propose a low-risk refactor plan. Identify behavior that must stay unchanged and call out where tests should be added.',
      lines: 2,
      tokens: 28,
      updated: 'Updated May 30'
    }
  ]

  let isFolderSettingsCollapsed = $state(false)
  let isPromptsCollapsed = $state(false)
  let hoveredId = $state<string | null>(null)

  const lineLabel = (count: number) => `${count} ${count === 1 ? 'line' : 'lines'}`
  const tokenLabel = (count: number) => `${count} ${count === 1 ? 'token' : 'tokens'}`

  const sectionButtonStyle = (id: string) => `
    appearance: none;
    align-items: center;
    background: transparent;
    border: 0;
    box-sizing: border-box;
    color: ${hoveredId === id ? 'var(--ui-hoverable-text)' : 'var(--ui-normal-text)'};
    cursor: pointer;
    display: grid;
    gap: 6px;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    padding: 0;
    text-align: left;
    transition: color 120ms ease;
    width: 100%;
  `

  const iconButtonStyle = (id: string, variant: 'normal' | 'accent' | 'danger' = 'normal') => {
    const isHovered = hoveredId === id
    const variants = {
      normal: {
        background: isHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-muted-surface)',
        border: isHovered
          ? 'var(--ui-neutral-interactive-hover-border)'
          : 'var(--ui-neutral-interactive-normal-border)',
        color: isHovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
      },
      accent: {
        background: isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)',
        border: isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)',
        color: 'var(--ui-accent-normal-text)'
      },
      danger: {
        background: isHovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-normal-surface)',
        border: isHovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)',
        color: 'var(--ui-danger-icon-glyph)'
      }
    }
    const selected = variants[variant]

    return `
      align-items: center;
      background: ${selected.background};
      border: 1px solid ${selected.border};
      border-radius: var(--cthulhu-ui-radius-icon-button);
      box-sizing: border-box;
      color: ${selected.color};
      cursor: pointer;
      display: inline-flex;
      flex: 0 0 auto;
      height: 32px;
      justify-content: center;
      padding: 0;
      transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
      width: 32px;
    `
  }

  const cardStyle = (id: string) => `
    background-image: linear-gradient(
      to bottom,
      ${hoveredId === id ? 'oklch(1 0 0 / 8%)' : 'var(--ui-card-normal-surface-gradient-start)'},
      ${hoveredId === id ? 'oklch(1 0 0 / 4%)' : 'var(--ui-card-normal-surface-gradient-end)'}
    );
    border: 1px solid ${hoveredId === id ? 'var(--ui-neutral-hover-border)' : 'var(--ui-card-normal-border)'};
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: ${hoveredId === id ? '0 16px 42px var(--ui-card-normal-shadow)' : 'var(--cthulhu-ui-shadow-card)'};
    box-sizing: border-box;
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 10px;
    transition: background-image 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  `

  const collapsedSummaryLabel = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`

  const countPillStyle = `
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 999px;
    color: var(--ui-secondary-text);
    display: inline-flex;
    font-size: 11px;
    font-weight: 750;
    height: 20px;
    line-height: 18px;
    padding: 0 8px;
    white-space: nowrap;
  `
</script>

<main
  style="
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: flex;
    flex-direction: column;
    min-height: 720px;
    min-width: 0;
    overflow: hidden;
    width: 100%;
  "
>
  <div
    style="
      align-items: center;
      background: var(--ui-card-nested-surface);
      border-bottom: 1px solid var(--ui-neutral-muted-border);
      box-sizing: border-box;
      display: flex;
      flex: 0 0 auto;
      height: 36px;
      min-width: 0;
      padding: 0 24px;
    "
  >
    <div
      style="
        align-items: center;
        color: var(--ui-muted-text);
        display: flex;
        font-size: 14px;
        font-weight: 600;
        min-width: 0;
      "
    >
      <button
        type="button"
        style="
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--ui-hoverable-text);
          cursor: pointer;
          font: inherit;
          min-width: 0;
          overflow: hidden;
          padding: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        "
      >
        Product Engineering
      </button>
      <span style="color: var(--ui-neutral-emphasis-border); padding: 0 12px;">/</span>
      <button
        type="button"
        style="
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--ui-normal-text);
          cursor: pointer;
          font: inherit;
          padding: 0;
          white-space: nowrap;
        "
      >
        Folder Settings
      </button>
    </div>
  </div>

  <div
    style="
      box-sizing: border-box;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 24px 24px 48px;
    "
  >
    <div
      style="
        box-sizing: border-box;
        display: grid;
        align-content: start;
        gap: 24px;
        margin: 0 auto;
        max-width: 1120px;
        min-width: 0;
        width: 100%;
      "
    >
      <section
        aria-label="Folder Settings"
        style="
          border-left: 3px solid var(--ui-accent-normal-border);
          box-sizing: border-box;
          display: grid;
          gap: 24px;
          min-width: 0;
          padding-left: 16px;
        "
      >
        <button
          type="button"
          aria-expanded={!isFolderSettingsCollapsed}
          style={sectionButtonStyle('folder-settings-toggle')}
          onmouseenter={() => {
            hoveredId = 'folder-settings-toggle'
          }}
          onmouseleave={() => {
            hoveredId = null
          }}
          onclick={() => {
            isFolderSettingsCollapsed = !isFolderSettingsCollapsed
          }}
        >
          <span
            style="
              display: grid;
              gap: 6px;
              min-width: 0;
            "
          >
            <span
              style="
                align-items: center;
                display: flex;
                gap: 10px;
                min-width: 0;
              "
            >
              <span
                style="
                  align-items: center;
                  background: var(--ui-accent-normal-surface);
                  border: 1px solid var(--ui-accent-normal-border);
                  border-radius: var(--cthulhu-ui-radius-control);
                  color: var(--ui-accent-icon-glyph);
                  display: inline-flex;
                  flex: 0 0 auto;
                  height: 32px;
                  justify-content: center;
                  width: 32px;
                "
              >
                <Settings size={17} strokeWidth={2.4} />
              </span>
              <span
                style="
                  color: var(--ui-normal-text);
                  font-size: 24px;
                  font-weight: 760;
                  line-height: 32px;
                  min-width: 0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                "
              >
                Folder Settings
              </span>
              {#if isFolderSettingsCollapsed}
                <ChevronRight size={17} strokeWidth={2.6} />
              {:else}
                <ChevronDown size={17} strokeWidth={2.6} />
              {/if}
              <span style={countPillStyle}>
                {collapsedSummaryLabel(settingsCards.length, 'setting', 'settings')}
              </span>
            </span>
            <span
              style="
                color: var(--ui-muted-text);
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;
                min-width: 0;
              "
            >
              Settings that only affect prompts in this folder.
            </span>
          </span>
        </button>

        {#if !isFolderSettingsCollapsed}
          <div style="display: grid; gap: 12px; min-width: 0;">
            {#each settingsCards as card (card.id)}
              <article
                style={cardStyle(`settings-${card.id}`)}
                onmouseenter={() => {
                  hoveredId = `settings-${card.id}`
                }}
                onmouseleave={() => {
                  hoveredId = null
                }}
              >
                <div
                  style="
                    align-items: center;
                    background: var(--ui-neutral-muted-surface);
                    border: 1px solid var(--ui-card-nested-border);
                    border-radius: 7px;
                    display: grid;
                    gap: 12px;
                    grid-template-columns: minmax(0, 1fr) auto;
                    min-width: 0;
                    padding: 8px 8px 8px 10px;
                  "
                >
                  <div
                    style="
                      align-items: center;
                      display: grid;
                      gap: 10px;
                      grid-template-columns: 40px minmax(0, 1fr);
                      min-width: 0;
                    "
                  >
                    <span
                      style="
                        align-items: center;
                        background: var(--ui-accent-normal-surface);
                        border: 1px solid var(--ui-accent-normal-border);
                        border-radius: var(--cthulhu-ui-radius-control);
                        color: var(--ui-accent-icon-glyph);
                        display: inline-flex;
                        height: 40px;
                        justify-content: center;
                        width: 40px;
                      "
                    >
                      {#if card.id === 'description'}
                        <Folder size={18} strokeWidth={2.4} />
                      {:else}
                        <AlignLeft size={18} strokeWidth={2.4} />
                      {/if}
                    </span>
                    <div style="display: grid; gap: 4px; min-width: 0;">
                      <p
                        style="
                          color: var(--ui-normal-text);
                          font-size: 15px;
                          font-weight: 650;
                          line-height: 20px;
                          margin: 0;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          white-space: nowrap;
                        "
                      >
                        {card.title}
                      </p>
                      <div
                        style="
                          align-items: center;
                          color: var(--ui-muted-text);
                          display: flex;
                          font-size: 11px;
                          font-weight: 750;
                          gap: 7px;
                          line-height: 16px;
                          min-width: 0;
                          overflow: hidden;
                          white-space: nowrap;
                        "
                      >
                        <span
                          style="
                            align-items: center;
                            color: var(--ui-secondary-text);
                            display: inline-flex;
                            gap: 5px;
                            min-width: 0;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                          "
                        >
                          <Folder size={12} strokeWidth={2.4} />
                          {card.metadata}
                        </span>
                        <span
                          style="
                            background: var(--ui-neutral-emphasis-border);
                            border-radius: 999px;
                            flex: 0 0 auto;
                            height: 3px;
                            width: 3px;
                          "
                        ></span>
                        <span>{lineLabel(card.lines)}</span>
                        <span
                          style="
                            background: var(--ui-neutral-emphasis-border);
                            border-radius: 999px;
                            flex: 0 0 auto;
                            height: 3px;
                            width: 3px;
                          "
                        ></span>
                        <span>{tokenLabel(card.tokens)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Copy ${card.title}`}
                    title={`Copy ${card.title}`}
                    style={iconButtonStyle(`copy-${card.id}`)}
                    onmouseenter={() => {
                      hoveredId = `copy-${card.id}`
                    }}
                    onmouseleave={() => {
                      hoveredId = null
                    }}
                  >
                    <Copy size={15} strokeWidth={2.4} />
                  </button>
                </div>

                <div
                  style="
                    background: var(--ui-info-normal-surface);
                    border: 1px solid var(--ui-info-normal-border);
                    border-radius: 7px;
                    color: var(--ui-secondary-text);
                    font-size: 13px;
                    line-height: 18px;
                    padding: 9px 11px;
                  "
                >
                  {card.detail}
                </div>

                <div
                  style="
                    background: var(--ui-neutral-field-surface);
                    border: 1px solid var(--ui-neutral-muted-border);
                    border-radius: 7px;
                    color: var(--ui-hoverable-text);
                    font-family: 'Cascadia Code', Consolas, monospace;
                    font-size: 13px;
                    line-height: 20px;
                    min-height: 74px;
                    padding: 12px;
                    white-space: pre-wrap;
                  "
                >
                  {card.text}
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>

      <section
        aria-label="Prompts"
        style="
          border-left: 3px solid var(--ui-accent-blue-normal-border);
          box-sizing: border-box;
          display: grid;
          gap: 24px;
          min-width: 0;
          padding-left: 16px;
        "
      >
        <button
          type="button"
          aria-expanded={!isPromptsCollapsed}
          style={sectionButtonStyle('prompts-toggle')}
          onmouseenter={() => {
            hoveredId = 'prompts-toggle'
          }}
          onmouseleave={() => {
            hoveredId = null
          }}
          onclick={() => {
            isPromptsCollapsed = !isPromptsCollapsed
          }}
        >
          <span
            style="
              display: grid;
              gap: 6px;
              min-width: 0;
            "
          >
            <span
              style="
                align-items: center;
                display: flex;
                gap: 10px;
                min-width: 0;
              "
            >
              <span
                style="
                  align-items: center;
                  background: var(--ui-accent-blue-normal-surface);
                  border: 1px solid var(--ui-accent-blue-normal-border);
                  border-radius: var(--cthulhu-ui-radius-control);
                  color: var(--ui-accent-blue-icon-glyph);
                  display: inline-flex;
                  flex: 0 0 auto;
                  height: 32px;
                  justify-content: center;
                  width: 32px;
                "
              >
                <FileText size={17} strokeWidth={2.4} />
              </span>
              <span
                style="
                  color: var(--ui-normal-text);
                  font-size: 24px;
                  font-weight: 760;
                  line-height: 32px;
                  min-width: 0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                "
              >
                Prompts
              </span>
              {#if isPromptsCollapsed}
                <ChevronRight size={17} strokeWidth={2.6} />
              {:else}
                <ChevronDown size={17} strokeWidth={2.6} />
              {/if}
              <span style={countPillStyle}>
                {collapsedSummaryLabel(promptCards.length, 'prompt', 'prompts')}
              </span>
            </span>
            <span
              style="
                color: var(--ui-muted-text);
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;
                min-width: 0;
              "
            >
              Prompt cards saved in Product Engineering.
            </span>
          </span>
        </button>

        {#if !isPromptsCollapsed}
          <div
            style="
              align-items: center;
              display: flex;
              gap: 8px;
              justify-content: space-between;
              min-width: 0;
            "
          >
            <div
              style="
                align-items: center;
                background: var(--ui-neutral-muted-surface);
                border: 1px solid var(--ui-neutral-muted-border);
                border-radius: 7px;
                color: var(--ui-muted-text);
                display: grid;
                flex: 1 1 auto;
                gap: 8px;
                grid-template-columns: auto minmax(0, 1fr);
                max-width: 360px;
                min-width: 0;
                padding: 8px 10px;
              "
            >
              <Search size={15} strokeWidth={2.4} />
              <span style="font-size: 13px; font-weight: 600;">Find in folder</span>
            </div>
            <button
              type="button"
              style="
                align-items: center;
                background: var(--ui-accent-normal-surface);
                border: 1px solid var(--ui-accent-normal-border);
                border-radius: var(--cthulhu-ui-radius-control);
                color: var(--ui-accent-normal-text);
                cursor: pointer;
                display: inline-flex;
                flex: 0 0 auto;
                font: inherit;
                font-size: 13px;
                font-weight: 750;
                gap: 8px;
                height: 34px;
                padding: 0 12px;
                white-space: nowrap;
              "
            >
              <Plus size={15} strokeWidth={2.6} />
              Add Prompt
            </button>
          </div>

          <div style="display: grid; gap: 12px; min-width: 0;">
            {#each promptCards as prompt (prompt.id)}
              <article
                style={cardStyle(`prompt-${prompt.id}`)}
                onmouseenter={() => {
                  hoveredId = `prompt-${prompt.id}`
                }}
                onmouseleave={() => {
                  hoveredId = null
                }}
              >
                <div
                  style="
                    align-items: stretch;
                    display: grid;
                    gap: 10px;
                    grid-template-columns: 28px minmax(0, 1fr);
                    min-width: 0;
                  "
                >
                  <div
                    style="
                      align-items: center;
                      background: var(--ui-neutral-muted-surface);
                      border: 1px solid var(--ui-neutral-muted-border);
                      border-radius: 7px;
                      color: var(--ui-muted-text);
                      display: grid;
                      gap: 7px;
                      justify-items: center;
                      padding: 7px 0;
                    "
                  >
                    <button
                      type="button"
                      aria-label="Move prompt up"
                      style={iconButtonStyle(`up-${prompt.id}`)}
                      onmouseenter={() => {
                        hoveredId = `up-${prompt.id}`
                      }}
                      onmouseleave={() => {
                        hoveredId = null
                      }}
                    >
                      <ArrowUp size={14} strokeWidth={2.5} />
                    </button>
                    <GripVertical size={15} strokeWidth={2.4} />
                    <button
                      type="button"
                      aria-label="Move prompt down"
                      style={iconButtonStyle(`down-${prompt.id}`)}
                      onmouseenter={() => {
                        hoveredId = `down-${prompt.id}`
                      }}
                      onmouseleave={() => {
                        hoveredId = null
                      }}
                    >
                      <ArrowDown size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div style="display: grid; gap: 8px; min-width: 0;">
                    <div
                      style="
                        align-items: center;
                        background: var(--ui-neutral-muted-surface);
                        border: 1px solid var(--ui-card-nested-border);
                        border-radius: 7px;
                        display: grid;
                        gap: 12px;
                        grid-template-columns: minmax(0, 1fr) auto;
                        min-width: 0;
                        padding: 8px 8px 8px 10px;
                      "
                    >
                      <div
                        style="
                          align-items: center;
                          display: grid;
                          gap: 10px;
                          grid-template-columns: 40px minmax(0, 1fr);
                          min-width: 0;
                        "
                      >
                        <span
                          style="
                            align-items: center;
                            background: var(--ui-accent-normal-surface);
                            border: 1px solid var(--ui-accent-normal-border);
                            border-radius: var(--cthulhu-ui-radius-control);
                            color: var(--ui-accent-icon-glyph);
                            display: inline-flex;
                            height: 40px;
                            justify-content: center;
                            width: 40px;
                          "
                        >
                          <FileText size={18} strokeWidth={2.4} />
                        </span>
                        <div style="display: grid; gap: 4px; min-width: 0;">
                          <p
                            style="
                              color: var(--ui-normal-text);
                              font-size: 15px;
                              font-weight: 650;
                              line-height: 20px;
                              margin: 0;
                              overflow: hidden;
                              text-overflow: ellipsis;
                              white-space: nowrap;
                            "
                          >
                            {prompt.title}
                          </p>
                          <div
                            style="
                              align-items: center;
                              color: var(--ui-muted-text);
                              display: flex;
                              font-size: 11px;
                              font-weight: 750;
                              gap: 7px;
                              line-height: 16px;
                              min-width: 0;
                              overflow: hidden;
                              white-space: nowrap;
                            "
                          >
                            <span
                              style="
                                align-items: center;
                                color: var(--ui-secondary-text);
                                display: inline-flex;
                                gap: 5px;
                                min-width: 0;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                              "
                            >
                              <Folder size={12} strokeWidth={2.4} />
                              {prompt.folder}
                            </span>
                            <span
                              style="
                                background: var(--ui-neutral-emphasis-border);
                                border-radius: 999px;
                                flex: 0 0 auto;
                                height: 3px;
                                width: 3px;
                              "
                            ></span>
                            <span>{lineLabel(prompt.lines)}</span>
                            <span
                              style="
                                background: var(--ui-neutral-emphasis-border);
                                border-radius: 999px;
                                flex: 0 0 auto;
                                height: 3px;
                                width: 3px;
                              "
                            ></span>
                            <span>{tokenLabel(prompt.tokens)}</span>
                            <span
                              style="
                                background: var(--ui-neutral-emphasis-border);
                                border-radius: 999px;
                                flex: 0 0 auto;
                                height: 3px;
                                width: 3px;
                              "
                            ></span>
                            <span>{prompt.updated}</span>
                          </div>
                        </div>
                      </div>

                      <div style="align-items: center; display: inline-flex; gap: 7px;">
                        <button
                          type="button"
                          aria-label={`Copy ${prompt.title}`}
                          title={`Copy ${prompt.title}`}
                          style={iconButtonStyle(`prompt-copy-${prompt.id}`)}
                          onmouseenter={() => {
                            hoveredId = `prompt-copy-${prompt.id}`
                          }}
                          onmouseleave={() => {
                            hoveredId = null
                          }}
                        >
                          <Copy size={15} strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          aria-label={`More actions for ${prompt.title}`}
                          title={`More actions for ${prompt.title}`}
                          style={iconButtonStyle(`more-${prompt.id}`)}
                          onmouseenter={() => {
                            hoveredId = `more-${prompt.id}`
                          }}
                          onmouseleave={() => {
                            hoveredId = null
                          }}
                        >
                          <MoreVertical size={15} strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${prompt.title}`}
                          title={`Delete ${prompt.title}`}
                          style={iconButtonStyle(`delete-${prompt.id}`, 'danger')}
                          onmouseenter={() => {
                            hoveredId = `delete-${prompt.id}`
                          }}
                          onmouseleave={() => {
                            hoveredId = null
                          }}
                        >
                          <Trash2 size={15} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>

                    <div
                      style="
                        background: var(--ui-neutral-field-surface);
                        border: 1px solid var(--ui-neutral-muted-border);
                        border-radius: 7px;
                        color: var(--ui-hoverable-text);
                        font-family: 'Cascadia Code', Consolas, monospace;
                        font-size: 13px;
                        line-height: 20px;
                        min-height: 76px;
                        padding: 12px;
                        white-space: pre-wrap;
                      "
                    >
                      {prompt.text}
                    </div>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</main>
