<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import { NumericInput } from '@renderer/common/ui/numeric-input'
  import {
    getSystemSettingsState,
    saveSystemSettings,
    setSystemSettingsDraftFontSizeInput,
    setSystemSettingsDraftPromptEditorMinLinesInput
  } from '@renderer/data/system-settings/SystemSettingsStore.svelte.ts'
  import {
    formatPromptEditorMinLinesInput,
    formatPromptFontSizeInput,
    normalizePromptEditorMinLinesInput,
    normalizePromptFontSizeInput
  } from '@renderer/data/system-settings/systemSettingsFormat'
  import {
    DEFAULT_SYSTEM_SETTINGS,
    MAX_PROMPT_EDITOR_MIN_LINES,
    MAX_PROMPT_FONT_SIZE,
    MIN_PROMPT_EDITOR_MIN_LINES,
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
  const defaultMinLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
  const defaultMinLinesInput = formatPromptEditorMinLinesInput(defaultMinLines)

  const autosaveDraft = $state<AutosaveDraft>({
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const saveDraftSettings = async (): Promise<void> => {
    const fontSize = normalizePromptFontSizeInput(
      systemSettingsState.draftSnapshot.promptFontSizeInput
    )
    const minLines = normalizePromptEditorMinLinesInput(
      systemSettingsState.draftSnapshot.promptEditorMinLinesInput
    )
    const outcome = await saveSystemSettings({
      promptFontSize: fontSize.rounded,
      promptEditorMinLines: minLines.rounded
    })
    if (outcome === 'saved' || outcome === 'conflict') {
      autosaveDraft.dirty = false
    }
  }

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

  const validateMinLines = (value: string): string | null => {
    if (!value.trim()) {
      return 'Enter a minimum line count.'
    }

    const { parsed } = normalizePromptEditorMinLinesInput(value)

    if (!Number.isFinite(parsed)) {
      return 'Minimum line count must be a number.'
    }

    if (parsed < MIN_PROMPT_EDITOR_MIN_LINES || parsed > MAX_PROMPT_EDITOR_MIN_LINES) {
      return `Use a value between ${MIN_PROMPT_EDITOR_MIN_LINES} and ${MAX_PROMPT_EDITOR_MIN_LINES}.`
    }

    return null
  }

  const validateDraft = () => {
    return {
      fontSizeError: validateFontSize(systemSettingsState.draftSnapshot.promptFontSizeInput),
      minLinesError: validateMinLines(
        systemSettingsState.draftSnapshot.promptEditorMinLinesInput
      )
    }
  }

  const autosave = createAutosaveController({
    draft: autosaveDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const validation = validateDraft()

      if (validation.fontSizeError || validation.minLinesError) {
        return
      }

      try {
        await saveDraftSettings()
      } catch (error) {
        console.error('Failed to update system settings:', error)
      }
    }
  })

  const handleFontSizeInput = (value: string) => {
    if (systemSettingsState.draftSnapshot.promptFontSizeInput === value) return
    setSystemSettingsDraftFontSizeInput(value)
    autosave.markDirtyAndScheduleAutosave()
  }

  const handleMinLinesInput = (value: string) => {
    if (systemSettingsState.draftSnapshot.promptEditorMinLinesInput === value) return
    setSystemSettingsDraftPromptEditorMinLinesInput(value)
    autosave.markDirtyAndScheduleAutosave()
  }

  const flushAutosave = async (): Promise<void> => {
    clearAutosaveTimeout(autosaveDraft)
    await autosave.saveNow()
  }

  // Save immediately when an input loses focus to avoid delayed autosaves.
  const handleInputBlur = () => {
    void flushAutosave()
  }

  const handleFontSizeReset = async () => {
    clearAutosaveTimeout(autosaveDraft)

    try {
      setSystemSettingsDraftFontSizeInput(defaultFontSizeInput)
      autosaveDraft.dirty = true
      await autosave.saveNow()
    } catch (error) {
      console.error('Failed to reset system settings:', error)
    }
  }

  const handleMinLinesReset = async () => {
    clearAutosaveTimeout(autosaveDraft)

    try {
      setSystemSettingsDraftPromptEditorMinLinesInput(defaultMinLinesInput)
      autosaveDraft.dirty = true
      await autosave.saveNow()
    } catch (error) {
      console.error('Failed to reset system settings:', error)
    }
  }

  const validation = $derived(validateDraft())
  const displayFontSizeError = $derived(
    systemSettingsState.saveError ?? validation.fontSizeError
  )
  const displayMinLinesError = $derived(
    systemSettingsState.saveError ?? validation.minLinesError
  )
  const isFontSizeResetDisabled = $derived(
    isUpdating ||
      systemSettingsState.draftSnapshot.promptFontSizeInput ===
        defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating ||
      systemSettingsState.draftSnapshot.promptEditorMinLinesInput ===
        defaultMinLinesInput
  )

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
      <h1 class="text-2xl font-bold">System Settings</h1>
      <p class="mt-2 text-muted-foreground">
        Global settings saved on your local machine.
      </p>
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
            oninput={(event) =>
              handleFontSizeInput((event.currentTarget as HTMLInputElement).value)}
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
              handleMinLinesInput((event.currentTarget as HTMLInputElement).value)}
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
