<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import Row from './Row.svelte'

  type Props = {
    icon: ComponentType
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

<Row
  {icon}
  {label}
  {detail}
  {wrapDetail}
  {trailing}
  class={className}
  {iconClass}
  {labelTitle}
  {labelTestId}
  {testId}
/>
