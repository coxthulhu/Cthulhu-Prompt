<script lang="ts">
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import NumericInput from '@renderer/common/cthulhu-ui/NumericInput.svelte'
  import SectionHeader from '@renderer/common/cthulhu-ui/SectionHeader.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import { Bug, ExternalLink, Info, Keyboard, RefreshCcw, Settings } from 'lucide-svelte'
  import {
    flushSystemSettingsAutosaves,
    getSystemSettingsAutosaveState,
    selectSystemSettingsDraftRecord,
    useSystemSettingsDraftQuery
  } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setSystemSettingsDraftFontSizeInput,
    setSystemSettingsDraftPromptEditorMinLinesInput,
    setSystemSettingsDraftShowLineNumbers
  } from '@renderer/data/UiState/SystemSettingsDraftMutations.svelte.ts'
  import {
    getSystemSettingsValidation,
    formatPromptEditorMinLinesInput,
    formatPromptFontSizeInput
  } from '@renderer/data/UiState/SystemSettingsFormat'
  import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
  import { DEFAULT_SYSTEM_SETTINGS } from '@shared/SystemSettings'

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
  const defaultShowLineNumbers = DEFAULT_SYSTEM_SETTINGS.showLineNumbers
  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const appVersionLabel = `v${getRuntimeConfig().appVersion}`

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
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsState.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating || systemSettingsState.promptEditorMinLinesInput === defaultMinLinesInput
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
</script>

<section
  class="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-6 text-white"
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

    <CardSurface>
      <div class="px-2 pb-4 pt-1">
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
          class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Font Size"
              size="small"
              description="Sets the base font size used inside the prompt editor."
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <FloatingValidationMessage message={displayFontSizeError} textTestId="font-size-error">
              <NumericInput
                data-testid="font-size-input"
                value={systemSettingsState.promptFontSizeInput}
                aria-invalid={displayFontSizeError ? 'true' : undefined}
                oninput={(event) =>
                  setSystemSettingsDraftFontSizeInput(
                    (event.currentTarget as HTMLInputElement).value
                  )}
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
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <FloatingValidationMessage message={displayMinLinesError} textTestId="min-lines-error">
              <NumericInput
                data-testid="min-lines-input"
                value={systemSettingsState.promptEditorMinLinesInput}
                aria-invalid={displayMinLinesError ? 'true' : undefined}
                oninput={(event) =>
                  setSystemSettingsDraftPromptEditorMinLinesInput(
                    (event.currentTarget as HTMLInputElement).value
                  )}
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
              title="Show Line Numbers"
              size="small"
              description="Display line numbers beside prompt text for easier review."
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

    <CardSurface>
      <div class="px-2 pb-4 pt-1">
        <TitleBlock
          title="About"
          size="large"
          description="Build and release details for this desktop app."
          icon={Info}
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
            />
          </div>

          <div class="flex items-center lg:justify-end">
            <p
              class="rounded-full border px-3 py-1 text-sm font-medium text-white"
              data-testid="about-version-value"
            >
              {appVersionLabel}
            </p>
          </div>
        </CardSurface>
      </div>
    </CardSurface>
  </div>
</section>
