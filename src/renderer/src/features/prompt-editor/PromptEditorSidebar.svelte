<script lang="ts">
  import Button from '@renderer/common/ui/button/button.svelte'
  import { ChevronDown, ChevronUp } from 'lucide-svelte'

  let { onMoveUp, onMoveDown }: { onMoveUp: () => void; onMoveDown: () => void } = $props()
</script>

<div class="w-6 flex-shrink-0 flex flex-col">
  <Button
    variant="ghost"
    size="icon"
    class="flex-1 w-5 rounded-none border-none !px-0 py-1 bg-muted/30 hover:bg-accent/30 shadow-none"
    aria-label="Move prompt up"
    data-testid="prompt-move-up"
    onclick={onMoveUp}
  >
    <ChevronUp class="size-4 stroke-[3]" />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class="flex-1 w-5 rounded-none border-none !px-0 py-1 bg-muted/30 hover:bg-accent/30 shadow-none"
    aria-label="Move prompt down"
    data-testid="prompt-move-down"
    onclick={onMoveDown}
  >
    <ChevronDown class="size-4 stroke-[3]" />
  </Button>
</div>
