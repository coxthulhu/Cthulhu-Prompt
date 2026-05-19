<script lang="ts">
  import {
    Bug,
    ExternalLink,
    Hash,
    Info,
    Keyboard,
    RefreshCcw,
    Rows3,
    Settings,
    Type
  } from 'lucide-svelte'

  let hoveredCard = $state<string | null>(null)
  let hoveredControl = $state<string | null>(null)
  let focusedItem = $state<string | null>(null)

  const isCardHovered = (key: string) => hoveredCard === key
  const isHovered = (key: string) => hoveredControl === key
  const isFocused = (key: string) => focusedItem === key

  const setHover = (key: string | null) => {
    hoveredControl = key
  }

  const setCardHover = (key: string | null) => {
    hoveredCard = key
  }

  const setFocus = (key: string | null) => {
    focusedItem = key
  }

  const panelStyle = [
    'border: 1px solid var(--ui-card-normal-border)',
    'border-radius: 8px',
    'background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
    'box-shadow: 0 18px 40px var(--ui-card-normal-shadow)',
    'padding: 10px',
    'display: grid',
    'gap: 8px',
    'min-width: 0'
  ].join('; ')

  const sectionTitleStyle = [
    'align-items: center',
    'background: var(--ui-neutral-muted-surface)',
    'border: 1px solid var(--ui-card-nested-border)',
    'border-radius: 7px',
    'box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight)',
    'display: grid',
    'gap: 10px',
    'grid-template-columns: 42px minmax(0, 1fr)',
    'padding: 8px 10px',
    'min-width: 0'
  ].join('; ')

  const iconTileStyle = (kind: 'accent' | 'info' | 'success' | 'warning' = 'accent') => {
    const color =
      kind === 'success'
        ? 'var(--ui-success-normal-text)'
        : kind === 'warning'
          ? 'var(--ui-warning-icon-glyph)'
          : kind === 'info'
            ? 'oklch(0.91 0.07 247)'
            : 'var(--ui-accent-icon-glyph)'
    const background =
      kind === 'success'
        ? 'var(--ui-success-normal-surface)'
        : kind === 'warning'
          ? 'var(--ui-warning-normal-surface)'
          : kind === 'info'
            ? 'var(--ui-info-normal-surface)'
            : 'var(--ui-accent-normal-surface)'
    const border =
      kind === 'success'
        ? 'var(--ui-success-normal-border)'
        : kind === 'warning'
          ? 'var(--ui-warning-normal-border)'
          : kind === 'info'
            ? 'var(--ui-info-normal-border)'
            : 'var(--ui-accent-icon-ring)'

    return [
      'align-items: center',
      `background: ${background}`,
      `border: 1px solid ${border}`,
      'border-radius: 7px',
      `color: ${color}`,
      'display: flex',
      'height: 42px',
      'justify-content: center',
      'width: 42px',
      'box-sizing: border-box',
      'flex: 0 0 auto'
    ].join('; ')
  }

  const raisedCardStyle = (key: string, kind: 'accent' | 'info' | 'success' | 'warning' = 'accent') => {
    const hover = isCardHovered(key)
    const border =
      kind === 'success'
        ? 'var(--ui-success-normal-border)'
        : kind === 'warning'
          ? 'var(--ui-warning-normal-border)'
          : kind === 'info'
            ? 'var(--ui-info-normal-border)'
            : 'var(--ui-accent-normal-border)'
    const ring =
      kind === 'success'
        ? '0 0 0 1px var(--ui-success-normal-border)'
        : kind === 'warning'
          ? '0 0 0 1px var(--ui-warning-normal-border)'
          : kind === 'info'
            ? '0 0 0 1px var(--ui-info-normal-border)'
            : '0 0 0 1px var(--ui-accent-normal-border)'

    return [
      'align-items: center',
      hover ? `border: 1px solid ${border}` : 'border: 1px solid var(--ui-neutral-normal-border)',
      'border-radius: 7px',
      hover
        ? 'background: linear-gradient(180deg, var(--ui-neutral-hover-surface), var(--ui-neutral-normal-surface))'
        : 'background: linear-gradient(180deg, oklch(1 0 0 / 8%), oklch(1 0 0 / 5%))',
      hover
        ? `box-shadow: 0 16px 26px var(--ui-shadow-raised), ${ring}, inset 0 1px 0 oklch(1 0 0 / 14%)`
        : 'box-shadow: 0 10px 22px var(--ui-shadow-raised), inset 0 1px 0 oklch(1 0 0 / 12%)',
      'display: grid',
      'gap: 16px',
      'grid-template-columns: minmax(0, 1fr) auto',
      'min-width: 0',
      'padding: 14px',
      'transform: translateY(0)',
      'transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease'
    ].join('; ')
  }

  const inputStyle = (key: string) =>
    [
      'background: var(--ui-neutral-field-surface)',
      isFocused(key) ? 'border: 1px solid var(--ui-neutral-focus-border)' : 'border: 1px solid var(--ui-neutral-normal-border)',
      'border-radius: 7px',
      'box-shadow: inset 0 1px 0 oklch(1 0 0 / 7%), 0 8px 18px oklch(0 0 0 / 18%)',
      'box-sizing: border-box',
      'color: var(--ui-normal-text)',
      'font: inherit',
      'font-size: 14px',
      'font-weight: 650',
      'height: 36px',
      'line-height: 20px',
      'outline: none',
      'padding: 0 12px',
      'transition: border-color 140ms ease, box-shadow 140ms ease',
      'width: 88px'
    ].join('; ')

  const resetButtonStyle = (key: string) =>
    [
      'align-items: center',
      isHovered(key) ? 'background: var(--ui-neutral-hover-surface)' : 'background: var(--ui-neutral-normal-surface)',
      isHovered(key) ? 'border: 1px solid var(--ui-neutral-hover-border)' : 'border: 1px solid var(--ui-neutral-normal-border)',
      'border-radius: 7px',
      'box-shadow: 0 8px 16px oklch(0 0 0 / 18%), inset 0 1px 0 oklch(1 0 0 / 8%)',
      'color: var(--ui-hoverable-text)',
      'cursor: pointer',
      'display: inline-flex',
      'font: inherit',
      'font-size: 13px',
      'font-weight: 760',
      'gap: 8px',
      'height: 36px',
      'justify-content: center',
      'padding: 0 12px',
      'transition: background 140ms ease, border-color 140ms ease, color 140ms ease',
      'white-space: nowrap'
    ].join('; ')

  const toggleStyle = (key: string, pressed: boolean) =>
    [
      'align-items: center',
      pressed
        ? isHovered(key)
          ? 'background: var(--ui-accent-hover-surface)'
          : 'background: var(--ui-accent-normal-surface)'
        : isHovered(key)
          ? 'background: var(--ui-neutral-hover-surface)'
          : 'background: var(--ui-neutral-normal-surface)',
      pressed
        ? isHovered(key)
          ? 'border: 1px solid var(--ui-accent-hover-border)'
          : 'border: 1px solid var(--ui-accent-normal-border)'
        : isHovered(key)
          ? 'border: 1px solid var(--ui-neutral-hover-border)'
          : 'border: 1px solid var(--ui-neutral-normal-border)',
      'border-radius: 999px',
      'box-shadow: 0 10px 20px oklch(0 0 0 / 18%), inset 0 1px 0 oklch(1 0 0 / 10%)',
      pressed ? 'color: var(--ui-accent-normal-text)' : 'color: var(--ui-secondary-text)',
      'cursor: pointer',
      'display: inline-flex',
      'font: inherit',
      'font-size: 13px',
      'font-weight: 800',
      'height: 36px',
      'justify-content: center',
      'min-width: 74px',
      'padding: 0 14px',
      'transition: background 140ms ease, border-color 140ms ease, color 140ms ease'
    ].join('; ')
</script>

<section
  data-testid="settings-screen-mockup"
  style="box-sizing: border-box; color: var(--ui-normal-text); display: flex; flex: 1 1 auto; justify-content: center; min-height: 0; overflow-y: auto; padding: 24px;"
>
  <div style="display: grid; gap: 24px; max-width: 896px; min-width: 0; width: 100%;">
    <header
      style="border-left: 3px solid var(--ui-accent-normal-border); display: grid; gap: 6px; min-width: 0; padding-left: 16px;"
    >
      <div style="align-items: center; display: flex; gap: 10px; min-width: 0;">
        <div style={iconTileStyle()}>
          <Settings size={17} strokeWidth={2.4} />
        </div>
        <h1
          style="color: var(--ui-normal-text); font-size: 24px; font-weight: 760; letter-spacing: 0; line-height: 32px; margin: 0; min-width: 0;"
        >
          System Settings
        </h1>
      </div>
      <p
        style="color: var(--ui-muted-text); font-size: 14px; line-height: 20px; margin: 0; min-width: 0;"
      >
        Global settings saved on your local machine.
      </p>
    </header>

    <article style={panelStyle}>
      <div style={sectionTitleStyle}>
        <div style={iconTileStyle()}>
          <Keyboard size={20} strokeWidth={2.4} />
        </div>
        <div style="display: grid; gap: 3px; min-width: 0;">
          <h2 style="font-size: 15px; font-weight: 760; line-height: 21px; margin: 0;">
            Editor &amp; layout
          </h2>
          <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
            Typography, spacing, autosave, and core writing ergonomics.
          </p>
        </div>
      </div>

      <div style="display: grid; gap: 10px; min-width: 0;">
        <div
          role="group"
          onmouseenter={() => setCardHover('font-card')}
          onmouseleave={() => setCardHover(null)}
          style={raisedCardStyle('font-card')}
        >
          <div style="align-items: center; display: grid; gap: 12px; grid-template-columns: 42px minmax(0, 1fr); min-width: 0;">
            <div style={iconTileStyle()}>
              <Type size={20} strokeWidth={2.4} />
            </div>
            <div style="display: grid; gap: 4px; min-width: 0;">
              <h3 style="font-size: 14px; font-weight: 760; line-height: 20px; margin: 0;">
                Font Size
              </h3>
              <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
                Sets the base font size used inside the prompt editor.
              </p>
            </div>
          </div>

          <div style="align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
            <input
              aria-label="Font Size"
              value="14"
              onfocus={() => setFocus('font-input')}
              onblur={() => setFocus(null)}
              style={inputStyle('font-input')}
            />
            <button
              type="button"
              onmouseenter={() => setHover('font-reset')}
              onmouseleave={() => setHover(null)}
              style={resetButtonStyle('font-reset')}
            >
              <RefreshCcw size={15} strokeWidth={2.4} />
              Reset
            </button>
          </div>
        </div>

        <div
          role="group"
          onmouseenter={() => setCardHover('lines-card')}
          onmouseleave={() => setCardHover(null)}
          style={raisedCardStyle('lines-card', 'info')}
        >
          <div style="align-items: center; display: grid; gap: 12px; grid-template-columns: 42px minmax(0, 1fr); min-width: 0;">
            <div style={iconTileStyle('info')}>
              <Rows3 size={20} strokeWidth={2.4} />
            </div>
            <div style="display: grid; gap: 4px; min-width: 0;">
              <h3 style="font-size: 14px; font-weight: 760; line-height: 20px; margin: 0;">
                Minimum Line Count
              </h3>
              <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
                Sets the minimum number of visible lines in prompt editors.
              </p>
            </div>
          </div>

          <div style="align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
            <input
              aria-label="Minimum Line Count"
              value="5"
              onfocus={() => setFocus('lines-input')}
              onblur={() => setFocus(null)}
              style={inputStyle('lines-input')}
            />
            <button
              type="button"
              onmouseenter={() => setHover('lines-reset')}
              onmouseleave={() => setHover(null)}
              style={resetButtonStyle('lines-reset')}
            >
              <RefreshCcw size={15} strokeWidth={2.4} />
              Reset
            </button>
          </div>
        </div>

        <div
          role="group"
          onmouseenter={() => setCardHover('numbers-card')}
          onmouseleave={() => setCardHover(null)}
          style={raisedCardStyle('numbers-card', 'success')}
        >
          <div style="align-items: center; display: grid; gap: 12px; grid-template-columns: 42px minmax(0, 1fr); min-width: 0;">
            <div style={iconTileStyle('success')}>
              <Hash size={20} strokeWidth={2.4} />
            </div>
            <div style="display: grid; gap: 4px; min-width: 0;">
              <h3 style="font-size: 14px; font-weight: 760; line-height: 20px; margin: 0;">
                Show Line Numbers
              </h3>
              <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
                Display line numbers beside prompt text for easier review.
              </p>
            </div>
          </div>

          <div style="align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
            <button
              type="button"
              aria-pressed="true"
              onmouseenter={() => setHover('numbers-toggle')}
              onmouseleave={() => setHover(null)}
              style={toggleStyle('numbers-toggle', true)}
            >
              On
            </button>
            <button
              type="button"
              onmouseenter={() => setHover('numbers-reset')}
              onmouseleave={() => setHover(null)}
              style={resetButtonStyle('numbers-reset')}
            >
              <RefreshCcw size={15} strokeWidth={2.4} />
              Reset
            </button>
          </div>
        </div>
      </div>
    </article>

    <article style={panelStyle}>
      <div style={sectionTitleStyle}>
        <div style={iconTileStyle('info')}>
          <Info size={20} strokeWidth={2.4} />
        </div>
        <div style="display: grid; gap: 3px; min-width: 0;">
          <h2 style="font-size: 15px; font-weight: 760; line-height: 21px; margin: 0;">
            About
          </h2>
          <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
            Build and release details for this desktop app.
          </p>
        </div>
      </div>

      <div style="display: grid; gap: 10px; min-width: 0;">
        <div
          role="group"
          onmouseenter={() => setCardHover('issue-card')}
          onmouseleave={() => setCardHover(null)}
          style={raisedCardStyle('issue-card', 'warning')}
        >
          <div style="align-items: center; display: grid; gap: 12px; grid-template-columns: 42px minmax(0, 1fr); min-width: 0;">
            <div style={iconTileStyle('warning')}>
              <Bug size={20} strokeWidth={2.4} />
            </div>
            <div style="display: grid; gap: 4px; min-width: 0;">
              <h3 style="font-size: 14px; font-weight: 760; line-height: 20px; margin: 0;">
                Report an Issue
              </h3>
              <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
                Report bugs, request improvements, or check whether a problem is already tracked.
              </p>
            </div>
          </div>

          <div style="align-items: center; display: flex; justify-content: flex-end;">
            <button
              type="button"
              onmouseenter={() => setHover('issues-button')}
              onmouseleave={() => setHover(null)}
              style={`align-items: center; background: ${isHovered('issues-button') ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; border: 1px solid ${isHovered('issues-button') ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 7px; box-shadow: 0 10px 20px oklch(0 0 0 / 18%), inset 0 1px 0 oklch(1 0 0 / 10%); color: var(--ui-accent-normal-text); cursor: pointer; display: inline-flex; font: inherit; font-size: 13px; font-weight: 780; gap: 8px; height: 36px; justify-content: center; padding: 0 12px; transition: background 140ms ease, border-color 140ms ease; white-space: nowrap;`}
            >
              Open Github Issues
              <ExternalLink size={14} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div
          role="group"
          onmouseenter={() => setCardHover('version-card')}
          onmouseleave={() => setCardHover(null)}
          style={raisedCardStyle('version-card', 'info')}
        >
          <div style="align-items: center; display: grid; gap: 12px; grid-template-columns: 42px minmax(0, 1fr); min-width: 0;">
            <div style={iconTileStyle('info')}>
              <Info size={20} strokeWidth={2.4} />
            </div>
            <div style="display: grid; gap: 4px; min-width: 0;">
              <h3 style="font-size: 14px; font-weight: 760; line-height: 20px; margin: 0;">
                Current Version
              </h3>
              <p style="color: var(--ui-muted-text); font-size: 12px; line-height: 17px; margin: 0;">
                The version currently installed on this device.
              </p>
            </div>
          </div>

          <div style="align-items: center; display: flex; justify-content: flex-end;">
            <p
              style="background: var(--ui-neutral-normal-surface); border: 1px solid var(--ui-neutral-normal-border); border-radius: 999px; box-shadow: inset 0 1px 0 oklch(1 0 0 / 8%); color: var(--ui-normal-text); font-size: 13px; font-weight: 800; line-height: 18px; margin: 0; padding: 7px 12px; white-space: nowrap;"
            >
              v0.18.2
            </p>
          </div>
        </div>
      </div>
    </article>
  </div>
</section>
