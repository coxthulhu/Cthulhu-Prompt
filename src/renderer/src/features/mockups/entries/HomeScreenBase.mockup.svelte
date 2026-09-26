<script lang="ts">
  import {
    AlertCircle, AlertTriangle, ArrowRight, BookOpen, Bug, Check, ExternalLink, FileText,
    FolderOpen, FolderPlus, Folders, Home, Layers, X, Zap
  } from 'lucide-svelte'

  // Visual baseline of HomeScreen, WelcomeDialog, CreateWorkspaceDialog, and ErrorDialog.
  // Only Svelte, Lucide icons, and palette colors are shared with the application.
  // Native Windows pickers/Explorer are simulated locally; no preload, IPC, or domain imports.
  const sampleParent = 'C:\\Users\\Alex\\Documents\\Prompt Workspaces'
  const samplePath = `${sampleParent}\\Product Development`
  // Close the sample workspace to preview the empty state; Open restores these counts.
  const sampleCounts = { prompts: 24, folders: 3 }
  const welcomeSteps = [
    { icon: Home, title: 'Create a workspace', description: 'Choose a folder on your computer. Your tasks and templates live here as simple Markdown files, ready to commit to source control.' },
    { icon: Layers, title: 'Build a prompt template', description: "Use Prompt Templates to write a reusable workflow: investigate a bug, implement a feature with Q&A, or create mockups. Your task's text is added when you copy." },
    { icon: FileText, title: 'Add a prompt task', description: 'Open Task Prompts and add the change you want your AI to make. Include context, requirements, and details. Name your tasks and group them into custom categories.' },
    { icon: Zap, title: 'Pick a template. Copy and go.', description: 'Use the quick template button in the prompt editor to assign a template, or choose no template, and copy the combined text. Paste into your AI tool and send it off!' }
  ]
  const errorText = 'Failed to open workspace. Please try again.'
  type FolderScenario = 'empty' | 'nonempty' | 'existing' | 'failure'

  // Local sample state keeps the screen and its dialog variants independent of the workspace.
  let workspacePath = $state<string | null>(samplePath)
  let promptCount = $state(sampleCounts.prompts)
  let promptFolderCount = $state(sampleCounts.folders)
  // Edit these local switches to preview disabled actions, folder warnings, and open errors.
  let loading = $state(false)
  let folderScenario = $state<FolderScenario>('empty')
  let openFails = $state(false)
  let dialog = $state<'create' | 'error' | 'welcome' | null>(null)
  let workspaceName = $state('')
  let containingFolder = $state('')
  let includeExamples = $state(true)
  let nameTouched = $state(false)
  let submissionError = $state(false)
  let creating = $state(false)
  let createTimer: number | undefined

  // Derived display values mirror the live name normalization and Windows path presentation.
  const workspaceFolderName = $derived(workspacePath?.split(/[\\/]/).filter(Boolean).pop() ?? '')
  const folderName = $derived(workspaceName.trim().replace(/\s+/g, ''))
  const finalPath = $derived(containingFolder.trim() && folderName
    ? `${containingFolder.trim().replace(/[\\/]+$/, '')}\\${folderName}` : '')
  const nameError = $derived.by(() => {
    if (!workspaceName.trim()) return 'Workspace name cannot be empty'
    if (workspaceName.length > 100) return 'Workspace name must be 100 characters or less'
    // eslint-disable-next-line no-control-regex
    if (/[<>:"/\\|?*\x00-\x1f]/.test(workspaceName)) {
      return 'Workspace name contains illegal characters: < > : " / \\ | ? *'
    }
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(folderName)) {
      return 'This is a reserved system name and cannot be used'
    }
    if (workspaceName.startsWith('.') || workspaceName.endsWith('.')) {
      return 'Workspace name cannot start or end with dots'
    }
    return null
  })
  const pathMessage = $derived(!finalPath ? null : folderScenario === 'existing'
    ? 'A workspace already exists at this path.' : folderScenario === 'nonempty'
      ? 'This folder is not empty. Typically, you should create a workspace in an empty folder.'
      : null)
  const canCreate = $derived(Boolean(finalPath && !nameError && folderScenario !== 'existing' && !creating && !loading))

  const closeDialog = () => {
    if (creating) return
    dialog = null
    workspaceName = ''
    containingFolder = ''
    includeExamples = true
    nameTouched = false
    submissionError = false
  }

  const openWorkspace = () => {
    if (openFails) {
      dialog = 'error'
      return
    }
    dialog = null
    workspacePath = samplePath
    promptCount = sampleCounts.prompts
    promptFolderCount = sampleCounts.folders
  }

  const createWorkspace = () => {
    if (!canCreate) return
    submissionError = false
    creating = true
    createTimer = window.setTimeout(() => {
      creating = false
      if (folderScenario === 'failure') {
        submissionError = true
        return
      }
      workspacePath = finalPath
      promptCount = includeExamples ? 2 : 0
      promptFolderCount = 2
      closeDialog()
    }, 1200)
  }

  const closeWorkspace = () => {
    workspacePath = null
    promptCount = 0
    promptFolderCount = 0
  }

  // Side effect cleanup: a discarded mockup must not finish a pending creation.
  $effect(() => () => {
    window.clearTimeout(createTimer)
  })

  const mountDialog = (node: HTMLDivElement) => {
    // Side effect: cover the viewport, contain keyboard focus, and restore focus when dismissed.
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.appendChild(node)
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')]
    node.querySelector<HTMLInputElement>('input')?.focus()
    if (!node.contains(document.activeElement)) focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeDialog()
      }
      if (event.key === 'Tab') {
        const items = focusable()
        const first = items[0]
        const last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown, true)
    return { destroy: () => {
      document.removeEventListener('keydown', keydown, true)
      node.remove()
      previousFocus?.focus()
    } }
  }
</script>

{#snippet message(text: string, warning = false, testId?: string)}
  <div class="message text-sm" data-warning={warning} data-testid={testId} role="status">
    {#if warning}<AlertTriangle size={16} aria-hidden="true" />{:else}<AlertCircle size={16} aria-hidden="true" />{/if}
    {text}
  </div>
{/snippet}

<section class="home-base text-base" data-testid="base-home-mockup">
  <main class="home-screen" data-testid="home-screen">
    <section class="home-layout" data-testid="home-layout">
      <header class="flex flex-wrap items-end justify-between gap-5">
        <h1 class="home-title m-0 text-6xl leading-none font-semibold" data-testid="home-title">
          Cthulhu <span>Prompt</span>
        </h1>
        <div class="flex items-center gap-2">
          <button
            class="action-button text-sm leading-5"
            type="button"
            data-variant={workspacePath ? 'neutral' : 'accent'}
            data-appearance={workspacePath ? 'outline' : 'filled'}
            data-testid="show-welcome-button"
            onclick={() => { dialog = 'welcome' }}
          ><BookOpen size={16} aria-hidden="true" /><span>Welcome</span></button>
          <a
            class="action-button text-sm leading-5"
            data-appearance="outline"
            href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
            target="_blank"
            rel="noreferrer"
            data-testid="get-started-github-issues-link"
          ><Bug size={16} aria-hidden="true" /><span>Github</span><ExternalLink size={16} aria-hidden="true" /></a>
        </div>
      </header>

      <div class="card-surface overflow-hidden" role="region" aria-label="Workspace" data-testid="home-primary-card">
        <div class="home-row">
          <span class="row-icon"><FolderOpen size={32} strokeWidth={1.5} aria-hidden="true" /></span>
          <span class="row-text-stack">
            <span class="row-label text-2xl leading-8" title={workspacePath ? workspaceFolderName : undefined}>
              {workspacePath ? workspaceFolderName : 'No workspace open'}
            </span>
            <span class="row-detail text-sm" title={workspacePath ?? undefined} data-testid={workspacePath ? 'workspace-ready-path' : undefined}>
              {workspacePath ?? 'Open a workspace or create one to get started.'}
            </span>
          </span>
          <button
            class="icon-button"
            type="button"
            aria-label="Open Workspace Folder"
            title="Open Workspace Folder"
            data-testid="home-open-workspace-folder-button"
            disabled={!workspacePath}
            onclick={() => { /* Native Explorer is outside this self-contained visual preview. */ }}
          ><ExternalLink size={20} aria-hidden="true" /></button>
        </div>
        <div class="separator"></div>
        <div class="flex flex-wrap items-center justify-between gap-5 p-4">
          <div class="flex flex-wrap items-center gap-[22px]">
            <span class="count-display text-sm leading-5" data-testid="home-prompt-count-stat">
              <FileText size={18} class="shrink-0" aria-hidden="true" />
              <strong class="text-base leading-6 font-semibold">{promptCount}</strong>
              <span>Prompts</span>
            </span>
            <span class="count-display text-sm leading-5" data-testid="home-prompt-folder-count-stat">
              <Folders size={18} class="shrink-0" aria-hidden="true" />
              <strong class="text-base leading-6 font-semibold">{promptFolderCount}</strong>
              <span>Prompt Folders</span>
            </span>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <button class="action-button text-sm leading-5" type="button" data-variant="accent" data-testid="open-workspace-button" disabled={loading} onclick={openWorkspace}>
              <FolderOpen size={16} aria-hidden="true" /><span>Open</span>
            </button>
            <button class="action-button text-sm leading-5" type="button" data-variant={workspacePath ? 'neutral' : 'accent'} data-appearance={workspacePath ? 'outline' : 'filled'} data-testid="create-workspace-button" disabled={loading} onclick={() => { dialog = 'create' }}>
              <FolderPlus size={16} aria-hidden="true" /><span>Create</span>
            </button>
            <button class="action-button text-sm leading-5" type="button" data-appearance="outline" data-testid="close-workspace-button" disabled={!workspacePath || loading} onclick={closeWorkspace}>
              <X size={16} aria-hidden="true" /><span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</section>

{#if dialog}
  <div class="dialog-layer text-base" role="presentation" use:mountDialog onclick={(event) => { if (event.target === event.currentTarget && dialog === 'error') closeDialog() }}>
    <div class="home-dialog" data-create={dialog === 'create'} data-welcome={dialog === 'welcome'} role="dialog" aria-modal="true" aria-label={dialog === 'create' ? 'Create Workspace' : dialog === 'welcome' ? 'Welcome to Cthulhu Prompt' : 'Failed to Open Workspace'} tabindex="-1">
      <div class="dialog-header">
        <div class="dialog-heading">
          <span class="dialog-icon" data-testid="dialog-header-icon">
            {#if dialog === 'create'}<FolderPlus size={24} aria-hidden="true" />{:else if dialog === 'welcome'}<BookOpen size={24} aria-hidden="true" />{:else}<AlertCircle size={24} aria-hidden="true" />{/if}
          </span>
          <div class="dialog-heading-text">
            <h3 class="dialog-title text-lg">{dialog === 'create' ? 'Create Workspace' : dialog === 'welcome' ? 'Welcome to Cthulhu Prompt' : 'Failed to Open Workspace'}</h3>
            {#if dialog === 'create'}<p class="dialog-subtitle text-sm" data-testid="dialog-subtitle">Choose a name and location for your new workspace.</p>{:else if dialog === 'welcome'}<p class="dialog-subtitle text-sm" data-testid="dialog-subtitle">Your first prompt, from workspace to clipboard.</p>{/if}
          </div>
        </div>
        <button type="button" class="icon-button" aria-label="Close" disabled={creating} onclick={closeDialog}><X size={20} aria-hidden="true" /></button>
      </div>
      <div class="separator"></div>
      {#if dialog === 'create'}
        <div class="dialog-body grid min-w-0 gap-[17px] px-4 py-4">
          <div>
            <div class="field-heading"><label for="mock-workspace-name" class="text-sm font-semibold">Workspace Name <span class="muted font-normal">*</span></label><span class="muted text-sm">Enter a name for the new workspace.</span></div>
            <div class="validation-anchor">
              <input id="mock-workspace-name" class="name-input text-sm leading-5" type="text" placeholder="Name..." data-testid="create-workspace-name-input" bind:value={workspaceName} disabled={creating} aria-invalid={nameTouched && nameError ? 'true' : undefined} oninput={() => { nameTouched = true; submissionError = false }} />
              {#if nameTouched && nameError}<div class="floating-validation">{@render message(nameError, false, 'create-workspace-name-error')}</div>{/if}
            </div>
          </div>
          <div>
            <div class="field-heading"><label for="mock-containing-folder" class="text-sm font-semibold">Containing Folder</label><span class="muted text-sm">Choose the folder that will contain the workspace.</span></div>
            <div class="flex min-w-0 gap-2">
              <input id="mock-containing-folder" class="name-input min-w-0 flex-1 text-sm leading-5" value={containingFolder} placeholder="Select a folder..." data-testid="create-workspace-containing-folder-display" disabled />
              <button class="action-button text-sm leading-5" type="button" aria-label="Browse for containing folder" data-testid="create-workspace-path-browse-button" disabled={creating} onclick={() => { containingFolder = sampleParent }}><FolderOpen size={16} aria-hidden="true" /><span>Browse</span></button>
            </div>
          </div>
          <div>
            <div class="field-heading"><label for="mock-final-path" class="text-sm font-semibold">Workspace Path</label><span class="muted text-sm">Review the full path to the workspace.</span></div>
            <input id="mock-final-path" class="name-input text-sm leading-5" value={finalPath} data-testid="create-workspace-final-path-display" aria-invalid={folderScenario === 'existing' ? 'true' : undefined} disabled />
          </div>
          {#if pathMessage}{@render message(pathMessage, folderScenario === 'nonempty', 'create-workspace-final-path-message')}{/if}
          {#if submissionError}{@render message('Failed to create workspace. Please try again.', false, 'create-workspace-submit-error')}{/if}
          <div>
            <div class="field-heading"><span class="text-sm font-semibold">Add Examples</span><span class="muted text-sm">Include example prompts and templates in the My Prompts and My Templates folders.</span></div>
            <button class="examples-toggle text-sm leading-5" type="button" aria-pressed={includeExamples} data-testid="create-workspace-examples-toggle" disabled={creating} onclick={() => { includeExamples = !includeExamples }}>
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-label">{includeExamples ? 'Enabled' : 'Disabled'}</span>
            </button>
          </div>
        </div>
      {:else if dialog === 'welcome'}
        <div class="welcome-content">
          <ol class="m-0 list-none px-3" data-testid="welcome-steps">
            {#each welcomeSteps as step, index (step.title)}
              <li class="welcome-step text-sm leading-6">
                <span class="step-number text-xl leading-10 font-semibold">{index + 1}</span>
                <div class="min-w-0">
                  <div class="step-heading">
                    <step.icon size={19} aria-hidden="true" />
                    <h2 class="text-base leading-6 font-semibold">{step.title}</h2>
                    {#if index === 1}<span class="step-badge text-sm leading-5">Optional</span>{/if}
                  </div>
                  <p>{step.description}</p>
                  <div class="step-tip text-sm leading-5">
                    {#if index === 0}
                      <span class="screen-icons" aria-hidden="true"><Home size={14} /><FileText size={14} /><Layers size={14} /></span>
                      <span>Use the left-hand icon bar to switch screens.</span>
                    {:else if index === 1}
                      <span class="workflow">Investigate a bug</span>
                      <span class="workflow">Implement a feature</span>
                      <span class="workflow">Create mockups</span>
                    {:else if index === 2}
                      Backlog<ArrowRight size={14} aria-hidden="true" />
                      Todo<ArrowRight size={14} aria-hidden="true" />
                      In Progress<ArrowRight size={14} aria-hidden="true" />
                      <span class="completed">Completed</span>
                    {:else}
                      <span class="step-check"><Check size={16} aria-hidden="true" /></span>
                      <span class="min-w-0 flex-1">When the AI finishes, check off the task to move it to Completed.</span>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        </div>
      {:else}
        <div class="error-body">
          <section><h4 class="text-sm">Message</h4><p class="text-sm">The workspace could not be opened.</p></section>
          <section><h4 class="text-sm">Details</h4><pre class="text-sm leading-6">{errorText}</pre></section>
        </div>
      {/if}
      <div class="separator"></div>
      <div class="dialog-footer">
        {#if dialog === 'welcome'}
          <button class="action-button text-sm leading-5" type="button" data-testid="welcome-open-workspace-button" onclick={openWorkspace}><FolderOpen size={16} aria-hidden="true" />Open Workspace</button>
          <button class="action-button text-sm leading-5" type="button" data-variant="accent" data-testid="welcome-create-workspace-button" onclick={() => { dialog = 'create' }}><FolderPlus size={16} aria-hidden="true" />Create Workspace</button>
        {:else}
        <button class="action-button text-sm" type="button" disabled={creating} onclick={closeDialog}>{dialog === 'create' ? 'Cancel' : 'Close'}</button>
        {/if}
        {#if dialog === 'create'}<button class="action-button text-sm" type="button" data-variant="accent" data-testid="create-workspace-submit-button" disabled={!canCreate} onclick={createWorkspace}>{creating ? 'Creating...' : 'Create Workspace'}</button>{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .home-base, .dialog-layer {
    color: var(--ui-normal-text);
    font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  }
  .home-base *, .dialog-layer * { box-sizing: border-box; }
  .home-base { min-width: 0; min-height: 100%; display: flex; flex-direction: column; }
  .home-screen { display: flex; flex: 1; min-width: 0; overflow-y: auto; padding: 48px 32px; }
  .home-layout { display: flex; flex-direction: column; gap: 30px; width: 100%; max-width: 780px; min-width: 0; margin: auto; }
  .home-title { color: var(--ui-normal-text); font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.055em; }
  .home-title span { color: var(--ui-accent-link-text); }
  .card-surface { width: 100%; min-width: 0; border-radius: 8px; background: var(--ui-card-normal-surface); border: 1px solid var(--ui-neutral-muted-border); }
  .home-row { display: flex; align-items: center; column-gap: 12px; row-gap: 8px; min-width: 0; width: 100%; padding: 16px; border-radius: 8px; text-align: left; }
  .row-icon { display: flex; flex: 0 0 40px; width: 40px; height: 40px; align-items: center; justify-content: center; color: var(--ui-hoverable-icon-glyph); }
  .row-text-stack { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
  .row-label, .row-detail { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-label { font-weight: var(--font-weight-semibold); letter-spacing: -0.03em; }
  .row-detail { color: var(--ui-muted-text); }
  .separator { flex-shrink: 0; width: 100%; height: 1px; border-top: 1px solid var(--ui-neutral-muted-border); }
  .count-display { display: inline-flex; align-items: center; gap: 8px; color: var(--ui-muted-text); }
  .count-display strong { color: var(--ui-normal-text); }
  .action-button, .examples-toggle { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; min-width: 0; height: 40px; padding: 0 14px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-neutral-action-fill); color: var(--ui-normal-text); font-family: inherit; font-weight: var(--font-weight-semibold); white-space: nowrap; text-decoration: none; cursor: pointer; }
  .action-button :global(svg) { flex: 0 0 auto; }
  .action-button { max-width: 224px; overflow: hidden; }
  .action-button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .action-button:hover, .action-button:focus-visible, .examples-toggle:hover { background: var(--ui-neutral-action-hover-fill); border-color: var(--ui-neutral-hover-border); }
  .action-button[data-variant='accent'], .examples-toggle[aria-pressed='true'] { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-muted-border); }
  .action-button[data-variant='accent']:hover, .action-button[data-variant='accent']:focus-visible, .examples-toggle[aria-pressed='true']:hover { background: var(--ui-accent-action-hover-fill); border-color: var(--ui-accent-muted-hover-border); }
  .action-button[data-appearance='outline'] { background: var(--ui-ghost-surface); color: var(--ui-hoverable-text); }
  .action-button[data-appearance='outline']:hover, .action-button[data-appearance='outline']:focus-visible { background: var(--ui-neutral-subtle-action-hover-fill); color: var(--ui-normal-text); }
  .icon-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-ghost-surface); color: var(--ui-hoverable-icon-glyph); cursor: pointer; }
  .icon-button:hover, .icon-button:focus-visible { color: var(--ui-normal-text); background: var(--ui-neutral-action-fill); border-color: var(--ui-neutral-hover-border); }
  button:disabled, input:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--ui-neutral-focus-border); outline-offset: 2px; }
  .dialog-layer { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--ui-card-normal-shadow); -webkit-app-region: no-drag; }
  .home-dialog { display: flex; flex-direction: column; width: 100%; max-width: 576px; max-height: calc(100vh - 32px); min-width: 0; padding: 16px; border-radius: 8px; border: 1px solid var(--ui-card-normal-border); background: var(--ui-card-overlay-surface); box-shadow: 0 8px 12px var(--ui-card-normal-shadow); }
  .home-dialog[data-create='true'] { max-width: 620px; }
  .home-dialog[data-create='true'], .home-dialog[data-welcome='true'] { padding-top: 18px; }
  .dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; padding: 0 4px 12px; }
  .home-dialog[data-create='true'] .dialog-header, .home-dialog[data-welcome='true'] .dialog-header { padding-bottom: 16px; }
  .dialog-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .dialog-heading-text { min-width: 0; }
  .dialog-icon { color: var(--ui-hoverable-icon-glyph); display: flex; flex: 0 0 40px; align-items: center; justify-content: center; width: 40px; height: 40px; }
  .dialog-title { margin: 0; font-weight: var(--font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dialog-subtitle { margin: 2px 0 0; color: var(--ui-muted-text); }
  .dialog-body { min-width: 0; }
  .field-heading { display: flex; flex-direction: column; gap: 2px; margin-bottom: 7px; }
  .muted { color: var(--ui-muted-text); }
  .home-dialog[data-welcome='true'] { max-width: 800px; }
  .welcome-content { min-height: 0; overflow-y: auto; }
  .welcome-step { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 18px; padding: 20px 0; color: var(--ui-hoverable-text); }
  .welcome-step:not(:first-child) { border-top: 1px solid var(--ui-neutral-muted-border); }
  .step-number { width: 42px; height: 42px; text-align: center; border: 1px solid var(--ui-accent-muted-border); border-radius: 50%; color: var(--ui-normal-text); background: var(--ui-accent-action-fill); }
  .step-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-bottom: 6px; color: var(--ui-normal-text); }
  .step-heading :global(svg) { flex-shrink: 0; color: var(--ui-hoverable-icon-glyph); }
  .step-badge { padding: 0 8px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 4px; color: var(--ui-muted-text); }
  .step-tip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; color: var(--ui-muted-text); }
  .screen-icons { display: flex; gap: 10px; padding: 5px 9px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 5px; color: var(--ui-muted-icon-glyph); }
  .workflow { padding: 2px 9px; border-radius: 4px; background: var(--ui-neutral-field-surface); }
  .completed { color: var(--ui-normal-text); }
  .step-check { flex-shrink: 0; color: var(--ui-hoverable-icon-glyph); }
  .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; min-width: 0; padding-top: 16px; }
  .name-input { display: flex; width: 100%; max-width: 100%; min-width: 0; height: 40px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-neutral-field-surface); color: var(--ui-normal-text); padding: 4px 14px; font-family: inherit; font-weight: var(--font-weight-semibold); outline: none; }
  .name-input::placeholder { color: var(--ui-muted-text); }
  .name-input:focus-visible { border-color: var(--ui-neutral-focus-border); box-shadow: 0 0 0 3px var(--ui-neutral-emphasis-surface); }
  .name-input[aria-invalid='true'] { border-color: var(--ui-danger-strong-border); }
  .name-input[aria-invalid='true']:focus-visible { box-shadow: 0 0 0 3px var(--ui-danger-normal-ring); }
  .validation-anchor { position: relative; min-width: 0; }
  .floating-validation { position: absolute; left: 0; top: 100%; z-index: 10; margin-top: 2px; white-space: nowrap; }
  .message { display: inline-flex; align-items: center; gap: 8px; height: 44px; border-radius: 6px; padding: 0 12px; background: var(--ui-danger-normal-surface); color: var(--ui-normal-text); }
  .message :global(svg) { flex-shrink: 0; color: var(--ui-danger-icon-glyph); }
  .message[data-warning='true'] { background: var(--ui-warning-normal-surface); }
  .message[data-warning='true'] :global(svg) { color: var(--ui-warning-icon-glyph); }
  .floating-validation .message { box-shadow: 0 8px 18px var(--ui-card-normal-shadow); background: color-mix(in oklch, var(--ui-card-solid-surface) 76%, var(--ui-danger-strong-border)); }
  .examples-toggle { gap: 12px; }
  .toggle-track { display: flex; align-items: center; justify-content: flex-start; width: 40px; height: 24px; padding: 4px; border-radius: 999px; background: var(--ui-neutral-emphasis-surface); }
  .examples-toggle[aria-pressed='true'] .toggle-track { justify-content: flex-end; background: var(--ui-accent-action-fill); }
  .toggle-thumb { width: 16px; height: 16px; border-radius: 999px; background: var(--ui-normal-text); box-shadow: 0 1px 2px var(--ui-shadow-raised); }
  .toggle-label { width: 64px; text-align: left; }
  .error-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 0; }
  .error-body h4 { margin: 0 0 8px; font-weight: var(--font-weight-semibold); }
  .error-body p { margin: 0; padding-left: 8px; }
  .error-body pre { margin: 0; border-radius: 6px; padding: 12px; background: var(--ui-neutral-field-surface); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-x: auto; white-space: pre-wrap; }
</style>
