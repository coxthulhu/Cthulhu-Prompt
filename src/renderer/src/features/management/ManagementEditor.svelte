<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { Trash2 } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'

  /** Heading, delete action, and fields for the selected draft of a management dialog. */
  type Props = {
    icon: ComponentType
    label: string
    detail: string
    deleteLabel: string
    deleteTestId: string
    disabled: boolean
    ondelete: () => void
    children: Snippet
  }

  /** Selected-draft heading and field content supplied by the owning dialog. */
  let { icon, label, detail, deleteLabel, deleteTestId, disabled, ondelete, children }: Props = $props()
</script>

<!-- Shared single-draft editor layout for category and project management. -->
<div class="min-w-0">
  <Row {icon} {label} {detail} class="mb-[22px]">
    {#snippet trailing()}
      <IconButton
        icon={Trash2}
        label={deleteLabel}
        title={deleteLabel}
        hoverVariant="danger"
        testId={deleteTestId}
        {disabled}
        onclick={ondelete}
      />
    {/snippet}
  </Row>

  <div class="grid gap-[17px]">
    {@render children()}
  </div>
</div>
