<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import { Input } from '@renderer/common/ui/input'
  import {
    useSystemSettingsQuery,
    useUpdateSystemSettingsMutation
  } from '@renderer/api/systemSettings'
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
  import { registerSystemSettingsAutosave } from '@renderer/data/systemSettingsAutosave'

  const settingsQuery = $derived(useSystemSettingsQuery())
  const { mutateAsync: updateSystemSettings, isPending: isUpdating } =
    useUpdateSystemSettingsMutation()

  const currentFontSize = $derived(
    settingsQuery.data?.promptFontSize ?? DEFAULT_SYSTEM_SETTINGS.promptFontSize
  )
  const isLoading = $derived(!settingsQuery.data && settingsQuery.isFetching)

  let fontSizeInput = $state(String(DEFAULT_SYSTEM_SETTINGS.promptFontSize))
  let hasInteracted = $state(false)
  let errorMessage = $state<string | null>(null)
  const autosaveDraft = $state<AutosaveDraft>({
    dirty: false,
    saving: false,
    autosaveTimeoutId: null
  })

  const autosave = createAutosaveController({
    draft: autosaveDraft,
    autosaveMs: AUTOSAVE_MS,
    save: async () => {
      const validationError = validateFontSize(fontSizeInput)

      if (validationError) {
        return
      }

      const valueToSave = fontSizeInput
      const parsed = Math.round(Number(valueToSave))

      try {
        await updateSystemSettings({
          settings: {
            promptFontSize: parsed
          }
        })

        if (fontSizeInput === valueToSave) {
          fontSizeInput = String(parsed)
          autosaveDraft.dirty = false
          hasInteracted = false
          errorMessage = null
        }
      } catch (error) {
        console.error('Failed to update system settings:', error)
        errorMessage = 'Unable to save settings. Please try again.'
      }
    }
  })

  // Side effect: keep the local input in sync with persisted settings when not editing.
  $effect(() => {
    if (autosaveDraft.dirty) return
    fontSizeInput = String(currentFontSize)
    hasInteracted = false
    errorMessage = null
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
    if (fontSizeInput === value) return
    fontSizeInput = value
    hasInteracted = true
    if (errorMessage) {
      errorMessage = null
    }
    autosave.markDirtyAndScheduleAutosave()
  }

  const handleReset = async () => {
    const defaultValue = DEFAULT_SYSTEM_SETTINGS.promptFontSize
    clearAutosaveTimeout(autosaveDraft)

    try {
      await updateSystemSettings({
        settings: {
          promptFontSize: defaultValue
        }
      })

      fontSizeInput = String(defaultValue)
      autosaveDraft.dirty = false
      hasInteracted = false
      errorMessage = null
    } catch (error) {
      console.error('Failed to reset system settings:', error)
      errorMessage = 'Unable to reset settings. Please try again.'
    }
  }

  const validationMessage = $derived(hasInteracted ? validateFontSize(fontSizeInput) : null)
  const displayError = $derived(errorMessage ?? validationMessage)
  const isResetDisabled = $derived(
    isLoading || isUpdating || fontSizeInput === String(DEFAULT_SYSTEM_SETTINGS.promptFontSize)
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
            Sets the default font size used in the prompt editor.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <Input
            data-testid="font-size-input"
            type="number"
            min={MIN_PROMPT_FONT_SIZE}
            max={MAX_PROMPT_FONT_SIZE}
            step={1}
            class="w-24"
            value={fontSizeInput}
            disabled={isLoading}
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
