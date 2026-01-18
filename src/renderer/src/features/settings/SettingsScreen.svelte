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

  const settingsQuery = $derived(useSystemSettingsQuery())
  const { mutateAsync: updateSystemSettings, isPending: isUpdating } =
    useUpdateSystemSettingsMutation()

  const currentFontSize = $derived(
    settingsQuery.data?.promptFontSize ?? DEFAULT_SYSTEM_SETTINGS.promptFontSize
  )
  const isLoading = $derived(!settingsQuery.data && settingsQuery.isFetching)

  let fontSizeInput = $state(String(DEFAULT_SYSTEM_SETTINGS.promptFontSize))
  let hasInteracted = $state(false)
  let isDirty = $state(false)
  let errorMessage = $state<string | null>(null)

  // Side effect: keep the local input in sync with persisted settings when not editing.
  $effect(() => {
    if (isDirty) return
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
    fontSizeInput = value
    hasInteracted = true
    isDirty = value !== String(currentFontSize)
    if (errorMessage) {
      errorMessage = null
    }
  }

  const handleSave = async () => {
    const validationError = validateFontSize(fontSizeInput)

    if (validationError) {
      errorMessage = validationError
      return
    }

    const parsed = Math.round(Number(fontSizeInput))

    try {
      await updateSystemSettings({
        settings: {
          promptFontSize: parsed
        }
      })

      fontSizeInput = String(parsed)
      isDirty = false
      hasInteracted = false
      errorMessage = null
    } catch (error) {
      console.error('Failed to update system settings:', error)
      errorMessage = 'Unable to save settings. Please try again.'
    }
  }

  const validationMessage = $derived(hasInteracted ? validateFontSize(fontSizeInput) : null)
  const displayError = $derived(errorMessage ?? validationMessage)
  const isSaveDisabled = $derived(isLoading || isUpdating || !isDirty || Boolean(displayError))
</script>

<section class="flex-1 p-6 space-y-6" data-testid="settings-screen">
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
        <Button
          data-testid="font-size-save"
          size="sm"
          onclick={handleSave}
          disabled={isSaveDisabled}
        >
          {isUpdating ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>

    {#if displayError}
      <p class="mt-3 text-sm text-red-500" data-testid="font-size-error">{displayError}</p>
    {/if}
  </div>
</section>
