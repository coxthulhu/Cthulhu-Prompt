<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import Button, { type ButtonVariant } from './Button.svelte'
  import CardSurface from './CardSurface.svelte'
  import IconButton from './IconButton.svelte'
  import Separator from './Separator.svelte'
  import Title from './Title.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    open?: boolean
    title: string
    submitText: string
    cancelText?: string
    showCloseButton?: boolean
    showSubmitButton?: boolean
    showSeparators?: boolean
    closeOnOutsideClick?: boolean
    submitDisabled?: boolean
    cancelDisabled?: boolean
    submitTestId?: string
    cancelTestId?: string
    class?: string
    children?: Snippet
    submitVariant?: ButtonVariant
    oncancel?: () => void
    onsubmit?: () => void
  }

  let {
    open = $bindable(false),
    title,
    submitText,
    cancelText = 'Cancel',
    showCloseButton = true,
    showSubmitButton = true,
    showSeparators = true,
    closeOnOutsideClick = true,
    submitDisabled = false,
    cancelDisabled = false,
    submitTestId,
    cancelTestId,
    class: className,
    children,
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
    class="cthulhuUiDialogLayer"
    role="presentation"
    use:portalToBody
    onclick={handleOutsideClick}
  >
    <CardSurface
      variant="overlay"
      class={mergeClasses('cthulhuUiDialog flex flex-col p-4', className)}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="cthulhuUiDialogHeader">
        <Title {title} variant="dialog" />

        {#if showCloseButton}
          <IconButton icon={X} label="Close" disabled={cancelDisabled} onclick={closeDialog} />
        {/if}
      </div>

      {#if showSeparators}
        <Separator />
      {/if}

      {#if children}
        <div class="cthulhuUiDialogBody">
          {@render children()}
        </div>
      {/if}

      {#if showSeparators}
        <Separator />
      {/if}

      <div class="cthulhuUiDialogFooter">
        {#if showSubmitButton}
          <Button
            text={submitText}
            state={submitDisabled ? 'disabled' : 'enabled'}
            variant={submitVariant}
            testId={submitTestId}
            onclick={submitDialog}
          />
        {/if}
        <Button
          text={cancelText}
          state={cancelDisabled ? 'disabled' : 'enabled'}
          testId={cancelTestId}
          onclick={closeDialog}
        />
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
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 4px 12px;
  }

  .cthulhuUiDialogBody {
    min-width: 0;
  }

  .cthulhuUiDialogFooter {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    padding-top: 16px;
  }
</style>
