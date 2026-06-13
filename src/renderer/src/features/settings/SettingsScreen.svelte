<script lang="ts">
  import Button from '@renderer/common/cthulhu-ui/Button.svelte'
  import Card from '@renderer/common/cthulhu-ui/Card.svelte'
  import DisplayRow from '@renderer/common/cthulhu-ui/DisplayRow.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/LinkButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/ValuePill.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import NumericStepperInput from '@renderer/common/cthulhu-ui/NumericStepperInput.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
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
  <div class="flex w-full max-w-4xl flex-col gap-4">
    <Title title="System Settings" />

    <Card label="Editor & layout">
      <div class="flex flex-col">
        <SettingRow
          testId="editor-layout-font-size-row"
          icon={Type}
          label="Font Size"
          detail="Sets the base font size used inside the prompt editor."
        >
          {#snippet control()}
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
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              onclick={handleFontSizeReset}
              state={isFontSizeResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </SettingRow>

        <Separator />

        <SettingRow
          testId="editor-layout-min-lines-row"
          icon={Rows3}
          label="Minimum Line Count"
          detail="Sets the minimum number of visible lines in prompt editors."
        >
          {#snippet control()}
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
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMinLinesReset}
              state={isMinLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </SettingRow>

        <Separator />

        <SettingRow
          testId="editor-layout-max-lines-row"
          icon={Rows3}
          label="Maximum Line Count"
          detail="Sets the maximum number of visible lines before prompt editors begin scrolling."
        >
          {#snippet control()}
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
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMaxLinesReset}
              state={isMaxLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </SettingRow>

        <Separator />

        <SettingRow
          testId="editor-layout-line-numbers-row"
          icon={Hash}
          label="Show Line Numbers"
          detail="Display line numbers beside prompt text for easier review."
        >
          {#snippet control()}
            <ToggleTextButton
              testId="show-line-numbers-toggle"
              pressed={systemSettingsState.showLineNumbers}
              onclick={handleShowLineNumbersToggle}
              disabled={isUpdating}
            />
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              onclick={handleShowLineNumbersReset}
              state={isShowLineNumbersResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </SettingRow>
      </div>
    </Card>

    <Card label="About">
      <div class="flex flex-col">
        <DisplayRow
          testId="about-issue-display-row"
          icon={Bug}
          label="Report an Issue"
          detail="Report bugs, request improvements, or check whether a problem is already tracked."
        >
          {#snippet trailing()}
            <LinkButton
              href={githubIssuesUrl}
              text="Open Github Issues"
              endIcon={ExternalLink}
              variant="accent"
              testId="about-github-issues-link"
              target="_blank"
              rel="noreferrer"
            />
          {/snippet}
        </DisplayRow>

        <Separator />

        <DisplayRow
          testId="about-version-display-row"
          icon={Info}
          label="Current Version"
          detail="The version currently installed on this device."
        >
          {#snippet trailing()}
            <ValuePill text={appVersionLabel} testId="about-version-display-value" />
          {/snippet}
        </DisplayRow>
      </div>
    </Card>

    <BottomSpacer scrollContainerHeightPx={settingsScrollContainerHeightPx} />
  </div>
</section>
