<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import {
    AlertCircle, ArrowRight, BookOpen, Check, ChevronRight, Clock, Database, ExternalLink, FileText,
    FolderKanban, FolderOpen, FolderPlus, Folders, HardDrive, Home, Import, Layers, LayoutGrid, Plus,
    X, Zap
  } from 'lucide-svelte'

  // Visual baseline of HomeScreen and its Welcome, Open Workspace, Create Workspace, and error dialogs.
  // Only Svelte, Lucide icons, and palette colors are shared with the application. The shell's
  // workspace loading, the managed workspace catalog, Explorer, and the native import picker are
  // simulated locally; no preload, IPC, or domain imports.

  type MockWorkspace = {
    name: string
    /** Managed database file shown under the name. */
    path: string
    promptCount: number
    promptCollectionCount: number
    projectCount: number
    /** When this workspace was last opened, as shown in the Open Workspace list. */
    lastOpened: string
    /** The Open Workspace list's sort key for lastOpened, in epoch milliseconds; null when never opened. */
    lastOpenedAt: number | null
    /** Database file size, as shown in the Open Workspace list. */
    fileSize: string
    /** Restored work tabs hide the New Tab callout. */
    hasWorkTabs: boolean
    /** Failure the shell reports when this database is opened. */
    openError?: string
  }

  type DialogKind = 'welcome' | 'open' | 'create' | 'error'

  type ActionButton = {
    text: string
    icon?: ComponentType
    variant?: 'neutral' | 'accent'
    appearance?: 'filled' | 'outline'
    disabled?: boolean
    testId?: string
    onclick?: () => void
  }

  const workspacesDirectory = 'C:\\Users\\Alex\\AppData\\Roaming\\CthulhuPrompt\\Workspaces'
  /** Managed filenames drop all whitespace from the display name. */
  const toFileName = (name: string) => name.replace(/\s+/g, '')
  const mockWorkspace = (
    name: string,
    promptCount: number,
    promptCollectionCount: number,
    hasWorkTabs: boolean,
    details: { projectCount: number; lastOpened: string; lastOpenedAt: number | null; fileSize: string },
    openError?: string
  ): MockWorkspace => ({
    name,
    path: `${workspacesDirectory}\\${toFileName(name)}.cthulhuprompt`,
    promptCount,
    promptCollectionCount,
    ...details,
    hasWorkTabs,
    openError
  })

  // Sample catalog: Product Development starts open without tabs, so the New Tab callout shows;
  // the other workspaces restore tabs, and Research Archive fails to open.
  const sampleCatalog = [
    mockWorkspace('Product Development', 47, 6, false, {
      projectCount: 3,
      lastOpened: 'Today, 9:42 AM',
      lastOpenedAt: Date.parse('2026-11-20T09:42'),
      fileSize: '1.8 MB'
    }),
    mockWorkspace('Client Website Redesign', 18, 3, true, {
      projectCount: 2,
      lastOpened: 'Yesterday, 4:15 PM',
      lastOpenedAt: Date.parse('2026-11-19T16:15'),
      fileSize: '640 KB'
    }),
    mockWorkspace('Game Jam Prototypes', 12, 2, true, {
      projectCount: 1,
      lastOpened: 'Nov 12, 2026',
      lastOpenedAt: Date.parse('2026-11-12T14:30'),
      fileSize: '412 KB'
    }),
    mockWorkspace('Personal Scratchpad', 6, 2, true, {
      projectCount: 1,
      lastOpened: 'Oct 29, 2026',
      lastOpenedAt: Date.parse('2026-10-29T11:05'),
      fileSize: '188 KB'
    }),
    mockWorkspace(
      'Research Archive',
      31,
      4,
      true,
      { projectCount: 4, lastOpened: 'Aug 3, 2026', lastOpenedAt: Date.parse('2026-08-03T15:20'), fileSize: '2.6 MB' },
      'database is locked'
    )
  ]
  /** Imports have no saved tabs; a second Import fails because the name is taken. */
  const importedWorkspace = mockWorkspace('Legacy Prompt Library', 64, 8, false, {
    projectCount: 5,
    lastOpened: 'Never opened',
    lastOpenedAt: null,
    fileSize: '3.1 MB'
  })
  const duplicateImportError =
    "Error invoking remote method 'import-workspace': Error: A workspace with this name already exists"
  /** Edit to preview the inline creation failure, which the sample catalog cannot produce. */
  const simulatedCreateError = null as string | null
  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

  /** Header and frame settings of each live dialog; the error title follows the failed action. */
  const dialogFrames: Record<
    DialogKind,
    { icon: ComponentType; title: string; subtitle?: string; widthClass: string; scrollBody?: boolean }
  > = {
    welcome: {
      icon: BookOpen,
      title: 'Welcome to Cthulhu Prompt',
      subtitle: 'Your first prompt, from workspace to clipboard.',
      widthClass: 'max-w-[800px]',
      scrollBody: true
    },
    open: {
      icon: FolderOpen,
      title: 'Open Workspace',
      subtitle: 'Choose a workspace to open.',
      widthClass: 'max-w-[640px]',
      scrollBody: true
    },
    create: {
      icon: FolderPlus,
      title: 'Create Workspace',
      subtitle: 'Choose a name for your new workspace.',
      widthClass: 'max-w-[620px]'
    },
    error: { icon: AlertCircle, title: 'Failed to Open Workspace', widthClass: 'max-w-[576px]' }
  }

  const welcomeSteps: Array<{ icon: ComponentType; title: string; badge?: string; description: string }> = [
    {
      icon: Home,
      title: 'Create a workspace',
      description:
        'Give your workspace a name. Your projects, prompts, and templates are saved together in a workspace database. Use the tabs at the top to switch between open collections.'
    },
    {
      icon: Layers,
      title: 'Build a prompt template',
      badge: 'Optional',
      description:
        "Select the My Templates tab to write a reusable workflow. You can investigate a bug, implement a feature with Q&A, or create mockups. Your task's text is added when you copy."
    },
    {
      icon: FileText,
      title: 'Add a prompt task',
      description:
        'Select the My Prompts tab and add the change you want your AI to make. Include context, requirements, and details. Name your tasks and group them into custom categories.'
    },
    {
      icon: Zap,
      title: 'Pick a template. Copy and go.',
      description:
        'Use the quick template button in the prompt editor to assign a template, or choose no template, and copy the combined text. Paste into your AI tool and send it off!'
    }
  ]

  // Local sample state keeps the screen and its dialogs independent of the real workspace.
  let catalog = $state.raw<MockWorkspace[]>(sampleCatalog)
  let workspace = $state.raw<MockWorkspace | null>(sampleCatalog[0])
  /** Simulated shell workspace actions in flight. */
  let workspaceActionCount = $state(0)
  /** Simulated native import picker in flight. */
  let isSelectingWorkspace = $state(false)
  let dialog = $state<DialogKind | null>('open')
  let errorTitle = $state('Failed to Open Workspace')
  let errorText = $state('')
  let workspaceName = $state('')
  let includeExamples = $state(true)
  let hasInteractedWithName = $state(false)
  let submissionError = $state<string | null>(null)

  const isWorkspaceLoading = $derived(workspaceActionCount > 0)
  const isWorkspaceActionDisabled = $derived(isWorkspaceLoading || isSelectingWorkspace)
  /** The open workspace leads, then the rest by most recently opened; never-opened imports follow by name. */
  const sortedCatalog = $derived(
    [...catalog].sort((left, right) => {
      const openOrder = Number(right.path === workspace?.path) - Number(left.path === workspace?.path)
      return (
        openOrder ||
        (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0) ||
        left.name.localeCompare(right.name)
      )
    })
  )
  /** Mirrors the live naming rules, including case- and space-insensitive duplicates. */
  const workspaceNameError = $derived.by(() => {
    const fileName = toFileName(workspaceName)
    if (!workspaceName.trim()) return 'Workspace name cannot be empty'
    if (workspaceName.length > 100) return 'Workspace name must be 100 characters or less'
    // eslint-disable-next-line no-control-regex
    if (/[<>:"/\\|?*\x00-\x1f]/.test(workspaceName)) {
      return 'Workspace name contains illegal characters: < > : " / \\ | ? *'
    }
    if (reservedNames.test(fileName)) return 'This is a reserved system name and cannot be used'
    if (workspaceName.startsWith('.') || workspaceName.endsWith('.')) {
      return 'Workspace name cannot start or end with dots'
    }
    if (catalog.some((entry) => toFileName(entry.name).toLowerCase() === fileName.toLowerCase())) {
      return 'A workspace with this name already exists'
    }
    return null
  })
  const displayedWorkspaceNameError = $derived(hasInteractedWithName ? workspaceNameError : null)
  const submitDisabled = $derived(Boolean(workspaceNameError || isWorkspaceLoading))

  /** Simulated work timers, cancelled if the mockup unmounts; clearing a fired timer is a no-op. */
  const timers: number[] = []
  const wait = (milliseconds: number) =>
    new Promise<void>((resolve) => {
      timers.push(window.setTimeout(resolve, milliseconds))
    })

  // Side effect cleanup: a discarded mockup must not finish pending simulated work.
  $effect(() => () => {
    for (const id of timers) window.clearTimeout(id)
  })

  const resetCreateForm = () => {
    workspaceName = ''
    includeExamples = true
    hasInteractedWithName = false
    submissionError = null
  }

  /** Create resets its form on dismissal and cannot be dismissed while creating. */
  const closeDialog = () => {
    if (dialog === 'create') {
      if (isWorkspaceLoading) return
      resetCreateForm()
    }
    dialog = null
  }

  const showError = (message: string, title = 'Failed to Open Workspace') => {
    errorTitle = title
    errorText = message
    dialog = 'error'
  }

  /** The shell closes the current workspace first, and stays closed when loading fails. */
  const selectWorkspace = async (entry: MockWorkspace) => {
    dialog = null
    workspaceActionCount += 1
    workspace = null
    await wait(700)
    workspaceActionCount -= 1
    if (entry.openError) {
      showError(entry.openError)
      return
    }
    const opened = { ...entry, lastOpened: 'Just now', lastOpenedAt: Date.now() }
    catalog = catalog.map((candidate) => (candidate.path === entry.path ? opened : candidate))
    workspace = opened
  }

  /** New workspaces hold My Prompts and My Templates, three examples each, and a tab for both. */
  const createWorkspace = async () => {
    if (submitDisabled) return
    submissionError = null
    const name = workspaceName.trim()
    workspaceActionCount += 1
    await wait(900)
    workspaceActionCount -= 1
    if (simulatedCreateError) {
      submissionError = simulatedCreateError
      return
    }
    const created = mockWorkspace(name, includeExamples ? 6 : 0, 2, true, {
      projectCount: 1,
      lastOpened: 'Just now',
      lastOpenedAt: Date.now(),
      fileSize: includeExamples ? '96 KB' : '64 KB'
    })
    catalog = [...catalog, created]
    workspace = created
    resetCreateForm()
    dialog = null
  }

  /** Simulates the native file picker; imports join the catalog without opening. */
  const importWorkspace = async () => {
    isSelectingWorkspace = true
    await wait(600)
    isSelectingWorkspace = false
    if (catalog.some((entry) => entry.name === importedWorkspace.name)) {
      showError(duplicateImportError, 'Failed to Import Workspace')
    } else {
      catalog = [...catalog, importedWorkspace]
    }
  }

  const showModalLayer: Action<HTMLDialogElement> = (node) => {
    // Side effect: portal the native modal above the mockup host, route Escape and outside presses
    // through each dialog's close rules, and restore the opener's focus on removal.
    const opener = document.activeElement as HTMLElement | null
    /** Window capture consumes Escape wherever focus is, before the native cancel. */
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      closeDialog()
    }
    /** Only the error dialog closes on presses outside its surface. */
    const handlePointerdown = (event: PointerEvent) => {
      if (dialog !== 'error' || event.target !== node) return
      event.preventDefault()
      closeDialog()
    }
    const handleCancel = (event: Event) => {
      event.preventDefault()
      closeDialog()
    }
    window.addEventListener('keydown', handleKeydown, true)
    node.addEventListener('pointerdown', handlePointerdown)
    node.addEventListener('cancel', handleCancel)
    document.body.appendChild(node)
    node.showModal()
    return {
      destroy: () => {
        window.removeEventListener('keydown', handleKeydown, true)
        node.removeEventListener('pointerdown', handlePointerdown)
        node.removeEventListener('cancel', handleCancel)
        node.close()
        node.remove()
        opener?.focus({ preventScroll: true })
      }
    }
  }
</script>

{#snippet actionButton(button: ActionButton)}
  {@const Icon = button.icon}
  <button
    type="button"
    class="button-surface action-button text-sm leading-5"
    data-variant={button.variant ?? 'neutral'}
    data-appearance={button.appearance ?? 'filled'}
    data-testid={button.testId}
    disabled={button.disabled}
    onclick={button.onclick}
  >
    {#if Icon}<Icon size={16} aria-hidden="true" />{/if}
    <span class="button-label">{button.text}</span>
  </button>
{/snippet}

{#snippet countDisplay(CountIcon: ComponentType, count: number, label: string, testId: string)}
  <span class="count-display text-sm leading-5" data-testid={testId}>
    <CountIcon class="shrink-0" size={18} aria-hidden="true" />
    <strong class="count-display-value text-base leading-6 font-semibold">{count}</strong>
    <span>{label}</span>
  </span>
{/snippet}

<section class="home-base font-sans" data-testid="base-home-mockup">
  <main class="flex min-w-0 flex-1 overflow-y-auto px-8 py-12" data-testid="home-screen">
    <section class="m-auto flex w-full max-w-[780px] min-w-0 flex-col gap-[30px]" data-testid="home-layout">
      <header class="flex flex-wrap items-end justify-between gap-5">
        <h1 class="wordmark m-0 text-6xl leading-none font-semibold" data-testid="home-title">
          Cthulhu <span class="wordmark-accent">Prompt</span>
        </h1>
        <div class="flex items-center gap-2">
          {@render actionButton({
            icon: BookOpen,
            text: 'Welcome',
            variant: workspace ? 'neutral' : 'accent',
            appearance: workspace ? 'outline' : 'filled',
            testId: 'show-welcome-button',
            onclick: () => { dialog = 'welcome' }
          })}
          <a
            class="button-surface action-button text-sm leading-5"
            data-variant="neutral"
            data-appearance="outline"
            data-testid="get-started-github-issues-link"
            href={githubIssuesUrl}
            target="_blank"
            rel="noreferrer"
          ><ExternalLink size={16} aria-hidden="true" /><span class="button-label">Github</span></a>
        </div>
      </header>

      <!-- The cards stack closer to each other than to the header. -->
      <div class="flex flex-col gap-3">
        <div class="card-surface overflow-hidden" role="region" aria-label="Workspace" data-testid="home-primary-card">
          <div class="row p-4">
            <span class="icon-cell" data-variant="large">
              <FolderOpen size={32} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div class="title-stack">
              <div class="title text-2xl leading-8" data-variant="workspace" title={workspace?.name}>
                {workspace?.name ?? 'No workspace open'}
              </div>
              <span
                class="subtitle min-w-0 truncate text-sm"
                data-wrap="false"
                title={workspace?.path}
                data-testid={workspace ? 'workspace-ready-path' : undefined}
              >{workspace?.path ?? 'Open a workspace or create one to get started.'}</span>
            </div>
            <span class="row-trailing">
              <button
                type="button"
                class="button-surface icon-button"
                aria-label="Open Workspace Folder"
                title="Open Workspace Folder"
                data-testid="home-open-workspace-folder-button"
                disabled={!workspace}
                onclick={() => { /* Windows Explorer is outside this self-contained preview. */ }}
              ><ExternalLink size={20} aria-hidden="true" /></button>
            </span>
          </div>
          <div class="separator"></div>
          <div class="flex flex-wrap items-center justify-between gap-5 p-4">
            <div class="flex flex-wrap items-center gap-[22px]">
              {@render countDisplay(FileText, workspace?.promptCount ?? 0, 'Prompts', 'home-prompt-count-stat')}
              {@render countDisplay(
                Folders,
                workspace?.promptCollectionCount ?? 0,
                'Prompt Collections',
                'home-prompt-collection-count-stat'
              )}
            </div>
            <div class="ml-auto flex items-center gap-2">
              {@render actionButton({
                icon: FolderOpen,
                text: 'Open',
                variant: workspace ? 'neutral' : 'accent',
                appearance: workspace ? 'outline' : 'filled',
                testId: 'open-workspace-button',
                disabled: isWorkspaceActionDisabled,
                onclick: () => { dialog = 'open' }
              })}
              {@render actionButton({
                icon: FolderPlus,
                text: 'Create',
                variant: workspace ? 'neutral' : 'accent',
                appearance: workspace ? 'outline' : 'filled',
                testId: 'create-workspace-button',
                disabled: isWorkspaceActionDisabled,
                onclick: () => { dialog = 'create' }
              })}
              {@render actionButton({
                icon: Import,
                text: 'Import',
                appearance: 'outline',
                testId: 'import-workspace-button',
                disabled: isWorkspaceActionDisabled,
                onclick: importWorkspace
              })}
              {@render actionButton({
                icon: X,
                text: 'Close',
                appearance: 'outline',
                testId: 'close-workspace-button',
                disabled: !workspace || isWorkspaceActionDisabled,
                onclick: () => { workspace = null }
              })}
            </div>
          </div>
        </div>

        <!-- Points an open workspace without tabs to the tab bar, where its collections open. -->
        {#if workspace && !workspace.hasWorkTabs}
          <div class="card-surface" role="region" aria-label="Get started" data-testid="home-new-tab-card">
            <div class="row p-4">
              <span class="icon-cell"><LayoutGrid size={24} aria-hidden="true" /></span>
              <div class="title-stack">
                <div class="title text-base" data-variant="row">Open a new tab to get started</div>
                <span class="subtitle min-w-0 truncate text-sm" data-wrap="true">
                  Your prompt collections open in tabs at the top of the window.
                </span>
              </div>
              <span class="row-trailing">
                {@render actionButton({
                  icon: Plus,
                  text: 'New Tab',
                  variant: 'accent',
                  testId: 'home-new-tab-button',
                  onclick: () => { /* The New Tab screen is outside this self-contained preview. */ }
                })}
              </span>
            </div>
          </div>
        {/if}
      </div>
    </section>
  </main>
</section>

{#key dialog}
  {#if dialog}
    {@const frame = dialogFrames[dialog]}
    {@const FrameIcon = frame.icon}
    {@const title = dialog === 'error' ? errorTitle : frame.title}
    {@const closeDisabled = dialog === 'create' && isWorkspaceLoading}
    <!-- svelte-ignore a11y_no_redundant_roles (Matches the explicit role used by the live dialogs.) -->
    <dialog class="popup-layer" role="dialog" aria-label={title} aria-modal="true" use:showModalLayer>
      <div
        class="card-surface dialog-surface flex w-full flex-col pb-4 {frame.subtitle ? 'pt-[18px]' : 'pt-4'} {frame.widthClass}"
        data-variant="overlay"
      >
        <div class="dialog-header" data-has-subtitle={frame.subtitle ? 'true' : 'false'}>
          <div class="row" data-variant="dialog-heading">
            <span class="icon-cell" data-variant="title" data-testid="dialog-header-icon">
              <FrameIcon size={24} aria-hidden="true" />
            </span>
            <div class="title-stack">
              <div class="title text-lg" data-variant="dialog">{title}</div>
              {#if frame.subtitle}
                <span class="subtitle min-w-0 truncate text-sm" data-wrap="true" data-testid="dialog-subtitle">
                  {frame.subtitle}
                </span>
              {/if}
            </div>
            <span class="row-trailing">
              <button
                type="button"
                class="button-surface icon-button"
                aria-label="Close"
                disabled={closeDisabled}
                onclick={closeDialog}
              ><X size={20} aria-hidden="true" /></button>
            </span>
          </div>
        </div>

        <div class="separator"></div>

        <div class="dialog-body" data-scrollable={frame.scrollBody ?? false}>
          {#if dialog === 'welcome'}
            <!-- Four steps guide the user from creating a workspace to copying a prompt. -->
            <ol class="m-0 list-none px-3" data-testid="welcome-steps">
              {#each welcomeSteps as step, index (step.title)}
                {@const StepIcon = step.icon}
                <li class="step-row text-sm leading-6">
                  <span class="step-number text-xl leading-10 font-semibold">{index + 1}</span>
                  <div class="min-w-0">
                    <div class="step-heading">
                      <StepIcon size={19} aria-hidden="true" />
                      <h2 class="text-base leading-6 font-semibold">{step.title}</h2>
                      {#if step.badge}<span class="step-badge text-sm leading-5">{step.badge}</span>{/if}
                    </div>
                    <p>{step.description}</p>
                    <div class="step-tip text-sm leading-5">
                      {#if index === 0}
                        To open another prompt collection, click + (New Tab) and choose it from the list.
                      {:else if index === 1}
                        <span class="welcome-workflow">Investigate a bug</span>
                        <span class="welcome-workflow">Implement a feature</span>
                        <span class="welcome-workflow">Create mockups</span>
                      {:else if index === 2}
                        Backlog<ArrowRight size={14} aria-hidden="true" />
                        Todo<ArrowRight size={14} aria-hidden="true" />
                        In Progress<ArrowRight size={14} aria-hidden="true" />
                        <span class="welcome-completed">Completed</span>
                      {:else}
                        <Check size={16} class="welcome-check shrink-0" aria-hidden="true" />
                        <span class="min-w-0 flex-1">When the AI finishes, check off the task to move it to Completed.</span>
                      {/if}
                    </div>
                  </div>
                </li>
              {/each}
            </ol>
          {:else if dialog === 'open'}
            {#if sortedCatalog.length > 0}
              <ul class="m-0 grid list-none gap-2 px-0 py-4" data-testid="open-workspace-list">
                {#each sortedCatalog as entry (entry.path)}
                  {@const isCurrent = entry.path === workspace?.path}
                  <li class="min-w-0">
                    <button
                      type="button"
                      class="workspace-option"
                      aria-current={isCurrent ? 'true' : undefined}
                      title={entry.path}
                      data-testid="open-workspace-option"
                      disabled={isWorkspaceActionDisabled}
                      onclick={() => selectWorkspace(entry)}
                    >
                      <span class="workspace-option-icon">
                        <Database size={24} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span class="workspace-option-body">
                        <span class="workspace-option-name text-base leading-6 font-semibold">{entry.name}</span>
                        <span class="workspace-option-stats text-sm leading-5">
                          <span class="workspace-option-stat">
                            <FileText size={14} aria-hidden="true" />
                            <strong>{entry.promptCount}</strong>{entry.promptCount === 1 ? 'Prompt' : 'Prompts'}
                          </span>
                          <span class="workspace-option-stat">
                            <Folders size={14} aria-hidden="true" />
                            <strong>{entry.promptCollectionCount}</strong>{entry.promptCollectionCount === 1
                              ? 'Collection'
                              : 'Collections'}
                          </span>
                          <span class="workspace-option-stat">
                            <FolderKanban size={14} aria-hidden="true" />
                            <strong>{entry.projectCount}</strong>{entry.projectCount === 1 ? 'Project' : 'Projects'}
                          </span>
                        </span>
                      </span>
                      <span class="workspace-option-meta text-sm leading-5">
                        {#if isCurrent}
                          <!-- The open workspace shows the New Tab tiles' open indicator in place of its last opened time. -->
                          <span class="workspace-option-meta-item workspace-option-open h-6" title="Currently open">
                            <span class="workspace-option-open-dot" aria-hidden="true"></span>Open
                          </span>
                        {:else}
                          <span class="workspace-option-meta-item h-6">
                            <Clock size={14} aria-hidden="true" />{entry.lastOpened}
                          </span>
                        {/if}
                        <span class="workspace-option-meta-item h-5">
                          <HardDrive size={14} aria-hidden="true" />{entry.fileSize}
                        </span>
                      </span>
                      <ChevronRight class="workspace-option-chevron" size={18} aria-hidden="true" />
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <div class="flex flex-col items-center gap-1 px-4 py-10 text-center" data-testid="open-workspace-empty">
                <FolderOpen class="mb-2 text-[var(--ui-muted-icon-glyph)]" size={32} strokeWidth={1.5} aria-hidden="true" />
                <div class="text-base leading-6 font-semibold">No workspaces yet</div>
                <p class="m-0 text-sm leading-5 text-[var(--ui-muted-text)]">
                  Create a workspace or import an existing one to see it here.
                </p>
              </div>
            {/if}
          {:else if dialog === 'create'}
            <!-- Standard stacked dialog fields for workspace creation options. -->
            <div class="grid min-w-0 gap-[17px] overflow-visible px-4 py-4">
              <div data-testid="create-workspace-name-field">
                <div class="title-stack mb-[7px]">
                  <div class="flex items-center gap-1">
                    <div class="title text-sm" data-variant="small">Workspace Name</div>
                    <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
                  </div>
                  <span id="mock-create-workspace-name-help" class="subtitle min-w-0 truncate text-sm" data-wrap="true">
                    Enter a name for the new workspace.
                  </span>
                </div>
                <div class="relative">
                  <input
                    class="text-input flex h-10 w-full min-w-0 rounded-[6px] border px-3.5 py-1 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    type="text"
                    bind:value={workspaceName}
                    aria-label="Workspace Name"
                    aria-describedby="mock-create-workspace-name-help"
                    placeholder="Name..."
                    data-testid="create-workspace-name-input"
                    aria-invalid={displayedWorkspaceNameError ? 'true' : undefined}
                    disabled={isWorkspaceLoading}
                    oninput={() => {
                      hasInteractedWithName = true
                      submissionError = null
                    }}
                  />
                  {#if displayedWorkspaceNameError}
                    <!-- Validation floats below the field, outside the surrounding layout flow. -->
                    <div
                      class="message-row absolute top-full left-0 mt-0.5 inline-flex h-11 items-center gap-2 rounded-[6px] px-3 text-sm whitespace-nowrap"
                      data-floating="true"
                      data-testid="create-workspace-name-error"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      {displayedWorkspaceNameError}
                    </div>
                  {/if}
                </div>
              </div>

              {#if submissionError}
                <div
                  class="message-row inline-flex h-11 w-full items-center gap-2 rounded-[6px] px-3 text-sm"
                  data-testid="create-workspace-submit-error"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  {submissionError}
                </div>
              {/if}

              <div data-testid="create-workspace-examples-row">
                <div class="title-stack mb-[7px]">
                  <div class="title text-sm" data-variant="small">Add Examples</div>
                  <span class="subtitle min-w-0 truncate text-sm" data-wrap="true">
                    Include example prompts and templates in the My Prompts and My Templates collections.
                  </span>
                </div>
                <button
                  type="button"
                  class="button-surface toggle-button text-sm leading-5 font-semibold"
                  data-appearance="filled"
                  data-testid="create-workspace-examples-toggle"
                  aria-pressed={includeExamples}
                  disabled={isWorkspaceLoading}
                  onclick={() => { includeExamples = !includeExamples }}
                >
                  <span class="toggle-track flex h-6 w-10 items-center rounded-full p-1 transition duration-[120ms]">
                    <span class="toggle-thumb h-4 w-4 rounded-full"></span>
                  </span>
                  <span class="w-[64px] text-left">{includeExamples ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>
          {:else}
            <div class="flex min-w-0 flex-col gap-3 py-4">
              <section class="space-y-2">
                <div class="title text-sm" data-variant="small">Message</div>
                <p class="error-message text-sm">
                  {errorTitle === 'Failed to Import Workspace'
                    ? 'The workspace could not be imported.'
                    : 'The workspace could not be opened.'}
                </p>
              </section>
              <section class="space-y-2">
                <div class="title text-sm" data-variant="small">Details</div>
                <!-- Preserve line breaks so technical errors remain readable. -->
                <pre class="log-details rounded-[6px] p-3 text-sm leading-6">{errorText}</pre>
              </section>
            </div>
          {/if}
        </div>

        <div class="separator"></div>

        <div class="dialog-footer">
          {#if dialog === 'welcome'}
            {@render actionButton({
              icon: FolderOpen,
              text: 'Open Workspace',
              testId: 'welcome-open-workspace-button',
              onclick: () => { dialog = 'open' }
            })}
            {@render actionButton({
              icon: FolderPlus,
              text: 'Create Workspace',
              variant: 'accent',
              testId: 'welcome-create-workspace-button',
              onclick: () => { dialog = 'create' }
            })}
          {:else if dialog === 'create'}
            {@render actionButton({ text: 'Cancel', disabled: closeDisabled, onclick: closeDialog })}
            {@render actionButton({
              text: isWorkspaceLoading ? 'Creating...' : 'Create Workspace',
              variant: 'accent',
              testId: 'create-workspace-submit-button',
              disabled: submitDisabled,
              onclick: createWorkspace
            })}
          {:else if dialog === 'open'}
            <span class="mr-auto self-center text-sm leading-5 text-[var(--ui-muted-text)]">
              {catalog.length} {catalog.length === 1 ? 'workspace' : 'workspaces'}
            </span>
            {@render actionButton({ text: 'Cancel', onclick: closeDialog })}
          {:else}
            {@render actionButton({ text: dialog === 'error' ? 'Close' : 'Cancel', onclick: closeDialog })}
          {/if}
        </div>
      </div>
    </dialog>
  {/if}
{/key}

<style>
  .home-base {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 100%;
    color: var(--ui-normal-text);
  }

  .wordmark {
    color: var(--ui-normal-text);
    font-family: ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.055em;
  }

  .wordmark-accent {
    color: var(--ui-accent-link-text);
  }

  .card-surface {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 8px;
    background: var(--ui-card-normal-surface);
  }

  .card-surface[data-variant='overlay'] {
    border-color: var(--ui-card-normal-border);
    background: var(--ui-card-overlay-surface);
    box-shadow: 0 8px 12px var(--ui-card-normal-shadow);
  }

  /* Icon, title/subtitle stack, and trailing controls shared by cards and dialog headers. */
  .row {
    display: flex;
    align-items: center;
    column-gap: 12px;
    row-gap: 8px;
    width: 100%;
    min-width: 0;
    border-radius: 8px;
    color: var(--ui-normal-text);
    text-align: left;
  }

  .row[data-variant='dialog-heading'] .row-trailing {
    align-self: flex-start;
  }

  .row-trailing {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
  }

  .icon-cell {
    display: flex;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: var(--ui-hoverable-icon-glyph);
  }

  .icon-cell:is([data-variant='title'], [data-variant='large']) {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }

  .title-stack {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-weight: var(--font-weight-semibold);
  }

  .title:is([data-variant='small'], [data-variant='dialog'], [data-variant='workspace']) {
    color: var(--ui-normal-text);
  }

  .title:is([data-variant='dialog'], [data-variant='row'], [data-variant='workspace']) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title:is([data-variant='row'], [data-variant='workspace']) {
    min-width: 0;
  }

  .title[data-variant='workspace'] {
    letter-spacing: -0.03em;
  }

  .subtitle {
    display: block;
    color: var(--ui-muted-text);
    font-weight: var(--font-weight-normal);
  }

  .subtitle[data-wrap='true'] {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .separator {
    flex-shrink: 0;
    width: 100%;
    height: 1px;
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .count-display {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ui-secondary-text);
  }

  .count-display :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .count-display-value {
    color: var(--ui-normal-text);
  }

  /* Ghost surface by default; filled, accent, and outline appearances override the variables. */
  .button-surface {
    --button-fill: var(--ui-ghost-surface);
    --button-border: var(--ui-neutral-normal-border);
    --button-text: var(--ui-hoverable-text);
    --button-hover-fill: var(--ui-neutral-action-fill);
    --button-hover-border: var(--ui-neutral-hover-border);

    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    min-width: 0;
    border: 1px solid var(--button-border);
    border-radius: 6px;
    background-color: var(--button-fill);
    color: var(--button-text);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .button-surface:hover,
  .button-surface:focus-visible {
    border-color: var(--button-hover-border);
    background-color: var(--button-hover-fill);
    color: var(--ui-normal-text);
  }

  .button-surface:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .button-surface:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .button-surface[data-appearance='filled'] {
    --button-fill: var(--ui-neutral-action-fill);
    --button-hover-fill: var(--ui-neutral-action-hover-fill);
    --button-text: var(--ui-normal-text);
  }

  .button-surface[data-appearance='filled'][data-variant='accent'],
  .toggle-button[aria-pressed='true'] {
    --button-fill: var(--ui-accent-action-fill);
    --button-border: var(--ui-accent-muted-border);
    --button-hover-fill: var(--ui-accent-action-hover-fill);
    --button-hover-border: var(--ui-accent-muted-hover-border);
  }

  .button-surface[data-appearance='outline'] {
    --button-hover-fill: var(--ui-neutral-subtle-action-hover-fill);
  }

  .action-button {
    gap: 4px;
    height: 40px;
    max-width: 14rem;
    overflow: hidden;
    padding: 0 14px;
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    white-space: nowrap;
  }

  .action-button :global(svg) {
    flex: 0 0 auto;
  }

  .button-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-button {
    --button-text: var(--ui-hoverable-icon-glyph);

    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
  }

  .toggle-button {
    display: flex;
    flex: 0 1 auto;
    gap: 12px;
    height: 40px;
    padding: 0 14px;
  }

  .toggle-track {
    justify-content: flex-start;
    background: var(--ui-neutral-emphasis-surface);
  }

  .toggle-button[aria-pressed='true'] .toggle-track {
    justify-content: flex-end;
    background: var(--ui-accent-action-fill);
  }

  .toggle-thumb {
    background: var(--ui-normal-text);
    box-shadow: 0 1px 2px var(--ui-shadow-raised);
  }

  .text-input {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    transition:
      color 120ms,
      box-shadow 120ms,
      background-color 120ms,
      border-color 120ms;
  }

  .text-input::placeholder {
    color: var(--ui-muted-text);
  }

  .text-input::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .text-input:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: 0 0 0 3px var(--ui-neutral-emphasis-surface);
  }

  .text-input[aria-invalid='true'] {
    border-color: var(--ui-danger-strong-border);
  }

  .text-input[aria-invalid='true']:focus-visible {
    box-shadow: 0 0 0 3px var(--ui-danger-normal-ring);
  }

  .message-row {
    background: var(--ui-danger-normal-surface);
    color: var(--ui-normal-text);
  }

  .message-row :global(svg) {
    color: var(--ui-danger-icon-glyph);
  }

  .message-row[data-floating='true'] {
    z-index: 30;
    background: color-mix(in oklch, var(--ui-card-solid-surface) 76%, var(--ui-danger-strong-border));
    box-shadow: 0 8px 18px var(--ui-card-normal-shadow);
  }

  /* Native modal layer: the surface centers in a padded, full-viewport dialog element. */
  .popup-layer {
    -webkit-app-region: no-drag;
    position: fixed;
    inset: 0;
    z-index: 40;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 16px;
    border: 0;
    background: var(--ui-ghost-surface);
    color: var(--ui-normal-text);
  }

  .popup-layer[open] {
    display: flex;
  }

  .popup-layer::backdrop {
    background: var(--ui-card-normal-shadow);
  }

  .dialog-surface {
    max-height: calc(100vh - 32px);
    overflow: visible;
  }

  .dialog-header {
    min-width: 0;
    padding: 0 20px 12px;
  }

  .dialog-header[data-has-subtitle='true'] {
    padding-bottom: 16px;
  }

  .dialog-body {
    min-width: 0;
    padding-inline: 16px;
  }

  .dialog-body[data-scrollable='true'] {
    min-height: 0;
    overflow-y: auto;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    padding: 16px 16px 0;
  }

  .step-row {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 18px;
    padding: 20px 0;
    color: var(--ui-hoverable-text);
  }

  .step-row:not(:first-child) {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .step-number {
    width: 42px;
    height: 42px;
    border: 1px solid var(--ui-accent-muted-border);
    border-radius: 50%;
    background: var(--ui-accent-action-fill);
    color: var(--ui-normal-text);
    text-align: center;
  }

  .step-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px;
    margin-bottom: 6px;
    color: var(--ui-normal-text);
  }

  .step-heading :global(svg) {
    flex-shrink: 0;
    color: var(--ui-hoverable-icon-glyph);
  }

  .step-badge {
    padding: 0 8px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 4px;
    color: var(--ui-muted-text);
  }

  .step-tip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--ui-muted-text);
  }

  .step-tip :global(.welcome-check) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .welcome-workflow {
    padding: 2px 9px;
    border-radius: 4px;
    background: var(--ui-neutral-field-surface);
  }

  .welcome-completed {
    color: var(--ui-normal-text);
  }

  .error-message {
    padding-left: 8px;
    color: var(--ui-normal-text);
  }

  .log-details {
    overflow-x: auto;
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    white-space: pre-wrap;
  }

  /* Open Workspace list: one row per workspace with its counts, last opened time or open indicator, and size. Rows
     take the New Tab collection tiles' surface, border, text, and hover colors. */
  .workspace-option {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-width: 0;
    padding: 14px 12px 14px 16px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 8px;
    background-color: var(--ui-neutral-normal-surface);
    color: var(--ui-hoverable-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .workspace-option:hover,
  .workspace-option:focus-visible {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .workspace-option:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .workspace-option:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .workspace-option-icon {
    display: flex;
    flex: 0 0 auto;
    color: var(--ui-secondary-icon-glyph);
    transition: color 120ms ease;
  }

  .workspace-option:is(:hover, :focus-visible) .workspace-option-icon {
    color: var(--ui-hoverable-icon-glyph);
  }

  .workspace-option-body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  /* The name inherits the row's hoverable text, brightening with it like a tile's name. */
  .workspace-option-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-option-stats {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
    row-gap: 2px;
    min-width: 0;
    color: var(--ui-secondary-text);
  }

  .workspace-option-stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .workspace-option-stat strong {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
  }

  /* Stat and meta icons and labels take the Home screen count display's colors, which stay put on hover. */
  .workspace-option-stat :global(svg),
  .workspace-option-meta-item :global(svg) {
    flex: 0 0 auto;
    color: var(--ui-secondary-icon-glyph);
  }

  .workspace-option-meta {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    color: var(--ui-secondary-text);
    white-space: nowrap;
  }

  .workspace-option-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Matches OpenIndicator: a success dot beside the meta column's secondary label. */
  .workspace-option-open {
    gap: 5px;
  }

  .workspace-option-open-dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--ui-success-normal-text);
  }

  .workspace-option :global(.workspace-option-chevron) {
    flex: 0 0 auto;
    margin-left: 2px;
    color: var(--ui-muted-icon-glyph);
    transition:
      color 120ms ease,
      transform 120ms ease;
  }

  .workspace-option:is(:hover, :focus-visible) :global(.workspace-option-chevron) {
    color: var(--ui-hoverable-icon-glyph);
    transform: translateX(2px);
  }
</style>
