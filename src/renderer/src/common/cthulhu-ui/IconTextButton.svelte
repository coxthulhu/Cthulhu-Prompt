<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    text: string
    class?: string
    disabled?: boolean
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    class: className,
    disabled = false,
    testId,
    onclick
  }: Props = $props()

  // Keep this aligned with the existing settings secondary action button styling.
  const buttonClass =
    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50'
</script>

<button
  type="button"
  class={mergeClasses(buttonClass, className)}
  data-testid={testId}
  {onclick}
  {disabled}
>
  <Icon class="h-4 w-4" />
  {text}
</button>
