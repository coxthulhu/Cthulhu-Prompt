<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import { NumericInput } from '@renderer/common/ui/numeric-input'
  import {
    getSystemSettingsState,
    saveSystemSettings,
    setSystemSettingsDraftFontSizeInput
  } from '@renderer/data/system-settings/SystemSettingsStore.svelte.ts'
  import type { UpdateSystemSettingsResult } from '@shared/ipc'
  import {
    DEFAULT_SYSTEM_SETTINGS,
    MAX_PROMPT_FONT_SIZE,
    MIN_PROMPT_FONT_SIZE
  } from '@shared/systemSettings'
  import {
    AUTOSAVE_MS,
    clearAutosaveTimeout,
    createAutosaveController,
    type AutosaveDraft
  } from '@renderer/data/draftAutosave'
  import { registerSystemSettingsAutosave } from '@renderer/data/system-settings/systemSettingsAutosave'

  const systemSettingsState = getSystemSettingsState()
  const isUpdating = $derived(systemSettingsState.isSaving)
  const defaultFontSize = DEFAULT_SYSTEM_SETTINGS.promptFontSize
  const defaultFontSizeInput = String(defaultFontSize)

  let hasInteracted = $state(false)
  let errorMessage = $state<string | null>(null)
  const autosaveDraft = $state<AutosaveDraft>({
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const clearSaveState = () => {
    autosaveDraft.dirty = false
    hasInteracted = false
    errorMessage = null
  }

  const applySaveResult = (
    result: UpdateSystemSettingsResult,
    expectedInput: string
  ): void => {
    if (result.conflict) {
      clearSaveState()
      return
    }

    if (result.success && systemSettingsState.draft.promptFontSizeInput === expectedInput) {
      clearSaveState()
    }
  }

  const autosave = createAutosaveController({
    draft: autosaveDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const validationError = validateFontSize(systemSettingsState.draft.promptFontSizeInput)

      if (validationError) {
        return
      }

      const draftInput = systemSettingsState.draft.promptFontSizeInput
      const parsed = Math.round(Number(draftInput))
      const normalizedInput = String(parsed)

      try {
        const result = await saveSystemSettings({ promptFontSize: parsed }, draftInput)
        applySaveResult(result, normalizedInput)
      } catch (error) {
        console.error('Failed to update system settings:', error)
        errorMessage = 'Unable to save settings. Please try again.'
      }
    }
  })

  const validateFontSize = (value: string): string | null => {
    if (!value.trim()) {
      return 'Enter a font size.'
    }

    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return 'Font size must be a number.'
    }

    if (parsed < MIN_PROMPT_FONT_SIZE || parsed > MAX_PROMPT_FONT_SIZE) {
      return `Use a value between ${MIN_PROMPT_FONT_SIZE} and ${MAX_PROMPT_FONT_SIZE}.`
    }

    return null
  }

  const handleInput = (value: string) => {
    if (systemSettingsState.draft.promptFontSizeInput === value) return
    setSystemSettingsDraftFontSizeInput(value)
    hasInteracted = true
    if (errorMessage) {
      errorMessage = null
    }
    autosave.markDirtyAndScheduleAutosave()
  }

  const handleReset = async () => {
    clearAutosaveTimeout(autosaveDraft)

    try {
      setSystemSettingsDraftFontSizeInput(defaultFontSizeInput)
      autosaveDraft.dirty = true
      const result = await saveSystemSettings(
        {
          promptFontSize: defaultFontSize
        },
        defaultFontSizeInput
      )
      applySaveResult(result, defaultFontSizeInput)
    } catch (error) {
      console.error('Failed to reset system settings:', error)
      errorMessage = 'Unable to reset settings. Please try again.'
    }
  }

  const validationMessage = $derived(
    hasInteracted ? validateFontSize(systemSettingsState.draft.promptFontSizeInput) : null
  )
  const displayError = $derived(errorMessage ?? validationMessage)
  const isResetDisabled = $derived(
    isUpdating ||
      systemSettingsState.draft.promptFontSizeInput ===
        defaultFontSizeInput
  )

  const flushAutosave = async (): Promise<void> => {
    clearAutosaveTimeout(autosaveDraft)
    await autosave.saveNow()
  }

  // Side effect: register autosave flush hooks and save before leaving the settings screen.
  $effect(() => {
    const unregister = registerSystemSettingsAutosave(flushAutosave)
    return () => {
      unregister()
      void flushAutosave()
    }
  })
</script>

<section class="flex-1 p-6 flex flex-col items-center justify-start" data-testid="settings-screen">
  <div class="w-full max-w-2xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="mt-2 text-muted-foreground">Customize how Cthulhu Prompt behaves.</p>
    </div>

    <div class="border rounded-lg bg-muted/30 p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">Prompt editor font size</h2>
          <p class="text-sm text-muted-foreground">
            Sets the font size used in the prompt editor.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <NumericInput
            data-testid="font-size-input"
            class="w-24"
            value={systemSettingsState.draft.promptFontSizeInput}
            oninput={(event) => handleInput((event.currentTarget as HTMLInputElement).value)}
          />
          <Button size="sm" onclick={handleReset} disabled={isResetDisabled}>
            Reset to Default
          </Button>
        </div>
      </div>

      {#if displayError}
        <p class="mt-3 text-sm text-red-500" data-testid="font-size-error">{displayError}</p>
      {/if}
    </div>
  </div>
</section>
