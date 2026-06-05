<script lang="ts">
  import { Check, X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import FlatButton, { type FlatButtonVariant } from './FlatButton.svelte'
  import FlatCardSurface from './FlatCardSurface.svelte'
  import FlatIconButton from './FlatIconButton.svelte'
  import FlatSeparator from './FlatSeparator.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    open?: boolean
    title: string
    submitText: string
    showCloseButton?: boolean
    showSubmitButton?: boolean
    closeOnOutsideClick?: boolean
    submitDisabled?: boolean
    cancelDisabled?: boolean
    submitTestId?: string
    cancelTestId?: string
    class?: string
    children?: Snippet
    cancelIcon?: ComponentType
    submitIcon?: ComponentType
    submitVariant?: FlatButtonVariant
    oncancel?: () => void
    onsubmit?: () => void
  }

  let {
    open = $bindable(false),
    title,
    submitText,
    showCloseButton = true,
    showSubmitButton = true,
    closeOnOutsideClick = true,
    submitDisabled = false,
    cancelDisabled = false,
    submitTestId,
    cancelTestId,
    class: className,
    children,
    cancelIcon = X,
    submitIcon = Check,
    submitVariant = 'accent',
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

{#if open}
  <div
    class="cthulhuUiFlatDialogLayer"
    role="presentation"
    use:portalToBody
    onclick={handleOutsideClick}
  >
    <FlatCardSurface
      class={mergeClasses('cthulhuUiFlatDialog flex flex-col p-4', className)}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="cthulhuUiFlatDialogHeader">
        <h2 class="cthulhuUiFlatDialogTitle">{title}</h2>

        {#if showCloseButton}
          <FlatIconButton
            icon={X}
            label="Close"
            disabled={cancelDisabled}
            onclick={closeDialog}
          />
        {/if}
      </div>

      <FlatSeparator />

      {#if children}
        <div class="cthulhuUiFlatDialogBody">
          {@render children()}
        </div>
      {/if}

      <FlatSeparator />

      <div class="cthulhuUiFlatDialogFooter">
        <FlatButton
          icon={cancelIcon}
          text="Cancel"
          state={cancelDisabled ? 'disabled' : 'enabled'}
          testId={cancelTestId}
          onclick={closeDialog}
        />
        {#if showSubmitButton}
          <FlatButton
            icon={submitIcon}
            text={submitText}
            state={submitDisabled ? 'disabled' : 'enabled'}
            variant={submitVariant}
            testId={submitTestId}
            onclick={submitDialog}
          />
        {/if}
      </div>
    </FlatCardSurface>
  </div>
{/if}

<style>
  .cthulhuUiFlatDialogLayer {
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

  :global(.cthulhuUiFlatDialog.cthulhuUiFlatCardSurface) {
    background:
      linear-gradient(
        var(--ui-card-normal-surface-gradient-start),
        var(--ui-card-normal-surface-gradient-end)
      ),
      var(--ui-card-solid-surface);
    border: 1px solid var(--ui-card-normal-border);
  }

  :global(.cthulhuUiFlatDialog) {
    max-height: calc(100vh - 32px);
    overflow: visible;
  }

  .cthulhuUiFlatDialogHeader {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 4px 12px;
  }

  .cthulhuUiFlatDialogTitle {
    color: var(--ui-normal-text);
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.2;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiFlatDialogBody {
    min-width: 0;
  }

  .cthulhuUiFlatDialogFooter {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    padding-top: 16px;
  }
</style>
