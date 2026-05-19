<script lang="ts">
  import type { ComponentType } from 'svelte'
  import {
    Bug,
    Check,
    ExternalLink,
    Hash,
    Info,
    Keyboard,
    RefreshCcw,
    Settings,
    Type,
    WrapText
  } from 'lucide-svelte'

  type SettingRow = {
    id: string
    title: string
    description: string
    icon: ComponentType
    kind: 'number' | 'toggle' | 'link' | 'version'
    value?: string
    defaultValue?: string
    actionLabel?: string
    href?: string
  }

  let fontSizeInput = $state('15')
  let minLinesInput = $state('8')
  let showLineNumbers = $state(true)
  let hoveredRowId = $state<string | null>(null)
  let hoveredButtonId = $state<string | null>(null)
  let focusedInputId = $state<string | null>(null)

  const editorRows: SettingRow[] = [
    {
      id: 'font-size',
      title: 'Font Size',
      description: 'Sets the base font size used inside the prompt editor.',
      icon: Type,
      kind: 'number',
      defaultValue: '14'
    },
    {
      id: 'minimum-lines',
      title: 'Minimum Line Count',
      description: 'Sets the minimum number of visible lines in prompt editors.',
      icon: WrapText,
      kind: 'number',
      defaultValue: '5'
    },
    {
      id: 'line-numbers',
      title: 'Show Line Numbers',
      description: 'Display line numbers beside prompt text for easier review.',
      icon: Hash,
      kind: 'toggle'
    }
  ]

  const aboutRows: SettingRow[] = [
    {
      id: 'github-issues',
      title: 'Report an Issue',
      description:
        'Report bugs, request improvements, or check whether a problem is already tracked.',
      icon: Bug,
      kind: 'link',
      actionLabel: 'Open Github Issues',
      href: 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
    },
    {
      id: 'current-version',
      title: 'Current Version',
      description: 'The version currently installed on this device.',
      icon: Info,
      kind: 'version',
      value: 'v0.0.20'
    }
  ]

  const pageStyle =
    'box-sizing:border-box;display:flex;min-height:0;flex:1;justify-content:center;overflow-y:auto;padding:24px;color:var(--ui-normal-text);'

  const contentStyle =
    'box-sizing:border-box;width:100%;max-width:960px;display:grid;gap:20px;align-content:start;'

  const headerStyle =
    'box-sizing:border-box;display:grid;gap:7px;border-left:3px solid var(--ui-accent-normal-border);padding-left:16px;'

  const titleRowStyle =
    'box-sizing:border-box;display:flex;align-items:center;gap:10px;min-width:0;'

  const iconTileStyle = (tone: 'accent' | 'neutral' | 'success') => {
    const tones = {
      accent:
        'background:linear-gradient(135deg,var(--ui-accent-normal-fill),var(--ui-accent-normal-surface));border-color:var(--ui-accent-normal-border);color:var(--ui-accent-icon-glyph);box-shadow:0 8px 22px var(--ui-accent-icon-ring),inset 0 1px 0 oklch(1 0 0 / 14%);',
      neutral:
        'background:linear-gradient(135deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface));border-color:var(--ui-neutral-normal-border);color:var(--ui-secondary-text);box-shadow:inset 0 1px 0 oklch(1 0 0 / 10%);',
      success:
        'background:linear-gradient(135deg,var(--ui-success-normal-surface),var(--ui-neutral-muted-surface));border-color:var(--ui-success-normal-border);color:var(--ui-success-normal-text);box-shadow:0 8px 22px oklch(0.627 0.17 149.214 / 12%),inset 0 1px 0 oklch(1 0 0 / 12%);'
    }

    return `box-sizing:border-box;display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border:1px solid;border-radius:8px;flex:0 0 auto;${tones[tone]}`
  }

  const panelStyle =
    'box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 18px 45px var(--ui-card-normal-shadow);padding:12px;display:grid;gap:12px;'

  const panelTitleStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;min-width:0;padding:2px 2px 4px;'

  const panelTitleTextStyle =
    'margin:0;color:var(--ui-normal-text);font-size:17px;font-weight:760;line-height:24px;'

  const panelDescriptionStyle =
    'margin:2px 0 0;color:var(--ui-muted-text);font-size:13px;line-height:19px;'

  const rowStyle = (rowId: string) => {
    const isHovered = hoveredRowId === rowId
    return `box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px;align-items:center;min-width:0;border:1px solid ${isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)'};border-radius:8px;background:${isHovered ? 'linear-gradient(180deg,var(--ui-neutral-hover-surface),var(--ui-neutral-normal-surface))' : 'linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface))'};box-shadow:${isHovered ? '0 16px 34px var(--ui-shadow-raised),inset 0 1px 0 oklch(1 0 0 / 13%)' : '0 10px 22px oklch(0 0 0 / 16%),inset 0 1px 0 oklch(1 0 0 / 9%)'};padding:12px;transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;transform:${isHovered ? 'translateY(-1px)' : 'translateY(0)'};`
  }

  const rowCopyStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;align-items:center;min-width:0;'

  const rowTitleStyle =
    'margin:0;color:var(--ui-normal-text);font-size:14px;font-weight:720;line-height:20px;'

  const rowDescriptionStyle =
    'margin:2px 0 0;color:var(--ui-muted-text);font-size:12px;line-height:18px;'

  const controlsStyle =
    'box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;min-width:0;'

  const inputStyle = (inputId: string) => {
    const isFocused = focusedInputId === inputId
    return `box-sizing:border-box;width:78px;height:34px;border:1px solid ${isFocused ? 'var(--ui-neutral-focus-border)' : 'var(--ui-neutral-normal-border)'};border-radius:7px;background:${isFocused ? 'linear-gradient(180deg,var(--ui-neutral-field-surface),oklch(0.242 0.012 268.2))' : 'var(--ui-neutral-field-surface)'};box-shadow:${isFocused ? '0 0 0 3px var(--ui-accent-icon-ring),inset 0 1px 0 oklch(1 0 0 / 9%)' : 'inset 0 1px 2px var(--ui-shadow-inset),inset 0 1px 0 oklch(1 0 0 / 7%)'};color:var(--ui-normal-text);font:600 13px/18px inherit;outline:none;padding:0 10px;text-align:right;transition:border-color 140ms ease,box-shadow 140ms ease,background 140ms ease;`
  }

  const buttonStyle = (
    buttonId: string,
    variant: 'neutral' | 'accent' | 'disabled' = 'neutral'
  ) => {
    const isHovered = hoveredButtonId === buttonId && variant !== 'disabled'
    const variants = {
      neutral: {
        background: isHovered
          ? 'linear-gradient(180deg,var(--ui-neutral-hover-surface),var(--ui-neutral-normal-surface))'
          : 'linear-gradient(180deg,var(--ui-neutral-normal-surface),var(--ui-neutral-muted-surface))',
        border: isHovered ? 'var(--ui-neutral-hover-border)' : 'var(--ui-neutral-normal-border)',
        color: 'var(--ui-hoverable-text)',
        cursor: 'pointer'
      },
      accent: {
        background: isHovered
          ? 'linear-gradient(180deg,var(--ui-accent-hover-surface),var(--ui-accent-normal-surface))'
          : 'linear-gradient(180deg,var(--ui-accent-normal-fill),var(--ui-accent-normal-surface))',
        border: isHovered ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)',
        color: 'var(--ui-accent-normal-text)',
        cursor: 'pointer'
      },
      disabled: {
        background: 'var(--ui-neutral-muted-surface)',
        border: 'var(--ui-neutral-muted-border)',
        color: 'var(--ui-muted-text)',
        cursor: 'default'
      }
    }
    const selected = variants[variant]

    return `box-sizing:border-box;height:34px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid ${selected.border};border-radius:7px;background:${selected.background};box-shadow:${isHovered ? '0 10px 22px var(--ui-shadow-raised),inset 0 1px 0 oklch(1 0 0 / 13%)' : 'inset 0 1px 0 oklch(1 0 0 / 9%)'};color:${selected.color};cursor:${selected.cursor};font:700 12px/16px inherit;min-width:82px;padding:0 11px;text-decoration:none;transition:border-color 140ms ease,background 140ms ease,box-shadow 140ms ease,transform 140ms ease;transform:${isHovered ? 'translateY(-1px)' : 'translateY(0)'};white-space:nowrap;`
  }

  const toggleStyle = (enabled: boolean) =>
    `box-sizing:border-box;position:relative;width:56px;height:30px;border:1px solid ${enabled ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-normal-border)'};border-radius:999px;background:${enabled ? 'linear-gradient(90deg,var(--ui-accent-normal-fill),var(--ui-accent-normal-surface))' : 'var(--ui-neutral-muted-surface)'};box-shadow:inset 0 1px 3px var(--ui-shadow-inset),inset 0 1px 0 oklch(1 0 0 / 9%);cursor:pointer;transition:border-color 140ms ease,background 140ms ease;`

  const toggleKnobStyle = (enabled: boolean) =>
    `box-sizing:border-box;position:absolute;top:4px;left:${enabled ? '29px' : '5px'};width:20px;height:20px;border-radius:999px;background:${enabled ? 'var(--ui-accent-icon-glyph)' : 'var(--ui-secondary-text)'};box-shadow:0 6px 16px var(--ui-shadow-raised);transition:left 140ms ease,background 140ms ease;`

  const badgeStyle =
    'box-sizing:border-box;display:inline-flex;height:34px;align-items:center;gap:7px;border:1px solid var(--ui-success-normal-border);border-radius:7px;background:linear-gradient(180deg,var(--ui-success-normal-surface),var(--ui-neutral-muted-surface));box-shadow:inset 0 1px 0 oklch(1 0 0 / 11%);color:var(--ui-success-normal-text);font-size:13px;font-weight:760;line-height:18px;padding:0 12px;white-space:nowrap;'

  const getNumberValue = (rowId: string) => (rowId === 'font-size' ? fontSizeInput : minLinesInput)

  const setNumberValue = (rowId: string, value: string) => {
    if (rowId === 'font-size') {
      fontSizeInput = value
      return
    }

    minLinesInput = value
  }

  const resetNumberValue = (rowId: string, defaultValue: string) => {
    setNumberValue(rowId, defaultValue)
  }

  const isResetDisabled = (row: SettingRow) =>
    row.kind === 'number' && row.defaultValue === getNumberValue(row.id)

  const resetShowLineNumbers = () => {
    showLineNumbers = true
  }
</script>

<section style={pageStyle} data-testid="settings-screen">
  <div style={contentStyle}>
    <div style={headerStyle}>
      <div style={titleRowStyle}>
        <span style={iconTileStyle('accent')}>
          <Settings size={17} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 style="margin:0;color:var(--ui-normal-text);font-size:24px;font-weight:760;line-height:32px;">
          System Settings
        </h1>
      </div>
      <p style="margin:0;color:var(--ui-muted-text);font-size:14px;line-height:20px;">
        Global settings saved on your local machine.
      </p>
    </div>

    <div style={panelStyle}>
      <div style={panelTitleStyle}>
        <span style={iconTileStyle('accent')}>
          <Keyboard size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div style="min-width:0;">
          <h2 style={panelTitleTextStyle}>Editor &amp; layout</h2>
          <p style={panelDescriptionStyle}>
            Typography, spacing, autosave, and core writing ergonomics.
          </p>
        </div>
      </div>

      {#each editorRows as row (row.id)}
        {@const RowIcon = row.icon}
        <article
          style={rowStyle(row.id)}
          onmouseenter={() => {
            hoveredRowId = row.id
          }}
          onmouseleave={() => {
            hoveredRowId = null
          }}
        >
          <div style={rowCopyStyle}>
            <span style={iconTileStyle(row.kind === 'toggle' && showLineNumbers ? 'success' : 'neutral')}>
              <RowIcon size={16} strokeWidth={2.35} aria-hidden="true" />
            </span>
            <div style="min-width:0;">
              <h3 style={rowTitleStyle}>{row.title}</h3>
              <p style={rowDescriptionStyle}>{row.description}</p>
            </div>
          </div>

          <div style={controlsStyle}>
            {#if row.kind === 'number' && row.defaultValue}
              <input
                data-testid={row.id === 'font-size' ? 'font-size-input' : 'min-lines-input'}
                aria-label={row.title}
                inputmode="numeric"
                value={getNumberValue(row.id)}
                style={inputStyle(row.id)}
                oninput={(event) => setNumberValue(row.id, event.currentTarget.value)}
                onfocus={() => {
                  focusedInputId = row.id
                }}
                onblur={() => {
                  focusedInputId = null
                }}
              />
              <button
                type="button"
                disabled={isResetDisabled(row)}
                style={buttonStyle(
                  `${row.id}-reset`,
                  isResetDisabled(row) ? 'disabled' : 'neutral'
                )}
                onmouseenter={() => {
                  hoveredButtonId = `${row.id}-reset`
                }}
                onmouseleave={() => {
                  hoveredButtonId = null
                }}
                onclick={() => resetNumberValue(row.id, row.defaultValue ?? '')}
              >
                <RefreshCcw size={14} strokeWidth={2.4} aria-hidden="true" />
                Reset
              </button>
            {:else if row.kind === 'toggle'}
              <button
                type="button"
                aria-label="Toggle Show Line Numbers"
                aria-pressed={showLineNumbers}
                data-testid="show-line-numbers-toggle"
                style={toggleStyle(showLineNumbers)}
                onclick={() => {
                  showLineNumbers = !showLineNumbers
                }}
              >
                <span style={toggleKnobStyle(showLineNumbers)}></span>
              </button>
              <button
                type="button"
                disabled={showLineNumbers}
                style={buttonStyle('line-numbers-reset', showLineNumbers ? 'disabled' : 'neutral')}
                onmouseenter={() => {
                  hoveredButtonId = 'line-numbers-reset'
                }}
                onmouseleave={() => {
                  hoveredButtonId = null
                }}
                onclick={resetShowLineNumbers}
              >
                <RefreshCcw size={14} strokeWidth={2.4} aria-hidden="true" />
                Reset
              </button>
            {/if}
          </div>
        </article>
      {/each}
    </div>

    <div style={panelStyle}>
      <div style={panelTitleStyle}>
        <span style={iconTileStyle('neutral')}>
          <Info size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div style="min-width:0;">
          <h2 style={panelTitleTextStyle}>About</h2>
          <p style={panelDescriptionStyle}>Build and release details for this desktop app.</p>
        </div>
      </div>

      {#each aboutRows as row (row.id)}
        {@const RowIcon = row.icon}
        <article
          style={rowStyle(row.id)}
          onmouseenter={() => {
            hoveredRowId = row.id
          }}
          onmouseleave={() => {
            hoveredRowId = null
          }}
        >
          <div style={rowCopyStyle}>
            <span style={iconTileStyle(row.kind === 'version' ? 'success' : 'neutral')}>
              <RowIcon size={16} strokeWidth={2.35} aria-hidden="true" />
            </span>
            <div style="min-width:0;">
              <h3 style={rowTitleStyle}>{row.title}</h3>
              <p style={rowDescriptionStyle}>{row.description}</p>
            </div>
          </div>

          <div style={controlsStyle}>
            {#if row.kind === 'link' && row.href}
              <a
                href={row.href}
                target="_blank"
                rel="noreferrer"
                style={buttonStyle(`${row.id}-action`, 'accent')}
                data-testid="about-github-issues-button"
                onmouseenter={() => {
                  hoveredButtonId = `${row.id}-action`
                }}
                onmouseleave={() => {
                  hoveredButtonId = null
                }}
              >
                <Bug size={14} strokeWidth={2.4} aria-hidden="true" />
                {row.actionLabel}
                <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
              </a>
            {:else if row.kind === 'version' && row.value}
              <span style={badgeStyle} data-testid="about-version-value">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                {row.value}
              </span>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>
