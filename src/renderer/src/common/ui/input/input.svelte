<script lang="ts">
  import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements'
  import { cn, type WithElementRef } from '@renderer/common/Cn.js'

  type InputType = Exclude<HTMLInputTypeAttribute, 'file'>

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type'> &
      ({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
  >

  let {
    ref = $bindable(null),
    value = $bindable(),
    type,
    files = $bindable(),
    class: className,
    'data-slot': dataSlot = 'input',
    ...restProps
  }: Props = $props()
</script>

{#if type === 'file'}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn(
      'selection:bg-primary dark:bg-input/30 selection:text-primary-foreground border-input ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 min-w-0 rounded-md border bg-transparent px-3 pt-1.5 text-sm font-medium outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
      'placeholder:opacity-65 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      className
    )}
    type="file"
    bind:files
    bind:value
    {...restProps}
  />
{:else}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn(
      'flex h-9 min-w-0 rounded-2xl border border-white/12 bg-[#16181d] px-3 py-1 text-base text-zinc-50 outline-none transition-[color,box-shadow,background-color,border-color] selection:bg-primary selection:text-primary-foreground shadow-inner shadow-black/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
      'placeholder:text-zinc-400 focus-visible:border-white/28 focus-visible:ring-[3px] focus-visible:ring-white/14',
      'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      className
    )}
    {type}
    bind:value
    {...restProps}
  />
{/if}
