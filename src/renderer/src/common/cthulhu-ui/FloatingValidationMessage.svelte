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
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow) {
    box-shadow: 0 8px 18px var(--ui-card-normal-shadow);
  }

  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='danger']) {
    background: color-mix(
      in oklch,
      var(--ui-card-solid-surface) 76%,
      var(--ui-danger-strong-border)
    );
  }

  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-variant='warning']) {
    background: color-mix(
      in oklch,
      var(--ui-card-solid-surface) 76%,
      var(--ui-warning-normal-border)
    );
  }
</style>
