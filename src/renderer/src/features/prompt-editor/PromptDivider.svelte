<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import { Button } from '@renderer/common/ui/button'
  import { Separator } from '@renderer/common/ui/separator'

  let {
    onAddPrompt,
    disabled = false,
    testId
  }: { onAddPrompt?: () => void; disabled?: boolean; testId?: string } = $props()
</script>

<div class="flex items-center">
  <Button
    variant="ghost"
    size="xs"
    class="w-5 mr-2 p-1 rounded-none disabled:opacity-100"
    {disabled}
    data-testid={testId}
    onclick={() => {
      onAddPrompt?.()
    }}
  >
    <Plus class="h-4 w-4 text-white stroke-[3]" />
  </Button>
  <Separator class="flex-1 opacity-50" />
</div>
