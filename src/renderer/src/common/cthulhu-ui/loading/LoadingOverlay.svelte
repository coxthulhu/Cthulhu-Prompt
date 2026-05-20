<script lang="ts">
  import { Loader } from 'lucide-svelte'
  import { mergeClasses } from '../mergeClasses'

  let {
    fadeMs = 125,
    isFading = false,
    message = 'Loading...',
    testId,
    fullscreen = false
  } = $props<{
    fadeMs?: number
    isFading?: boolean
    message?: string
    testId?: string
    fullscreen?: boolean
  }>()

  const positionClass = $derived(fullscreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-10')
</script>

<div
  data-testid={testId}
  data-fading={isFading ? 'true' : undefined}
  class={mergeClasses(
    'cthulhuUiLoadingOverlay flex items-center justify-center bg-background transition-opacity',
    positionClass
  )}
  style={`transition-duration: ${fadeMs}ms;`}
>
  <div class="flex flex-col items-center gap-3 text-muted-foreground">
    <Loader class="size-6 animate-spin" />
    <p class="text-sm font-medium">{message}</p>
  </div>
</div>

<style>
  .cthulhuUiLoadingOverlay {
    opacity: 1;
  }

  .cthulhuUiLoadingOverlay[data-fading='true'] {
    opacity: 0;
    pointer-events: none;
  }
</style>
