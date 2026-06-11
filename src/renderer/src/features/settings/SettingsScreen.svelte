<script lang="ts">
  import FlatButton from '@renderer/common/cthulhu-ui/FlatButton.svelte'
  import FlatCard from '@renderer/common/cthulhu-ui/FlatCard.svelte'
  import FlatDisplayRow from '@renderer/common/cthulhu-ui/FlatDisplayRow.svelte'
  import FlatLinkButton from '@renderer/common/cthulhu-ui/FlatLinkButton.svelte'
  import FlatSeparator from '@renderer/common/cthulhu-ui/FlatSeparator.svelte'
  import FlatSettingRow from '@renderer/common/cthulhu-ui/FlatSettingRow.svelte'
  import FlatTitle from '@renderer/common/cthulhu-ui/FlatTitle.svelte'
  import FlatValuePill from '@renderer/common/cthulhu-ui/FlatValuePill.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import FlatNumericStepperInput from '@renderer/common/cthulhu-ui/FlatNumericStepperInput.svelte'
  import FlatToggleTextButton from '@renderer/common/cthulhu-ui/FlatToggleTextButton.svelte'
  import { Bug, ExternalLink, Hash, Info, RefreshCcw, Rows3, Type } from 'lucide-svelte'
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
  <div class="flex w-full max-w-4xl flex-col gap-6">
    <FlatTitle title="System Settings" headingLevel={1} />

    <FlatCard label="Editor & layout">
      <div class="flex flex-col">
        <FlatSettingRow
          testId="editor-layout-font-size-row"
          icon={Type}
          label="Font Size"
          detail="Sets the base font size used inside the prompt editor."
        >
          {#snippet control()}
            <FlatFloatingValidationMessage message={displayFontSizeError} textTestId="font-size-error">
              <FlatNumericStepperInput
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
            </FlatFloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <FlatButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleFontSizeReset}
              state={isFontSizeResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </FlatSettingRow>

        <FlatSeparator />

        <FlatSettingRow
          testId="editor-layout-min-lines-row"
          icon={Rows3}
          label="Minimum Line Count"
          detail="Sets the minimum number of visible lines in prompt editors."
        >
          {#snippet control()}
            <FlatFloatingValidationMessage message={displayMinLinesError} textTestId="min-lines-error">
              <FlatNumericStepperInput
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
            </FlatFloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <FlatButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMinLinesReset}
              state={isMinLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </FlatSettingRow>

        <FlatSeparator />

        <FlatSettingRow
          testId="editor-layout-max-lines-row"
          icon={Rows3}
          label="Maximum Line Count"
          detail="Sets the maximum number of visible lines before prompt editors begin scrolling."
        >
          {#snippet control()}
            <FlatFloatingValidationMessage message={displayMaxLinesError} textTestId="max-lines-error">
              <FlatNumericStepperInput
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
            </FlatFloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <FlatButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMaxLinesReset}
              state={isMaxLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </FlatSettingRow>

        <FlatSeparator />

        <FlatSettingRow
          testId="editor-layout-line-numbers-row"
          icon={Hash}
          label="Show Line Numbers"
          detail="Display line numbers beside prompt text for easier review."
        >
          {#snippet control()}
            <FlatToggleTextButton
              testId="show-line-numbers-toggle"
              pressed={systemSettingsState.showLineNumbers}
              onclick={handleShowLineNumbersToggle}
              disabled={isUpdating}
            />
          {/snippet}

          {#snippet actions()}
            <FlatButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleShowLineNumbersReset}
              state={isShowLineNumbersResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </FlatSettingRow>
      </div>
    </FlatCard>

    <FlatCard label="About">
      <div class="flex flex-col">
        <FlatDisplayRow
          testId="about-issue-display-row"
          icon={Bug}
          label="Report an Issue"
          detail="Report bugs, request improvements, or check whether a problem is already tracked."
        >
          {#snippet trailing()}
            <FlatLinkButton
              href={githubIssuesUrl}
              text="Open Github Issues"
              endIcon={ExternalLink}
              variant="accent"
              testId="about-github-issues-link"
              target="_blank"
              rel="noreferrer"
            />
          {/snippet}
        </FlatDisplayRow>

        <FlatSeparator />

        <FlatDisplayRow
          testId="about-version-display-row"
          icon={Info}
          label="Current Version"
          detail="The version currently installed on this device."
        >
          {#snippet trailing()}
            <FlatValuePill text={appVersionLabel} testId="about-version-display-value" />
          {/snippet}
        </FlatDisplayRow>
      </div>
    </FlatCard>

    <BottomSpacer scrollContainerHeightPx={settingsScrollContainerHeightPx} />
  </div>
</section>
