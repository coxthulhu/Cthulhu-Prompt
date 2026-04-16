<script lang="ts">
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import NumericInput from '@renderer/common/cthulhu-ui/NumericInput.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import { Keyboard, RefreshCcw } from 'lucide-svelte'
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
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-white">System Settings</h1>
      <p class="mt-2 text-sm text-zinc-400">Global settings saved on your local machine.</p>
    </div>

    <CardSurface>
      <div class="flex items-start gap-4 px-2 pb-4 pt-1">
        <div class="settingsScreenSectionIcon">
          <Keyboard class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <TitleBlock
            title="Editor & layout"
            variant="large"
            description="Typography, spacing, autosave, and core writing ergonomics."
          />
        </div>
      </div>

      <div class="space-y-3">
        <CardSurface
          variant="subcard"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Font Size"
              variant="small"
              description="Sets the base font size used inside the prompt editor."
            />
            {#if displayFontSizeError}
              <p class="mt-3 text-sm text-red-400" data-testid="font-size-error">
                {displayFontSizeError}
              </p>
            {/if}
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <NumericInput
              data-testid="font-size-input"
              class="h-11 w-24 px-4 text-sm font-medium"
              value={systemSettingsState.promptFontSizeInput}
              aria-invalid={displayFontSizeError ? 'true' : undefined}
              oninput={(event) =>
                setSystemSettingsDraftFontSizeInput(
                  (event.currentTarget as HTMLInputElement).value
                )}
              onblur={handleInputBlur}
            />
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleFontSizeReset}
              state={isFontSizeResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="subcard"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Minimum Line Count"
              variant="small"
              description="Sets the minimum number of visible lines in prompt editors."
            />
            {#if displayMinLinesError}
              <p class="mt-3 text-sm text-red-400" data-testid="min-lines-error">
                {displayMinLinesError}
              </p>
            {/if}
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <NumericInput
              data-testid="min-lines-input"
              class="h-11 w-24 px-4 text-sm font-medium"
              value={systemSettingsState.promptEditorMinLinesInput}
              aria-invalid={displayMinLinesError ? 'true' : undefined}
              oninput={(event) =>
                setSystemSettingsDraftPromptEditorMinLinesInput(
                  (event.currentTarget as HTMLInputElement).value
                )}
              onblur={handleInputBlur}
            />
            <IconTextButton
              icon={RefreshCcw}
              text="Reset"
              onclick={handleMinLinesReset}
              state={isMinLinesResetDisabled ? 'disabled' : 'enabled'}
            />
          </div>
        </CardSurface>

        <CardSurface
          variant="subcard"
          class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div class="min-w-0">
            <TitleBlock
              title="Show Line Numbers"
              variant="small"
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
  </div>
</section>

<style>
  .settingsScreenSectionIcon {
    align-items: center;
    background-color: var(--ui-accent-icon-surface);
    border-radius: 1rem;
    box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
    display: flex;
    flex: 0 0 auto;
    height: 2.75rem;
    justify-content: center;
    width: 2.75rem;
  }

  .settingsScreenSectionIcon :global(svg) {
    color: var(--ui-accent-icon);
  }
</style>
