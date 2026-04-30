<script lang="ts">
  import type { Snippet } from 'svelte'
  import MessageRow, { type MessageRowTone } from './MessageRow.svelte'

  type Props = {
    children: Snippet
    message: string | null
    tone?: MessageRowTone
    textTestId?: string
  }

  let { children, message, tone = 'danger', textTestId }: Props = $props()
</script>

<div class="cthulhuUiFloatingValidationMessage relative">
  {@render children()}
  {#if message}
    <!-- Anchor validation to the field so it floats outside the surrounding layout flow. -->
    <MessageRow
      class="cthulhuUiFloatingValidationMessageRow absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap"
      {tone}
      text={message}
      {textTestId}
    />
  {/if}
</div>

<style>
  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-tone='danger']) {
    background-color: var(--background);
    background-image: linear-gradient(
      var(--ui-danger-normal-surface),
      var(--ui-danger-normal-surface)
    );
  }

  .cthulhuUiFloatingValidationMessage
    :global(.cthulhuUiFloatingValidationMessageRow.cthulhuUiMessageRow[data-tone='warning']) {
    background-color: var(--background);
    background-image: linear-gradient(
      var(--ui-warning-normal-surface),
      var(--ui-warning-normal-surface)
    );
  }
</style>
