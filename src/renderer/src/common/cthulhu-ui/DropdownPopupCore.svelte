<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { registerDragDropDropdown } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import CardSurface from './CardSurface.svelte'

  export type DropdownPopupPlacement = 'cursor' | 'below-trigger'
  export type DropdownPopupMenuAlignment = 'left' | 'right'

  type MenuPosition = {
    left: number
    top: number
  }

  type MenuAnchor = {
    x: number
    y: number
  }

  type DropdownPopupTriggerAction = Action<HTMLElement, unknown>

  export type DropdownPopupTriggerContext = {
    triggerAction: DropdownPopupTriggerAction
    open: boolean
    toggle: (event?: MouseEvent) => void
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
  let menuAnchor = $state<MenuAnchor | null>(null)
  let open = $state(false)
  let openedByDrag = $state(false)
  let measuredMenuSize = $state({ width: fallbackMenuWidth, height: fallbackMenuHeight })
  let triggerWidth = $state(fallbackMenuWidth)

  const getMenuPosition = (
    anchor: MenuAnchor,
    menuWidthPx: number,
    menuHeight: number
  ): MenuPosition => {
    const anchoredLeft = menuAlignment === 'right' ? anchor.x - menuWidthPx : anchor.x

    return {
      left: Math.max(
        viewportMargin,
        Math.min(anchoredLeft, window.innerWidth - menuWidthPx - viewportMargin)
      ),
      top: Math.max(
        viewportMargin,
        Math.min(
          placement === 'below-trigger' ? anchor.y : anchor.y - firstItemCenterOffset,
          window.innerHeight - menuHeight - bottomGap
        )
      )
    }
  }

  const getTriggerAnchor = (element: HTMLElement): MenuAnchor => {
    const triggerRect = element.getBoundingClientRect()

    triggerWidth = triggerRect.width

    if (placement === 'below-trigger') {
      return {
        x: menuAlignment === 'right' ? triggerRect.right : triggerRect.left,
        y: triggerRect.bottom + belowTriggerGap
      }
    }

    return {
      x: triggerRect.right,
      y: triggerRect.top + triggerRect.height / 2
    }
  }

  const getOpenMenuAnchor = (event?: MouseEvent): MenuAnchor | null => {
    if (placement === 'cursor' && event && event.detail !== 0) {
      return { x: event.clientX, y: event.clientY }
    }

    return anchorElement ? getTriggerAnchor(anchorElement) : null
  }

  const closeMenu = () => {
    open = false
    openedByDrag = false
    menuAnchor = null
  }

  const openMenu = (nextMenuAnchor: MenuAnchor, nextOpenedByDrag: boolean) => {
    menuAnchor = nextMenuAnchor
    measuredMenuSize = { width: fallbackMenuWidth, height: fallbackMenuHeight }
    openedByDrag = nextOpenedByDrag
    open = true
  }

  const triggerAction: DropdownPopupTriggerAction = (node) => {
    anchorElement = node

    return {
      destroy() {
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

    const nextMenuAnchor = getOpenMenuAnchor(event)

    if (!nextMenuAnchor) {
      return
    }

    openMenu(nextMenuAnchor, false)
  }

  const openMenuForDrag = () => {
    if (open || !anchorElement) {
      return
    }

    openMenu(getTriggerAnchor(anchorElement), true)
  }

  const closeDragOpenedMenu = () => {
    if (openedByDrag) {
      closeMenu()
    }
  }

  const resolvedMenuWidth = $derived(
    placement === 'below-trigger' ? `max(${menuWidth}, ${triggerWidth}px)` : menuWidth
  )
  const menuPosition = $derived(
    menuAnchor
      ? getMenuPosition(menuAnchor, measuredMenuSize.width, measuredMenuSize.height)
      : { left: 0, top: 0 }
  )
  const menuLayerStyle = $derived(
    `--cthulhu-ui-dropdown-popup-menu-width: ${resolvedMenuWidth}; left: ${menuPosition.left}px; top: ${menuPosition.top}px;`
  )

  const triggerContext = $derived({
    triggerAction,
    open,
    toggle: toggleMenu,
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
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        return
      }

      if (scrollKeys.has(event.key)) {
        event.preventDefault()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('wheel', preventBackgroundScroll, { capture: true, passive: false })
    document.addEventListener('touchmove', preventBackgroundScroll, {
      capture: true,
      passive: false
    })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('wheel', preventBackgroundScroll, { capture: true })
      document.removeEventListener('touchmove', preventBackgroundScroll, { capture: true })
    }
  })

  // Side effect: once rendered, clamp the fixed popup using its actual measured height.
  $effect(() => {
    if (!open || !menuLayerRef) {
      return
    }

    const menuRect = menuLayerRef.getBoundingClientRect()
    measuredMenuSize = { width: menuRect.width, height: menuRect.height }
  })
</script>

{@render trigger(triggerContext)}

{#if open && menuAnchor}
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
    color: var(--ui-normal-text);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    overscroll-behavior: contain;
    position: fixed;
    width: var(--cthulhu-ui-dropdown-popup-menu-width);
    z-index: 60;
  }
</style>
