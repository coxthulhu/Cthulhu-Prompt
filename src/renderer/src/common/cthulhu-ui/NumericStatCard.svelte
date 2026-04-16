<script lang="ts">
  import type { ComponentType } from 'svelte'
  import CardSurface from './CardSurface.svelte'

  type Props = {
    label: string
    text: string
    icon: ComponentType
  }

  let { label, text, icon: Icon }: Props = $props()
</script>

<CardSurface variant="subcard" class="flex min-h-0 min-w-0 items-center gap-3 px-4 py-4">
  <div class="cthulhuUiNumericStatCardIcon">
    <Icon class="h-5 w-5" />
  </div>

  <div class="min-w-0">
    <div class="cthulhuUiNumericStatCardLabel">{label}</div>
    <div class="cthulhuUiNumericStatCardText">{text}</div>
  </div>
</CardSurface>

<style>
  .cthulhuUiNumericStatCardIcon {
    align-items: center;
    background-color: var(--ui-accent-icon-surface);
    border-radius: 1rem;
    box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
    color: var(--ui-accent-icon);
    display: flex;
    flex: 0 0 auto;
    height: 2.75rem;
    justify-content: center;
    width: 2.75rem;
  }

  .cthulhuUiNumericStatCardLabel {
    color: var(--ui-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.1;
  }

  .cthulhuUiNumericStatCardText {
    color: var(--ui-text-bright);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1;
    margin-top: 0.375rem;
  }
</style>
