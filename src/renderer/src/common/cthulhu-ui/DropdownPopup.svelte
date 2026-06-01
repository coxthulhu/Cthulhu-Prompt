<script lang="ts">
  import { MoreHorizontal } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  export type DropdownPopupItemTone = 'normal' | 'accent' | 'danger'

  export type DropdownPopupItem = {
    id: string
    label: string
    detail?: string
    icon: ComponentType
    tone?: DropdownPopupItemTone
  }

  type MenuPosition = {
    left: number
    top: number
  }

  type MenuAnchor = {
    x: number
    y: number
  }

  type Props = {
    label: string
    items: DropdownPopupItem[]
    title?: string
    triggerText?: string
    triggerIcon?: ComponentType
    disabled?: boolean
    class?: string
    triggerClass?: string
    testId?: string
    menuTestId?: string
    onselect?: (item: DropdownPopupItem) => void
  }

  let {
    label,
    items,
    title,
    triggerText,
    triggerIcon: TriggerIcon = MoreHorizontal,
    disabled = false,
    class: className,
    triggerClass,
    testId,
    menuTestId,
    onselect
  }: Props = $props()

  const fallbackMenuHeight = 336
  const bottomGap = 8
  const viewportMargin = 16
  const scrollKeys = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '])

  let open = $state(false)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let menuRef = $state<HTMLDivElement | null>(null)
  let menuAnchor = $state<MenuAnchor>({ x: 0, y: 0 })
  let menuPosition = $state<MenuPosition>({ left: 0, top: 0 })

  const menuTitle = $derived(title?.trim() ? title : null)

  const portalToBody: Action<HTMLDivElement> = (node) => {
    // Move fixed popups out of component containers so they are not clipped by local overflow.
    document.body.appendChild(node)

    return {
      destroy() {
        node.remove()
      }
    }
  }

  const getMenuPosition = (anchor: MenuAnchor, menuHeight: number): MenuPosition => {
    return {
      left: Math.max(viewportMargin, Math.min(anchor.x + 12, window.innerWidth - 260)),
      top: Math.max(
        viewportMargin,
        Math.min(anchor.y - 8, window.innerHeight - menuHeight - bottomGap)
      )
    }
  }

  const toggleMenu = (event: MouseEvent) => {
    if (!triggerRef || disabled) {
      return
    }

    if (open) {
      closeMenu()
      return
    }

    menuAnchor = { x: event.clientX, y: event.clientY }
    menuPosition = getMenuPosition(menuAnchor, fallbackMenuHeight)
    open = !open
  }

  const closeMenu = () => {
    open = false
  }

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

      if (triggerRef?.contains(target) || menuRef?.contains(target)) {
        return
      }

      closeMenu()
    }

    const preventScroll = (event: Event) => {
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
    document.addEventListener('wheel', preventScroll, { capture: true, passive: false })
    document.addEventListener('touchmove', preventScroll, { capture: true, passive: false })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('wheel', preventScroll, { capture: true })
      document.removeEventListener('touchmove', preventScroll, { capture: true })
    }
  })

  // Side effect: once rendered, clamp the fixed popup using its actual measured height.
  $effect(() => {
    if (!open || !menuRef) {
      return
    }

    menuPosition = getMenuPosition(menuAnchor, menuRef.getBoundingClientRect().height)
  })
</script>

<div class={mergeClasses('cthulhuUiDropdownPopup', className)}>
  <button
    bind:this={triggerRef}
    type="button"
    class={mergeClasses('cthulhuUiDropdownPopupTrigger', triggerClass)}
    aria-label={label}
    aria-haspopup="menu"
    aria-expanded={open}
    data-open={open ? 'true' : undefined}
    data-testid={testId}
    {disabled}
    onclick={toggleMenu}
  >
    {#if triggerText}
      <span class="cthulhuUiDropdownPopupTriggerText">{triggerText}</span>
    {/if}
    <TriggerIcon size={16} aria-hidden="true" />
  </button>
  {#if open}
    <div
      bind:this={menuRef}
      use:portalToBody
      class="cthulhuUiDropdownPopupMenu"
      role="menu"
      aria-label={menuTitle ?? label}
      data-testid={menuTestId}
      style:left={`${menuPosition.left}px`}
      style:top={`${menuPosition.top}px`}
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
            data-tone={item.tone ?? 'normal'}
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
    </div>
  {/if}
</div>

<style>
  .cthulhuUiDropdownPopup {
    display: inline-flex;
    position: relative;
  }

  .cthulhuUiDropdownPopupTrigger {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-interactive-normal-border);
    border-radius: var(--cthulhu-ui-radius-icon-button);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    gap: 7px;
    height: 34px;
    justify-content: center;
    min-width: 34px;
    padding: 0 9px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .cthulhuUiDropdownPopupTrigger:hover,
  .cthulhuUiDropdownPopupTrigger[data-open='true'] {
    background: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-interactive-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupTrigger:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiDropdownPopupTriggerText {
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }

  .cthulhuUiDropdownPopupMenu {
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-hover-border);
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    padding: 8px;
    position: fixed;
    width: 236px;
    z-index: 30;
  }

  .cthulhuUiDropdownPopupTitle {
    color: var(--ui-muted-text);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
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

  .cthulhuUiDropdownPopupItem[data-tone='accent'] {
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiDropdownPopupItem[data-tone='danger'] {
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiDropdownPopupItem:hover {
    background: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupItem[data-tone='accent']:hover {
    background: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
  }

  .cthulhuUiDropdownPopupItem[data-tone='danger']:hover {
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
