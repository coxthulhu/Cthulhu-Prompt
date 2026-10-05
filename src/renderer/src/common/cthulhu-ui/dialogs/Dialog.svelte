<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import Button, { type ButtonVariant } from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import Popup from '@renderer/common/cthulhu-ui/dialogs/Popup.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** Dialog content and footer actions presented by the shared Popup base. */
  type Props = {
    open?: boolean
    icon: ComponentType
    title: string
    subtitle?: string
    submitText: string
    cancelText?: string
    showCloseButton?: boolean
    showSubmitButton?: boolean
    /** Allows informational dialogs to omit the footer Cancel action. */
    showCancelButton?: boolean
    /** Keeps long content scrollable within the available dialog height. */
    scrollBody?: boolean
    /** 'hidden' preserves divider space without drawing the lines; false removes them. */
    showSeparators?: boolean | 'hidden'
    closeOnOutsideClick?: boolean
    submitDisabled?: boolean
    cancelDisabled?: boolean
    submitTestId?: string
    cancelTestId?: string
    class?: string
    children?: Snippet
    /** Additional footer actions placed before the primary action. */
    secondaryActions?: Snippet
    submitVariant?: ButtonVariant
    // Optional leading icon for the primary action.
    submitIcon?: ComponentType
    oncancel?: () => void
    onsubmit?: () => void
  }

  /** Reactive dialog content, actions, and cancellation state. */
  let {
    open = $bindable(false),
    icon: Icon,
    title,
    subtitle,
    submitText,
    cancelText = 'Cancel',
    showCloseButton = true,
    showSubmitButton = true,
    showCancelButton = true,
    scrollBody = false,
    showSeparators = true,
    closeOnOutsideClick = false,
    submitDisabled = false,
    cancelDisabled = false,
    submitTestId,
    cancelTestId,
    class: className,
    children: body,
    secondaryActions,
    submitVariant = 'accent',
    submitIcon,
    oncancel,
    onsubmit
  }: Props = $props()

  /** Invokes the primary action only while submission is enabled. */
  const submitDialog = () => {
    if (submitDisabled) {
      return
    }

    onsubmit?.()
  }
</script>

<!-- Dialog layout delegates all overlay and dismissal behavior to Popup. -->
<Popup
  bind:open
  {title}
  layerClass="cthulhuUiDialogLayer"
  class={mergeClasses(
    'cthulhuUiDialog flex flex-col pb-4',
    subtitle ? 'pt-[18px]' : 'pt-4',
    className
  )}
  closeDisabled={cancelDisabled}
  {closeOnOutsideClick}
  onclose={oncancel}
>
  {#snippet children(closeDialog)}
    {#snippet closeButton()}
      <IconButton icon={X} label="Close" disabled={cancelDisabled} onclick={closeDialog} />
    {/snippet}
    <div class="cthulhuUiDialogHeader" data-has-subtitle={subtitle ? 'true' : 'false'}>
      <Row
        variant="dialog-heading"
        icon={Icon}
        label={title}
        detail={subtitle}
        wrapDetail
        iconTestId="dialog-header-icon"
        detailTestId="dialog-subtitle"
        trailing={showCloseButton ? closeButton : undefined}
      />
    </div>

    {#if showSeparators}
      <Separator class="cthulhuUiDialogSeparator" data-hidden={showSeparators === 'hidden'} />
    {/if}

    {#if body}
      <div class="cthulhuUiDialogBody" data-scrollable={scrollBody}>
        {@render body()}
      </div>
    {/if}

    {#if showSeparators}
      <Separator class="cthulhuUiDialogSeparator" data-hidden={showSeparators === 'hidden'} />
    {/if}

    <div class="cthulhuUiDialogFooter">
      {#if showCancelButton}
        <Button
          text={cancelText}
          state={cancelDisabled ? 'disabled' : 'enabled'}
          testId={cancelTestId}
          onclick={closeDialog}
        />
      {/if}
      {#if secondaryActions}
        {@render secondaryActions()}
      {/if}
      {#if showSubmitButton}
        <Button
          icon={submitIcon}
          text={submitText}
          state={submitDisabled ? 'disabled' : 'enabled'}
          variant={submitVariant}
          testId={submitTestId}
          onclick={submitDialog}
        />
      {/if}
    </div>
  {/snippet}
</Popup>

<style>
  :global(.cthulhuUiDialogSeparator[data-hidden='true']) {
    visibility: hidden;
  }

  .cthulhuUiDialogHeader {
    min-width: 0;
    padding: 0 20px 12px;
  }

  .cthulhuUiDialogHeader[data-has-subtitle='true'] {
    padding-bottom: 16px;
  }

  .cthulhuUiDialogBody {
    min-width: 0;
    padding-inline: 16px;
  }

  .cthulhuUiDialogBody[data-scrollable='true'] {
    min-height: 0;
    overflow-y: auto;
  }

  .cthulhuUiDialogFooter {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    padding: 16px 16px 0;
  }
</style>
