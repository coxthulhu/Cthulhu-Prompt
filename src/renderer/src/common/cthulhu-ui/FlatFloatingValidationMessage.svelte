<script lang="ts">
  import type { Snippet } from 'svelte'
  import FlatMessageRow, { type FlatMessageRowVariant } from './FlatMessageRow.svelte'

  type Props = {
    children: Snippet
    message: string | null
    variant?: FlatMessageRowVariant
    textTestId?: string
  }

  let { children, message, variant = 'danger', textTestId }: Props = $props()
</script>

<div class="cthulhuUiFlatFloatingValidationMessage relative">
  {@render children()}
  {#if message}
    <!-- Anchor validation to the field so it floats outside the surrounding layout flow. -->
    <FlatMessageRow
      class="cthulhuUiFlatFloatingValidationMessageRow absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap"
      {variant}
      text={message}
      {textTestId}
    />
  {/if}
</div>

<style>
  .cthulhuUiFlatFloatingValidationMessage
    :global(.cthulhuUiFlatFloatingValidationMessageRow.cthulhuUiFlatMessageRow) {
    box-shadow: 0 8px 18px var(--ui-flat-card-normal-shadow);
  }

  .cthulhuUiFlatFloatingValidationMessage
    :global(.cthulhuUiFlatFloatingValidationMessageRow.cthulhuUiFlatMessageRow[data-variant='danger']) {
    background: color-mix(
      in oklch,
      var(--ui-flat-card-solid-surface) 76%,
      var(--ui-flat-danger-strong-border)
    );
  }

  .cthulhuUiFlatFloatingValidationMessage
    :global(.cthulhuUiFlatFloatingValidationMessageRow.cthulhuUiFlatMessageRow[data-variant='warning']) {
    background: color-mix(
      in oklch,
      var(--ui-flat-card-solid-surface) 76%,
      var(--ui-flat-warning-normal-border)
    );
  }
</style>
