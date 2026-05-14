<script lang="ts">
  import { Check, X } from 'lucide-svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import CardSurface from './CardSurface.svelte'
  import IconOnlyButton from './IconOnlyButton.svelte'
  import IconTextButton from './IconTextButton.svelte'
  import SectionHeader from './SectionHeader.svelte'
  import TitleBlock from './TitleBlock.svelte'
  import { mergeClasses } from './mergeClasses'

  type DialogIconVariant = 'accent' | 'danger'
  type DialogSubmitVariant = 'neutral' | 'accent' | 'danger'
  type DialogHeaderStyle = 'dialog' | 'section'

  type Props = {
    open?: boolean
    title: string
    description: string
    icon: ComponentType
    submitText: string
    headerStyle?: DialogHeaderStyle
    showCloseButton?: boolean
    showSubmitButton?: boolean
    closeOnOutsideClick?: boolean
    iconVariant?: DialogIconVariant
    submitDisabled?: boolean
    cancelDisabled?: boolean
    submitTestId?: string
    class?: string
    children?: Snippet
    cancelIcon?: ComponentType
    submitIcon?: ComponentType
    submitVariant?: DialogSubmitVariant
    oncancel?: () => void
    onsubmit?: () => void
  }

  let {
    open = $bindable(false),
    title,
    description,
    icon,
    submitText,
    headerStyle = 'dialog',
    showCloseButton = true,
    showSubmitButton = true,
    closeOnOutsideClick = true,
    iconVariant = 'accent',
    submitDisabled = false,
    cancelDisabled = false,
    submitTestId,
    class: className,
    children,
    cancelIcon = X,
    submitIcon = Check,
    submitVariant = 'neutral',
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

  const handleOutsideClick = () => {
    if (!closeOnOutsideClick) {
      return
    }

    closeDialog()
  }

  const portalToBody: Action<HTMLDivElement> = (node) => {
    // Move overlays out of virtualized rows so fixed positioning covers the viewport.
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
  <div class="cthulhuUiDialogLayer" role="presentation" use:portalToBody onclick={handleOutsideClick}>
    <CardSurface
      variant="solid"
      class={mergeClasses('flex flex-col gap-4 p-4', className)}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="flex items-start gap-4">
        <div class="min-w-0 flex-1">
          {#if headerStyle === 'section'}
            <SectionHeader
              {title}
              {description}
              {icon}
              {iconVariant}
              headingLevel={2}
            />
          {:else}
            <TitleBlock {title} {description} {icon} {iconVariant} size="large" />
          {/if}
        </div>

        {#if showCloseButton}
          <IconOnlyButton
            icon={X}
            label="Close"
            variant="outline"
            disabled={cancelDisabled}
            onclick={closeDialog}
          />
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
        {#if showSubmitButton}
          <IconTextButton
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
    background-color: oklch(0 0 0 / 50%);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 1rem;
    position: fixed;
    z-index: 50;
  }
</style>
