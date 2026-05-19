<script lang="ts">
  import {
    Bug,
    Check,
    ExternalLink,
    Info,
    Keyboard,
    Minus,
    RefreshCcw,
    Settings,
    Type,
    WrapText
  } from 'lucide-svelte'

  type SettingCard = {
    id: string
    title: string
    description: string
    value: string
    suffix?: string
  }

  const editorSettings: SettingCard[] = [
    {
      id: 'font-size',
      title: 'Font Size',
      description: 'Sets the base font size used inside the prompt editor.',
      value: '14',
      suffix: 'px'
    },
    {
      id: 'minimum-line-count',
      title: 'Minimum Line Count',
      description: 'Sets the minimum number of visible lines in prompt editors.',
      value: '8',
      suffix: 'lines'
    }
  ]

  let hoveredControl = $state<string | null>(null)
  let hoveredCard = $state<string | null>(null)
</script>

<section
  data-testid="settings-screen-mockup"
  style="box-sizing: border-box; display: flex; min-height: 0; flex: 1; justify-content: center; overflow-y: auto; padding: 24px; color: var(--ui-normal-text);"
>
  <div style="box-sizing: border-box; display: grid; width: 100%; max-width: 960px; gap: 22px;">
    <div
      style="display: flex; height: 36px; align-items: center; border-bottom: 1px solid var(--ui-neutral-muted-border); padding: 0 2px 10px;"
    >
      <div
        style="display: flex; min-width: 0; align-items: center; font-size: 13px; font-weight: 600; color: var(--ui-muted-text);"
      >
        <button
          type="button"
          onmouseenter={() => (hoveredControl = 'breadcrumb-home')}
          onmouseleave={() => (hoveredControl = null)}
          style={`min-width: 0; cursor: pointer; border: 0; background: transparent; padding: 0; color: ${hoveredControl === 'breadcrumb-home' ? 'var(--ui-hoverable-text)' : 'var(--ui-muted-text)'}; font: inherit; transition: color 140ms ease;`}
        >
          Cthulhu Prompt
        </button>
        <span style="padding: 0 10px; color: oklch(1 0 0 / 24%);">/</span>
        <button
          type="button"
          onmouseenter={() => (hoveredControl = 'breadcrumb-settings')}
          onmouseleave={() => (hoveredControl = null)}
          style={`cursor: pointer; border: 0; background: transparent; padding: 0; color: ${hoveredControl === 'breadcrumb-settings' ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font: inherit; transition: color 140ms ease;`}
        >
          System Settings
        </button>
      </div>
    </div>

    <header style="display: grid; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div
          style="display: grid; height: 36px; width: 36px; place-items: center; border: 1px solid var(--ui-accent-normal-border); border-radius: 8px; background: var(--ui-accent-normal-surface); color: var(--ui-accent-icon-glyph); box-shadow: 0 0 0 5px var(--ui-accent-icon-ring);"
        >
          <Settings size={18} strokeWidth={2.2} />
        </div>
        <div style="min-width: 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 720; letter-spacing: 0; line-height: 1.1;">
            System Settings
          </h1>
          <p style="margin: 5px 0 0; color: var(--ui-secondary-text); font-size: 14px; line-height: 1.45;">
            Global settings saved on your local machine.
          </p>
        </div>
      </div>
      <div
        style="height: 2px; width: 76px; border-radius: 999px; background: linear-gradient(90deg, var(--ui-accent-strong-border), oklch(0.666 0.181 254.617 / 70%));"
      ></div>
    </header>

    <article
      style="box-sizing: border-box; display: grid; gap: 16px; border: 1px solid var(--ui-card-normal-border); border-radius: 10px; background: linear-gradient(135deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); padding: 18px; box-shadow: 0 18px 42px var(--ui-card-normal-shadow);"
    >
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
        <div style="display: flex; min-width: 0; gap: 12px;">
          <div
            style="display: grid; height: 34px; width: 34px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: 8px; background: var(--ui-neutral-normal-surface); color: var(--ui-hoverable-text);"
          >
            <Keyboard size={17} />
          </div>
          <div style="min-width: 0;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
              Editor &amp; layout
            </h2>
            <p style="margin: 5px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;">
              Typography, spacing, autosave, and core writing ergonomics.
            </p>
          </div>
        </div>
      </div>

      <div style="display: grid; gap: 12px;">
        {#each editorSettings as setting (setting.id)}
          <section
            role="group"
            onmouseenter={() => (hoveredCard = setting.id)}
            onmouseleave={() => (hoveredCard = null)}
            style={`box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; border: 1px solid ${hoveredCard === setting.id ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 9px; background: ${hoveredCard === setting.id ? 'linear-gradient(135deg, oklch(1 0 0 / 13%), oklch(1 0 0 / 7%))' : 'linear-gradient(135deg, oklch(1 0 0 / 10%), oklch(1 0 0 / 5%))'}; padding: 14px; box-shadow: 0 12px 28px oklch(0 0 0 / 22%), inset 0 1px 0 oklch(1 0 0 / 10%); transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease; transform: ${hoveredCard === setting.id ? 'translateY(-1px)' : 'translateY(0)'};`}
          >
            <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
              <div
                style="display: grid; height: 32px; width: 32px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-info-normal-border); border-radius: 8px; background: var(--ui-info-normal-surface); color: var(--ui-normal-text);"
              >
                {#if setting.id === 'font-size'}
                  <Type size={16} />
                {:else}
                  <WrapText size={16} />
                {/if}
              </div>
              <div style="min-width: 0;">
                <h3 style="margin: 0; font-size: 14px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
                  {setting.title}
                </h3>
                <p style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 12px; line-height: 1.45;">
                  {setting.description}
                </p>
              </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;">
              <div
                style="display: grid; grid-template-columns: 34px minmax(70px, auto) 34px; align-items: stretch; overflow: hidden; border: 1px solid var(--ui-neutral-normal-border); border-radius: 8px; background: var(--ui-neutral-field-surface); box-shadow: inset 0 1px 0 oklch(1 0 0 / 8%), 0 8px 18px oklch(0 0 0 / 18%);"
              >
                <button
                  type="button"
                  aria-label={`Decrease ${setting.title}`}
                  onmouseenter={() => (hoveredControl = `${setting.id}-decrease`)}
                  onmouseleave={() => (hoveredControl = null)}
                  style={`display: grid; cursor: pointer; place-items: center; border: 0; border-right: 1px solid var(--ui-neutral-muted-border); background: ${hoveredControl === `${setting.id}-decrease` ? 'var(--ui-neutral-hover-surface)' : 'transparent'}; color: var(--ui-hoverable-text); transition: background 140ms ease;`}
                >
                  <Minus size={14} />
                </button>
                <div
                  style="display: flex; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; color: var(--ui-normal-text); font-size: 14px; font-weight: 650;"
                >
                  <span>{setting.value}</span>
                  <span style="color: var(--ui-muted-text); font-size: 12px; font-weight: 600;">{setting.suffix}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Increase ${setting.title}`}
                  onmouseenter={() => (hoveredControl = `${setting.id}-increase`)}
                  onmouseleave={() => (hoveredControl = null)}
                  style={`display: grid; cursor: pointer; place-items: center; border: 0; border-left: 1px solid var(--ui-neutral-muted-border); background: ${hoveredControl === `${setting.id}-increase` ? 'var(--ui-neutral-hover-surface)' : 'transparent'}; color: var(--ui-hoverable-text); transition: background 140ms ease;`}
                >
                  <span style="font-size: 17px; font-weight: 500; line-height: 1;">+</span>
                </button>
              </div>

              <button
                type="button"
                onmouseenter={() => (hoveredControl = `${setting.id}-reset`)}
                onmouseleave={() => (hoveredControl = null)}
                style={`display: inline-flex; min-height: 36px; cursor: pointer; align-items: center; gap: 7px; border: 1px solid ${hoveredControl === `${setting.id}-reset` ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 8px; background: ${hoveredControl === `${setting.id}-reset` ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}; padding: 0 11px; color: var(--ui-hoverable-text); font-size: 13px; font-weight: 650; transition: background 140ms ease, border-color 140ms ease;`}
              >
                <RefreshCcw size={14} />
                Reset
              </button>
            </div>
          </section>
        {/each}

        <section
          role="group"
          onmouseenter={() => (hoveredCard = 'show-line-numbers')}
          onmouseleave={() => (hoveredCard = null)}
          style={`box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; border: 1px solid ${hoveredCard === 'show-line-numbers' ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 9px; background: ${hoveredCard === 'show-line-numbers' ? 'linear-gradient(135deg, oklch(1 0 0 / 13%), oklch(1 0 0 / 7%))' : 'linear-gradient(135deg, oklch(1 0 0 / 10%), oklch(1 0 0 / 5%))'}; padding: 14px; box-shadow: 0 12px 28px oklch(0 0 0 / 22%), inset 0 1px 0 oklch(1 0 0 / 10%); transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; transform: ${hoveredCard === 'show-line-numbers' ? 'translateY(-1px)' : 'translateY(0)'};`}
        >
          <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
            <div
              style="display: grid; height: 32px; width: 32px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-success-normal-border); border-radius: 8px; background: var(--ui-success-normal-surface); color: var(--ui-success-normal-text);"
            >
              <Check size={16} />
            </div>
            <div style="min-width: 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
                Show Line Numbers
              </h3>
              <p style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 12px; line-height: 1.45;">
                Display line numbers beside prompt text for easier review.
              </p>
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;">
            <button
              type="button"
              aria-pressed="true"
              data-testid="show-line-numbers-toggle"
              onmouseenter={() => (hoveredControl = 'show-line-numbers-toggle')}
              onmouseleave={() => (hoveredControl = null)}
              style={`display: inline-flex; min-height: 36px; cursor: pointer; align-items: center; gap: 8px; border: 1px solid ${hoveredControl === 'show-line-numbers-toggle' ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 999px; background: ${hoveredControl === 'show-line-numbers-toggle' ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; padding: 0 7px 0 12px; color: var(--ui-accent-normal-text); font-size: 13px; font-weight: 700; transition: background 140ms ease, border-color 140ms ease;`}
            >
              On
              <span
                style="display: grid; height: 24px; width: 24px; place-items: center; border-radius: 999px; background: var(--ui-accent-strong-surface); color: var(--ui-normal-text); box-shadow: 0 5px 14px oklch(0 0 0 / 26%);"
              >
                <Check size={13} strokeWidth={3} />
              </span>
            </button>

            <button
              type="button"
              onmouseenter={() => (hoveredControl = 'show-line-numbers-reset')}
              onmouseleave={() => (hoveredControl = null)}
              style={`display: inline-flex; min-height: 36px; cursor: pointer; align-items: center; gap: 7px; border: 1px solid ${hoveredControl === 'show-line-numbers-reset' ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 8px; background: ${hoveredControl === 'show-line-numbers-reset' ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}; padding: 0 11px; color: var(--ui-hoverable-text); font-size: 13px; font-weight: 650; transition: background 140ms ease, border-color 140ms ease;`}
            >
              <RefreshCcw size={14} />
              Reset
            </button>
          </div>
        </section>
      </div>
    </article>

    <article
      style="box-sizing: border-box; display: grid; gap: 16px; border: 1px solid var(--ui-card-normal-border); border-radius: 10px; background: linear-gradient(135deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); padding: 18px; box-shadow: 0 18px 42px var(--ui-card-normal-shadow);"
    >
      <div style="display: flex; min-width: 0; gap: 12px;">
        <div
          style="display: grid; height: 34px; width: 34px; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: 8px; background: var(--ui-neutral-normal-surface); color: var(--ui-hoverable-text);"
        >
          <Info size={17} />
        </div>
        <div style="min-width: 0;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
            About
          </h2>
          <p style="margin: 5px 0 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.45;">
            Build and release details for this desktop app.
          </p>
        </div>
      </div>

      <div style="display: grid; gap: 12px;">
        <section
          role="group"
          onmouseenter={() => (hoveredCard = 'report-issue')}
          onmouseleave={() => (hoveredCard = null)}
          style={`box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; border: 1px solid ${hoveredCard === 'report-issue' ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 9px; background: ${hoveredCard === 'report-issue' ? 'linear-gradient(135deg, oklch(1 0 0 / 13%), oklch(1 0 0 / 7%))' : 'linear-gradient(135deg, oklch(1 0 0 / 10%), oklch(1 0 0 / 5%))'}; padding: 14px; box-shadow: 0 12px 28px oklch(0 0 0 / 22%), inset 0 1px 0 oklch(1 0 0 / 10%); transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; transform: ${hoveredCard === 'report-issue' ? 'translateY(-1px)' : 'translateY(0)'};`}
        >
          <div style="min-width: 0;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
              Report an Issue
            </h3>
            <p style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 12px; line-height: 1.45;">
              Report bugs, request improvements, or check whether a problem is already tracked.
            </p>
          </div>

          <a
            href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
            target="_blank"
            rel="noreferrer"
            onmouseenter={() => (hoveredControl = 'github-issues')}
            onmouseleave={() => (hoveredControl = null)}
            style={`display: inline-flex; min-height: 36px; align-items: center; gap: 8px; border: 1px solid ${hoveredControl === 'github-issues' ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius: 8px; background: ${hoveredControl === 'github-issues' ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; padding: 0 12px; color: var(--ui-accent-normal-text); font-size: 13px; font-weight: 700; text-decoration: none; transition: background 140ms ease, border-color 140ms ease; white-space: nowrap;`}
          >
            <Bug size={14} />
            Open Github Issues
            <ExternalLink size={13} />
          </a>
        </section>

        <section
          role="group"
          onmouseenter={() => (hoveredCard = 'current-version')}
          onmouseleave={() => (hoveredCard = null)}
          style={`box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; border: 1px solid ${hoveredCard === 'current-version' ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'}; border-radius: 9px; background: ${hoveredCard === 'current-version' ? 'linear-gradient(135deg, oklch(1 0 0 / 13%), oklch(1 0 0 / 7%))' : 'linear-gradient(135deg, oklch(1 0 0 / 10%), oklch(1 0 0 / 5%))'}; padding: 14px; box-shadow: 0 12px 28px oklch(0 0 0 / 22%), inset 0 1px 0 oklch(1 0 0 / 10%); transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; transform: ${hoveredCard === 'current-version' ? 'translateY(-1px)' : 'translateY(0)'};`}
        >
          <div style="min-width: 0;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 680; letter-spacing: 0; line-height: 1.25;">
              Current Version
            </h3>
            <p style="margin: 4px 0 0; color: var(--ui-secondary-text); font-size: 12px; line-height: 1.45;">
              The version currently installed on this device.
            </p>
          </div>

          <p
            data-testid="about-version-value"
            style="margin: 0; border: 1px solid var(--ui-neutral-normal-border); border-radius: 999px; background: var(--ui-neutral-normal-surface); padding: 7px 12px; color: var(--ui-normal-text); font-size: 13px; font-weight: 700; box-shadow: inset 0 1px 0 oklch(1 0 0 / 8%);"
          >
            v0.7.12
          </p>
        </section>
      </div>
    </article>
  </div>
</section>
