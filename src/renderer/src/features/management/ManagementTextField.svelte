<script lang="ts">
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/forms/FloatingValidationMessage.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'

  /** Labeled single-line draft field with optional required marker and validation. */
  type Props = {
    id: string
    title: string
    help: string
    required?: boolean
    value: string
    errorMessage?: string | null
    errorTestId?: string
    maxlength?: number
    disabled: boolean
    ref?: HTMLInputElement | null
    oninput?: () => void
  }

  /** Field configuration and bound draft value supplied by the management editor. */
  let {
    id,
    title,
    help,
    required = false,
    value = $bindable(),
    errorMessage = null,
    errorTestId,
    maxlength,
    disabled,
    ref = $bindable(null),
    oninput
  }: Props = $props()
</script>

<!-- Shared management-dialog text field; the input ID doubles as its test ID. -->
<div>
  <TitleSubtitleStack class="mb-[7px]">
    <div class="flex items-center gap-1">
      <Title {title} variant="small" />
      {#if required}
        <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
      {/if}
    </div>
    <Subtitle id={`${id}-help`} text={help} />
  </TitleSubtitleStack>
  <FloatingValidationMessage message={errorMessage} textTestId={errorTestId}>
    <TextInput
      bind:ref
      {id}
      class="w-full"
      data-testid={id}
      bind:value
      aria-label={title}
      aria-invalid={errorMessage ? 'true' : undefined}
      aria-describedby={`${id}-help`}
      {maxlength}
      {disabled}
      {oninput}
    />
  </FloatingValidationMessage>
</div>
