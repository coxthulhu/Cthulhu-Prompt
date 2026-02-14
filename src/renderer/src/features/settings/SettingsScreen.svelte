<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Button } from '@renderer/common/ui/button'
  import { NumericInput } from '@renderer/common/ui/numeric-input'
  import {
    SYSTEM_SETTINGS_DRAFT_ID,
    type SystemSettingsDraftRecord,
    systemSettingsDraftCollection
  } from '@renderer/data/Collections/SystemSettingsDraftCollection'
  import {
    flushSystemSettingsAutosave,
    getSystemSettingsAutosaveDraft,
    getSystemSettingsValidation,
    saveSystemSettingsDraftNow,
    setSystemSettingsDraftFontSizeInput,
    setSystemSettingsDraftPromptEditorMinLinesInput
  } from '@renderer/data/UiState/SystemSettingsDraftStore.svelte.ts'
  import {
    formatPromptEditorMinLinesInput,
    formatPromptFontSizeInput
  } from '@renderer/data/UiState/SystemSettingsFormat'
  import { DEFAULT_SYSTEM_SETTINGS } from '@shared/SystemSettings'

  const systemSettingsDraftQuery = useLiveQuery((q) =>
    q.from({ systemSettingsDraft: systemSettingsDraftCollection })
  ) as { data: SystemSettingsDraftRecord[] }
  const systemSettingsState = $derived.by(() => {
    return (
      systemSettingsDraftQuery.data.find((draft) => draft.id === SYSTEM_SETTINGS_DRAFT_ID) ??
      systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)!
    )
  })
  const autosaveDraft = getSystemSettingsAutosaveDraft()
  const isUpdating = $derived(autosaveDraft.saving)
  const defaultFontSize = DEFAULT_SYSTEM_SETTINGS.promptFontSize
  const defaultFontSizeInput = formatPromptFontSizeInput(defaultFontSize)
  const defaultMinLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
  const defaultMinLinesInput = formatPromptEditorMinLinesInput(defaultMinLines)

  const runWithErrorLogging = async (
    message: string,
    action: () => Promise<void>
  ): Promise<void> => {
    try {
      await action()
    } catch (error) {
      console.error(message, error)
    }
  }

  // Save immediately when an input loses focus to avoid delayed autosaves.
  const handleInputBlur = () => {
    void runWithErrorLogging(
      'Failed to update system settings:',
      flushSystemSettingsAutosave
    )
  }

  const resetSettingToDefault = async (
    defaultValue: string,
    setDraftValue: (value: string) => void
  ): Promise<void> => {
    await runWithErrorLogging('Failed to reset system settings:', async () => {
      setDraftValue(defaultValue)
      await saveSystemSettingsDraftNow()
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

  const validation = $derived(getSystemSettingsValidation())
  const displayFontSizeError = $derived(systemSettingsState.saveError ?? validation.fontSizeError)
  const displayMinLinesError = $derived(systemSettingsState.saveError ?? validation.minLinesError)
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsState.draftSnapshot.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating ||
      systemSettingsState.draftSnapshot.promptEditorMinLinesInput === defaultMinLinesInput
  )

  // Side effect: flush unsaved system settings when leaving the settings screen.
  $effect(() => {
    return () => {
      void runWithErrorLogging(
        'Failed to update system settings:',
        flushSystemSettingsAutosave
      )
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
            value={systemSettingsState.draftSnapshot.promptFontSizeInput}
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
            value={systemSettingsState.draftSnapshot.promptEditorMinLinesInput}
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
