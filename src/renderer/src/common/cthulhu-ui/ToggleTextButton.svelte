<script lang="ts">
  type Props = {
    pressed: boolean
    disabled?: boolean
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    pressed,
    disabled = false,
    testId,
    onclick
  }: Props = $props()

  // Keep this aligned with the existing settings toggle button styling.
  const getButtonClass = (isPressed: boolean) =>
    [
      'flex h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
      isPressed
        ? 'border-violet-300/30 bg-violet-500/14 text-violet-50'
        : 'border-white/12 bg-white/[0.06] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-white/10 hover:text-white'
    ].join(' ')

  const getTrackClass = (isPressed: boolean) =>
    [
      'flex h-6 w-10 items-center rounded-full p-1 transition',
      isPressed ? 'justify-end bg-violet-300/24' : 'justify-start bg-white/14'
    ].join(' ')
</script>

<button
  type="button"
  class={getButtonClass(pressed)}
  data-testid={testId}
  aria-pressed={pressed}
  {onclick}
  {disabled}
>
  <span class={getTrackClass(pressed)}>
    <span class="h-4 w-4 rounded-full bg-white shadow"></span>
  </span>
  <span class="w-[64px] text-left">
    {pressed ? 'Enabled' : 'Disabled'}
  </span>
</button>
