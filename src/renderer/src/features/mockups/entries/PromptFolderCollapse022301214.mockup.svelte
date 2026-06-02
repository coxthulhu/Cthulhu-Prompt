<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Copy,
    FileText,
    Folder,
    GripVertical,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type SettingsCard = {
    title: string
    copyLabel: string
    meta: string
    info: string
    text: string
  }

  type PromptCard = {
    id: string
    title: string
    meta: string
    text: string
  }

  let settingsCollapsed = $state(false)
  let promptsCollapsed = $state(false)
  let hovered = $state<string | null>(null)

  const settingsCards: SettingsCard[] = [
    {
      title: 'Folder Description',
      copyLabel: 'Copy folder description',
      meta: 'Folder Settings · 4 lines · 49 tokens',
      info:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      text:
        'Prompt patterns for release preparation, bug investigation, and code-review handoff. Keep entries concise, scoped, and ready to paste into a coding assistant.'
    },
    {
      title: 'Prompt Folder Prefix',
      copyLabel: 'Copy folder prefix',
      meta: 'Folder Settings · 3 lines · 38 tokens',
      info:
        'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      text:
        'You are working in the Cthulhu Prompt Electron app. Read the relevant files first, preserve user edits, and keep the change tightly scoped.'
    },
    {
      title: 'Prompt Folder Suffix',
      copyLabel: 'Copy folder suffix',
      meta: 'Folder Settings · 2 lines · 25 tokens',
      info:
        'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      text: 'Before finishing, summarize the changed files and any verification that was run.'
    }
  ]

  const prompts: PromptCard[] = [
    {
      id: 'release-checklist',
      title: 'Release Checklist Review',
      meta: 'Prompts · 9 lines · 142 tokens · Updated 18 minutes ago',
      text:
        'Review the release checklist for missing validation steps. Focus on packaging, renderer startup, persisted workspace data, and updater behavior. Return findings first with file references where possible.'
    },
    {
      id: 'autosave-regression',
      title: 'Autosave Regression Investigation',
      meta: 'Prompts · 12 lines · 188 tokens · Updated yesterday',
      text:
        'Trace the autosave flow from editor change events through draft cache persistence. Identify where a rapid folder switch could drop a pending mutation or stale measured height.'
    },
    {
      id: 'ui-polish-pass',
      title: 'Prompt Folder UI Polish',
      meta: 'Prompts · 7 lines · 119 tokens · Updated May 29',
      text:
        'Inspect the prompt folder screen for density, contrast, hover states, and keyboard affordances. Suggest small changes that improve scanning without adding new navigation concepts.'
    }
  ]

  const rootStyle =
    'width:100%; min-width:0; box-sizing:border-box; color:var(--ui-normal-text); font-family:Aptos, "Segoe UI Variable", "Segoe UI", sans-serif;'
  const headerBarStyle =
    'height:36px; display:flex; align-items:center; padding:0 24px; box-sizing:border-box; background:var(--ui-card-nested-surface); border-bottom:1px solid var(--ui-neutral-muted-border);'
  const breadcrumbStyle =
    'display:flex; align-items:center; min-width:0; font-size:14px; font-weight:600; line-height:20px;'
  const scrollStyle =
    'min-height:0; display:grid; gap:24px; padding:24px 0 56px; box-sizing:border-box;'
  const sectionShellStyle =
    'display:grid; gap:12px; min-width:0;'
  const cardGridStyle =
    'display:grid; gap:24px; min-width:0;'
  const sectionHeaderOuterStyle =
    'display:grid; gap:0; min-width:0; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:var(--cthulhu-ui-shadow-card); overflow:hidden;'
  const sectionHeaderButtonBase =
    'appearance:none; border:0; width:100%; min-width:0; min-height:68px; display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:12px; padding:12px 14px 12px 16px; box-sizing:border-box; color:var(--ui-normal-text); font:inherit; text-align:left; cursor:pointer; transition:background-color 120ms ease, color 120ms ease;'
  const sectionAccentStyle =
    'width:3px; align-self:stretch; background:var(--ui-accent-normal-border); border-radius:999px; grid-row:1 / span 1;'
  const sectionTitleWrapStyle =
    'display:grid; grid-template-columns:auto minmax(0, 1fr); align-items:center; gap:10px; min-width:0;'
  const iconTileBase =
    'width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; box-sizing:border-box; flex:0 0 auto;'
  const titleStackStyle = 'display:grid; gap:3px; min-width:0;'
  const sectionTitleStyle =
    'margin:0; color:var(--ui-normal-text); font-size:20px; font-weight:760; line-height:26px; min-width:0;'
  const sectionDescriptionStyle =
    'margin:0; color:var(--ui-muted-text); font-size:13px; font-weight:500; line-height:18px; min-width:0;'
  const sectionCountStyle =
    'display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:24px; padding:0 8px; border-radius:999px; border:1px solid var(--ui-neutral-muted-border); background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text); font-size:12px; font-weight:750; box-sizing:border-box;'
  const cardStyle =
    'display:grid; gap:8px; min-width:0; padding:10px; box-sizing:border-box; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:var(--cthulhu-ui-shadow-card);'
  const titleBarStyle =
    'display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:12px; min-width:0; padding:8px 8px 8px 10px; box-sizing:border-box; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface);'
  const titleMainStyle =
    'display:grid; grid-template-columns:40px minmax(0, 1fr); align-items:center; gap:10px; min-width:0;'
  const cardTitleStyle =
    'margin:0; color:var(--ui-normal-text); font-size:15px; font-weight:650; line-height:20px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'
  const metadataStyle =
    'display:flex; align-items:center; gap:7px; min-width:0; overflow:hidden; white-space:nowrap; color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px;'
  const dotStyle =
    'width:3px; height:3px; border-radius:999px; background:var(--ui-neutral-emphasis-border); flex:0 0 auto;'
  const infoStyle =
    'display:flex; align-items:flex-start; gap:8px; min-width:0; padding:9px 10px; box-sizing:border-box; border-radius:7px; border:1px solid var(--ui-info-normal-border); background:var(--ui-info-normal-surface); color:var(--ui-secondary-text); font-size:12px; line-height:17px;'
  const editorStyle =
    'min-height:86px; padding:12px; box-sizing:border-box; border-radius:7px; border:1px solid var(--ui-card-nested-border); background:var(--ui-neutral-field-surface); color:var(--ui-hoverable-text); font-family:"Cascadia Code", Consolas, monospace; font-size:13px; line-height:20px; white-space:pre-wrap;'
  const promptCardStyle =
    'display:grid; grid-template-columns:28px minmax(0, 1fr); align-items:stretch; gap:10px; min-width:0; padding:10px; box-sizing:border-box; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow:var(--cthulhu-ui-shadow-card);'
  const promptBodyStyle = 'display:grid; gap:8px; min-width:0;'
  const sidebarStyle =
    'display:grid; grid-template-rows:28px 28px 1fr 28px; gap:6px; align-items:center; justify-items:center; min-width:0; padding-top:2px;'
  const dividerStyle =
    'display:grid; grid-template-columns:minmax(24px, 1fr) auto minmax(24px, 1fr); align-items:center; gap:10px; min-height:40px;'
  const separatorStyle = 'height:1px; background:var(--ui-neutral-muted-border);'
  const collapsedBodyStyle =
    'padding:10px 14px 14px 31px; box-sizing:border-box; border-top:1px solid var(--ui-neutral-muted-border); color:var(--ui-muted-text); font-size:13px; line-height:18px;'

  const iconStyle = 'width:16px; height:16px; stroke-width:2.4; flex:0 0 auto;'
  const tileIconStyle = 'width:18px; height:18px; stroke-width:2.4;'

  const handleHover = (id: string | null) => {
    hovered = id
  }

  const sectionButtonStyle = (id: string) =>
    `${sectionHeaderButtonBase} background:${hovered === id ? 'var(--ui-neutral-muted-surface)' : 'transparent'};`

  const iconTileStyle = (variant: 'accent' | 'blue' | 'green' | 'neutral') => {
    if (variant === 'blue') {
      return `${iconTileBase} background:var(--ui-accent-blue-normal-surface); color:var(--ui-accent-blue-icon-glyph);`
    }

    if (variant === 'green') {
      return `${iconTileBase} background:var(--ui-accent-green-normal-surface); color:var(--ui-accent-green-icon-glyph);`
    }

    if (variant === 'neutral') {
      return `${iconTileBase} background:var(--ui-neutral-emphasis-surface); color:var(--ui-normal-text);`
    }

    return `${iconTileBase} background:var(--ui-accent-normal-surface); color:var(--ui-accent-icon-glyph);`
  }

  const iconButtonStyle = (id: string, variant: 'neutral' | 'danger' = 'neutral') => {
    const isHovered = hovered === id
    if (variant === 'danger') {
      return `width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; padding:0; border-radius:7px; border:1px solid ${isHovered ? 'var(--ui-danger-hover-border)' : 'var(--ui-danger-normal-border)'}; background:${isHovered ? 'var(--ui-danger-hover-surface)' : 'var(--ui-danger-normal-surface)'}; color:var(--ui-danger-icon-glyph); cursor:pointer; transition:background-color 120ms ease, border-color 120ms ease;`
    }

    return `width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; padding:0; border-radius:7px; border:1px solid ${isHovered ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-muted-border)'}; background:${isHovered ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-muted-surface)'}; color:${isHovered ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}; cursor:pointer; transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease;`
  }

  const copyButtonStyle = (id: string) =>
    `height:30px; display:inline-flex; align-items:center; gap:7px; padding:0 10px; border-radius:7px; border:1px solid ${hovered === id ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-interactive-normal-border)'}; background:${hovered === id ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}; color:${hovered === id ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease;`

  const addPromptStyle = (id: string) =>
    `height:30px; display:inline-flex; align-items:center; gap:7px; padding:0 12px; border-radius:999px; border:1px solid ${hovered === id ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; background:${hovered === id ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color:${hovered === id ? 'var(--ui-normal-text)' : 'var(--ui-accent-normal-text)'}; font:inherit; font-size:12px; font-weight:750; cursor:pointer; box-shadow:var(--cthulhu-ui-shadow-surface-highlight); transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease;`
</script>

<main style={rootStyle} data-testid="prompt-folder-collapse-mockup">
  <div style={headerBarStyle}>
    <div style={breadcrumbStyle}>
      <button
        type="button"
        style={`appearance:none; border:0; background:transparent; padding:0; color:${hovered === 'breadcrumb-folder' ? 'var(--ui-hoverable-text)' : 'var(--ui-muted-text)'}; font:inherit; cursor:pointer; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; transition:color 120ms ease;`}
        onmouseenter={() => handleHover('breadcrumb-folder')}
        onmouseleave={() => handleHover(null)}
      >
        Release Workflow Prompts
      </button>
      <span style="color:var(--ui-neutral-emphasis-border); margin:0 4px; padding:0 8px;">/</span>
      <button
        type="button"
        style={`appearance:none; border:0; background:transparent; padding:0; color:${hovered === 'breadcrumb-section' ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font:inherit; cursor:pointer; white-space:nowrap; transition:color 120ms ease;`}
        onmouseenter={() => handleHover('breadcrumb-section')}
        onmouseleave={() => handleHover(null)}
      >
        {settingsCollapsed ? 'Prompts' : 'Folder Settings'}
      </button>
    </div>
  </div>

  <div style={scrollStyle}>
    <section style={sectionShellStyle} aria-label="Folder Settings">
      <div style={sectionHeaderOuterStyle}>
        <button
          type="button"
          style={sectionButtonStyle('settings-toggle')}
          aria-expanded={!settingsCollapsed}
          onclick={() => {
            settingsCollapsed = !settingsCollapsed
          }}
          onmouseenter={() => handleHover('settings-toggle')}
          onmouseleave={() => handleHover(null)}
        >
          <span style={sectionAccentStyle}></span>
          <span style={sectionTitleWrapStyle}>
            <span style={iconTileStyle('accent')}>
              <Settings style={tileIconStyle} aria-hidden="true" />
            </span>
            <span style={titleStackStyle}>
              <span style={sectionTitleStyle}>Folder Settings</span>
              <span style={sectionDescriptionStyle}>
                Settings that only affect prompts in this folder, and are saved to the workspace.
              </span>
            </span>
          </span>
          <span style="display:inline-flex; align-items:center; gap:10px;">
            <span style={sectionCountStyle}>3</span>
            {#if settingsCollapsed}
              <ChevronRight style={iconStyle} aria-hidden="true" />
            {:else}
              <ChevronDown style={iconStyle} aria-hidden="true" />
            {/if}
          </span>
        </button>
        {#if settingsCollapsed}
          <div style={collapsedBodyStyle}>Folder description, prefix, and suffix hidden</div>
        {/if}
      </div>

      {#if !settingsCollapsed}
        <div style={cardGridStyle}>
          {#each settingsCards as card, cardIndex (card.title)}
            <article style={cardStyle}>
              <div style={titleBarStyle}>
                <div style={titleMainStyle}>
                  <span style={iconTileStyle(cardIndex === 1 ? 'blue' : cardIndex === 2 ? 'green' : 'accent')}>
                    <Folder style="width:20px; height:20px; stroke-width:2.4;" aria-hidden="true" />
                  </span>
                  <div style={titleStackStyle}>
                    <h3 style={cardTitleStyle}>{card.title}</h3>
                    <div style={metadataStyle}>
                      <span style="display:inline-flex; align-items:center; gap:5px; color:var(--ui-secondary-text); min-width:0; overflow:hidden; text-overflow:ellipsis;">
                        <Folder style="width:12px; height:12px; stroke-width:2.4; flex:0 0 auto;" aria-hidden="true" />
                        {card.meta.split(' · ')[0]}
                      </span>
                      {#each card.meta.split(' · ').slice(1) as item (item)}
                        <span style={dotStyle}></span>
                        <span>{item}</span>
                      {/each}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  style={copyButtonStyle(`settings-copy-${cardIndex}`)}
                  aria-label={card.copyLabel}
                  title={card.copyLabel}
                  onmouseenter={() => handleHover(`settings-copy-${cardIndex}`)}
                  onmouseleave={() => handleHover(null)}
                >
                  <Copy style="width:14px; height:14px; stroke-width:2.4;" aria-hidden="true" />
                  <span>Copy</span>
                </button>
              </div>
              <div style={infoStyle}>{card.info}</div>
              <div style={editorStyle}>{card.text}</div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section style={sectionShellStyle} aria-label="Prompts">
      <div style={sectionHeaderOuterStyle}>
        <button
          type="button"
          style={sectionButtonStyle('prompts-toggle')}
          aria-expanded={!promptsCollapsed}
          onclick={() => {
            promptsCollapsed = !promptsCollapsed
          }}
          onmouseenter={() => handleHover('prompts-toggle')}
          onmouseleave={() => handleHover(null)}
        >
          <span style={sectionAccentStyle}></span>
          <span style={sectionTitleWrapStyle}>
            <span style={iconTileStyle('accent')}>
              <FileText style={tileIconStyle} aria-hidden="true" />
            </span>
            <span style={titleStackStyle}>
              <span style={sectionTitleStyle}>Prompts</span>
              <span style={sectionDescriptionStyle}>
                Create, edit, and organize prompts in this folder.
              </span>
            </span>
          </span>
          <span style="display:inline-flex; align-items:center; gap:10px;">
            <span style={sectionCountStyle}>{prompts.length}</span>
            {#if promptsCollapsed}
              <ChevronRight style={iconStyle} aria-hidden="true" />
            {:else}
              <ChevronDown style={iconStyle} aria-hidden="true" />
            {/if}
          </span>
        </button>
        {#if promptsCollapsed}
          <div style={collapsedBodyStyle}>{prompts.length} prompts hidden</div>
        {/if}
      </div>

      {#if !promptsCollapsed}
        <div style={dividerStyle}>
          <span style={separatorStyle}></span>
          <button
            type="button"
            style={addPromptStyle('add-initial')}
            onmouseenter={() => handleHover('add-initial')}
            onmouseleave={() => handleHover(null)}
          >
            <Plus style="width:14px; height:14px; stroke-width:3;" aria-hidden="true" />
            <span>Add prompt</span>
          </button>
          <span style={separatorStyle}></span>
        </div>

        <div style={cardGridStyle}>
          {#each prompts as prompt, promptIndex (prompt.id)}
            <article style={promptCardStyle}>
              <div style={sidebarStyle}>
                <button
                  type="button"
                  style={iconButtonStyle(`drag-${prompt.id}`)}
                  aria-label="Move prompt"
                  onmouseenter={() => handleHover(`drag-${prompt.id}`)}
                  onmouseleave={() => handleHover(null)}
                >
                  <GripVertical style="width:15px; height:15px; stroke-width:2.4;" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  style={iconButtonStyle(`up-${prompt.id}`)}
                  aria-label="Move prompt up"
                  onmouseenter={() => handleHover(`up-${prompt.id}`)}
                  onmouseleave={() => handleHover(null)}
                >
                  <ArrowUp style="width:15px; height:15px; stroke-width:2.4;" aria-hidden="true" />
                </button>
                <span></span>
                <button
                  type="button"
                  style={iconButtonStyle(`down-${prompt.id}`)}
                  aria-label="Move prompt down"
                  onmouseenter={() => handleHover(`down-${prompt.id}`)}
                  onmouseleave={() => handleHover(null)}
                >
                  <ArrowDown style="width:15px; height:15px; stroke-width:2.4;" aria-hidden="true" />
                </button>
              </div>

              <div style={promptBodyStyle}>
                <div style={titleBarStyle}>
                  <div style={titleMainStyle}>
                    <span style={iconTileStyle(promptIndex === 1 ? 'blue' : promptIndex === 2 ? 'green' : 'accent')}>
                      <FileText style="width:20px; height:20px; stroke-width:2.4;" aria-hidden="true" />
                    </span>
                    <div style={titleStackStyle}>
                      <h3 style={cardTitleStyle}>{prompt.title}</h3>
                      <div style={metadataStyle}>
                        <span style="display:inline-flex; align-items:center; gap:5px; color:var(--ui-secondary-text); min-width:0; overflow:hidden; text-overflow:ellipsis;">
                          <Folder style="width:12px; height:12px; stroke-width:2.4; flex:0 0 auto;" aria-hidden="true" />
                          {prompt.meta.split(' · ')[0]}
                        </span>
                        {#each prompt.meta.split(' · ').slice(1) as item (item)}
                          <span style={dotStyle}></span>
                          <span>{item}</span>
                        {/each}
                      </div>
                    </div>
                  </div>
                  <span style="display:inline-flex; align-items:center; gap:8px;">
                    <button
                      type="button"
                      style={iconButtonStyle(`copy-${prompt.id}`)}
                      aria-label="Copy prompt"
                      title="Copy prompt"
                      onmouseenter={() => handleHover(`copy-${prompt.id}`)}
                      onmouseleave={() => handleHover(null)}
                    >
                      <Copy style="width:15px; height:15px; stroke-width:2.4;" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      style={iconButtonStyle(`delete-${prompt.id}`, 'danger')}
                      aria-label="Delete prompt"
                      title="Delete prompt"
                      onmouseenter={() => handleHover(`delete-${prompt.id}`)}
                      onmouseleave={() => handleHover(null)}
                    >
                      <Trash2 style="width:15px; height:15px; stroke-width:2.4;" aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <div style={editorStyle}>{prompt.text}</div>
              </div>
            </article>

            <div style={dividerStyle}>
              <span style={separatorStyle}></span>
              <button
                type="button"
                style={addPromptStyle(`add-after-${prompt.id}`)}
                onmouseenter={() => handleHover(`add-after-${prompt.id}`)}
                onmouseleave={() => handleHover(null)}
              >
                <Plus style="width:14px; height:14px; stroke-width:3;" aria-hidden="true" />
                <span>Add prompt</span>
              </button>
              <span style={separatorStyle}></span>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</main>
