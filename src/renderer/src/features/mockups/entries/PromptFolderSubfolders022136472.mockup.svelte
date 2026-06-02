<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    Copy,
    FileText,
    Folder,
    FolderCog,
    MoreHorizontal,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type SettingsCard = {
    id: string
    title: string
    label: string
    text: string
    lines: string
    tokens: string
  }

  type PromptCard = {
    id: string
    title: string
    folderLabel: string
    lines: string
    tokens: string
    updated: string
    body: string
  }

  type FolderSection = {
    id: string
    name: string
    promptCount: number
    depth: number
    tone: 'root' | 'subfolder' | 'nested'
    settings: SettingsCard[]
    prompts: PromptCard[]
  }

  let hoveredId = $state<string | null>(null)

  const setHovered = (id: string | null) => {
    hoveredId = id
  }

  const isHovered = (id: string) => hoveredId === id

  const folderSections: FolderSection[] = [
    {
      id: 'folder-main',
      name: 'Coding Prompts',
      promptCount: 2,
      depth: 0,
      tone: 'root',
      settings: [
        {
          id: 'main-description',
          title: 'Folder Description',
          label: 'Coding Prompts',
          text:
            'Reusable prompts for daily implementation work, bug hunts, code review, and release preparation.',
          lines: '2 lines',
          tokens: '31 tokens'
        },
        {
          id: 'main-prefix',
          title: 'Prompt Folder Prefix',
          label: 'Coding Prompts',
          text:
            'You are working in the Cthulhu Prompt Electron app. Read the nearby code first and preserve existing user edits.',
          lines: '3 lines',
          tokens: '40 tokens'
        }
      ],
      prompts: [
        {
          id: 'prompt-architecture-review',
          title: 'Review architecture risk',
          folderLabel: 'Coding Prompts',
          lines: '10 lines',
          tokens: '164 tokens',
          updated: 'Updated 8 minutes ago',
          body:
            'Review this change for architectural risk, hidden coupling, and missing test coverage. Prioritize concrete findings with file and line references.'
        },
        {
          id: 'prompt-small-refactor',
          title: 'Plan a small refactor',
          folderLabel: 'Coding Prompts',
          lines: '8 lines',
          tokens: '118 tokens',
          updated: 'Updated yesterday',
          body:
            'Suggest a scoped refactor that removes duplication without changing behavior. Keep the plan incremental and call out the validation commands.'
        }
      ]
    },
    {
      id: 'folder-svelte',
      name: 'Svelte 5',
      promptCount: 2,
      depth: 1,
      tone: 'subfolder',
      settings: [
        {
          id: 'svelte-description',
          title: 'Folder Description',
          label: 'Svelte 5',
          text:
            'Prompts that focus on Svelte 5 runes, snippets, component structure, and renderer UI polish.',
          lines: '2 lines',
          tokens: '29 tokens'
        },
        {
          id: 'svelte-suffix',
          title: 'Prompt Folder Suffix',
          label: 'Svelte 5',
          text:
            'Use Svelte 5 runes and snippets. Avoid stores for local state and keep lifecycle side effects clearly commented.',
          lines: '3 lines',
          tokens: '35 tokens'
        }
      ],
      prompts: [
        {
          id: 'prompt-runes-component',
          title: 'Convert component to runes',
          folderLabel: 'Svelte 5',
          lines: '14 lines',
          tokens: '210 tokens',
          updated: 'Updated 12 minutes ago',
          body:
            'Convert this component to Svelte 5 runes. Keep props typed, use derived state for computed values, and replace slot usage with snippets.'
        },
        {
          id: 'prompt-renderer-polish',
          title: 'Polish renderer layout',
          folderLabel: 'Svelte 5',
          lines: '11 lines',
          tokens: '181 tokens',
          updated: 'Updated 2 hours ago',
          body:
            'Improve this renderer layout using the existing palette and cthulhu-ui patterns. Keep controls stable across desktop and narrow widths.'
        }
      ]
    },
    {
      id: 'folder-playwright',
      name: 'Playwright',
      promptCount: 1,
      depth: 2,
      tone: 'nested',
      settings: [
        {
          id: 'playwright-description',
          title: 'Folder Description',
          label: 'Playwright',
          text:
            'End-to-end prompt templates for regression coverage, selector design, and captured renderer errors.',
          lines: '2 lines',
          tokens: '27 tokens'
        }
      ],
      prompts: [
        {
          id: 'prompt-playwright-spec',
          title: 'Write a focused Playwright spec',
          folderLabel: 'Playwright',
          lines: '15 lines',
          tokens: '238 tokens',
          updated: 'Updated 36 minutes ago',
          body:
            'Write a Playwright test that reproduces the exact workflow. Use test helpers, stable data-testid selectors, and verify the user-visible result.'
        }
      ]
    }
  ]

  const rootStyle =
    'box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--ui-normal-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
  const screenStyle =
    'box-sizing:border-box;display:flex;min-height:0;height:100%;width:100%;flex-direction:column;'
  const headerStyle =
    'box-sizing:border-box;display:flex;height:36px;flex:none;align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);background:oklch(0.145 0.011 266.847 / 82%);padding:0 24px;'
  const scrollStyle =
    'box-sizing:border-box;min-height:0;flex:1;overflow:auto;padding:24px 28px 80px 28px;'
  const contentStyle =
    'box-sizing:border-box;display:grid;gap:22px;max-width:1120px;min-width:0;'
  const folderStackStyle = 'box-sizing:border-box;display:grid;gap:24px;min-width:0;'
  const sectionHeaderStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;border-left:3px solid var(--ui-accent-normal-border);padding:0 0 0 14px;min-width:0;'
  const editorIndentStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;min-width:0;'
  const promptEditorCardStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:var(--cthulhu-ui-shadow-card);padding:10px;'
  const editorBodyStyle = 'box-sizing:border-box;display:grid;gap:8px;min-width:0;'
  const titleBarStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);padding:8px 8px 8px 10px;'
  const titleMainStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;min-width:0;'
  const iconTileStyle =
    'box-sizing:border-box;display:flex;height:40px;width:40px;align-items:center;justify-content:center;border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);'
  const editorTextStyle =
    'box-sizing:border-box;min-height:112px;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-field-surface);padding:14px 16px;color:var(--ui-hoverable-text);font-family:"Cascadia Code","Consolas",monospace;font-size:13px;line-height:21px;white-space:pre-wrap;'
  const sidebarStyle =
    'box-sizing:border-box;display:grid;gap:6px;align-content:start;justify-items:center;padding-top:2px;'
  const dividerStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);gap:10px;align-items:center;min-height:42px;'

  const getButtonStyle = (id: string, variant: 'neutral' | 'accent' | 'ghost' = 'neutral') => {
    const hovered = isHovered(id)
    const palette =
      variant === 'accent'
        ? {
            background: hovered
              ? 'var(--ui-accent-hover-surface)'
              : 'var(--ui-accent-normal-surface)',
            border: hovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)',
            color: hovered ? 'var(--ui-normal-text)' : 'var(--ui-accent-normal-text)'
          }
        : variant === 'ghost'
          ? {
              background: hovered ? 'var(--ui-neutral-normal-surface)' : 'transparent',
              border: 'transparent',
              color: hovered ? 'var(--ui-normal-text)' : 'var(--ui-muted-text)'
            }
          : {
              background: hovered
                ? 'var(--ui-neutral-hover-surface)'
                : 'var(--ui-neutral-normal-surface)',
              border: hovered
                ? 'var(--ui-neutral-interactive-hover-border)'
                : 'var(--ui-neutral-interactive-normal-border)',
              color: hovered ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'
            }

    return `box-sizing:border-box;display:inline-flex;height:34px;align-items:center;justify-content:center;gap:7px;border:1px solid ${palette.border};border-radius:var(--cthulhu-ui-radius-control);background:${palette.background};color:${palette.color};font-size:12px;font-weight:750;line-height:16px;padding:0 11px;cursor:pointer;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease,box-shadow 120ms ease;`
  }

  const getIconButtonStyle = (id: string, danger = false) => {
    const hovered = isHovered(id)
    const background = danger
      ? hovered
        ? 'var(--ui-danger-hover-surface)'
        : 'var(--ui-danger-normal-surface)'
      : hovered
        ? 'var(--ui-neutral-hover-surface)'
        : 'var(--ui-neutral-muted-surface)'
    const border = danger
      ? hovered
        ? 'var(--ui-danger-hover-border)'
        : 'var(--ui-danger-normal-border)'
      : hovered
        ? 'var(--ui-neutral-hover-border)'
        : 'var(--ui-neutral-muted-border)'
    const color = danger
      ? 'var(--ui-danger-icon-glyph)'
      : hovered
        ? 'var(--ui-normal-text)'
        : 'var(--ui-secondary-text)'

    return `box-sizing:border-box;display:inline-flex;height:32px;width:32px;align-items:center;justify-content:center;border:1px solid ${border};border-radius:var(--cthulhu-ui-radius-control);background:${background};color:${color};cursor:pointer;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease;`
  }

  const getFolderTitleStyle = (section: FolderSection) => {
    const hovered = isHovered(`${section.id}-title`)
    const background =
      section.tone === 'root'
        ? hovered
          ? 'var(--ui-accent-hover-surface)'
          : 'var(--ui-accent-normal-surface)'
        : section.tone === 'subfolder'
          ? hovered
            ? 'var(--ui-neutral-hover-surface)'
            : 'oklch(0.666 0.181 254.617 / 12%)'
          : hovered
            ? 'var(--ui-neutral-hover-surface)'
            : 'var(--ui-neutral-muted-surface)'
    const border =
      section.tone === 'root'
        ? hovered
          ? 'var(--ui-accent-hover-border)'
          : 'var(--ui-accent-normal-border)'
        : section.tone === 'subfolder'
          ? hovered
            ? 'var(--ui-neutral-interactive-hover-border)'
            : 'var(--ui-accent-blue-normal-border)'
          : hovered
            ? 'var(--ui-neutral-hover-border)'
            : 'var(--ui-neutral-normal-border)'

    return `box-sizing:border-box;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;min-width:0;border:1px solid ${border};border-radius:8px;background:${background};box-shadow:inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);padding:9px 11px;cursor:pointer;transition:background-color 120ms ease,border-color 120ms ease;`
  }

  const getConnectorRailStyle = (section: FolderSection) => {
    const color =
      section.depth === 0
        ? 'transparent'
        : section.depth === 1
          ? 'var(--ui-accent-blue-normal-border)'
          : 'var(--ui-accent-green-normal-border)'
    return `box-sizing:border-box;position:relative;min-width:28px;width:28px;border-left:2px solid ${color};margin-left:${section.depth === 0 ? '0' : '13px'};`
  }

  const getConnectorElbowStyle = (section: FolderSection) => {
    const color =
      section.depth === 1
        ? 'var(--ui-accent-blue-normal-border)'
        : 'var(--ui-accent-green-normal-border)'
    return `box-sizing:border-box;position:absolute;left:-2px;top:18px;width:17px;height:18px;border-left:2px solid ${color};border-bottom:2px solid ${color};border-bottom-left-radius:7px;`
  }

  const getSectionWrapStyle = (section: FolderSection) =>
    `box-sizing:border-box;display:grid;grid-template-columns:${section.depth === 0 ? '0px' : '28px'} minmax(0,1fr);gap:${section.depth === 0 ? '0' : '10px'};min-width:0;`

  const getPromptIndentRailStyle = (section: FolderSection) => {
    const color =
      section.depth === 0
        ? 'var(--ui-neutral-normal-border)'
        : section.depth === 1
          ? 'var(--ui-accent-blue-normal-border)'
          : 'var(--ui-accent-green-normal-border)'
    return `box-sizing:border-box;width:28px;min-width:28px;position:relative;border-left:2px solid ${color};margin-left:13px;opacity:${section.depth === 0 ? '0.55' : '1'};`
  }

  const getPillStyle = (section: FolderSection) => {
    const background =
      section.tone === 'root'
        ? 'var(--ui-accent-normal-surface)'
        : section.tone === 'subfolder'
          ? 'var(--ui-info-normal-surface)'
          : 'var(--ui-success-normal-surface)'
    const border =
      section.tone === 'root'
        ? 'var(--ui-accent-normal-border)'
        : section.tone === 'subfolder'
          ? 'var(--ui-info-normal-border)'
          : 'var(--ui-success-normal-border)'
    return `box-sizing:border-box;display:inline-flex;height:24px;align-items:center;border:1px solid ${border};border-radius:999px;background:${background};color:var(--ui-hoverable-text);font-size:11px;font-weight:750;line-height:14px;padding:0 9px;white-space:nowrap;`
  }
</script>

{#snippet metadataDot()}
  <span
    style="box-sizing:border-box;display:inline-block;height:3px;width:3px;flex:none;border-radius:999px;background:var(--ui-neutral-emphasis-border);"
  ></span>
{/snippet}

{#snippet button(
  id: string,
  label: string,
  Icon: ComponentType,
  variant: 'neutral' | 'accent' | 'ghost' = 'neutral'
)}
  <button
    type="button"
    style={getButtonStyle(id, variant)}
    onmouseenter={() => setHovered(id)}
    onmouseleave={() => setHovered(null)}
  >
    <Icon size={14} strokeWidth={2.6} />
    {label}
  </button>
{/snippet}

{#snippet iconButton(id: string, label: string, Icon: ComponentType, danger = false)}
  <button
    type="button"
    aria-label={label}
    title={label}
    style={getIconButtonStyle(id, danger)}
    onmouseenter={() => setHovered(id)}
    onmouseleave={() => setHovered(null)}
  >
    <Icon size={15} strokeWidth={2.5} />
  </button>
{/snippet}

{#snippet divider(id: string)}
  <div style={dividerStyle}>
    <div
      style="box-sizing:border-box;height:1px;min-width:0;background:var(--ui-neutral-muted-border);"
    ></div>
    {@render button(id, 'Add prompt', Plus, 'accent')}
    <div
      style="box-sizing:border-box;height:1px;min-width:0;background:var(--ui-neutral-muted-border);"
    ></div>
  </div>
{/snippet}

{#snippet sectionHeader(title: string, description: string, Icon: ComponentType)}
  <div style={sectionHeaderStyle}>
    <div style="box-sizing:border-box;display:grid;gap:4px;min-width:0;">
      <div
        style="box-sizing:border-box;display:flex;align-items:center;gap:10px;min-width:0;color:var(--ui-normal-text);"
      >
        <span
          style="box-sizing:border-box;display:flex;height:34px;width:34px;flex:none;align-items:center;justify-content:center;border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-neutral-emphasis-surface);color:var(--ui-normal-text);"
        >
          <Icon size={18} strokeWidth={2.4} />
        </span>
        <h2
          style="box-sizing:border-box;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;font-weight:760;line-height:24px;"
        >
          {title}
        </h2>
      </div>
      <p
        style="box-sizing:border-box;margin:0;color:var(--ui-muted-text);font-size:13px;font-weight:520;line-height:18px;"
      >
        {description}
      </p>
    </div>
  </div>
{/snippet}

{#snippet titleBar(title: string, folderLabel: string, lines: string, tokens: string, updated: string | null)}
  <div style={titleBarStyle}>
    <div style={titleMainStyle}>
      <span style={iconTileStyle}>
        <FileText size={20} strokeWidth={2.4} />
      </span>
      <div style="box-sizing:border-box;display:grid;gap:4px;min-width:0;">
        <p
          style="box-sizing:border-box;height:22px;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:15px;font-weight:650;line-height:20px;"
        >
          {title}
        </p>
        <div
          style="box-sizing:border-box;display:flex;min-width:0;align-items:center;gap:7px;overflow:hidden;white-space:nowrap;color:var(--ui-muted-text);font-size:11px;font-weight:750;line-height:16px;"
        >
          <span
            style="box-sizing:border-box;display:inline-flex;min-width:0;max-width:220px;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-secondary-text);"
          >
            <Folder size={12} strokeWidth={2.4} />
            {folderLabel}
          </span>
          {@render metadataDot()}
          <span>{lines}</span>
          {@render metadataDot()}
          <span>{tokens}</span>
          {#if updated}
            {@render metadataDot()}
            <span>{updated}</span>
          {/if}
        </div>
      </div>
    </div>
    <div style="box-sizing:border-box;display:flex;gap:7px;align-items:center;">
      {@render iconButton(`${title}-copy`, 'Copy prompt', Copy)}
      {@render iconButton(`${title}-delete`, 'Delete prompt', Trash2, true)}
    </div>
  </div>
{/snippet}

{#snippet settingsCard(card: SettingsCard)}
  <div
    style="box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:var(--cthulhu-ui-shadow-card);padding:10px;"
  >
    {@render titleBar(card.title, card.label, card.lines, card.tokens, null)}
    <div
      style="box-sizing:border-box;border:1px solid var(--ui-neutral-normal-border);border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-neutral-muted-surface);padding:10px 12px;color:var(--ui-secondary-text);font-size:13px;font-weight:520;line-height:19px;"
    >
      {card.text}
    </div>
    <div style={editorTextStyle}>{card.text}</div>
  </div>
{/snippet}

{#snippet promptCard(prompt: PromptCard)}
  <div style={promptEditorCardStyle}>
    <div style={sidebarStyle}>
      {@render iconButton(`${prompt.id}-more`, 'Prompt actions', MoreHorizontal)}
      {@render iconButton(`${prompt.id}-copy`, 'Copy prompt', Copy)}
    </div>
    <div style={editorBodyStyle}>
      {@render titleBar(prompt.title, prompt.folderLabel, prompt.lines, prompt.tokens, prompt.updated)}
      <div style={editorTextStyle}>{prompt.body}</div>
    </div>
  </div>
{/snippet}

{#snippet folderTitle(section: FolderSection)}
  <button
    type="button"
    style={getFolderTitleStyle(section)}
    onmouseenter={() => setHovered(`${section.id}-title`)}
    onmouseleave={() => setHovered(null)}
  >
    <span
      style="box-sizing:border-box;display:flex;height:30px;width:30px;align-items:center;justify-content:center;border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-neutral-emphasis-surface);color:var(--ui-normal-text);"
    >
      {#if section.depth === 0}
        <ChevronDown size={16} strokeWidth={2.6} />
      {:else}
        <ChevronRight size={16} strokeWidth={2.6} />
      {/if}
    </span>
    <span
      style="box-sizing:border-box;display:flex;min-width:0;align-items:center;gap:9px;color:var(--ui-normal-text);"
    >
      <Folder size={18} strokeWidth={2.4} />
      <span
        style="box-sizing:border-box;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:760;line-height:20px;"
      >
        {section.name}
      </span>
    </span>
    <span style={getPillStyle(section)}>{section.promptCount} prompts</span>
  </button>
{/snippet}

{#snippet folderSection(section: FolderSection)}
  <section style={getSectionWrapStyle(section)}>
    {#if section.depth > 0}
      <div style={getConnectorRailStyle(section)}>
        <span style={getConnectorElbowStyle(section)}></span>
      </div>
    {:else}
      <div></div>
    {/if}

    <div style="box-sizing:border-box;display:grid;gap:16px;min-width:0;">
      {@render folderTitle(section)}

      <div style="box-sizing:border-box;display:grid;gap:18px;min-width:0;">
        {@render sectionHeader(`${section.name} Settings`, 'Settings saved with this folder.', Settings)}
        <div style="box-sizing:border-box;display:grid;gap:12px;min-width:0;">
          {#each section.settings as card (card.id)}
            {@render settingsCard(card)}
          {/each}
        </div>
      </div>

      <div style="box-sizing:border-box;display:grid;gap:10px;min-width:0;">
        {@render sectionHeader(`${section.name} Prompts`, 'Create, edit, and organize prompts in this folder.', FileText)}
        {@render divider(`${section.id}-initial-divider`)}
        {#each section.prompts as prompt (prompt.id)}
          <div style={editorIndentStyle}>
            <div style={getPromptIndentRailStyle(section)}></div>
            {@render promptCard(prompt)}
          </div>
          {@render divider(`${prompt.id}-divider`)}
        {/each}
      </div>
    </div>
  </section>
{/snippet}

<div style={rootStyle}>
  <main style={screenStyle} data-testid="prompt-folder-subfolders-mockup">
    <div style={headerStyle}>
      <div
        style="box-sizing:border-box;display:flex;min-width:0;align-items:center;color:var(--ui-muted-text);font-size:14px;font-weight:600;line-height:20px;"
      >
        <button
          type="button"
          style="box-sizing:border-box;min-width:0;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;color:var(--ui-muted-text);font:inherit;padding:0;transition:color 120ms ease;"
        >
          Coding Prompts
        </button>
        <span style="box-sizing:border-box;padding:0 10px;color:var(--ui-neutral-emphasis-border);"
          >/</span
        >
        <button
          type="button"
          style="box-sizing:border-box;cursor:pointer;white-space:nowrap;border:0;background:transparent;color:var(--ui-hoverable-text);font:inherit;padding:0;transition:color 120ms ease;"
        >
          Svelte 5
        </button>
      </div>
    </div>

    <div style={scrollStyle}>
      <div style={contentStyle}>
        <div
          style="box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;min-width:0;"
        >
          <div style="box-sizing:border-box;display:grid;gap:5px;min-width:0;">
            <h1
              style="box-sizing:border-box;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:22px;font-weight:780;line-height:30px;"
            >
              Coding Prompts
            </h1>
            <p
              style="box-sizing:border-box;margin:0;color:var(--ui-muted-text);font-size:13px;font-weight:540;line-height:18px;"
            >
              3 folders, 5 prompts
            </p>
          </div>
          <div style="box-sizing:border-box;display:flex;gap:9px;align-items:center;">
            {@render button('new-subfolder', 'New subfolder', FolderCog, 'neutral')}
            {@render button('add-prompt-top', 'Add prompt', Plus, 'accent')}
          </div>
        </div>

        <div style={folderStackStyle}>
          {#each folderSections as section (section.id)}
            {@render folderSection(section)}
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>
