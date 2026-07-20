<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    Check,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Copy,
    FileText,
    Folder,
    GripVertical,
    Layers,
    Pencil,
    Plus,
    Search,
    Settings,
    Trash2
  } from 'lucide-svelte'
  import { monaco } from '@renderer/common/Monaco'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/SeparatorDot.svelte'
  import PromptDivider from '@renderer/features/prompt-editor/PromptDivider.svelte'
  import PromptEditorStatusControl from '@renderer/features/prompt-editor/PromptEditorStatusControl.svelte'
  import { PromptStatus } from '@shared/Prompt'

  type MockPromptStatus = PromptStatus

  type MockDocument = {
    id: string
    minLines?: number
    text: string
  }

  type MockPrompt = MockDocument & {
    title: string
    folderId: string
    folderLabel: string
    modifiedLabel: string
    status: MockPromptStatus
  }

  type MockFolderSetting = MockDocument & {
    title: string
    description: string
    isPresent: boolean
  }

  type MockFolder = {
    id: string
    title: string
    settings: MockFolderSetting[]
    prompts: MockPrompt[]
    children: MockFolder[]
  }

  const createSettings = (
    folderId: string,
    description: string,
    prefix: string
  ): MockFolderSetting[] => [
    {
      id: `${folderId}-description`,
      title: 'Folder Description',
      description:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      isPresent: true,
      minLines: 1,
      text: description
    },
    {
      id: `${folderId}-prefix`,
      title: 'Prompt Folder Prefix',
      description:
        'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      isPresent: true,
      minLines: 1,
      text: prefix
    },
    {
      id: `${folderId}-suffix`,
      title: 'Prompt Folder Suffix',
      description:
        'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      isPresent: false,
      minLines: 1,
      text: ''
    }
  ]

  const createPrompt = (
    id: string,
    title: string,
    folderId: string,
    folderLabel: string,
    text: string,
    status: MockPromptStatus = PromptStatus.Todo
  ): MockPrompt => ({
    id,
    title,
    folderId,
    folderLabel,
    modifiedLabel: 'Updated today',
    status,
    text
  })

  let rootPrompts = $state<MockPrompt[]>([
    createPrompt(
      'base-discovery',
      'Map the current implementation',
      'base-root',
      'Product Work',
      [
        'Inspect the existing implementation and summarize the relevant components, data flow, and tests.',
        '',
        'Call out constraints that the change must preserve.'
      ].join('\n'),
      PromptStatus.InProgress
    ),
    createPrompt(
      'base-requirements',
      'Turn notes into requirements',
      'base-root',
      'Product Work',
      [
        'Convert the supplied product notes into a concise implementation checklist.',
        '',
        'Separate required behavior from optional polish.'
      ].join('\n')
    ),
    createPrompt(
      'base-plan',
      'Draft an implementation plan',
      'base-root',
      'Product Work',
      [
        'Create an implementation plan grounded in the current repository.',
        '',
        'Include the files to change and the focused verification for each step.'
      ].join('\n')
    ),
    createPrompt(
      'base-review',
      'Review the completed change',
      'base-root',
      'Product Work',
      [
        'Review the completed change for user-visible regressions, missing edge cases, and unnecessary complexity.',
        '',
        'Report only concrete findings.'
      ].join('\n')
    ),
    createPrompt(
      'base-docs',
      'Update developer documentation',
      'base-root',
      'Product Work',
      [
        'Update the relevant developer documentation to match the implemented behavior.',
        '',
        'Keep the guidance specific to this repository.'
      ].join('\n')
    ),
    createPrompt(
      'base-handoff',
      'Prepare the final handoff',
      'base-root',
      'Product Work',
      [
        'Prepare a short handoff with the outcome, changed files, and verification results.',
        '',
        'Mention any remaining risk explicitly.'
      ].join('\n')
    )
  ])

  let subfolders = $state<MockFolder[]>([
    {
      id: 'base-implementation',
      title: 'Implementation',
      settings: createSettings(
        'base-implementation',
        'Prompts used while implementing an approved product change.',
        'Work directly in the current repository and follow its local contribution guidelines.'
      ),
      prompts: [
        createPrompt(
          'base-build',
          'Implement the approved change',
          'base-implementation',
          'Implementation',
          [
            'Implement the approved change using the existing architecture and shared UI components.',
            '',
            'Keep the patch focused and preserve unrelated work in the tree.'
          ].join('\n'),
          PromptStatus.InProgress
        )
      ],
      children: [
        {
          id: 'base-verification',
          title: 'Verification',
          settings: createSettings(
            'base-verification',
            'Prompts for validating product behavior after implementation.',
            'Use the repository test helpers and stable data-testid selectors.'
          ),
          prompts: [
            createPrompt(
              'base-regression',
              'Add focused regression coverage',
              'base-verification',
              'Verification',
              [
                'Add focused regression coverage for the behavior changed in this task.',
                '',
                'Assert the visible user flow before implementation details.'
              ].join('\n')
            )
          ],
          children: []
        }
      ]
    }
  ])

  const EDITOR_TITLE_HEIGHT_PX = 59
  const EDITOR_BODY_PADDING_TOP_PX = 8
  const EDITOR_BODY_PADDING_RIGHT_PX = 10
  const EDITOR_BODY_PADDING_BOTTOM_PX = 10
  const EDITOR_BODY_PADDING_LEFT_PX = 10
  const editorSizing = {
    fontSize: 15,
    minLines: 3,
    maxLines: 10
  }
  const lineHeightPx = Math.round(editorSizing.fontSize * 1.35)
  const maxEditorHeightPx = lineHeightPx * editorSizing.maxLines
  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const clampEditorHeight = (heightPx: number, minLines = editorSizing.minLines): number =>
    Math.min(Math.max(heightPx, lineHeightPx * minLines), maxEditorHeightPx)

  const getTokenCount = (text: string): number => {
    const trimmed = text.trim()
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  }

  const getEditorUri = (documentId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/prompt-folder-base/${documentId}.md`)

  const createEditor = (host: HTMLElement, document: MockDocument) => {
    const modelUri = getEditorUri(document.id)
    const existingModel = monaco.editor.getModel(modelUri)
    const model = existingModel ?? monaco.editor.createModel(document.text, 'markdown', modelUri)
    model.setValue(document.text)

    const editor = monaco.editor.create(host, {
      model,
      automaticLayout: true,
      ariaLabel: `${document.id} editor`,
      fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: editorSizing.fontSize,
      lineHeight: lineHeightPx,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      minimap: { enabled: false },
      renderLineHighlightOnlyWhenFocus: true,
      renderValidationDecorations: 'off',
      revealHorizontalRightPadding: 0,
      scrollBeyondLastLine: false,
      scrollbar: { alwaysConsumeMouseWheel: false },
      smoothScrolling: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      dimension: {
        width: Math.max(1, host.clientWidth),
        height: clampEditorHeight(
          lineHeightPx * Math.max(1, document.text.split('\n').length),
          document.minLines
        )
      }
    })

    const syncHeight = () => {
      const heightPx = clampEditorHeight(Math.ceil(editor.getContentHeight()), document.minLines)
      host.style.height = `${heightPx}px`
      editor.layout({ width: Math.max(1, host.clientWidth), height: heightPx })
    }

    syncHeight()
    const contentSizeDisposable = editor.onDidContentSizeChange(syncHeight)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      document.text = editor.getValue()
    })

    let isDisposed = false
    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      contentSizeDisposable.dispose()
      contentDisposable.dispose()
      editor.dispose()
      if (!existingModel) model.dispose()
    }

    editorCleanupCallbacks.add(cleanup)

    return () => {
      cleanup()
      editorCleanupCallbacks.delete(cleanup)
    }
  }

  const mountMockupMonaco = (node: HTMLElement, document: MockDocument) => {
    // Side effect: mount a real Monaco instance for this mock document and dispose it with the host.
    const destroy = createEditor(node, document)
    return { destroy }
  }

  // Side effect: dispose any Monaco instance still owned by the mockup when it unmounts.
  onDestroy(() => {
    for (const cleanup of editorCleanupCallbacks) cleanup()
    editorCleanupCallbacks.clear()
  })

  const setPromptStatus = (prompt: MockPrompt, status: PromptStatus) => {
    prompt.status = status
  }
</script>

{#snippet MonacoBody(document: MockDocument, testId: string)}
  <div
    class="base-monaco-shell"
    style={`padding:${EDITOR_BODY_PADDING_TOP_PX}px ${EDITOR_BODY_PADDING_RIGHT_PX}px ${EDITOR_BODY_PADDING_BOTTOM_PX}px ${EDITOR_BODY_PADDING_LEFT_PX}px;`}
  >
    <div
      class="base-monaco-host"
      data-testid={testId}
      use:mountMockupMonaco={document}
    ></div>
  </div>
{/snippet}

{#snippet Divider()}
  <PromptDivider onAddPrompt={() => undefined} onAddSubfolder={() => undefined} />
{/snippet}

{#snippet PromptCard(prompt: MockPrompt, index: number, siblingCount: number)}
  <article
    class="base-editor-card base-prompt-card"
    data-testid={`base-mockup-prompt-editor-${prompt.id}`}
    data-prompt-folder-id={prompt.folderId}
  >
    <aside class="base-editor-sidebar">
      <button type="button" aria-label="Move prompt up" disabled={index === 0}>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Drag prompt" class="base-drag-button">
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Move prompt down" disabled={index === siblingCount - 1}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </aside>

    <div class="base-editor-body">
      <header class="base-prompt-title-area" style={`height:${EDITOR_TITLE_HEIGHT_PX}px;`}>
        <span class="base-status-indicator" data-status={prompt.status} aria-hidden="true"></span>
        <div class="base-prompt-title-main">
          <IconCell icon={FileText} size="title" />
          <div class="base-title-copy">
            <input aria-label="Prompt title" bind:value={prompt.title} />
            <div class="base-metadata-row">
              <span class="base-folder-label">
                <Layers size={12} aria-hidden="true" />
                {prompt.folderLabel}
              </span>
              <SeparatorDot />
              <span>{prompt.modifiedLabel}</span>
              <SeparatorDot />
              <span>{getTokenCount(prompt.text)} tokens</span>
            </div>
          </div>
        </div>

        <div class="base-prompt-actions">
          <IconButtonBar>
            <IconButton
              icon={Trash2}
              label="Delete prompt"
              title="Delete prompt"
              hoverVariant="danger"
            />
            <IconButton
              icon={Copy}
              label="Copy prompt"
              title="Copy prompt"
              hoverVariant="accent"
            />
          </IconButtonBar>
          <span class="base-actions-separator" aria-hidden="true"></span>
          <PromptEditorStatusControl
            status={prompt.status}
            onStatusChange={(status) => setPromptStatus(prompt, status)}
          />
        </div>
      </header>

      <Separator />
      {@render MonacoBody(prompt, `base-mockup-monaco-${prompt.id}`)}
    </div>
  </article>
{/snippet}

{#snippet FolderCard(folder: MockFolder)}
  <section class="base-folder-section" data-testid={`base-mockup-subfolder-${folder.id}`}>
    <article class="base-editor-card base-folder-card">
      <aside class="base-folder-sidebar">
        <button type="button" aria-label="Drag prompt folder" title="Drag prompt folder">
          <GripVertical size={16} aria-hidden="true" />
        </button>
      </aside>

      <div class="base-editor-body">
        <header class="base-folder-title-bar" aria-expanded="true">
          <div class="base-folder-title-main">
            <button class="base-folder-chevron" type="button" aria-label="Folder prompts shown">
              <ChevronRight size={24} aria-hidden="true" />
            </button>
            <IconCell icon={Folder} size="title" />
            <div class="base-folder-title-copy">
              <div class="base-folder-title-line">
                <span class="base-folder-title" title={folder.title}>{folder.title}</span>
                <IconButton
                  icon={Pencil}
                  label="Rename prompt folder"
                  title="Rename prompt folder"
                  size="tiny"
                  baseVariant="muted"
                  hoverVariant="glyph"
                />
              </div>
              <div class="base-metadata-row">
                <span>{folder.prompts.length} prompt</span>
                <SeparatorDot />
                <span>0 completed prompts</span>
                <SeparatorDot />
                <span>{folder.children.length} {folder.children.length === 1 ? 'subfolder' : 'subfolders'}</span>
              </div>
            </div>
          </div>

          <div class="base-folder-actions">
            <IconButtonBar>
              <IconButton
                icon={Trash2}
                label="Delete prompt folder"
                title="Delete prompt folder"
                hoverVariant="danger"
              />
              <IconButton
                icon={Settings}
                label="Hide folder settings"
                title="Hide folder settings"
                hoverVariant="accent"
                active
                ariaPressed
                testId={`base-mockup-settings-expanded-${folder.id}`}
              />
            </IconButtonBar>
          </div>
        </header>

        <Separator />
        <div class="base-folder-settings">
          <div class="rework-settings-toolbar">
            <div class="rework-settings-heading">
              <Settings size={18} aria-hidden="true" />
              <div class="rework-settings-heading-copy">
                <span>Folder Settings</span>
                <span class="rework-settings-metadata">
                  {folder.settings.filter((setting) => setting.isPresent).length} of {folder.settings
                    .length} configured
                </span>
              </div>
            </div>

            <div class="base-settings-rail" role="group" aria-label="Folder settings">
              {#each folder.settings as setting (setting.id)}
                <button
                  type="button"
                  data-present={setting.isPresent}
                  aria-pressed={setting.isPresent}
                  title={`${setting.isPresent ? 'Remove' : 'Add'} ${setting.title.toLowerCase()}`}
                  onclick={() => {
                    setting.isPresent = !setting.isPresent
                  }}
                >
                  <span class="base-settings-pill-icon" aria-hidden="true">
                    {#if setting.isPresent}
                      <Check size={13} strokeWidth={2.5} />
                    {:else}
                      <Plus size={13} strokeWidth={2.5} />
                    {/if}
                  </span>
                  <span>{setting.title.replace('Prompt Folder ', '').replace('Folder ', '')}</span>
                </button>
              {/each}
            </div>
          </div>
          <Separator />

          {#each folder.settings.filter((setting) => setting.isPresent) as setting, settingIndex (setting.id)}
            <section
              class="base-settings-section"
              class:withTopBorder={settingIndex > 0}
              data-testid={`base-mockup-settings-section-${setting.id}`}
            >
              <header>
                <div class="base-settings-copy">
                  <span>{setting.title}</span>
                  <span>- {setting.description}</span>
                </div>
              </header>
              <Separator />
              {@render MonacoBody(setting, `base-mockup-monaco-${setting.id}`)}
            </section>
          {/each}
        </div>
      </div>
    </article>

    <div class="base-folder-children">
      {@render Divider()}
      {#each folder.prompts as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, folder.prompts.length)}
        {@render Divider()}
      {/each}
      {#each folder.children as child (child.id)}
        {@render FolderCard(child)}
        {@render Divider()}
      {/each}
    </div>
    <div class="base-folder-bottom-cap" aria-hidden="true"></div>
  </section>
{/snippet}

<main class="base-prompt-folder-mockup" data-testid="base-prompt-folder-mockup">
  <div class="base-header-bar">
    <div class="base-breadcrumb">
      <button type="button">Product Work</button>
      <span>/</span>
      <button type="button">Folder Settings</button>
    </div>
    <IconButton
      icon={Search}
      label="Find in Folder (Control + F)"
      title="Find in Folder (Control + F)"
      size="compact"
    />
  </div>

  <div class="base-content-viewport">
    <section class="base-root-header">
      <div class="base-root-title-row">
        <div class="base-root-title-block">
          <div class="base-root-eyebrow">
            <Folder size={14} aria-hidden="true" />
            <span>Prompt folder</span>
          </div>
          <div class="base-root-title-line">
            <h1>Product Work</h1>
            <IconButton
              icon={Pencil}
              label="Rename prompt folder"
              title="Rename prompt folder"
              size="tiny"
              baseVariant="muted"
              hoverVariant="glyph"
            />
          </div>
        </div>
        <IconButton
          icon={Trash2}
          label="Delete folder"
          title="Delete folder"
          hoverVariant="danger"
        />
      </div>

      <div class="base-filter-bar" role="group" aria-label="Filter prompts">
        <button class="active" type="button" aria-pressed="true">
          Todo/In Progress <span>8</span>
        </button>
        <button type="button" aria-pressed="false">Completed <span>0</span></button>
      </div>
    </section>

    <div class="base-entry-flow">
      {@render Divider()}
      {#each rootPrompts.slice(0, 3) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex, rootPrompts.length)}
        {@render Divider()}
      {/each}

      <div class="base-root-folder-inset">
        {#each subfolders as folder (folder.id)}
          {@render FolderCard(folder)}
        {/each}
      </div>

      {@render Divider()}
      {#each rootPrompts.slice(3) as prompt, promptIndex (prompt.id)}
        {@render PromptCard(prompt, promptIndex + 3, rootPrompts.length)}
        {@render Divider()}
      {/each}
    </div>
  </div>
</main>

<style>
  .base-prompt-folder-mockup {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    min-width: 0;
    width: 100%;
  }

  button,
  input {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .base-header-bar {
    align-items: center;
    display: flex;
    flex: 0 0 36px;
    gap: 12px;
    height: 36px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 24px;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .base-breadcrumb {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 14px;
    font-weight: 500;
    min-width: 0;
  }

  .base-breadcrumb button {
    background: transparent;
    border: 0;
    color: inherit;
    min-width: 0;
    padding: 0;
  }

  .base-breadcrumb button:first-child {
    color: var(--ui-muted-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-breadcrumb span {
    color: var(--ui-neutral-emphasis-border);
    padding: 0 12px;
  }

  .base-breadcrumb button:last-child {
    color: var(--ui-hoverable-text);
    white-space: nowrap;
  }

  .base-breadcrumb button:first-child:hover,
  .base-breadcrumb button:last-child:hover {
    color: var(--ui-normal-text);
  }

  .base-content-viewport {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    padding-right: 12px;
  }

  .base-root-header {
    box-sizing: border-box;
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    height: 140px;
    min-width: 0;
    padding: 12px 24px 6px;
  }

  .base-root-title-row {
    align-items: end;
    display: flex;
    gap: 16px;
    height: 60px;
    justify-content: space-between;
    min-width: 0;
  }

  .base-root-title-block {
    height: 60px;
    min-width: 0;
  }

  .base-root-eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
    height: 17px;
    line-height: 17px;
  }

  .base-root-title-line {
    align-items: baseline;
    display: flex;
    gap: 7px;
    height: 36px;
    margin-top: 7px;
    min-width: 0;
  }

  .base-root-title-line h1 {
    color: var(--ui-normal-text);
    font-size: 27px;
    font-weight: 700;
    height: 36px;
    letter-spacing: -0.03em;
    line-height: 32px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    padding-block: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-filter-bar {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    display: flex;
    gap: 6px;
    height: 44px;
  }

  .base-filter-bar button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted-text);
    height: 44px;
    margin-bottom: -1px;
    padding: 8px 10px 10px;
  }

  .base-filter-bar button.active {
    border-bottom-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .base-filter-bar span {
    background: var(--ui-neutral-normal-surface);
    border-radius: 999px;
    font-size: 11px;
    margin-left: 4px;
    padding: 2px 6px;
  }

  .base-entry-flow {
    min-width: 0;
    padding-bottom: 24px;
  }

  .base-editor-card {
    align-items: stretch;
    background: var(--ui-card-normal-surface-gradient-start);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }

  .base-editor-body {
    align-content: start;
    background: var(--ui-editor-normal-surface);
    display: grid;
    min-width: 0;
    position: relative;
  }

  .base-editor-sidebar,
  .base-folder-sidebar {
    background: var(--ui-editor-normal-surface);
    border-right: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    width: 32px;
  }

  .base-editor-sidebar button {
    align-items: center;
    background: transparent;
    border: 0;
    border-bottom: 1px solid transparent;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    flex: 0 4 40px;
    justify-content: center;
    min-height: 32px;
    padding: 0;
    transition:
      background-color 120ms ease,
      border-color 50ms ease-out,
      color 120ms ease;
  }

  .base-editor-sidebar .base-drag-button {
    flex: 1 1 52px;
  }

  .base-editor-sidebar button:disabled {
    opacity: 0.5;
  }

  .base-editor-sidebar button:not(.base-drag-button) :global(svg) {
    opacity: 0;
    transition: opacity 50ms ease-out;
  }

  .base-editor-sidebar:hover button,
  .base-editor-sidebar:focus-within button {
    border-bottom-color: var(--ui-neutral-normal-border);
  }

  .base-editor-sidebar:hover button:not(.base-drag-button) :global(svg),
  .base-editor-sidebar:focus-within button:not(.base-drag-button) :global(svg) {
    opacity: 1;
  }

  .base-editor-sidebar button:hover,
  .base-editor-sidebar button:focus-visible,
  .base-folder-sidebar button:hover,
  .base-folder-sidebar button:focus-visible {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-folder-sidebar {
    align-items: center;
    justify-content: center;
  }

  .base-folder-sidebar button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    height: 100%;
    justify-content: center;
    padding: 0;
    width: 100%;
  }

  .base-prompt-title-area {
    align-items: center;
    display: grid;
    grid-template-columns: 2px minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
  }

  .base-status-indicator {
    align-self: stretch;
    background: transparent;
  }

  .base-status-indicator[data-status='InProgress'] {
    background: var(--ui-warning-icon-glyph);
  }

  .base-status-indicator[data-status='Completed'] {
    background: var(--ui-success-normal-text);
  }

  .base-prompt-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
    padding: 8px 8px 8px 16px;
  }

  .base-title-copy,
  .base-folder-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .base-title-copy input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    height: 22px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .base-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 12px;
    gap: 8px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .base-folder-label {
    align-items: center;
    color: var(--ui-secondary-text);
    display: inline-flex;
    gap: 4px;
    max-width: 150px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .base-prompt-actions,
  .base-folder-actions {
    align-items: center;
    align-self: stretch;
    display: flex;
    min-width: 0;
  }

  .base-prompt-actions {
    gap: 12px;
  }

  .base-folder-chevron {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
  }

  .base-folder-chevron:hover {
    background: var(--ui-hoverable-icon-surface);
    color: var(--ui-hoverable-icon-glyph);
  }

  .base-actions-separator {
    align-self: stretch;
    background: var(--ui-neutral-normal-border);
    flex: 0 0 1px;
    width: 1px;
  }

  .base-monaco-shell {
    background: var(--ui-editor-content-surface);
    box-sizing: border-box;
    min-width: 0;
  }

  .base-monaco-host {
    min-height: 0;
    min-width: 0;
    position: relative;
    width: 100%;
  }

  .rework-settings-toolbar {
    align-items: center;
    background: var(--ui-editor-normal-surface);
    box-sizing: border-box;
    display: flex;
    height: 42px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 12px 0 16px;
  }

  .rework-settings-heading {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 14px;
    font-weight: 700;
    gap: 12px;
    min-width: 0;
  }

  .rework-settings-heading :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .rework-settings-heading-copy {
    display: grid;
    line-height: 16px;
    min-width: 0;
  }

  .rework-settings-metadata {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 400;
  }

  .base-settings-rail {
    align-items: center;
    display: flex;
    flex: 0 1 auto;
    gap: 6px;
    justify-content: flex-end;
    min-width: 0;
  }

  .base-settings-rail button {
    align-items: center;
    background: var(--ui-editor-content-surface);
    border: 1px dashed var(--ui-neutral-emphasis-border);
    border-radius: 999px;
    color: var(--ui-hoverable-text);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
    height: 30px;
    padding: 0 10px 0 7px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .base-settings-rail button:hover:not([data-present='true']) {
    background: var(--ui-neutral-subtle-action-hover-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .base-settings-rail button[data-present='true'] {
    background: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    border-style: solid;
    color: var(--ui-secondary-text);
  }

  .base-settings-pill-icon {
    align-items: center;
    background: var(--ui-neutral-subtle-action-hover-fill);
    border-radius: 999px;
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    height: 18px;
    justify-content: center;
    width: 18px;
  }

  .base-settings-rail button[data-present='true'] .base-settings-pill-icon {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-secondary-icon-glyph);
  }

  .base-root-folder-inset {
    min-width: 0;
  }

  .base-folder-section {
    min-width: 0;
  }

  .base-folder-card {
    border-color: var(--ui-card-nested-border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .base-folder-title-bar {
    align-items: center;
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    height: 59px;
    min-width: 0;
    overflow: hidden;
    padding: 8px 16px;
    user-select: none;
  }

  .base-folder-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 30px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .base-folder-chevron {
    height: 30px;
    transform: rotate(90deg);
    width: 30px;
  }

  .base-folder-title-line {
    align-items: baseline;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .base-folder-title {
    color: var(--ui-normal-text);
    font-size: 16px;
    font-weight: 700;
    line-height: 21px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .base-folder-settings {
    background: var(--ui-editor-normal-surface);
    display: grid;
    min-width: 0;
  }

  .base-settings-section {
    display: grid;
    min-width: 0;
  }

  .base-settings-section.withTopBorder {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .base-settings-section > header {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 14px;
    font-weight: 700;
    gap: 5px;
    height: 28px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    padding: 0 16px;
    white-space: nowrap;
  }

  .base-settings-copy {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    gap: 5px;
    min-width: 0;
  }

  .base-settings-copy span:first-child {
    flex: 0 0 auto;
  }

  .base-settings-copy span:last-child {
    color: var(--ui-muted-text);
    flex: 1 1 auto;
    font-weight: 400;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .base-folder-children {
    background: var(--ui-card-nested-surface);
    border-left: 1px solid var(--ui-card-nested-border);
    border-right: 1px solid var(--ui-card-nested-border);
    box-sizing: border-box;
    min-width: 0;
    padding-inline: 12px;
  }

  .base-folder-bottom-cap {
    background: var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 0 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card);
    border-top: 0;
    box-sizing: border-box;
    height: 8px;
    width: 100%;
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: -2px;
  }
</style>
