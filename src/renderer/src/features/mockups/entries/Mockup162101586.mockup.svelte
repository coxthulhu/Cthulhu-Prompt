<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import {
    AlertCircle, AlertTriangle, BookOpen, Bug, ClipboardCheck, Copy, ExternalLink, FileText,
    FolderOpen, FolderPlus, Folders, FolderSymlink, Home, Layers, Zap, Check, ArrowRight, X
  } from 'lucide-svelte'

  // Visual baseline of HomeScreen, WelcomeDialog, CreateWorkspaceDialog, and ErrorDialog.
  // Only Svelte, Lucide icons, and palette colors are shared with the application.
  // Native Windows pickers/Explorer are simulated locally; no preload, IPC, or domain imports.
  const sampleParent = 'C:\\Users\\Alex\\Documents\\Prompt Workspaces'
  const samplePath = `${sampleParent}\\Product Development`
  const errorText = 'Failed to open workspace. Please try again.'
  type FolderScenario = 'empty' | 'nonempty' | 'existing' | 'failure'

  // Local sample state keeps the screen and its dialog variants independent of the workspace.
  let workspacePath = $state<string | null>(samplePath)
  let promptCount = $state(24)
  let promptFolderCount = $state(3)
  // Edit these local switches to preview disabled actions, folder warnings, and open errors.
  let loading = $state(false)
  let folderScenario = $state<FolderScenario>('empty')
  let openFails = $state(false)
  let dialog = $state<'create' | 'error' | 'welcome' | null>('welcome')
  let workspaceName = $state('')
  let containingFolder = $state('')
  let includeExamples = $state(true)
  let nameTouched = $state(false)
  let submissionError = $state(false)
  let creating = $state(false)
  let copied = $state(false)
  let copyTimer: number | undefined
  let createTimer: number | undefined
  let titleContainer = $state<HTMLDivElement | null>(null)
  let titleMeasure = $state<HTMLSpanElement | null>(null)
  let titleFontSize = $state<number | null>(null)

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
  const canCreate = $derived(Boolean(finalPath && !nameError && folderScenario !== 'existing' && !creating))

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
    promptCount = 24
    promptFolderCount = 3
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

  const copyPath = () => {
    // Simulate the live feedback without changing the system clipboard in a visual sandbox.
    copied = true
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => { copied = false }, 1500)
  }

  // Side effect: measure both title layouts to preserve the live width-driven font scaling.
  $effect(() => {
    const container = titleContainer
    const measure = titleMeasure
    if (!container || !measure) return
    const update = () => {
      titleFontSize = container.getBoundingClientRect().width / measure.getBoundingClientRect().width * 100
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(measure)
    return () => observer.disconnect()
  })

  // Side effect cleanup: a discarded mockup must not finish a pending creation or copy animation.
  $effect(() => () => {
    window.clearTimeout(copyTimer)
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

{#snippet row(Icon: ComponentType, label: string, detail: string, trailing?: Snippet, wrap = false, labelId?: string)}
  <div class="home-row" data-wrap-detail={wrap} data-trailing={Boolean(trailing)}>
    <span class="row-icon"><Icon size={24} aria-hidden="true" /></span>
    <span class="row-text-stack">
      <span class="row-label text-base" title={label} data-testid={labelId}>{label}</span>
      <span class="row-detail text-sm">{detail}</span>
    </span>
    {#if trailing}<span class="row-trailing">{@render trailing()}</span>{/if}
  </div>
{/snippet}

{#snippet message(text: string, warning = false, testId?: string)}
  <div class="message text-sm" data-warning={warning} data-testid={testId} role="status">
    {#if warning}<AlertTriangle size={16} aria-hidden="true" />{:else}<AlertCircle size={16} aria-hidden="true" />{/if}
    {text}
  </div>
{/snippet}

<section class="home-base text-base" data-testid="base-home-mockup">
  <main class="home-screen" data-testid="home-screen">
    <div class="home-center">
      <section class="home-layout" data-testid="home-layout">
        <header>
          <div class="title-container" bind:this={titleContainer}>
            <h2 class="text-[length:var(--home-title-size,clamp(64px,9vw,88px))] leading-[var(--home-title-size,clamp(64px,9vw,88px))] home-title" data-testid="home-title" aria-label="CTHULHU PROMPT" style:--home-title-size={titleFontSize ? `${titleFontSize}px` : undefined}>
              <span aria-hidden="true" data-testid="home-title-word-cthulhu">CTHULHU</span>
              <span aria-hidden="true" data-testid="home-title-word-prompt">PROMPT</span>
            </h2>
            <div class="title-separator" data-testid="home-title-separator"></div>
          </div>
        </header>
        <span class="text-[length:var(--home-title-size,clamp(64px,9vw,88px))] leading-[var(--home-title-size,clamp(64px,9vw,88px))] home-title title-measure" bind:this={titleMeasure} aria-hidden="true"><span>CTHULHU</span><span>PROMPT</span></span>

        <div class="home-card-grid">
          <div class="home-card" data-testid="home-primary-card">
            <h3 class="card-label text-lg">{workspacePath ? 'Current Workspace' : 'Get Started'}</h3>
            <div class="card-surface">
              {#if workspacePath}
                {#snippet explorerAction()}
                  <button class="icon-button" type="button" aria-label="Open Workspace Folder" title="Open Workspace Folder" data-testid="home-open-workspace-folder-button" onclick={() => { /* Explorer is intentionally simulated without changing the workspace. */ }}><ExternalLink size={20} aria-hidden="true" /></button>
                {/snippet}
                {@render row(FolderOpen, workspaceFolderName, 'Workspace Name', explorerAction)}
                <div class="separator"></div>
                {#snippet copyAction()}
                  <button class="icon-button" type="button" aria-label={copied ? 'Copied' : 'Copy workspace path'} title={copied ? 'Copied' : 'Copy workspace path'} data-testid="copy-workspace-path-button" onclick={copyPath}>
                    {#if copied}<ClipboardCheck size={20} aria-hidden="true" />{:else}<Copy size={20} aria-hidden="true" />{/if}
                  </button>
                {/snippet}
                {@render row(FolderSymlink, workspacePath, 'Workspace Path', copyAction, false, 'workspace-ready-path')}
                <div class="separator"></div>
                <div class="workspace-stats">
                  {@render row(FileText, String(promptCount), 'Prompts')}
                  <div class="vertical-separator"></div>
                  {@render row(Folders, String(promptFolderCount), 'Prompt Folders')}
                </div>
              {:else}
                {@render row(FolderPlus, 'Choose a Workspace', 'Create a new workspace folder, or open an existing one to continue.')}
                <div class="separator"></div>
                {@render row(FileText, 'Manage Your Prompts', 'Cthulhu Prompt stores and manages your prompts as simple Markdown files in a workspace folder.', undefined, true)}
                <div class="separator"></div>
                {#snippet githubAction()}
                  <a class="action-button text-sm" data-variant="accent" href="https://github.com/coxthulhu/Cthulhu-Prompt/issues" target="_blank" rel="noreferrer" data-testid="get-started-github-issues-link">Open Github <ExternalLink size={16} aria-hidden="true" /></a>
                {/snippet}
                {@render row(Bug, 'Report an Issue', 'Report bugs or request features!', githubAction)}
              {/if}
            </div>
          </div>
          <div class="home-card workspace-actions-card" data-testid="home-workspace-actions-card">
            <h3 class="card-label text-lg">Workspace Actions</h3>
            <div class="card-surface">
              {#each [
                { icon: FolderOpen, label: 'Open Workspace', detail: 'Open an existing workspace.', text: 'Open', action: openWorkspace },
                { icon: FolderPlus, label: 'Create Workspace', detail: 'Choose a folder to set up a new workspace.', text: 'Create', action: () => { dialog = 'create' as const } },
                ...(workspacePath ? [{ icon: X, label: 'Close Workspace', detail: 'Unload the current workspace folder.', text: 'Close', action: () => { workspacePath = null } }] : [{ icon: BookOpen, label: 'Welcome', detail: 'Learn to use Cthulhu Prompt.', text: 'Welcome', action: () => { dialog = 'welcome' as const } }])
              ] as action, index (action.text)}
                {#if index > 0}<div class="separator"></div>{/if}
                {#snippet actionControl()}
                  <button class="action-button text-sm leading-5" class:workspace-action={action.text !== 'Welcome'} type="button" data-variant={workspacePath ? 'neutral' : 'accent'} data-appearance={workspacePath ? 'outline' : 'filled'} data-testid={action.text === 'Welcome' ? 'show-welcome-button' : `${action.text.toLowerCase()}-workspace-button`} disabled={loading} onclick={action.action}>
                    <action.icon size={16} aria-hidden="true" /><span>{action.text}</span>
                  </button>
                {/snippet}
                {@render row(action.icon, action.label, action.detail, actionControl)}
              {/each}
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</section>

{#if dialog}
  <div class="dialog-layer text-base" role="presentation" use:mountDialog onclick={(event) => { if (event.target === event.currentTarget && dialog === 'error') closeDialog() }}>
    <div class="home-dialog" style={dialog === 'welcome' ? 'max-width: 900px; padding: 24px; border-radius: 16px;' : undefined} data-create={dialog === 'create'} data-welcome={dialog === 'welcome'} role="dialog" aria-modal="true" aria-label={dialog === 'create' ? 'Create Workspace' : dialog === 'welcome' ? 'Welcome' : 'Failed to Open Workspace'} tabindex="-1">
      <div class="dialog-header">
        <div class="dialog-heading">
          <span class="dialog-icon" data-testid="dialog-header-icon">
            {#if dialog === 'create'}<FolderPlus size={24} aria-hidden="true" />{:else if dialog === 'welcome'}<BookOpen size={24} aria-hidden="true" />{:else}<AlertCircle size={24} aria-hidden="true" />{/if}
          </span>
          <div class="dialog-heading-text">
            <h3 class="dialog-title text-lg">{dialog === 'create' ? 'Create Workspace' : dialog === 'welcome' ? 'Welcome to Cthulhu Prompt' : 'Failed to Open Workspace'}</h3>
            {#if dialog === 'welcome'}<p class="text-sm leading-5" style="margin: 3px 0 0; color: var(--ui-muted-text);">Your first prompt, in four steps.</p>{/if}
            {#if dialog === 'create'}<p class="dialog-subtitle text-sm" data-testid="dialog-subtitle">Choose a name and location for your new workspace.</p>{/if}
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
        <div class="welcomeContent text-sm leading-5" style="padding: 20px 0;">
          <ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;">
            {#each [
              { number: '01', icon: Home, title: 'Make a workspace', optional: false, body: 'Create a folder on your computer to hold your tasks and templates as simple Markdown files. Commit it to source control for easy versioning.', note: 'Use the icons on the left to switch screens.' },
              { number: '02', icon: Layers, title: 'Make a prompt template', optional: true, body: 'Open Templates and write a reusable workflow: investigate a bug, plan a feature with Q&A, or create mockups. Your task provides the specific request.', note: '' },
              { number: '03', icon: FileText, title: 'Make a prompt task', optional: false, body: 'Open Tasks and describe a change. Add the context, requirements, and details your AI needs. Give it a name and organize it into your own categories.', note: 'Track work from Backlog to Todo, In Progress, and Completed.' },
              { number: '04', icon: Zap, title: 'Pick a template. Copy and go.', optional: false, body: 'Use Quick Template on a task to choose a template—or none—and copy the combined prompt. Paste it into your AI tool to get started.', note: 'When the work is done, check the task to move it to Completed.' }
            ] as step (step.number)}
              <li style="display: flex; gap: 16px; padding: 17px 18px; border: 1px solid var(--ui-neutral-muted-border); border-radius: 10px; background: var(--ui-card-normal-surface);">
                <div style="display: flex; flex: 0 0 42px; flex-direction: column; align-items: center; gap: 12px;">
                  <span class="text-xl leading-6 font-semibold" style="font-variant-numeric: tabular-nums; color: var(--ui-accent-link-text);">{step.number}</span>
                  <span style="display: flex; color: var(--ui-secondary-icon-glyph);"><step.icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 7px;">
                    <h2 class="text-base leading-6 font-semibold" style="margin: 0;">{step.title}</h2>
                    {#if step.optional}<span class="text-xs leading-4" style="padding: 2px 7px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 5px; color: var(--ui-muted-text);">Optional</span>{/if}
                  </div>
                  <p style="margin: 0; color: var(--ui-secondary-text);">{step.body}</p>
                  {#if step.note}<p class="text-xs leading-5" style="margin: 6px 0 0; color: var(--ui-muted-text);">{step.note}</p>{/if}
                </div>
                <div style="flex: 0 1 205px; min-width: 130px; display: flex; flex-direction: column; justify-content: center; gap: 7px; padding-left: 17px; border-left: 1px solid var(--ui-neutral-muted-border);">
                  {#if step.number === '01'}
                    <div class="text-xs leading-5 font-semibold" style="display: flex; align-items: center; gap: 7px;"><FolderOpen size={15} aria-hidden="true" />Product Development</div>
                    <div class="text-xs leading-5" style="display: flex; gap: 7px; margin-left: 20px; color: var(--ui-muted-text);"><FileText size={14} aria-hidden="true" />Tasks</div>
                    <div class="text-xs leading-5" style="display: flex; gap: 7px; margin-left: 20px; color: var(--ui-muted-text);"><Layers size={14} aria-hidden="true" />Templates</div>
                  {:else if step.number === '02'}
                    <span class="text-xs leading-4" style="color: var(--ui-muted-text);">Templates</span>
                    <div class="text-xs leading-5" style="display: flex; align-items: center; gap: 7px; padding: 7px 9px; border: 1px solid var(--ui-accent-muted-border); border-radius: 6px; background: var(--ui-accent-action-fill); color: var(--ui-normal-text);"><Layers size={14} aria-hidden="true" />Investigate a bug</div>
                    <span class="text-xs leading-4" style="padding-left: 9px; color: var(--ui-muted-text);">Implement a feature</span>
                  {:else if step.number === '03'}
                    <span class="text-xs leading-4" style="color: var(--ui-muted-text);">Website / Bug fixes</span>
                    <span class="text-xs leading-5 font-semibold">Fix the sign-in redirect</span>
                    <span class="text-xs leading-4" style="align-self: flex-start; display: flex; align-items: center; gap: 5px; padding: 3px 7px; background: var(--ui-neutral-normal-surface); border-radius: 4px; color: var(--ui-secondary-text);"><span style="width: 5px; height: 5px; border-radius: 50%; background: var(--ui-secondary-icon-glyph);"></span>Todo</span>
                  {:else}
                    <div class="text-xs leading-5" style="display: flex; align-items: center; gap: 7px; color: var(--ui-accent-link-text);"><Zap size={16} aria-hidden="true" />Quick Template</div>
                    <div class="text-xs leading-5" style="display: flex; align-items: center; gap: 6px; color: var(--ui-muted-text);">Task + template <ArrowRight size={13} aria-hidden="true" /><Copy size={13} aria-label="Copy" /></div>
                    <div class="text-xs leading-5" style="display: flex; align-items: center; gap: 7px; color: var(--ui-success-normal-text);"><Check size={15} aria-hidden="true" />Completed</div>
                  {/if}
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
      <div class="dialog-footer" style={dialog === 'welcome' ? 'align-items: center; flex-wrap: wrap;' : undefined}>
        {#if dialog === 'welcome'}
          <a class="welcomeGithubLink text-xs leading-5" style="margin-right: auto; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;" href="https://github.com/coxthulhu/Cthulhu-Prompt/issues" target="_blank" rel="noreferrer">Feedback &amp; support <ExternalLink size={13} aria-hidden="true" /></a>
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
  .home-screen { display: flex; flex: 1; min-width: 0; overflow-y: auto; padding: 24px; }
  .home-center { display: flex; width: 100%; min-width: 0; align-items: flex-start; justify-content: center; }
  .home-layout { container: base-home-layout / inline-size; position: relative; width: 100%; max-width: 1024px; min-width: 0; margin-block: auto; }
  .title-container, .home-card-grid { width: 100%; max-width: 504px; margin-inline: auto; }
  .home-title { display: flex; flex-direction: column; align-items: center; margin: 0; color: var(--ui-normal-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-weight: var(--font-weight-semibold); letter-spacing: 0.14em; text-align: center; white-space: nowrap; }
  .title-measure { position: fixed; left: -9999px; top: -9999px; width: max-content; visibility: hidden; pointer-events: none; --home-title-size: 100px; }
  .title-separator { background: var(--ui-neutral-muted-border); height: 3px; width: 100%; margin-top: 24px; }
  .home-card-grid { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 16px; margin-top: 28px; }
  .home-card { width: 100%; min-width: 0; }
  .card-label { margin: 0 0 12px; font-weight: var(--font-weight-semibold); }
  .card-surface { border-radius: 8px; background: var(--ui-card-normal-surface); border: 1px solid var(--ui-neutral-muted-border); }
  .home-row { display: flex; align-items: center; column-gap: 12px; row-gap: 8px; min-width: 0; width: 100%; padding: 16px; border-radius: 8px; text-align: left; }
  .row-icon { display: flex; flex: 0 0 34px; width: 34px; height: 34px; align-items: center; justify-content: center; color: var(--ui-hoverable-icon-glyph); }
  .row-text-stack { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
  .row-label, .row-detail { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-label { font-weight: var(--font-weight-semibold); }
  .row-detail { color: var(--ui-muted-text); }
  .home-row[data-wrap-detail='true'] .row-detail { overflow-wrap: anywhere; white-space: normal; }
  .row-trailing { display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-end; min-width: 0; }
  .separator { flex-shrink: 0; width: 100%; height: 1px; border-top: 1px solid var(--ui-neutral-muted-border); }
  .vertical-separator { flex-shrink: 0; width: 1px; border-left: 1px solid var(--ui-neutral-muted-border); }
  .workspace-stats { display: flex; align-items: stretch; min-width: 0; }
  .workspace-stats .home-row { flex: 1 1 0; }
  .action-button, .examples-toggle { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; min-width: 0; height: 40px; padding: 0 14px; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-neutral-action-fill); color: var(--ui-normal-text); font-family: inherit; font-weight: var(--font-weight-semibold); white-space: nowrap; text-decoration: none; cursor: pointer; }
  .action-button { max-width: 224px; overflow: hidden; }
  .action-button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .action-button:hover, .action-button:focus-visible, .examples-toggle:hover { background: var(--ui-neutral-action-hover-fill); border-color: var(--ui-neutral-hover-border); }
  .action-button[data-variant='accent'], .examples-toggle[aria-pressed='true'] { background: var(--ui-accent-action-fill); border-color: var(--ui-accent-muted-border); }
  .action-button[data-variant='accent']:hover, .action-button[data-variant='accent']:focus-visible, .examples-toggle[aria-pressed='true']:hover { background: var(--ui-accent-action-hover-fill); border-color: var(--ui-accent-muted-hover-border); }
  .action-button[data-appearance='outline'] { background: var(--ui-ghost-surface); color: var(--ui-hoverable-text); }
  .action-button[data-appearance='outline']:hover, .action-button[data-appearance='outline']:focus-visible { background: var(--ui-neutral-subtle-action-hover-fill); color: var(--ui-normal-text); }
  .workspace-action { width: 108px; justify-content: center; }
  .workspace-actions-card .row-icon :global(svg) { transform: translateY(1px); }
  .icon-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--ui-neutral-normal-border); border-radius: 6px; background: var(--ui-ghost-surface); color: var(--ui-hoverable-icon-glyph); cursor: pointer; }
  .icon-button:hover, .icon-button:focus-visible { color: var(--ui-normal-text); background: var(--ui-neutral-action-fill); border-color: var(--ui-neutral-hover-border); }
  button:disabled, input:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--ui-neutral-focus-border); outline-offset: 2px; }
  .dialog-layer { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--ui-card-normal-shadow); -webkit-app-region: no-drag; }
  .home-dialog { display: flex; flex-direction: column; width: 100%; max-width: 576px; max-height: calc(100vh - 32px); min-width: 0; padding: 16px; border-radius: 8px; border: 1px solid var(--ui-card-normal-border); background: var(--ui-card-overlay-surface); box-shadow: 0 8px 12px var(--ui-card-normal-shadow); }
  .home-dialog[data-create='true'] { max-width: 620px; padding-top: 18px; }
  .dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; padding: 0 4px 12px; }
  .home-dialog[data-create='true'] .dialog-header { padding-bottom: 16px; }
  .dialog-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .dialog-heading-text { min-width: 0; }
  .dialog-icon { display: flex; flex: 0 0 40px; align-items: center; justify-content: center; width: 40px; height: 40px; }
  .dialog-title { margin: 0; font-weight: var(--font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dialog-subtitle { margin: 3px 0 0; color: var(--ui-muted-text); }
  .dialog-body { min-width: 0; }
  .field-heading { display: flex; flex-direction: column; gap: 2px; margin-bottom: 7px; }
  .muted { color: var(--ui-muted-text); }
  .home-dialog[data-welcome='true'] { max-width: 672px; }
  .welcomeContent { min-height: 0; overflow-y: auto; color: var(--ui-hoverable-text); }
  .welcomeContent h2 { color: var(--ui-normal-text); }
  .welcomeGithubLink { color: var(--ui-accent-link-text); }
  .welcomeGithubLink:hover, .welcomeGithubLink:focus-visible { color: var(--ui-accent-link-hover-text); }
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
  @container base-home-layout (min-width: 1024px) {
    .title-container, .home-card-grid { max-width: none; }
    .home-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .home-title { flex-direction: row; justify-content: center; column-gap: 1.14em; }
  }
</style>
