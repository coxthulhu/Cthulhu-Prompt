<script lang="ts">
  import {
    Bug,
    Check,
    ExternalLink,
    Info,
    Keyboard,
    ListOrdered,
    RefreshCcw,
    Rows3,
    Settings,
    Type
  } from 'lucide-svelte'

  let hoveredControl = $state<string | null>(null)
  let showLineNumbers = $state(true)

  const setHoveredControl = (key: string | null) => {
    hoveredControl = key
  }

  const panelStyle =
    'border: 1px solid var(--ui-card-normal-border); border-radius: 10px; background: linear-gradient(145deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: 0 18px 42px var(--ui-card-normal-shadow); padding: 18px;'

  const sectionHeaderStyle =
    'display: flex; align-items: center; gap: 12px; padding: 2px 4px 16px;'

  const sectionIconStyle =
    'display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; color: var(--ui-accent-icon-glyph); background: var(--ui-accent-icon-ring); border: 1px solid var(--ui-accent-normal-border); box-shadow: 0 8px 18px var(--ui-shadow-raised);'

  const raisedSettingStyle = (key: string) =>
    `display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 16px; border-radius: 9px; border: 1px solid ${hoveredControl === key ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; background: ${hoveredControl === key ? 'linear-gradient(145deg, oklch(1 0 0 / 11%), oklch(1 0 0 / 5%))' : 'linear-gradient(145deg, oklch(1 0 0 / 8%), oklch(1 0 0 / 4%))'}; box-shadow: ${hoveredControl === key ? '0 16px 30px var(--ui-shadow-raised), inset 0 1px 0 oklch(1 0 0 / 10%)' : '0 10px 22px oklch(0 0 0 / 16%), inset 0 1px 0 oklch(1 0 0 / 8%)'}; transform: ${hoveredControl === key ? 'translateY(-1px)' : 'translateY(0)'}; transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;`

  const smallIconStyle =
    'display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: var(--ui-secondary-text); background: var(--ui-neutral-normal-surface); border: 1px solid var(--ui-neutral-normal-border);'

  const inputStyle = (key: string) =>
    `width: 76px; border: 1px solid ${hoveredControl === key ? 'var(--ui-neutral-focus-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 8px; background: ${hoveredControl === key ? 'oklch(0.245 0.014 266.5)' : 'var(--ui-neutral-field-surface)'}; color: var(--ui-normal-text); font: inherit; font-size: 14px; font-weight: 650; padding: 8px 10px; text-align: right; outline: none; box-shadow: inset 0 1px 0 oklch(1 0 0 / 7%), 0 8px 16px oklch(0 0 0 / 14%); transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;`

  const resetButtonStyle = (key: string) =>
    `display: inline-flex; align-items: center; gap: 8px; height: 36px; border: 1px solid ${hoveredControl === `${key}-reset` ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 8px; background: ${hoveredControl === `${key}-reset` ? 'var(--ui-accent-hover-surface)' : 'var(--ui-neutral-normal-surface)'}; color: ${hoveredControl === `${key}-reset` ? 'var(--ui-accent-normal-text)' : 'var(--ui-hoverable-text)'}; font: inherit; font-size: 13px; font-weight: 700; padding: 0 12px; cursor: pointer; box-shadow: ${hoveredControl === `${key}-reset` ? '0 10px 18px var(--ui-shadow-raised)' : '0 6px 12px oklch(0 0 0 / 12%)'}; transition: border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;`

  const toggleButtonStyle = (key: string) =>
    `display: inline-flex; align-items: center; gap: 10px; height: 36px; border: 1px solid ${hoveredControl === key ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 999px; background: ${showLineNumbers ? 'var(--ui-accent-normal-surface)' : 'var(--ui-neutral-normal-surface)'}; color: var(--ui-normal-text); font: inherit; font-size: 13px; font-weight: 750; padding: 0 13px 0 6px; cursor: pointer; box-shadow: 0 9px 18px var(--ui-shadow-raised), inset 0 1px 0 oklch(1 0 0 / 9%); transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;`

  const linkButtonStyle = (key: string) =>
    `display: inline-flex; align-items: center; gap: 8px; height: 38px; border: 1px solid ${hoveredControl === key ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 8px; background: ${hoveredControl === key ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color: var(--ui-accent-normal-text); font: inherit; font-size: 13px; font-weight: 750; padding: 0 13px; text-decoration: none; box-shadow: ${hoveredControl === key ? '0 12px 22px var(--ui-shadow-raised)' : '0 8px 16px oklch(0 0 0 / 14%)'}; transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;`

  const versionPillStyle =
    'display: inline-flex; align-items: center; min-height: 34px; border: 1px solid var(--ui-success-normal-border); border-radius: 999px; background: var(--ui-success-normal-surface); color: var(--ui-success-normal-text); font-size: 13px; font-weight: 750; padding: 0 12px; box-shadow: 0 8px 16px oklch(0 0 0 / 14%), inset 0 1px 0 oklch(1 0 0 / 8%);'
</script>

<section
  data-testid="settings-screen-mockup"
  style="display: flex; min-height: 0; flex: 1; justify-content: center; overflow-y: auto; padding: 24px; color: var(--ui-normal-text);"
>
  <div style="width: 100%; max-width: 960px;">
    <header style="display: grid; gap: 14px; margin-bottom: 22px;">
      <div
        style="display: flex; height: 36px; align-items: center; border-bottom: 1px solid oklch(1 0 0 / 8%);"
      >
        <div
          style="display: flex; min-width: 0; align-items: center; color: var(--ui-muted-text); font-size: 14px; font-weight: 650;"
        >
          <span style="white-space: nowrap;">Cthulhu Prompt</span>
          <span style="padding: 0 12px; color: oklch(1 0 0 / 25%);">/</span>
          <span style="white-space: nowrap; color: var(--ui-hoverable-text);">System Settings</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 14px;">
        <div
          style="display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--ui-accent-normal-border); border-radius: 10px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-icon-glyph); box-shadow: 0 12px 26px var(--ui-shadow-raised), inset 0 1px 0 oklch(1 0 0 / 10%);"
        >
          <Settings size={21} strokeWidth={2.2} />
        </div>
        <div style="min-width: 0;">
          <h1 style="margin: 0; font-size: 22px; line-height: 1.2; font-weight: 780;">
            System Settings
          </h1>
          <p
            style="margin: 5px 0 0; color: var(--ui-secondary-text); font-size: 14px; line-height: 1.45;"
          >
            Global settings saved on your local machine.
          </p>
        </div>
      </div>
    </header>

    <div style="display: grid; gap: 18px;">
      <article style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionIconStyle}>
            <Keyboard size={18} />
          </div>
          <div style="min-width: 0;">
            <h2 style="margin: 0; font-size: 18px; line-height: 1.25; font-weight: 760;">
              Editor & layout
            </h2>
            <p
              style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
            >
              Typography, spacing, autosave, and core writing ergonomics.
            </p>
          </div>
        </div>

        <div style="display: grid; gap: 12px;">
          <section
            role="group"
            aria-label="Font Size"
            style={raisedSettingStyle('font-size')}
            onmouseenter={() => setHoveredControl('font-size')}
            onmouseleave={() => setHoveredControl(null)}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div style={smallIconStyle}>
                <Type size={16} />
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; line-height: 1.3; font-weight: 760;">
                  Font Size
                </h3>
                <p
                  style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
                >
                  Sets the base font size used inside the prompt editor.
                </p>
              </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: end; gap: 9px;">
              <input
                aria-label="Font Size"
                value="16"
                inputmode="numeric"
                style={inputStyle('font-size')}
                onfocus={() => setHoveredControl('font-size')}
              />
              <button
                type="button"
                style={resetButtonStyle('font-size')}
                onmouseenter={() => setHoveredControl('font-size-reset')}
                onmouseleave={() => setHoveredControl(null)}
              >
                <RefreshCcw size={14} />
                Reset
              </button>
            </div>
          </section>

          <section
            role="group"
            aria-label="Minimum Line Count"
            style={raisedSettingStyle('min-lines')}
            onmouseenter={() => setHoveredControl('min-lines')}
            onmouseleave={() => setHoveredControl(null)}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div style={smallIconStyle}>
                <Rows3 size={16} />
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; line-height: 1.3; font-weight: 760;">
                  Minimum Line Count
                </h3>
                <p
                  style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
                >
                  Sets the minimum number of visible lines in prompt editors.
                </p>
              </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: end; gap: 9px;">
              <input
                aria-label="Minimum Line Count"
                value="8"
                inputmode="numeric"
                style={inputStyle('min-lines')}
                onfocus={() => setHoveredControl('min-lines')}
              />
              <button
                type="button"
                style={resetButtonStyle('min-lines')}
                onmouseenter={() => setHoveredControl('min-lines-reset')}
                onmouseleave={() => setHoveredControl(null)}
              >
                <RefreshCcw size={14} />
                Reset
              </button>
            </div>
          </section>

          <section
            role="group"
            aria-label="Show Line Numbers"
            style={raisedSettingStyle('line-numbers')}
            onmouseenter={() => setHoveredControl('line-numbers')}
            onmouseleave={() => setHoveredControl(null)}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div style={smallIconStyle}>
                <ListOrdered size={16} />
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; line-height: 1.3; font-weight: 760;">
                  Show Line Numbers
                </h3>
                <p
                  style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
                >
                  Display line numbers beside prompt text for easier review.
                </p>
              </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: end; gap: 9px;">
              <button
                type="button"
                aria-pressed={showLineNumbers}
                style={toggleButtonStyle('line-numbers-toggle')}
                onclick={() => {
                  showLineNumbers = !showLineNumbers
                }}
                onmouseenter={() => setHoveredControl('line-numbers-toggle')}
                onmouseleave={() => setHoveredControl(null)}
              >
                <span
                  style={`display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: ${showLineNumbers ? 'var(--ui-accent-strong-surface)' : 'var(--ui-neutral-emphasis-surface)'}; color: var(--ui-normal-text);`}
                >
                  <Check size={14} />
                </span>
                {showLineNumbers ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                style={resetButtonStyle('line-numbers')}
                onmouseenter={() => setHoveredControl('line-numbers-reset')}
                onmouseleave={() => setHoveredControl(null)}
              >
                <RefreshCcw size={14} />
                Reset
              </button>
            </div>
          </section>
        </div>
      </article>

      <article style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionIconStyle}>
            <Info size={18} />
          </div>
          <div style="min-width: 0;">
            <h2 style="margin: 0; font-size: 18px; line-height: 1.25; font-weight: 760;">
              About
            </h2>
            <p
              style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
            >
              Build and release details for this desktop app.
            </p>
          </div>
        </div>

        <div style="display: grid; gap: 12px;">
          <section
            role="group"
            aria-label="Report an Issue"
            style={raisedSettingStyle('issues')}
            onmouseenter={() => setHoveredControl('issues')}
            onmouseleave={() => setHoveredControl(null)}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div style={smallIconStyle}>
                <Bug size={16} />
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; line-height: 1.3; font-weight: 760;">
                  Report an Issue
                </h3>
                <p
                  style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
                >
                  Report bugs, request improvements, or check whether a problem is already tracked.
                </p>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: end;">
              <a
                href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
                target="_blank"
                rel="noreferrer"
                style={linkButtonStyle('issues-link')}
                onmouseenter={() => setHoveredControl('issues-link')}
                onmouseleave={() => setHoveredControl(null)}
              >
                <Bug size={14} />
                Open Github Issues
                <ExternalLink size={14} />
              </a>
            </div>
          </section>

          <section
            role="group"
            aria-label="Current Version"
            style={raisedSettingStyle('version')}
            onmouseenter={() => setHoveredControl('version')}
            onmouseleave={() => setHoveredControl(null)}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div style={smallIconStyle}>
                <Info size={16} />
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; line-height: 1.3; font-weight: 760;">
                  Current Version
                </h3>
                <p
                  style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;"
                >
                  The version currently installed on this device.
                </p>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: end;">
              <span style={versionPillStyle}>v0.22.0</span>
            </div>
          </section>
        </div>
      </article>
    </div>
  </div>
</section>
