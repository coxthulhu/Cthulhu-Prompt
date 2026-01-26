<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import { NumericInput } from '@renderer/common/ui/numeric-input'
  import {
    getSystemSettingsState,
    saveSystemSettings,
    setSystemSettingsDraftFontSizeInput
  } from '@renderer/data/system-settings/SystemSettingsStore.svelte.ts'
  import {
    formatPromptFontSizeInput,
    normalizePromptFontSizeInput
  } from '@renderer/data/system-settings/systemSettingsFormat'
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
  const defaultFontSizeInput = formatPromptFontSizeInput(defaultFontSize)

  const autosaveDraft = $state<AutosaveDraft>({
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const saveFontSizeInput = async (value: string): Promise<void> => {
    const { rounded } = normalizePromptFontSizeInput(value)
    const outcome = await saveSystemSettings({ promptFontSize: rounded })
    if (outcome === 'saved' || outcome === 'conflict') {
      autosaveDraft.dirty = false
    }
  }

  const autosave = createAutosaveController({
    draft: autosaveDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const validationError = validateFontSize(
        systemSettingsState.draftSnapshot.promptFontSizeInput
      )

      if (validationError) {
        return
      }

      try {
        await saveFontSizeInput(systemSettingsState.draftSnapshot.promptFontSizeInput)
      } catch (error) {
        console.error('Failed to update system settings:', error)
      }
    }
  })

  const validateFontSize = (value: string): string | null => {
    if (!value.trim()) {
      return 'Enter a font size.'
    }

    const { parsed } = normalizePromptFontSizeInput(value)

    if (!Number.isFinite(parsed)) {
      return 'Font size must be a number.'
    }

    if (parsed < MIN_PROMPT_FONT_SIZE || parsed > MAX_PROMPT_FONT_SIZE) {
      return `Use a value between ${MIN_PROMPT_FONT_SIZE} and ${MAX_PROMPT_FONT_SIZE}.`
    }

    return null
  }

  const handleInput = (value: string) => {
    if (systemSettingsState.draftSnapshot.promptFontSizeInput === value) return
    setSystemSettingsDraftFontSizeInput(value)
    autosave.markDirtyAndScheduleAutosave()
  }

  const handleReset = async () => {
    clearAutosaveTimeout(autosaveDraft)

    try {
      setSystemSettingsDraftFontSizeInput(defaultFontSizeInput)
      autosaveDraft.dirty = true
      await saveFontSizeInput(defaultFontSizeInput)
    } catch (error) {
      console.error('Failed to reset system settings:', error)
    }
  }

  const validationMessage = $derived(
    validateFontSize(systemSettingsState.draftSnapshot.promptFontSizeInput)
  )
  const displayError = $derived(systemSettingsState.errorMessage ?? validationMessage)
  const isResetDisabled = $derived(
    isUpdating ||
      systemSettingsState.draftSnapshot.promptFontSizeInput ===
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
            value={systemSettingsState.draftSnapshot.promptFontSizeInput}
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
