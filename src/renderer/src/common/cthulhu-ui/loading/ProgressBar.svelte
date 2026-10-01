<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    value: number
    label: string
    detail?: string
    ariaLabel?: string
  }

  let { value, label, detail, ariaLabel, class: className, ...restProps }: Props = $props()

  const id = $props.id()
  // Keep the fill, visible percentage, and accessible value in the same valid range.
  const progress = $derived(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0)
</script>

<div
  class={mergeClasses('cthulhuUiProgressBar min-w-0 text-sm leading-5', className)}
  {...restProps}
>
  <div class="cthulhuUiProgressBarHeader flex items-center justify-between gap-2">
    <span id={`${id}-label`}>{label}</span>
    <span class="shrink-0 font-semibold tabular-nums">{progress}%</span>
  </div>
  <div
    class="cthulhuUiProgressBarTrack"
    role="progressbar"
    aria-label={ariaLabel}
    aria-labelledby={ariaLabel ? undefined : `${id}-label`}
    aria-describedby={detail ? `${id}-detail` : undefined}
    aria-valuenow={progress}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div class="cthulhuUiProgressBarFill" style:width={`${progress}%`}></div>
  </div>
  {#if detail}
    <div id={`${id}-detail`} class="cthulhuUiProgressBarDetail mt-2">{detail}</div>
  {/if}
</div>

<style>
  .cthulhuUiProgressBar {
    color: var(--ui-normal-text);
  }

  .cthulhuUiProgressBarHeader {
    margin-bottom: 10px;
  }

  .cthulhuUiProgressBarTrack {
    background: var(--ui-neutral-emphasis-surface);
    border-radius: 3px;
    height: 5px;
    overflow: hidden;
  }

  .cthulhuUiProgressBarFill {
    background: var(--ui-accent-link-text);
    border-radius: inherit;
    height: 100%;
  }

  .cthulhuUiProgressBarDetail {
    color: var(--ui-muted-text);
  }
</style>
