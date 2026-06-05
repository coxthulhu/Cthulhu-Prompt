<script lang="ts">
  import { Check, ChevronDown, Minus, Plus, Power, SlidersHorizontal } from 'lucide-svelte'

  let contextTokens = $state(32000)
  let outputTokens = $state(4096)
  let autoSaveSeconds = $state(12)
  let promptIndexingEnabled = $state(true)
  let compactFoldersEnabled = $state(false)
  let hoverTarget = $state<string | null>(null)
  let focusTarget = $state<string | null>(null)

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  function stepValue(field: 'context' | 'output' | 'autosave', direction: -1 | 1) {
    if (field === 'context') {
      contextTokens = clamp(contextTokens + direction * 1000, 4000, 128000)
      return
    }

    if (field === 'output') {
      outputTokens = clamp(outputTokens + direction * 256, 512, 16000)
      return
    }

    autoSaveSeconds = clamp(autoSaveSeconds + direction, 3, 60)
  }

  function inputValue(field: 'context' | 'output' | 'autosave', value: string) {
    const parsed = Number.parseInt(value, 10)

    if (Number.isNaN(parsed)) {
      return
    }

    if (field === 'context') {
      contextTokens = clamp(parsed, 4000, 128000)
      return
    }

    if (field === 'output') {
      outputTokens = clamp(parsed, 512, 16000)
      return
    }

    autoSaveSeconds = clamp(parsed, 3, 60)
  }

  const shellStyle =
    'box-sizing:border-box;width:100%;min-height:100%;padding:28px;color:var(--ui-normal-text);font-family:Inter,Segoe UI,Arial,sans-serif;'

  const pageStyle =
    'box-sizing:border-box;width:min(1120px,100%);margin:0 auto;display:flex;flex-direction:column;gap:18px;'

  const topBarStyle =
    'box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:2px 0 10px;'

  const titleBlockStyle = 'box-sizing:border-box;display:flex;flex-direction:column;gap:6px;min-width:0;'

  const h1Style =
    'margin:0;color:var(--ui-normal-text);font-size:24px;line-height:1.16;font-weight:650;letter-spacing:0;'

  const subtitleStyle =
    'margin:0;color:var(--ui-secondary-text);font-size:13px;line-height:1.45;font-weight:450;letter-spacing:0;'

  const selectStyle =
    'box-sizing:border-box;display:flex;align-items:center;gap:10px;min-width:230px;height:38px;padding:0 12px;border:1px solid var(--ui-card-normal-border);border-radius:7px;background:var(--ui-card-solid-surface);color:var(--ui-normal-text);font-size:13px;font-weight:520;box-shadow:0 1px 0 rgba(255,255,255,.04) inset;'

  const gridStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1.28fr) minmax(300px,.72fr);gap:18px;align-items:start;'

  const panelStyle =
    'box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:8px;background:var(--ui-card-solid-surface);box-shadow:0 1px 1px rgba(0,0,0,.04);overflow:hidden;'

  const sectionHeaderStyle =
    'box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--ui-card-normal-border);'

  const sectionTitleStyle =
    'margin:0;color:var(--ui-normal-text);font-size:14px;line-height:1.2;font-weight:650;letter-spacing:0;'

  const sectionMetaStyle =
    'color:var(--ui-muted-text);font-size:12px;line-height:1.2;font-weight:520;white-space:nowrap;'

  const rowsStyle = 'box-sizing:border-box;display:flex;flex-direction:column;'

  const rowStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(220px,1fr) minmax(252px,320px);gap:22px;align-items:center;padding:18px;border-bottom:1px solid var(--ui-card-normal-border);'

  const lastRowStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:minmax(220px,1fr) minmax(252px,320px);gap:22px;align-items:center;padding:18px;'

  const labelStackStyle = 'box-sizing:border-box;display:flex;flex-direction:column;gap:5px;min-width:0;'

  const labelStyle =
    'color:var(--ui-normal-text);font-size:13px;line-height:1.3;font-weight:620;letter-spacing:0;'

  const helperStyle =
    'color:var(--ui-secondary-text);font-size:12px;line-height:1.45;font-weight:430;letter-spacing:0;'

  const sidePanelStyle =
    'box-sizing:border-box;display:flex;flex-direction:column;gap:18px;position:sticky;top:22px;'

  const aboutStyle =
    'box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:8px;background:linear-gradient(180deg,var(--ui-card-solid-surface),var(--ui-neutral-muted-surface));box-shadow:0 1px 1px rgba(0,0,0,.04);overflow:hidden;'

  const aboutHeaderStyle =
    'box-sizing:border-box;padding:18px;border-bottom:1px solid var(--ui-card-normal-border);display:flex;align-items:center;gap:12px;'

  const iconTileStyle =
    'box-sizing:border-box;width:36px;height:36px;border-radius:8px;border:1px solid color-mix(in srgb,var(--ui-accent-strong-text) 36%,var(--ui-card-normal-border));background:color-mix(in srgb,var(--ui-accent-strong-text) 12%,var(--ui-card-solid-surface));display:flex;align-items:center;justify-content:center;color:var(--ui-accent-strong-text);flex:0 0 auto;'

  const aboutBodyStyle =
    'box-sizing:border-box;padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;'

  const metricGridStyle =
    'box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;gap:10px;'

  const metricStyle =
    'box-sizing:border-box;border:1px solid var(--ui-card-normal-border);border-radius:7px;background:var(--ui-card-solid-surface);padding:11px 12px;display:flex;flex-direction:column;gap:4px;'

  const metricLabelStyle =
    'color:var(--ui-muted-text);font-size:11px;line-height:1.2;font-weight:600;text-transform:uppercase;letter-spacing:.04em;'

  const metricValueStyle =
    'color:var(--ui-normal-text);font-size:15px;line-height:1.2;font-weight:680;letter-spacing:0;'

  function stepperStyle(id: string) {
    const active = hoverTarget === id || focusTarget === id
    return `box-sizing:border-box;display:grid;grid-template-columns:38px minmax(96px,1fr) 38px;align-items:center;height:42px;border:1px solid ${
      active
        ? 'color-mix(in srgb,var(--ui-accent-strong-text) 58%,var(--ui-card-normal-border))'
        : 'var(--ui-card-normal-border)'
    };border-radius:8px;background:${
      active
        ? 'color-mix(in srgb,var(--ui-accent-strong-text) 6%,var(--ui-card-solid-surface))'
        : 'var(--ui-neutral-muted-surface)'
    };box-shadow:${active ? '0 0 0 3px color-mix(in srgb,var(--ui-accent-strong-text) 12%,transparent)' : 'none'};overflow:hidden;transition:border-color .14s ease,background .14s ease,box-shadow .14s ease;`
  }

  function stepButtonStyle(id: string) {
    const active = hoverTarget === id
    return `box-sizing:border-box;width:38px;height:40px;border:0;background:${
      active
        ? 'color-mix(in srgb,var(--ui-accent-strong-text) 14%,var(--ui-card-solid-surface))'
        : 'transparent'
    };color:${active ? 'var(--ui-accent-strong-text)' : 'var(--ui-secondary-text)'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s ease,color .14s ease;`
  }

  const numberInputStyle =
    'box-sizing:border-box;width:100%;height:40px;border:0;border-left:1px solid var(--ui-card-normal-border);border-right:1px solid var(--ui-card-normal-border);background:transparent;color:var(--ui-normal-text);font-size:14px;font-weight:650;text-align:center;outline:none;font-variant-numeric:tabular-nums;'

  function toggleStyle(enabled: boolean, id: string) {
    const active = hoverTarget === id || focusTarget === id
    return `box-sizing:border-box;width:100%;height:42px;border:1px solid ${
      enabled
        ? 'color-mix(in srgb,var(--ui-success-normal-text) 54%,var(--ui-card-normal-border))'
        : active
          ? 'color-mix(in srgb,var(--ui-accent-strong-text) 42%,var(--ui-card-normal-border))'
          : 'var(--ui-card-normal-border)'
    };border-radius:8px;background:${
      enabled
        ? active
          ? 'color-mix(in srgb,var(--ui-success-normal-text) 16%,var(--ui-card-solid-surface))'
          : 'color-mix(in srgb,var(--ui-success-normal-text) 10%,var(--ui-card-solid-surface))'
        : active
          ? 'color-mix(in srgb,var(--ui-accent-strong-text) 7%,var(--ui-card-solid-surface))'
          : 'var(--ui-neutral-muted-surface)'
    };color:var(--ui-normal-text);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 9px 0 14px;cursor:pointer;box-shadow:${
      active ? '0 0 0 3px color-mix(in srgb,var(--ui-accent-strong-text) 10%,transparent)' : 'none'
    };transition:border-color .14s ease,background .14s ease,box-shadow .14s ease;`
  }

  function toggleKnobStyle(enabled: boolean) {
    return `box-sizing:border-box;width:50px;height:28px;border-radius:999px;padding:3px;background:${
      enabled ? 'var(--ui-success-normal-text)' : 'var(--ui-neutral-emphasis-surface)'
    };display:flex;align-items:center;justify-content:${enabled ? 'flex-end' : 'flex-start'};transition:background .14s ease;`
  }

  const toggleDotStyle =
    'box-sizing:border-box;width:22px;height:22px;border-radius:999px;background:var(--ui-card-solid-surface);box-shadow:0 1px 3px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;color:var(--ui-success-normal-text);'

  const statusTextStyle =
    'box-sizing:border-box;display:flex;align-items:center;gap:8px;font-size:13px;line-height:1.2;font-weight:650;letter-spacing:0;'

  const footerActionStyle =
    'box-sizing:border-box;height:38px;border:1px solid var(--ui-card-normal-border);border-radius:7px;background:var(--ui-card-solid-surface);color:var(--ui-normal-text);padding:0 13px;font-size:13px;font-weight:610;cursor:pointer;'
</script>

<div style={shellStyle}>
  <div style={pageStyle}>
    <header style={topBarStyle}>
      <div style={titleBlockStyle}>
        <h1 style={h1Style}>Settings</h1>
        <p style={subtitleStyle}>Current workspace preferences</p>
      </div>

      <button
        type="button"
        style={`${selectStyle}${hoverTarget === 'workspace-select' ? 'border-color:color-mix(in srgb,var(--ui-accent-strong-text) 48%,var(--ui-card-normal-border));background:color-mix(in srgb,var(--ui-accent-strong-text) 5%,var(--ui-card-solid-surface));' : ''}`}
        onpointerenter={() => (hoverTarget = 'workspace-select')}
        onpointerleave={() => (hoverTarget = null)}
      >
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Cthulhu Prompt Public</span>
        <ChevronDown size={16} strokeWidth={2} style="flex:0 0 auto;color:var(--ui-muted-text);" />
      </button>
    </header>

    <main style={gridStyle}>
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div style="box-sizing:border-box;display:flex;align-items:center;gap:10px;min-width:0;">
            <SlidersHorizontal size={16} strokeWidth={2} style="color:var(--ui-accent-strong-text);" />
            <h2 style={sectionTitleStyle}>Input controls</h2>
          </div>
          <span style={sectionMetaStyle}>Workspace</span>
        </div>

        <div style={rowsStyle}>
          <div style={rowStyle}>
            <div style={labelStackStyle}>
              <div style={labelStyle}>Model context tokens</div>
              <div style={helperStyle}>Maximum tokens available for prompt assembly.</div>
            </div>

            <div
              role="group"
              aria-label="Model context tokens"
              style={stepperStyle('context')}
              onpointerenter={() => (hoverTarget = 'context')}
              onpointerleave={() => (hoverTarget = null)}
              onfocusin={() => (focusTarget = 'context')}
              onfocusout={() => (focusTarget = null)}
            >
              <button
                type="button"
                aria-label="Decrease model context tokens"
                style={stepButtonStyle('context-minus')}
                onpointerenter={() => (hoverTarget = 'context-minus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('context', -1)}
              >
                <Minus size={16} strokeWidth={2.25} />
              </button>
              <input
                aria-label="Model context tokens"
                type="number"
                min="4000"
                max="128000"
                step="1000"
                value={contextTokens}
                style={numberInputStyle}
                oninput={(event) => inputValue('context', event.currentTarget.value)}
              />
              <button
                type="button"
                aria-label="Increase model context tokens"
                style={stepButtonStyle('context-plus')}
                onpointerenter={() => (hoverTarget = 'context-plus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('context', 1)}
              >
                <Plus size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStackStyle}>
              <div style={labelStyle}>Default max output</div>
              <div style={helperStyle}>Initial output token limit for copied prompt profiles.</div>
            </div>

            <div
              role="group"
              aria-label="Default max output"
              style={stepperStyle('output')}
              onpointerenter={() => (hoverTarget = 'output')}
              onpointerleave={() => (hoverTarget = null)}
              onfocusin={() => (focusTarget = 'output')}
              onfocusout={() => (focusTarget = null)}
            >
              <button
                type="button"
                aria-label="Decrease default max output"
                style={stepButtonStyle('output-minus')}
                onpointerenter={() => (hoverTarget = 'output-minus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('output', -1)}
              >
                <Minus size={16} strokeWidth={2.25} />
              </button>
              <input
                aria-label="Default max output"
                type="number"
                min="512"
                max="16000"
                step="256"
                value={outputTokens}
                style={numberInputStyle}
                oninput={(event) => inputValue('output', event.currentTarget.value)}
              />
              <button
                type="button"
                aria-label="Increase default max output"
                style={stepButtonStyle('output-plus')}
                onpointerenter={() => (hoverTarget = 'output-plus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('output', 1)}
              >
                <Plus size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStackStyle}>
              <div style={labelStyle}>Auto-save delay</div>
              <div style={helperStyle}>Seconds to wait after prompt edits before saving.</div>
            </div>

            <div
              role="group"
              aria-label="Auto-save delay"
              style={stepperStyle('autosave')}
              onpointerenter={() => (hoverTarget = 'autosave')}
              onpointerleave={() => (hoverTarget = null)}
              onfocusin={() => (focusTarget = 'autosave')}
              onfocusout={() => (focusTarget = null)}
            >
              <button
                type="button"
                aria-label="Decrease auto-save delay"
                style={stepButtonStyle('autosave-minus')}
                onpointerenter={() => (hoverTarget = 'autosave-minus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('autosave', -1)}
              >
                <Minus size={16} strokeWidth={2.25} />
              </button>
              <input
                aria-label="Auto-save delay"
                type="number"
                min="3"
                max="60"
                step="1"
                value={autoSaveSeconds}
                style={numberInputStyle}
                oninput={(event) => inputValue('autosave', event.currentTarget.value)}
              />
              <button
                type="button"
                aria-label="Increase auto-save delay"
                style={stepButtonStyle('autosave-plus')}
                onpointerenter={() => (hoverTarget = 'autosave-plus')}
                onpointerleave={() => (hoverTarget = null)}
                onclick={() => stepValue('autosave', 1)}
              >
                <Plus size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStackStyle}>
              <div style={labelStyle}>Prompt indexing</div>
              <div style={helperStyle}>Keep prompt search and folder counts updated in the background.</div>
            </div>

            <button
              type="button"
              aria-pressed={promptIndexingEnabled}
              style={toggleStyle(promptIndexingEnabled, 'indexing')}
              onpointerenter={() => (hoverTarget = 'indexing')}
              onpointerleave={() => (hoverTarget = null)}
              onfocus={() => (focusTarget = 'indexing')}
              onblur={() => (focusTarget = null)}
              onclick={() => (promptIndexingEnabled = !promptIndexingEnabled)}
            >
              <span style={statusTextStyle}>
                <Power size={15} strokeWidth={2.2} style={promptIndexingEnabled ? 'color:var(--ui-success-normal-text);' : 'color:var(--ui-muted-text);'} />
                {promptIndexingEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <span style={toggleKnobStyle(promptIndexingEnabled)}>
                <span style={toggleDotStyle}>
                  {#if promptIndexingEnabled}
                    <Check size={13} strokeWidth={2.6} />
                  {/if}
                </span>
              </span>
            </button>
          </div>

          <div style={lastRowStyle}>
            <div style={labelStackStyle}>
              <div style={labelStyle}>Compact folder controls</div>
              <div style={helperStyle}>Use condensed controls in the prompt folder sidebar.</div>
            </div>

            <button
              type="button"
              aria-pressed={compactFoldersEnabled}
              style={toggleStyle(compactFoldersEnabled, 'compact')}
              onpointerenter={() => (hoverTarget = 'compact')}
              onpointerleave={() => (hoverTarget = null)}
              onfocus={() => (focusTarget = 'compact')}
              onblur={() => (focusTarget = null)}
              onclick={() => (compactFoldersEnabled = !compactFoldersEnabled)}
            >
              <span style={statusTextStyle}>
                <Power size={15} strokeWidth={2.2} style={compactFoldersEnabled ? 'color:var(--ui-success-normal-text);' : 'color:var(--ui-muted-text);'} />
                {compactFoldersEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <span style={toggleKnobStyle(compactFoldersEnabled)}>
                <span style={toggleDotStyle}>
                  {#if compactFoldersEnabled}
                    <Check size={13} strokeWidth={2.6} />
                  {/if}
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <aside style={sidePanelStyle}>
        <section style={aboutStyle}>
          <div style={aboutHeaderStyle}>
            <div style={iconTileStyle}>CP</div>
            <div style="box-sizing:border-box;display:flex;flex-direction:column;gap:4px;min-width:0;">
              <h2 style={sectionTitleStyle}>Cthulhu Prompt</h2>
              <div style={helperStyle}>Version 1.8.0</div>
            </div>
          </div>

          <div style={aboutBodyStyle}>
            <div style={metricGridStyle}>
              <div style={metricStyle}>
                <div style={metricLabelStyle}>Workspace</div>
                <div style={metricValueStyle}>Public</div>
              </div>
              <div style={metricStyle}>
                <div style={metricLabelStyle}>Prompts</div>
                <div style={metricValueStyle}>148</div>
              </div>
              <div style={metricStyle}>
                <div style={metricLabelStyle}>Folders</div>
                <div style={metricValueStyle}>19</div>
              </div>
              <div style={metricStyle}>
                <div style={metricLabelStyle}>Updated</div>
                <div style={metricValueStyle}>Today</div>
              </div>
            </div>

            <button
              type="button"
              style={`${footerActionStyle}${hoverTarget === 'release-notes' ? 'border-color:color-mix(in srgb,var(--ui-accent-strong-text) 48%,var(--ui-card-normal-border));background:color-mix(in srgb,var(--ui-accent-strong-text) 6%,var(--ui-card-solid-surface));color:var(--ui-accent-strong-text);' : ''}`}
              onpointerenter={() => (hoverTarget = 'release-notes')}
              onpointerleave={() => (hoverTarget = null)}
            >
              Release notes
            </button>
          </div>
        </section>
      </aside>
    </main>
  </div>
</div>
