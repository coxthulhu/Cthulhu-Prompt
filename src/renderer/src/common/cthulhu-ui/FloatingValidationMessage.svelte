<script lang="ts">
  import type { Snippet } from 'svelte'
  import MessageRow, { type MessageRowVariant } from './MessageRow.svelte'

  type Props = {
    children: Snippet
    message: string | null
    variant?: MessageRowVariant
    textTestId?: string
  }

  let { children, message, variant = 'error', textTestId }: Props = $props()
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
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='error']) {
    background-color: var(--background);
    background-image: linear-gradient(
      var(--ui-danger-normal-surface),
      var(--ui-danger-normal-surface)
    );
  }

  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='warning']) {
    background-color: var(--background);
    background-image: linear-gradient(
      var(--ui-warning-normal-surface),
      var(--ui-warning-normal-surface)
    );
  }
</style>
