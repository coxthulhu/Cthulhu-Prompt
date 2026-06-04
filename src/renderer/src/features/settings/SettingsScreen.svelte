<script lang="ts">
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import NumericStepperInput from '@renderer/common/cthulhu-ui/NumericStepperInput.svelte'
  import SectionHeader from '@renderer/common/cthulhu-ui/SectionHeader.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
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
  import {
    flushSystemSettingsAutosaves,
    getSystemSettingsAutosaveState,
    selectSystemSettingsDraftRecord,
    useSystemSettingsDraftQuery
  } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setSystemSettingsDraftFontSizeInput,
    setSystemSettingsDraftPromptEditorMaxLinesInput,
    setSystemSettingsDraftPromptEditorMinLinesInput,
    setSystemSettingsDraftShowLineNumbers
  } from '@renderer/data/UiState/SystemSettingsDraftMutations.svelte.ts'
  import {
    getSystemSettingsValidation,
    formatPromptEditorMaxLinesInput,
    formatPromptEditorMinLinesInput,
    formatPromptFontSizeInput
  } from '@renderer/data/UiState/SystemSettingsFormat'
  import BottomSpacer from '@renderer/features/prompt-editor/BottomSpacer.svelte'
  import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
  import {
    DEFAULT_SYSTEM_SETTINGS,
    MAX_PROMPT_EDITOR_MAX_LINES,
    MAX_PROMPT_EDITOR_MIN_LINES,
    MAX_PROMPT_FONT_SIZE,
    MIN_PROMPT_EDITOR_MAX_LINES,
    MIN_PROMPT_EDITOR_MIN_LINES,
    MIN_PROMPT_FONT_SIZE
  } from '@shared/SystemSettings'

  const systemSettingsDraftQuery = useSystemSettingsDraftQuery()
  const systemSettingsState = $derived(
    selectSystemSettingsDraftRecord(systemSettingsDraftQuery.data)
  )
  const autosaveState = getSystemSettingsAutosaveState()
  const isUpdating = $derived(autosaveState.saving)
  const defaultFontSize = DEFAULT_SYSTEM_SETTINGS.promptFontSize
  const defaultFontSizeInput = formatPromptFontSizeInput(defaultFontSize)
  const defaultMinLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
  const defaultMinLinesInput = formatPromptEditorMinLinesInput(defaultMinLines)
  const defaultMaxLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMaxLines
  const defaultMaxLinesInput = formatPromptEditorMaxLinesInput(defaultMaxLines)
  const defaultShowLineNumbers = DEFAULT_SYSTEM_SETTINGS.showLineNumbers
  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const appVersionLabel = `v${getRuntimeConfig().appVersion}`

  let settingsScrollContainerElement: HTMLElement | null = $state(null)
  let settingsScrollContainerHeightPx = $state(0)

  // Save immediately when an input loses focus to avoid delayed autosaves.
  const handleInputBlur = () => {
    void runIpcBestEffort(flushSystemSettingsAutosaves)
  }

  const resetSettingToDefault = async (
    defaultValue: string,
    setDraftValue: (value: string) => void
  ): Promise<void> => {
    await runIpcBestEffort(async () => {
      setDraftValue(defaultValue)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleFontSizeReset = async () => {
    await resetSettingToDefault(defaultFontSizeInput, setSystemSettingsDraftFontSizeInput)
  }

  const handleMinLinesReset = async () => {
    await resetSettingToDefault(
      defaultMinLinesInput,
      setSystemSettingsDraftPromptEditorMinLinesInput
    )
  }

  const handleMaxLinesReset = async () => {
    await resetSettingToDefault(
      defaultMaxLinesInput,
      setSystemSettingsDraftPromptEditorMaxLinesInput
    )
  }

  const updateShowLineNumbers = async (value: boolean) => {
    await runIpcBestEffort(async () => {
      setSystemSettingsDraftShowLineNumbers(value)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleShowLineNumbersToggle = async () => {
    await updateShowLineNumbers(!systemSettingsState.showLineNumbers)
  }

  const handleShowLineNumbersReset = async () => {
    await updateShowLineNumbers(defaultShowLineNumbers)
  }

  const validation = $derived(getSystemSettingsValidation(systemSettingsState))
  const displayFontSizeError = $derived(validation.fontSizeError)
  const displayMinLinesError = $derived(validation.minLinesError)
  const displayMaxLinesError = $derived(validation.maxLinesError)
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsState.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating || systemSettingsState.promptEditorMinLinesInput === defaultMinLinesInput
  )
  const isMaxLinesResetDisabled = $derived(
    isUpdating || systemSettingsState.promptEditorMaxLinesInput === defaultMaxLinesInput
  )
  const isShowLineNumbersResetDisabled = $derived(
    isUpdating || systemSettingsState.showLineNumbers === defaultShowLineNumbers
  )

  // Side effect: flush unsaved system settings when leaving the settings screen.
  $effect(() => {
    return () => {
      void runIpcBestEffort(flushSystemSettingsAutosaves)
    }
  })

  // Side effect: keep the dynamic bottom spacer sized to the settings scroll viewport.
  $effect(() => {
    const scrollContainerElement = settingsScrollContainerElement
    if (!scrollContainerElement) {
      return
    }

    const updateScrollContainerHeight = () => {
      settingsScrollContainerHeightPx = scrollContainerElement.getBoundingClientRect().height
    }

    updateScrollContainerHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateScrollContainerHeight()
    })

    resizeObserver.observe(scrollContainerElement)

    return () => {
      resizeObserver.disconnect()
    }
  })
</script>

<section
  bind:this={settingsScrollContainerElement}
  class="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-6"
  data-testid="settings-screen"
>
  <div class="w-full max-w-4xl space-y-6">
    <SectionHeader
      title="System Settings"
      description="Global settings saved on your local machine."
      headingLevel={1}
      icon={Settings}
      showAccentLine
    />

    <CardSurface class="grid gap-2 p-2.5">
      <div class="px-2.5 py-2">
        <TitleBlock
          title="Editor & layout"
          size="large"
          description="Typography, spacing, autosave, and core writing ergonomics."
          icon={Keyboard}
        />
      </div>

      <div class="space-y-3">
        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Font Size"
              size="small"
              description="Sets the base font size used inside the prompt editor."
              icon={Type}
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <FloatingValidationMessage message={displayFontSizeError} textTestId="font-size-error">
              <NumericStepperInput
                data-testid="font-size-input"
                value={systemSettingsState.promptFontSizeInput}
                min={MIN_PROMPT_FONT_SIZE}
                max={MAX_PROMPT_FONT_SIZE}
                helperText="px"
                aria-label="Font size"
                aria-invalid={displayFontSizeError ? 'true' : undefined}
                decreaseLabel="Decrease font size"
                increaseLabel="Increase font size"
                onvaluechange={setSystemSettingsDraftFontSizeInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleFontSizeReset}
              state={isFontSizeResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Minimum Line Count"
              size="small"
              description="Sets the minimum number of visible lines in prompt editors."
              icon={Rows3}
              iconVariant="accent-blue"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <FloatingValidationMessage message={displayMinLinesError} textTestId="min-lines-error">
              <NumericStepperInput
                data-testid="min-lines-input"
                value={systemSettingsState.promptEditorMinLinesInput}
                min={MIN_PROMPT_EDITOR_MIN_LINES}
                max={MAX_PROMPT_EDITOR_MIN_LINES}
                helperText="lines"
                aria-label="Minimum line count"
                aria-invalid={displayMinLinesError ? 'true' : undefined}
                decreaseLabel="Decrease minimum line count"
                increaseLabel="Increase minimum line count"
                onvaluechange={setSystemSettingsDraftPromptEditorMinLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMinLinesReset}
              state={isMinLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Maximum Line Count"
              size="small"
              description="Sets the maximum number of visible lines before prompt editors begin scrolling."
              icon={Rows3}
              iconVariant="accent-green"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <FloatingValidationMessage message={displayMaxLinesError} textTestId="max-lines-error">
              <NumericStepperInput
                data-testid="max-lines-input"
                value={systemSettingsState.promptEditorMaxLinesInput}
                min={MIN_PROMPT_EDITOR_MAX_LINES}
                max={MAX_PROMPT_EDITOR_MAX_LINES}
                helperText="lines"
                aria-label="Maximum line count"
                aria-invalid={displayMaxLinesError ? 'true' : undefined}
                decreaseLabel="Decrease maximum line count"
                increaseLabel="Increase maximum line count"
                onvaluechange={setSystemSettingsDraftPromptEditorMaxLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMaxLinesReset}
              state={isMaxLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Show Line Numbers"
              size="small"
              description="Display line numbers beside prompt text for easier review."
              icon={Hash}
              iconVariant="accent"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <ToggleTextButton
              testId="show-line-numbers-toggle"
              pressed={systemSettingsState.showLineNumbers}
              onclick={handleShowLineNumbersToggle}
              disabled={isUpdating}
            />
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleShowLineNumbersReset}
              state={isShowLineNumbersResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>
      </div>
    </CardSurface>

    <CardSurface class="grid gap-2 p-2.5">
      <div class="px-2.5 py-2">
        <TitleBlock
          title="About"
          size="large"
          description="Build and release details for this desktop app."
          icon={Info}
          iconVariant="accent-blue"
        />
      </div>

      <div class="space-y-3">
        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Report an Issue"
              size="small"
              description="Report bugs, request improvements, or check whether a problem is already tracked."
              icon={Bug}
            />
          </div>

          <div class="flex items-center lg:justify-end">
            <IconTextButton
              href={githubIssuesUrl}
              icon={Bug}
              endIcon={ExternalLink}
              text="Open Github Issues"
              variant="accent"
              testId="about-github-issues-button"
              target="_blank"
              rel="noreferrer"
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="inset"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Current Version"
              size="small"
              description="The version currently installed on this device."
              icon={Info}
              iconVariant="accent-blue"
            />
          </div>

          <div class="flex items-center lg:justify-end">
            <p
              class="rounded-full border px-3 py-1 text-sm font-medium text-[var(--ui-normal-text)]"
              data-testid="about-version-value"
            >
              {appVersionLabel}
            </p>
          </div>
        </CardSurface>
      </div>
    </CardSurface>

    <div>
      <div class="cthulhuSettingsCardLabel">
        <span class="cthulhuSettingsCardLabelIconCell">
          <Info
            size={24}
            style="color: var(--ui-hoverable-icon-glyph); stroke-width: 2;"
            aria-hidden="true"
          />
        </span>
        <span>About</span>
      </div>

      <CardSurface class="w-full min-w-0" variant="flat">
        <div class="flex flex-col">
          <div
            class="cthulhuSettingsSelectorDisplayRow"
            data-testid="about-issue-display-row"
            data-value="true"
          >
            <span class="cthulhuSettingsSelectorDisplayIconCell">
              <Bug size={24} style="stroke-width: 2;" aria-hidden="true" />
            </span>

            <span class="cthulhuSettingsSelectorDisplayTextStack">
              <span class="cthulhuSettingsSelectorDisplayText">Report an Issue</span>
              <span class="cthulhuSettingsSelectorDisplayDetail">
                Report bugs, request improvements, or check whether a problem is already tracked.
              </span>
            </span>

            <a
              class="cthulhuSettingsFlatLinkButton"
              href={githubIssuesUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="about-github-issues-flat-link"
            >
              <span>Open Github Issues</span>
              <ExternalLink size={16} style="stroke-width: 2.2;" aria-hidden="true" />
            </a>
          </div>

          <Separator class="my-2 bg-[var(--ui-card-nested-border)]" />

          <div
            class="cthulhuSettingsSelectorDisplayRow"
            data-testid="about-issue-display-row-copy"
            data-value="true"
          >
            <span class="cthulhuSettingsSelectorDisplayIconCell">
              <Bug size={24} style="stroke-width: 2;" aria-hidden="true" />
            </span>

            <span class="cthulhuSettingsSelectorDisplayTextStack">
              <span class="cthulhuSettingsSelectorDisplayText">Report an Issue</span>
              <span class="cthulhuSettingsSelectorDisplayDetail">
                Report bugs, request improvements, or check whether a problem is already tracked.
              </span>
            </span>

            <a
              class="cthulhuSettingsFlatLinkButton cthulhuSettingsFlatLinkButton--accent"
              href={githubIssuesUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="about-github-issues-flat-link-copy"
            >
              <span>Open Github Issues</span>
              <ExternalLink size={16} style="stroke-width: 2.2;" aria-hidden="true" />
            </a>
          </div>

          <Separator class="my-2 bg-[var(--ui-card-nested-border)]" />

          <div
            class="cthulhuSettingsSelectorDisplayRow"
            data-testid="about-version-display-row"
            data-value="true"
          >
            <span class="cthulhuSettingsSelectorDisplayIconCell">
              <Info size={24} style="stroke-width: 2;" aria-hidden="true" />
            </span>

            <span class="cthulhuSettingsSelectorDisplayTextStack">
              <span class="cthulhuSettingsSelectorDisplayText">Current Version</span>
              <span class="cthulhuSettingsSelectorDisplayDetail">
                The version currently installed on this device.
              </span>
            </span>

            <span
              class="cthulhuSettingsSelectorDisplayPill"
              title={appVersionLabel}
              data-testid="about-version-display-value"
            >
              {appVersionLabel}
            </span>
          </div>
        </div>
      </CardSurface>
    </div>

    <BottomSpacer scrollContainerHeightPx={settingsScrollContainerHeightPx} />
  </div>
</section>

<style>
  .cthulhuSettingsCardLabel {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 20px;
    font-weight: 500;
    gap: 10px;
    letter-spacing: 0;
    line-height: 1.2;
    margin-bottom: 12px;
    padding-left: 8px;
  }

  .cthulhuSettingsCardLabelIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    display: flex;
    flex: 0 0 auto;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuSettingsSelectorDisplayRow {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
    display: grid;
    gap: 12px;
    grid-template-columns: 34px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
    text-align: left;
    width: 100%;
  }

  .cthulhuSettingsSelectorDisplayRow[data-value='true'] {
    grid-template-columns: 34px minmax(0, 1fr) auto;
  }

  .cthulhuSettingsSelectorDisplayIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .cthulhuSettingsSelectorDisplayTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuSettingsSelectorDisplayText,
  .cthulhuSettingsSelectorDisplayDetail {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .cthulhuSettingsSelectorDisplayText {
    color: inherit;
    display: block;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .cthulhuSettingsSelectorDisplayDetail {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 13px;
    gap: 6px;
  }

  .cthulhuSettingsSelectorDisplayPill {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 999px;
    color: var(--ui-normal-text);
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    max-width: 11rem;
    min-width: 0;
    overflow: hidden;
    padding: 4px 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuSettingsFlatLinkButton {
    align-items: center;
    background-color: var(--ui-neutral-normal-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    height: 40px;
    font-size: 14px;
    font-weight: 500;
    gap: 8px;
    line-height: 20px;
    min-width: 0;
    max-width: 14rem;
    overflow: hidden;
    padding: 0 14px;
    text-decoration: none;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    white-space: nowrap;
  }

  .cthulhuSettingsFlatLinkButton:hover,
  .cthulhuSettingsFlatLinkButton:focus-visible {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuSettingsFlatLinkButton--accent {
    background-color: var(--ui-accent-subtle-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuSettingsFlatLinkButton--accent:hover,
  .cthulhuSettingsFlatLinkButton--accent:focus-visible {
    background-color: var(--ui-accent-subtle-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuSettingsFlatLinkButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuSettingsFlatLinkButton span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
