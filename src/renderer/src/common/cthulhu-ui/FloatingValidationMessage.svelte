<script lang="ts">
  import type { Snippet } from 'svelte'
  import MessageRow, { type MessageRowVariant } from './MessageRow.svelte'

  type Props = {
    children: Snippet
    message: string | null
    variant?: MessageRowVariant
    textTestId?: string
  }

  let { children, message, variant = 'danger', textTestId }: Props = $props()
</script>

<div class="cthulhuUiFloatingValidationMessage relative">
  {@render children()}
  {#if message}
    <!-- Anchor validation to the field so it floats outside the surrounding layout flow. -->
    <MessageRow
      class="cthulhuUiFloatingValidationMessageRow absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap"
      {variant}
      text={message}
      {textTestId}
    />
  {/if}
</div>

<style>
  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='danger']) {
    background: var(--ui-danger-normal-surface);
  }

  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='warning']) {
    background: var(--ui-warning-normal-surface);
  }
</style>
