<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    Clipboard,
    FileText,
    Folder,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type SectionId = 'settings' | 'prompts'

  type SettingsCard = {
    id: string
    title: string
    metadata: string
    info: string
    text: string
  }

  type PromptCard = {
    id: string
    title: string
    metadata: string
    text: string
    updated: string
  }

  let collapsedSections = $state<Record<SectionId, boolean>>({
    settings: false,
    prompts: false
  })
  let hoveredControl = $state<string | null>(null)

  const settingsCards: SettingsCard[] = [
    {
      id: 'description',
      title: 'Folder Description',
      metadata: 'Folder Settings • 3 lines • 41 tokens',
      info: 'A general description of this folder and the types of prompts that are within it. For informational use only.',
      text: 'Reusable coding prompts for planning, implementing, reviewing, and polishing renderer features. Keep instructions specific, scoped, and ready to copy into coding tools.'
    },
    {
      id: 'prefix',
      title: 'Prompt Folder Prefix',
      metadata: 'Folder Settings • 4 lines • 56 tokens',
      info: 'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      text: 'You are working in the Cthulhu Prompt renderer. Follow Svelte 5 runes patterns, use the shared palette, and keep implementation details aligned with existing components.'
    },
    {
      id: 'suffix',
      title: 'Prompt Folder Suffix',
      metadata: 'Folder Settings • 2 lines • 22 tokens',
      info: 'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      text: 'Verify behavior with focused tests when the change touches user workflows.'
    }
  ]

  const promptCards: PromptCard[] = [
    {
      id: 'plan',
      title: 'Plan Renderer Feature',
      metadata: 'Prompts • 10 lines • 164 tokens',
      updated: 'Updated 8 minutes ago',
      text: 'Read the relevant renderer files first. Identify the smallest set of components, data models, and tests that need to change. Then propose a concise implementation path before editing.'
    },
    {
      id: 'implement',
      title: 'Implement Svelte 5 Interaction',
      metadata: 'Prompts • 14 lines • 232 tokens',
      updated: 'Updated 24 minutes ago',
      text: 'Implement the interaction using Svelte 5 runes. Keep state local unless it needs to be shared, prefer existing cthulhu-ui components, and use palette variables for renderer colors.'
    },
    {
      id: 'review',
      title: 'Review UI Regression',
      metadata: 'Prompts • 8 lines • 118 tokens',
      updated: 'Updated yesterday',
      text: 'Review the UI change for overflow, keyboard behavior, focus visibility, and unintended layout shifts. Call out any missing test coverage or edge cases.'
    }
  ]

  const toggleSection = (sectionId: SectionId) => {
    collapsedSections[sectionId] = !collapsedSections[sectionId]
  }

  const isHovered = (id: string) => hoveredControl === id

  const pageStyle = [
    'position:relative',
    'display:flex',
    'min-height:0',
    'height:100%',
    'flex:1 1 auto',
    'flex-direction:column',
    'color:var(--ui-normal-text)'
  ].join(';')

  const headerBarStyle = [
    'display:flex',
    'height:36px',
    'flex-shrink:0',
    'align-items:center',
    'border-bottom:1px solid var(--ui-neutral-muted-border)',
    'background:var(--ui-card-nested-surface)',
    'padding:0 24px'
  ].join(';')

  const breadcrumbStyle = [
    'display:flex',
    'min-width:0',
    'align-items:center',
    'font-size:14px',
    'font-weight:600',
    'line-height:20px'
  ].join(';')

  const breadcrumbButtonStyle = (id: string, active = false) =>
    [
      'min-width:0',
      'border:0',
      'background:transparent',
      `color:${active || isHovered(id) ? 'var(--ui-hoverable-text)' : 'var(--ui-muted-text)'}`,
      'cursor:pointer',
      'font:inherit',
      'overflow:hidden',
      'padding:0',
      'text-overflow:ellipsis',
      'transition:color 120ms ease',
      'white-space:nowrap'
    ].join(';')

  const scrollStyle = [
    'min-height:0',
    'flex:1 1 auto',
    'overflow:auto',
    'padding:24px 24px 80px'
  ].join(';')

  const contentStyle = [
    'display:grid',
    'gap:24px',
    'min-width:0',
    'max-width:1120px',
    'padding-right:8px'
  ].join(';')

  const sectionShellStyle = ['display:grid', 'gap:14px', 'min-width:0'].join(';')

  const sectionHeaderStyle = (id: string, collapsed: boolean) =>
    [
      'align-items:center',
      'background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
      'border:1px solid var(--ui-card-normal-border)',
      'border-left:3px solid var(--ui-accent-normal-border)',
      'border-radius:8px',
      'box-shadow:var(--cthulhu-ui-shadow-card)',
      'box-sizing:border-box',
      'color:var(--ui-normal-text)',
      'cursor:pointer',
      'display:grid',
      'gap:14px',
      'grid-template-columns:auto minmax(0, 1fr) auto',
      'min-width:0',
      'padding:12px 14px 12px 16px',
      'text-align:left',
      'transition:background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      isHovered(id)
        ? 'border-color:var(--ui-neutral-hover-border);box-shadow:0 8px 22px var(--ui-shadow-raised), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight)'
        : 'box-shadow:var(--cthulhu-ui-shadow-card)',
      collapsed ? 'background-color:var(--ui-neutral-muted-surface)' : ''
    ]
      .filter(Boolean)
      .join(';')

  const iconTileStyle = [
    'align-items:center',
    'background:var(--ui-accent-normal-surface)',
    'border:1px solid var(--ui-accent-normal-border)',
    'border-radius:7px',
    'box-shadow:var(--cthulhu-ui-shadow-surface-highlight)',
    'color:var(--ui-accent-icon-glyph)',
    'display:inline-flex',
    'height:32px',
    'justify-content:center',
    'width:32px'
  ].join(';')

  const sectionTitleBlockStyle = ['display:grid', 'gap:3px', 'min-width:0'].join(';')

  const sectionTitleRowStyle = [
    'align-items:center',
    'display:flex',
    'gap:8px',
    'min-width:0'
  ].join(';')

  const sectionTitleStyle = [
    'color:var(--ui-normal-text)',
    'font-size:20px',
    'font-weight:760',
    'line-height:26px',
    'margin:0',
    'min-width:0'
  ].join(';')

  const sectionDescriptionStyle = [
    'color:var(--ui-muted-text)',
    'font-size:13px',
    'font-weight:500',
    'line-height:18px',
    'margin:0',
    'min-width:0'
  ].join(';')

  const countPillStyle = [
    'align-items:center',
    'background:var(--ui-neutral-normal-surface)',
    'border:1px solid var(--ui-neutral-normal-border)',
    'border-radius:999px',
    'color:var(--ui-secondary-text)',
    'display:inline-flex',
    'font-size:12px',
    'font-weight:750',
    'height:26px',
    'justify-content:center',
    'line-height:16px',
    'padding:0 10px',
    'white-space:nowrap'
  ].join(';')

  const cardsGridStyle = ['display:grid', 'gap:16px', 'min-width:0'].join(';')

  const cardStyle = [
    'background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
    'border:1px solid var(--ui-card-normal-border)',
    'border-radius:8px',
    'box-shadow:none',
    'box-sizing:border-box',
    'display:grid',
    'gap:8px',
    'min-width:0',
    'padding:10px'
  ].join(';')

  const titleBarStyle = [
    'align-items:center',
    'background:var(--ui-neutral-muted-surface)',
    'border:1px solid var(--ui-card-nested-border)',
    'border-radius:7px',
    'display:grid',
    'gap:12px',
    'grid-template-columns:minmax(0, 1fr) auto',
    'min-width:0',
    'padding:8px 8px 8px 10px'
  ].join(';')

  const titleMainStyle = [
    'align-items:center',
    'display:grid',
    'gap:10px',
    'grid-template-columns:40px minmax(0, 1fr)',
    'min-width:0'
  ].join(';')

  const mediumIconTileStyle = [
    'align-items:center',
    'background:var(--ui-accent-normal-surface)',
    'border:1px solid var(--ui-accent-normal-border)',
    'border-radius:7px',
    'box-shadow:var(--cthulhu-ui-shadow-surface-highlight)',
    'color:var(--ui-accent-icon-glyph)',
    'display:inline-flex',
    'height:40px',
    'justify-content:center',
    'width:40px'
  ].join(';')

  const titleCopyStyle = ['display:grid', 'gap:4px', 'min-width:0'].join(';')

  const cardTitleStyle = [
    'color:var(--ui-normal-text)',
    'font-size:15px',
    'font-weight:600',
    'line-height:20px',
    'margin:0',
    'min-width:0',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap'
  ].join(';')

  const metadataRowStyle = [
    'align-items:center',
    'color:var(--ui-muted-text)',
    'display:flex',
    'flex-wrap:nowrap',
    'font-size:11px',
    'font-weight:750',
    'gap:7px',
    'line-height:16px',
    'min-width:0',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';')

  const iconButtonStyle = (id: string, danger = false) =>
    [
      'align-items:center',
      `background:${isHovered(id) ? (danger ? 'var(--ui-danger-hover-surface)' : 'var(--ui-neutral-hover-surface)') : 'var(--ui-neutral-muted-surface)'}`,
      `border:1px solid ${isHovered(id) ? (danger ? 'var(--ui-danger-hover-border)' : 'var(--ui-neutral-hover-border)') : 'var(--ui-neutral-muted-border)'}`,
      'border-radius:7px',
      `color:${danger ? 'var(--ui-danger-icon-glyph)' : 'var(--ui-secondary-text)'}`,
      'cursor:pointer',
      'display:inline-flex',
      'height:32px',
      'justify-content:center',
      'padding:0',
      'transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease',
      'width:32px'
    ].join(';')

  const actionBarStyle = [
    'align-items:center',
    'display:flex',
    'gap:6px',
    'justify-content:flex-end'
  ].join(';')

  const infoRowStyle = [
    'background:var(--ui-card-inset-surface)',
    'border-radius:7px',
    'color:var(--ui-muted-text)',
    'font-size:13px',
    'line-height:18px',
    'margin:0',
    'padding:9px 10px'
  ].join(';')

  const editorStyle = [
    'background:var(--ui-neutral-field-surface)',
    'border:1px solid var(--ui-card-nested-border)',
    'border-radius:7px',
    'box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
    'box-sizing:border-box',
    'color:var(--ui-secondary-text)',
    'font-family:Consolas, Monaco, monospace',
    'font-size:13px',
    'line-height:20px',
    'min-height:92px',
    'padding:12px',
    'white-space:pre-wrap'
  ].join(';')

  const dividerStyle = ['display:grid', 'gap:10px', 'grid-template-columns:1fr auto 1fr'].join(';')

  const separatorStyle = [
    'align-self:center',
    'background:var(--ui-neutral-muted-border)',
    'height:1px'
  ].join(';')

  const addButtonStyle = (id: string) =>
    [
      'align-items:center',
      `background:${isHovered(id) ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
      `border:1px solid ${isHovered(id) ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}`,
      'border-radius:999px',
      'box-shadow:var(--cthulhu-ui-shadow-surface-highlight)',
      'color:var(--ui-accent-normal-text)',
      'cursor:pointer',
      'display:inline-flex',
      'font-size:12px',
      'font-weight:750',
      'gap:7px',
      'height:30px',
      'justify-content:center',
      'line-height:16px',
      'padding:0 12px',
      'transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease',
      'white-space:nowrap'
    ].join(';')
</script>

<main style={pageStyle} data-testid="prompt-folder-screen">
  <div style={headerBarStyle}>
    <div style={breadcrumbStyle}>
      <button
        type="button"
        style={breadcrumbButtonStyle('breadcrumb-folder')}
        onmouseenter={() => {
          hoveredControl = 'breadcrumb-folder'
        }}
        onmouseleave={() => {
          hoveredControl = null
        }}
      >
        Coding Workflow Prompts
      </button>
      <span style="color:var(--ui-neutral-emphasis-border);margin:0 4px;padding:0 8px">/</span>
      <button
        type="button"
        style={breadcrumbButtonStyle('breadcrumb-section', true)}
        onmouseenter={() => {
          hoveredControl = 'breadcrumb-section'
        }}
        onmouseleave={() => {
          hoveredControl = null
        }}
      >
        Folder Settings
      </button>
    </div>
  </div>

  <div style={scrollStyle}>
    <div style={contentStyle}>
      <section style={sectionShellStyle}>
        <button
          type="button"
          style={sectionHeaderStyle('settings-header', collapsedSections.settings)}
          aria-expanded={!collapsedSections.settings}
          onclick={() => toggleSection('settings')}
          onmouseenter={() => {
            hoveredControl = 'settings-header'
          }}
          onmouseleave={() => {
            hoveredControl = null
          }}
        >
          <span style={iconTileStyle}>
            <Settings size={17} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span style={sectionTitleBlockStyle}>
            <span style={sectionTitleRowStyle}>
              {#if collapsedSections.settings}
                <ChevronRight size={17} strokeWidth={2.6} aria-hidden="true" />
              {:else}
                <ChevronDown size={17} strokeWidth={2.6} aria-hidden="true" />
              {/if}
              <span style={sectionTitleStyle}>Folder Settings</span>
            </span>
            <span style={sectionDescriptionStyle}>
              Settings that only affect prompts in this folder, and are saved to the workspace.
            </span>
          </span>
          <span style={countPillStyle}>{settingsCards.length} fields</span>
        </button>

        {#if !collapsedSections.settings}
          <div style={cardsGridStyle}>
            {#each settingsCards as card (card.id)}
              <article style={cardStyle}>
                <div style={titleBarStyle}>
                  <div style={titleMainStyle}>
                    <span style={mediumIconTileStyle}>
                      <Folder size={19} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span style={titleCopyStyle}>
                      <span style={cardTitleStyle}>{card.title}</span>
                      <span style={metadataRowStyle}>{card.metadata}</span>
                    </span>
                  </div>
                  <div style={actionBarStyle}>
                    <button
                      type="button"
                      aria-label={`Copy ${card.title}`}
                      title={`Copy ${card.title}`}
                      style={iconButtonStyle(`copy-${card.id}`)}
                      onmouseenter={() => {
                        hoveredControl = `copy-${card.id}`
                      }}
                      onmouseleave={() => {
                        hoveredControl = null
                      }}
                    >
                      <Clipboard size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p style={infoRowStyle}>{card.info}</p>
                <div style={editorStyle}>{card.text}</div>
              </article>
            {/each}
          </div>
        {/if}
      </section>

      <section style={sectionShellStyle}>
        <button
          type="button"
          style={sectionHeaderStyle('prompts-header', collapsedSections.prompts)}
          aria-expanded={!collapsedSections.prompts}
          onclick={() => toggleSection('prompts')}
          onmouseenter={() => {
            hoveredControl = 'prompts-header'
          }}
          onmouseleave={() => {
            hoveredControl = null
          }}
        >
          <span style={iconTileStyle}>
            <FileText size={17} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span style={sectionTitleBlockStyle}>
            <span style={sectionTitleRowStyle}>
              {#if collapsedSections.prompts}
                <ChevronRight size={17} strokeWidth={2.6} aria-hidden="true" />
              {:else}
                <ChevronDown size={17} strokeWidth={2.6} aria-hidden="true" />
              {/if}
              <span style={sectionTitleStyle}>Prompts</span>
            </span>
            <span style={sectionDescriptionStyle}>
              Create, edit, and organize prompts in this folder.
            </span>
          </span>
          <span style={countPillStyle}>{promptCards.length} prompts</span>
        </button>

        {#if !collapsedSections.prompts}
          <div style={dividerStyle}>
            <span style={separatorStyle}></span>
            <button
              type="button"
              style={addButtonStyle('add-initial')}
              onmouseenter={() => {
                hoveredControl = 'add-initial'
              }}
              onmouseleave={() => {
                hoveredControl = null
              }}
            >
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
              Add prompt
            </button>
            <span style={separatorStyle}></span>
          </div>

          <div style={cardsGridStyle}>
            {#each promptCards as card (card.id)}
              <article style={cardStyle}>
                <div style={titleBarStyle}>
                  <div style={titleMainStyle}>
                    <span style={mediumIconTileStyle}>
                      <FileText size={19} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span style={titleCopyStyle}>
                      <span style={cardTitleStyle}>{card.title}</span>
                      <span style={metadataRowStyle}>
                        {card.metadata} • {card.updated}
                      </span>
                    </span>
                  </div>
                  <div style={actionBarStyle}>
                    <button
                      type="button"
                      aria-label={`Copy ${card.title}`}
                      title={`Copy ${card.title}`}
                      style={iconButtonStyle(`copy-${card.id}`)}
                      onmouseenter={() => {
                        hoveredControl = `copy-${card.id}`
                      }}
                      onmouseleave={() => {
                        hoveredControl = null
                      }}
                    >
                      <Clipboard size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${card.title}`}
                      title={`Delete ${card.title}`}
                      style={iconButtonStyle(`delete-${card.id}`, true)}
                      onmouseenter={() => {
                        hoveredControl = `delete-${card.id}`
                      }}
                      onmouseleave={() => {
                        hoveredControl = null
                      }}
                    >
                      <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div style={editorStyle}>{card.text}</div>
              </article>
            {/each}
          </div>

          <div style={dividerStyle}>
            <span style={separatorStyle}></span>
            <button
              type="button"
              style={addButtonStyle('add-final')}
              onmouseenter={() => {
                hoveredControl = 'add-final'
              }}
              onmouseleave={() => {
                hoveredControl = null
              }}
            >
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
              Add prompt
            </button>
            <span style={separatorStyle}></span>
          </div>
        {/if}
      </section>
    </div>
  </div>
</main>
