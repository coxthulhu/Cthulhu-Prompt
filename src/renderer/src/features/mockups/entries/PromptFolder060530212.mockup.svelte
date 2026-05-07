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
    Trash2
  } from 'lucide-svelte'

  type PromptMockup = {
    title: string
    lines: string
    tokens: string
    updated: string
    body: string[]
  }

  const prompts: PromptMockup[] = [
    {
      title: 'System Prompt - Svelte Refactor',
      lines: '24 lines',
      tokens: '782 tokens',
      updated: '3 min ago',
      body: [
        'You are working in the renderer process of Cthulhu Prompt.',
        'Prefer Svelte 5 runes, keep components narrow, and preserve existing keyboard flows.',
        'Before editing, inspect the closest component and its test coverage.'
      ]
    },
    {
      title: 'Review Checklist',
      lines: '18 lines',
      tokens: '501 tokens',
      updated: '12 min ago',
      body: [
        'Start with behavior risks, then call out missing tests.',
        'Reference exact files and line numbers.',
        'Keep summaries short and place them after findings.'
      ]
    }
  ]

  const descriptionLines = [
    'Reusable prompts for renderer work, code review, and release cleanup.',
    'Keep the folder focused on prompts that are safe to copy directly into coding agents.'
  ]
</script>

<main
  style="
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: grid;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    gap: 0;
    min-width: 0;
    width: 100%;
  "
>
  <div
    style="
      align-items: center;
      border-bottom: 1px solid var(--ui-neutral-muted-border);
      box-sizing: border-box;
      display: flex;
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
          color: var(--ui-muted-text);
          cursor: pointer;
          font: inherit;
          min-width: 0;
          overflow: hidden;
          padding: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        "
      >
        Coding Prompts
      </button>
      <span style="color: oklch(1 0 0 / 28%); padding: 0 12px;">/</span>
      <button
        type="button"
        style="
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--ui-hoverable-text);
          cursor: pointer;
          font: inherit;
          padding: 0;
          white-space: nowrap;
        "
      >
        Prompts
      </button>
    </div>
  </div>

  <div
    style="
      box-sizing: border-box;
      display: grid;
      gap: 26px;
      margin: 0 auto;
      max-width: 1060px;
      min-width: 0;
      padding: 24px 24px 72px;
      width: 100%;
    "
  >
    <section
      aria-labelledby="folder-settings-heading"
      style="
        box-sizing: border-box;
        display: grid;
        gap: 18px;
        min-width: 0;
        position: relative;
      "
    >
      <div
        style="
          align-items: end;
          border-bottom: 1px solid oklch(0.69 0.12 185 / 28%);
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
          padding: 0 0 12px;
        "
      >
        <div style="display: grid; gap: 7px; min-width: 0;">
          <div
            style="
              align-items: center;
              display: flex;
              gap: 9px;
              min-width: 0;
            "
          >
            <span
              style="
                background: oklch(0.69 0.12 185 / 26%);
                border: 1px solid oklch(0.78 0.11 178 / 42%);
                border-radius: 999px;
                box-shadow: 0 0 0 3px oklch(0.69 0.12 185 / 7%);
                display: inline-block;
                height: 8px;
                width: 8px;
              "
            ></span>
            <h1
              id="folder-settings-heading"
              style="
                color: var(--ui-normal-text);
                font-size: 24px;
                font-weight: 750;
                letter-spacing: 0;
                line-height: 32px;
                margin: 0;
              "
            >
              Folder Settings
            </h1>
          </div>
          <p
            style="
              color: var(--ui-muted-text);
              font-size: 14px;
              line-height: 20px;
              margin: 0;
            "
          >
            Settings that only affect prompts in this folder, and are saved to the workspace.
          </p>
        </div>
        <span
          style="
            align-items: center;
            background: oklch(0.69 0.12 185 / 12%);
            border: 1px solid oklch(0.78 0.11 178 / 28%);
            border-radius: 999px;
            color: oklch(0.91 0.04 180);
            display: inline-flex;
            font-size: 12px;
            font-weight: 750;
            height: 28px;
            padding: 0 12px;
            white-space: nowrap;
          "
        >
          Workspace
        </span>
      </div>

      <article
        style="
          align-items: stretch;
          background: linear-gradient(
            180deg,
            var(--ui-card-normal-surface-gradient-start),
            var(--ui-card-normal-surface-gradient-end)
          );
          border: 1px solid var(--ui-card-normal-border);
          border-radius: 8px;
          box-shadow:
            0 18px 44px var(--ui-card-normal-shadow),
            inset 0 1px 0 var(--ui-card-nested-inset-highlight);
          box-sizing: border-box;
          display: grid;
          gap: 10px;
          min-width: 0;
          padding: 10px;
        "
      >
        <div style="display: grid; gap: 8px; min-width: 0;">
          <div
            style="
              align-items: center;
              background: var(--ui-neutral-muted-surface);
              border: 1px solid var(--ui-card-nested-border);
              border-radius: 7px;
              box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
              box-sizing: border-box;
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
                  border-radius: 7px;
                  box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
                  display: inline-flex;
                  height: 38px;
                  justify-content: center;
                  width: 38px;
                "
              >
                <Folder style="height: 18px; width: 18px; color: var(--ui-accent-icon-glyph);" />
              </span>
              <div style="display: grid; gap: 4px; min-width: 0;">
                <p
                  style="
                    color: var(--ui-normal-text);
                    font-size: 15px;
                    font-weight: 700;
                    line-height: 20px;
                    margin: 0;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  "
                >
                  Folder Description
                </p>
                <div
                  style="
                    align-items: center;
                    color: var(--ui-muted-text);
                    display: flex;
                    flex-wrap: nowrap;
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
                    title="Folder Settings"
                    style="
                      align-items: center;
                      color: var(--ui-secondary-text);
                      display: inline-flex;
                      flex: 0 1 auto;
                      gap: 5px;
                      max-width: 220px;
                      min-width: 0;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    "
                  >
                    <Folder style="height: 12px; width: 12px; flex: 0 0 auto;" />
                    Folder Settings
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
                  <span>0 lines</span>
                  <span
                    style="
                      background: var(--ui-neutral-emphasis-border);
                      border-radius: 999px;
                      flex: 0 0 auto;
                      height: 3px;
                      width: 3px;
                    "
                  ></span>
                  <span>0 tokens</span>
                  <span
                    style="
                      background: var(--ui-neutral-emphasis-border);
                      border-radius: 999px;
                      flex: 0 0 auto;
                      height: 3px;
                      width: 3px;
                    "
                  ></span>
                  <span>0 min ago</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              title="Copy folder description"
              aria-label="Copy folder description"
              style="
                align-items: center;
                appearance: none;
                background: var(--ui-accent-normal-surface);
                border: 1px solid var(--ui-accent-normal-border);
                border-radius: 6px;
                color: var(--ui-accent-icon-glyph);
                cursor: pointer;
                display: inline-flex;
                height: 30px;
                justify-content: center;
                padding: 0;
                width: 30px;
              "
            >
              <Copy style="height: 15px; width: 15px;" />
            </button>
          </div>

          <div
            style="
              background: var(--ui-neutral-field-surface);
              border: 1px solid var(--ui-card-nested-border);
              border-radius: 7px;
              box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
              box-sizing: border-box;
              color: var(--ui-secondary-text);
              display: grid;
              font-family: 'Cascadia Code', Consolas, monospace;
              font-size: 13px;
              gap: 7px;
              line-height: 20px;
              min-height: 108px;
              padding: 13px 14px;
            "
          >
            {#each descriptionLines as line (line)}
              <p style="margin: 0;">{line}</p>
            {/each}
          </div>
        </div>
      </article>
    </section>

    <section
      aria-labelledby="prompts-heading"
      style="
        box-sizing: border-box;
        display: grid;
        gap: 14px;
        min-width: 0;
      "
    >
      <div
        style="
          align-items: center;
          border-bottom: 1px solid oklch(0.76 0.16 84 / 24%);
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
          padding: 3px 0 12px;
        "
      >
        <div
          style="
            align-items: center;
            display: flex;
            gap: 10px;
            min-width: 0;
          "
        >
          <span
            style="
              background: oklch(0.76 0.16 84 / 24%);
              border: 1px solid oklch(0.86 0.14 88 / 38%);
              border-radius: 999px;
              box-shadow: 0 0 0 3px oklch(0.76 0.16 84 / 7%);
              display: inline-block;
              height: 8px;
              width: 8px;
            "
          ></span>
          <h2
            id="prompts-heading"
            style="
              color: var(--ui-normal-text);
              font-size: 24px;
              font-weight: 750;
              letter-spacing: 0;
              line-height: 32px;
              margin: 0;
            "
          >
            Prompts
          </h2>
        </div>
        <span
          style="
            align-items: center;
            background: oklch(0.76 0.16 84 / 10%);
            border: 1px solid oklch(0.86 0.14 88 / 28%);
            border-radius: 999px;
            color: oklch(0.95 0.05 92);
            display: inline-flex;
            font-size: 12px;
            font-weight: 750;
            height: 28px;
            padding: 0 12px;
            white-space: nowrap;
          "
        >
          2 prompts
        </span>
      </div>

      {@render addRow(null)}

      {#each prompts as prompt, index (prompt.title)}
        {@render promptCard(prompt, index)}
        {@render addRow(prompt.title)}
      {/each}
    </section>
  </div>
</main>

{#snippet addRow(previousTitle: string | null)}
  <div
    aria-label={previousTitle ? `Add after ${previousTitle}` : 'Add at top'}
    style="
      align-items: center;
      box-sizing: border-box;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(36px, 1fr) auto minmax(36px, 1fr);
      min-width: 0;
    "
  >
    <span
      style="
        background: linear-gradient(90deg, transparent, oklch(1 0 0 / 13%));
        display: block;
        height: 1px;
      "
    ></span>
    <div
      style="
        align-items: center;
        background: oklch(0.19 0.025 248 / 72%);
        border: 1px solid oklch(1 0 0 / 11%);
        border-radius: 999px;
        box-shadow:
          0 10px 28px oklch(0 0 0 / 18%),
          inset 0 1px 0 oklch(1 0 0 / 8%);
        display: flex;
        gap: 3px;
        padding: 3px;
      "
    >
      <button
        type="button"
        style="
          align-items: center;
          appearance: none;
          background: var(--ui-neutral-normal-surface);
          border: 1px solid var(--ui-neutral-normal-border);
          border-radius: 999px;
          color: var(--ui-hoverable-text);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          gap: 6px;
          height: 28px;
          padding: 0 11px;
          white-space: nowrap;
        "
      >
        <Plus style="height: 14px; width: 14px; stroke-width: 3;" />
        Prompt
      </button>
      <button
        type="button"
        style="
          align-items: center;
          appearance: none;
          background: oklch(0.64 0.12 185 / 16%);
          border: 1px solid oklch(0.78 0.11 178 / 34%);
          border-radius: 999px;
          color: oklch(0.93 0.04 180);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          gap: 6px;
          height: 28px;
          padding: 0 11px;
          white-space: nowrap;
        "
      >
        <FolderPlus style="height: 14px; width: 14px; stroke-width: 2.6;" />
        Subfolder
      </button>
    </div>
    <span
      style="
        background: linear-gradient(90deg, oklch(1 0 0 / 13%), transparent);
        display: block;
        height: 1px;
      "
    ></span>
  </div>
{/snippet}

{#snippet promptCard(prompt: PromptMockup, index: number)}
  {@const isFirstPrompt = index === 0}
  {@const isLastPrompt = index === prompts.length - 1}
  <article
    style="
      align-items: stretch;
      background: linear-gradient(
        180deg,
        var(--ui-card-normal-surface-gradient-start),
        var(--ui-card-normal-surface-gradient-end)
      );
      border: 1px solid var(--ui-card-normal-border);
      border-radius: 8px;
      box-shadow:
        0 18px 44px var(--ui-card-normal-shadow),
        inset 0 1px 0 var(--ui-card-nested-inset-highlight);
      box-sizing: border-box;
      display: grid;
      gap: 10px;
      grid-template-columns: 34px minmax(0, 1fr);
      min-height: 238px;
      min-width: 0;
      padding: 10px;
    "
  >
    <div
      style="
        display: grid;
        flex: 0 0 34px;
        gap: 6px;
        grid-template-rows: 32px minmax(0, 1fr) 32px;
        height: 100%;
        min-height: 136px;
        width: 34px;
      "
    >
      <button
        type="button"
        aria-label="Move prompt up"
        disabled={isFirstPrompt}
        style={`align-items: center; appearance: none; background: var(--ui-neutral-muted-surface); border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; color: var(--ui-secondary-text); cursor: pointer; display: inline-flex; height: 32px; justify-content: center; opacity: ${
          isFirstPrompt ? '0.42' : '1'
        }; padding: 0; width: 34px;`}
      >
        <ChevronUp style="height: 16px; width: 16px;" />
      </button>
      <button
        type="button"
        aria-label="Drag prompt"
        style="
          align-items: center;
          appearance: none;
          background: var(--ui-neutral-muted-surface);
          border: 1px solid var(--ui-neutral-muted-border);
          border-radius: 6px;
          color: var(--ui-secondary-text);
          cursor: grab;
          display: inline-flex;
          justify-content: center;
          min-height: 0;
          padding: 0;
          width: 34px;
        "
      >
        <GripVertical style="height: 17px; width: 17px; stroke-width: 2.5;" />
      </button>
      <button
        type="button"
        aria-label="Move prompt down"
        disabled={isLastPrompt}
        style={`align-items: center; appearance: none; background: var(--ui-neutral-muted-surface); border: 1px solid var(--ui-neutral-muted-border); border-radius: 6px; color: var(--ui-secondary-text); cursor: pointer; display: inline-flex; height: 32px; justify-content: center; opacity: ${
          isLastPrompt ? '0.42' : '1'
        }; padding: 0; width: 34px;`}
      >
        <ChevronDown style="height: 16px; width: 16px;" />
      </button>
    </div>

    <div
      style="
        align-content: start;
        display: grid;
        gap: 8px;
        grid-template-rows: auto auto;
        min-width: 0;
      "
    >
      <div
        style="
          align-items: center;
          background: var(--ui-neutral-muted-surface);
          border: 1px solid var(--ui-card-nested-border);
          border-radius: 7px;
          box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
          box-sizing: border-box;
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
              border-radius: 7px;
              box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
              display: inline-flex;
              height: 38px;
              justify-content: center;
              width: 38px;
            "
          >
            <FileText style="height: 18px; width: 18px; color: var(--ui-accent-icon-glyph);" />
          </span>
          <div style="display: grid; gap: 4px; min-width: 0;">
            <p
              style="
                color: var(--ui-normal-text);
                font-size: 15px;
                font-weight: 700;
                line-height: 20px;
                margin: 0;
                min-width: 0;
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
                flex-wrap: nowrap;
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
                title="Prompts"
                style="
                  align-items: center;
                  color: var(--ui-secondary-text);
                  display: inline-flex;
                  flex: 0 1 auto;
                  gap: 5px;
                  max-width: 220px;
                  min-width: 0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                "
              >
                <Folder style="height: 12px; width: 12px; flex: 0 0 auto;" />
                Prompts
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
              <span>{prompt.lines}</span>
              <span
                style="
                  background: var(--ui-neutral-emphasis-border);
                  border-radius: 999px;
                  flex: 0 0 auto;
                  height: 3px;
                  width: 3px;
                "
              ></span>
              <span>{prompt.tokens}</span>
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
        <div style="align-items: center; display: flex; flex: 0 0 auto; gap: 6px;">
          <button
            type="button"
            title="Copy prompt"
            aria-label="Copy prompt"
            style="
              align-items: center;
              appearance: none;
              background: var(--ui-accent-normal-surface);
              border: 1px solid var(--ui-accent-normal-border);
              border-radius: 6px;
              color: var(--ui-accent-icon-glyph);
              cursor: pointer;
              display: inline-flex;
              height: 30px;
              justify-content: center;
              padding: 0;
              width: 30px;
            "
          >
            <Copy style="height: 15px; width: 15px;" />
          </button>
          <button
            type="button"
            title="Delete prompt"
            aria-label="Delete prompt"
            style="
              align-items: center;
              appearance: none;
              background: var(--ui-danger-icon-surface);
              border: 1px solid var(--ui-danger-normal-border);
              border-radius: 6px;
              color: var(--ui-danger-icon-glyph);
              cursor: pointer;
              display: inline-flex;
              height: 30px;
              justify-content: center;
              padding: 0;
              width: 30px;
            "
          >
            <Trash2 style="height: 15px; width: 15px;" />
          </button>
        </div>
      </div>

      <div
        style="
          background: var(--ui-neutral-field-surface);
          border: 1px solid var(--ui-card-nested-border);
          border-radius: 7px;
          box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
          box-sizing: border-box;
          color: var(--ui-secondary-text);
          display: grid;
          font-family: 'Cascadia Code', Consolas, monospace;
          font-size: 13px;
          gap: 7px;
          line-height: 20px;
          min-height: 136px;
          padding: 13px 14px;
        "
      >
        {#each prompt.body as line (line)}
          <p style="margin: 0;">{line}</p>
        {/each}
      </div>
    </div>
  </article>
{/snippet}
