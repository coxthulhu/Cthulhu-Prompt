<script lang="ts">
  import { Check } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import ManagementSelectorPanel, {
    type ManagementSelectorPanelItem
  } from '@renderer/common/cthulhu-ui/selectors/ManagementSelectorPanel.svelte'

  /** Multi-item management dialog with a selector list and a batched Save Changes action. */
  type Props = {
    open?: boolean
    icon: ComponentType
    title: string
    subtitle: string
    listLabel: string
    items: ManagementSelectorPanelItem[]
    selectedId: string | null
    addText: string
    itemTestIdPrefix: string
    addTestId: string
    submitTestId: string
    cancelTestId: string
    isSubmitting: boolean
    canSubmit: boolean
    submissionError: string | null
    onselect: (id: string) => void
    onadd: () => void
    oncancel: () => void
    onsubmit: () => void
    /** Editor for the selected draft, shown beside the selector list. */
    children: Snippet
  }

  /** Dialog content, draft list, and actions supplied by the owning management workflow. */
  let {
    open = $bindable(false),
    icon,
    title,
    subtitle,
    listLabel,
    items,
    selectedId,
    addText,
    itemTestIdPrefix,
    addTestId,
    submitTestId,
    cancelTestId,
    isSubmitting,
    canSubmit,
    submissionError,
    onselect,
    onadd,
    oncancel,
    onsubmit,
    children
  }: Props = $props()
</script>

<!-- Shared layout for dialogs that edit several retained drafts and save them together. -->
<Dialog
  bind:open
  {icon}
  {title}
  {subtitle}
  class="w-[1040px] max-w-[calc(100vw-32px)]"
  submitText={isSubmitting ? 'Saving...' : 'Save Changes'}
  cancelText="Close"
  submitIcon={Check}
  submitDisabled={!canSubmit}
  cancelDisabled={isSubmitting}
  {submitTestId}
  {cancelTestId}
  {oncancel}
  {onsubmit}
>
  <div class="cthulhuUiManagementDialogBody text-sm leading-5">
    <ManagementSelectorPanel
      label={listLabel}
      {items}
      {selectedId}
      {addText}
      {itemTestIdPrefix}
      {addTestId}
      {onselect}
      {onadd}
    />

    <div class="cthulhuUiManagementDialogEditor">
      {#if submissionError}
        <p class="mb-3 text-sm leading-5 text-[var(--ui-danger-icon-glyph)]" data-testid="management-dialog-error">
          {submissionError}
        </p>
      {/if}
      {@render children()}
    </div>
  </div>
</Dialog>

<style>
  .cthulhuUiManagementDialogBody {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    height: min(570px, calc(100vh - 212px));
    min-height: 240px;
  }

  .cthulhuUiManagementDialogEditor {
    min-width: 0;
    overflow: auto;
    padding: 16px 8px 22px 26px;
  }
</style>
