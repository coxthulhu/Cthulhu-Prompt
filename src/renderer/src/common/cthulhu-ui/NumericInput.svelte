<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { mergeClasses } from './mergeClasses'

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type' | 'inputmode' | 'pattern' | 'value' | 'oninput' | 'files'> & {
      value?: string
      oninput?: (event: Event) => void
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    class: className,
    oninput: onInput,
    ...restProps
  }: Props = $props()

  const sanitizeNumeric = (raw: string) => raw.replace(/\D/g, '')

  // Keep input digits-only by stripping non-numeric characters.
  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const sanitized = sanitizeNumeric(target.value)

    if (target.value !== sanitized) {
      target.value = sanitized
    }

    value = sanitized
    onInput?.(event)
  }
</script>

<input
  bind:this={ref}
  class={mergeClasses(
    'flex h-9 min-w-0 rounded-2xl border border-white/12 bg-[#16181d] px-3 py-1 text-base text-zinc-50 outline-none transition-[color,box-shadow,background-color,border-color] selection:bg-primary selection:text-primary-foreground shadow-inner shadow-black/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    'placeholder:text-zinc-400 focus-visible:border-white/28 focus-visible:ring-[3px] focus-visible:ring-white/14',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    className
  )}
  type="text"
  inputmode="numeric"
  pattern="[0-9]*"
  bind:value
  oninput={handleInput}
  {...restProps}
/>
