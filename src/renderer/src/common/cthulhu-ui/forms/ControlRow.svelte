<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    icon?: ComponentType
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

<!-- Control rows own the inset used inside card surfaces. -->
<Row
  {icon}
  {label}
  {detail}
  {detailExtra}
  class={mergeClasses('cthulhuUiControlRow p-4', className)}
  {iconClass}
  {testId}
  trailingLayout="grouped"
>
  {#snippet trailing()}
    {#if control}
      <span class="cthulhuUiControlRowControl">
        {@render control()}
      </span>
    {/if}

    {#if actions}
      <span class="cthulhuUiControlRowActions">
        {@render actions()}
      </span>
    {/if}
  {/snippet}
</Row>

<style>
  .cthulhuUiControlRowControl,
  .cthulhuUiControlRowActions {
    align-items: center;
    display: flex;
    min-width: 0;
  }

  .cthulhuUiControlRowActions {
    gap: 8px;
  }
</style>
