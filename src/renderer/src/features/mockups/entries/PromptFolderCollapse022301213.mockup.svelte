<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    CheckSquare,
    ChevronDown,
    Clipboard,
    FileText,
    Folder,
    GripVertical,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type SectionKey = 'settings' | 'prompts'
  type ButtonKey =
    | SectionKey
    | 'header-folder'
    | 'header-section'
    | 'settings-copy-description'
    | 'settings-copy-prefix'
    | 'settings-copy-suffix'
    | 'divider-initial'
    | 'divider-after-context'
    | 'divider-after-review'
    | 'divider-after-final'
    | `prompt-copy-${number}`
    | `prompt-delete-${number}`
    | `prompt-up-${number}`
    | `prompt-down-${number}`
    | `prompt-drag-${number}`

  type SettingsCard = {
    key: 'description' | 'prefix' | 'suffix'
    title: string
    infoText: string
    metadataFolderLabel: string
    lineCount: string
    tokenCount: string
    text: string
    copyKey: ButtonKey
  }

  type PromptCard = {
    title: string
    folder: string
    lineCount: string
    tokenCount: string
    updated: string
    text: string
  }

  let collapsedSections = $state<Record<SectionKey, boolean>>({
    settings: false,
    prompts: false
  })
  let hoveredButton = $state<ButtonKey | null>(null)
  let focusedTitleIndex = $state<number | null>(null)

  const settingsCards: SettingsCard[] = [
    {
      key: 'description',
      title: 'Folder Description',
      infoText:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      metadataFolderLabel: 'Folder Settings',
      lineCount: '4 lines',
      tokenCount: '82 tokens',
      text:
        'Engineering prompts for planning, debugging, and implementation work in the desktop app.\n\nKeep each prompt scoped, testable, and ready to paste into coding assistants.',
      copyKey: 'settings-copy-description'
    },
    {
      key: 'prefix',
      title: 'Prompt Folder Prefix',
      infoText:
        'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      metadataFolderLabel: 'Folder Settings',
      lineCount: '3 lines',
      tokenCount: '44 tokens',
      text:
        'You are working in the Cthulhu Prompt repository.\nRead the surrounding code first and keep changes tightly scoped.',
      copyKey: 'settings-copy-prefix'
    },
    {
      key: 'suffix',
      title: 'Prompt Folder Suffix',
      infoText:
        'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      metadataFolderLabel: 'Folder Settings',
      lineCount: '2 lines',
      tokenCount: '28 tokens',
      text: 'Before finishing, explain what changed and list any checks that were not run.',
      copyKey: 'settings-copy-suffix'
    }
  ]

  const prompts: PromptCard[] = [
    {
      title: 'Review hydration edge case',
      folder: 'Prompt Folders',
      lineCount: '7 lines',
      tokenCount: '116 tokens',
      updated: 'Updated 9 minutes ago',
      text:
        'Review the prompt folder hydration path and identify why the active row can jump after restoring editor state.\n\nFocus on virtual row measurement, persisted scroll position, and any lifecycle effects that can report stale heights.'
    },
    {
      title: 'Implement collapsible sections',
      folder: 'Prompt Folders',
      lineCount: '8 lines',
      tokenCount: '143 tokens',
      updated: 'Updated 42 minutes ago',
      text:
        'Add collapsible section controls to the prompt folder screen. Folder Settings and Prompts should each have an accessible toggle that hides the section body while keeping the section header visible.\n\nPreserve keyboard behavior and keep the visual style aligned with cthulhu-ui surfaces.'
    },
    {
      title: 'Write focused Playwright coverage',
      folder: 'Prompt Folders',
      lineCount: '5 lines',
      tokenCount: '91 tokens',
      updated: 'Updated yesterday',
      text:
        'Create an end-to-end test that opens a prompt folder, collapses settings, collapses prompts, reloads the route, and confirms the visible content remains coherent.'
    }
  ]

  const toggleSection = (section: SectionKey) => {
    collapsedSections[section] = !collapsedSections[section]
  }

  const handleHoverStart = (key: ButtonKey) => {
    hoveredButton = key
  }

  const handleHoverEnd = (key: ButtonKey) => {
    if (hoveredButton === key) {
      hoveredButton = null
    }
  }

  const shellStyle =
    'position:relative;display:flex;flex:1 1 auto;min-height:0;flex-direction:column;color:var(--ui-normal-text);'
  const headerBarStyle =
    'display:flex;height:36px;flex:0 0 auto;align-items:center;padding:0 24px;background:var(--ui-card-nested-surface);border-bottom:1px solid var(--ui-neutral-muted-border);'
  const bodyStyle =
    'flex:1 1 auto;min-height:0;overflow-y:auto;padding:24px 24px 48px 24px;box-sizing:border-box;'
  const contentStyle =
    'display:grid;gap:24px;align-content:start;min-width:0;width:100%;box-sizing:border-box;'
  const cardSurfaceStyle =
    'display:grid;gap:10px;min-width:0;box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:8px;padding:10px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));background-repeat:no-repeat;box-shadow:none;'
  const editorTextStyle =
    'min-height:92px;margin:0;padding:12px;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-field-surface);color:var(--ui-secondary-text);font-family:ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace;font-size:13px;line-height:20px;white-space:pre-wrap;overflow:hidden;'
  const metadataDotStyle =
    'display:inline-block;width:3px;height:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);flex:0 0 auto;'

  const breadcrumbButtonStyle = (key: ButtonKey, active = false) =>
    [
      'border:0;background:transparent;padding:0;font:inherit;cursor:pointer;min-width:0;transition:color 120ms ease;',
      active
        ? 'color:var(--ui-hoverable-text);'
        : hoveredButton === key
          ? 'color:var(--ui-hoverable-text);'
          : 'color:var(--ui-muted-text);'
    ].join('')

  const iconTileStyle = (variant: 'accent' | 'blue' | 'green' = 'accent') => {
    const surface =
      variant === 'blue'
        ? 'var(--ui-accent-blue-normal-surface)'
        : variant === 'green'
          ? 'var(--ui-accent-green-normal-surface)'
          : 'var(--ui-accent-normal-surface)'
    const border =
      variant === 'blue'
        ? 'var(--ui-accent-blue-normal-border)'
        : variant === 'green'
          ? 'var(--ui-accent-green-normal-border)'
          : 'var(--ui-accent-normal-border)'
    const color =
      variant === 'blue'
        ? 'var(--ui-accent-blue-icon-glyph)'
        : variant === 'green'
          ? 'var(--ui-accent-green-icon-glyph)'
          : 'var(--ui-accent-icon-glyph)'
    return `display:inline-flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:7px;border:1px solid ${border};background:${surface};color:${color};box-shadow:inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);flex:0 0 auto;`
  }

  const sectionButtonStyle = (section: SectionKey) => {
    const isHovered = hoveredButton === section
    return [
      'width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;text-align:left;border:1px solid;',
      'border-radius:8px;padding:14px 16px 14px 16px;cursor:pointer;box-sizing:border-box;',
      'box-shadow:inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);transition:background 120ms ease,border-color 120ms ease,box-shadow 120ms ease;',
      isHovered
        ? 'background:var(--ui-neutral-hover-surface);border-color:var(--ui-neutral-hover-border);'
        : 'background:var(--ui-neutral-muted-surface);border-color:var(--ui-card-nested-border);'
    ].join('')
  }

  const smallButtonStyle = (key: ButtonKey, emphasis: 'neutral' | 'danger' = 'neutral') => {
    const isHovered = hoveredButton === key
    const surface =
      emphasis === 'danger'
        ? isHovered
          ? 'var(--ui-danger-hover-surface)'
          : 'var(--ui-danger-normal-surface)'
        : isHovered
          ? 'var(--ui-neutral-hover-surface)'
          : 'var(--ui-neutral-muted-surface)'
    const border =
      emphasis === 'danger'
        ? isHovered
          ? 'var(--ui-danger-hover-border)'
          : 'var(--ui-danger-normal-border)'
        : isHovered
          ? 'var(--ui-neutral-interactive-hover-border)'
          : 'var(--ui-neutral-interactive-muted-border)'
    const color =
      emphasis === 'danger'
        ? isHovered
          ? 'var(--ui-normal-text)'
          : 'var(--ui-hoverable-text)'
        : isHovered
          ? 'var(--ui-normal-text)'
          : 'var(--ui-secondary-text)'
    return `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:7px;border:1px solid ${border};background:${surface};color:${color};cursor:pointer;transition:background 120ms ease,border-color 120ms ease,color 120ms ease;`
  }

  const dividerButtonStyle = (key: ButtonKey) => {
    const isHovered = hoveredButton === key
    return [
      'display:inline-flex;height:30px;align-items:center;justify-content:center;gap:7px;border-radius:999px;border:1px solid;',
      'padding:0 12px;font-size:12px;font-weight:750;line-height:16px;white-space:nowrap;cursor:pointer;',
      'box-shadow:inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);transition:background 120ms ease,border-color 120ms ease,color 120ms ease;',
      isHovered
        ? 'background:var(--ui-accent-hover-surface);border-color:var(--ui-accent-hover-border);color:var(--ui-normal-text);'
        : 'background:var(--ui-accent-normal-surface);border-color:var(--ui-accent-normal-border);color:var(--ui-accent-normal-text);'
    ].join('')
  }

  const titleInputStyle = (index: number) =>
    [
      'width:100%;height:22px;min-width:0;border:0;background:transparent;padding:0;outline:none;',
      'font-family:inherit;font-size:15px;font-weight:600;line-height:20px;color:var(--ui-normal-text);',
      focusedTitleIndex === index ? 'text-decoration:underline;text-decoration-color:var(--ui-neutral-focus-border);text-underline-offset:4px;' : ''
    ].join('')
</script>

{#snippet sectionHeader({
  section,
  title,
  description,
  icon,
  count,
  iconVariant = 'accent'
}: {
  section: SectionKey
  title: string
  description: string
  icon: ComponentType
  count: string
  iconVariant?: 'accent' | 'blue' | 'green'
})}
  {@const isCollapsed = collapsedSections[section]}
  {@const Icon = icon}
  <button
    type="button"
    aria-expanded={!isCollapsed}
    style={sectionButtonStyle(section)}
    onmouseenter={() => handleHoverStart(section)}
    onmouseleave={() => handleHoverEnd(section)}
    onclick={() => toggleSection(section)}
  >
    <span style="display:grid;grid-template-columns:3px 32px minmax(0,1fr);gap:13px;align-items:center;min-width:0;">
      <span style="display:block;width:3px;height:46px;border-radius:999px;background:var(--ui-accent-normal-border);"></span>
      <span style={iconTileStyle(iconVariant)}>
        <Icon size={17} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span style="display:grid;gap:4px;min-width:0;">
        <span style="display:flex;align-items:center;gap:9px;min-width:0;">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:21px;font-weight:760;line-height:26px;">
            {title}
          </span>
          <span style="display:inline-flex;height:20px;align-items:center;border-radius:999px;border:1px solid var(--ui-neutral-muted-border);background:var(--ui-neutral-muted-surface);padding:0 8px;color:var(--ui-secondary-text);font-size:11px;font-weight:750;line-height:18px;white-space:nowrap;">
            {count}
          </span>
        </span>
        <span style="color:var(--ui-muted-text);font-size:13px;line-height:18px;">
          {description}
        </span>
      </span>
    </span>
    <span style="display:inline-flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:7px;border:1px solid var(--ui-card-nested-border);background:var(--ui-neutral-muted-surface);color:var(--ui-secondary-text);">
      {#if isCollapsed}
        <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
      {:else}
        <ChevronDown size={18} strokeWidth={2.4} style="transform:rotate(180deg);" aria-hidden="true" />
      {/if}
    </span>
  </button>
{/snippet}

{#snippet metadataRow({
  folder,
  lineCount,
  tokenCount,
  updated
}: {
  folder: string
  lineCount: string
  tokenCount: string
  updated?: string
})}
  <span style="display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;color:var(--ui-muted-text);font-size:11px;font-weight:750;line-height:16px;white-space:nowrap;">
    <span style="display:inline-flex;align-items:center;gap:5px;max-width:220px;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--ui-secondary-text);white-space:nowrap;">
      <Folder size={12} strokeWidth={2.4} aria-hidden="true" />
      {folder}
    </span>
    <span style={metadataDotStyle}></span>
    <span>{lineCount}</span>
    <span style={metadataDotStyle}></span>
    <span>{tokenCount}</span>
    {#if updated}
      <span style={metadataDotStyle}></span>
      <span>{updated}</span>
    {/if}
  </span>
{/snippet}

{#snippet titleBar({
  icon,
  title,
  folder,
  lineCount,
  tokenCount,
  updated,
  iconVariant,
  index,
  copyKey,
  deleteKey
}: {
  icon: ComponentType
  title: string
  folder: string
  lineCount: string
  tokenCount: string
  updated?: string
  iconVariant: 'accent' | 'blue' | 'green'
  index?: number
  copyKey: ButtonKey
  deleteKey?: ButtonKey
})}
  {@const Icon = icon}
  <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);padding:8px 8px 8px 10px;box-sizing:border-box;">
    <div style="display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;min-width:0;">
      <span style={iconTileStyle(iconVariant)}>
        <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span style="display:grid;gap:4px;min-width:0;">
        {#if typeof index === 'number'}
          <input
            aria-label="Title"
            value={title}
            style={titleInputStyle(index)}
            onfocus={() => {
              focusedTitleIndex = index
            }}
            onblur={() => {
              focusedTitleIndex = null
            }}
          />
        {:else}
          <span style="height:22px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-normal-text);font-size:15px;font-weight:600;line-height:20px;">
            {title}
          </span>
        {/if}
        {@render metadataRow({ folder, lineCount, tokenCount, updated })}
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;">
      <button
        type="button"
        aria-label="Copy"
        title="Copy"
        style={smallButtonStyle(copyKey)}
        onmouseenter={() => handleHoverStart(copyKey)}
        onmouseleave={() => handleHoverEnd(copyKey)}
      >
        <Clipboard size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>
      {#if deleteKey}
        <button
          type="button"
          aria-label="Delete"
          title="Delete"
          style={smallButtonStyle(deleteKey, 'danger')}
          onmouseenter={() => handleHoverStart(deleteKey)}
          onmouseleave={() => handleHoverEnd(deleteKey)}
        >
          <Trash2 size={15} strokeWidth={2.3} aria-hidden="true" />
        </button>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet settingsCard(card: SettingsCard)}
  <div style={cardSurfaceStyle}>
    {@render titleBar({
      icon: Folder,
      title: card.title,
      folder: card.metadataFolderLabel,
      lineCount: card.lineCount,
      tokenCount: card.tokenCount,
      iconVariant: 'accent',
      copyKey: card.copyKey
    })}
    <div style="display:flex;align-items:flex-start;gap:9px;border:1px solid var(--ui-info-normal-border);border-radius:7px;background:var(--ui-info-normal-surface);padding:9px 10px;color:var(--ui-secondary-text);font-size:12px;line-height:17px;">
      <CheckSquare size={15} strokeWidth={2.2} style="margin-top:1px;color:var(--ui-accent-blue-icon-glyph);flex:0 0 auto;" aria-hidden="true" />
      <span>{card.infoText}</span>
    </div>
    <pre style={editorTextStyle}>{card.text}</pre>
  </div>
{/snippet}

{#snippet promptDivider(key: ButtonKey)}
  <div style="display:grid;height:48px;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);gap:10px;align-items:center;min-width:0;">
    <span style="height:1px;background:var(--ui-neutral-muted-border);"></span>
    <button
      type="button"
      aria-label="Add prompt"
      style={dividerButtonStyle(key)}
      onmouseenter={() => handleHoverStart(key)}
      onmouseleave={() => handleHoverEnd(key)}
    >
      <Plus size={14} strokeWidth={3} aria-hidden="true" />
      <span>Add prompt</span>
    </button>
    <span style="height:1px;background:var(--ui-neutral-muted-border);"></span>
  </div>
{/snippet}

{#snippet promptCard(prompt: PromptCard, index: number)}
  <div style="display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;min-width:0;box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:8px;padding:10px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));background-repeat:no-repeat;box-shadow:none;">
    <div style="display:grid;gap:8px;align-content:start;justify-items:center;padding-top:1px;">
      <button
        type="button"
        aria-label="Move prompt"
        title="Move prompt"
        style={smallButtonStyle(`prompt-drag-${index}`)}
        onmouseenter={() => handleHoverStart(`prompt-drag-${index}`)}
        onmouseleave={() => handleHoverEnd(`prompt-drag-${index}`)}
      >
        <GripVertical size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Move up"
        title="Move up"
        style={smallButtonStyle(`prompt-up-${index}`)}
        onmouseenter={() => handleHoverStart(`prompt-up-${index}`)}
        onmouseleave={() => handleHoverEnd(`prompt-up-${index}`)}
      >
        <ArrowUp size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        title="Move down"
        style={smallButtonStyle(`prompt-down-${index}`)}
        onmouseenter={() => handleHoverStart(`prompt-down-${index}`)}
        onmouseleave={() => handleHoverEnd(`prompt-down-${index}`)}
      >
        <ArrowDown size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </div>
    <div style="display:grid;gap:8px;min-width:0;">
      {@render titleBar({
        icon: FileText,
        title: prompt.title,
        folder: prompt.folder,
        lineCount: prompt.lineCount,
        tokenCount: prompt.tokenCount,
        updated: prompt.updated,
        iconVariant: 'blue',
        index,
        copyKey: `prompt-copy-${index}`,
        deleteKey: `prompt-delete-${index}`
      })}
      <pre style={editorTextStyle}>{prompt.text}</pre>
    </div>
  </div>
{/snippet}

<main style={shellStyle} data-testid="prompt-folder-screen">
  <div style={headerBarStyle}>
    <div style="display:flex;min-width:0;align-items:center;font-size:14px;font-weight:500;">
      <button
        type="button"
        style={breadcrumbButtonStyle('header-folder')}
        onmouseenter={() => handleHoverStart('header-folder')}
        onmouseleave={() => handleHoverEnd('header-folder')}
      >
        Desktop App Engineering
      </button>
      <span style="margin:0 4px;padding:0 8px;color:var(--ui-neutral-emphasis-border);">/</span>
      <button
        type="button"
        style={breadcrumbButtonStyle('header-section', true)}
        onmouseenter={() => handleHoverStart('header-section')}
        onmouseleave={() => handleHoverEnd('header-section')}
      >
        {collapsedSections.settings ? 'Prompts' : 'Folder Settings'}
      </button>
    </div>
  </div>

  <div style={bodyStyle}>
    <div style={contentStyle}>
      <section style="display:grid;gap:14px;min-width:0;">
        {@render sectionHeader({
          section: 'settings',
          title: 'Folder Settings',
          description: 'Settings that only affect prompts in this folder, and are saved to the workspace.',
          icon: Settings,
          count: `${settingsCards.length} cards`,
          iconVariant: 'accent'
        })}

        {#if !collapsedSections.settings}
          <div style="display:grid;gap:24px;min-width:0;">
            {#each settingsCards as card (card.key)}
              {@render settingsCard(card)}
            {/each}
          </div>
        {/if}
      </section>

      <section style="display:grid;gap:14px;min-width:0;">
        {@render sectionHeader({
          section: 'prompts',
          title: 'Prompts',
          description: 'Create, edit, and organize prompts in this folder.',
          icon: FileText,
          count: `${prompts.length} prompts`,
          iconVariant: 'blue'
        })}

        {#if !collapsedSections.prompts}
          <div style="display:grid;gap:0;min-width:0;">
            {@render promptDivider('divider-initial')}
            {#each prompts as prompt, index (prompt.title)}
              {@render promptCard(prompt, index)}
              {@render promptDivider(index === 0 ? 'divider-after-context' : index === 1 ? 'divider-after-review' : 'divider-after-final')}
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</main>
