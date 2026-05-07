<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import IconPillButton from '@renderer/common/cthulhu-ui/IconPillButton.svelte'
  import { Separator } from '@renderer/common/ui/separator'
  import { PROMPT_DIVIDER_ROW_HEIGHT_PX } from './promptDividerSizing'

  let {
    onAddPrompt,
    disabled = false,
    testId
  }: { onAddPrompt?: () => void; disabled?: boolean; testId?: string } = $props()
</script>

<div class="grid items-center" style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}>
  <div class="grid min-h-9 grid-cols-[minmax(24px,1fr)_auto_minmax(24px,1fr)] items-center gap-2.5">
    <Separator class="bg-[var(--ui-neutral-muted-border)]" />
    <IconPillButton
      icon={Plus}
      text="Add prompt"
      variant="accent"
      iconClass="stroke-[3]"
      {disabled}
      {testId}
      onclick={() => {
        onAddPrompt?.()
      }}
    />
    <!-- Add subfolder is parked until prompt folders support nested creation. -->
    <Separator class="bg-[var(--ui-neutral-muted-border)]" />
  </div>
</div>
