/** Placement inputs retain the existing popup and dropdown positioning rules. */
type CssAnchorPosition =
  | {
      placement: 'bottom-left'
      anchored: boolean
      offsetX: number
      offsetY: number
    }
  | {
      placement: 'cursor' | 'below-trigger'
      alignment: 'left' | 'right'
      cursorOffset: { x: number; y: number } | null
      width: string
      size: { width: number; height: number }
    }

/** One identity sequence prevents collisions between popup and dropdown anchors. */
let nextAnchorId = 0
/** Shared horizontal viewport clearance also limits bottom-left popup width. */
const viewportMargin = 16
/** Cursor menus align their first item with the opening pointer position. */
const firstItemCenterOffset = 25
/** Below-trigger dropdowns retain their existing vertical gap. */
const belowTriggerGap = 4
/** Clamped dropdowns leave room below their rendered border box. */
const bottomGap = 8

/** Creates one CSS anchor with shared registration, cleanup, and placement calculations. */
export const createCssAnchor = () => {
  /** Stable identity connects this owner's element to its portalled surface. */
  const anchorName = `--cthulhu-anchor-${++nextAnchorId}`

  /** Publishes live element edges and returns cleanup that restores its prior anchor names. */
  const attach = (element: HTMLElement): (() => void) => {
    /** Existing identity remains available to other consumers of the anchor element. */
    const previousName = element.style.getPropertyValue('anchor-name')
    element.style.setProperty('anchor-name', previousName ? `${previousName}, ${anchorName}` : anchorName)
    return () => {
      if (previousName) element.style.setProperty('anchor-name', previousName)
      else element.style.removeProperty('anchor-name')
    }
  }

  /** Builds live CSS placement while retaining each surface's offsets and width constraints. */
  const getStyle = (position: CssAnchorPosition): string => {
    if (position.placement === 'bottom-left') {
      return `position-anchor: ${position.anchored ? anchorName : 'auto'};
        left: calc(${position.anchored ? 'anchor(left)' : '0px'} + ${position.offsetX}px);
        bottom: calc(${position.anchored ? 'anchor(bottom)' : '0px'} + ${position.offsetY}px);
        max-width: calc(${position.anchored ? 'anchor-size(width)' : '100vw'} - ${position.offsetX + viewportMargin}px);`
    }

    /** Below-trigger menus grow with their trigger; cursor menus retain their requested width. */
    const width = position.placement === 'below-trigger'
      ? `max(${position.width}, anchor-size(width))`
      : position.width
    /** Horizontal attachment preserves opening cursor offsets and left/right alignment. */
    const anchorX = position.cursorOffset
      ? `anchor(left) + ${position.cursorOffset.x}px`
      : position.placement === 'below-trigger' && position.alignment === 'left'
        ? 'anchor(left)'
        : 'anchor(right)'
    /** Vertical attachment preserves first-item cursor alignment and the below-trigger gap. */
    const anchorY = position.placement === 'below-trigger'
      ? `anchor(bottom) + ${belowTriggerGap}px`
      : `${position.cursorOffset ? `anchor(top) + ${position.cursorOffset.y}px` : 'anchor(center)'} - ${firstItemCenterOffset}px`

    return `position-anchor: ${anchorName}; width: ${width};
      left: clamp(${viewportMargin}px, calc(${anchorX} - ${position.alignment === 'right' ? position.size.width : 0}px), calc(100vw - ${position.size.width + viewportMargin}px));
      top: clamp(${viewportMargin}px, calc(${anchorY}), calc(100vh - ${position.size.height + bottomGap}px));`
  }

  return { attach, getStyle }
}
