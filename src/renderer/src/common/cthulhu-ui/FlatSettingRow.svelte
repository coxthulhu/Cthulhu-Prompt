<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import FlatRow from './FlatRow.svelte'

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

<FlatRow
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
      <span class="cthulhuUiFlatSettingRowControl">
        {@render control()}
      </span>
    {/if}

    {#if actions}
      <span class="cthulhuUiFlatSettingRowActions">
        {@render actions()}
      </span>
    {/if}
  {/snippet}
</FlatRow>

<style>
  .cthulhuUiFlatSettingRowControl,
  .cthulhuUiFlatSettingRowActions {
    align-items: center;
    display: flex;
    min-width: 0;
  }

  .cthulhuUiFlatSettingRowActions {
    gap: 8px;
  }
</style>
