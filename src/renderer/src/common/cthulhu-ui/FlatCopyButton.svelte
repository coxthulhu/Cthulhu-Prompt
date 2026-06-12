<script lang="ts">
  import { Check, Copy } from 'lucide-svelte'
  import FlatIconButton, { type FlatIconButtonHoverVariant } from './FlatIconButton.svelte'

  type Props = {
    text: string
    label?: string
    copiedLabel?: string
    title?: string
    copiedTitle?: string
    resetDelayMs?: number
    hoverVariant?: FlatIconButtonHoverVariant
    class?: string
    iconClass?: string
    testId?: string
  }

  let {
    text,
    label = 'Copy',
    copiedLabel = 'Copied',
    title = label,
    copiedTitle = copiedLabel,
    resetDelayMs = 1500,
    hoverVariant = 'neutral',
    class: className,
    iconClass,
    testId
  }: Props = $props()

  let isCopied = $state(false)
  let resetTimeoutId: number | null = null

  const clearResetTimeout = () => {
    if (resetTimeoutId == null) {
      return
    }

    window.clearTimeout(resetTimeoutId)
    resetTimeoutId = null
  }

  const handleClick = async () => {
    await window.navigator.clipboard.writeText(text)
    isCopied = true

    clearResetTimeout()

    resetTimeoutId = window.setTimeout(() => {
      isCopied = false
      resetTimeoutId = null
    }, resetDelayMs)
  }

  // Side effect cleanup: clear the copied-state timer if the button unmounts.
  $effect(() => {
    return () => {
      clearResetTimeout()
    }
  })
</script>

<FlatIconButton
  icon={isCopied ? Check : Copy}
  label={isCopied ? copiedLabel : label}
  title={isCopied ? copiedTitle : title}
  {hoverVariant}
  class={className}
  {iconClass}
  {testId}
  onclick={handleClick}
/>
