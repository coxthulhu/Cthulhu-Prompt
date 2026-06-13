<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import Row from './Row.svelte'

  type Props = {
    icon: ComponentType
    label: string
    detail: string
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
  {trailing}
  class={className}
  {iconClass}
  {labelTitle}
  {labelTestId}
  {testId}
/>
