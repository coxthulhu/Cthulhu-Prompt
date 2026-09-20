<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    icon?: ComponentType
    label: string
    detail: string
    wrapDetail?: boolean
    trailing?: Snippet
    class?: string
    iconClass?: string
    labelTitle?: string
    labelTestId?: string
    testId?: string
  }

  let {
    icon,
    label,
    detail,
    wrapDetail = false,
    trailing,
    class: className,
    iconClass,
    labelTitle,
    labelTestId,
    testId
  }: Props = $props()
</script>

<!-- Display rows own the inset used inside card surfaces. -->
<Row
  {icon}
  {label}
  {detail}
  {wrapDetail}
  {trailing}
  class={mergeClasses('cthulhuUiDisplayRow p-4', className)}
  {iconClass}
  {labelTitle}
  {labelTestId}
  {testId}
/>
