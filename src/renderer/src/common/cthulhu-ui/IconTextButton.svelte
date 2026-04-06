<script lang="ts">
  import type { ComponentType } from 'svelte'

  type Props = {
    icon: ComponentType
    text: string
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    disabled = false,
    onclick
  }: Props = $props()

  // Keep this aligned with the existing settings secondary action button styling.
  const buttonClass =
    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
</script>

<button type="button" class={buttonClass} {onclick} {disabled}>
  <Icon class="h-4 w-4" />
  {text}
</button>
