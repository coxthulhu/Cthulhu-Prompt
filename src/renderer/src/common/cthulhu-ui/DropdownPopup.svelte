<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import CardSurface from './CardSurface.svelte'
  import { mergeClasses } from './mergeClasses'

  export type DropdownPopupItemVariant = 'neutral' | 'accent' | 'danger'

  export type DropdownPopupItem = {
    id: string
    label: string
    detail?: string
    icon: ComponentType
    variant?: DropdownPopupItemVariant
  }

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
    close: () => void
    ariaHaspopup: 'menu'
    ariaExpanded: boolean
  }

  type Props = {
    label: string
    items: DropdownPopupItem[]
    trigger: Snippet<[DropdownPopupTriggerContext]>
    title?: string
    class?: string
    menuWidth?: string
    menuMaxHeight?: string
    testId?: string
    onclose?: () => void
    onselect?: (item: DropdownPopupItem) => void
  }

  let {
    label,
    items,
    trigger,
    title,
    class: className,
    menuWidth = '236px',
    menuMaxHeight = 'calc(100vh - 32px)',
    testId,
    onclose,
    onselect
  }: Props = $props()

  const fallbackMenuWidth = 236
  const fallbackMenuHeight = 336
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
  let measuredMenuSize = $state({ width: fallbackMenuWidth, height: fallbackMenuHeight })

  const getMenuPosition = (anchor: MenuAnchor, menuWidthPx: number, menuHeight: number): MenuPosition => {
    return {
      left: Math.max(
        viewportMargin,
        Math.min(anchor.x + 12, window.innerWidth - menuWidthPx - viewportMargin)
      ),
      top: Math.max(
        viewportMargin,
        Math.min(anchor.y - 8, window.innerHeight - menuHeight - bottomGap)
      )
    }
  }

  const getMenuAnchor = (element: HTMLElement): MenuAnchor => {
    const triggerRect = element.getBoundingClientRect()
    return {
      x: triggerRect.right,
      y: triggerRect.top + triggerRect.height / 2
    }
  }

  const getOpenMenuAnchor = (event?: MouseEvent): MenuAnchor | null => {
    if (event && event.detail !== 0) {
      return { x: event.clientX, y: event.clientY }
    }

    return anchorElement ? getMenuAnchor(anchorElement) : null
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

  const menuTitle = $derived(title?.trim() ? title : null)
  const menuPosition = $derived(
    menuAnchor
      ? getMenuPosition(
          menuAnchor,
          measuredMenuSize.width,
          measuredMenuSize.height
        )
      : { left: 0, top: 0 }
  )
  const menuLayerStyle = $derived(
    `--cthulhu-ui-dropdown-popup-menu-width: ${menuWidth}; --cthulhu-ui-dropdown-popup-menu-max-height: ${menuMaxHeight}; left: ${menuPosition.left}px; top: ${menuPosition.top}px;`
  )

  const portalToBody: Action<HTMLDivElement> = (node) => {
    // Move fixed popups out of component containers so they are not clipped by local overflow.
    document.body.appendChild(node)

    return {
      destroy() {
        node.remove()
      }
    }
  }

  const closeMenu = () => {
    open = false
    menuAnchor = null
    onclose?.()
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

    menuAnchor = nextMenuAnchor
    measuredMenuSize = { width: fallbackMenuWidth, height: fallbackMenuHeight }
    open = true
  }

  const triggerContext = $derived({
    triggerAction,
    open,
    toggle: toggleMenu,
    close: closeMenu,
    ariaHaspopup: 'menu' as const,
    ariaExpanded: open
  })

  const selectItem = (item: DropdownPopupItem) => {
    closeMenu()
    onselect?.(item)
  }

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
    document.addEventListener('touchmove', preventBackgroundScroll, { capture: true, passive: false })

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
    class={mergeClasses('cthulhuUiDropdownPopupLayer', className)}
    style={menuLayerStyle}
    use:portalToBody
  >
    <CardSurface
      variant="solid"
      class="cthulhuUiDropdownPopupMenu p-2"
      role="menu"
      aria-label={menuTitle ?? label}
      data-testid={testId}
    >
      {#if menuTitle}
        <div class="cthulhuUiDropdownPopupTitle">{menuTitle}</div>
      {/if}

      <div class="cthulhuUiDropdownPopupItems">
        {#each items as item (item.id)}
          {@const ItemIcon = item.icon}
          <button
            type="button"
            class="cthulhuUiDropdownPopupItem"
            role="menuitem"
            data-variant={item.variant ?? 'neutral'}
            onclick={() => selectItem(item)}
          >
            <ItemIcon size={16} aria-hidden="true" />
            <span class="cthulhuUiDropdownPopupItemText">
              <span class="cthulhuUiDropdownPopupItemLabel">{item.label}</span>
              {#if item.detail}
                <span class="cthulhuUiDropdownPopupItemDetail">{item.detail}</span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </CardSurface>
  </div>
{/if}

<style>
  .cthulhuUiDropdownPopupLayer {
    color: var(--ui-normal-text);
    max-height: var(--cthulhu-ui-dropdown-popup-menu-max-height);
    overflow-y: auto;
    overscroll-behavior: contain;
    position: fixed;
    width: var(--cthulhu-ui-dropdown-popup-menu-width);
    z-index: 30;
  }

  .cthulhuUiDropdownPopupTitle {
    color: var(--ui-muted-text);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
    padding: 5px 8px 7px;
    text-transform: uppercase;
  }

  .cthulhuUiDropdownPopupItems {
    display: grid;
    gap: 2px;
  }

  .cthulhuUiDropdownPopupItem {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 10px;
    grid-template-columns: 18px minmax(0, 1fr);
    min-height: 42px;
    padding: 8px 10px;
    text-align: left;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiDropdownPopupItem[data-variant='accent'] {
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiDropdownPopupItem[data-variant='danger'] {
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiDropdownPopupItem:hover {
    background: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupItem[data-variant='accent']:hover {
    background: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
  }

  .cthulhuUiDropdownPopupItem[data-variant='danger']:hover {
    background: var(--ui-danger-hover-surface);
    border-color: var(--ui-danger-hover-border);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiDropdownPopupItemText {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .cthulhuUiDropdownPopupItemLabel {
    font-size: 13px;
    font-weight: 650;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiDropdownPopupItemDetail {
    color: var(--ui-muted-text);
    font-size: 11px;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
