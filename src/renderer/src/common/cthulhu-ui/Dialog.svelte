<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import Button, { type ButtonVariant } from './Button.svelte'
  import CardSurface from './CardSurface.svelte'
  import IconButton from './IconButton.svelte'
  import Separator from './Separator.svelte'
  import Title from './Title.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    open?: boolean
    icon: ComponentType
    title: string
    subtitle?: string
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
    icon: Icon,
    title,
    subtitle,
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
        <div class="cthulhuUiDialogHeading">
          <div class="cthulhuUiDialogIcon" data-testid="dialog-header-icon">
            <Icon size={24} aria-hidden="true" />
          </div>
          <div class="cthulhuUiDialogHeadingText">
            <Title {title} variant="dialog" />
            {#if subtitle}
              <p class="cthulhuUiDialogSubtitle" data-testid="dialog-subtitle">{subtitle}</p>
            {/if}
          </div>
        </div>

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
    align-items: flex-start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 4px 12px;
  }

  .cthulhuUiDialogHeader[data-has-subtitle='true'] {
    padding-bottom: 16px;
  }

  .cthulhuUiDialogHeader[data-has-subtitle='true']
    :global(.cthulhuUiTitle[data-variant='dialog']) {
    line-height: 24px;
  }

  .cthulhuUiDialogHeading {
    align-items: center;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .cthulhuUiDialogIcon {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    flex: 0 0 38px;
    height: 38px;
    justify-content: center;
    width: 38px;
  }

  .cthulhuUiDialogHeadingText {
    min-width: 0;
  }

  .cthulhuUiDialogSubtitle {
    color: var(--ui-muted-text);
    font-size: 13px;
    line-height: 19px;
    margin: 3px 0 0;
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
