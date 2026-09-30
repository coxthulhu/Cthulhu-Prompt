<script module lang="ts">
  // Holds the closer for the single dropdown currently open across the renderer.
  let activeDropdownCloser: (() => void) | null = null
  /** Gives each mounted trigger its own CSS anchor name across body portals. */
  let nextAnchorId = 0
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { registerDragDropDropdown } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'

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
  const firstItemCenterOffset = 25
  const cursorContextMenuGap = 4
  const belowTriggerGap = 4
  const bottomGap = 8
  const viewportMargin = 16
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
  /** Stable CSS identity connecting this trigger to its portalled menu. */
  const anchorName = `--cthulhu-dropdown-${++nextAnchorId}`
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

  const triggerAction: DropdownPopupTriggerAction = (node) => {
    anchorElement = node
    node.style.setProperty('anchor-name', anchorName)

    return {
      destroy() {
        node.style.removeProperty('anchor-name')
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

  /** Below-trigger menus grow with their trigger as the surrounding layout changes. */
  const resolvedMenuWidth = $derived(
    placement === 'below-trigger' ? `max(${menuWidth}, anchor-size(width))` : menuWidth
  )
  /** Horizontal attachment preserves cursor offsets and existing left/right alignment. */
  const anchorX = $derived(
    cursorOffset
      ? `anchor(left) + ${cursorOffset.x}px`
      : placement === 'below-trigger' && menuAlignment === 'left' ? 'anchor(left)' : 'anchor(right)'
  )
  /** Vertical attachment retains the first-item cursor alignment and below-trigger gap. */
  const anchorY = $derived(
    placement === 'below-trigger'
      ? `anchor(bottom) + ${belowTriggerGap}px`
      : `${cursorOffset ? `anchor(top) + ${cursorOffset.y}px` : 'anchor(center)'} - ${firstItemCenterOffset}px`
  )
  /** CSS clamps live anchor coordinates against the viewport using the observed menu size. */
  const menuLayerStyle = $derived(
    `position-anchor: ${anchorName}; width: ${resolvedMenuWidth};
    left: clamp(${viewportMargin}px, calc(${anchorX} - ${menuAlignment === 'right' ? measuredMenuSize.width : 0}px), calc(100vw - ${measuredMenuSize.width + viewportMargin}px));
    top: clamp(${viewportMargin}px, calc(${anchorY}), calc(100vh - ${measuredMenuSize.height + bottomGap}px));`
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

  const portalToBody: Action<HTMLDivElement> = (node) => {
    // Move fixed popups out of component containers so they are not clipped by local overflow.
    document.body.appendChild(node)

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
    use:portalToBody
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
