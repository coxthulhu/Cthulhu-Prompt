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
    color: var(--ui-default-text);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
  }

  .cthulhuUiLabeledDisplayFieldValue::selection {
    background-color: var(--ui-selection-surface);
    color: var(--ui-emphasis-text);
  }
</style>
