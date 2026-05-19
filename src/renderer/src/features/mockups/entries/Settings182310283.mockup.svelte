<script lang="ts">
  import {
    Bug,
    ChevronRight,
    ExternalLink,
    Hash,
    Info,
    Keyboard,
    RefreshCcw,
    Settings,
    Type
  } from 'lucide-svelte'

  let hoveredId = $state<string | null>(null)
  let focusedId = $state<string | null>(null)
  let showLineNumbers = $state(true)
  let fontSize = $state('14')
  let minLines = $state('8')

  const setHovered = (id: string | null) => {
    hoveredId = id
  }

  const setFocused = (id: string | null) => {
    focusedId = id
  }

  const isHovered = (id: string) => hoveredId === id
  const isFocused = (id: string) => focusedId === id

  const getSettingCardStyle = (id: string) => `
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-width: 0;
    padding: 14px;
    border-radius: 8px;
    border: 1px solid ${isHovered(id) ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'};
    background:
      linear-gradient(135deg, oklch(1 0 0 / ${isHovered(id) ? '12%' : '8%'}) 0%, oklch(1 0 0 / ${isHovered(id) ? '6%' : '4%'}) 100%),
      var(--ui-neutral-muted-surface);
    box-shadow:
      0 16px 34px oklch(0 0 0 / ${isHovered(id) ? '28%' : '22%'}),
      0 1px 0 oklch(1 0 0 / 12%) inset;
    transform: translateY(${isHovered(id) ? '-1px' : '0'});
    transition:
      transform 140ms ease,
      border-color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  `

  const getInputStyle = (id: string) => `
    width: 76px;
    height: 36px;
    box-sizing: border-box;
    border-radius: 7px;
    border: 1px solid ${isFocused(id) ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-normal-border)'};
    background:
      linear-gradient(180deg, oklch(1 0 0 / 8%), oklch(1 0 0 / 3%)),
      var(--ui-neutral-field-surface);
    box-shadow:
      ${isFocused(id) ? '0 0 0 3px var(--ui-accent-normal-surface),' : ''}
      0 1px 0 oklch(1 0 0 / 10%) inset;
    color: var(--ui-normal-text);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    outline: none;
    padding: 0 11px;
    text-align: right;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  `

  const getResetButtonStyle = (id: string) => `
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 36px;
    border: 1px solid ${isHovered(id) ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'};
    border-radius: 7px;
    background: ${isHovered(id) ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'};
    color: var(--ui-accent-normal-text);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    padding: 0 12px;
    transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
    transform: translateY(${isHovered(id) ? '-1px' : '0'});
  `

  const getIssueButtonStyle = (id: string) => `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    white-space: nowrap;
    border: 1px solid ${isHovered(id) ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'};
    border-radius: 7px;
    background: ${isHovered(id) ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'};
    color: var(--ui-accent-normal-text);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    padding: 0 13px;
    text-decoration: none;
    transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
    transform: translateY(${isHovered(id) ? '-1px' : '0'});
  `

  const getToggleStyle = (id: string) => `
    position: relative;
    width: 78px;
    height: 36px;
    border: 1px solid ${
      showLineNumbers
        ? isHovered(id)
          ? 'var(--ui-success-normal-border)'
          : 'var(--ui-accent-normal-border)'
        : 'var(--ui-neutral-normal-border)'
    };
    border-radius: 999px;
    background: ${
      showLineNumbers
        ? isHovered(id)
          ? 'var(--ui-success-normal-surface)'
          : 'var(--ui-accent-normal-surface)'
        : isHovered(id)
          ? 'var(--ui-neutral-hover-surface)'
          : 'var(--ui-neutral-normal-surface)'
    };
    box-shadow: 0 1px 0 oklch(1 0 0 / 10%) inset;
    color: ${showLineNumbers ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 0 12px 0 ${showLineNumbers ? '14px' : '32px'};
    text-align: ${showLineNumbers ? 'left' : 'right'};
    transition: background 140ms ease, border-color 140ms ease;
  `
</script>

<section
  data-testid="settings-screen"
  style="
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    color: var(--ui-normal-text);
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  "
>
  <div
    style="
      display: flex;
      height: 36px;
      align-items: center;
      border-bottom: 1px solid var(--ui-neutral-muted-border);
      background: oklch(0.16 0.012 266 / 72%);
      padding: 0 24px;
    "
  >
    <div
      style="
        display: flex;
        min-width: 0;
        align-items: center;
        color: var(--ui-muted-text);
        font-size: 13px;
        font-weight: 700;
      "
    >
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Settings</span>
      <ChevronRight size={14} strokeWidth={2.4} style="margin: 0 9px; color: oklch(1 0 0 / 28%);" />
      <span style="color: var(--ui-secondary-text); white-space: nowrap;">System Settings</span>
    </div>
  </div>

  <div
    style="
      box-sizing: border-box;
      display: grid;
      gap: 22px;
      margin: 0 auto;
      max-width: 980px;
      padding: 24px;
    "
  >
    <header
      style="
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 14px;
        align-items: center;
      "
    >
      <div
        style="
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 8px;
          border: 1px solid var(--ui-accent-normal-border);
          background: var(--ui-accent-normal-surface);
          box-shadow: 0 12px 26px var(--ui-shadow-raised), 0 1px 0 oklch(1 0 0 / 12%) inset;
          color: var(--ui-accent-icon-glyph);
        "
      >
        <Settings size={22} strokeWidth={2.25} />
      </div>

      <div style="min-width: 0;">
        <h1
          style="
            margin: 0;
            color: var(--ui-normal-text);
            font-size: 22px;
            font-weight: 750;
            letter-spacing: 0;
            line-height: 1.15;
          "
        >
          System Settings
        </h1>
        <p
          style="
            margin: 5px 0 0;
            color: var(--ui-secondary-text);
            font-size: 13px;
            line-height: 1.45;
          "
        >
          Global settings saved on your local machine.
        </p>
      </div>
    </header>

    <div
      style="
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.45fr) minmax(290px, 0.8fr);
        align-items: start;
      "
    >
      <section
        style="
          display: grid;
          gap: 12px;
          min-width: 0;
          border: 1px solid var(--ui-card-normal-border);
          border-radius: 8px;
          background: linear-gradient(
            180deg,
            var(--ui-card-normal-surface-gradient-start),
            var(--ui-card-normal-surface-gradient-end)
          );
          box-shadow: 0 18px 42px var(--ui-card-normal-shadow);
          padding: 14px;
        "
      >
        <div
          style="
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 11px;
            align-items: center;
            padding: 3px 3px 7px;
          "
        >
          <div
            style="
              display: grid;
              place-items: center;
              width: 36px;
              height: 36px;
              border-radius: 8px;
              border: 1px solid var(--ui-neutral-normal-border);
              background: var(--ui-neutral-normal-surface);
              color: var(--ui-hoverable-text);
            "
          >
            <Keyboard size={19} strokeWidth={2.3} />
          </div>
          <div style="min-width: 0;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 750; line-height: 1.2;">
              Editor &amp; layout
            </h2>
            <p
              style="
                margin: 4px 0 0;
                color: var(--ui-muted-text);
                font-size: 12px;
                line-height: 1.45;
              "
            >
              Typography, spacing, autosave, and core writing ergonomics.
            </p>
          </div>
        </div>

        <article
          style={getSettingCardStyle('font-size-card')}
          onpointerenter={() => setHovered('font-size-card')}
          onpointerleave={() => setHovered(null)}
        >
          <div
            style="
              display: grid;
              grid-template-columns: auto minmax(0, 1fr);
              gap: 12px;
              align-items: center;
              min-width: 0;
            "
          >
            <div
              style="
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border-radius: 7px;
                background: var(--ui-info-normal-surface);
                border: 1px solid var(--ui-info-normal-border);
                color: var(--ui-normal-text);
              "
            >
              <Type size={18} strokeWidth={2.35} />
            </div>
            <div style="min-width: 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 750; line-height: 1.2;">
                Font Size
              </h3>
              <p
                style="
                  margin: 4px 0 0;
                  color: var(--ui-secondary-text);
                  font-size: 12px;
                  line-height: 1.45;
                "
              >
                Sets the base font size used inside the prompt editor.
              </p>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: end; gap: 8px;">
            <input
              data-testid="font-size-input"
              aria-label="Font Size"
              value={fontSize}
              style={getInputStyle('font-size-input')}
              oninput={(event) => {
                fontSize = event.currentTarget.value
              }}
              onfocus={() => setFocused('font-size-input')}
              onblur={() => setFocused(null)}
            />
            <button
              type="button"
              style={getResetButtonStyle('font-size-reset')}
              onpointerenter={() => setHovered('font-size-reset')}
              onpointerleave={() => setHovered(null)}
            >
              <RefreshCcw size={15} strokeWidth={2.35} />
              Reset
            </button>
          </div>
        </article>

        <article
          style={getSettingCardStyle('min-lines-card')}
          onpointerenter={() => setHovered('min-lines-card')}
          onpointerleave={() => setHovered(null)}
        >
          <div
            style="
              display: grid;
              grid-template-columns: auto minmax(0, 1fr);
              gap: 12px;
              align-items: center;
              min-width: 0;
            "
          >
            <div
              style="
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border-radius: 7px;
                background: var(--ui-warning-normal-surface);
                border: 1px solid var(--ui-warning-normal-border);
                color: var(--ui-warning-icon-glyph);
              "
            >
              <Hash size={18} strokeWidth={2.35} />
            </div>
            <div style="min-width: 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 750; line-height: 1.2;">
                Minimum Line Count
              </h3>
              <p
                style="
                  margin: 4px 0 0;
                  color: var(--ui-secondary-text);
                  font-size: 12px;
                  line-height: 1.45;
                "
              >
                Sets the minimum number of visible lines in prompt editors.
              </p>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: end; gap: 8px;">
            <input
              data-testid="min-lines-input"
              aria-label="Minimum Line Count"
              value={minLines}
              style={getInputStyle('min-lines-input')}
              oninput={(event) => {
                minLines = event.currentTarget.value
              }}
              onfocus={() => setFocused('min-lines-input')}
              onblur={() => setFocused(null)}
            />
            <button
              type="button"
              style={getResetButtonStyle('min-lines-reset')}
              onpointerenter={() => setHovered('min-lines-reset')}
              onpointerleave={() => setHovered(null)}
            >
              <RefreshCcw size={15} strokeWidth={2.35} />
              Reset
            </button>
          </div>
        </article>

        <article
          style={getSettingCardStyle('line-numbers-card')}
          onpointerenter={() => setHovered('line-numbers-card')}
          onpointerleave={() => setHovered(null)}
        >
          <div
            style="
              display: grid;
              grid-template-columns: auto minmax(0, 1fr);
              gap: 12px;
              align-items: center;
              min-width: 0;
            "
          >
            <div
              style="
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border-radius: 7px;
                background: var(--ui-success-normal-surface);
                border: 1px solid var(--ui-success-normal-border);
                color: var(--ui-success-normal-text);
              "
            >
              <Keyboard size={18} strokeWidth={2.35} />
            </div>
            <div style="min-width: 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 750; line-height: 1.2;">
                Show Line Numbers
              </h3>
              <p
                style="
                  margin: 4px 0 0;
                  color: var(--ui-secondary-text);
                  font-size: 12px;
                  line-height: 1.45;
                "
              >
                Display line numbers beside prompt text for easier review.
              </p>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: end; gap: 8px;">
            <button
              type="button"
              data-testid="show-line-numbers-toggle"
              aria-pressed={showLineNumbers}
              style={getToggleStyle('line-numbers-toggle')}
              onclick={() => {
                showLineNumbers = !showLineNumbers
              }}
              onpointerenter={() => setHovered('line-numbers-toggle')}
              onpointerleave={() => setHovered(null)}
            >
              <span
                style={`
                  position: absolute;
                  top: 5px;
                  ${showLineNumbers ? 'right: 5px;' : 'left: 5px;'}
                  width: 24px;
                  height: 24px;
                  border-radius: 999px;
                  background: oklch(1 0 0 / 88%);
                  box-shadow: 0 5px 12px oklch(0 0 0 / 34%);
                  transition: left 140ms ease, right 140ms ease;
                `}
              ></span>
              {showLineNumbers ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              style={getResetButtonStyle('line-numbers-reset')}
              onpointerenter={() => setHovered('line-numbers-reset')}
              onpointerleave={() => setHovered(null)}
            >
              <RefreshCcw size={15} strokeWidth={2.35} />
              Reset
            </button>
          </div>
        </article>
      </section>

      <section
        style="
          display: grid;
          gap: 12px;
          min-width: 0;
          border: 1px solid var(--ui-card-normal-border);
          border-radius: 8px;
          background: linear-gradient(
            180deg,
            var(--ui-card-normal-surface-gradient-start),
            var(--ui-card-normal-surface-gradient-end)
          );
          box-shadow: 0 18px 42px var(--ui-card-normal-shadow);
          padding: 14px;
        "
      >
        <div
          style="
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 11px;
            align-items: center;
            padding: 3px 3px 7px;
          "
        >
          <div
            style="
              display: grid;
              place-items: center;
              width: 36px;
              height: 36px;
              border-radius: 8px;
              border: 1px solid var(--ui-neutral-normal-border);
              background: var(--ui-neutral-normal-surface);
              color: var(--ui-hoverable-text);
            "
          >
            <Info size={19} strokeWidth={2.3} />
          </div>
          <div style="min-width: 0;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 750; line-height: 1.2;">About</h2>
            <p
              style="
                margin: 4px 0 0;
                color: var(--ui-muted-text);
                font-size: 12px;
                line-height: 1.45;
              "
            >
              Build and release details for this desktop app.
            </p>
          </div>
        </div>

        <article
          style={getSettingCardStyle('issue-card')}
          onpointerenter={() => setHovered('issue-card')}
          onpointerleave={() => setHovered(null)}
        >
          <div style="min-width: 0;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 750; line-height: 1.2;">
              Report an Issue
            </h3>
            <p
              style="
                margin: 4px 0 0;
                color: var(--ui-secondary-text);
                font-size: 12px;
                line-height: 1.45;
              "
            >
              Report bugs, request improvements, or check whether a problem is already tracked.
            </p>
          </div>

          <a
            href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
            target="_blank"
            rel="noreferrer"
            data-testid="about-github-issues-button"
            style={getIssueButtonStyle('issue-button')}
            onpointerenter={() => setHovered('issue-button')}
            onpointerleave={() => setHovered(null)}
          >
            <Bug size={15} strokeWidth={2.35} />
            Open Github Issues
            <ExternalLink size={14} strokeWidth={2.35} />
          </a>
        </article>

        <article
          style={getSettingCardStyle('version-card')}
          onpointerenter={() => setHovered('version-card')}
          onpointerleave={() => setHovered(null)}
        >
          <div style="min-width: 0;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 750; line-height: 1.2;">
              Current Version
            </h3>
            <p
              style="
                margin: 4px 0 0;
                color: var(--ui-secondary-text);
                font-size: 12px;
                line-height: 1.45;
              "
            >
              The version currently installed on this device.
            </p>
          </div>

          <p
            data-testid="about-version-value"
            style="
              margin: 0;
              border: 1px solid var(--ui-neutral-emphasis-border);
              border-radius: 999px;
              background: var(--ui-neutral-emphasis-surface);
              color: var(--ui-normal-text);
              font-size: 13px;
              font-weight: 800;
              line-height: 1;
              padding: 10px 13px;
              white-space: nowrap;
            "
          >
            v1.8.3
          </p>
        </article>
      </section>
    </div>
  </div>
</section>
