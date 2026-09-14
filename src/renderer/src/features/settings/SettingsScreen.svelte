<script lang="ts">
  import Button from '@renderer/common/cthulhu-ui/Button.svelte'
  import Card from '@renderer/common/cthulhu-ui/Card.svelte'
  import DisplayRow from '@renderer/common/cthulhu-ui/DisplayRow.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/LinkButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import ControlRow from '@renderer/common/cthulhu-ui/ControlRow.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/TitleSubtitleStack.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/ValuePill.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import NumericStepperInput from '@renderer/common/cthulhu-ui/NumericStepperInput.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import { ExternalLink, Info, RefreshCcw, Settings, Type } from 'lucide-svelte'
  import {
    flushSystemSettingsAutosaves,
    getSystemSettingsAutosaveState,
    selectSystemSettingsClientStateRecord,
    useSystemSettingsClientStateQuery
  } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setSystemSettingsClientStateFontSizeInput,
    setSystemSettingsClientStatePromptEditorMaxLinesInput,
    setSystemSettingsClientStatePromptEditorMinLinesInput,
    setSystemSettingsClientStateShowLineNumbers
  } from '@renderer/data/UiState/SystemSettingsClientStateMutations.svelte.ts'
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

  const systemSettingsClientStateQuery = useSystemSettingsClientStateQuery()
  const systemSettingsClientState = $derived(
    selectSystemSettingsClientStateRecord(systemSettingsClientStateQuery.data)
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
    setFormDataValue: (value: string) => void
  ): Promise<void> => {
    await runIpcBestEffort(async () => {
      setFormDataValue(defaultValue)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleFontSizeReset = async () => {
    await resetSettingToDefault(defaultFontSizeInput, setSystemSettingsClientStateFontSizeInput)
  }

  const handleMinLinesReset = async () => {
    await resetSettingToDefault(
      defaultMinLinesInput,
      setSystemSettingsClientStatePromptEditorMinLinesInput
    )
  }

  const handleMaxLinesReset = async () => {
    await resetSettingToDefault(
      defaultMaxLinesInput,
      setSystemSettingsClientStatePromptEditorMaxLinesInput
    )
  }

  const updateShowLineNumbers = async (value: boolean) => {
    await runIpcBestEffort(async () => {
      setSystemSettingsClientStateShowLineNumbers(value)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleShowLineNumbersToggle = async () => {
    await updateShowLineNumbers(!systemSettingsClientState.showLineNumbers)
  }

  const handleShowLineNumbersReset = async () => {
    await updateShowLineNumbers(defaultShowLineNumbers)
  }

  const validation = $derived(getSystemSettingsValidation(systemSettingsClientState))
  const displayFontSizeError = $derived(validation.fontSizeError)
  const displayMinLinesError = $derived(validation.minLinesError)
  const displayMaxLinesError = $derived(validation.maxLinesError)
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptEditorMinLinesInput === defaultMinLinesInput
  )
  const isMaxLinesResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptEditorMaxLinesInput === defaultMaxLinesInput
  )
  const isShowLineNumbersResetDisabled = $derived(
    isUpdating || systemSettingsClientState.showLineNumbers === defaultShowLineNumbers
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
    <div class="settings-screen-title-block">
      <IconCell icon={Settings} variant="title" />
      <TitleSubtitleStack class="settings-screen-title-stack">
        <div class="settings-screen-title-line">
          <Title
            class="settings-screen-title text-3xl leading-9"
            data-testid="settings-screen-title"
            title="System Settings"
            variant="row"
          />
        </div>
        <Subtitle
          class="leading-5"
          data-testid="settings-screen-subtitle"
          text="System-wide settings stored locally on your machine."
          wrap={false}
        />
      </TitleSubtitleStack>
    </div>

    <Card
      label="Editor & Layout"
      icon={Type}
      subtitle="Configure prompt editor text, sizing, and line numbers."
    >
      <div class="flex flex-col">
        <ControlRow
          testId="editor-layout-font-size-row"
          label="Font Size"
          detail="Sets the base font size used inside the prompt editor."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayFontSizeError} textTestId="font-size-error">
              <NumericStepperInput
                data-testid="font-size-input"
                value={systemSettingsClientState.promptFontSizeInput}
                min={MIN_PROMPT_FONT_SIZE}
                max={MAX_PROMPT_FONT_SIZE}
                helperText="px"
                aria-label="Font size"
                aria-invalid={displayFontSizeError ? 'true' : undefined}
                decreaseLabel="Decrease font size"
                increaseLabel="Increase font size"
                onvaluechange={setSystemSettingsClientStateFontSizeInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleFontSizeReset}
              state={isFontSizeResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-min-lines-row"
          label="Minimum Line Count"
          detail="Sets the minimum number of visible lines in prompt editors."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayMinLinesError} textTestId="min-lines-error">
              <NumericStepperInput
                data-testid="min-lines-input"
                value={systemSettingsClientState.promptEditorMinLinesInput}
                min={MIN_PROMPT_EDITOR_MIN_LINES}
                max={MAX_PROMPT_EDITOR_MIN_LINES}
                helperText="lines"
                aria-label="Minimum line count"
                aria-invalid={displayMinLinesError ? 'true' : undefined}
                decreaseLabel="Decrease minimum line count"
                increaseLabel="Increase minimum line count"
                onvaluechange={setSystemSettingsClientStatePromptEditorMinLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleMinLinesReset}
              state={isMinLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-max-lines-row"
          label="Maximum Line Count"
          detail="Sets the maximum number of visible lines before prompt editors begin scrolling."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayMaxLinesError} textTestId="max-lines-error">
              <NumericStepperInput
                data-testid="max-lines-input"
                value={systemSettingsClientState.promptEditorMaxLinesInput}
                min={MIN_PROMPT_EDITOR_MAX_LINES}
                max={MAX_PROMPT_EDITOR_MAX_LINES}
                helperText="lines"
                aria-label="Maximum line count"
                aria-invalid={displayMaxLinesError ? 'true' : undefined}
                decreaseLabel="Decrease maximum line count"
                increaseLabel="Increase maximum line count"
                onvaluechange={setSystemSettingsClientStatePromptEditorMaxLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleMaxLinesReset}
              state={isMaxLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-line-numbers-row"
          label="Show Line Numbers"
          detail="Display line numbers beside prompt text for easier review."
        >
          {#snippet control()}
            <ToggleTextButton
              testId="show-line-numbers-toggle"
              pressed={systemSettingsClientState.showLineNumbers}
              onclick={handleShowLineNumbersToggle}
              disabled={isUpdating}
            />
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleShowLineNumbersReset}
              state={isShowLineNumbersResetDisabled ? 'disabled' : 'enabled'}
            />
          {/snippet}
        </ControlRow>
      </div>
    </Card>

    <Card
      label="About"
      icon={Info}
      subtitle="View application information and get support."
    >
      <div class="flex flex-col">
        <DisplayRow
          testId="about-issue-display-row"
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

<style>
  .settings-screen-title-block {
    align-items: flex-start;
    display: flex;
    gap: 12px;
    height: 60px;
    margin-bottom: 20px;
    min-width: 0;
  }

  .settings-screen-title-block :global(.settings-screen-title-stack) {
    gap: 4px;
  }

  .settings-screen-title-line {
    height: 36px;
    min-width: 0;
  }

  .settings-screen-title-line :global(.settings-screen-title) {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    /* Give Windows font glyphs room beyond the 36px line without enlarging the title row. */
    height: 40px;
    margin-block: -2px;
    padding-block: 2px;
    letter-spacing: -0.03em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
