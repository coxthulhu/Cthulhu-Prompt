<script lang="ts">
  import {
    Check,
    ChevronRight,
    Copy,
    FileText,
    Folder,
    FolderOpen,
    MoreHorizontal,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type IconComponent = typeof Copy
  type FolderVariant = 'channel' | 'ribbon' | 'ledger'

  type PromptExample = {
    id: string
    title: string
    folderLabel: string
    lines: number
    tokens: number
    text: string
  }

  type FolderExample = {
    id: string
    variant: FolderVariant
    path: string[]
    promptCount: number
    updatedLabel: string
    description: string
    prefix: string
    suffix: string
    prompts: PromptExample[]
  }

  type IconButton = {
    id: string
    label: string
    icon: IconComponent
    tone?: 'danger'
  }

  const folders: FolderExample[] = [
    {
      id: 'build-release',
      variant: 'channel',
      path: ['Workspace Automation', 'Build & Release'],
      promptCount: 4,
      updatedLabel: 'Updated 12 minutes ago',
      description:
        'Prompts for packaging builds, writing release notes, and checking deployment readiness.',
      prefix: 'Use the repository context and keep release instructions concise.',
      suffix: 'Return verification steps with commands and expected results.',
      prompts: [
        {
          id: 'release-notes',
          title: 'Draft release notes',
          folderLabel: 'Build & Release',
          lines: 18,
          tokens: 642,
          text: 'Summarize the merged changes into release notes grouped by user-visible behavior, fixes, and follow-up verification.'
        },
        {
          id: 'packaging-checklist',
          title: 'Packaging checklist',
          folderLabel: 'Build & Release',
          lines: 11,
          tokens: 385,
          text: 'Create a Windows packaging checklist for the current Electron build, including installer validation and update-channel checks.'
        }
      ]
    },
    {
      id: 'review-workflows',
      variant: 'ribbon',
      path: ['Workspace Automation', 'Review Workflows'],
      promptCount: 7,
      updatedLabel: 'Updated yesterday',
      description:
        'Prompts for finding regressions, tightening tests, and reviewing pull request changes.',
      prefix: 'Take a code-review stance. Lead with concrete risks and affected files.',
      suffix: 'Call out missing test coverage and any assumptions that remain.',
      prompts: [
        {
          id: 'risk-review',
          title: 'Review risky diff',
          folderLabel: 'Review Workflows',
          lines: 22,
          tokens: 811,
          text: 'Inspect the changed files for behavioral regressions. Prioritize bugs, state mismatches, and lifecycle issues.'
        },
        {
          id: 'test-plan',
          title: 'Focused test plan',
          folderLabel: 'Review Workflows',
          lines: 14,
          tokens: 506,
          text: 'Build a focused test plan from the current diff. Include unit coverage first and E2E coverage only where behavior crosses screens.'
        }
      ]
    },
    {
      id: 'svelte-runes',
      variant: 'ledger',
      path: ['Workspace Automation', 'Refactors', 'Svelte 5'],
      promptCount: 5,
      updatedLabel: 'Updated May 28',
      description:
        'Prompts for converting legacy component patterns into Svelte 5 runes and snippets.',
      prefix: 'Use Svelte 5 runes, snippets, and explicit side-effect comments.',
      suffix: 'Avoid Svelte 4 store patterns and deprecated slot rendering.',
      prompts: [
        {
          id: 'rune-conversion',
          title: 'Convert component to runes',
          folderLabel: 'Svelte 5',
          lines: 26,
          tokens: 974,
          text: 'Convert the component to Svelte 5 runes. Preserve behavior, keep edits scoped, and explain every lifecycle side effect in a short comment.'
        },
        {
          id: 'snippet-pass',
          title: 'Replace slot usage',
          folderLabel: 'Svelte 5',
          lines: 9,
          tokens: 318,
          text: 'Replace deprecated slot rendering with snippets. Prefer inline snippet declarations inside the consumer component tags.'
        }
      ]
    }
  ]

  const settingRows = [
    { title: 'Folder Description', lines: 3, tokens: 37, key: 'description' },
    { title: 'Prompt Folder Prefix', lines: 2, tokens: 18, key: 'prefix' },
    { title: 'Prompt Folder Suffix', lines: 2, tokens: 16, key: 'suffix' }
  ] as const

  const rowButtons: IconButton[] = [
    { id: 'copy', label: 'Copy prompt', icon: Copy },
    { id: 'more', label: 'More actions', icon: MoreHorizontal },
    { id: 'delete', label: 'Delete prompt', icon: Trash2, tone: 'danger' }
  ]

  let hoveredTitleRowId = $state<string | null>(null)
  let hoveredPromptId = $state<string | null>(null)
  let hoveredButtonId = $state<string | null>(null)
  let hoveredDividerId = $state<string | null>(null)

  const shellStyle = [
    'box-sizing:border-box',
    'color:var(--ui-normal-text)',
    'display:grid',
    'gap:34px',
    'min-width:0',
    'padding:28px 24px 46px'
  ].join(';')

  const screenStyle = [
    'box-sizing:border-box',
    'display:grid',
    'gap:24px',
    'margin:0 auto',
    'max-width:1040px',
    'min-width:0',
    'width:100%'
  ].join(';')

  const folderGroupStyle = [
    'box-sizing:border-box',
    'display:grid',
    'gap:24px',
    'min-width:0'
  ].join(';')

  const getTitleRowStyle = (folder: FolderExample) => {
    const isHovered = hoveredTitleRowId === folder.id
    const base = [
      'align-items:center',
      'border:1px solid',
      'box-sizing:border-box',
      'cursor:pointer',
      'display:grid',
      'grid-template-columns:minmax(0,1fr) auto',
      'min-height:64px',
      'min-width:0',
      'overflow:hidden',
      'transition:background 120ms ease,border-color 120ms ease,box-shadow 120ms ease,transform 120ms ease'
    ]

    if (folder.variant === 'channel') {
      return [
        ...base,
        'border-radius:8px',
        `border-color:${isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-muted-border)'}`,
        `background:${isHovered ? 'var(--ui-neutral-hover-surface)' : 'linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end))'}`,
        `box-shadow:${isHovered ? '0 14px 34px var(--ui-card-normal-shadow)' : 'var(--cthulhu-ui-shadow-card)'}`,
        'padding:9px 12px 9px 0',
        `transform:${isHovered ? 'translateY(-1px)' : 'translateY(0)'}`
      ].join(';')
    }

    if (folder.variant === 'ribbon') {
      return [
        ...base,
        'border-radius:7px',
        `border-color:${isHovered ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-card-normal-border)'}`,
        `background:${isHovered ? 'linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface))' : 'var(--ui-neutral-muted-surface)'}`,
        `box-shadow:${isHovered ? '0 12px 28px var(--ui-card-normal-shadow)' : '0 1px 0 var(--ui-card-nested-inset-highlight) inset'}`,
        'padding:10px 12px'
      ].join(';')
    }

    return [
      ...base,
      'border-radius:8px',
      `border-color:${isHovered ? 'var(--ui-accent-blue-normal-border)' : 'var(--ui-neutral-muted-border)'}`,
      `background:${isHovered ? 'var(--ui-neutral-normal-surface)' : 'transparent'}`,
      `box-shadow:${isHovered ? '0 10px 26px var(--ui-shadow-raised)' : 'none'}`,
      'padding:8px 12px 8px 10px'
    ].join(';')
  }

  const getLineColor = (variant: FolderVariant) => {
    if (variant === 'ribbon') return 'var(--ui-accent-green-normal-border)'
    if (variant === 'ledger') return 'var(--ui-accent-blue-normal-border)'
    return 'var(--ui-accent-normal-border)'
  }

  const getLineFill = (variant: FolderVariant) => {
    if (variant === 'ribbon') return 'var(--ui-accent-green-normal-surface)'
    if (variant === 'ledger') return 'var(--ui-accent-blue-normal-surface)'
    return 'var(--ui-accent-normal-surface)'
  }

  const getSettingsValue = (
    folder: FolderExample,
    key: (typeof settingRows)[number]['key']
  ): string => {
    if (key === 'description') return folder.description
    if (key === 'prefix') return folder.prefix
    return folder.suffix
  }

  const getPromptCardStyle = (promptId: string) => {
    const isHovered = hoveredPromptId === promptId
    return [
      'border:1px solid',
      `border-color:${isHovered ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-card-normal-border)'}`,
      'border-radius:8px',
      'box-sizing:border-box',
      `background:${isHovered ? 'var(--ui-neutral-normal-surface)' : 'linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end))'}`,
      `box-shadow:${isHovered ? '0 14px 30px var(--ui-card-normal-shadow)' : 'var(--cthulhu-ui-shadow-card)'}`,
      'display:grid',
      'gap:8px',
      'min-width:0',
      'padding:10px',
      'position:relative',
      'transition:background 120ms ease,border-color 120ms ease,box-shadow 120ms ease'
    ].join(';')
  }

  const getIconButtonStyle = (id: string, tone?: 'danger') => {
    const isHovered = hoveredButtonId === id
    return [
      'align-items:center',
      'border:1px solid',
      `border-color:${tone === 'danger' ? (isHovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)') : isHovered ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-interactive-muted-border)'}`,
      'border-radius:7px',
      'box-sizing:border-box',
      `background:${tone === 'danger' ? (isHovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-normal-surface)') : isHovered ? 'var(--ui-neutral-hover-surface)' : 'transparent'}`,
      `color:${tone === 'danger' ? 'var(--ui-danger-icon-glyph)' : 'var(--ui-hoverable-text)'}`,
      'cursor:pointer',
      'display:inline-flex',
      'height:32px',
      'justify-content:center',
      'padding:0',
      'transition:background 120ms ease,border-color 120ms ease,color 120ms ease',
      'width:32px'
    ].join(';')
  }

  const getDividerButtonStyle = (id: string) => {
    const isHovered = hoveredDividerId === id
    return [
      'align-items:center',
      'border:1px solid',
      `border-color:${isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-muted-border)'}`,
      'border-radius:999px',
      'box-sizing:border-box',
      `background:${isHovered ? 'var(--ui-accent-hover-surface)' : 'var(--ui-card-inset-surface)'}`,
      `color:${isHovered ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}`,
      'cursor:pointer',
      'display:inline-flex',
      'font-size:12px',
      'font-weight:750',
      'gap:7px',
      'height:30px',
      'justify-content:center',
      'line-height:14px',
      'padding:0 13px',
      'transition:background 120ms ease,border-color 120ms ease,color 120ms ease'
    ].join(';')
  }
</script>

<div style={shellStyle}>
  <div style={screenStyle}>
    {#each folders as folder (folder.id)}
      <section style={folderGroupStyle} aria-label={folder.path[folder.path.length - 1]}>
        <button
          type="button"
          style={getTitleRowStyle(folder)}
          aria-label={folder.path.join(' / ')}
          onmouseenter={() => {
            hoveredTitleRowId = folder.id
          }}
          onmouseleave={() => {
            hoveredTitleRowId = null
          }}
        >
          {#if folder.variant === 'channel'}
            <div
              style={`align-self:stretch;background:${getLineFill(folder.variant)};border-right:1px solid ${getLineColor(folder.variant)};display:grid;grid-template-columns:32px minmax(0,1fr);min-width:0;`}
            >
              <div style="position:relative">
                <div
                  style={`background:${getLineColor(folder.variant)};border-radius:999px;height:100%;left:15px;position:absolute;top:0;width:2px;`}
                ></div>
                <div
                  style={`background:${getLineColor(folder.variant)};border-radius:999px;height:2px;left:15px;position:absolute;top:31px;width:18px;`}
                ></div>
              </div>
              <div
                style="align-items:center;display:grid;gap:10px;grid-template-columns:40px minmax(0,1fr);min-width:0;padding:0 14px 0 4px"
              >
                <span
                  style={`align-items:center;background:${getLineFill(folder.variant)};border:1px solid ${getLineColor(folder.variant)};border-radius:8px;color:var(--ui-accent-icon-glyph);display:inline-flex;height:38px;justify-content:center;width:38px;`}
                >
                  <FolderOpen size={18} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span style="display:grid;gap:4px;min-width:0;text-align:left">
                  <span
                    style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:11px;font-weight:750;gap:6px;line-height:14px;min-width:0"
                  >
                    {#each folder.path.slice(0, -1) as pathPart, index (pathPart)}
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        {pathPart}
                      </span>
                      {#if index < folder.path.length - 2}
                        <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
                      {/if}
                    {/each}
                  </span>
                  <span
                    style="color:var(--ui-normal-text);font-size:18px;font-weight:760;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >
                    {folder.path[folder.path.length - 1]}
                  </span>
                </span>
              </div>
            </div>
          {:else if folder.variant === 'ribbon'}
            <div
              style="align-items:center;display:grid;gap:12px;grid-template-columns:auto minmax(0,1fr);min-width:0;text-align:left"
            >
              <span
                style={`align-items:center;background:${getLineFill(folder.variant)};border:1px solid ${getLineColor(folder.variant)};border-radius:999px;color:var(--ui-accent-green-icon-glyph);display:grid;height:42px;justify-content:center;position:relative;width:42px;`}
              >
                <span
                  style={`background:${getLineColor(folder.variant)};height:2px;left:-13px;position:absolute;top:20px;width:13px;`}
                ></span>
                <Folder size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span style="display:grid;gap:7px;min-width:0">
                <span
                  style="align-items:center;display:flex;gap:6px;min-width:0;overflow:hidden"
                >
                  {#each folder.path as pathPart, index (pathPart)}
                    <span
                      style={`border:1px solid ${index === folder.path.length - 1 ? getLineColor(folder.variant) : 'var(--ui-neutral-muted-border)'};border-radius:999px;color:${index === folder.path.length - 1 ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};font-size:12px;font-weight:750;line-height:16px;min-width:0;overflow:hidden;padding:3px 8px;text-overflow:ellipsis;white-space:nowrap;`}
                    >
                      {pathPart}
                    </span>
                  {/each}
                </span>
                <span
                  style="color:var(--ui-muted-text);font-size:12px;font-weight:700;line-height:16px"
                >
                  {folder.promptCount} prompts
                </span>
              </span>
            </div>
          {:else}
            <div
              style="align-items:center;display:grid;gap:12px;grid-template-columns:44px minmax(0,1fr);min-width:0;text-align:left"
            >
              <span style="display:grid;height:46px;place-items:center;position:relative;width:44px">
                <span
                  style={`background:${getLineColor(folder.variant)};border-radius:999px;height:46px;left:10px;opacity:.82;position:absolute;top:0;width:2px;`}
                ></span>
                <span
                  style={`background:${getLineColor(folder.variant)};border-radius:999px;height:2px;left:10px;position:absolute;top:23px;width:28px;`}
                ></span>
                <span
                  style={`align-items:center;background:${getLineFill(folder.variant)};border:1px solid ${getLineColor(folder.variant)};border-radius:7px;color:var(--ui-accent-blue-icon-glyph);display:inline-flex;height:32px;justify-content:center;position:relative;width:32px;`}
                >
                  <FolderOpen size={17} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </span>
              <span style="display:grid;gap:3px;min-width:0">
                <span
                  style="color:var(--ui-normal-text);font-size:17px;font-weight:760;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                >
                  {folder.path[folder.path.length - 1]}
                </span>
                <span
                  style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:11px;font-weight:750;gap:6px;line-height:15px;min-width:0"
                >
                  {#each folder.path.slice(0, -1) as pathPart, index (pathPart)}
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      {pathPart}
                    </span>
                    {#if index < folder.path.length - 2}
                      <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
                    {/if}
                  {/each}
                </span>
              </span>
            </div>
          {/if}

          <span
            style="align-items:end;color:var(--ui-muted-text);display:grid;font-size:12px;font-weight:720;gap:4px;justify-items:end;line-height:16px;margin-left:12px;white-space:nowrap"
          >
            <span>{folder.promptCount} prompts</span>
            <span>{folder.updatedLabel}</span>
          </span>
        </button>

        <section style="display:grid;gap:24px;min-width:0" aria-label="Folder Settings">
          <div
            style="align-items:center;display:grid;gap:12px;grid-template-columns:40px minmax(0,1fr);min-width:0"
          >
            <span
              style="align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:8px;color:var(--ui-accent-icon-glyph);display:inline-flex;height:40px;justify-content:center;width:40px"
            >
              <Settings size={19} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span style="display:grid;gap:3px;min-width:0">
              <span style="color:var(--ui-normal-text);font-size:18px;font-weight:780;line-height:22px">
                Folder Settings
              </span>
              <span style="color:var(--ui-secondary-text);font-size:13px;line-height:18px">
                Settings that only affect prompts in this folder, and are saved to the workspace.
              </span>
            </span>
          </div>

          {#each settingRows as row (row.key)}
            <article
              style="border:1px solid var(--ui-card-normal-border);border-radius:8px;box-shadow:var(--cthulhu-ui-shadow-card);box-sizing:border-box;display:grid;gap:8px;min-width:0;padding:10px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end))"
            >
              <div
                style="align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;display:grid;gap:12px;grid-template-columns:minmax(0,1fr) auto;min-width:0;padding:8px 8px 8px 10px"
              >
                <span
                  style="align-items:center;display:grid;gap:10px;grid-template-columns:40px minmax(0,1fr);min-width:0"
                >
                  <span
                    style="align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:8px;color:var(--ui-accent-icon-glyph);display:inline-flex;height:38px;justify-content:center;width:38px"
                  >
                    <Folder size={18} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span style="display:grid;gap:4px;min-width:0">
                    <span
                      style="color:var(--ui-normal-text);font-size:15px;font-weight:700;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    >
                      {row.title}
                    </span>
                    <span
                      style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:11px;font-weight:750;gap:7px;line-height:16px"
                    >
                      <Folder size={12} strokeWidth={2.3} aria-hidden="true" />
                      Folder Settings
                      <span style="background:var(--ui-muted-text);border-radius:999px;height:3px;width:3px"></span>
                      {row.lines} lines
                      <span style="background:var(--ui-muted-text);border-radius:999px;height:3px;width:3px"></span>
                      {row.tokens} tokens
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Copy ${row.title}`}
                  style={getIconButtonStyle(`${folder.id}-${row.key}-copy`)}
                  onmouseenter={() => {
                    hoveredButtonId = `${folder.id}-${row.key}-copy`
                  }}
                  onmouseleave={() => {
                    hoveredButtonId = null
                  }}
                >
                  <Copy size={15} strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
              <div
                style="background:var(--ui-card-inset-surface);border-radius:7px;color:var(--ui-secondary-text);font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:13px;line-height:20px;min-height:72px;padding:12px"
              >
                {getSettingsValue(folder, row.key)}
              </div>
            </article>
          {/each}
        </section>

        <section style="display:grid;gap:10px;min-width:0" aria-label="Prompts">
          <div
            style="align-items:center;display:grid;gap:12px;grid-template-columns:40px minmax(0,1fr);margin-top:2px;min-width:0;padding-top:4px"
          >
            <span
              style="align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:8px;color:var(--ui-accent-icon-glyph);display:inline-flex;height:40px;justify-content:center;width:40px"
            >
              <FileText size={19} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span style="display:grid;gap:3px;min-width:0">
              <span style="color:var(--ui-normal-text);font-size:18px;font-weight:780;line-height:22px">
                Prompts
              </span>
              <span style="color:var(--ui-secondary-text);font-size:13px;line-height:18px">
                Create, edit, and organize prompts in this folder.
              </span>
            </span>
          </div>

          <div style="display:grid;gap:10px;margin-left:18px;min-width:0;padding-left:26px;position:relative;">
            <div
              style={`background:${getLineColor(folder.variant)};border-radius:999px;bottom:30px;left:0;opacity:.85;position:absolute;top:-14px;width:2px;`}
            ></div>

            <div style="align-items:center;display:flex;height:30px;justify-content:center;position:relative">
              <span
                style={`background:${getLineColor(folder.variant)};height:2px;left:-26px;opacity:.85;position:absolute;top:14px;width:calc(50% + 26px);`}
              ></span>
              <button
                type="button"
                style={getDividerButtonStyle(`${folder.id}-initial`)}
                onmouseenter={() => {
                  hoveredDividerId = `${folder.id}-initial`
                }}
                onmouseleave={() => {
                  hoveredDividerId = null
                }}
              >
                <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                Add Prompt
              </button>
            </div>

            {#each folder.prompts as prompt (prompt.id)}
              <article
                style={getPromptCardStyle(prompt.id)}
                onmouseenter={() => {
                  hoveredPromptId = prompt.id
                }}
                onmouseleave={() => {
                  hoveredPromptId = null
                }}
              >
                <div
                  style={`background:${getLineColor(folder.variant)};height:2px;left:-26px;opacity:.85;position:absolute;top:29px;width:24px;`}
                ></div>
                <div
                  style="align-items:center;background:var(--ui-neutral-muted-surface);border:1px solid var(--ui-card-nested-border);border-radius:7px;display:grid;gap:12px;grid-template-columns:minmax(0,1fr) auto;min-width:0;padding:8px 8px 8px 10px"
                >
                  <span
                    style="align-items:center;display:grid;gap:10px;grid-template-columns:40px minmax(0,1fr);min-width:0"
                  >
                    <span
                      style="align-items:center;background:var(--ui-accent-normal-surface);border:1px solid var(--ui-accent-normal-border);border-radius:8px;color:var(--ui-accent-icon-glyph);display:inline-flex;height:38px;justify-content:center;width:38px"
                    >
                      <FileText size={18} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span style="display:grid;gap:4px;min-width:0">
                      <span
                        style="color:var(--ui-normal-text);font-size:15px;font-weight:700;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                      >
                        {prompt.title}
                      </span>
                      <span
                        style="align-items:center;color:var(--ui-muted-text);display:flex;font-size:11px;font-weight:750;gap:7px;line-height:16px"
                      >
                        <Folder size={12} strokeWidth={2.3} aria-hidden="true" />
                        {prompt.folderLabel}
                        <span style="background:var(--ui-muted-text);border-radius:999px;height:3px;width:3px"></span>
                        {prompt.lines} lines
                        <span style="background:var(--ui-muted-text);border-radius:999px;height:3px;width:3px"></span>
                        {prompt.tokens} tokens
                      </span>
                    </span>
                  </span>
                  <span style="display:flex;gap:6px">
                    {#each rowButtons as button (button.id)}
                      {@const ButtonIcon = button.icon}
                      <button
                        type="button"
                        aria-label={button.label}
                        style={getIconButtonStyle(`${prompt.id}-${button.id}`, button.tone)}
                        onmouseenter={() => {
                          hoveredButtonId = `${prompt.id}-${button.id}`
                        }}
                        onmouseleave={() => {
                          hoveredButtonId = null
                        }}
                      >
                        <ButtonIcon size={15} strokeWidth={2.25} aria-hidden="true" />
                      </button>
                    {/each}
                  </span>
                </div>
                <div
                  style="background:var(--ui-card-inset-surface);border-radius:7px;color:var(--ui-secondary-text);font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:13px;line-height:20px;min-height:94px;padding:12px"
                >
                  {prompt.text}
                </div>
              </article>

              <div style="align-items:center;display:flex;height:30px;justify-content:center;position:relative">
                <span
                  style={`background:${getLineColor(folder.variant)};height:2px;left:-26px;opacity:.85;position:absolute;top:14px;width:calc(50% + 26px);`}
                ></span>
                <button
                  type="button"
                  style={getDividerButtonStyle(`${folder.id}-${prompt.id}`)}
                  onmouseenter={() => {
                    hoveredDividerId = `${folder.id}-${prompt.id}`
                  }}
                  onmouseleave={() => {
                    hoveredDividerId = null
                  }}
                >
                  <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                  Add Prompt
                </button>
              </div>
            {/each}
          </div>
        </section>

        <div
          style="align-items:center;color:var(--ui-success-normal-text);display:flex;font-size:12px;font-weight:740;gap:8px;justify-content:center;line-height:16px;padding:3px 0 8px"
        >
          <Check size={14} strokeWidth={2.4} aria-hidden="true" />
          Saved
        </div>
      </section>
    {/each}
  </div>
</div>
