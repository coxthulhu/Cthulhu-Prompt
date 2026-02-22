<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import { NumericInput } from '@renderer/common/ui/numeric-input'
  import {
    flushSystemSettingsAutosaves,
    getSystemSettingsAutosaveState,
    selectSystemSettingsDraftRecord,
    useSystemSettingsDraftQuery
  } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setSystemSettingsDraftFontSizeInput,
    setSystemSettingsDraftPromptEditorMinLinesInput
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

  const validation = $derived(getSystemSettingsValidation(systemSettingsState))
  const displayFontSizeError = $derived(validation.fontSizeError)
  const displayMinLinesError = $derived(validation.minLinesError)
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsState.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating || systemSettingsState.promptEditorMinLinesInput === defaultMinLinesInput
  )

  // Side effect: flush unsaved system settings when leaving the settings screen.
  $effect(() => {
    return () => {
      void runIpcBestEffort(flushSystemSettingsAutosaves)
    }
  })
</script>

<section class="flex-1 p-6 flex flex-col items-center justify-start" data-testid="settings-screen">
  <div class="w-full max-w-2xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">System Settings</h1>
      <p class="mt-2 text-muted-foreground">Global settings saved on your local machine.</p>
    </div>

    <div class="border rounded-lg bg-muted/30 p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">Prompt editor font size</h2>
          <p class="text-sm text-muted-foreground">Sets the font size used in the prompt editor.</p>
        </div>

        <div class="flex items-center gap-3">
          <NumericInput
            data-testid="font-size-input"
            class="w-24"
            value={systemSettingsState.promptFontSizeInput}
            oninput={(event) =>
              setSystemSettingsDraftFontSizeInput((event.currentTarget as HTMLInputElement).value)}
            onblur={handleInputBlur}
          />
          <Button size="sm" onclick={handleFontSizeReset} disabled={isFontSizeResetDisabled}>
            Reset to Default
          </Button>
        </div>
      </div>

      {#if displayFontSizeError}
        <p class="mt-3 text-sm text-red-500" data-testid="font-size-error">
          {displayFontSizeError}
        </p>
      {/if}
    </div>

    <div class="border rounded-lg bg-muted/30 p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">Prompt editor minimum lines</h2>
          <p class="text-sm text-muted-foreground">
            Sets the minimum number of visible lines in prompt editors.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <NumericInput
            data-testid="min-lines-input"
            class="w-24"
            value={systemSettingsState.promptEditorMinLinesInput}
            oninput={(event) =>
              setSystemSettingsDraftPromptEditorMinLinesInput(
                (event.currentTarget as HTMLInputElement).value
              )}
            onblur={handleInputBlur}
          />
          <Button size="sm" onclick={handleMinLinesReset} disabled={isMinLinesResetDisabled}>
            Reset to Default
          </Button>
        </div>
      </div>

      {#if displayMinLinesError}
        <p class="mt-3 text-sm text-red-500" data-testid="min-lines-error">
          {displayMinLinesError}
        </p>
      {/if}
    </div>
  </div>
</section>
