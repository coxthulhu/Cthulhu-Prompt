<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import IconPillSurface from './IconPillSurface.svelte'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    text: string
    icon?: ComponentType
    valueTitle?: string
    valueTestId?: string
  }

  let {
    label,
    text,
    icon: Icon,
    valueTitle,
    valueTestId,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<IconPillSurface {label} icon={Icon} class={className} {...restProps}>
  <div
    class="cthulhuUiLabeledDisplayFieldValue min-w-0 truncate"
    data-testid={valueTestId}
    title={valueTitle}
  >
    {text}
  </div>
</IconPillSurface>

<style>
  .cthulhuUiLabeledDisplayFieldValue {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 650;
    line-height: 20px;
  }

  .cthulhuUiLabeledDisplayFieldValue::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }
</style>
