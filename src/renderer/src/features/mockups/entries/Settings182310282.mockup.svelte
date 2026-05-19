<script lang="ts">
  import {
    Bug,
    Check,
    ExternalLink,
    Info,
    Keyboard,
    RefreshCcw,
    Settings,
    Type
  } from 'lucide-svelte'

  type HoverKey =
    | 'font-card'
    | 'lines-card'
    | 'numbers-card'
    | 'issue-card'
    | 'version-card'
    | 'font-reset'
    | 'lines-reset'
    | 'numbers-toggle'
    | 'numbers-reset'
    | 'issue-button'

  let hovered = $state<HoverKey | null>(null)

  const isHovered = (key: HoverKey) => hovered === key
  const hoverHandlers = (key: HoverKey) => ({
    onmouseenter: () => {
      hovered = key
    },
    onmouseleave: () => {
      if (hovered === key) hovered = null
    }
  })

  const shellStyle =
    'display:flex;min-height:0;flex:1;flex-direction:column;color:var(--ui-normal-text);overflow:hidden;'
  const topBarStyle =
    'display:flex;height:36px;flex-shrink:0;align-items:center;border-bottom:1px solid var(--ui-neutral-muted-border);background:#121316;padding:0 24px;'
  const topBarTextStyle =
    'display:flex;min-width:0;align-items:center;font-size:14px;font-weight:500;color:var(--ui-muted-text);'
  const topBarCurrentStyle =
    'white-space:nowrap;color:var(--ui-hoverable-text);transition:color 140ms ease;'
  const contentStyle =
    'min-height:0;flex:1;overflow-y:auto;padding:24px 28px 36px;'
  const innerStyle = 'margin:0 auto;display:grid;width:100%;max-width:1050px;gap:22px;'
  const headerStyle = 'display:grid;gap:10px;'
  const eyebrowStyle =
    'display:inline-flex;width:max-content;align-items:center;gap:8px;border:1px solid var(--ui-accent-normal-border);border-radius:999px;background:var(--ui-accent-normal-surface);padding:5px 10px;color:var(--ui-accent-normal-text);font-size:12px;font-weight:700;'
  const titleRowStyle = 'display:flex;align-items:flex-end;justify-content:space-between;gap:18px;'
  const titleStyle = 'margin:0;font-size:28px;line-height:1.1;font-weight:750;letter-spacing:0;'
  const descriptionStyle =
    'margin:0;max-width:620px;color:var(--ui-secondary-text);font-size:14px;line-height:1.55;'
  const statusPillStyle =
    'display:inline-flex;align-items:center;gap:8px;border:1px solid var(--ui-success-normal-border);border-radius:999px;background:var(--ui-success-normal-surface);padding:7px 11px;color:var(--ui-success-normal-text);font-size:13px;font-weight:700;white-space:nowrap;'
  const sectionGridStyle = 'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,0.65fr);gap:18px;'
  const cardStyle =
    'border:1px solid var(--ui-card-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 22px 45px var(--ui-card-normal-shadow);padding:18px;'
  const cardHeaderStyle = 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:2px 2px 18px;'
  const cardTitleWrapStyle = 'display:flex;min-width:0;align-items:flex-start;gap:12px;'
  const iconTileStyle =
    'display:grid;height:38px;width:38px;flex:0 0 auto;place-items:center;border:1px solid var(--ui-accent-normal-border);border-radius:8px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-icon-glyph);box-shadow:0 10px 24px var(--ui-accent-icon-ring);'
  const sectionTitleStyle = 'margin:0;font-size:16px;line-height:1.25;font-weight:750;'
  const sectionDescriptionStyle =
    'margin:4px 0 0;color:var(--ui-secondary-text);font-size:13px;line-height:1.45;'
  const raisedGridStyle = 'display:grid;gap:12px;'
  const smallTextStyle = 'margin:0;color:var(--ui-secondary-text);font-size:12px;line-height:1.45;'

  const raisedCardStyle = (key: HoverKey) =>
    [
      'display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;',
      'border:1px solid var(--ui-neutral-normal-border);border-radius:8px;',
      'background:linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));',
      'padding:16px;box-shadow:0 16px 30px var(--ui-shadow-raised),inset 0 1px 0 var(--ui-card-nested-inset-highlight);',
      'transform:translateY(0);transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;',
      isHovered(key)
        ? 'border-color:var(--ui-neutral-hover-border);background:linear-gradient(180deg,var(--ui-neutral-hover-surface),var(--ui-neutral-normal-surface));box-shadow:0 20px 38px var(--ui-card-normal-shadow),inset 0 1px 0 var(--ui-card-nested-inset-highlight);transform:translateY(-1px);'
        : ''
    ].join('')

  const inputStyle =
    'height:38px;width:92px;border:1px solid var(--ui-neutral-normal-border);border-radius:8px;background:var(--ui-neutral-field-surface);padding:0 12px;color:var(--ui-normal-text);font-size:14px;font-weight:700;outline:none;box-shadow:inset 0 1px 0 var(--ui-shadow-inset);'
  const buttonStyle = (key: HoverKey, accent = false) =>
    [
      'display:inline-flex;height:38px;align-items:center;justify-content:center;gap:8px;border-radius:8px;padding:0 12px;font-size:13px;font-weight:750;white-space:nowrap;transition:border-color 140ms ease,background 140ms ease,color 140ms ease,transform 140ms ease,box-shadow 140ms ease;',
      accent
        ? 'border:1px solid var(--ui-accent-normal-border);background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);'
        : 'border:1px solid var(--ui-neutral-normal-border);background:var(--ui-neutral-normal-surface);color:var(--ui-hoverable-text);',
      isHovered(key)
        ? accent
          ? 'border-color:var(--ui-accent-hover-border);background:var(--ui-accent-hover-surface);box-shadow:0 12px 24px var(--ui-shadow-raised);transform:translateY(-1px);'
          : 'border-color:var(--ui-neutral-hover-border);background:var(--ui-neutral-hover-surface);box-shadow:0 12px 22px var(--ui-shadow-raised);transform:translateY(-1px);'
        : ''
    ].join('')

  const toggleStyle = (key: HoverKey) =>
    [
      'display:inline-flex;height:38px;align-items:center;gap:9px;border-radius:999px;border:1px solid var(--ui-success-normal-border);background:var(--ui-success-normal-surface);padding:0 13px 0 7px;color:var(--ui-success-normal-text);font-size:13px;font-weight:800;transition:border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease;',
      isHovered(key)
        ? 'box-shadow:0 12px 24px var(--ui-shadow-raised);transform:translateY(-1px);'
        : ''
    ].join('')

  const toggleDotStyle =
    'display:grid;height:26px;width:26px;place-items:center;border-radius:999px;background:var(--ui-success-normal-text);color:#162017;'
</script>

<main style={shellStyle}>
  <div style={topBarStyle}>
    <div style={topBarTextStyle}>
      <span>Cthulhu Prompt</span>
      <span style="padding:0 10px;color:var(--ui-neutral-emphasis-border);">/</span>
      <span style={topBarCurrentStyle}>System Settings</span>
    </div>
  </div>

  <section style={contentStyle} data-testid="settings-screen">
    <div style={innerStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>
          <Settings size={14} strokeWidth={2.4} />
          <span>System Settings</span>
        </div>
        <div style={titleRowStyle}>
          <div>
            <h1 style={titleStyle}>System Settings</h1>
            <p style={descriptionStyle}>Global settings saved on your local machine.</p>
          </div>
          <div style={statusPillStyle}>
            <Check size={15} strokeWidth={3} />
            <span>Saved</span>
          </div>
        </div>
      </header>

      <div style={sectionGridStyle}>
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleWrapStyle}>
              <div style={iconTileStyle}>
                <Keyboard size={19} strokeWidth={2.2} />
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Editor & layout</h2>
                <p style={sectionDescriptionStyle}>
                  Typography, spacing, autosave, and core writing ergonomics.
                </p>
              </div>
            </div>
          </div>

          <div style={raisedGridStyle}>
            <article style={raisedCardStyle('font-card')} {...hoverHandlers('font-card')}>
              <div style="display:flex;min-width:0;align-items:flex-start;gap:12px;">
                <div
                  style="display:grid;height:34px;width:34px;flex:0 0 auto;place-items:center;border-radius:8px;border:1px solid var(--ui-info-normal-border);background:var(--ui-info-normal-surface);color:var(--ui-normal-text);"
                >
                  <Type size={17} />
                </div>
                <div>
                  <h3 style="margin:0;font-size:14px;font-weight:800;">Font Size</h3>
                  <p style={smallTextStyle}>Sets the base font size used inside the prompt editor.</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:9px;">
                <input aria-label="Font Size" value="15" readonly style={inputStyle} />
                <button type="button" style={buttonStyle('font-reset')} {...hoverHandlers('font-reset')}>
                  <RefreshCcw size={14} />
                  <span>Reset</span>
                </button>
              </div>
            </article>

            <article style={raisedCardStyle('lines-card')} {...hoverHandlers('lines-card')}>
              <div style="display:flex;min-width:0;align-items:flex-start;gap:12px;">
                <div
                  style="display:grid;height:34px;width:34px;flex:0 0 auto;place-items:center;border-radius:8px;border:1px solid var(--ui-warning-normal-border);background:var(--ui-warning-normal-surface);color:var(--ui-warning-icon-glyph);"
                >
                  <Keyboard size={17} />
                </div>
                <div>
                  <h3 style="margin:0;font-size:14px;font-weight:800;">Minimum Line Count</h3>
                  <p style={smallTextStyle}>
                    Sets the minimum number of visible lines in prompt editors.
                  </p>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:9px;">
                <input aria-label="Minimum Line Count" value="8" readonly style={inputStyle} />
                <button type="button" style={buttonStyle('lines-reset')} {...hoverHandlers('lines-reset')}>
                  <RefreshCcw size={14} />
                  <span>Reset</span>
                </button>
              </div>
            </article>

            <article style={raisedCardStyle('numbers-card')} {...hoverHandlers('numbers-card')}>
              <div style="display:flex;min-width:0;align-items:flex-start;gap:12px;">
                <div
                  style="display:grid;height:34px;width:34px;flex:0 0 auto;place-items:center;border-radius:8px;border:1px solid var(--ui-success-normal-border);background:var(--ui-success-normal-surface);color:var(--ui-success-normal-text);"
                >
                  <Check size={17} />
                </div>
                <div>
                  <h3 style="margin:0;font-size:14px;font-weight:800;">Show Line Numbers</h3>
                  <p style={smallTextStyle}>Display line numbers beside prompt text for easier review.</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:9px;">
                <button type="button" style={toggleStyle('numbers-toggle')} {...hoverHandlers('numbers-toggle')}>
                  <span style={toggleDotStyle}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>On</span>
                </button>
                <button
                  type="button"
                  style={buttonStyle('numbers-reset')}
                  {...hoverHandlers('numbers-reset')}
                >
                  <RefreshCcw size={14} />
                  <span>Reset</span>
                </button>
              </div>
            </article>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleWrapStyle}>
              <div style={iconTileStyle}>
                <Info size={19} strokeWidth={2.2} />
              </div>
              <div>
                <h2 style={sectionTitleStyle}>About</h2>
                <p style={sectionDescriptionStyle}>Build and release details for this desktop app.</p>
              </div>
            </div>
          </div>

          <div style={raisedGridStyle}>
            <article style={raisedCardStyle('issue-card')} {...hoverHandlers('issue-card')}>
              <div style="min-width:0;">
                <h3 style="margin:0;font-size:14px;font-weight:800;">Report an Issue</h3>
                <p style={smallTextStyle}>
                  Report bugs, request improvements, or check whether a problem is already tracked.
                </p>
              </div>
              <button
                type="button"
                style={buttonStyle('issue-button', true)}
                {...hoverHandlers('issue-button')}
              >
                <Bug size={14} />
                <span>Open Github Issues</span>
                <ExternalLink size={13} />
              </button>
            </article>

            <article style={raisedCardStyle('version-card')} {...hoverHandlers('version-card')}>
              <div style="min-width:0;">
                <h3 style="margin:0;font-size:14px;font-weight:800;">Current Version</h3>
                <p style={smallTextStyle}>The version currently installed on this device.</p>
              </div>
              <p
                style="margin:0;border:1px solid var(--ui-neutral-emphasis-border);border-radius:999px;background:var(--ui-neutral-emphasis-surface);padding:8px 12px;color:var(--ui-normal-text);font-size:13px;font-weight:800;white-space:nowrap;"
              >
                v0.0.20
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</main>
