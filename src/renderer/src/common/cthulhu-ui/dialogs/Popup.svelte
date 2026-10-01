<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import { createCssAnchor } from '@renderer/common/cthulhu-ui/cssAnchor'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import { registerKeyboardScope } from '@renderer/common/keyboardRouter'

  /** Shared overlay behavior with caller-owned content and close controls. */
  type Props = {
    open?: boolean
    title: string
    backdrop?: boolean
    closeDisabled?: boolean
    closeOnOutsideClick?: boolean
    placement?: 'center' | 'bottom-left'
    anchor?: HTMLElement
    offsetX?: number
    offsetY?: number
    class?: string
    layerClass?: string
    testId?: string
    busy?: boolean
    children: Snippet<[() => void]>
    onclose?: () => void
  }

  /** Reactive overlay configuration and content supplied by the owner. */
  let {
    open = $bindable(false),
    title,
    backdrop = true,
    closeDisabled = false,
    closeOnOutsideClick = false,
    placement = 'center',
    anchor,
    offsetX = 16,
    offsetY = 16,
    class: className,
    layerClass,
    testId,
    busy,
    children,
    onclose
  }: Props = $props()

  /** Native dialog owns background inertness and modal focus containment. */
  let layer = $state<HTMLDialogElement>()
  /** Nonmodal popups own shortcuts only while focus is inside their content. */
  let hasFocus = $state(false)
  /** Shared anchor owns the identity, element registration, and positioning calculations. */
  const cssAnchor = createCssAnchor()
  /** Live CSS anchor edges keep placement aligned through scrolling and resizing. */
  const surfaceStyle = $derived(
    placement === 'bottom-left'
      ? cssAnchor.getStyle({ placement, anchored: !!anchor, offsetX, offsetY })
      : undefined
  )

  /** Dismisses user requests unless closing is disabled; parents can still set open. */
  const closePopup = (): void => {
    if (closeDisabled) return
    open = false
    onclose?.()
  }

  /** Dismisses outside pointer presses before click handlers can open a new popup. */
  const handleOutsidePointerDown = (event: PointerEvent): void => {
    if (closeOnOutsideClick && layer &&
      (event.target === layer || !layer.contains(event.target as Node))) {
      // Prevent the modal layer from taking focus after native close restores the opener.
      if (backdrop) event.preventDefault()
      closePopup()
    }
  }

  /** Tracks focus ownership without blocking background shortcuts in nonmodal mode. */
  const handleFocus = (event: FocusEvent): void => {
    hasFocus = !!layer?.contains(event.target as Node)
  }

  /** Portals the overlay outside clipping containers and restores focus on removal. */
  const portalToBody: Action<HTMLDialogElement> = (node) => {
    /** Retains the original opener across native close/show calls that change modality. */
    const opener = document.activeElement as HTMLElement
    document.body.appendChild(node)
    return {
      destroy() {
        node.close()
        node.remove()
        opener.focus({ preventScroll: true })
      }
    }
  }

  // Side effect: publish the optional anchor's live edges and restore its previous CSS identity.
  $effect(() => {
    if (!anchor) return
    return cssAnchor.attach(anchor)
  })

  // Side effect: switch modality without remounting content or losing its current focus.
  $effect(() => {
    if (!layer) return
    /** Focused content survives changes between native modal and nonmodal presentation. */
    const focused = document.activeElement as HTMLElement
    if (layer.open) layer.close()
    if (backdrop) layer.showModal()
    else layer.show()
    if (layer.contains(focused)) focused.focus({ preventScroll: true })
  })

  // Side effect: consume modal shortcuts, including disabled Escape, until the popup closes.
  $effect(() => {
    if (!open || (!backdrop && !hasFocus)) return
    return registerKeyboardScope({
      layer: 'dialog',
      bindings: [{ matches: (event) => event.key === 'Escape', run: closePopup }]
    })
  })
</script>

<svelte:window onfocusin={handleFocus} />
<svelte:document onpointerdown={handleOutsidePointerDown} />

<!-- Shared popup surface; native modality blocks pointer, keyboard, and accessibility access. -->
{#if open}
  <!-- svelte-ignore a11y_no_redundant_roles (Keep the explicit role used by shared dialog selectors.) -->
  <dialog
    bind:this={layer}
    class={mergeClasses('cthulhuUiPopupLayer', layerClass)}
    data-backdrop={backdrop}
    data-placement={placement}
    role="dialog"
    aria-label={title}
    aria-modal={backdrop}
    aria-busy={busy}
    data-testid={testId}
    use:portalToBody
    oncancel={(event) => { event.preventDefault(); closePopup() }}
  >
    <CardSurface
      variant="overlay"
      class={mergeClasses('cthulhuUiPopupSurface', className)}
      style={surfaceStyle}
    >
      {@render children(closePopup)}
    </CardSurface>
  </dialog>
{/if}

<style>
  .cthulhuUiPopupLayer {
    -webkit-app-region: no-drag;
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    box-sizing: border-box;
    color: var(--ui-normal-text);
    height: 100%;
    inset: 0;
    justify-content: center;
    margin: 0;
    max-height: none;
    max-width: none;
    padding: 16px;
    pointer-events: none;
    position: fixed;
    width: 100%;
    z-index: var(--z-modal);
  }

  .cthulhuUiPopupLayer[open] {
    display: flex;
  }

  .cthulhuUiPopupLayer[data-backdrop='true'] {
    pointer-events: auto;
  }

  .cthulhuUiPopupLayer::backdrop {
    background: var(--ui-card-normal-shadow);
  }

  .cthulhuUiPopupLayer :global(.cthulhuUiPopupSurface) {
    max-height: calc(100vh - 32px);
    overflow: visible;
    pointer-events: auto;
  }

  .cthulhuUiPopupLayer[data-placement='bottom-left'] :global(.cthulhuUiPopupSurface) {
    position: fixed;
  }
</style>
