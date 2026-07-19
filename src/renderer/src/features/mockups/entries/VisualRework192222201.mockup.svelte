<script lang="ts">
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

  type Prompt = {
    id: string
    title: string
    folder: string
    updated: string
    text: string
    status?: 'progress' | 'todo'
  }

  type FolderSetting = {
    id: 'description' | 'prefix' | 'suffix'
    title: string
    description: string
    value: string
    present: boolean
  }

  type PromptFolder = {
    id: string
    title: string
    prompts: Prompt[]
    children: PromptFolder[]
    settings: FolderSetting[]
  }

  const rootPrompts: Prompt[] = [
    {
      id: 'discovery',
      title: 'Map the current implementation',
      folder: 'Product Work',
      updated: 'Updated today',
      status: 'progress',
      text: 'Inspect the existing implementation and summarize the relevant components, data flow, and tests.\n\nCall out constraints that the change must preserve.'
    },
    {
      id: 'requirements',
      title: 'Turn notes into requirements',
      folder: 'Product Work',
      updated: 'Updated today',
      status: 'todo',
      text: 'Convert the supplied product notes into a concise implementation checklist.\n\nSeparate required behavior from optional polish.'
    },
    {
      id: 'plan',
      title: 'Draft an implementation plan',
      folder: 'Product Work',
      updated: 'Updated today',
      status: 'todo',
      text: 'Create an implementation plan grounded in the current repository.\n\nInclude the files to change and the focused verification for each step.'
    },
    {
      id: 'review',
      title: 'Review the completed change',
      folder: 'Product Work',
      updated: 'Updated today',
      status: 'todo',
      text: 'Review the completed change for user-visible regressions, missing edge cases, and unnecessary complexity.\n\nReport only concrete findings.'
    }
  ]

  const settingsFor = (description: string, prefix: string): FolderSetting[] => [
    {
      id: 'description',
      title: 'Folder Description',
      description: 'A general description of this folder and the types of prompts that are within it.',
      value: description,
      present: true
    },
    {
      id: 'prefix',
      title: 'Prompt Folder Prefix',
      description: 'Text to add before each prompt copied from this folder.',
      value: prefix,
      present: true
    },
    {
      id: 'suffix',
      title: 'Prompt Folder Suffix',
      description: 'Text to add after each prompt copied from this folder.',
      value: '',
      present: false
    }
  ]

  let folders = $state<PromptFolder[]>([
    {
      id: 'implementation',
      title: 'Implementation',
      settings: settingsFor(
        'Prompts used while implementing an approved product change.',
        'Work directly in the current repository and follow its local contribution guidelines.'
      ),
      prompts: [
        {
          id: 'build',
          title: 'Implement the approved change',
          folder: 'Implementation',
          updated: 'Updated today',
          status: 'progress',
          text: 'Implement the approved change using the existing architecture and shared UI components.\n\nKeep the patch focused and preserve unrelated work in the tree.'
        }
      ],
      children: [
        {
          id: 'verification',
          title: 'Verification',
          settings: settingsFor(
            'Prompts for validating product behavior after implementation.',
            'Use the repository test helpers and stable data-testid selectors.'
          ),
          prompts: [
            {
              id: 'regression',
              title: 'Add focused regression coverage',
              folder: 'Verification',
              updated: 'Updated today',
              status: 'todo',
              text: 'Add focused regression coverage for the behavior changed in this task.\n\nAssert the visible user flow before implementation details.'
            }
          ],
          children: []
        }
      ]
    }
  ])

  let openAddMenu = $state<string | null>('implementation')

  const tokenCount = (text: string) => text.trim().split(/\s+/).length

  const addSetting = (setting: FolderSetting) => {
    setting.present = true
    openAddMenu = null
  }

  const removeSetting = (setting: FolderSetting) => {
    setting.present = false
  }
</script>

{#snippet IconAction(label: string, icon: typeof Search, danger = false)}
  {@const Icon = icon}
  <button class:danger class="icon-action" type="button" aria-label={label} title={label}>
    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
  </button>
{/snippet}

{#snippet Divider()}
  <div class="flow-divider">
    <span></span>
    <button type="button" aria-label="Add prompt or subfolder"><Plus size={14} /></button>
    <span></span>
  </div>
{/snippet}

{#snippet PromptCard(prompt: Prompt, index: number, count: number)}
  <article class="editor-card prompt-card">
    <aside class="editor-sidebar">
      <button type="button" aria-label="Move prompt up" disabled={index === 0}>
        <ChevronUp size={16} />
      </button>
      <button class="drag" type="button" aria-label="Drag prompt"><GripVertical size={16} /></button>
      <button type="button" aria-label="Move prompt down" disabled={index === count - 1}>
        <ChevronDown size={16} />
      </button>
    </aside>
    <div class="editor-body">
      <header class="prompt-title-bar">
        <span class:progress={prompt.status === 'progress'} class="status-line"></span>
        <div class="prompt-title-main">
          <span class="title-icon"><FileText size={20} strokeWidth={1.65} /></span>
          <div class="title-copy">
            <input aria-label="Prompt title" bind:value={prompt.title} />
            <div class="metadata">
              <span class="folder-label"><Layers size={12} />{prompt.folder}</span>
              <i></i><span>{prompt.updated}</span><i></i><span>{tokenCount(prompt.text)} tokens</span>
            </div>
          </div>
        </div>
        <div class="title-actions">
          {@render IconAction('Delete prompt', Trash2, true)}
          {@render IconAction('Copy prompt', Copy)}
          <span class="action-separator"></span>
          <button class="status-button" type="button">
            <span class:progress={prompt.status === 'progress'}></span>
            {prompt.status === 'progress' ? 'In Progress' : 'Todo'}
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      <div class="separator"></div>
      <div class="editor-content">
        <div class="line-numbers"><span>1</span><span>2</span><span>3</span></div>
        <textarea aria-label={`${prompt.title} content`} bind:value={prompt.text}></textarea>
      </div>
    </div>
  </article>
{/snippet}

{#snippet SettingEditor(setting: FolderSetting)}
  <section class="setting-section">
    <header>
      <div class="setting-heading">
        <strong>{setting.title}</strong>
        <span>— {setting.description}</span>
      </div>
      <button
        class="setting-remove"
        type="button"
        aria-label={`Delete ${setting.title.toLowerCase()}`}
        title={`Delete ${setting.title.toLowerCase()}`}
        onclick={() => removeSetting(setting)}
      ><Trash2 size={13} /></button>
    </header>
    <div class="separator"></div>
    <div class="setting-editor">
      <span>1</span>
      <textarea aria-label={setting.title} bind:value={setting.value}></textarea>
    </div>
  </section>
{/snippet}

{#snippet SettingsAdder(folder: PromptFolder)}
  {@const available = folder.settings.filter((setting) => !setting.present)}
  {#if available.length > 0}
    <div class="settings-adder">
      <button
        class="add-setting-trigger"
        class:open={openAddMenu === folder.id}
        type="button"
        aria-expanded={openAddMenu === folder.id}
        onclick={() => (openAddMenu = openAddMenu === folder.id ? null : folder.id)}
      >
        <Plus size={15} />
        <span>Add setting</span>
        <ChevronDown size={14} />
      </button>

      {#if openAddMenu === folder.id}
        <div class="settings-menu">
          <div class="menu-title">Add folder setting</div>
          {#each available as setting (setting.id)}
            <button type="button" onclick={() => addSetting(setting)}>
              <span class="menu-icon"><Settings size={16} /></span>
              <span class="menu-copy">
                <strong>{setting.title}</strong>
                <small>{setting.description}</small>
              </span>
              <Plus size={15} />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="settings-complete"><Check size={14} />All folder settings added</div>
  {/if}
{/snippet}

{#snippet FolderCard(folder: PromptFolder)}
  <section class="folder-section">
    <article class="editor-card folder-card">
      <aside class="folder-sidebar">
        <button type="button" aria-label="Drag prompt folder"><GripVertical size={16} /></button>
      </aside>
      <div class="editor-body">
        <header class="folder-title-bar">
          <div class="folder-title-main">
            <button class="folder-chevron" type="button" aria-label="Folder prompts shown">
              <ChevronRight size={24} />
            </button>
            <span class="title-icon"><Folder size={20} strokeWidth={1.65} /></span>
            <div class="title-copy">
              <div class="folder-title-line">
                <strong>{folder.title}</strong>
                {@render IconAction('Rename prompt folder', Pencil)}
              </div>
              <div class="metadata">
                <span>{folder.prompts.length} prompt</span><i></i><span>0 completed prompts</span><i></i>
                <span>{folder.children.length} {folder.children.length === 1 ? 'subfolder' : 'subfolders'}</span>
              </div>
            </div>
          </div>
          <div class="folder-actions">
            {@render IconAction('Delete prompt folder', Trash2, true)}
            <button class="icon-action active" type="button" aria-label="Hide folder settings">
              <Settings size={16} />
            </button>
          </div>
        </header>
        <div class="separator"></div>
        <div class="folder-settings">
          {#each folder.settings.filter((setting) => setting.present) as setting (setting.id)}
            {@render SettingEditor(setting)}
          {/each}
          {@render SettingsAdder(folder)}
        </div>
      </div>
    </article>

    <div class="folder-children">
      {@render Divider()}
      {#each folder.prompts as prompt, index (prompt.id)}
        {@render PromptCard(prompt, index, folder.prompts.length)}
        {@render Divider()}
      {/each}
      {#each folder.children as child (child.id)}
        {@render FolderCard(child)}
        {@render Divider()}
      {/each}
    </div>
    <div class="folder-cap"></div>
  </section>
{/snippet}

<main class="mockup">
  <div class="header-bar">
    <div class="breadcrumb"><button type="button">Product Work</button><span>/</span><button type="button">Folder Settings</button></div>
    {@render IconAction('Find in Folder (Control + F)', Search)}
  </div>

  <div class="viewport">
    <section class="root-header">
      <div class="root-title-row">
        <div class="root-title-block">
          <div class="root-eyebrow"><Folder size={14} /><span>Prompt folder</span></div>
          <div class="root-title-line"><h1>Product Work</h1>{@render IconAction('Rename prompt folder', Pencil)}</div>
        </div>
        {@render IconAction('Delete folder', Trash2, true)}
      </div>
      <div class="filter-bar" role="group" aria-label="Filter prompts">
        <button class="active" type="button">Todo/In Progress <span>6</span></button>
        <button type="button">Completed <span>0</span></button>
      </div>
    </section>

    <div class="entry-flow">
      {@render Divider()}
      {#each rootPrompts.slice(0, 3) as prompt, index (prompt.id)}
        {@render PromptCard(prompt, index, rootPrompts.length)}
        {@render Divider()}
      {/each}
      <div class="root-folder-inset">
        {#each folders as folder (folder.id)}{@render FolderCard(folder)}{/each}
      </div>
      {@render Divider()}
      {#each rootPrompts.slice(3) as prompt, index (prompt.id)}
        {@render PromptCard(prompt, index + 3, rootPrompts.length)}
        {@render Divider()}
      {/each}
    </div>
  </div>
</main>

<style>
  .mockup { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 100%; min-width: 0; width: 100%; }
  button, input, textarea { font: inherit; }
  button { cursor: pointer; }
  .header-bar { align-items: center; border-bottom: 1px solid var(--ui-neutral-muted-border); display: flex; flex: 0 0 36px; height: 36px; justify-content: space-between; padding: 0 24px; }
  .breadcrumb { align-items: center; color: var(--ui-muted-text); display: flex; font-size: 14px; font-weight: 500; }
  .breadcrumb button { background: transparent; border: 0; color: inherit; padding: 0; }
  .breadcrumb button:last-child { color: var(--ui-hoverable-text); }
  .breadcrumb span { color: var(--ui-neutral-emphasis-border); padding: 0 12px; }
  .viewport { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 12px; }
  .root-header { box-sizing: border-box; display: grid; gap: 18px; grid-template-rows: 60px 44px; height: 140px; padding: 12px 24px 6px; }
  .root-title-row { align-items: end; display: flex; height: 60px; justify-content: space-between; }
  .root-title-block { height: 60px; }
  .root-eyebrow { align-items: center; color: var(--ui-secondary-text); display: flex; font-size: 12px; gap: 6px; height: 17px; }
  .root-title-line { align-items: baseline; display: flex; gap: 7px; height: 36px; margin-top: 7px; }
  .root-title-line h1 { color: var(--ui-normal-text); font-size: 27px; font-weight: 700; letter-spacing: -.03em; line-height: 32px; margin: 0; padding-block: 2px; }
  .filter-bar { border-bottom: 1px solid var(--ui-neutral-normal-border); display: flex; gap: 6px; height: 44px; }
  .filter-bar button { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--ui-muted-text); height: 44px; padding: 8px 10px 10px; }
  .filter-bar button.active { border-bottom-color: var(--ui-accent-normal-border); color: var(--ui-normal-text); }
  .filter-bar span { background: var(--ui-neutral-normal-surface); border-radius: 99px; font-size: 11px; margin-left: 4px; padding: 2px 6px; }
  .entry-flow { min-width: 0; padding-bottom: 24px; }
  .flow-divider { align-items: center; display: grid; grid-template-columns: 1fr auto 1fr; height: 28px; padding: 0 10px; }
  .flow-divider > span { background: var(--ui-neutral-muted-border); height: 1px; }
  .flow-divider button { align-items: center; background: transparent; border: 0; border-radius: 50%; color: var(--ui-muted-icon-glyph); display: flex; height: 24px; justify-content: center; width: 28px; }
  .flow-divider button:hover { color: var(--ui-hoverable-icon-glyph); }
  .editor-card { background: var(--ui-editor-normal-surface); border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); display: grid; grid-template-columns: 32px minmax(0, 1fr); min-width: 0; overflow: hidden; }
  .editor-body { background: var(--ui-editor-normal-surface); display: grid; min-width: 0; }
  .editor-sidebar, .folder-sidebar { border-right: 1px solid var(--ui-neutral-muted-border); color: var(--ui-muted-icon-glyph); display: flex; flex-direction: column; }
  .editor-sidebar button, .folder-sidebar button { align-items: center; background: transparent; border: 0; color: inherit; display: flex; justify-content: center; padding: 0; }
  .editor-sidebar button { flex: 0 0 32px; }
  .editor-sidebar button.drag { flex: 1 1 48px; }
  .editor-sidebar button:disabled { opacity: .35; }
  .folder-sidebar { justify-content: center; }
  .folder-sidebar button { height: 100%; }
  .prompt-title-bar { align-items: center; display: grid; grid-template-columns: 2px minmax(0, 1fr) auto; height: 59px; }
  .status-line { align-self: stretch; }
  .status-line.progress { background: var(--ui-warning-icon-glyph); }
  .prompt-title-main { align-items: center; display: grid; gap: 8px; grid-template-columns: 40px minmax(0, 1fr); padding: 8px 8px 8px 16px; }
  .title-icon { align-items: center; background: var(--ui-neutral-normal-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-secondary-icon-glyph); display: flex; height: 38px; justify-content: center; width: 38px; }
  .title-copy { display: grid; gap: 4px; min-width: 0; }
  .title-copy input { background: transparent; border: 0; color: var(--ui-normal-text); font-size: 15px; font-weight: 600; height: 22px; min-width: 0; outline: none; padding: 0; }
  .metadata { align-items: center; color: var(--ui-muted-text); display: flex; font-size: 12px; gap: 8px; min-width: 0; white-space: nowrap; }
  .metadata i { background: var(--ui-neutral-normal-border); border-radius: 50%; height: 3px; width: 3px; }
  .folder-label { align-items: center; color: var(--ui-secondary-text); display: flex; gap: 4px; }
  .title-actions, .folder-actions { align-items: center; display: flex; }
  .title-actions { gap: 3px; height: 100%; }
  .icon-action { align-items: center; background: transparent; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-secondary-icon-glyph); display: inline-flex; height: 30px; justify-content: center; padding: 0; width: 30px; }
  .icon-action:hover { background: var(--ui-neutral-action-hover-fill); color: var(--ui-hoverable-icon-glyph); }
  .icon-action.danger:hover { background: var(--ui-danger-action-fill); color: var(--ui-danger-icon-glyph); }
  .icon-action.active { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-normal-border); color: var(--ui-accent-normal-text); }
  .action-separator { align-self: stretch; background: var(--ui-neutral-normal-border); margin: 0 7px; width: 1px; }
  .status-button { align-items: center; align-self: stretch; background: transparent; border: 0; color: var(--ui-secondary-text); display: flex; gap: 7px; padding: 0 14px; }
  .status-button > span { border: 1px solid var(--ui-secondary-icon-glyph); border-radius: 50%; height: 9px; width: 9px; }
  .status-button > span.progress { background: var(--ui-warning-icon-glyph); border-color: var(--ui-warning-icon-glyph); }
  .separator { background: var(--ui-neutral-muted-border); height: 1px; }
  .editor-content, .setting-editor { background: var(--ui-editor-content-surface); display: grid; grid-template-columns: 38px minmax(0, 1fr); min-height: 72px; padding: 8px 10px 10px; }
  .line-numbers { color: var(--ui-muted-text); display: grid; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 20px; text-align: right; }
  textarea { background: transparent; border: 0; color: var(--ui-normal-text); font-family: 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 20px; min-height: 62px; outline: none; resize: none; width: 100%; }
  .folder-card { border-color: var(--ui-card-nested-border); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .folder-title-bar { align-items: center; display: grid; grid-template-columns: minmax(0, 1fr) auto; height: 59px; padding: 0 16px; }
  .folder-title-main { align-items: center; display: grid; gap: 10px; grid-template-columns: 30px 40px minmax(0, 1fr); }
  .folder-chevron { align-items: center; background: transparent; border: 0; color: var(--ui-secondary-icon-glyph); display: flex; height: 30px; justify-content: center; transform: rotate(90deg); width: 30px; }
  .folder-title-line { align-items: center; display: flex; gap: 5px; }
  .folder-title-line strong { color: var(--ui-normal-text); font-size: 16px; }
  .folder-actions { gap: 3px; }
  .folder-settings { display: grid; min-width: 0; position: relative; }
  .setting-section + .setting-section { border-top: 1px solid var(--ui-neutral-muted-border); }
  .setting-section > header { align-items: center; color: var(--ui-secondary-text); display: flex; font-size: 12px; height: 28px; justify-content: space-between; padding: 0 16px; }
  .setting-heading { display: flex; gap: 5px; min-width: 0; overflow: hidden; white-space: nowrap; }
  .setting-heading span { color: var(--ui-muted-text); overflow: hidden; text-overflow: ellipsis; }
  .setting-remove { align-items: center; background: transparent; border: 0; color: var(--ui-muted-icon-glyph); display: flex; height: 24px; justify-content: center; width: 24px; }
  .setting-remove:hover { color: var(--ui-danger-icon-glyph); }
  .setting-editor { min-height: 40px; }
  .setting-editor > span { color: var(--ui-muted-text); font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; padding-right: 12px; text-align: right; }
  .setting-editor textarea { min-height: 40px; }
  .settings-adder { align-items: center; background: var(--ui-editor-content-surface); border-top: 1px solid var(--ui-neutral-muted-border); display: flex; height: 44px; padding: 0 12px; position: relative; }
  .add-setting-trigger { align-items: center; background: transparent; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-secondary-text); display: inline-flex; font-size: 12px; font-weight: 600; gap: 7px; height: 30px; padding: 0 9px; }
  .add-setting-trigger:hover, .add-setting-trigger.open { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-normal-border); color: var(--ui-accent-normal-text); }
  .settings-menu { background: var(--ui-card-overlay-surface); border: 1px solid var(--ui-neutral-emphasis-border); border-radius: var(--cthulhu-ui-radius-card); bottom: 38px; box-shadow: 0 10px 28px var(--ui-card-normal-shadow); left: 12px; min-width: 360px; overflow: hidden; padding: 5px; position: absolute; z-index: 4; }
  .menu-title { color: var(--ui-muted-text); font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 7px 9px 6px; text-transform: uppercase; }
  .settings-menu button { align-items: center; background: transparent; border: 0; border-radius: var(--cthulhu-ui-radius-control); color: var(--ui-secondary-text); display: grid; gap: 10px; grid-template-columns: 28px minmax(0, 1fr) auto; padding: 9px; text-align: left; width: 100%; }
  .settings-menu button:hover { background: var(--ui-accent-action-fill); color: var(--ui-normal-text); }
  .menu-icon { align-items: center; background: var(--ui-neutral-normal-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); display: flex; height: 28px; justify-content: center; width: 28px; }
  .menu-copy { display: grid; gap: 3px; }
  .menu-copy strong { color: var(--ui-normal-text); font-size: 13px; }
  .menu-copy small { color: var(--ui-muted-text); font-size: 11px; }
  .settings-complete { align-items: center; background: var(--ui-editor-content-surface); border-top: 1px solid var(--ui-neutral-muted-border); color: var(--ui-muted-text); display: flex; font-size: 12px; gap: 7px; height: 44px; padding: 0 16px; }
  .folder-children { background: var(--ui-card-nested-surface); border-left: 1px solid var(--ui-card-nested-border); border-right: 1px solid var(--ui-card-nested-border); padding-inline: 12px; }
  .folder-cap { background: var(--ui-card-nested-surface); border: 1px solid var(--ui-card-nested-border); border-radius: 0 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card); border-top: 0; height: 8px; }
  button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--ui-neutral-focus-border); outline-offset: -2px; }
</style>
