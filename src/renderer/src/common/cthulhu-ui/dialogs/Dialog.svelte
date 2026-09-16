<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import Button, { type ButtonVariant } from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

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
    showSeparators?: boolean
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
    children,
    secondaryActions,
    submitVariant = 'accent',
    submitIcon,
    oncancel,
    onsubmit
  }: Props = $props()

  const closeDialog = () => {
    if (cancelDisabled) {
      return
    }

    open = false
    oncancel?.()
  }

  const submitDialog = () => {
    if (submitDisabled) {
      return
    }

    onsubmit?.()
  }

  const handleOutsideClick = () => {
    if (!closeOnOutsideClick) {
      return
    }

    closeDialog()
  }

  const portalToBody: Action<HTMLDivElement> = (node) => {
    // Side effect: move overlays out of nested app containers so fixed positioning covers the viewport.
    document.body.appendChild(node)

    return {
      destroy() {
        node.remove()
      }
    }
  }

  // Side effect: close the open dialog when the user presses Escape.
  $effect(() => {
    if (!open) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog()
      }
    }

    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

{#snippet closeButton()}
  <IconButton icon={X} label="Close" disabled={cancelDisabled} onclick={closeDialog} />
{/snippet}

{#if open}
  <div
    class="cthulhuUiDialogLayer"
    role="presentation"
    use:portalToBody
    onclick={handleOutsideClick}
  >
    <CardSurface
      variant="overlay"
      class={mergeClasses(
        'cthulhuUiDialog flex flex-col px-4 pb-4',
        subtitle ? 'pt-[18px]' : 'pt-4',
        className
      )}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
    >
      <div
        class="cthulhuUiDialogHeader"
        data-has-subtitle={subtitle ? 'true' : 'false'}
      >
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
        <Separator />
      {/if}

      {#if children}
        <div class="cthulhuUiDialogBody" data-scrollable={scrollBody}>
          {@render children()}
        </div>
      {/if}

      {#if showSeparators}
        <Separator />
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
    </CardSurface>
  </div>
{/if}

<style>
  .cthulhuUiDialogLayer {
    -webkit-app-region: no-drag;
    align-items: center;
    background-color: var(--ui-card-normal-shadow);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 16px;
    position: fixed;
    z-index: 50;
  }

  :global(.cthulhuUiDialog) {
    max-height: calc(100vh - 32px);
    overflow: visible;
  }

  .cthulhuUiDialogHeader {
    min-width: 0;
    padding: 0 4px 12px;
  }

  .cthulhuUiDialogHeader[data-has-subtitle='true'] {
    padding-bottom: 16px;
  }

  .cthulhuUiDialogBody {
    min-width: 0;
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
    padding-top: 16px;
  }
</style>
