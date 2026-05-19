<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import {
    Bug,
    ExternalLink,
    Hash,
    Info,
    Keyboard,
    ListOrdered,
    RefreshCcw,
    Settings
  } from 'lucide-svelte'

  type InteractiveId =
    | 'font-row'
    | 'min-lines-row'
    | 'line-numbers-row'
    | 'issue-row'
    | 'version-row'
    | 'font-reset'
    | 'min-lines-reset'
    | 'line-numbers-reset'
    | 'line-numbers-toggle'
    | 'github-link'
    | 'font-input'
    | 'min-lines-input'

  let hoveredId = $state<InteractiveId | null>(null)
  let focusedId = $state<InteractiveId | null>(null)
  let fontSizeInput = $state('16')
  let minLinesInput = $state('4')
  let showLineNumbers = $state(true)

  const setHover = (id: InteractiveId | null) => {
    hoveredId = id
  }

  const setFocus = (id: InteractiveId | null) => {
    focusedId = id
  }

  const isHovered = (id: InteractiveId) => hoveredId === id
  const isFocused = (id: InteractiveId) => focusedId === id

  const pageShellStyle =
    'box-sizing:border-box;display:flex;min-height:0;flex:1;justify-content:center;overflow-y:auto;padding:24px;color:var(--ui-normal-text);'
  const contentStyle = 'box-sizing:border-box;width:100%;max-width:960px;display:grid;gap:22px;'
  const topBarStyle =
    'height:36px;display:flex;align-items:center;border:1px solid var(--ui-neutral-muted-border);background:var(--ui-neutral-muted-surface);border-radius:7px;padding:0 14px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);'
  const breadcrumbTextStyle =
    'font-size:13px;font-weight:650;line-height:18px;color:var(--ui-muted-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
  const sectionHeaderStyle =
    'display:grid;gap:6px;min-width:0;border-left:3px solid var(--ui-accent-normal-border);padding-left:16px;'
  const sectionTitleRowStyle = 'display:flex;align-items:center;gap:10px;min-width:0;'
  const sectionTitleStyle =
    'margin:0;min-width:0;color:var(--ui-normal-text);font-size:24px;font-weight:760;line-height:32px;'
  const sectionDescriptionStyle =
    'margin:0;min-width:0;color:var(--ui-muted-text);font-size:14px;line-height:20px;'
  const panelStyle =
    'box-sizing:border-box;display:grid;gap:12px;min-width:0;border:1px solid var(--ui-card-normal-border);border-radius:8px;padding:10px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 18px 42px var(--ui-card-normal-shadow);'
  const panelTitleBarStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0;border:1px solid var(--ui-card-nested-border);border-radius:7px;background:var(--ui-neutral-muted-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);padding:8px 10px;'
  const panelTitleMainStyle =
    'display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:10px;min-width:0;'
  const panelTitleCopyStyle = 'display:grid;gap:4px;min-width:0;'
  const panelTitleStyle =
    'margin:0;min-width:0;color:var(--ui-normal-text);font-size:15px;font-weight:700;line-height:20px;'
  const panelMetaStyle =
    'display:flex;align-items:center;gap:7px;min-width:0;color:var(--ui-muted-text);font-size:11px;font-weight:750;line-height:16px;text-transform:none;'
  const rowsGridStyle = 'display:grid;gap:10px;min-width:0;padding:2px;'
  const rowBaseStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;min-width:0;border:1px solid var(--ui-neutral-normal-border);border-radius:7px;padding:14px;background:linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));box-shadow:0 12px 24px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;'
  const rowHoverStyle =
    'border-color:var(--ui-neutral-hover-border);background:linear-gradient(180deg,var(--ui-neutral-hover-surface),var(--ui-neutral-normal-surface));box-shadow:0 16px 30px var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-neutral-focus-border);transform:translateY(-1px);'
  const rowCopyStyle = 'display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:12px;min-width:0;'
  const rowTextStyle = 'display:grid;gap:3px;min-width:0;'
  const rowTitleStyle =
    'margin:0;color:var(--ui-normal-text);font-size:14px;font-weight:720;line-height:20px;'
  const rowDescriptionStyle =
    'margin:0;color:var(--ui-muted-text);font-size:12px;font-weight:500;line-height:18px;'
  const controlsStyle = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;'
  const inputBaseStyle =
    'box-sizing:border-box;width:78px;height:34px;border:1px solid var(--ui-neutral-normal-border);border-radius:7px;background:var(--ui-neutral-field-surface);box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight),0 8px 16px var(--ui-shadow-raised);color:var(--ui-normal-text);font:inherit;font-size:14px;font-weight:700;line-height:18px;outline:none;padding:0 10px;text-align:right;transition:border-color 140ms ease,box-shadow 140ms ease,background 140ms ease;'
  const inputFocusStyle =
    'border-color:var(--ui-neutral-focus-border);box-shadow:0 0 0 3px var(--ui-accent-icon-ring),inset 0 1px 0 var(--ui-card-nested-inset-highlight),0 10px 18px var(--ui-shadow-raised);'
  const buttonBaseStyle =
    'box-sizing:border-box;height:34px;border:1px solid var(--ui-neutral-normal-border);border-radius:7px;background:var(--ui-neutral-normal-surface);box-shadow:0 8px 16px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-hoverable-text);display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;font-size:12px;font-weight:750;line-height:16px;padding:0 11px;white-space:nowrap;cursor:pointer;transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;'
  const buttonHoverStyle =
    'border-color:var(--ui-neutral-hover-border);background:var(--ui-neutral-hover-surface);box-shadow:0 12px 22px var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-neutral-focus-border);transform:translateY(-1px);'
  const accentButtonStyle =
    'border-color:var(--ui-accent-normal-border);background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);'
  const accentButtonHoverStyle =
    'border-color:var(--ui-accent-hover-border);background:var(--ui-accent-hover-surface);'
  const versionPillStyle =
    'box-sizing:border-box;min-width:74px;height:32px;border:1px solid var(--ui-success-normal-border);border-radius:999px;background:var(--ui-success-normal-surface);box-shadow:0 8px 16px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-success-normal-text);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:760;line-height:18px;padding:0 12px;'
  const toggleTrackBaseStyle =
    'box-sizing:border-box;width:68px;height:34px;border:1px solid var(--ui-accent-normal-border);border-radius:999px;background:var(--ui-accent-normal-surface);box-shadow:0 8px 16px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);display:flex;align-items:center;padding:3px;cursor:pointer;transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;'
  const toggleTrackHoverStyle =
    'border-color:var(--ui-accent-hover-border);background:var(--ui-accent-hover-surface);box-shadow:0 12px 22px var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-neutral-focus-border);transform:translateY(-1px);'
  const toggleThumbStyle =
    'box-sizing:border-box;height:26px;min-width:34px;border-radius:999px;background:var(--ui-accent-normal-fill);border:1px solid var(--ui-accent-strong-border);box-shadow:0 8px 14px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);color:var(--ui-normal-text);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:14px;transition:transform 140ms ease;'

  const getRowStyle = (id: InteractiveId) => `${rowBaseStyle}${isHovered(id) ? rowHoverStyle : ''}`
  const getInputStyle = (id: InteractiveId) =>
    `${inputBaseStyle}${isFocused(id) || isHovered(id) ? inputFocusStyle : ''}`
  const getButtonStyle = (id: InteractiveId) =>
    `${buttonBaseStyle}${isHovered(id) ? buttonHoverStyle : ''}`
  const getAccentButtonStyle = (id: InteractiveId) =>
    `${buttonBaseStyle}${accentButtonStyle}${isHovered(id) ? `${buttonHoverStyle}${accentButtonHoverStyle}` : ''}`

  const handleResetFontSize = () => {
    fontSizeInput = '16'
  }

  const handleResetMinLines = () => {
    minLinesInput = '4'
  }

  const handleResetLineNumbers = () => {
    showLineNumbers = true
  }
</script>

{#snippet iconTile(Icon: ComponentType, variant: 'accent' | 'neutral' = 'accent')}
  <span
    style={`box-sizing:border-box;width:34px;height:34px;border:1px solid ${
      variant === 'accent' ? 'var(--ui-accent-normal-border)' : 'var(--ui-neutral-normal-border)'
    };border-radius:7px;background:${
      variant === 'accent' ? 'var(--ui-accent-normal-surface)' : 'var(--ui-neutral-normal-surface)'
    };box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight),0 8px 16px var(--ui-shadow-raised);display:inline-flex;align-items:center;justify-content:center;color:${
      variant === 'accent' ? 'var(--ui-accent-icon-glyph)' : 'var(--ui-secondary-text)'
    };`}
  >
    <Icon size={17} strokeWidth={2.4} />
  </span>
{/snippet}

{#snippet resetButton(id: InteractiveId, onClick: () => void)}
  <button
    type="button"
    style={getButtonStyle(id)}
    onmouseenter={() => setHover(id)}
    onmouseleave={() => setHover(null)}
    onclick={onClick}
  >
    <RefreshCcw size={14} strokeWidth={2.4} />
    Reset
  </button>
{/snippet}

{#snippet raisedRow(
  id: InteractiveId,
  Icon: ComponentType,
  title: string,
  description: string,
  controls: Snippet
)}
  <div
    role="group"
    style={getRowStyle(id)}
    onmouseenter={() => setHover(id)}
    onmouseleave={() => setHover(null)}
  >
    <div style={rowCopyStyle}>
      {@render iconTile(Icon, 'neutral')}
      <div style={rowTextStyle}>
        <p style={rowTitleStyle}>{title}</p>
        <p style={rowDescriptionStyle}>{description}</p>
      </div>
    </div>

    <div style={controlsStyle}>
      {@render controls()}
    </div>
  </div>
{/snippet}

{#snippet fontControls()}
  <input
    aria-label="Font Size"
    data-testid="font-size-input"
    inputmode="numeric"
    style={getInputStyle('font-input')}
    value={fontSizeInput}
    onmouseenter={() => setHover('font-input')}
    onmouseleave={() => setHover(null)}
    onfocus={() => setFocus('font-input')}
    onblur={() => setFocus(null)}
    oninput={(event) => {
      fontSizeInput = event.currentTarget.value
    }}
  />
  {@render resetButton('font-reset', handleResetFontSize)}
{/snippet}

{#snippet minLinesControls()}
  <input
    aria-label="Minimum Line Count"
    data-testid="min-lines-input"
    inputmode="numeric"
    style={getInputStyle('min-lines-input')}
    value={minLinesInput}
    onmouseenter={() => setHover('min-lines-input')}
    onmouseleave={() => setHover(null)}
    onfocus={() => setFocus('min-lines-input')}
    onblur={() => setFocus(null)}
    oninput={(event) => {
      minLinesInput = event.currentTarget.value
    }}
  />
  {@render resetButton('min-lines-reset', handleResetMinLines)}
{/snippet}

{#snippet lineNumbersControls()}
  <button
    type="button"
    aria-pressed={showLineNumbers}
    data-testid="show-line-numbers-toggle"
    style={`${toggleTrackBaseStyle}${isHovered('line-numbers-toggle') ? toggleTrackHoverStyle : ''}`}
    onmouseenter={() => setHover('line-numbers-toggle')}
    onmouseleave={() => setHover(null)}
    onclick={() => {
      showLineNumbers = !showLineNumbers
    }}
  >
    <span style={`${toggleThumbStyle}transform:translateX(${showLineNumbers ? '28px' : '0'});`}>
      {showLineNumbers ? 'On' : 'Off'}
    </span>
  </button>
  {@render resetButton('line-numbers-reset', handleResetLineNumbers)}
{/snippet}

{#snippet issueControls()}
  <a
    href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
    target="_blank"
    rel="noreferrer"
    data-testid="about-github-issues-button"
    style={`${getAccentButtonStyle('github-link')}text-decoration:none;`}
    onmouseenter={() => setHover('github-link')}
    onmouseleave={() => setHover(null)}
  >
    <Bug size={14} strokeWidth={2.4} />
    Open Github Issues
    <ExternalLink size={13} strokeWidth={2.4} />
  </a>
{/snippet}

{#snippet versionControls()}
  <span style={versionPillStyle} data-testid="about-version-value">v1.9.0</span>
{/snippet}

<section style={pageShellStyle} data-testid="settings-screen">
  <div style={contentStyle}>
    <div style={topBarStyle}>
      <div style={breadcrumbTextStyle}>System Settings / Editor & layout</div>
    </div>

    <div style={sectionHeaderStyle}>
      <div style={sectionTitleRowStyle}>
        {@render iconTile(Settings)}
        <h1 style={sectionTitleStyle}>System Settings</h1>
      </div>
      <p style={sectionDescriptionStyle}>Global settings saved on your local machine.</p>
    </div>

    <article style={panelStyle}>
      <div style={panelTitleBarStyle}>
        <div style={panelTitleMainStyle}>
          {@render iconTile(Keyboard)}
          <div style={panelTitleCopyStyle}>
            <h2 style={panelTitleStyle}>Editor & layout</h2>
            <div style={panelMetaStyle}>
              <span>Typography</span>
              <span style="width:3px;height:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);"></span>
              <span>Spacing</span>
              <span style="width:3px;height:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);"></span>
              <span>Autosave</span>
            </div>
          </div>
        </div>
      </div>

      <div style={rowsGridStyle}>
        {@render raisedRow(
          'font-row',
          Hash,
          'Font Size',
          'Sets the base font size used inside the prompt editor.',
          fontControls
        )}

        {@render raisedRow(
          'min-lines-row',
          ListOrdered,
          'Minimum Line Count',
          'Sets the minimum number of visible lines in prompt editors.',
          minLinesControls
        )}

        {@render raisedRow(
          'line-numbers-row',
          ListOrdered,
          'Show Line Numbers',
          'Display line numbers beside prompt text for easier review.',
          lineNumbersControls
        )}
      </div>
    </article>

    <article style={panelStyle}>
      <div style={panelTitleBarStyle}>
        <div style={panelTitleMainStyle}>
          {@render iconTile(Info)}
          <div style={panelTitleCopyStyle}>
            <h2 style={panelTitleStyle}>About</h2>
            <div style={panelMetaStyle}>
              <span>Build</span>
              <span style="width:3px;height:3px;border-radius:999px;background:var(--ui-neutral-emphasis-border);"></span>
              <span>Release details</span>
            </div>
          </div>
        </div>
      </div>

      <div style={rowsGridStyle}>
        {@render raisedRow(
          'issue-row',
          Bug,
          'Report an Issue',
          'Report bugs, request improvements, or check whether a problem is already tracked.',
          issueControls
        )}

        {@render raisedRow(
          'version-row',
          Info,
          'Current Version',
          'The version currently installed on this device.',
          versionControls
        )}
      </div>
    </article>
  </div>
</section>
