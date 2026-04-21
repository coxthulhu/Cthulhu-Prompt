<script lang="ts">
  import type { ComponentType } from 'svelte'
  import IconPillSurface from './IconPillSurface.svelte'

  type Props = {
    label: string
    text: string
    icon: ComponentType
  }

  let { label, text, icon: Icon }: Props = $props()
</script>

<IconPillSurface {label} icon={Icon} gapClass="gap-3.5">
  <div class="cthulhuUiNumericStatCardText">{text}</div>
</IconPillSurface>

<style>
  .cthulhuUiNumericStatCardText {
    color: var(--ui-normal-text);
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1;
  }
</style>
