<script lang="ts">
  import HydratableMonacoEditor from '@renderer/features/prompt-editor/HydratableMonacoEditor.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import PromptEditorTitleBar from '@renderer/features/prompt-editor/PromptEditorTitleBar.svelte'
  import { Folder, FolderPlus, Plus } from 'lucide-svelte'

  type MockupPrompt = {
    id: string
    title: string
    text: string
    monacoHeightPx: number
  }

  const MOCKUP_BODY_FIND_SECTION_KEY = 'mockup-prompt-body'
  const MOCKUP_FOLDER_DESCRIPTION_FIND_SECTION_KEY = 'mockup-folder-description'
  const DEFAULT_MONACO_HEIGHT_PX = 126
  const DEFAULT_DESCRIPTION_MONACO_HEIGHT_PX = 106
  const PROMPT_FOLDER_ID = 'mockup-prompt-folder'

  const PAGE_STYLE =
    "box-sizing:border-box;color:var(--ui-normal-text);font-family:Aptos,'Segoe UI Variable','Segoe UI',sans-serif;min-height:42rem;min-width:0;padding:0;width:100%;"
  const STACK_STYLE = 'display:grid;gap:0.75rem;min-width:0;width:100%;'
  const SECTION_HEADER_STYLE = 'display:grid;gap:0.35rem;min-width:0;padding:1.5rem 0 0.35rem;'
  const SECTION_TITLE_STYLE =
    'color:var(--ui-normal-text);font-size:24px;font-weight:700;line-height:32px;margin:0;'
  const PROMPT_SECTION_TITLE_STYLE =
    'color:var(--ui-normal-text);font-size:24px;font-weight:700;letter-spacing:0;line-height:32px;margin:0;'
  const DESCRIPTION_CARD_STYLE =
    'align-content:start;backdrop-filter:blur(18px);background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));border:1px solid var(--ui-card-normal-border);border-radius:8px;box-shadow:0 16px 34px var(--ui-card-normal-shadow);box-sizing:border-box;display:grid;gap:8px;min-width:0;padding:10px;'
  const PROMPT_CARD_STYLE =
    'align-items:stretch;backdrop-filter:blur(18px);background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));border:1px solid var(--ui-card-normal-border);border-radius:8px;box-shadow:0 16px 34px var(--ui-card-normal-shadow);box-sizing:border-box;display:grid;gap:10px;grid-template-columns:34px minmax(0,1fr);min-height:11.25rem;min-width:0;padding:10px;'
  const PROMPT_BODY_STYLE =
    'align-content:start;display:grid;gap:8px;grid-template-rows:auto auto;min-width:0;'
  const EDITOR_SHELL_STYLE = 'box-sizing:border-box;min-height:6rem;width:100%;'
  const ADD_ROW_STYLE =
    'align-items:center;display:grid;gap:10px;grid-template-columns:auto auto minmax(0,1fr);min-height:28px;min-width:0;'
  const ADD_BUTTON_STYLE =
    'align-items:center;appearance:none;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-neutral-muted-border);border-radius:8px;box-sizing:border-box;color:var(--ui-secondary-text);cursor:pointer;display:inline-flex;font:inherit;font-size:12px;font-weight:600;gap:6px;height:28px;justify-content:center;line-height:16px;min-width:0;padding:0 10px;'
  const ADD_BUTTON_ACCENT_STYLE =
    'align-items:center;appearance:none;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:8px;box-sizing:border-box;color:var(--ui-accent-normal-text);cursor:pointer;display:inline-flex;font:inherit;font-size:12px;font-weight:600;gap:6px;height:28px;justify-content:center;line-height:16px;min-width:0;padding:0 10px;'
  const ADD_ICON_STYLE = 'height:14px;width:14px;'
  const ADD_SEPARATOR_STYLE =
    'background:linear-gradient(90deg,var(--ui-neutral-muted-border),var(--ui-neutral-normal-border),var(--ui-neutral-muted-border));height:1px;min-width:0;opacity:0.75;'
  const OVERFLOW_HOST_STYLE = 'inset:0;pointer-events:none;position:fixed;z-index:20;'

  let editorContainerWidthPx = $state(0)
  let monacoOverflowHost = $state<HTMLDivElement | null>(null)
  let folderDescriptionText = $state(
    [
      'Use this folder for prompts that shape implementation work from planning through verification.',
      '',
      'Keep reusable review criteria, test-writing patterns, and release-note helpers close together so they are easy to scan before copying.'
    ].join('\n')
  )
  let folderDescriptionHeightPx = $state(DEFAULT_DESCRIPTION_MONACO_HEIGHT_PX)
  let nextPromptNumber = $state(5)

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

  const getInsertionIndex = (previousPromptId: string | null): number => {
    if (!previousPromptId) return 0
    const previousIndex = prompts.findIndex((prompt) => prompt.id === previousPromptId)
    return previousIndex === -1 ? prompts.length : previousIndex + 1
  }

  const insertPrompt = (previousPromptId: string | null, kind: 'prompt' | 'subfolder'): void => {
    const promptNumber = nextPromptNumber
    nextPromptNumber += 1
    const nextPrompt: MockupPrompt =
      kind === 'prompt'
        ? {
            id: `new-prompt-${promptNumber}`,
            title: 'New Prompt',
            text: '',
            monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
          }
        : {
            id: `new-subfolder-${promptNumber}`,
            title: 'Prompt Subfolder',
            text: '',
            monacoHeightPx: DEFAULT_MONACO_HEIGHT_PX
          }

    const nextPrompts = [...prompts]
    nextPrompts.splice(getInsertionIndex(previousPromptId), 0, nextPrompt)
    prompts = nextPrompts
  }

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

<main style={PAGE_STYLE} data-testid="prompt-folder-screen">
  <div style={STACK_STYLE} bind:clientWidth={editorContainerWidthPx}>
    <section style={SECTION_HEADER_STYLE} data-virtual-window-row>
      <h1 style={SECTION_TITLE_STYLE}>Folder Settings</h1>
    </section>

    <section
      style={DESCRIPTION_CARD_STYLE}
      data-testid="prompt-folder-settings-mockup-prompt-folder"
      data-virtual-window-row
    >
      <PromptEditorTitleBar
        title="Folder Description"
        draftText={folderDescriptionText}
        metadataFolderLabel="Prompt Folder"
        icon={Folder}
        copyLabel="Copy folder description"
        copyTitle="Copy folder description"
      />

      <div style="min-width:0;">
        {#if monacoOverflowHost}
          <HydratableMonacoEditor
            initialValue={folderDescriptionText}
            containerWidthPx={editorContainerWidthPx}
            placeholderHeightPx={folderDescriptionHeightPx}
            overflowWidgetsDomNode={monacoOverflowHost}
            hydrationPriority={0}
            shouldDehydrate={false}
            rowId="mockup-folder-description"
            findSectionKey={MOCKUP_FOLDER_DESCRIPTION_FIND_SECTION_KEY}
            onChange={(text, meta) => {
              folderDescriptionText = text
              folderDescriptionHeightPx = meta.heightPx
            }}
          />
        {:else}
          <div style={`${EDITOR_SHELL_STYLE}min-height:${folderDescriptionHeightPx}px;`}></div>
        {/if}
      </div>
    </section>

    <section style={SECTION_HEADER_STYLE} data-virtual-window-row>
      <h2 style={PROMPT_SECTION_TITLE_STYLE}>Prompts</h2>
    </section>

    {@render addPromptRow(null)}

    {#each prompts as prompt, index (prompt.id)}
      {@render promptEditor(prompt, index)}
      {@render addPromptRow(prompt.id)}
    {/each}
  </div>
  <div bind:this={monacoOverflowHost} style={OVERFLOW_HOST_STYLE}></div>
</main>

{#snippet addPromptRow(previousPromptId: string | null)}
  <div style={ADD_ROW_STYLE} data-virtual-window-row>
    <button
      type="button"
      style={ADD_BUTTON_ACCENT_STYLE}
      aria-label="Add prompt"
      onclick={() => {
        insertPrompt(previousPromptId, 'prompt')
      }}
    >
      <Plus style={ADD_ICON_STYLE} strokeWidth={2.75} />
      Prompt
    </button>
    <button
      type="button"
      style={ADD_BUTTON_STYLE}
      aria-label="Add prompt subfolder"
      onclick={() => {
        insertPrompt(previousPromptId, 'subfolder')
      }}
    >
      <FolderPlus style={ADD_ICON_STYLE} strokeWidth={2.25} />
      Subfolder
    </button>
    <div style={ADD_SEPARATOR_STYLE}></div>
  </div>
{/snippet}

{#snippet promptEditor(prompt: MockupPrompt, index: number)}
  <article
    style={PROMPT_CARD_STYLE}
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

    <div style={PROMPT_BODY_STYLE}>
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
        <div style={EDITOR_SHELL_STYLE}>
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
        <div style={`${EDITOR_SHELL_STYLE}min-height:${prompt.monacoHeightPx}px;`}></div>
      {/if}
    </div>
  </article>
{/snippet}
