<script lang="ts">
  import {
    Bug,
    ChevronRight,
    ExternalLink,
    Info,
    Keyboard,
    RefreshCcw,
    Settings,
    Type
  } from 'lucide-svelte'

  type HoverTarget =
    | 'font-card'
    | 'lines-card'
    | 'numbers-card'
    | 'issue-card'
    | 'version-card'
    | 'font-reset'
    | 'lines-reset'
    | 'numbers-reset'
    | 'toggle'
    | 'issues'
    | null

  let hoverTarget = $state<HoverTarget>(null)
  let focusTarget = $state<string | null>(null)

  const isHovered = (target: HoverTarget) => hoverTarget === target
  const isFocused = (target: string) => focusTarget === target

  const sectionShellStyle = [
    'min-height:0',
    'flex:1',
    'overflow-y:auto',
    'color:var(--ui-normal-text)'
  ].join(';')

  const topBarStyle = [
    'height:36px',
    'display:flex',
    'align-items:center',
    'border-bottom:1px solid var(--ui-neutral-muted-border)',
    'background:var(--ui-card-solid-surface)',
    'padding:0 24px',
    'box-sizing:border-box'
  ].join(';')

  const breadcrumbStyle = [
    'display:flex',
    'align-items:center',
    'min-width:0',
    'gap:8px',
    'font-size:13px',
    'font-weight:600',
    'color:var(--ui-secondary-text)'
  ].join(';')

  const pageStyle = [
    'box-sizing:border-box',
    'width:100%',
    'max-width:980px',
    'margin:0 auto',
    'padding:26px 24px 34px',
    'display:grid',
    'gap:22px'
  ].join(';')

  const headerStyle = [
    'display:grid',
    'grid-template-columns:auto minmax(0,1fr)',
    'gap:14px',
    'align-items:center'
  ].join(';')

  const headerIconStyle = [
    'width:42px',
    'height:42px',
    'display:grid',
    'place-items:center',
    'border-radius:8px',
    'background:var(--ui-accent-normal-surface)',
    'border:1px solid var(--ui-accent-normal-border)',
    'box-shadow:0 12px 28px var(--ui-shadow-raised)'
  ].join(';')

  const h1Style = [
    'margin:0',
    'font-size:20px',
    'line-height:1.2',
    'font-weight:700',
    'letter-spacing:0',
    'color:var(--ui-normal-text)'
  ].join(';')

  const descriptionStyle = [
    'margin:5px 0 0',
    'font-size:13px',
    'line-height:1.45',
    'color:var(--ui-secondary-text)'
  ].join(';')

  const panelStyle = [
    'border:1px solid var(--ui-card-normal-border)',
    'border-radius:8px',
    'background:linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
    'box-shadow:0 18px 48px var(--ui-card-normal-shadow)',
    'padding:18px',
    'display:grid',
    'gap:16px'
  ].join(';')

  const panelHeaderStyle = [
    'display:grid',
    'grid-template-columns:auto minmax(0,1fr)',
    'gap:12px',
    'align-items:center',
    'padding:2px 2px 0'
  ].join(';')

  const panelIconStyle = [
    'width:34px',
    'height:34px',
    'display:grid',
    'place-items:center',
    'border-radius:8px',
    'background:var(--ui-neutral-normal-surface)',
    'border:1px solid var(--ui-neutral-normal-border)'
  ].join(';')

  const panelTitleStyle = [
    'margin:0',
    'font-size:15px',
    'line-height:1.25',
    'font-weight:700',
    'letter-spacing:0',
    'color:var(--ui-normal-text)'
  ].join(';')

  const panelDescriptionStyle = [
    'margin:4px 0 0',
    'font-size:12px',
    'line-height:1.45',
    'color:var(--ui-muted-text)'
  ].join(';')

  const groupStyle = ['display:grid', 'gap:10px'].join(';')

  const subcardStyle = (target: HoverTarget) =>
    [
      'display:grid',
      'grid-template-columns:minmax(0,1fr) auto',
      'gap:16px',
      'align-items:center',
      'padding:15px',
      'border-radius:8px',
      `background:${isHovered(target) ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}`,
      `border:1px solid ${isHovered(target) ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}`,
      `box-shadow:${isHovered(target) ? '0 16px 32px var(--ui-shadow-raised)' : '0 10px 22px var(--ui-shadow-raised)'}`,
      `transform:${isHovered(target) ? 'translateY(-1px)' : 'translateY(0)'}`,
      'transition:background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
      'min-width:0'
    ].join(';')

  const subcardTitleStyle = [
    'margin:0',
    'font-size:13px',
    'line-height:1.35',
    'font-weight:700',
    'letter-spacing:0',
    'color:var(--ui-hoverable-text)'
  ].join(';')

  const subcardDescriptionStyle = [
    'margin:4px 0 0',
    'font-size:12px',
    'line-height:1.45',
    'color:var(--ui-muted-text)'
  ].join(';')

  const controlRowStyle = [
    'display:flex',
    'align-items:center',
    'justify-content:flex-end',
    'gap:8px',
    'flex-wrap:wrap'
  ].join(';')

  const inputStyle = (target: string) =>
    [
      'width:78px',
      'height:34px',
      'box-sizing:border-box',
      'border-radius:7px',
      `border:1px solid ${isFocused(target) ? 'var(--ui-neutral-focus-border)' : 'var(--ui-neutral-normal-border)'}`,
      'background:var(--ui-neutral-field-surface)',
      'color:var(--ui-normal-text)',
      'font-size:13px',
      'font-weight:650',
      'text-align:center',
      'outline:none',
      `box-shadow:${isFocused(target) ? '0 0 0 3px var(--ui-accent-icon-ring)' : 'inset 0 1px 0 var(--ui-card-nested-inset-highlight)'}`,
      'transition:border-color 140ms ease, box-shadow 140ms ease'
    ].join(';')

  const resetButtonStyle = (target: HoverTarget) =>
    [
      'height:34px',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'gap:7px',
      'border-radius:7px',
      'padding:0 11px',
      'border:1px solid var(--ui-neutral-normal-border)',
      `background:${isHovered(target) ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-muted-surface)'}`,
      `color:${isHovered(target) ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}`,
      `box-shadow:${isHovered(target) ? '0 10px 20px var(--ui-shadow-raised)' : 'none'}`,
      'font-size:12px',
      'font-weight:700',
      'cursor:pointer',
      'transition:background 140ms ease, color 140ms ease, box-shadow 140ms ease'
    ].join(';')

  const toggleStyle = [
    'height:34px',
    'display:inline-flex',
    'align-items:center',
    'gap:8px',
    'border-radius:999px',
    'padding:0 12px 0 5px',
    'border:1px solid var(--ui-success-normal-border)',
    `background:${isHovered('toggle') ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
    'color:var(--ui-accent-normal-text)',
    'font-size:12px',
    'font-weight:800',
    'cursor:pointer',
    'transition:background 140ms ease, box-shadow 140ms ease',
    `box-shadow:${isHovered('toggle') ? '0 12px 22px var(--ui-shadow-raised)' : '0 0 0 1px var(--ui-accent-icon-ring)'}`
  ].join(';')

  const toggleKnobStyle = [
    'width:24px',
    'height:24px',
    'display:grid',
    'place-items:center',
    'border-radius:999px',
    'background:var(--ui-success-normal-surface)',
    'border:1px solid var(--ui-success-normal-border)',
    'color:var(--ui-success-normal-text)'
  ].join(';')

  const issueButtonStyle = [
    'height:36px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'gap:8px',
    'border-radius:7px',
    'padding:0 12px',
    'border:1px solid var(--ui-accent-normal-border)',
    `background:${isHovered('issues') ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
    'color:var(--ui-accent-normal-text)',
    `box-shadow:${isHovered('issues') ? '0 12px 24px var(--ui-shadow-raised)' : 'none'}`,
    'font-size:12px',
    'font-weight:800',
    'text-decoration:none',
    'cursor:pointer',
    'transition:background 140ms ease, border-color 140ms ease, box-shadow 140ms ease'
  ].join(';')

  const versionPillStyle = [
    'display:inline-flex',
    'align-items:center',
    'height:32px',
    'border-radius:999px',
    'padding:0 12px',
    'border:1px solid var(--ui-info-normal-border)',
    'background:var(--ui-info-normal-surface)',
    'color:var(--ui-normal-text)',
    'font-size:13px',
    'font-weight:800',
    'box-shadow:0 8px 18px var(--ui-shadow-raised)'
  ].join(';')
</script>

<section style={sectionShellStyle} data-testid="settings-screen">
  <div style={topBarStyle}>
    <div style={breadcrumbStyle}>
      <span>Settings</span>
      <ChevronRight size={14} color="var(--ui-muted-text)" />
      <span style="color:var(--ui-normal-text)">System Settings</span>
    </div>
  </div>

  <div style={pageStyle}>
    <header style={headerStyle}>
      <div style={headerIconStyle}>
        <Settings size={22} color="var(--ui-accent-icon-glyph)" />
      </div>
      <div style="min-width:0">
        <h1 style={h1Style}>System Settings</h1>
        <p style={descriptionStyle}>Global settings saved on your local machine.</p>
      </div>
    </header>

    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div style={panelIconStyle}>
          <Keyboard size={18} color="var(--ui-secondary-text)" />
        </div>
        <div style="min-width:0">
          <h2 style={panelTitleStyle}>Editor &amp; layout</h2>
          <p style={panelDescriptionStyle}>
            Typography, spacing, autosave, and core writing ergonomics.
          </p>
        </div>
      </div>

      <div style={groupStyle}>
        <article
          style={subcardStyle('font-card')}
          onmouseenter={() => (hoverTarget = 'font-card')}
          onmouseleave={() => (hoverTarget = null)}
        >
          <div style="min-width:0">
            <h3 style={subcardTitleStyle}>Font Size</h3>
            <p style={subcardDescriptionStyle}>
              Sets the base font size used inside the prompt editor.
            </p>
          </div>

          <div style={controlRowStyle}>
            <input
              style={inputStyle('font-size')}
              data-testid="font-size-input"
              value="14"
              aria-label="Font Size"
              inputmode="numeric"
              onfocus={() => (focusTarget = 'font-size')}
              onblur={() => (focusTarget = null)}
            />
            <button
              type="button"
              style={resetButtonStyle('font-reset')}
              onmouseenter={() => (hoverTarget = 'font-reset')}
              onmouseleave={() => (hoverTarget = null)}
            >
              <RefreshCcw size={14} />
              Reset
            </button>
          </div>
        </article>

        <article
          style={subcardStyle('lines-card')}
          onmouseenter={() => (hoverTarget = 'lines-card')}
          onmouseleave={() => (hoverTarget = null)}
        >
          <div style="min-width:0">
            <h3 style={subcardTitleStyle}>Minimum Line Count</h3>
            <p style={subcardDescriptionStyle}>
              Sets the minimum number of visible lines in prompt editors.
            </p>
          </div>

          <div style={controlRowStyle}>
            <input
              style={inputStyle('minimum-lines')}
              data-testid="min-lines-input"
              value="5"
              aria-label="Minimum Line Count"
              inputmode="numeric"
              onfocus={() => (focusTarget = 'minimum-lines')}
              onblur={() => (focusTarget = null)}
            />
            <button
              type="button"
              style={resetButtonStyle('lines-reset')}
              onmouseenter={() => (hoverTarget = 'lines-reset')}
              onmouseleave={() => (hoverTarget = null)}
            >
              <RefreshCcw size={14} />
              Reset
            </button>
          </div>
        </article>

        <article
          style={subcardStyle('numbers-card')}
          onmouseenter={() => (hoverTarget = 'numbers-card')}
          onmouseleave={() => (hoverTarget = null)}
        >
          <div style="min-width:0">
            <h3 style={subcardTitleStyle}>Show Line Numbers</h3>
            <p style={subcardDescriptionStyle}>
              Display line numbers beside prompt text for easier review.
            </p>
          </div>

          <div style={controlRowStyle}>
            <button
              type="button"
              style={toggleStyle}
              data-testid="show-line-numbers-toggle"
              aria-pressed="true"
              onmouseenter={() => (hoverTarget = 'toggle')}
              onmouseleave={() => (hoverTarget = null)}
            >
              <span style={toggleKnobStyle}>On</span>
              Enabled
            </button>
            <button
              type="button"
              style={resetButtonStyle('numbers-reset')}
              onmouseenter={() => (hoverTarget = 'numbers-reset')}
              onmouseleave={() => (hoverTarget = null)}
            >
              <RefreshCcw size={14} />
              Reset
            </button>
          </div>
        </article>
      </div>
    </section>

    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div style={panelIconStyle}>
          <Info size={18} color="var(--ui-secondary-text)" />
        </div>
        <div style="min-width:0">
          <h2 style={panelTitleStyle}>About</h2>
          <p style={panelDescriptionStyle}>Build and release details for this desktop app.</p>
        </div>
      </div>

      <div style={groupStyle}>
        <article
          style={subcardStyle('issue-card')}
          onmouseenter={() => (hoverTarget = 'issue-card')}
          onmouseleave={() => (hoverTarget = null)}
        >
          <div style="min-width:0">
            <h3 style={subcardTitleStyle}>Report an Issue</h3>
            <p style={subcardDescriptionStyle}>
              Report bugs, request improvements, or check whether a problem is already tracked.
            </p>
          </div>

          <a
            style={issueButtonStyle}
            href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
            data-testid="about-github-issues-button"
            target="_blank"
            rel="noreferrer"
            onmouseenter={() => (hoverTarget = 'issues')}
            onmouseleave={() => (hoverTarget = null)}
          >
            <Bug size={15} />
            Open Github Issues
            <ExternalLink size={14} />
          </a>
        </article>

        <article
          style={subcardStyle('version-card')}
          onmouseenter={() => (hoverTarget = 'version-card')}
          onmouseleave={() => (hoverTarget = null)}
        >
          <div style="min-width:0">
            <h3 style={subcardTitleStyle}>Current Version</h3>
            <p style={subcardDescriptionStyle}>The version currently installed on this device.</p>
          </div>

          <div style={controlRowStyle}>
            <span style={versionPillStyle} data-testid="about-version-value">
              <Type size={14} style="margin-right:7px" />
              v1.8.0
            </span>
          </div>
        </article>
      </div>
    </section>
  </div>
</section>
