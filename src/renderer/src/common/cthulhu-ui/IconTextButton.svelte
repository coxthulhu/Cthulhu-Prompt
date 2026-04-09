<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'enabled' | 'active' | 'inactive' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    state?: ButtonState
    class?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    state = 'enabled',
    class: className,
    testId,
    onclick
  }: Props = $props()

  const getButtonClass = (buttonState: ButtonState) =>
    [
      'inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
      buttonState === 'active'
        ? 'border-white/16 bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
        : buttonState === 'inactive'
          ? 'border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-zinc-200'
          : 'border-white/12 bg-white/[0.06] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-white/10 hover:text-white'
    ].join(' ')

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses(getButtonClass(state), className)}
  data-active={state === 'active'}
  data-state={state}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
>
  <Icon class="h-4 w-4" />
  {text}
</button>
