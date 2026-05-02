<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    GripVertical,
    Trash2
  } from 'lucide-svelte'

  const promptFolderName = 'Prompts'

  const prompts = [
    {
      id: 'architecture-review',
      title: 'Architecture Review',
      lines: 9,
      tokens: '186',
      age: '2 min ago',
      text: [
        'Review this feature for architectural risk before implementation.',
        '',
        'Focus on module boundaries, persistence behavior, and whether the plan fits the existing Svelte 5 patterns.',
        '',
        'Return concrete findings first, then a concise implementation recommendation.'
      ]
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      lines: 7,
      tokens: '142',
      age: '18 min ago',
      text: [
        'Make the requested change directly in the repository.',
        '',
        'Keep edits narrow, preserve existing conventions, and add focused tests for behavior that could regress.',
        '',
        'Afterward, run the relevant validation commands and summarize the result.'
      ]
    },
    {
      id: 'playwright-repro',
      title: 'Playwright Repro',
      lines: 8,
      tokens: '171',
      age: '35 min ago',
      text: [
        'Create a Playwright test that reproduces the current prompt folder workflow.',
        '',
        'Use createPlaywrightTestSuite, a minimal workspace, and data-testid selectors.',
        '',
        'Keep the assertion centered on the user-visible behavior.'
      ]
    },
    {
      id: 'release-note',
      title: 'Release Note Draft',
      lines: 5,
      tokens: '96',
      age: '1 hr ago',
      text: [
        'Write a short release note for this change.',
        '',
        'Mention the workflow improvement, the affected screen, and any migration-free behavior users should expect.'
      ]
    }
  ]
</script>

<main class="prompt-folder-mockup" data-testid="prompt-folder-screen">
  <div class="prompt-editor-stack">
    {#each prompts as prompt, index (prompt.id)}
      {@render promptEditor(prompt, index)}
    {/each}
  </div>
</main>

{#snippet promptEditor(prompt, index)}
  <article class="prompt-editor-row" data-testid={`prompt-editor-${prompt.id}`}>
    <aside class="prompt-editor-sidebar" aria-label={`${prompt.title} ordering controls`}>
      <button type="button" class="rail-button" aria-label="Move prompt up" disabled={index === 0}>
        <ChevronUp size={15} strokeWidth={2.35} />
      </button>
      <button type="button" class="rail-button rail-button-fill" aria-label="Drag prompt">
        <GripVertical size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        class="rail-button"
        aria-label="Move prompt down"
        disabled={index === prompts.length - 1}
      >
        <ChevronDown size={15} strokeWidth={2.35} />
      </button>
    </aside>

    <div class="prompt-editor-body">
      <div class="prompt-editor-title-bar">
        <div class="prompt-editor-title-main">
          <div class="prompt-icon">
            <FileText size={18} strokeWidth={2.25} />
          </div>

          <div class="prompt-title-copy">
            <input class="prompt-title-input" value={prompt.title} aria-label="Prompt title" />
            <div class="prompt-metadata-row">
              <span class="prompt-metadata-folder">
                <Folder size={12} strokeWidth={2.4} />
                {promptFolderName}
              </span>
              <span class="prompt-metadata-dot"></span>
              <span>{prompt.lines} lines</span>
              <span class="prompt-metadata-dot"></span>
              <span>{prompt.tokens} tokens</span>
              <span class="prompt-metadata-dot"></span>
              <span>{prompt.age}</span>
            </div>
          </div>
        </div>

        <div class="prompt-editor-buttons" aria-label={`${prompt.title} actions`}>
          <button type="button" class="icon-button" aria-label="Copy prompt">
            <Copy size={14} strokeWidth={2.3} />
          </button>
          <button type="button" class="icon-button danger-button" aria-label="Delete prompt">
            <Trash2 size={14} strokeWidth={2.3} />
          </button>
        </div>
      </div>

      <div class="prompt-editor-text" aria-label={`${prompt.title} text`}>
        {#each prompt.text as line, lineIndex (`${prompt.id}-${lineIndex}`)}
          <p class:empty-line={line.length === 0}>{line}</p>
        {/each}
      </div>
    </div>
  </article>
{/snippet}

<style>
  .prompt-folder-mockup {
    box-sizing: border-box;
    color: var(--ui-normal-text);
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    min-height: 42rem;
    min-width: 0;
    padding: 0;
    width: 100%;
  }

  .prompt-editor-stack {
    display: grid;
    gap: 0.75rem;
    max-width: 58rem;
    min-width: 0;
  }

  .icon-button,
  .rail-button {
    appearance: none;
    align-items: center;
    border: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    cursor: default;
    display: inline-flex;
    justify-content: center;
  }

  .prompt-icon {
    align-items: center;
    background: var(--ui-accent-icon-surface);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: 7px;
    color: var(--ui-accent-icon-glyph);
    display: inline-flex;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .prompt-editor-row {
    align-items: stretch;
    backdrop-filter: blur(18px);
    background: linear-gradient(
      180deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    border: 1px solid var(--ui-card-normal-border);
    border-radius: 8px;
    box-shadow: 0 16px 34px var(--ui-card-normal-shadow);
    box-sizing: border-box;
    display: grid;
    gap: 10px;
    grid-template-columns: 34px minmax(0, 1fr);
    min-height: 11.25rem;
    min-width: 0;
    padding: 10px;
  }

  .prompt-editor-sidebar {
    display: grid;
    gap: 6px;
    grid-template-rows: 32px minmax(0, 1fr) 32px;
    min-height: 136px;
    width: 34px;
  }

  .rail-button {
    background: var(--ui-neutral-muted-surface);
    border-radius: 6px;
    min-height: 32px;
    padding: 0;
    width: 34px;
  }

  .rail-button-fill {
    height: 100%;
  }

  .rail-button:disabled {
    color: var(--ui-muted-text);
    opacity: 0.45;
  }

  .prompt-editor-body {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-template-rows: auto auto;
    min-width: 0;
  }

  .prompt-editor-title-bar {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 7px;
    box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    padding: 8px 8px 8px 10px;
  }

  .prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
  }

  .prompt-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .prompt-title-input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    height: 22px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .prompt-metadata-row {
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
  }

  .prompt-metadata-folder {
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
  }

  .prompt-metadata-dot {
    background: var(--ui-neutral-emphasis-border);
    border-radius: 999px;
    flex: 0 0 auto;
    height: 3px;
    width: 3px;
  }

  .prompt-editor-buttons {
    display: flex;
    gap: 0.4rem;
  }

  .icon-button {
    background: var(--ui-neutral-muted-surface);
    border-radius: 6px;
    height: 30px;
    padding: 0;
    width: 30px;
  }

  .danger-button {
    border-color: var(--ui-danger-normal-border);
    color: var(--ui-danger-icon-glyph);
  }

  .prompt-editor-text {
    background: var(--ui-neutral-field-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 7px;
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.45;
    min-height: 6rem;
    overflow: hidden;
    padding: 0.75rem;
  }

  .prompt-editor-text p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-editor-text .empty-line {
    min-height: 1.45em;
  }

  @media (max-width: 760px) {
    .prompt-editor-title-bar {
      align-items: stretch;
      grid-template-columns: minmax(0, 1fr);
    }

    .prompt-editor-buttons {
      justify-self: end;
    }
  }
</style>
