<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import Row from './Row.svelte'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
    detailExtra?: Snippet
    control?: Snippet
    actions?: Snippet
    class?: string
    iconClass?: string
    testId?: string
  }

  let {
    icon,
    label,
    detail,
    detailExtra,
    control,
    actions,
    class: className,
    iconClass,
    testId
  }: Props = $props()
</script>

<Row
  {icon}
  {label}
  {detail}
  {detailExtra}
  class={className}
  {iconClass}
  {testId}
  trailingLayout="grouped"
>
  {#snippet trailing()}
    {#if control}
      <span class="cthulhuUiSettingRowControl">
        {@render control()}
      </span>
    {/if}

    {#if actions}
      <span class="cthulhuUiSettingRowActions">
        {@render actions()}
      </span>
    {/if}
  {/snippet}
</Row>

<style>
  .cthulhuUiSettingRowControl,
  .cthulhuUiSettingRowActions {
    align-items: center;
    display: flex;
    min-width: 0;
  }

  .cthulhuUiSettingRowActions {
    gap: 8px;
  }
</style>
