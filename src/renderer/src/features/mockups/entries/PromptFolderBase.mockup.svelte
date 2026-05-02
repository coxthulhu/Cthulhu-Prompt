<script lang="ts">
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import PromptEditorTitleBar from '@renderer/features/prompt-editor/PromptEditorTitleBar.svelte'

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
</script>

<main class="prompt-folder-mockup" data-testid="prompt-folder-screen">
  <div class="prompt-editor-stack" bind:clientWidth={editorContainerWidthPx}>
    {#each prompts as prompt, index (prompt.id)}
      {@render promptEditor(prompt, index)}
    {/each}
  </div>
  <div bind:this={monacoOverflowHost} class="monaco-overflow-host"></div>
</main>

{#snippet promptEditor(prompt: MockupPrompt, index: number)}
  <article
    class="prompt-editor-row"
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

    <div class="prompt-editor-body">
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
        <div class="prompt-editor-monaco-shell">
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
        <div
          class="prompt-editor-monaco-pending"
          style={`min-height: ${prompt.monacoHeightPx}px;`}
        ></div>
      {/if}
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
    min-width: 0;
    width: 100%;
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

  .prompt-editor-body {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-template-rows: auto auto;
    min-width: 0;
  }

  .prompt-editor-monaco-shell,
  .prompt-editor-monaco-pending {
    box-sizing: border-box;
    min-height: 6rem;
    width: 100%;
  }

  .monaco-overflow-host {
    inset: 0;
    pointer-events: none;
    position: fixed;
    z-index: 20;
  }
</style>
