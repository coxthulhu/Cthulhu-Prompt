<script lang="ts">
  import { Check, X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import CardSurface from './CardSurface.svelte'
  import IconOnlyButton from './IconOnlyButton.svelte'
  import IconTextButton from './IconTextButton.svelte'
  import TitleBlock from './TitleBlock.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    open?: boolean
    title: string
    description: string
    icon: ComponentType
    submitText: string
    showCloseButton?: boolean
    submitDisabled?: boolean
    cancelDisabled?: boolean
    submitTestId?: string
    class?: string
    children?: Snippet
    cancelIcon?: ComponentType
    submitIcon?: ComponentType
    submitVariant?: 'default' | 'accent'
    oncancel?: () => void
    onsubmit?: () => void
  }

  let {
    open = $bindable(false),
    title,
    description,
    icon,
    submitText,
    showCloseButton = true,
    submitDisabled = false,
    cancelDisabled = false,
    submitTestId,
    class: className,
    children,
    cancelIcon = X,
    submitIcon = Check,
    submitVariant = 'default',
    oncancel,
    onsubmit
  }: Props = $props()

  const closeDialog = () => {
    // Keep backdrop clicks, Escape, X, and Cancel blocked through one path.
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
  <div class="cthulhuUiDialogLayer" role="presentation" onclick={closeDialog}>
    <CardSurface
      variant="solid"
      class={mergeClasses('flex flex-col gap-4 p-6', className)}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="flex items-start gap-4">
        <div class="min-w-0 flex-1">
          <TitleBlock {title} {description} {icon} variant="large" />
        </div>

        {#if showCloseButton}
          <IconOnlyButton icon={X} label="Close" disabled={cancelDisabled} onclick={closeDialog} />
        {/if}
      </div>

      {#if children}
        <div class="min-w-0 space-y-3">
          {@render children()}
        </div>
      {/if}

      <div class="flex justify-end gap-3">
        <IconTextButton
          icon={cancelIcon}
          text="Cancel"
          state={cancelDisabled ? 'disabled' : 'enabled'}
          onclick={closeDialog}
        />
        <IconTextButton
          icon={submitIcon}
          text={submitText}
          state={submitDisabled ? 'disabled' : 'enabled'}
          variant={submitVariant}
          testId={submitTestId}
          onclick={submitDialog}
        />
      </div>
    </CardSurface>
  </div>
{/if}

<style>
  .cthulhuUiDialogLayer {
    align-items: center;
    background-color: oklch(0 0 0 / 50%);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 1rem;
    position: fixed;
    z-index: 50;
  }
</style>
