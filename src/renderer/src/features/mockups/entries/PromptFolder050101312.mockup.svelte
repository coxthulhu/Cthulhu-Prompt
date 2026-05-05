<script lang="ts">
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import PromptEditorTitleBar from '@renderer/features/prompt-editor/PromptEditorTitleBar.svelte'
  import { FileText, Folder, FolderPlus, Plus, Settings } from 'lucide-svelte'

  type MockupPrompt = {
    id: string
    title: string
    text: string
    monacoHeightPx: number
  }

  const MOCKUP_BODY_FIND_SECTION_KEY = 'mockup-prompt-body'
  const DEFAULT_MONACO_HEIGHT_PX = 126
  const PROMPT_FOLDER_ID = 'mockup-prompt-folder'

  let editorContainerWidthPx = $state(0)
  let monacoOverflowHost = $state<HTMLDivElement | null>(null)
  let folderDescription = $state(
    [
      'Prompts for day-to-day coding work. Keep the rows focused on review, implementation, tests, and release notes.',
      '',
      'Use the folder when the task needs careful repository changes and concise handoff notes.'
    ].join('\n')
  )

  let prompts = $state<MockupPrompt[]>([
    {
      id: 'architecture-review',
      title: 'Architecture Review',
      text: [
        'Review this feature for architectural risk before implementation.',
        '',
        'Focus on module boundaries, persistence behavior, and whether the plan fits the existing Svelte 5 patterns.',
        '',
        'Return concrete findings first, then a concise implementation recommendation.'
      ].join('\n'),
      monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
    },
    {
      id: 'implementation-pass',
      title: 'Implementation Pass',
      text: [
        'Make the requested change directly in the repository.',
        '',
        'Keep edits narrow, preserve existing conventions, and add focused tests for behavior that could regress.',
        '',
        'Afterward, run the relevant validation commands and summarize the result.'
      ].join('\n'),
      monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
    },
    {
      id: 'playwright-repro',
      title: 'Playwright Repro',
      text: [
        'Create a Playwright test that reproduces the current prompt folder workflow.',
        '',
        'Use createPlaywrightTestSuite, a minimal workspace, and data-testid selectors.',
        '',
        'Keep the assertion centered on the user-visible behavior.'
      ].join('\n'),
      monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
    },
    {
      id: 'release-note',
      title: 'Release Note Draft',
      text: [
        'Write a short release note for this change.',
        '',
        'Mention the workflow improvement, the affected screen, and any migration-free behavior users should expect.'
      ].join('\n'),
      monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
    }
  ])

  const movePrompt = (fromIndex: number, toIndex: number): void => {
    if (toIndex < 0 || toIndex >= prompts.length) return
    const nextPrompts = [...prompts]
    const [prompt] = nextPrompts.splice(fromIndex, 1)
    nextPrompts.splice(toIndex, 0, prompt)
    prompts = nextPrompts
  }

  const deletePrompt = (promptId: string): void => {
    prompts = prompts.filter((prompt) => prompt.id !== promptId)
  }

  const noop = (): void => {}

  const styles = {
    screen:
      'box-sizing:border-box;color:var(--ui-normal-text);font-family:Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;min-height:42rem;min-width:0;padding:0;width:100%;',
    topBar:
      'align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);box-sizing:border-box;display:flex;gap:12px;height:42px;min-width:0;padding:0 24px;',
    crumbMuted:
      'background:transparent;border:0;color:var(--ui-muted-text);cursor:pointer;font:inherit;font-size:13px;font-weight:650;min-width:0;overflow:hidden;padding:0;text-overflow:ellipsis;white-space:nowrap;',
    crumbDivider: 'color:var(--ui-neutral-emphasis-border);font-size:14px;font-weight:700;',
    crumbActive:
      'background:transparent;border:0;color:var(--ui-normal-text);cursor:pointer;font:inherit;font-size:13px;font-weight:750;padding:0;white-space:nowrap;',
    content:
      'box-sizing:border-box;display:grid;gap:18px;min-width:0;padding:22px 24px 32px;width:100%;',
    sectionShell:
      'box-sizing:border-box;display:grid;gap:12px;min-width:0;width:100%;',
    sectionHeader:
      'align-items:center;display:flex;gap:10px;justify-content:space-between;min-width:0;padding:0 2px;',
    sectionTitleGroup:
      'align-items:center;display:flex;gap:10px;min-width:0;',
    sectionIcon:
      'align-items:center;background:linear-gradient(180deg,oklch(1 0 0 / 12%),oklch(1 0 0 / 4%));border:1px solid var(--ui-neutral-normal-border);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-secondary-text);display:inline-flex;height:32px;justify-content:center;width:32px;',
    sectionTitle:
      'color:var(--ui-normal-text);font-size:22px;font-weight:800;letter-spacing:0;line-height:26px;margin:0;',
    sectionMeta:
      'color:var(--ui-muted-text);font-size:12px;font-weight:750;line-height:16px;white-space:nowrap;',
    settingsPanel:
      'backdrop-filter:blur(18px);background:linear-gradient(180deg,oklch(1 0 0 / 7%),oklch(1 0 0 / 2%));border:1px solid var(--ui-card-normal-border);border-radius:8px;box-shadow:0 18px 40px var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-card-nested-inset-highlight);box-sizing:border-box;display:grid;gap:10px;min-width:0;padding:10px;',
    descriptionToolbar:
      'align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:grid;gap:10px;grid-template-columns:40px minmax(0, 1fr);min-width:0;padding:8px 10px;',
    descriptionIcon:
      'align-items:center;background:var(--ui-accent-icon-surface);border:1px solid var(--ui-accent-icon-ring);border-radius:7px;color:var(--ui-accent-icon-glyph);display:flex;height:40px;justify-content:center;width:40px;',
    descriptionTitle:
      'color:var(--ui-normal-text);font-size:15px;font-weight:700;line-height:20px;margin:0;',
    descriptionMetaRow:
      'align-items:center;color:var(--ui-muted-text);display:flex;flex-wrap:nowrap;font-size:11px;font-weight:750;gap:7px;line-height:16px;margin:4px 0 0;min-width:0;overflow:hidden;white-space:nowrap;',
    descriptionMetaFolder:
      'align-items:center;color:var(--ui-secondary-text);display:inline-flex;flex:0 1 auto;gap:5px;max-width:220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    descriptionMetaDot:
      'background:var(--ui-neutral-emphasis-border);border-radius:999px;flex:0 0 auto;height:3px;width:3px;',
    descriptionField:
      'background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);box-sizing:border-box;color:var(--ui-normal-text);font:500 13px/20px Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;min-height:116px;outline:none;padding:12px;resize:vertical;width:100%;',
    promptStack:
      'display:grid;gap:0;min-width:0;width:100%;',
    insertRow:
      'align-items:center;display:grid;gap:10px;grid-template-columns:minmax(16px, 1fr) auto auto minmax(16px, 1fr);height:42px;min-width:0;',
    insertLine:
      'background:linear-gradient(90deg,transparent,var(--ui-neutral-normal-border),transparent);height:1px;min-width:0;',
    insertButton:
      'align-items:center;background:linear-gradient(180deg,oklch(1 0 0 / 8%),oklch(1 0 0 / 3%));border:1px solid var(--ui-neutral-normal-border);border-radius:7px;box-shadow:0 8px 18px oklch(0 0 0 / 16%),inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-secondary-text);cursor:pointer;display:inline-flex;font:750 12px/16px Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;gap:7px;height:28px;padding:0 10px;white-space:nowrap;',
    promptRow:
      'align-items:stretch;backdrop-filter:blur(18px);background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));border:1px solid var(--ui-card-normal-border);border-radius:8px;box-shadow:0 16px 34px var(--ui-card-normal-shadow);box-sizing:border-box;display:grid;gap:10px;grid-template-columns:34px minmax(0, 1fr);min-height:11.25rem;min-width:0;padding:10px;',
    promptBody:
      'align-content:start;display:grid;gap:8px;grid-template-rows:auto auto;min-width:0;',
    monacoShell: 'box-sizing:border-box;min-height:6rem;width:100%;',
    overflowHost: 'inset:0;pointer-events:none;position:fixed;z-index:20;'
  }
</script>

<main style={styles.screen} data-testid="prompt-folder-screen">
  <div style={styles.topBar}>
    <button type="button" style={styles.crumbMuted}>Coding Workflow Prompts</button>
    <span style={styles.crumbDivider}>/</span>
    <button type="button" style={styles.crumbActive}>Folder Settings</button>
  </div>

  <div style={styles.content}>
    <section style={styles.sectionShell}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleGroup}>
          <span style={styles.sectionIcon}>
            <Settings size={17} strokeWidth={2.4} />
          </span>
          <h1 style={styles.sectionTitle}>Folder Settings</h1>
        </div>
      </div>

      <div style={styles.settingsPanel}>
        <div style={styles.descriptionToolbar}>
          <span style={styles.descriptionIcon}>
            <Folder size={18} strokeWidth={2.4} />
          </span>
          <div style="min-width:0;">
            <p style={styles.descriptionTitle}>Folder Description</p>
            <div style={styles.descriptionMetaRow}>
              <span style={styles.descriptionMetaFolder}>
                <Folder size={12} strokeWidth={2.4} />
                Folder Settings
              </span>
              <span style={styles.descriptionMetaDot}></span>
              <span>0 lines</span>
              <span style={styles.descriptionMetaDot}></span>
              <span>0 tokens</span>
              <span style={styles.descriptionMetaDot}></span>
              <span>0 min ago</span>
            </div>
          </div>
        </div>
        <textarea
          aria-label="Folder Description"
          style={styles.descriptionField}
          bind:value={folderDescription}
        ></textarea>
      </div>
    </section>

    <section style={styles.sectionShell}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleGroup}>
          <span style={styles.sectionIcon}>
            <FileText size={17} strokeWidth={2.4} />
          </span>
          <h2 style={styles.sectionTitle}>Prompts</h2>
        </div>
        <span style={styles.sectionMeta}>{prompts.length} prompts</span>
      </div>

      <div style={styles.promptStack} bind:clientWidth={editorContainerWidthPx}>
        {@render insertRow('initial')}
        {#each prompts as prompt, index (prompt.id)}
          {@render promptEditor(prompt, index)}
          {@render insertRow(prompt.id)}
        {/each}
      </div>
    </section>
  </div>

  <div bind:this={monacoOverflowHost} style={styles.overflowHost}></div>
</main>

{#snippet insertRow(rowId: string)}
  <div style={styles.insertRow} data-testid={`mockup-add-row-${rowId}`}>
    <span style={styles.insertLine}></span>
    <button type="button" style={styles.insertButton} onclick={noop}>
      <Plus size={14} strokeWidth={2.8} />
      Prompt
    </button>
    <button type="button" style={styles.insertButton} onclick={noop}>
      <FolderPlus size={14} strokeWidth={2.6} />
      Prompt subfolder
    </button>
    <span style={styles.insertLine}></span>
  </div>
{/snippet}

{#snippet promptEditor(prompt: MockupPrompt, index: number)}
  <article
    style={styles.promptRow}
    data-testid={`prompt-editor-${prompt.id}`}
    data-virtual-window-row
  >
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId={PROMPT_FOLDER_ID}
      isFirstPrompt={index === 0}
      isLastPrompt={index === prompts.length - 1}
      onMoveUp={() => movePrompt(index, index - 1)}
      onMoveDown={() => movePrompt(index, index + 1)}
      onPromptTreeDrop={() => {}}
    />

    <div style={styles.promptBody}>
      <PromptEditorTitleBar
        title={prompt.title}
        draftText={prompt.text}
        promptFolderCount={index + 1}
        rowId={`mockup-${prompt.id}`}
        onTitleChange={(value) => {
          prompt.title = value
        }}
        onDelete={() => {
          deletePrompt(prompt.id)
        }}
      />

      {#if monacoOverflowHost}
        <div style={styles.monacoShell}>
          <HydratableMonacoEditor
            initialValue={prompt.text}
            containerWidthPx={editorContainerWidthPx}
            placeholderHeightPx={prompt.monacoHeightPx}
            overflowWidgetsDomNode={monacoOverflowHost}
            hydrationPriority={index}
            shouldDehydrate={false}
            rowId={`mockup-${prompt.id}`}
            findSectionKey={MOCKUP_BODY_FIND_SECTION_KEY}
            onChange={(text, meta) => {
              prompt.text = text
              prompt.monacoHeightPx = meta.heightPx
            }}
          />
        </div>
      {:else}
        <div style={`${styles.monacoShell}min-height:${prompt.monacoHeightPx}px;`}></div>
      {/if}
    </div>
  </article>
{/snippet}
