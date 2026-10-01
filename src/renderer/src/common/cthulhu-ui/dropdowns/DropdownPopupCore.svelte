<script module lang="ts">
  // Holds the closer for the single dropdown currently open across the renderer.
  let activeDropdownCloser: (() => void) | null = null
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { registerDragDropDropdown } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import { createCssAnchor } from '@renderer/common/cthulhu-ui/cssAnchor'

  export type DropdownPopupPlacement = 'cursor' | 'below-trigger'
  export type DropdownPopupMenuAlignment = 'left' | 'right'

  /** Opening cursor offset from the trigger's top-left corner, in CSS pixels. */
  type CursorOffset = {
    x: number
    y: number
  }

  type DropdownPopupTriggerAction = Action<HTMLElement, unknown>

  export type DropdownPopupTriggerContext = {
    triggerAction: DropdownPopupTriggerAction
    open: boolean
    toggle: (event?: MouseEvent) => void
    /** Opens or repositions the popup at a mouse event's cursor coordinates. */
    openAt: (event: MouseEvent) => void
    ariaHaspopup: 'menu'
    ariaExpanded: boolean
  }

  export type DropdownPopupContentContext = {
    close: () => void
  }

  type Props = {
    label: string
    trigger: Snippet<[DropdownPopupTriggerContext]>
    children: Snippet<[DropdownPopupContentContext]>
    menuWidth?: string
    menuClass?: string
    testId?: string
    placement?: DropdownPopupPlacement
    menuAlignment?: DropdownPopupMenuAlignment
    dragOpenTypes?: string[]
  }

  let {
    label,
    trigger,
    children,
    menuWidth = '236px',
    menuClass,
    testId,
    placement = 'cursor',
    menuAlignment = 'left',
    dragOpenTypes = []
  }: Props = $props()

  const fallbackMenuWidth = 236
  const fallbackMenuHeight = 336
  const cursorContextMenuGap = 4
  const scrollKeys = new Set([
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'End',
    'Home',
    'PageDown',
    'PageUp',
    ' '
  ])

  let menuLayerRef = $state<HTMLDivElement | null>(null)
  let anchorElement = $state<HTMLElement | null>(null)
  /** Shared anchor owns the identity, trigger registration, and positioning calculations. */
  const cssAnchor = createCssAnchor()
  /** Null uses the trigger's live edges for keyboard and drag opening. */
  let cursorOffset = $state<CursorOffset | null>(null)
  let open = $state(false)
  let openedByDrag = $state(false)
  let measuredMenuSize = $state({ width: fallbackMenuWidth, height: fallbackMenuHeight })

  const closeMenu = () => {
    open = false
    openedByDrag = false
    cursorOffset = null

    if (activeDropdownCloser === closeMenu) {
      activeDropdownCloser = null
    }
  }

  /** Opens against live trigger edges or captures a fixed cursor offset from that trigger. */
  const openMenu = (nextOpenedByDrag: boolean, event?: MouseEvent, cursorGap = 0) => {
    if (!anchorElement) return
    activeDropdownCloser?.()
    activeDropdownCloser = closeMenu
    if (placement === 'cursor' && event) {
      /** Only the opening offset is measured; CSS tracks all subsequent trigger movement. */
      const triggerRect = anchorElement.getBoundingClientRect()
      cursorOffset = {
        x: event.clientX + cursorGap - triggerRect.left,
        y: event.clientY - triggerRect.top
      }
    }
    measuredMenuSize = { width: fallbackMenuWidth, height: fallbackMenuHeight }
    openedByDrag = nextOpenedByDrag
    open = true
  }

  /** Registers the trigger's CSS anchor and closes its menu when the trigger unmounts. */
  const triggerAction: DropdownPopupTriggerAction = (node) => {
    anchorElement = node
    /** Shared cleanup restores the trigger's original anchor names on removal. */
    const detachAnchor = cssAnchor.attach(node)

    return {
      destroy() {
        detachAnchor()
        if (anchorElement === node) {
          anchorElement = null
          closeMenu()
        }
      }
    }
  }

  const toggleMenu = (event?: MouseEvent) => {
    if (open) {
      closeMenu()
      return
    }

    openMenu(false, event?.detail !== 0 ? event : undefined)
  }

  // Opens or repositions the popup from an explicit mouse interaction.
  const openMenuAt = (event: MouseEvent): void => {
    openMenu(false, event, cursorContextMenuGap)
  }

  const openMenuForDrag = () => {
    if (open || !anchorElement) {
      return
    }

    openMenu(true)
  }

  const closeDragOpenedMenu = () => {
    if (openedByDrag) {
      closeMenu()
    }
  }

  /** CSS clamps live anchor coordinates against the viewport using the observed menu size. */
  const menuLayerStyle = $derived(
    cssAnchor.getStyle({
      placement,
      alignment: menuAlignment,
      cursorOffset,
      width: menuWidth,
      size: measuredMenuSize
    })
  )

  const triggerContext = $derived({
    triggerAction,
    open,
    toggle: toggleMenu,
    openAt: openMenuAt,
    ariaHaspopup: 'menu' as const,
    ariaExpanded: open
  })
  const contentContext = $derived({ close: closeMenu })

  /** Keeps portalled menus inside their owning modal, or in the document body. */
  const portalToOverlay: Action<HTMLDivElement> = (node) => {
    // Side effect: escape clipping while keeping modal-owned menus inside the native top layer.
    const portalRoot = anchorElement?.closest('dialog') ?? document.body
    portalRoot.appendChild(node)

    return {
      destroy() {
        node.remove()
      }
    }
  }

  // Side effect: expose this popup to the drag/drop layer while its trigger is mounted.
  $effect(() => {
    const triggerNode = anchorElement
    if (!triggerNode) {
      return
    }

    return registerDragDropDropdown({
      triggerNode,
      getMenuNode: () => menuLayerRef,
      getDragOpenTypes: () => dragOpenTypes,
      isOpen: () => open,
      openForDrag: openMenuForDrag,
      closeDragOpened: closeDragOpenedMenu
    })
  })

  // Side effect: dismiss the open popup from document-level outside clicks and Escape.
  $effect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (anchorElement?.contains(target) || menuLayerRef?.contains(target)) {
        return
      }

      closeMenu()
    }

    const preventBackgroundScroll = (event: Event) => {
      const target = event.target as Node

      if (menuLayerRef?.contains(target)) {
        return
      }

      event.preventDefault()
      // Custom virtual scrolling must not receive a cancelled background gesture.
      event.stopPropagation()
    }

    /** Owns popup dismissal and scroll keys without invoking covered components. */
    const unregisterKeyboardScope = registerKeyboardScope({
      layer: 'dropdown',
      bindings: [
        { matches: (event) => event.key === 'Escape', run: closeMenu },
        {
          matches: (event) => scrollKeys.has(event.key),
          // The router consumes scroll keys to preserve the existing background scroll lock.
          run: null
        }
      ]
    })

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('wheel', preventBackgroundScroll, { capture: true, passive: false })
    document.addEventListener('touchmove', preventBackgroundScroll, {
      capture: true,
      passive: false
    })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      unregisterKeyboardScope()
      document.removeEventListener('wheel', preventBackgroundScroll, { capture: true })
      document.removeEventListener('touchmove', preventBackgroundScroll, { capture: true })
    }
  })

  // Side effect: update edge clamping when menu content, trigger width, or display scale changes.
  $effect(() => {
    if (!open || !menuLayerRef) {
      return
    }

    /** The portal's border box includes any scrollbar and constrains viewport clamping. */
    const menuNode = menuLayerRef
    /** Refreshes dimensions without measuring or tracking the trigger's position. */
    const measureMenu = () => {
      /** Current rendered dimensions, including the menu's maximum-height constraint. */
      const menuRect = menuNode.getBoundingClientRect()
      measuredMenuSize = { width: menuRect.width, height: menuRect.height }
    }
    /** Tracks menu resizing independently of the event that caused it. */
    const observer = new ResizeObserver(measureMenu)
    measureMenu()
    observer.observe(menuNode)
    return () => observer.disconnect()
  })

  // Side effect: close fully clipped triggers, releasing scroll blocking and open-state visuals.
  $effect(() => {
    if (!open || !anchorElement) return
    /** Includes viewport boundaries and clipping ancestors such as virtual windows. */
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) closeMenu()
    })
    observer.observe(anchorElement)
    return () => observer.disconnect()
  })
</script>

{@render trigger(triggerContext)}

{#if open}
  <div
    bind:this={menuLayerRef}
    class="cthulhuUiDropdownPopupLayer"
    style={menuLayerStyle}
    use:portalToOverlay
  >
    <CardSurface
      variant="overlay"
      class={menuClass}
      role="menu"
      aria-label={label}
      data-testid={testId}
    >
      {@render children(contentContext)}
    </CardSurface>
  </div>
{/if}

<style>
  .cthulhuUiDropdownPopupLayer {
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: 0 0 12px var(--ui-shadow-raised);
    color: var(--ui-normal-text);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    overscroll-behavior: contain;
    position: fixed;
    z-index: var(--z-popup);
  }

  .cthulhuUiDropdownPopupLayer :global(.cthulhuUiCardSurface) {
    box-shadow: none;
  }
</style>
