<script lang="ts">
  import {
    Check,
    ChevronDown,
    Info,
    Minus,
    Plus,
    Settings,
    Sparkles,
    Timer,
    ToggleLeft,
    Wand2
  } from 'lucide-svelte'

  type StepperKey = 'autosave' | 'history' | 'preview'
  type ToggleKey = 'autosaveEnabled' | 'compactTree' | 'copyToast'

  const stepperValues = $state<Record<StepperKey, number>>({
    autosave: 750,
    history: 30,
    preview: 1200
  })

  const toggleValues = $state<Record<ToggleKey, boolean>>({
    autosaveEnabled: true,
    compactTree: false,
    copyToast: true
  })

  const hover = $state<Record<string, boolean>>({})
  const focus = $state<Record<string, boolean>>({})

  const setHover = (key: string, value: boolean) => {
    hover[key] = value
  }

  const setFocus = (key: string, value: boolean) => {
    focus[key] = value
  }

  const adjustStepper = (key: StepperKey, amount: number, min: number, max: number) => {
    stepperValues[key] = Math.min(max, Math.max(min, stepperValues[key] + amount))
  }

  const toggleSetting = (key: ToggleKey) => {
    toggleValues[key] = !toggleValues[key]
  }

  const stepperActionStyle = (key: string) => `
    width: 30px;
    height: 30px;
    border: 1px solid ${hover[key] || focus[key] ? 'var(--ui-neutral-interactive-hover-border)' : 'transparent'};
    border-radius: 6px;
    display: grid;
    place-items: center;
    color: ${hover[key] || focus[key] ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'};
    background: ${hover[key] || focus[key] ? 'var(--ui-neutral-hover-surface)' : 'transparent'};
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  `

  const toggleStyle = (key: ToggleKey) => {
    const enabled = toggleValues[key]
    const active = hover[key] || focus[key]
    return `
      width: 72px;
      height: 34px;
      border: 1px solid ${
        enabled
          ? active
            ? 'var(--ui-accent-hover-border)'
            : 'var(--ui-accent-normal-border)'
          : active
            ? 'var(--ui-neutral-interactive-hover-border)'
            : 'var(--ui-neutral-interactive-normal-border)'
      };
      border-radius: 7px;
      padding: 3px;
      display: flex;
      justify-content: ${enabled ? 'flex-end' : 'flex-start'};
      align-items: center;
      background: ${
        enabled
          ? active
            ? 'var(--ui-accent-subtle-hover-surface)'
            : 'var(--ui-accent-subtle-surface)'
          : active
            ? 'var(--ui-neutral-hover-surface)'
            : 'var(--ui-neutral-normal-surface)'
      };
      box-shadow: ${focus[key] ? '0 0 0 3px var(--ui-accent-icon-ring)' : 'none'};
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    `
  }

  const toggleThumbStyle = (key: ToggleKey) => {
    const enabled = toggleValues[key]
    return `
      width: 28px;
      height: 26px;
      border-radius: 5px;
      display: grid;
      place-items: center;
      color: ${enabled ? 'var(--ui-accent-icon-glyph)' : 'var(--ui-muted-icon-glyph)'};
      background: ${enabled ? 'var(--ui-accent-strong-surface)' : 'var(--ui-neutral-emphasis-surface)'};
      box-shadow: 0 8px 18px var(--ui-card-normal-shadow);
      transition: background 140ms ease, color 140ms ease;
    `
  }
</script>

<div
  style="
    min-height: 100%;
    padding: 34px;
    box-sizing: border-box;
    color: var(--ui-normal-text);
    font-family:
      Inter,
      Segoe UI,
      sans-serif;
  "
>
  <main style="max-width: 1060px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;">
    <header style="display: flex; align-items: center; justify-content: space-between; gap: 18px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div
          style="
            width: 38px;
            height: 38px;
            border: 1px solid var(--ui-neutral-normal-border);
            border-radius: 8px;
            display: grid;
            place-items: center;
            color: var(--ui-hoverable-icon-glyph);
            background: var(--ui-neutral-normal-surface);
          "
        >
          <Settings size={18} strokeWidth={1.9} />
        </div>
        <div>
          <h1 style="margin: 0; font-size: 25px; line-height: 1.1; font-weight: 650; letter-spacing: 0;">
            Settings
          </h1>
          <p style="margin: 5px 0 0; font-size: 13px; color: var(--ui-secondary-text);">
            Current workspace
          </p>
        </div>
      </div>
      <button
        type="button"
        style="
          height: 34px;
          border: 1px solid var(--ui-neutral-interactive-normal-border);
          border-radius: 7px;
          padding: 0 10px 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ui-hoverable-text);
          background: var(--ui-neutral-normal-surface);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        "
      >
        C:\Workspaces\Prompt Apps
        <ChevronDown size={15} strokeWidth={1.8} />
      </button>
    </header>

    <section style="display: grid; grid-template-columns: 1fr 310px; gap: 18px; align-items: start;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <article
          style="
            border: 1px solid var(--ui-card-normal-border);
            border-radius: 8px;
            background: linear-gradient(
              180deg,
              var(--ui-card-normal-surface-gradient-start),
              var(--ui-card-normal-surface-gradient-end)
            );
            box-shadow: 0 16px 38px var(--ui-card-normal-shadow);
            overflow: hidden;
          "
        >
          <div
            style="
              padding: 16px 18px;
              display: flex;
              justify-content: space-between;
              gap: 16px;
              border-bottom: 1px solid var(--ui-card-normal-border);
            "
          >
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 650; letter-spacing: 0;">Editor</h2>
              <p style="margin: 5px 0 0; font-size: 12px; color: var(--ui-muted-text);">
                Timing and layout preferences
              </p>
            </div>
            <div
              style="
                height: 26px;
                padding: 0 8px;
                border: 1px solid var(--ui-accent-blue-normal-border);
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                color: var(--ui-hoverable-text);
                background: var(--ui-accent-blue-normal-surface);
                font-size: 12px;
              "
            >
              <Timer size={13} strokeWidth={1.9} />
              Live
            </div>
          </div>

          <div style="padding: 6px;">
            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 232px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
                border-radius: 7px;
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Autosave delay
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Wait before saving prompt edits
                </div>
              </div>
              <div
                style="
                  height: 40px;
                  border: 1px solid var(--ui-neutral-normal-border);
                  border-radius: 8px;
                  padding: 4px;
                  display: grid;
                  grid-template-columns: 30px 1fr 30px;
                  align-items: center;
                  gap: 5px;
                  background: var(--ui-neutral-field-surface);
                "
              >
                <button
                  type="button"
                  aria-label="Decrease autosave delay"
                  style={stepperActionStyle('autosaveMinus')}
                  onmouseenter={() => setHover('autosaveMinus', true)}
                  onmouseleave={() => setHover('autosaveMinus', false)}
                  onfocus={() => setFocus('autosaveMinus', true)}
                  onblur={() => setFocus('autosaveMinus', false)}
                  onclick={() => adjustStepper('autosave', -50, 250, 2000)}
                >
                  <Minus size={15} strokeWidth={2} />
                </button>
                <div
                  style="
                    height: 30px;
                    border-inline: 1px solid var(--ui-neutral-muted-border);
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 4px;
                    color: var(--ui-normal-text);
                  "
                >
                  <span style="font-size: 17px; font-weight: 650; line-height: 30px;">
                    {stepperValues.autosave}
                  </span>
                  <span style="font-size: 11px; color: var(--ui-muted-text);">ms</span>
                </div>
                <button
                  type="button"
                  aria-label="Increase autosave delay"
                  style={stepperActionStyle('autosavePlus')}
                  onmouseenter={() => setHover('autosavePlus', true)}
                  onmouseleave={() => setHover('autosavePlus', false)}
                  onfocus={() => setFocus('autosavePlus', true)}
                  onblur={() => setFocus('autosavePlus', false)}
                  onclick={() => adjustStepper('autosave', 50, 250, 2000)}
                >
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 232px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
                border-top: 1px solid var(--ui-card-normal-border);
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Prompt history
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Saved revisions per prompt
                </div>
              </div>
              <div
                style="
                  height: 40px;
                  border: 1px solid var(--ui-neutral-interactive-normal-border);
                  border-radius: 8px;
                  padding: 0 5px;
                  display: grid;
                  grid-template-columns: 30px 1fr 30px;
                  align-items: center;
                  gap: 4px;
                  background: var(--ui-neutral-muted-surface);
                "
              >
                <button
                  type="button"
                  aria-label="Decrease prompt history"
                  style={stepperActionStyle('historyMinus')}
                  onmouseenter={() => setHover('historyMinus', true)}
                  onmouseleave={() => setHover('historyMinus', false)}
                  onfocus={() => setFocus('historyMinus', true)}
                  onblur={() => setFocus('historyMinus', false)}
                  onclick={() => adjustStepper('history', -5, 5, 100)}
                >
                  <Minus size={15} strokeWidth={2} />
                </button>
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <span style="font-size: 13px; color: var(--ui-secondary-text);">Keep</span>
                  <span
                    style="
                      min-width: 32px;
                      height: 26px;
                      border-radius: 6px;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      color: var(--ui-normal-text);
                      background: var(--ui-neutral-emphasis-surface);
                      font-size: 15px;
                      font-weight: 650;
                    "
                  >
                    {stepperValues.history}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Increase prompt history"
                  style={stepperActionStyle('historyPlus')}
                  onmouseenter={() => setHover('historyPlus', true)}
                  onmouseleave={() => setHover('historyPlus', false)}
                  onfocus={() => setFocus('historyPlus', true)}
                  onblur={() => setFocus('historyPlus', false)}
                  onclick={() => adjustStepper('history', 5, 5, 100)}
                >
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 232px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
                border-top: 1px solid var(--ui-card-normal-border);
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Preview throttle
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Markdown preview refresh interval
                </div>
              </div>
              <div
                style="
                  height: 42px;
                  border: 1px solid var(--ui-neutral-normal-border);
                  border-radius: 8px;
                  display: grid;
                  grid-template-columns: 36px 1fr 36px;
                  align-items: stretch;
                  background: var(--ui-card-inset-surface);
                  overflow: hidden;
                "
              >
                <button
                  type="button"
                  aria-label="Decrease preview throttle"
                  style={stepperActionStyle('previewMinus')}
                  onmouseenter={() => setHover('previewMinus', true)}
                  onmouseleave={() => setHover('previewMinus', false)}
                  onfocus={() => setFocus('previewMinus', true)}
                  onblur={() => setFocus('previewMinus', false)}
                  onclick={() => adjustStepper('preview', -100, 300, 3000)}
                >
                  <Minus size={15} strokeWidth={2} />
                </button>
                <div
                  style="
                    display: grid;
                    grid-template-columns: 1fr auto;
                    align-items: center;
                    gap: 8px;
                    padding: 0 10px;
                    background: linear-gradient(90deg, var(--ui-neutral-muted-surface), var(--ui-neutral-normal-surface));
                  "
                >
                  <div
                    style="
                      height: 3px;
                      border-radius: 999px;
                      background: linear-gradient(
                        90deg,
                        var(--ui-accent-strong-surface) 0%,
                        var(--ui-accent-strong-surface) 42%,
                        var(--ui-neutral-emphasis-surface) 42%,
                        var(--ui-neutral-emphasis-surface) 100%
                      );
                    "
                  ></div>
                  <div style="font-size: 14px; font-weight: 650; color: var(--ui-normal-text);">
                    {stepperValues.preview}<span style="font-size: 11px; color: var(--ui-muted-text);"> ms</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Increase preview throttle"
                  style={stepperActionStyle('previewPlus')}
                  onmouseenter={() => setHover('previewPlus', true)}
                  onmouseleave={() => setHover('previewPlus', false)}
                  onfocus={() => setFocus('previewPlus', true)}
                  onblur={() => setFocus('previewPlus', false)}
                  onclick={() => adjustStepper('preview', 100, 300, 3000)}
                >
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </article>

        <article
          style="
            border: 1px solid var(--ui-card-normal-border);
            border-radius: 8px;
            background: linear-gradient(
              180deg,
              var(--ui-card-normal-surface-gradient-start),
              var(--ui-card-normal-surface-gradient-end)
            );
            overflow: hidden;
          "
        >
          <div
            style="
              padding: 16px 18px;
              display: flex;
              justify-content: space-between;
              gap: 16px;
              border-bottom: 1px solid var(--ui-card-normal-border);
            "
          >
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 650; letter-spacing: 0;">Behavior</h2>
              <p style="margin: 5px 0 0; font-size: 12px; color: var(--ui-muted-text);">
                Workspace defaults
              </p>
            </div>
            <ToggleLeft size={20} strokeWidth={1.8} style="color: var(--ui-secondary-icon-glyph);" />
          </div>

          <div style="padding: 6px;">
            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 90px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Autosave prompts
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Save editor changes automatically
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle autosave prompts"
                aria-pressed={toggleValues.autosaveEnabled}
                style={toggleStyle('autosaveEnabled')}
                onmouseenter={() => setHover('autosaveEnabled', true)}
                onmouseleave={() => setHover('autosaveEnabled', false)}
                onfocus={() => setFocus('autosaveEnabled', true)}
                onblur={() => setFocus('autosaveEnabled', false)}
                onclick={() => toggleSetting('autosaveEnabled')}
              >
                <span style={toggleThumbStyle('autosaveEnabled')}>
                  {#if toggleValues.autosaveEnabled}
                    <Check size={15} strokeWidth={2.2} />
                  {/if}
                </span>
              </button>
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 90px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
                border-top: 1px solid var(--ui-card-normal-border);
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Compact prompt tree
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Reduce folder and prompt row spacing
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle compact prompt tree"
                aria-pressed={toggleValues.compactTree}
                style={toggleStyle('compactTree')}
                onmouseenter={() => setHover('compactTree', true)}
                onmouseleave={() => setHover('compactTree', false)}
                onfocus={() => setFocus('compactTree', true)}
                onblur={() => setFocus('compactTree', false)}
                onclick={() => toggleSetting('compactTree')}
              >
                <span style={toggleThumbStyle('compactTree')}>
                  {#if toggleValues.compactTree}
                    <Check size={15} strokeWidth={2.2} />
                  {/if}
                </span>
              </button>
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: minmax(210px, 1fr) 90px;
                gap: 18px;
                align-items: center;
                padding: 14px 12px;
                border-top: 1px solid var(--ui-card-normal-border);
              "
            >
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--ui-hoverable-text);">
                  Copy confirmation
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: var(--ui-muted-text);">
                  Show a small status after copying
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle copy confirmation"
                aria-pressed={toggleValues.copyToast}
                style={toggleStyle('copyToast')}
                onmouseenter={() => setHover('copyToast', true)}
                onmouseleave={() => setHover('copyToast', false)}
                onfocus={() => setFocus('copyToast', true)}
                onblur={() => setFocus('copyToast', false)}
                onclick={() => toggleSetting('copyToast')}
              >
                <span style={toggleThumbStyle('copyToast')}>
                  {#if toggleValues.copyToast}
                    <Check size={15} strokeWidth={2.2} />
                  {/if}
                </span>
              </button>
            </div>
          </div>
        </article>
      </div>

      <aside style="display: flex; flex-direction: column; gap: 12px;">
        <article
          style="
            border: 1px solid var(--ui-card-normal-border);
            border-radius: 8px;
            padding: 16px;
            background: linear-gradient(
              180deg,
              var(--ui-neutral-normal-surface),
              var(--ui-neutral-muted-surface)
            );
            box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
          "
        >
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div
              style="
                width: 34px;
                height: 34px;
                border: 1px solid var(--ui-accent-green-normal-border);
                border-radius: 8px;
                display: grid;
                place-items: center;
                color: var(--ui-accent-green-icon-glyph);
                background: var(--ui-accent-green-normal-surface);
              "
            >
              <Sparkles size={17} strokeWidth={1.9} />
            </div>
            <div style="font-size: 12px; color: var(--ui-muted-text);">Version 0.17.4</div>
          </div>
          <h2 style="margin: 15px 0 0; font-size: 16px; font-weight: 650; letter-spacing: 0;">
            Cthulhu Prompt
          </h2>
          <p style="margin: 7px 0 0; font-size: 12px; line-height: 1.5; color: var(--ui-secondary-text);">
            Store, format, organize, and copy prompts from one focused workspace.
          </p>
          <div
            style="
              margin-top: 14px;
              border: 1px solid var(--ui-neutral-muted-border);
              border-radius: 7px;
              padding: 10px;
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 9px;
              color: var(--ui-secondary-text);
              background: var(--ui-card-inset-surface);
              font-size: 12px;
              line-height: 1.45;
            "
          >
            <Info size={15} strokeWidth={1.9} style="margin-top: 1px; color: var(--ui-secondary-icon-glyph);" />
            <span>Workspace backups are stored locally in C:\Workspaces\Prompt Apps\.cthulhu</span>
          </div>
        </article>

        <article
          style="
            border: 1px solid var(--ui-card-normal-border);
            border-radius: 8px;
            padding: 14px;
            background: var(--ui-neutral-muted-surface);
          "
        >
          <div style="display: flex; align-items: center; gap: 9px; color: var(--ui-hoverable-text);">
            <Wand2 size={16} strokeWidth={1.9} />
            <h2 style="margin: 0; font-size: 14px; font-weight: 650; letter-spacing: 0;">Defaults</h2>
          </div>
          <div style="margin-top: 13px; display: grid; gap: 8px;">
            <div
              style="
                border: 1px solid var(--ui-neutral-muted-border);
                border-radius: 7px;
                padding: 9px 10px;
                display: flex;
                justify-content: space-between;
                gap: 10px;
                background: var(--ui-card-inset-surface);
                font-size: 12px;
              "
            >
              <span style="color: var(--ui-muted-text);">Format</span>
              <span style="color: var(--ui-hoverable-text);">Markdown</span>
            </div>
            <div
              style="
                border: 1px solid var(--ui-neutral-muted-border);
                border-radius: 7px;
                padding: 9px 10px;
                display: flex;
                justify-content: space-between;
                gap: 10px;
                background: var(--ui-card-inset-surface);
                font-size: 12px;
              "
            >
              <span style="color: var(--ui-muted-text);">Export target</span>
              <span style="color: var(--ui-hoverable-text);">Codex CLI</span>
            </div>
          </div>
        </article>
      </aside>
    </section>
  </main>
</div>
